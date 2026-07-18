-- rollback-0032_financial_shells.sql
-- Reverses 0032_financial_shells.sql. Destructive — drops the service-referral
-- and WhatsApp-log tables and their enums. Only run to undo the Phase 6 shells.
-- Does NOT drop money_currency (shared with phase5).

DROP TABLE IF EXISTS whatsapp_messages;
DROP TABLE IF EXISTS service_referrals;

DROP TYPE IF EXISTS whatsapp_message_status;
DROP TYPE IF EXISTS service_referral_status;
DROP TYPE IF EXISTS service_referral_kind;
