-- rollback-0038_marketing_cities_registry.sql
-- Reverses 0038 completely. Marketing tables carry no money and no user content
-- beyond campaign copy, so dropping them is safe; vendors.city free-text is the
-- source of truth for city and is untouched by 0038, so dropping city_id loses
-- nothing that the forward migration's backfill cannot recreate.

DROP TABLE IF EXISTS campaign_sends;
DROP TABLE IF EXISTS campaign_content;
DROP TABLE IF EXISTS marketing_campaigns;

ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_city_id_fk;
DROP INDEX IF EXISTS vendors_city_id_idx;
ALTER TABLE vendors DROP COLUMN IF EXISTS city_id;

DROP TABLE IF EXISTS cities;

DROP TYPE IF EXISTS marketing_conversion_goal;
DROP TYPE IF EXISTS campaign_content_status;
DROP TYPE IF EXISTS campaign_send_status;
DROP TYPE IF EXISTS marketing_campaign_status;
DROP TYPE IF EXISTS marketing_trigger_type;
DROP TYPE IF EXISTS city_status;
