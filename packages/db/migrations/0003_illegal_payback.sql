CREATE TYPE "public"."rental_booking_status" AS ENUM('PENDING', 'CONFIRMED', 'ACTIVE', 'RETURNED', 'CANCELLED', 'OVERDUE');--> statement-breakpoint
CREATE TYPE "public"."rental_category" AS ENUM('DECOR', 'COSTUME', 'AV_EQUIPMENT', 'FURNITURE', 'LIGHTING', 'TABLEWARE', 'OTHER');--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'DISPUTE_RAISED' BEFORE 'CONTRACT_SIGNED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'DISPUTE_RESOLVED_RELEASE' BEFORE 'CONTRACT_SIGNED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'DISPUTE_RESOLVED_REFUND' BEFORE 'CONTRACT_SIGNED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'DISPUTE_RESOLVED_SPLIT' BEFORE 'CONTRACT_SIGNED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'PROFILE_REPORTED';--> statement-breakpoint
ALTER TYPE "public"."escrow_status" ADD VALUE 'RELEASE_PENDING';--> statement-breakpoint
ALTER TYPE "public"."escrow_status" ADD VALUE 'REFUND_PENDING';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'REFUND_PENDING';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ceremonies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"type" "ceremony_type" NOT NULL,
	"date" date,
	"venue" varchar(255),
	"start_time" varchar(10),
	"end_time" varchar(10),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"viewer_profile_id" uuid NOT NULL,
	"viewed_profile_id" uuid NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rental_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_item_id" uuid NOT NULL,
	"customer_id" text NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"deposit_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "rental_booking_status" DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rental_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" "rental_category" NOT NULL,
	"price_per_day" numeric(12, 2) NOT NULL,
	"deposit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"stock_qty" integer DEFAULT 1 NOT NULL,
	"r2_image_keys" text[] DEFAULT '{}',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shortlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"target_profile_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ceremonies" ADD CONSTRAINT "ceremonies_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_viewer_profile_id_profiles_id_fk" FOREIGN KEY ("viewer_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_viewed_profile_id_profiles_id_fk" FOREIGN KEY ("viewed_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rental_bookings" ADD CONSTRAINT "rental_bookings_rental_item_id_rental_items_id_fk" FOREIGN KEY ("rental_item_id") REFERENCES "public"."rental_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rental_bookings" ADD CONSTRAINT "rental_bookings_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rental_items" ADD CONSTRAINT "rental_items_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shortlists" ADD CONSTRAINT "shortlists_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shortlists" ADD CONSTRAINT "shortlists_target_profile_id_profiles_id_fk" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ceremonies_wedding_idx" ON "ceremonies" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_views_viewed_recent_idx" ON "profile_views" USING btree ("viewed_profile_id","viewed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_views_pair_idx" ON "profile_views" USING btree ("viewer_profile_id","viewed_profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rental_bookings_item_idx" ON "rental_bookings" USING btree ("rental_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rental_bookings_customer_idx" ON "rental_bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rental_items_vendor_idx" ON "rental_items" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rental_items_category_idx" ON "rental_items" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shortlist_unique_pair" ON "shortlists" USING btree ("profile_id","target_profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_profile_idx" ON "shortlists" USING btree ("profile_id");