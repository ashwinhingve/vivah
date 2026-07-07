-- rollback-0031_support_tickets.sql
-- Reverses 0031_support_tickets.sql. Destructive — drops the support ticketing
-- tables and their enums. Only run to undo the support console.

DROP TABLE IF EXISTS ticket_events;
DROP TABLE IF EXISTS ticket_messages;
DROP TABLE IF EXISTS support_tickets;

DROP TYPE IF EXISTS ticket_event_type;
DROP TYPE IF EXISTS ticket_source;
DROP TYPE IF EXISTS ticket_status;
DROP TYPE IF EXISTS ticket_priority;
DROP TYPE IF EXISTS ticket_category;
