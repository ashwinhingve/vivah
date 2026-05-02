ALTER TABLE "profiles" ADD COLUMN "latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "longitude" numeric(9, 6);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_lat_lng_idx" ON "profiles" USING btree ("latitude","longitude");