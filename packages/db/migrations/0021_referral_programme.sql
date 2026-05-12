-- Tier 3 Track 1 — Referral Programme
-- Adds referral_codes + referrals tables and the referral_credits column on user.
-- Idempotent: safe to re-apply against an existing DB.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "referral_credits" integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "referral_codes" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id"  text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "code"           varchar(12) NOT NULL UNIQUE,
  "uses_count"     integer DEFAULT 0 NOT NULL,
  "is_active"      boolean DEFAULT true NOT NULL,
  "created_at"     timestamp DEFAULT now() NOT NULL,
  "expires_at"     timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "referral_codes_owner_idx" ON "referral_codes" ("owner_user_id");
CREATE INDEX IF NOT EXISTS "referral_codes_code_idx" ON "referral_codes" ("code");

CREATE TABLE IF NOT EXISTS "referrals" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code_id"               uuid NOT NULL REFERENCES "referral_codes"("id") ON DELETE CASCADE,
  "referrer_user_id"      text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "referred_user_id"      text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status"                varchar(20) DEFAULT 'SIGNED_UP' NOT NULL,
  "reward_credited"       boolean DEFAULT false NOT NULL,
  "reward_amount_credits" integer DEFAULT 0 NOT NULL,
  "created_at"            timestamp DEFAULT now() NOT NULL,
  "converted_at"          timestamp
);

CREATE INDEX IF NOT EXISTS "referrals_referrer_idx" ON "referrals" ("referrer_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "referrals_referred_idx" ON "referrals" ("referred_user_id");
CREATE INDEX IF NOT EXISTS "referrals_code_idx" ON "referrals" ("code_id");
