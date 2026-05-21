-- 0025 — LGBTQ+ profile support + platform settings (Phase 1+2 audit item)
-- Adds NON_BINARY gender enum value and platform_settings key-value table.
-- Seeds lgbtq_matching_enabled=false so default user-visible behavior is unchanged.

ALTER TYPE "public"."gender" ADD VALUE IF NOT EXISTS 'NON_BINARY' BEFORE 'OTHER';

CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key"        varchar(100) PRIMARY KEY,
  "value"      jsonb NOT NULL,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "updated_by" text REFERENCES "user"("id")
);

INSERT INTO "platform_settings" ("key", "value")
VALUES ('lgbtq_matching_enabled', 'false'::jsonb)
ON CONFLICT ("key") DO NOTHING;
