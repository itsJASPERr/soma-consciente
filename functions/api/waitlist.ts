import {
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';
import { offeringConsentVersion, waitlistConsentVersion } from '../../src/lib/waitlist-consent.ts';
import { offerings, retreatEditions } from '../../src/lib/offerings.ts';

type Context = {
  request: Request;
  env: {
    WAITLIST_DB?: {
      prepare(sql: string): {
        bind(...values: string[]): { run(): Promise<unknown> };
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
  let input: { offering?: unknown; name?: unknown; channel?: unknown; contact?: unknown; country?: unknown; consent?: unknown };
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
  const consentVersion = offering ? offeringConsentVersion : waitlistConsentVersion;
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
