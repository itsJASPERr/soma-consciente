import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequestGet, onRequestHead, onRequestPost } from '../functions/api/whatsapp/webhook.ts';
import { onRequestGet as listMessages } from '../functions/api/whatsapp/messages.ts';

const origin = 'https://soma-consciente.com';
const path = '/api/whatsapp/webhook';
const verifyToken = 'verify+token/fixture';
const database = new DatabaseSync(':memory:');
for (const file of [
  '0001_waitlist.sql',
  '0002_waitlist_name.sql',
  '0003_offering_requests.sql',
  '0004_whatsapp_inbound_messages.sql',
]) {
  database.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
}

const columns = database.prepare('PRAGMA table_info(whatsapp_inbound_messages)').all();
const selectMessages = database.prepare(
  'SELECT wa_message_id, from_wa_id, wa_timestamp, message_type, text_body, raw_json, received_at FROM whatsapp_inbound_messages ORDER BY rowid',
);
const countMessages = database.prepare('SELECT COUNT(*) AS total FROM whatsapp_inbound_messages');

const env = {
  WHATSAPP_VERIFY_TOKEN: verifyToken,
  WAITLIST_DB: {
    prepare(sql) {
      const statement = database.prepare(sql);
      return {
        bind: (...values) => ({ run: () => statement.run(...values) }),
        all: () => ({ results: statement.all().map(row => ({ ...row })) }),
      };
    },
  },
};

function envelope(messages, extra = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'waba',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { phone_number_id: '123456', display_phone_number: '15550001111' },
          ...extra,
          ...(messages === undefined ? {} : { messages }),
        },
      }],
    }],
  };
}

