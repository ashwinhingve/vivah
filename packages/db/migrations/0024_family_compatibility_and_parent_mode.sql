-- 0024 — Family Compatibility Mode + Parent Mode (P3 Phase 3 items 9 & 10)
-- Hand-written for safety: idempotent CREATE/ALTER with IF NOT EXISTS guards.

DO $$ BEGIN
  CREATE TYPE "public"."parent_link_relationship" AS ENUM('FATHER', 'MOTHER', 'GUARDIAN', 'SIBLING');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."parent_link_permission" AS ENUM('VIEW_ONLY', 'EDIT_PROFILE', 'DRAFT_ACTIONS', 'FULL_PROXY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."parent_link_consent" AS ENUM('PENDING', 'APPROVED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."parent_action_type" AS ENUM(
    'SEND_INTEREST', 'ACCEPT_INTEREST', 'REJECT_INTEREST',
    'SEND_MESSAGE', 'UPDATE_PROFILE', 'BLOCK_USER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."parent_action_status" AS ENUM(
    'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED', 'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "parent_child_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "parent_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "child_user_id"  text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "relationship"   "parent_link_relationship" NOT NULL,
  "permissions"    "parent_link_permission" NOT NULL DEFAULT 'VIEW_ONLY',
  "child_consent_status" "parent_link_consent" NOT NULL DEFAULT 'PENDING',
  "child_consented_at" timestamp,
  "created_at"     timestamp NOT NULL DEFAULT now(),
  "revoked_at"     timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "parent_child_unique" ON "parent_child_links" ("parent_user_id", "child_user_id");
CREATE INDEX IF NOT EXISTS "parent_child_parent_idx" ON "parent_child_links" ("parent_user_id");
CREATE INDEX IF NOT EXISTS "parent_child_child_idx"  ON "parent_child_links" ("child_user_id");

CREATE TABLE IF NOT EXISTS "family_match_ratings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rater_user_id"          text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "subject_profile_id"     uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "candidate_profile_id"   uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "overall_score"          smallint NOT NULL,
  "compatibility_concerns" text[],
  "notes"                  text,
  "rated_at"               timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "family_rating_unique" ON "family_match_ratings" ("rater_user_id", "candidate_profile_id", "subject_profile_id");
CREATE INDEX IF NOT EXISTS "family_rating_subject_idx" ON "family_match_ratings" ("subject_profile_id", "candidate_profile_id");

CREATE TABLE IF NOT EXISTS "parent_drafted_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "parent_user_id"     text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "child_user_id"      text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "action_type"        "parent_action_type" NOT NULL,
  "payload"            jsonb NOT NULL,
  "status"             "parent_action_status" NOT NULL DEFAULT 'PENDING',
  "parent_drafted_at"  timestamp NOT NULL DEFAULT now(),
  "child_responded_at" timestamp,
  "executed_at"        timestamp,
  "expires_at"         timestamp,
  "error_message"      text
);

CREATE INDEX IF NOT EXISTS "parent_action_child_status_idx" ON "parent_drafted_actions" ("child_user_id", "status");
CREATE INDEX IF NOT EXISTS "parent_action_parent_idx" ON "parent_drafted_actions" ("parent_user_id", "parent_drafted_at");

ALTER TABLE "match_scores" ADD COLUMN IF NOT EXISTS "family_joint_score"   smallint;
ALTER TABLE "match_scores" ADD COLUMN IF NOT EXISTS "family_signal_count"  smallint DEFAULT 0;
ALTER TABLE "match_scores" ADD COLUMN IF NOT EXISTS "family_agreement_pct" smallint;
