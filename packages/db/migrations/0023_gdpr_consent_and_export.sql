-- Tier 3 — GDPR data export + consent ledger.
-- Idempotent: safe to re-apply against an existing DB.

CREATE TABLE IF NOT EXISTS "consent_ledger" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"          text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "consent_type"     varchar(50)  NOT NULL,
  "consent_version"  varchar(20)  NOT NULL,
  "consent_given"    boolean      NOT NULL,
  "consented_at"     timestamp    DEFAULT now() NOT NULL,
  "ip_address"       varchar(64),
  "user_agent"       text,
  "withdrawn_at"     timestamp
);

CREATE INDEX IF NOT EXISTS "consent_ledger_user_idx" ON "consent_ledger" ("user_id");
CREATE INDEX IF NOT EXISTS "consent_ledger_type_idx" ON "consent_ledger" ("user_id", "consent_type");

CREATE TABLE IF NOT EXISTS "data_export_requests" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"               text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status"                varchar(20) DEFAULT 'PENDING' NOT NULL,
  "requested_at"          timestamp   DEFAULT now() NOT NULL,
  "completed_at"          timestamp,
  "download_url"          varchar(500),
  "download_expires_at"   timestamp,
  "file_size_bytes"       integer,
  "r2_key"                varchar(300),
  "error"                 text
);

CREATE INDEX IF NOT EXISTS "data_export_user_idx"   ON "data_export_requests" ("user_id");
CREATE INDEX IF NOT EXISTS "data_export_status_idx" ON "data_export_requests" ("status");
