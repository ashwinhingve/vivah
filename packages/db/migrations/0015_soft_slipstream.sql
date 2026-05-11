CREATE TABLE IF NOT EXISTS "user_behavior_summary" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"profile_view_count" integer DEFAULT 0 NOT NULL,
	"browse_query_count" integer DEFAULT 0 NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"scroll_depth_avg" numeric(5, 4) DEFAULT '0' NOT NULL,
	"photo_expansion_count" integer DEFAULT 0 NOT NULL,
	"total_request_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_behavior_summary" ADD CONSTRAINT "user_behavior_summary_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_behavior_summary_user_day_uniq" ON "user_behavior_summary" USING btree ("user_id","day");