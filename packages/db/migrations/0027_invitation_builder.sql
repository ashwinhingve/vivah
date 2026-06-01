CREATE TYPE "public"."invite_status" AS ENUM('DRAFT', 'PUBLISHED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"slug" varchar(32) NOT NULL,
	"template_id" varchar(50) DEFAULT 'classic-royal' NOT NULL,
	"status" "invite_status" DEFAULT 'DRAFT' NOT NULL,
	"title" varchar(255),
	"message" text,
	"rsvp_enabled" boolean DEFAULT true NOT NULL,
	"asset_key" varchar(500),
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wedding_invites_wedding_id_unique" UNIQUE("wedding_id"),
	CONSTRAINT "wedding_invites_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_invites" ADD CONSTRAINT "wedding_invites_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wedding_invites_slug_idx" ON "wedding_invites" USING btree ("slug");