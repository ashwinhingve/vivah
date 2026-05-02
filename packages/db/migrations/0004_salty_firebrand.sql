CREATE TYPE "public"."boost_status" AS ENUM('ACTIVE', 'EXPIRED', 'REFUNDED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_boosts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"payment_id" varchar(200),
	"amount_paise" varchar(20),
	"status" "boost_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_of_day" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"gender" varchar(20) NOT NULL,
	"community" varchar(100),
	"date" date NOT NULL,
	"selected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "community_zones" ADD COLUMN "caste" varchar(80);--> statement-breakpoint
ALTER TABLE "community_zones" ADD COLUMN "gotra" varchar(80);--> statement-breakpoint
ALTER TABLE "community_zones" ADD COLUMN "gotra_exclusion_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "audio_intro_key" varchar(500);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "video_intro_key" varchar(500);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_boosts" ADD CONSTRAINT "profile_boosts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_of_day" ADD CONSTRAINT "profile_of_day_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boost_profile_idx" ON "profile_boosts" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boost_active_idx" ON "profile_boosts" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pod_unique_day" ON "profile_of_day" USING btree ("date","gender","community");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pod_date_idx" ON "profile_of_day" USING btree ("date");