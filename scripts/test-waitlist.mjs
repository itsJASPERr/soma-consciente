import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../functions/api/waitlist.ts';
import { waitlistConsentVersion } from '../src/lib/waitlist-consent.ts';

const origin = 'https://www.soma-consciente.com';
const url = origin + '/api/waitlist';
const database = new DatabaseSync(':memory:');
database.exec(readFileSync(new URL('../migrations/0001_waitlist.sql', import.meta.url), 'utf8'));

const env = {
  WAITLIST_DB: {
    prepare(sql) {
      const statement = database.prepare(sql);
      return { bind: (...values) => ({ run: () => statement.run(...values) }) };
    },
  },
};

const email = { channel: 'email', contact: 'Prueba@example.com', consent: waitlistConsentVersion };
const whatsapp = {
  channel: 'whatsapp', country: 'AR', contact: '011 15 2345-6789', consent: waitlistConsentVersion,
};

async function submit(body, overrides = {}, bindings = env) {
  const request = new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, ...overrides },
    body: JSON.stringify(body),
  });
  const response = await onRequest({ request, env: bindings });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  return response.status;
}

try {
  const get = await onRequest({ request: new Request(url), env });
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('Allow'), 'POST');
  assert.equal(await submit(email, {}, {}), 503);
  assert.equal(await submit({ ...email, consent: undefined }), 400);
  assert.equal(await submit({ ...email, consent: 'old' }), 400);
  assert.equal(await submit(email, { Origin: 'https://example.org' }), 403);
  assert.equal(await submit(email, { 'Content-Type': 'text/plain' }), 415);
  assert.equal(await submit({ ...email, extra: 'x'.repeat(3000) }), 413);
  assert.equal(await submit({ ...whatsapp, country: 'BR' }), 400);
  assert.equal(await submit({ ...whatsapp, country: 'ZZ' }), 400);
  assert.equal(await submit({ ...email, contact: 'invalid' }), 400);
  assert.equal(await submit(email), 204);
  assert.equal(await submit({ ...email, contact: 'prueba@example.com' }), 204);
  assert.equal(await submit(whatsapp), 204);
  assert.equal(await submit({ ...whatsapp, contact: '+54 9 11 2345-6789' }), 204);

  const rows = database.prepare(
    'SELECT channel, contact, consent_version, consented_at FROM waitlist_signups ORDER BY channel',
  ).all();
  assert.deepEqual(rows.map(({ channel, contact, consent_version }) => ({ channel, contact, consent_version })), [
    { channel: 'email', contact: 'prueba@example.com', consent_version: waitlistConsentVersion },
    { channel: 'whatsapp', contact: '+5491123456789', consent_version: waitlistConsentVersion },
  ]);
  for (const { consented_at } of rows) assert.ok(Number.isFinite(Date.parse(consented_at)));
  console.log('PASS: waitlist API validates consent and contact details and keeps one row per normalized contact.');
} finally {
  database.close();
}
