-- Tier 3 Track 2 — Vendor Lead Generation Fee.
-- Adds per-inquiry fee config on vendors and the vendor_leads inbox table.

ALTER TABLE "vendors"
  ADD COLUMN IF NOT EXISTS "lead_fee_per_inquiry_inr" integer NOT NULL DEFAULT 100;

ALTER TABLE "vendors"
  ADD COLUMN IF NOT EXISTS "lead_fee_enabled" boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "vendor_leads" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vendor_id"        uuid NOT NULL REFERENCES "vendors"("id") ON DELETE CASCADE,
  "inquirer_user_id" text NOT NULL REFERENCES "user"("id"),
  "event_type"       ceremony_type NOT NULL,
  "event_date"       timestamp,
  "event_location"   varchar(200),
  "message"          text,
  "fee_charged_inr"  integer NOT NULL DEFAULT 100,
  "fee_status"       varchar(20) NOT NULL DEFAULT 'PENDING',
  "charged_at"       timestamp,
  "refund_reason"    text,
  "lead_quality"     varchar(20),
  "created_at"       timestamp NOT NULL DEFAULT now(),
  "updated_at"       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "vendor_leads_vendor_idx"    ON "vendor_leads" ("vendor_id");
CREATE INDEX IF NOT EXISTS "vendor_leads_inquirer_idx"  ON "vendor_leads" ("inquirer_user_id");
CREATE INDEX IF NOT EXISTS "vendor_leads_status_idx"    ON "vendor_leads" ("fee_status");
CREATE INDEX IF NOT EXISTS "vendor_leads_created_idx"   ON "vendor_leads" ("created_at");
