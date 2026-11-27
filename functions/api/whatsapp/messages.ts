type MessageRow = {
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
  env: {
    WAITLIST_DB?: Database;
  };
};

const headers = { 'Cache-Control': 'no-store' };
const listSql = `SELECT from_wa_id, wa_timestamp, text_body
FROM whatsapp_inbound_messages
ORDER BY CAST(wa_timestamp AS INTEGER) DESC, received_at DESC, rowid DESC`;

export async function onRequestGet({ env }: Context) {
  if (!env.WAITLIST_DB) return Response.json({ error: 'unavailable' }, { status: 503, headers });
  try {
    const { results } = await env.WAITLIST_DB.prepare(listSql).all();
    const messages = (results ?? []).map(row => ({
      from_wa_id: row.from_wa_id,
      wa_timestamp: row.wa_timestamp,
      text_body: row.text_body,
    }));
    return Response.json({ messages }, { headers });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers });
  }
}
