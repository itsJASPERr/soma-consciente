type Database = {
  prepare(sql: string): {
    bind(...values: Array<string | null>): { run(): Promise<unknown> };
  };
};

type Context = {
  request: Request;
  env: {
    WAITLIST_DB?: Database;
    WHATSAPP_VERIFY_TOKEN?: string;
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

function requiredString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function timestampValue(value: unknown) {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  return undefined;
}

function textBody(message: Record<string, unknown>) {
  const text = message.text;
  if (!text || typeof text !== 'object' || Array.isArray(text)) return null;
  const body = (text as { body?: unknown }).body;
  return typeof body === 'string' ? body : null;
}

function parseMessage(message: unknown): StoredMessage | undefined {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return undefined;
  const record = message as Record<string, unknown>;
  const id = requiredString(record.id);
  const from = requiredString(record.from);
  const timestamp = timestampValue(record.timestamp);
  const type = requiredString(record.type);
  if (!id || !from || !timestamp || !type) return undefined;
  let rawJson: string;
  try {
    rawJson = JSON.stringify(message);
  } catch {
    return undefined;
  }
  return { id, from, timestamp, type, textBody: textBody(record), rawJson };
}

function collectMessages(payload: unknown): StoredMessage[] | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
  const entries = (payload as { entry?: unknown }).entry;
  if (entries === undefined) return [];
  if (!Array.isArray(entries)) return undefined;
  const messages: StoredMessage[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
    const changes = (entry as { changes?: unknown }).changes;
    if (changes === undefined) continue;
    if (!Array.isArray(changes)) return undefined;
    for (const change of changes) {
      if (!change || typeof change !== 'object' || Array.isArray(change)) return undefined;
      const value = (change as { value?: unknown }).value;
      if (value === undefined || value === null) continue;
      if (typeof value !== 'object' || Array.isArray(value)) return undefined;
      const rawMessages = (value as { messages?: unknown }).messages;
      if (rawMessages === undefined || rawMessages === null) continue;
      if (!Array.isArray(rawMessages)) return undefined;
      for (const rawMessage of rawMessages) {
        const parsed = parseMessage(rawMessage);
        if (!parsed) return undefined;
        messages.push(parsed);
      }
    }
  }
  return messages;
}

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return { error: 400 as const };
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBodyBytes) {
        await reader.cancel();
        return { error: 413 as const };
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch {
    return { error: 400 as const };
  }
  return { body };
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
  const body = await readBody(request);
  if ('error' in body) return empty(body.error);
  let payload: unknown;
  try {
    payload = JSON.parse(body.body);
  } catch {
    return empty(400);
  }
  const messages = collectMessages(payload);
  if (!messages) return empty(400);
  if (messages.length === 0) return empty(200);
  if (!env.WAITLIST_DB) return empty(503);
  try {
    for (const message of messages) {
      await env.WAITLIST_DB.prepare(insertSql)
        .bind(message.id, message.from, message.timestamp, message.type, message.textBody, message.rawJson)
        .run();
    }
  } catch {
    return empty(503);
  }
  return empty(200);
}
