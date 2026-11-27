import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequestGet, onRequestHead, onRequestPost } from '../functions/api/whatsapp/webhook.ts';
import { onRequestGet as listMessages, onRequestPost as replyToMessage } from '../functions/api/whatsapp/messages.ts';
import { onRequestGet as listRetreatRequests } from '../functions/api/retreat-requests.ts';
import { onRequestGet as openMensajes, onRequestPost as submitMensajes } from '../functions/mensajes.ts';
import { mensajesCookie, passwordToken } from '../functions/lib/mensajes-access.ts';

const origin = 'https://soma-consciente.com';
const path = '/api/whatsapp/webhook';
const verifyToken = 'verify+token/fixture';
const appSecret = 'meta-app-secret-fixture';
const database = new DatabaseSync(':memory:');
for (const file of [
  '0001_waitlist.sql',
  '0002_waitlist_name.sql',
  '0003_offering_requests.sql',
  '0004_whatsapp_inbound_messages.sql',
  '0005_whatsapp_outbound_replies.sql',
  '0006_whatsapp_reply_diagnostics.sql',
  '0007_retreat_requests.sql',
  '0008_retreat_rebates.sql',
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
  WHATSAPP_APP_SECRET: appSecret,
  WAITLIST_DB: {
    async batch(statements) {
      database.exec('BEGIN');
      try {
        for (const statement of statements) await statement.run();
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    prepare(sql) {
      const statement = database.prepare(sql);
      const bound = values => ({
        bind: (...next) => bound(next),
        run: () => statement.run(...values),
        first: () => statement.get(...values) ?? null,
        all: () => ({ results: statement.all(...values).map(row => ({ ...row })) }),
      });
      return bound([]);
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

function signature(body) {
  return 'sha256=' + createHmac('sha256', appSecret).update(body).digest('hex');
}

async function post(body, overrides = {}, bindings = env) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const response = await onRequestPost({
    request: new Request(origin + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature(raw), ...overrides },
      body: raw,
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
    'wa_message_id', 'from_wa_id', 'wa_timestamp', 'message_type', 'text_body', 'raw_json', 'received_at', 'business_phone_number_id', 'retreat_request_reference',
  ]);
  assert.equal(columns.find(column => column.name === 'text_body').notnull, 0);
  assert.equal(columns.filter(column => !['text_body', 'business_phone_number_id', 'retreat_request_reference'].includes(column.name)).every(column => column.notnull === 1), true);

  const routes = JSON.parse(readFileSync(new URL('../public/_routes.json', import.meta.url), 'utf8'));
  for (const route of [
    '/api/waitlist',
    '/api/retreat-requests',
    '/api/whatsapp/webhook',
    '/api/whatsapp/webhook/',
    '/api/whatsapp/messages',
    '/api/whatsapp/messages/',
    '/mensajes',
    '/mensajes/',
  ]) {
    assert.ok(routes.include.includes(route), route);
  }
  const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(example, /^WHATSAPP_VERIFY_TOKEN=$/m);
  assert.match(example, /^WHATSAPP_APP_SECRET=$/m);
  assert.match(example, /^WHATSAPP_PHONE_NUMBER_ID=$/m);
  assert.match(example, /^MENSJAES_PASSWORD=$/m);

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
  const signatureOnly = { WHATSAPP_APP_SECRET: appSecret };
  assert.equal((await post(statuses, {}, signatureOnly)).status, 200);
  assert.equal((await post(statuses, {}, {})).status, 503);
  assert.equal(countMessages.get().total, 0);
  assert.equal((await post('{')).status, 400);
  assert.equal((await post(envelope([textMessage]), { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post('{' + 'a'.repeat(1_048_576))).status, 413);
  assert.equal((await post({ ...envelope([textMessage]), object: 'not_whatsapp' })).status, 400);
  assert.equal((await post(envelope([{ from: '5491112345678', timestamp: '1', type: 'text' }]))).status, 200);
  assert.equal((await post(envelope([textMessage]), { 'X-Hub-Signature-256': '' })).status, 401);
  const raw = JSON.stringify(envelope([textMessage]));
  assert.equal((await post(raw + ' ', { 'X-Hub-Signature-256': signature(raw) })).status, 401);
  assert.equal(countMessages.get().total, 0);
  assert.equal((await post(envelope([textMessage]), {}, signatureOnly)).status, 503);

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

  const identifierOnly = {
    id: 'wamid.ID_ONLY',
    from_user_id: 'US.00000000000000001',
    timestamp: '1710000003',
    type: 'text',
    text: { body: 'Consulta en español: ¿cómo me anoto? 🌿' },
  };
  const captioned = {
    ...imageMessage,
    id: 'wamid.CAPTION',
    image: { ...imageMessage.image, caption: 'Mi foto' },
  };
  const mixed = envelope([{ type: 'text' }, identifierOnly]);
  mixed.entry[0].changes.push(envelope([captioned]).entry[0].changes[0]);
  assert.equal((await post(JSON.stringify(mixed, null, 2))).status, 200);
  const mixedRows = selectMessages.all();
  assert.equal(mixedRows.length, 4);
  assert.equal(mixedRows[2].from_wa_id, identifierOnly.from_user_id);
  assert.equal(mixedRows[2].text_body, identifierOnly.text.body);
  assert.equal(mixedRows[3].text_body, captioned.image.caption);

  const failing = {
    ...env,
    WAITLIST_DB: {
      ...env.WAITLIST_DB,
      batch: () => { throw new Error('d1 unavailable'); },
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
  const pagePassword = 'gate-fixture';
  const gated = { ...env, MENSJAES_PASSWORD: pagePassword };
  const authed = new Request(origin + '/api/whatsapp/messages', {
    headers: { Cookie: mensajesCookie + '=' + await passwordToken(pagePassword) },
  });
  assert.equal((await listMessages({ request: authed, env })).status, 403);
  assert.equal((await listMessages({ request: new Request(origin + '/api/whatsapp/messages'), env: gated })).status, 401);
  const listed = await listMessages({ request: authed, env: gated });
  assert.equal(listed.status, 200);
  assert.equal(listed.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await listed.json(), {
    replies: [],
    replies_enabled: false,
    messages: [
      { wa_message_id: 'newer-same-second', from_wa_id: '5491100000002', wa_timestamp: '300', text_body: '  después  ', reply_until: null },
      { wa_message_id: 'same-second-early', from_wa_id: '5491100000003', wa_timestamp: '300', text_body: null, reply_until: null },
      { wa_message_id: 'older', from_wa_id: '5491100000001', wa_timestamp: '100', text_body: 'primero', reply_until: null },
    ],
  });
  database.exec('DELETE FROM whatsapp_inbound_messages');
  const empty = await listMessages({ request: authed, env: gated });
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { messages: [], replies: [], replies_enabled: false });
  const unavailable = await listMessages({ request: authed, env: { MENSJAES_PASSWORD: pagePassword } });
  assert.equal(unavailable.status, 503);

  const pageUrl = origin + '/mensajes/';
  const locked = await openMensajes({ request: new Request(pageUrl), env });
  assert.equal(locked.status, 403);
  assert.equal((await locked.text()).includes('<form'), false);
  const prompt = await openMensajes({ request: new Request(pageUrl), env: gated });
  assert.equal(prompt.status, 200);
  assert.match(await prompt.text(), /type="password"/);
  const wrong = await submitMensajes({
    request: new Request(pageUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'password=nope',
    }),
    env: gated,
  });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get('Set-Cookie'), null);
  const signedIn = await submitMensajes({
    request: new Request(pageUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'password=' + encodeURIComponent(pagePassword),
    }),
    env: gated,
  });
  assert.equal(signedIn.status, 303);
  assert.equal(signedIn.headers.get('Location'), '/mensajes/');
  const setCookie = signedIn.headers.get('Set-Cookie') ?? '';
  assert.equal(setCookie.includes(pagePassword), false);
  assert.match(setCookie, /HttpOnly/);
  const inbox = await openMensajes({
    request: new Request(pageUrl, { headers: { Cookie: setCookie.split(';')[0] } }),
    env: {
      ...gated,
      ASSETS: { fetch: async () => new Response('inbox-page', { status: 200, headers: { 'content-type': 'text/html' } }) },
    },
  });
  assert.equal(inbox.status, 200);
  assert.equal(await inbox.text(), 'inbox-page');
  const reference = 'SOMA-111122223333';
  database.prepare('INSERT INTO offering_requests (offering, channel, contact, name, consent_version, reference, payment_plan) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('encuentro-enero', 'email', 'retreat@example.com', 'Prueba', 'offering-1', reference, 'single');
  const handoff = { ...textMessage, from: '15550001003', id: 'wamid.RETREAT', text: { body: 'Mi referencia es ' + reference.toLowerCase() + '.' } };
  const unmatched = { ...handoff, id: 'wamid.UNMATCHED', text: { body: 'Mi referencia es SOMA-555566667777.' } };
  assert.equal((await post(envelope([handoff, unmatched]))).status, 200);
  const linked = database.prepare('SELECT retreat_request_reference AS reference FROM whatsapp_inbound_messages WHERE wa_message_id = ?');
  assert.equal(linked.get(handoff.id).reference, reference);
  assert.equal(linked.get(unmatched.id).reference, null);
  const requestListUrl = origin + '/api/retreat-requests';
  const listEnv = { ...env, MENSJAES_PASSWORD: pagePassword };
  assert.equal((await listRetreatRequests({ request: new Request(requestListUrl), env: listEnv })).status, 401);
  const requestList = await listRetreatRequests({
    request: new Request(requestListUrl, { headers: { Cookie: setCookie.split(';')[0] } }),
    env: listEnv,
  });
  assert.equal(requestList.status, 200);
  assert.equal(requestList.headers.get('Cache-Control'), 'no-store');
  const { requests } = await requestList.json();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].reference, reference);
  assert.deepEqual(requests[0].rebates, []);
  assert.equal(requests[0].whatsapp_received, 1);
  console.log('PASS: signed WhatsApp deliveries store once, including sender IDs, mixed batches and media captions.');

  const now = Math.floor(Date.now() / 1000);
  const fresh = { ...textMessage, id: 'wamid.REPLY_TARGET', timestamp: String(now-120) };
  const freshIdOnly = { ...identifierOnly, id: 'wamid.REPLY_BSUID', timestamp: String(now-60) };
  const stale = { ...textMessage, id: 'wamid.STALE_WINDOW', from: '15550001002', timestamp: String(now-86_410) };
  const wrongNumber = { ...stale, id: 'wamid.OTHER_NUMBER', timestamp: String(now-30) };
  assert.equal((await post(envelope([fresh, freshIdOnly, stale]))).status, 200);
  assert.equal((await post(envelope([wrongNumber], { metadata: { phone_number_id: '654321' } }))).status, 200);
  assert.equal(database.prepare('SELECT business_phone_number_id FROM whatsapp_inbound_messages WHERE wa_message_id = ?')
    .get(fresh.id).business_phone_number_id, '123456');
  insert.run('legacy', '15550001004', String(now-60), 'text', 'legacy', '{}', '2026-11-26T12:00:02.000Z');

  const allowed = {
    ...gated, WHATSAPP_REPLIES_ENABLED: 'true', WHATSAPP_PHONE_NUMBER_ID: '123456', WHATSAPP_TOKEN: 'token-fixture',
  };
  const cookie = authed.headers.get('Cookie');
  const submit = (input, bindings = allowed, sendingOrigin = origin, authCookie = cookie) => replyToMessage({
    request: new Request(origin + '/api/whatsapp/messages', {
      method:'POST',
      headers: { 'Content-Type':'application/json', Origin:sendingOrigin, ...(authCookie ? { Cookie:authCookie } : {}) },
      body:JSON.stringify(input),
    }),
    env:bindings,
  });
  const input = (message, text = 'Hola, gracias por escribir.') => ({
    request_id:randomUUID(), in_reply_to:message, text,
  });
  const calls = [];
  const originalFetch = globalThis.fetch;
  let outcome = 'accepted';
  let hold;
  globalThis.fetch = async (url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer token-fixture');
    assert.equal(init.redirect, 'manual');
    if (url === 'https://graph.facebook.com/v27.0/123456?fields=id') {
      assert.equal(init.method, undefined);
      if (outcome === 'failed') return Response.json({
        error: { code: 190, error_subcode: 463, message: 'private fixture' },
      }, { status: 401 });
      return Response.json({ id: '123456' });
    }
    assert.equal(url, 'https://graph.facebook.com/v27.0/123456/messages');
    calls.push(JSON.parse(init.body));
    if (hold) await hold;
    if (outcome === 'failed') return Response.json({
      error: { code: 190, error_subcode: 463, message: 'private fixture' },
    }, { status: 401 });
    if (outcome === 'unknown') throw new Error('simulated timeout');
    if (outcome === 'redirect') return Response.redirect('https://redirect.invalid/', 307);
    return Response.json({ messages:[{ id:'wamid.OUTBOUND_' + calls.length }] });
  };
  try {
    const checkUrl = origin + '/api/whatsapp/messages?check=connection';
    const checkConnection = configured => listMessages({
      request: new Request(checkUrl, { headers: configured ? { Cookie: cookie } : {} }),
      env: allowed,
    });
    assert.equal((await checkConnection(false)).status, 401);
    assert.deepEqual(await (await checkConnection(true)).json(), {
      connected: true, meta: { httpStatus: 200, errorCode: null, errorSubcode: null },
    });
    const request = input(fresh.id);
    assert.equal((await submit(request, allowed, 'https://another.invalid')).status, 403);
    assert.equal((await submit(request, allowed, origin, null)).status, 401);
    assert.equal((await submit(request, gated)).status, 503);
    assert.equal((await submit(input(stale.id))).status, 409);
    assert.equal((await submit(input(wrongNumber.id))).status, 404);
    assert.equal((await submit(input('unknown'))).status, 404);
    assert.equal((await submit(input(fresh.id, 'x'.repeat(4097)))).status, 400);
    assert.equal(calls.length, 0);

    let unblock;
    hold = new Promise(resolve => { unblock = resolve; });
    const first = submit(request);
    try {
      for (let i=0; i<40 && calls.length===0; i++) await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(calls.length, 1);
      assert.equal((await (await submit(request)).json()).reply.status, 'sending');
      assert.equal(calls.length, 1);
    } finally {
      unblock();
      hold = undefined;
    }
    const sent = await first;
    assert.equal(sent.status, 200);
    assert.equal((await sent.json()).reply.status, 'accepted');
    assert.equal((await (await submit(request)).json()).reply.status, 'accepted');
    assert.equal((await submit({ ...request, text:'Changed draft' })).status, 409);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      messaging_product:'whatsapp', recipient_type:'individual', to:'+5491112345678',
      context:{message_id:fresh.id}, type:'text', text:{body:request.text},
    });

    outcome = 'failed';
    assert.deepEqual(await (await checkConnection(true)).json(), {
      connected: false, meta: { httpStatus: 401, errorCode: 190, errorSubcode: 463 },
    });
    const failed = input(freshIdOnly.id);
    const failedResponse = await (await submit(failed)).json();
    assert.equal(failedResponse.reply.status, 'failed');
    assert.equal(JSON.stringify(failedResponse).includes('private fixture'), false);
    assert.deepEqual({ ...database.prepare(
      'SELECT meta_http_status, meta_error_code, meta_error_subcode FROM whatsapp_outbound_replies WHERE request_id = ?',
    ).get(failed.request_id) }, { meta_http_status: 401, meta_error_code: 190, meta_error_subcode: 463 });
    assert.equal(calls[1].recipient, freshIdOnly.from_user_id);
    assert.equal(calls[1].to, undefined);
    outcome = 'unknown';
    const uncertain = input('legacy');
    assert.equal((await (await submit(uncertain)).json()).reply.status, 'unknown');
    assert.equal((await (await submit(uncertain)).json()).reply.status, 'unknown');
    assert.equal(calls.length, 3);
    const inboxAfter = await (await listMessages({ request:authed, env:allowed })).json();
    assert.equal(inboxAfter.replies_enabled, true);
    assert.deepEqual(inboxAfter.replies.map(reply => reply.status), ['accepted','failed','unknown']);
    assert.equal(inboxAfter.messages.find(message => message.wa_message_id === fresh.id).reply_until, now+86_280);
    assert.equal(inboxAfter.messages.find(message => message.wa_message_id === wrongNumber.id).reply_until, null);
    assert.equal(inboxAfter.messages.find(message => message.wa_message_id === stale.id).reply_until, now-10);
    assert.ok(inboxAfter.messages.find(message => message.wa_message_id === 'legacy').reply_until > now);

    outcome = 'redirect';
    const redirected = input(fresh.id);
    assert.equal((await (await submit(redirected)).json()).reply.status, 'unknown');
    assert.equal((await (await submit(redirected)).json()).reply.status, 'unknown');
    assert.equal(calls.length, 4);

    outcome = 'accepted';
    assert.equal((await submit(input(fresh.id), { ...allowed, WHATSAPP_MESSAGING_ACCOUNT_ID: 'invalid' })).status, 503);
    assert.equal(calls.length, 4);
    const assigned = await submit(input(fresh.id), { ...allowed, WHATSAPP_MESSAGING_ACCOUNT_ID: ' 456789 ' });
    assert.equal((await assigned.json()).reply.status, 'accepted');
    assert.equal(calls.length, 5);
    assert.equal(calls[4].messaging_account_id, '456789');
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('PASS: manual replies enforce the window and origin, save history, and never repeat a claimed send.');
} finally {
  database.close();
}
