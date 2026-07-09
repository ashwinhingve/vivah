-- 0031_support_tickets.sql
-- SUPPORT console ticketing: support_tickets, ticket_messages, ticket_events.
-- Additive + idempotent (safe to re-run). Hand-authored to match the 0029/0030
-- pgvector convention; apply locally with psql and on prod via Railway SQL console.

-- ── Enums (guarded) ──────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE ticket_category AS ENUM
    ('ACCOUNT','PAYMENT','BOOKING','MATCH_ABUSE','KYC','VENDOR','TECHNICAL','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_priority AS ENUM ('LOW','NORMAL','HIGH','URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('OPEN','PENDING','RESOLVED','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_source AS ENUM ('USER','CHAT_REPORT','DISPUTE','KYC_APPEAL','SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_event_type AS ENUM
    ('CREATED','STATUS_CHANGED','ASSIGNED','PRIORITY_CHANGED','MESSAGE_ADDED','RESOLVED','REOPENED','SLA_BREACHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── support_tickets ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject             varchar(200) NOT NULL,
  description         text,
  category            ticket_category NOT NULL DEFAULT 'OTHER',
  priority            ticket_priority NOT NULL DEFAULT 'NORMAL',
  status              ticket_status   NOT NULL DEFAULT 'OPEN',
  source              ticket_source   NOT NULL DEFAULT 'USER',
  raised_by_user_id   text REFERENCES "user"(id) ON DELETE SET NULL,
  assigned_to_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  linked_ref_type     varchar(32),
  linked_ref_id       varchar(100),
  sla_due_at          timestamp,
  first_responded_at  timestamp,
  resolved_at         timestamp,
  resolved_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at          timestamp NOT NULL DEFAULT now(),
  updated_at          timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_ticket_status_priority_idx ON support_tickets (status, priority);
CREATE INDEX IF NOT EXISTS support_ticket_assignee_idx        ON support_tickets (assigned_to_user_id);
CREATE INDEX IF NOT EXISTS support_ticket_raised_by_idx       ON support_tickets (raised_by_user_id);
CREATE INDEX IF NOT EXISTS support_ticket_source_idx          ON support_tickets (source);
CREATE INDEX IF NOT EXISTS support_ticket_sla_idx             ON support_tickets (sla_due_at);

-- ── ticket_messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id        uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_user_id   text REFERENCES "user"(id) ON DELETE SET NULL,
  body             text NOT NULL,
  is_internal_note boolean NOT NULL DEFAULT false,
  attachments      jsonb,
  created_at       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_message_ticket_idx ON ticket_messages (ticket_id, created_at);

-- ── ticket_events ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  actor_user_id  text REFERENCES "user"(id) ON DELETE SET NULL,
  event_type     ticket_event_type NOT NULL,
  meta           jsonb,
  created_at     timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_event_ticket_idx ON ticket_events (ticket_id, created_at);
