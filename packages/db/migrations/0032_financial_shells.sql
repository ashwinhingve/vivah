-- 0032_financial_shells.sql
-- Phase 6 Sprint D — shared service-referral commission model (lending + insurance)
-- and the WhatsApp Business outbound message log. Backs FLAGGED + MOCKED shells.
-- Additive + idempotent (safe to re-run). Hand-authored to match the 0030/0031
-- convention; apply locally with psql and on prod via Railway SQL console.
--
-- COMPLIANCE: commission_paise is the ONLY revenue line. No interest/premium,
-- no bank details, no Aadhaar, no contacts/call logs. India-resident data only.
-- Smart Shaadi is an LSP (RBI Digital Lending Directions 2025), never the lender.

-- ── Enums (guarded) ──────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE service_referral_kind AS ENUM ('LENDING','INSURANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE service_referral_status AS ENUM
    ('SURFACED','CONSENTED','SUBMITTED','FULFILLED','COMMISSIONED','DECLINED','EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE whatsapp_message_status AS ENUM ('QUEUED','SENT','FAILED','MOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- money_currency already exists (phase5 / migration 0026+); guard anyway so this
-- file is self-contained and safe to run against a fresh database.
DO $$ BEGIN
  CREATE TYPE money_currency AS ENUM ('INR','USD','GBP','EUR','AED','CAD','AUD','SGD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── service_referrals ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_referrals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind             service_referral_kind   NOT NULL,
  status           service_referral_status NOT NULL DEFAULT 'SURFACED',
  partner_ref      varchar(120),
  context          varchar(40)  NOT NULL,
  context_id       uuid,
  consent_at       timestamp,
  consent_version  varchar(20),
  principal_paise  bigint,
  commission_paise bigint,
  currency         money_currency NOT NULL DEFAULT 'INR',
  mock             boolean NOT NULL DEFAULT true,
  metadata         jsonb,
  created_at       timestamp NOT NULL DEFAULT now(),
  updated_at       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_referrals_profile_kind_status_idx
  ON service_referrals (profile_id, kind, status, created_at);
CREATE INDEX IF NOT EXISTS service_referrals_status_idx
  ON service_referrals (status);

-- ── whatsapp_messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  to_phone     varchar(20)  NOT NULL,
  template     varchar(100) NOT NULL,
  params       jsonb,
  status       whatsapp_message_status NOT NULL DEFAULT 'QUEUED',
  provider_ref varchar(120),
  error        text,
  mock         boolean NOT NULL DEFAULT true,
  created_at   timestamp NOT NULL DEFAULT now(),
  updated_at   timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_messages_profile_idx ON whatsapp_messages (profile_id, created_at);
CREATE INDEX IF NOT EXISTS whatsapp_messages_status_idx  ON whatsapp_messages (status);
