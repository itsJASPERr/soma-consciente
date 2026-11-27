ALTER TABLE offering_requests ADD COLUMN reference TEXT;
ALTER TABLE offering_requests ADD COLUMN payment_plan TEXT;

CREATE UNIQUE INDEX offering_requests_reference ON offering_requests(reference);

ALTER TABLE whatsapp_inbound_messages ADD COLUMN retreat_request_reference TEXT REFERENCES offering_requests(reference);

CREATE INDEX whatsapp_retreat_request_reference ON whatsapp_inbound_messages(retreat_request_reference)
  WHERE retreat_request_reference IS NOT NULL;
