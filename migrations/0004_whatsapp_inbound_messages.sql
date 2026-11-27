CREATE TABLE IF NOT EXISTS whatsapp_inbound_messages (
  wa_message_id TEXT PRIMARY KEY CHECK (length(trim(wa_message_id)) > 0),
  from_wa_id TEXT NOT NULL CHECK (length(trim(from_wa_id)) > 0),
  wa_timestamp TEXT NOT NULL CHECK (length(trim(wa_timestamp)) > 0),
  message_type TEXT NOT NULL CHECK (length(trim(message_type)) > 0),
  text_body TEXT,
  raw_json TEXT NOT NULL CHECK (json_valid(raw_json)),
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
