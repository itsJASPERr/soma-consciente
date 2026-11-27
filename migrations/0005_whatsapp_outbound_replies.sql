ALTER TABLE whatsapp_inbound_messages ADD COLUMN business_phone_number_id TEXT;

CREATE INDEX whatsapp_inbound_sender_time
  ON whatsapp_inbound_messages(from_wa_id, business_phone_number_id, CAST(wa_timestamp AS INTEGER));

CREATE TABLE whatsapp_outbound_replies (
  request_id TEXT PRIMARY KEY NOT NULL,
  in_reply_to TEXT NOT NULL REFERENCES whatsapp_inbound_messages(wa_message_id),
  text_body TEXT NOT NULL CHECK (length(text_body) BETWEEN 1 AND 4096),
  status TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'accepted', 'failed', 'unknown')),
  wa_message_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX whatsapp_outbound_replies_by_message
  ON whatsapp_outbound_replies(in_reply_to, created_at);
