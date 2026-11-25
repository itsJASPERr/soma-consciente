import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../functions/api/waitlist.ts';
import { waitlistConsentVersion } from '../src/lib/waitlist-consent.ts';

const origin = 'https://www.soma-consciente.com';
const url = origin + '/api/waitlist';
const database = new DatabaseSync(':memory:');
database.exec(readFileSync(new URL('../migrations/0001_waitlist.sql', import.meta.url), 'utf8'));
const legacyContact = 'legacy@example.com';
const legacyDate = '2026-11-25T00:00:00.000Z';
database.prepare('INSERT INTO waitlist_signups (channel, contact, consent_version, consented_at) VALUES (?, ?, ?, ?)')
  .run('email', legacyContact, '1', legacyDate);
database.exec(readFileSync(new URL('../migrations/0002_waitlist_name.sql', import.meta.url), 'utf8'));
const selectSignup = database.prepare('SELECT name, consent_version, consented_at FROM waitlist_signups WHERE contact = ?');

const env = {
  WAITLIST_DB: {
    prepare(sql) {
      const statement = database.prepare(sql);
      return { bind: (...values) => ({ run: () => statement.run(...values) }) };
    },
  },
};

const email = { name: '  María Pérez  ', channel: 'email', contact: 'Prueba@example.com', consent: waitlistConsentVersion };
const whatsapp = {
  name: 'Noa', channel: 'whatsapp', country: 'AR', contact: '011 15 2345-6789', consent: waitlistConsentVersion,
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
  assert.deepEqual({ ...selectSignup.get(legacyContact) }, {
    name: null, consent_version: '1', consented_at: legacyDate,
  });
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
  assert.equal(await submit({ ...email, name: undefined }), 400);
  assert.equal(await submit({ ...email, name: '   ' }), 400);
  assert.equal(await submit({ ...email, name: 'a'.repeat(121) }), 400);
  assert.equal(await submit(email), 204);
  const savedEmail = { ...selectSignup.get('prueba@example.com') };
  assert.equal(await submit({ ...email, name: 'Another name', contact: 'prueba@example.com' }), 204);
  assert.deepEqual({ ...selectSignup.get('prueba@example.com') }, savedEmail);
  assert.equal(await submit(whatsapp), 204);
  assert.equal(await submit({ ...whatsapp, contact: '+54 9 11 2345-6789' }), 204);

  assert.equal(await submit({ ...email, name: 'Ana', contact: legacyContact }), 204);
  const renewed = selectSignup.get(legacyContact);
  assert.equal(renewed.name, 'Ana');
  assert.equal(renewed.consent_version, waitlistConsentVersion);
  assert.notEqual(renewed.consented_at, legacyDate);

  const rows = database.prepare(
    'SELECT channel, contact, name, consent_version, consented_at FROM waitlist_signups ORDER BY channel, contact',
  ).all();
  assert.deepEqual(rows.map(({ channel, contact, name, consent_version }) => ({ channel, contact, name, consent_version })), [
    { channel: 'email', contact: legacyContact, name: 'Ana', consent_version: waitlistConsentVersion },
    { channel: 'email', contact: 'prueba@example.com', name: 'María Pérez', consent_version: waitlistConsentVersion },
    { channel: 'whatsapp', contact: '+5491123456789', name: 'Noa', consent_version: waitlistConsentVersion },
  ]);
  for (const { consented_at } of rows) assert.ok(Number.isFinite(Date.parse(consented_at)));
  console.log('PASS: waitlist API stores names and consent, preserves existing entries, and keeps one row per normalized contact.');
} finally {
  database.close();
}
