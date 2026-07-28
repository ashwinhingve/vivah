-- 0041 — P2-4: audit-event types for safety + virtual-date lifecycle coverage.
--
-- Adds the enum values that let blockUser's counterpart (unblock) and the
-- virtual-date lifecycle sweep leave a TRUTHFUL chained-audit trail, instead of
-- reusing a wrong event (the reason P2-4 was deferred at audit time).
--
-- Additive + idempotent. `ALTER TYPE ... ADD VALUE` is NOT transactional and (on
-- older PG) cannot run inside a transaction block, so each statement stands alone.
-- Apply via the Railway SQL console / psql — schema past 0029 is applied manually
-- (drizzle _journal.json stops at 0029; see docs/db + CLAUDE.md prod protocol).
--
-- Rollback: Postgres cannot DROP an enum value in place (it would require
-- recreating the type and rewriting every dependent column). Treat as forward-only.
ALTER TYPE "audit_event_type" ADD VALUE IF NOT EXISTS 'PROFILE_UNBLOCKED';
ALTER TYPE "audit_event_type" ADD VALUE IF NOT EXISTS 'VIRTUAL_DATE_EXPIRED';
ALTER TYPE "audit_event_type" ADD VALUE IF NOT EXISTS 'VIRTUAL_DATE_NO_SHOW';
