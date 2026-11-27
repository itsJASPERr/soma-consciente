import { configuredPassword, isAuthorized } from '../../lib/mensajes-access.ts';
import { readRequestBytes } from '../../lib/request-bytes.ts';
import {
  replyConfig, replyMaxLength, replyRecipient, replyWindowSeconds, sendReply, sendTimeoutMs,
} from '../../lib/whatsapp-replies.ts';
import type { ReplyEnv } from '../../lib/whatsapp-replies.ts';

type MessageRow = {
  wa_message_id: string;
  from_wa_id: string;
  wa_timestamp: string;
  text_body: string | null;
  business_phone_number_id: string | null;
  latest_at: number | null;
};

type ReplyRow = {
  request_id: string;
  in_reply_to: string;
  text_body: string;
  status: 'sending' | 'accepted' | 'failed' | 'unknown';
  created_at: string;
};

type Statement = {
  bind(...values: Array<string | number | null>): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results?: T[] }>;
};

type Context = {
  request: Request;
  env: ReplyEnv & {
    MENSJAES_PASSWORD?: string;
    WAITLIST_DB?: { prepare(sql: string): Statement };
  };
};

const headers = { 'Cache-Control': 'no-store' };
const replyFields = 'request_id, in_reply_to, text_body, status, created_at';
const listSql = `SELECT wa_message_id, from_wa_id, wa_timestamp, text_body, business_phone_number_id,
  MAX(CASE WHEN (business_phone_number_id = ?1 OR business_phone_number_id IS NULL)
    AND CAST(wa_timestamp AS INTEGER) <= ?2 THEN CAST(wa_timestamp AS INTEGER) END)
    OVER (PARTITION BY from_wa_id) AS latest_at
FROM whatsapp_inbound_messages
ORDER BY CAST(wa_timestamp AS INTEGER) DESC, received_at DESC, rowid DESC`;
const targetSql = `SELECT target.from_wa_id, (
  SELECT MAX(CAST(inbound.wa_timestamp AS INTEGER))
  FROM whatsapp_inbound_messages inbound
  WHERE inbound.from_wa_id = target.from_wa_id
    AND (inbound.business_phone_number_id = ?1 OR inbound.business_phone_number_id IS NULL)
    AND CAST(inbound.wa_timestamp AS INTEGER) <= ?2
) AS latest_at
FROM whatsapp_inbound_messages target
WHERE target.wa_message_id = ?3
  AND (target.business_phone_number_id = ?1 OR target.business_phone_number_id IS NULL)`;

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers });
}

async function accessError({ request, env }: Context) {
  const password = configuredPassword(env);
  if (!password) return json({ error: 'unavailable' }, 403);
  if (!(await isAuthorized(request, password))) return json({ error: 'unauthorized' }, 401);
}

function displayReply(reply: ReplyRow) {
  const stale = reply.status === 'sending' && Date.now() - Date.parse(reply.created_at) > 2 * sendTimeoutMs;
  return { ...reply, status: stale ? 'unknown' : reply.status };
}

export async function onRequestGet(context: Context) {
  const denied = await accessError(context);
  if (denied) return denied;
  const { env } = context;
  const db = env.WAITLIST_DB;
  if (!db) return json({ error: 'unavailable' }, 503);

  const config = replyConfig(env);
  const now = Math.floor(Date.now() / 1000);
  try {
    const [inbound, outbound] = await Promise.all([
      db.prepare(listSql).bind(config?.phoneNumberId ?? null, now).all<MessageRow>(),
      db.prepare('SELECT ' + replyFields + ' FROM whatsapp_outbound_replies ORDER BY created_at, rowid')
        .all<ReplyRow>(),
    ]);
    const messages = (inbound.results ?? []).map(row => ({
      wa_message_id: row.wa_message_id,
      from_wa_id: row.from_wa_id,
      wa_timestamp: row.wa_timestamp,
      text_body: row.text_body,
      reply_until: config && (row.business_phone_number_id === null || row.business_phone_number_id === config.phoneNumberId)
        && row.latest_at !== null && replyRecipient(row.from_wa_id) ? row.latest_at + replyWindowSeconds : null,
    }));
    return json({ messages, replies: (outbound.results ?? []).map(displayReply), replies_enabled: Boolean(config) });
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
}

async function readReply(request: Request) {
  const data = await readRequestBytes(request, 32 * 1024);
  if ('error' in data) return { input: null, status: data.error };
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data.bytes)) as {
      request_id?: unknown; in_reply_to?: unknown; text?: unknown;
    } | null;
    const text = typeof value?.text === 'string' ? value.text.trim() : '';
    if (
      typeof value?.request_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.request_id)
      || typeof value.in_reply_to !== 'string' || value.in_reply_to.length === 0 || value.in_reply_to.length > 512
      || text.length === 0 || text.length > replyMaxLength
    ) return { input: null, status: 400 };
    return { input: { id: value.request_id.toLowerCase(), replyTo: value.in_reply_to, text }, status: 200 };
  } catch {
    return { input: null, status: 400 };
  }
}

export async function onRequestPost(context: Context) {
  const { request, env } = context;
  const denied = await accessError(context);
  if (denied) return denied;
  if (request.headers.get('Origin') !== new URL(request.url).origin) return json({ error: 'forbidden' }, 403);
  if (request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    return json({ error: 'invalid_request' }, 415);
  }
  const db = env.WAITLIST_DB;
  if (!db) return json({ error: 'unavailable' }, 503);
  const { input, status } = await readReply(request);
  if (!input) return json({ error: 'invalid_request' }, status);
  const { id, replyTo, text } = input;

  try {
    const existing = () => db.prepare('SELECT ' + replyFields + ' FROM whatsapp_outbound_replies WHERE request_id = ?')
      .bind(id).first<ReplyRow>();
    const acknowledge = (reply: ReplyRow) =>
      reply.in_reply_to === replyTo && reply.text_body === text
        ? json({ reply: displayReply(reply) })
        : json({ error: 'request_conflict' }, 409);

    const previous = await existing();
    if (previous) return acknowledge(previous);
    const config = replyConfig(env);
    if (!config) return json({ error: 'replies_disabled' }, 503);

    const now = Math.floor(Date.now() / 1000);
    const target = await db.prepare(targetSql).bind(config.phoneNumberId, now, replyTo)
      .first<Pick<MessageRow, 'from_wa_id' | 'latest_at'>>();
    if (!target) return json({ error: 'message_unavailable' }, 404);
    const recipient = replyRecipient(target.from_wa_id);
    if (!recipient) return json({ error: 'message_unavailable' }, 404);
    if (target.latest_at === null || target.latest_at + replyWindowSeconds <= now) {
      return json({ error: 'reply_window_closed' }, 409);
    }

    const claim = await db.prepare(`INSERT INTO whatsapp_outbound_replies
      (request_id, in_reply_to, text_body) VALUES (?, ?, ?)
      ON CONFLICT (request_id) DO NOTHING RETURNING request_id`).bind(id, replyTo, text)
      .first<{ request_id: string }>();
    if (!claim) {
      const concurrent = await existing();
      return concurrent ? acknowledge(concurrent) : json({ error: 'unavailable' }, 503);
    }

    const result = await sendReply(config, recipient, replyTo, text);
    const saved = await db.prepare('UPDATE whatsapp_outbound_replies SET status = ?, wa_message_id = ? '
      + 'WHERE request_id = ? RETURNING ' + replyFields).bind(result.status, result.platformId, id)
      .first<ReplyRow>();
    return saved ? acknowledge(saved) : json({ error: 'unavailable' }, 503);
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
}
