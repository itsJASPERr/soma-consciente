type ReplyConfig = { phoneNumberId: string; token: string };

export type ReplyEnv = {
  WHATSAPP_REPLIES_ENABLED?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_TOKEN?: string;
};

export const replyWindowSeconds = 24 * 60 * 60;
export const replyMaxLength = 4096;
export const sendTimeoutMs = 10_000;

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

export type SendResult =
  | { status: 'accepted'; platformId: string }
  | { status: 'failed' | 'unknown'; platformId: null };

export async function sendReply(
  config: ReplyConfig, recipient: Recipient, replyTo: string, text: string,
): Promise<SendResult> {
  try {
    const response = await fetch('https://graph.facebook.com/v27.0/' + config.phoneNumberId + '/messages', {
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
    if (!response.ok) {
      // A server error or timeout can happen after Meta accepted the message.
      const rejected = response.status >= 400 && response.status < 500 && response.status !== 408;
      return { status: rejected ? 'failed' : 'unknown', platformId: null };
    }
    const data = await response.json() as { messages?: { id?: unknown }[] };
    const id = data?.messages?.[0]?.id;
    if (typeof id === 'string' && id.length > 0) return { status: 'accepted', platformId: id };
  } catch {
    // Preserve the attempt so a network failure cannot cause an automatic resend.
  }
  return { status: 'unknown', platformId: null };
}
