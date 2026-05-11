CREATE TABLE IF NOT EXISTS "user_reputation_signals" (
	"user_id" text PRIMARY KEY NOT NULL,
	"response_rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"message_response_rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"avg_response_time_hours" numeric(6, 2) DEFAULT '36' NOT NULL,
	"ghost_count" integer DEFAULT 0 NOT NULL,
	"consistency_score" numeric(5, 4) DEFAULT '0.5' NOT NULL,
	"last_computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_behavior_summary" ADD COLUMN "hourly_activity_hist" jsonb DEFAULT '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]'::jsonb NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_reputation_signals" ADD CONSTRAINT "user_reputation_signals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
