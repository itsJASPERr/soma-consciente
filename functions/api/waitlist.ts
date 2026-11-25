import {
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';
import { waitlistConsentVersion } from '../../src/lib/waitlist-consent.ts';

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
  let input: { channel?: unknown; contact?: unknown; country?: unknown; consent?: unknown };
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
  if (!input || typeof input !== 'object' || input.consent !== waitlistConsentVersion) {
    return response(400, 'consent');
  }

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

  try {
    await env.WAITLIST_DB.prepare(
      "INSERT INTO waitlist_signups (channel, contact, consent_version) VALUES (?, ?, ?) " +
      "ON CONFLICT (channel, contact) DO UPDATE SET consent_version = excluded.consent_version, " +
      "consented_at = excluded.consented_at WHERE waitlist_signups.consent_version <> excluded.consent_version",
    ).bind(channel, contact, waitlistConsentVersion).run();
  } catch {
    return response(503, 'unavailable');
  }

  return response(204);
}
