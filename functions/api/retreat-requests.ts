import { configuredPassword, isAuthorized } from '../lib/mensajes-access.ts';

type Context = {
  request: Request;
  env: {
    MENSJAES_PASSWORD?: string;
    WAITLIST_DB?: { prepare(sql: string): { all(): Promise<{ results?: unknown[] }> } };
  };
};

export async function onRequestGet({ request, env }: Context) {
  const headers = { 'Cache-Control': 'no-store' };
  const password = configuredPassword(env);
  if (!password || !env.WAITLIST_DB) return Response.json({ error: 'unavailable' }, { status: 403, headers });
  if (!(await isAuthorized(request, password))) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  }

  try {
    const { results } = await env.WAITLIST_DB.prepare(
      'SELECT reference, offering, payment_plan, name, channel, contact, consented_at, ' +
      'EXISTS (SELECT 1 FROM whatsapp_inbound_messages WHERE retreat_request_reference = offering_requests.reference) AS whatsapp_received ' +
      'FROM offering_requests WHERE reference IS NOT NULL ORDER BY rowid DESC LIMIT 100',
    ).all();
    return Response.json({ requests: results ?? [] }, { headers });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers });
  }
}
