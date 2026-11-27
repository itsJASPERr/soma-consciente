import {
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';
import { circleConsentVersion, offeringConsentVersion, retreatConsentVersion, waitlistConsentVersion } from '../../src/lib/waitlist-consent.ts';
import { retreatPaymentPlans, retreatRebates, undecidedPayment } from '../../src/lib/retreat-requests.ts';
import { circleOffering, offerings, retreatEditions } from '../../src/lib/offerings.ts';

type Context = {
  request: Request;
  env: {
    WAITLIST_DB?: {
      prepare(sql: string): {
        bind(...values: (string | null)[]): { run(): Promise<unknown>; first<T>(): Promise<T | null> };
      };
    };
  };
};

function response(status: number, error?: string) {
  const headers = { 'Cache-Control': 'no-store' };
  return error
    ? Response.json({ error }, { status, headers })
    : new Response(null, { status, headers });
}

export async function onRequest({ request, env }: Context) {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
  }
  if (request.headers.get('Origin') !== new URL(request.url).origin) return response(403, 'origin');
  const contentType = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') return response(415, 'format');
  if (!env.WAITLIST_DB) return response(503, 'unavailable');

  const reader = request.body?.getReader();
  if (!reader) return response(400, 'format');

  let bytes = 0;
  let body = '';
  const decoder = new TextDecoder();
  let input: { offering?: unknown; name?: unknown; channel?: unknown; contact?: unknown; country?: unknown; consent?: unknown; paymentPlan?: unknown; rebates?: unknown };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2048) {
        await reader.cancel();
        return response(413, 'size');
      }
      body += decoder.decode(value, { stream: true });
    }
    input = JSON.parse(body + decoder.decode());
  } catch {
    return response(400, 'format');
  }
  if (!input || typeof input !== 'object') return response(400, 'format');
  const { offering } = input;
  if (offering !== undefined &&
      (typeof offering !== 'string' ||
        (!offerings.some(offer => offer.slug === offering) && !retreatEditions.some(edition => edition.slug === offering)))) {
    return response(400, 'offering');
  }
  const { paymentPlan, rebates } = input;
  if (paymentPlan !== undefined && (
    !retreatEditions.some(edition => edition.slug === offering)
    || (paymentPlan !== undecidedPayment && !retreatPaymentPlans.some(plan => plan.id === paymentPlan))
  )) return response(400, 'payment_plan');
  if (rebates !== undefined && (paymentPlan === undefined || !Array.isArray(rebates)
    || rebates.length > retreatRebates.length || new Set(rebates).size !== rebates.length
    || rebates.some(id => !retreatRebates.some(rebate => rebate.id === id)))) return response(400, 'rebates');
  const isCircleRequest = Boolean(circleOffering && offering === circleOffering.slug && input.consent === circleConsentVersion);
  const consentVersion = paymentPlan !== undefined ? retreatConsentVersion
    : isCircleRequest ? circleConsentVersion
    : offering ? offeringConsentVersion : waitlistConsentVersion;
  if (input.consent !== consentVersion) return response(400, 'consent');

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 120) return response(400, 'name');

  const { channel, country } = input;
  const address = typeof input.contact === 'string' ? input.contact.trim() : '';
  if (!address || address.length > 254) return response(400, 'contact');

  let contact: string;
  if (channel === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return response(400, 'contact');
    contact = address.toLowerCase();
  } else if (channel === 'whatsapp') {
    if (typeof country !== 'string' || !isSupportedCountry(country as CountryCode)) {
      return response(400, 'contact');
    }
    const countryCode = country as CountryCode;
    const phone = parsePhoneNumberFromString(address, { defaultCountry: countryCode, extract: false });
    if (!phone?.isPossible() || phone.ext || phone.countryCallingCode !== getCountryCallingCode(countryCode)) {
      return response(400, 'contact');
    }
    contact = phone.number;
  } else {
    return response(400, 'channel');
  }

  if (typeof offering === 'string' && (isCircleRequest || typeof paymentPlan === 'string')) {
    const reference = 'SOMA-' + crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    try {
      const row = await env.WAITLIST_DB.prepare(`
        INSERT INTO offering_requests (offering, channel, contact, name, consent_version, reference, payment_plan, rebates)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (offering, channel, contact) DO UPDATE SET
          name = offering_requests.name,
          consented_at = CASE WHEN offering_requests.consent_version <> excluded.consent_version
            THEN excluded.consented_at ELSE offering_requests.consented_at END,
          consent_version = excluded.consent_version,
          reference = COALESCE(offering_requests.reference, excluded.reference),
          payment_plan = COALESCE(offering_requests.payment_plan, excluded.payment_plan),
          rebates = COALESCE(offering_requests.rebates, excluded.rebates)
        RETURNING reference, payment_plan AS paymentPlan, rebates
      `).bind(offering, channel, contact, name, consentVersion, reference,
        typeof paymentPlan === 'string' ? paymentPlan : null, JSON.stringify(rebates ?? []))
        .first<{ reference: string; paymentPlan: string | null; rebates: string }>();
      if (!row) return response(503, 'unavailable');
      return Response.json({ ...row, rebates: JSON.parse(row.rebates) }, {
        status: row.reference === reference ? 201 : 200,
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch {
      return response(503, 'unavailable');
    }
  }

  const table = offering ? 'offering_requests' : 'waitlist_signups';
  const insert = offering
    ? 'INSERT INTO offering_requests (offering, channel, contact, name, consent_version) VALUES (?, ?, ?, ?, ?)'
    : 'INSERT INTO waitlist_signups (channel, contact, name, consent_version) VALUES (?, ?, ?, ?)';
  const values = offering
    ? [offering, channel, contact, name, consentVersion]
    : [channel, contact, name, consentVersion];
  try {
    await env.WAITLIST_DB.prepare(
      insert +
      " ON CONFLICT DO UPDATE SET " +
      "name = COALESCE(" + table + ".name, excluded.name), " +
      "consented_at = CASE WHEN " + table + ".consent_version <> excluded.consent_version " +
      "THEN excluded.consented_at ELSE " + table + ".consented_at END, " +
      "consent_version = excluded.consent_version " +
      "WHERE " + table + ".name IS NULL OR " + table + ".consent_version <> excluded.consent_version",
    ).bind(...values).run();
  } catch {
    return response(503, 'unavailable');
  }

  return response(204);
}
