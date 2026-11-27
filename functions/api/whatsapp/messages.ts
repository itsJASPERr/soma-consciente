import { configuredPassword, isAuthorized } from '../../lib/mensajes-access.ts';

type MessageRow = {
  wa_message_id: string;
  from_wa_id: string;
  wa_timestamp: string;
  text_body: string | null;
};

type Database = {
  prepare(sql: string): {
    all(): Promise<{ results?: MessageRow[] }>;
  };
};

type Context = {
  request: Request;
  env: {
    MENSJAES_PASSWORD?: string;
    WAITLIST_DB?: Database;
  };
};

const headers = { 'Cache-Control': 'no-store' };
const listSql = `SELECT wa_message_id, from_wa_id, wa_timestamp, text_body
FROM whatsapp_inbound_messages
ORDER BY CAST(wa_timestamp AS INTEGER) DESC, received_at DESC, rowid DESC`;

export async function onRequestGet({ request, env }: Context) {
  const password = configuredPassword(env);
  if (!password) return Response.json({ error: 'unavailable' }, { status: 403, headers });
  if (!(await isAuthorized(request, password))) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  }
  if (!env.WAITLIST_DB) return Response.json({ error: 'unavailable' }, { status: 503, headers });
  try {
    const { results } = await env.WAITLIST_DB.prepare(listSql).all();
    const messages = (results ?? []).map(row => ({
      wa_message_id: row.wa_message_id,
      from_wa_id: row.from_wa_id,
      wa_timestamp: row.wa_timestamp,
      text_body: row.text_body,
    }));
    return Response.json({ messages }, { headers });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers });
  }
}
