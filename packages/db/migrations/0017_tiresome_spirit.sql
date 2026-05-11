CREATE TABLE IF NOT EXISTS "user_duplicate_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"phone_hash" varchar(64),
	"aadhaar_ref_id" varchar(100),
	"selfie_r2_key" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_duplicate_signals_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_duplicate_signals" ADD CONSTRAINT "user_duplicate_signals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_duplicate_signals_phone_hash_idx" ON "user_duplicate_signals" USING btree ("phone_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_duplicate_signals_aadhaar_ref_idx" ON "user_duplicate_signals" USING btree ("aadhaar_ref_id");