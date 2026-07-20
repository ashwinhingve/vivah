-- Phase 4 Referral Programme — Credit Ledger Table
-- Append-only ledger for atomic credit reservations and safe double-spend prevention.
-- Idempotent: safe to re-apply against an existing DB.

CREATE TABLE IF NOT EXISTS "referral_credits_ledger" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"         text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "amount"          integer NOT NULL,
  "type"            varchar(12) NOT NULL,
  "related_entity"  varchar(50),
  "related_id"      text,
  "description"     text,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  "processed_at"    timestamptz,
  UNIQUE NULLS NOT DISTINCT ("user_id", "type", "related_id")
);

CREATE INDEX IF NOT EXISTS "referral_credits_ledger_user_id_idx"
  ON "referral_credits_ledger" ("user_id");

CREATE INDEX IF NOT EXISTS "referral_credits_ledger_type_idx"
  ON "referral_credits_ledger" ("type");

CREATE INDEX IF NOT EXISTS "referral_credits_ledger_created_idx"
  ON "referral_credits_ledger" ("created_at");
