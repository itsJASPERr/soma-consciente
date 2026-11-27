type BoundStatement = { run(): Promise<unknown> };

type Database = {
  prepare(sql: string): {
    bind(...values: Array<string | null>): BoundStatement;
  };
  batch(statements: BoundStatement[]): Promise<unknown>;
};

type Context = {
  request: Request;
  env: {
    WAITLIST_DB?: Database;
    WHATSAPP_VERIFY_TOKEN?: string;
    WHATSAPP_APP_SECRET?: string;
  };
};

type StoredMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  textBody: string | null;
  rawJson: string;
};

const headers = { 'Cache-Control': 'no-store' };
const maxBodyBytes = 1_048_576;
const insertSql = `INSERT INTO whatsapp_inbound_messages (
  wa_message_id, from_wa_id, wa_timestamp, message_type, text_body, raw_json
) VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(wa_message_id) DO NOTHING`;

function empty(status: number) {
  return new Response(null, { status, headers });
}

function tokensMatch(provided: string, expected: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(provided);
  const right = encoder.encode(expected);
  if (left.byteLength !== right.byteLength || left.byteLength === 0) return false;
  let mismatch = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function requiredString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function timestampValue(value: unknown) {
  if (typeof value === 'string' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value))) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  return undefined;
}

function messageText(message: Record<string, unknown>, type: string) {
  const content = record(message[type]);
  const text = type === 'text' ? content?.body : content?.caption;
  return typeof text === 'string' ? text : null;
}

function parseMessage(value: unknown): StoredMessage | undefined {
  const message = record(value);
  if (!message) return undefined;
  const id = requiredString(message.id);
  const from = requiredString(message.from) ?? requiredString(message.from_user_id);
  const timestamp = timestampValue(message.timestamp);
  const type = requiredString(message.type);
  if (!id || !from || timestamp === undefined || !type) return undefined;
  return { id, from, timestamp, type, textBody: messageText(message, type), rawJson: JSON.stringify(message) };
}

function collectMessages(payload: unknown) {
  const envelope = record(payload);
  if (envelope?.object !== 'whatsapp_business_account' || !Array.isArray(envelope.entry)) return undefined;
  const messages: StoredMessage[] = [];
  let skipped = 0;
  for (const entry of envelope.entry) {
    const changes = record(entry)?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const event = record(change);
      if (event?.field !== 'messages') continue;
      const batch = record(event.value)?.messages;
      if (batch == null) continue; // Delivery statuses have no inbound messages.
      if (!Array.isArray(batch)) {
        skipped++;
        continue;
      }
      for (const value of batch) {
        const message = parseMessage(value);
        if (message) messages.push(message);
        else skipped++;
      }
    }
  }
  return { messages, skipped };
}

async function readBody(request: Request): Promise<{ error: 400 | 413 } | { bytes: Uint8Array<ArrayBuffer> }> {
  const reader = request.body?.getReader();
  if (!reader) return { error: 400 };
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBodyBytes) {
        await reader.cancel();
        return { error: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { error: 400 };
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes };
}

async function isMetaSignature(signature: string | null, secret: string, body: Uint8Array<ArrayBuffer>) {
  const hex = /^sha256=([0-9a-f]{64})$/i.exec(signature ?? '')?.[1];
  if (!hex) return false;
  const digest = Uint8Array.from(hex.match(/.{2}/g) ?? [], pair => Number.parseInt(pair, 16));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  );
  return crypto.subtle.verify('HMAC', key, digest, body);
}

export async function onRequestGet({ request, env }: Context) {
  const expected = env.WHATSAPP_VERIFY_TOKEN;
  if (typeof expected !== 'string' || expected.length === 0 || expected.length > 512 || expected.trim().length === 0) {
    return empty(403);
  }
  const params = new URL(request.url).searchParams;
  const provided = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');
  if (params.get('hub.mode') !== 'subscribe' || provided === null || provided.length === 0 || provided.length > 512) {
    return empty(403);
  }
  if (challenge === null || challenge.length === 0 || challenge.length > 1024 || !tokensMatch(provided, expected)) {
    return empty(403);
  }
  return new Response(challenge, {
    status: 200,
    headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function onRequestHead(context: Context) {
  const response = await onRequestGet(context);
  const headHeaders = new Headers(response.headers);
  headHeaders.delete('content-length');
  return new Response(null, { status: response.status, headers: headHeaders });
}

export async function onRequestPost({ request, env }: Context) {
  const contentType = request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') return empty(415);

  const secret = requiredString(env.WHATSAPP_APP_SECRET);
  if (!secret) {
    console.error('WhatsApp webhook: missing app secret');
    return empty(503);
  }
  const body = await readBody(request);
  if ('error' in body) return empty(body.error);
  if (!(await isMetaSignature(request.headers.get('X-Hub-Signature-256'), secret, body.bytes))) {
    return empty(401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body.bytes));
  } catch {
    return empty(400);
  }

  const delivery = collectMessages(payload);
  if (!delivery) return empty(400);
  const { messages, skipped } = delivery;
  if (skipped) console.warn('WhatsApp webhook: skipped malformed messages', { count: skipped });
  if (messages.length === 0) return empty(200);
  if (!env.WAITLIST_DB) {
    console.error('WhatsApp webhook: missing D1 binding');
    return empty(503);
  }

  try {
    const insert = env.WAITLIST_DB.prepare(insertSql);
    await env.WAITLIST_DB.batch(messages.map(message =>
      insert.bind(message.id, message.from, message.timestamp, message.type, message.textBody, message.rawJson),
    ));
  } catch {
    console.error('WhatsApp webhook: D1 batch failed', { count: messages.length });
    return empty(503);
  }

  console.info('WhatsApp webhook: delivery accepted', { count: messages.length });
  return empty(200);
}