function challengeUrl(params) {
  const url = new URL(path, origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

async function verify(params, bindings = env) {
  const response = await onRequestGet({ request: new Request(challengeUrl(params)), env: bindings });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  return response;
}

async function post(body, overrides = {}, bindings = env) {
  const response = await onRequestPost({
    request: new Request(origin + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...overrides },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env: bindings,
  });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  return response;
}

const textMessage = {
  from: '5491112345678',
  id: 'wamid.TEXT',
  timestamp: '1710000000',
  type: 'text',
  text: { body: '  hola  ' },
};
const imageMessage = {
  from: '5491112345678',
  id: 'wamid.IMAGE',
  timestamp: 1710000001,
  type: 'image',
  image: { id: 'media-id', mime_type: 'image/jpeg' },
};

try {
  assert.deepEqual(columns.map(column => column.name), [
    'wa_message_id', 'from_wa_id', 'wa_timestamp', 'message_type', 'text_body', 'raw_json', 'received_at',
  ]);
  assert.equal(columns.find(column => column.name === 'text_body').notnull, 0);
  assert.equal(columns.filter(column => column.name !== 'text_body').every(column => column.notnull === 1), true);

  const routes = JSON.parse(readFileSync(new URL('../public/_routes.json', import.meta.url), 'utf8'));
  for (const route of [
    '/api/waitlist',
    '/api/whatsapp/webhook',
    '/api/whatsapp/webhook/',
    '/api/whatsapp/messages',
    '/api/whatsapp/messages/',
  ]) {
    assert.ok(routes.include.includes(route), route);
  }
  const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(example, /^WHATSAPP_VERIFY_TOKEN=$/m);
  assert.match(example, /^WHATSAPP_PHONE_NUMBER_ID=$/m);

  const denied = await verify({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'wrong-token',
    'hub.challenge': '1158201444',
  });
  assert.equal(denied.status, 403);
  assert.equal(await denied.text(), '');
  const wrongMode = await verify({
    'hub.mode': 'unsubscribe',
    'hub.verify_token': verifyToken,
    'hub.challenge': '1158201444',
  });
  assert.equal(wrongMode.status, 403);
  assert.equal((await verify({
    'hub.mode': 'subscribe',
    'hub.verify_token': verifyToken,
    'hub.challenge': '1158201444',
  }, { WHATSAPP_VERIFY_TOKEN: '   ' })).status, 403);
  const accepted = await verify({
    'hub.mode': 'subscribe',
    'hub.verify_token': verifyToken,
    'hub.challenge': '1158201444',
  }, {});
  assert.equal(accepted.status, 403);
  const challenge = await verify({
    'hub.mode': 'subscribe',
    'hub.verify_token': verifyToken,
    'hub.challenge': '1158201444',
  });
  assert.equal(challenge.status, 200);
  assert.equal(challenge.headers.get('Content-Type'), 'text/plain; charset=utf-8');
  assert.equal(await challenge.text(), '1158201444');
  const head = await onRequestHead({
    request: new Request(challengeUrl({
      'hub.mode': 'subscribe',
      'hub.verify_token': verifyToken,
      'hub.challenge': '1158201444',
    })),
    env,
  });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('Content-Type'), 'text/plain; charset=utf-8');
  assert.equal(await head.text(), '');
  const deniedHead = await onRequestHead({
    request: new Request(challengeUrl({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': '1158201444',
    })),
    env,
  });
  assert.equal(deniedHead.status, 403);
  assert.equal(await deniedHead.text(), '');

  const statuses = envelope(undefined, {
    statuses: [{ id: 'wamid.STATUS', status: 'delivered', timestamp: '1710000002', recipient_id: '5491112345678' }],
  });
  assert.equal((await post(statuses, {}, {})).status, 200);
  assert.equal(countMessages.get().total, 0);
  assert.equal((await post('{')).status, 400);
  assert.equal((await post(envelope([textMessage]), { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post('{' + 'a'.repeat(1_048_576))).status, 413);
  assert.equal((await post(envelope([{ from: '5491112345678', timestamp: '1', type: 'text' }]))).status, 400);
  assert.equal(countMessages.get().total, 0);
  assert.equal((await post(envelope([textMessage]), {}, {})).status, 503);

  assert.equal((await post(envelope([textMessage, imageMessage, textMessage]))).status, 200);
  assert.equal((await post(envelope([{ ...textMessage, text: { body: 'changed' } }]))).status, 200);
  const rows = selectMessages.all().map(row => ({ ...row }));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].wa_message_id, 'wamid.TEXT');
  assert.equal(rows[0].from_wa_id, '5491112345678');
  assert.equal(rows[0].wa_timestamp, '1710000000');
  assert.equal(rows[0].message_type, 'text');
  assert.equal(rows[0].text_body, '  hola  ');
  assert.deepEqual(JSON.parse(rows[0].raw_json), textMessage);
  assert.ok(Number.isFinite(Date.parse(rows[0].received_at)));
  assert.equal(rows[1].wa_message_id, 'wamid.IMAGE');
  assert.equal(rows[1].wa_timestamp, '1710000001');
  assert.equal(rows[1].message_type, 'image');
  assert.equal(rows[1].text_body, null);
  assert.deepEqual(JSON.parse(rows[1].raw_json), imageMessage);
  const receivedAt = rows[0].received_at;
  assert.equal((await post(envelope([textMessage]))).status, 200);
  assert.equal(selectMessages.all()[0].received_at, receivedAt);
  assert.equal(countMessages.get().total, 2);

  const failing = {
    ...env,
    WAITLIST_DB: {
      prepare() {
        return { bind: () => ({ run: () => { throw new Error('d1 unavailable'); } }) };
      },
    },
  };
  assert.equal((await post(envelope([textMessage]), {}, failing)).status, 503);

  database.exec('DELETE FROM whatsapp_inbound_messages');
  const insert = database.prepare(`INSERT INTO whatsapp_inbound_messages (
    wa_message_id, from_wa_id, wa_timestamp, message_type, text_body, raw_json, received_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  insert.run('older', '5491100000001', '100', 'text', 'primero', '{"id":"older"}', '2026-11-26T12:00:00.000Z');
  insert.run('newer-same-second', '5491100000002', '300', 'text', '  después  ', '{"id":"newer"}', '2026-11-26T12:00:02.000Z');
  insert.run('same-second-early', '5491100000003', '300', 'image', null, '{"id":"early"}', '2026-11-26T12:00:01.000Z');
  const listed = await listMessages({ request: new Request(origin + '/api/whatsapp/messages'), env });
  assert.equal(listed.status, 200);
  assert.equal(listed.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await listed.json(), {
    messages: [
      { from_wa_id: '5491100000002', wa_timestamp: '300', text_body: '  después  ' },
      { from_wa_id: '5491100000003', wa_timestamp: '300', text_body: null },
      { from_wa_id: '5491100000001', wa_timestamp: '100', text_body: 'primero' },
    ],
  });
  database.exec('DELETE FROM whatsapp_inbound_messages');
  const empty = await listMessages({ request: new Request(origin + '/api/whatsapp/messages'), env });
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { messages: [] });
  const unavailable = await listMessages({ request: new Request(origin + '/api/whatsapp/messages'), env: {} });
  assert.equal(unavailable.status, 503);
  console.log('PASS: WhatsApp webhook verifies the hub challenge and stores inbound messages once.');
} finally {
  database.close();
}
