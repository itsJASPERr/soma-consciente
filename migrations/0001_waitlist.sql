CREATE TABLE IF NOT EXISTS waitlist_signups (
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  contact TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consented_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (channel, contact)
) STRICT;
