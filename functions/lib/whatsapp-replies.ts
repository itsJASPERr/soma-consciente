type ReplyConfig = { phoneNumberId: string; token: string };

export type ReplyEnv = {
  WHATSAPP_REPLIES_ENABLED?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_TOKEN?: string;
};

export const replyWindowSeconds = 24 * 60 * 60;
export const replyMaxLength = 4096;
export const sendTimeoutMs = 10_000;
const graphBase = 'https://graph.facebook.com/v27.0/';

export function replyConfig({ WHATSAPP_REPLIES_ENABLED, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TOKEN }: ReplyEnv) {
  const phoneNumberId = WHATSAPP_PHONE_NUMBER_ID?.trim();
  const token = WHATSAPP_TOKEN?.trim();
  if (WHATSAPP_REPLIES_ENABLED !== 'true' || !phoneNumberId || !/^\d+$/.test(phoneNumberId) || !token) {
    return undefined;
  }
  return { phoneNumberId, token };
}

type Recipient = { to: string } | { recipient: string };

export function replyRecipient(sender: string): Recipient | undefined {
  if (/^\+?[1-9]\d{6,14}$/.test(sender)) return { to: '+' + sender.replace(/^\+/, '') };
  if (/^[A-Z]{2}(?:\.ENT)?\.\d+$/.test(sender)) return { recipient: sender };
}

type GraphDiagnostic = {
  httpStatus: number;
  errorCode: number | null;
  errorSubcode: number | null;
};

type GraphBody = {
  id?: unknown;
  messages?: { id?: unknown }[];
  error?: { code?: unknown; error_subcode?: unknown };
};

function graphDiagnostic(response: Response, data: GraphBody | null): GraphDiagnostic {
  const integer = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
  return {
    httpStatus: response.status,
    errorCode: integer(data?.error?.code),
    errorSubcode: integer(data?.error?.error_subcode),
  };
}

export async function checkReplyConnection(config: ReplyConfig) {
  try {
    const response = await fetch(graphBase + config.phoneNumberId + '?fields=id', {
      headers: { Authorization: 'Bearer ' + config.token },
      redirect: 'manual',
      signal: AbortSignal.timeout(sendTimeoutMs),
    });
    const data = await response.json().catch(() => null) as GraphBody | null;
    return { connected: response.ok && data?.id === config.phoneNumberId, meta: graphDiagnostic(response, data) };
  } catch {
    return { connected: false, meta: null };
  }
}

type SendResult = (
  | { status: 'accepted'; platformId: string }
  | { status: 'failed' | 'unknown'; platformId: null }
) & { meta: GraphDiagnostic | null };

export async function sendReply(
  config: ReplyConfig, recipient: Recipient, replyTo: string, text: string,
): Promise<SendResult> {
  try {
    const response = await fetch(graphBase + config.phoneNumberId + '/messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + config.token, 'Content-Type': 'application/json' },
      // Workers supports manual redirects. Never forward the bearer token to another URL.
      redirect: 'manual',
      signal: AbortSignal.timeout(sendTimeoutMs),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        ...recipient,
        context: { message_id: replyTo },
        type: 'text',
        text: { body: text },
      }),
    });
    const data = await response.json().catch(() => null) as GraphBody | null;
    const meta = graphDiagnostic(response, data);
    if (!response.ok) {
      // A server error or timeout can happen after Meta accepted the message.
      const rejected = response.status >= 400 && response.status < 500 && response.status !== 408;
      return { status: rejected ? 'failed' : 'unknown', platformId: null, meta };
    }
    const id = data?.messages?.[0]?.id;
    if (typeof id === 'string' && id.length > 0) return { status: 'accepted', platformId: id, meta };
    return { status: 'unknown', platformId: null, meta };
  } catch {
    // Preserve the attempt so a network failure cannot cause an automatic resend.
  }
  return { status: 'unknown', platformId: null, meta: null };
}
