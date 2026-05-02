CREATE TYPE "public"."gift_registry_status" AS ENUM('AVAILABLE', 'CLAIMED', 'PURCHASED');--> statement-breakpoint
CREATE TYPE "public"."guest_age_group" AS ENUM('ADULT', 'CHILD', 'INFANT');--> statement-breakpoint
CREATE TYPE "public"."invitation_type" AS ENUM('SAVE_THE_DATE', 'INVITATION', 'RSVP_REMINDER', 'THANK_YOU');--> statement-breakpoint
CREATE TYPE "public"."match_request_priority" AS ENUM('NORMAL', 'SUPER_LIKE');--> statement-breakpoint
CREATE TYPE "public"."mood_board_category" AS ENUM('DECOR', 'ATTIRE', 'MAKEUP', 'VENUE', 'FLORAL', 'INVITATION', 'CAKE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."report_category" AS ENUM('HARASSMENT', 'FAKE_PROFILE', 'INAPPROPRIATE_CONTENT', 'SCAM', 'UNDERAGE', 'SPAM', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."seating_table_shape" AS ENUM('ROUND', 'RECT', 'SQUARE', 'OVAL');--> statement-breakpoint
CREATE TYPE "public"."wedding_vendor_role" AS ENUM('PHOTOGRAPHER', 'VIDEOGRAPHER', 'CATERER', 'DECORATOR', 'MUSICIAN', 'DJ', 'MAKEUP_ARTIST', 'MEHENDI_ARTIST', 'PRIEST', 'PLANNER', 'TRANSPORT', 'VENUE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."wedding_vendor_status" AS ENUM('SHORTLISTED', 'INQUIRED', 'BOOKED', 'CONFIRMED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."wedding_document_type" AS ENUM('CONTRACT', 'RECEIPT', 'PERMIT', 'ID', 'INSURANCE', 'INVOICE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."wedding_expense_status" AS ENUM('DRAFT', 'DUE', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."wedding_member_role" AS ENUM('OWNER', 'EDITOR', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."wedding_reminder_type" AS ENUM('TASK_DUE', 'RSVP_FOLLOWUP', 'VENDOR_PAYMENT', 'GUEST_REMINDER', 'COUNTDOWN');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gift_registry_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text,
	"price" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"image_r2_key" varchar(500),
	"external_url" text,
	"status" "gift_registry_status" DEFAULT 'AVAILABLE' NOT NULL,
	"claimed_by" text,
	"claimed_by_name" varchar(255),
	"claimed_at" timestamp,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_request_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reported_id" uuid NOT NULL,
	"request_id" uuid,
	"category" "report_category" NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'OPEN' NOT NULL,
	"resolver_id" text,
	"resolver_note" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rsvp_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rsvp_tokens_guest_id_unique" UNIQUE("guest_id"),
	CONSTRAINT "rsvp_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"actor_id" text,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"type" "wedding_document_type" NOT NULL,
	"label" varchar(255) NOT NULL,
	"r2_key" varchar(500) NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"vendor_id" uuid,
	"expense_id" uuid,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"label" varchar(255) NOT NULL,
	"vendor_id" uuid,
	"booking_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"due_date" date,
	"paid_at" timestamp,
	"status" "wedding_expense_status" DEFAULT 'DRAFT' NOT NULL,
	"receipt_r2_key" varchar(500),
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_member_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"inviter_id" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "wedding_member_role" DEFAULT 'VIEWER' NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wedding_member_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_mood_board_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"r2_key" varchar(500) NOT NULL,
	"caption" varchar(500),
	"category" "mood_board_category" DEFAULT 'OTHER' NOT NULL,
	"tags" text[] DEFAULT '{}',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"type" "wedding_reminder_type" NOT NULL,
	"target_type" varchar(50),
	"target_id" uuid,
	"scheduled_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_seating_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"seat_number" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_seating_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"ceremony_id" uuid,
	"name" varchar(100) NOT NULL,
	"capacity" integer DEFAULT 8 NOT NULL,
	"shape" "seating_table_shape" DEFAULT 'ROUND' NOT NULL,
	"notes" text,
	"pos_x" integer DEFAULT 0 NOT NULL,
	"pos_y" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_task_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"r2_key" varchar(500) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(100),
	"file_size" integer,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"ceremony_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"location" varchar(255),
	"assigned_to" text,
	"vendor_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_vendor_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"ceremony_id" uuid,
	"vendor_id" uuid NOT NULL,
	"booking_id" uuid,
	"role" "wedding_vendor_role" NOT NULL,
	"status" "wedding_vendor_status" DEFAULT 'SHORTLISTED' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_websites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"slug" varchar(80) NOT NULL,
	"title" varchar(255) NOT NULL,
	"story" text,
	"hero_image_key" varchar(500),
	"theme" jsonb,
	"sections" jsonb,
	"is_public" boolean DEFAULT false NOT NULL,
	"password_hash" varchar(255),
	"rsvp_enabled" boolean DEFAULT true NOT NULL,
	"registry_enabled" boolean DEFAULT false NOT NULL,
	"custom_domain" varchar(255),
	"view_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wedding_websites_wedding_id_unique" UNIQUE("wedding_id"),
	CONSTRAINT "wedding_websites_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "ceremonies" ADD COLUMN "venue_address" text;--> statement-breakpoint
ALTER TABLE "ceremonies" ADD COLUMN "dress_code" varchar(100);--> statement-breakpoint
ALTER TABLE "ceremonies" ADD COLUMN "expected_guests" integer;--> statement-breakpoint
ALTER TABLE "ceremonies" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ceremonies" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "plus_one_names" jsonb;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "age_group" varchar(10) DEFAULT 'ADULT' NOT NULL;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "is_vip" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "dietary_notes" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "accessibility_notes" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "invited_to_ceremonies" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "type" varchar(20) DEFAULT 'INVITATION' NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "match_requests" ADD COLUMN "priority" "match_request_priority" DEFAULT 'NORMAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "match_requests" ADD COLUMN "acceptance_message" text;--> statement-breakpoint
ALTER TABLE "match_requests" ADD COLUMN "decline_reason" varchar(64);--> statement-breakpoint
ALTER TABLE "match_requests" ADD COLUMN "seen_at" timestamp;--> statement-breakpoint
ALTER TABLE "wedding_tasks" ADD COLUMN "parent_task_id" uuid;--> statement-breakpoint
ALTER TABLE "wedding_tasks" ADD COLUMN "tags" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "wedding_tasks" ADD COLUMN "estimated_hours" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "wedding_tasks" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "partner_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "title" varchar(255);--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "venue_address" text;--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "bride_name" varchar(255);--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "groom_name" varchar(255);--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "hashtag" varchar(80);--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "primary_color" varchar(20);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gift_registry_items" ADD CONSTRAINT "gift_registry_items_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gift_registry_items" ADD CONSTRAINT "gift_registry_items_claimed_by_user_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_request_reports" ADD CONSTRAINT "match_request_reports_reporter_id_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_request_reports" ADD CONSTRAINT "match_request_reports_reported_id_profiles_id_fk" FOREIGN KEY ("reported_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_request_reports" ADD CONSTRAINT "match_request_reports_request_id_match_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."match_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rsvp_tokens" ADD CONSTRAINT "rsvp_tokens_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_activity_log" ADD CONSTRAINT "wedding_activity_log_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_activity_log" ADD CONSTRAINT "wedding_activity_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_documents" ADD CONSTRAINT "wedding_documents_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_documents" ADD CONSTRAINT "wedding_documents_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_documents" ADD CONSTRAINT "wedding_documents_expense_id_wedding_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."wedding_expenses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_documents" ADD CONSTRAINT "wedding_documents_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_expenses" ADD CONSTRAINT "wedding_expenses_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_expenses" ADD CONSTRAINT "wedding_expenses_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_expenses" ADD CONSTRAINT "wedding_expenses_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_expenses" ADD CONSTRAINT "wedding_expenses_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_member_invites" ADD CONSTRAINT "wedding_member_invites_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_member_invites" ADD CONSTRAINT "wedding_member_invites_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_mood_board_items" ADD CONSTRAINT "wedding_mood_board_items_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_mood_board_items" ADD CONSTRAINT "wedding_mood_board_items_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_reminders" ADD CONSTRAINT "wedding_reminders_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_seating_assignments" ADD CONSTRAINT "wedding_seating_assignments_table_id_wedding_seating_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."wedding_seating_tables"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_seating_assignments" ADD CONSTRAINT "wedding_seating_assignments_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_seating_tables" ADD CONSTRAINT "wedding_seating_tables_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_seating_tables" ADD CONSTRAINT "wedding_seating_tables_ceremony_id_ceremonies_id_fk" FOREIGN KEY ("ceremony_id") REFERENCES "public"."ceremonies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_task_attachments" ADD CONSTRAINT "wedding_task_attachments_task_id_wedding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wedding_tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_task_attachments" ADD CONSTRAINT "wedding_task_attachments_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_task_comments" ADD CONSTRAINT "wedding_task_comments_task_id_wedding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."wedding_tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_task_comments" ADD CONSTRAINT "wedding_task_comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_timeline_events" ADD CONSTRAINT "wedding_timeline_events_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_timeline_events" ADD CONSTRAINT "wedding_timeline_events_ceremony_id_ceremonies_id_fk" FOREIGN KEY ("ceremony_id") REFERENCES "public"."ceremonies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_timeline_events" ADD CONSTRAINT "wedding_timeline_events_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_timeline_events" ADD CONSTRAINT "wedding_timeline_events_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_vendor_assignments" ADD CONSTRAINT "wedding_vendor_assignments_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_vendor_assignments" ADD CONSTRAINT "wedding_vendor_assignments_ceremony_id_ceremonies_id_fk" FOREIGN KEY ("ceremony_id") REFERENCES "public"."ceremonies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_vendor_assignments" ADD CONSTRAINT "wedding_vendor_assignments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_vendor_assignments" ADD CONSTRAINT "wedding_vendor_assignments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_websites" ADD CONSTRAINT "wedding_websites_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registry_wedding_idx" ON "gift_registry_items" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registry_status_idx" ON "gift_registry_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_reporter_idx" ON "match_request_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_reported_idx" ON "match_request_reports" USING btree ("reported_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_status_idx" ON "match_request_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_wedding_idx" ON "wedding_activity_log" USING btree ("wedding_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_wedding_idx" ON "wedding_documents" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_type_idx" ON "wedding_documents" USING btree ("wedding_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_wedding_idx" ON "wedding_expenses" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_category_idx" ON "wedding_expenses" USING btree ("wedding_id","category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_status_idx" ON "wedding_expenses" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invite_wedding_idx" ON "wedding_member_invites" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invite_email_idx" ON "wedding_member_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "moodboard_wedding_idx" ON "wedding_mood_board_items" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "moodboard_category_idx" ON "wedding_mood_board_items" USING btree ("wedding_id","category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminder_wedding_idx" ON "wedding_reminders" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminder_schedule_idx" ON "wedding_reminders" USING btree ("scheduled_at","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seating_assign_unique_guest" ON "wedding_seating_assignments" USING btree ("table_id","guest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seating_assign_table_idx" ON "wedding_seating_assignments" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seating_assign_guest_idx" ON "wedding_seating_assignments" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seating_table_wedding_idx" ON "wedding_seating_tables" USING btree ("wedding_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seating_table_unique_name" ON "wedding_seating_tables" USING btree ("wedding_id","ceremony_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_attach_task_idx" ON "wedding_task_attachments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_comment_task_idx" ON "wedding_task_comments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timeline_wedding_idx" ON "wedding_timeline_events" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timeline_ceremony_idx" ON "wedding_timeline_events" USING btree ("ceremony_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timeline_start_idx" ON "wedding_timeline_events" USING btree ("wedding_id","start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wva_wedding_idx" ON "wedding_vendor_assignments" USING btree ("wedding_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wva_unique_booking" ON "wedding_vendor_assignments" USING btree ("booking_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weddings" ADD CONSTRAINT "weddings_partner_profile_id_profiles_id_fk" FOREIGN KEY ("partner_profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "block_blocker_idx" ON "blocked_users" USING btree ("blocker_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "block_blocked_idx" ON "blocked_users" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ceremonies_date_idx" ON "ceremonies" USING btree ("wedding_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guest_rsvp_idx" ON "guests" USING btree ("guest_list_id","rsvp_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inv_guest_idx" ON "invitations" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_status_idx" ON "match_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_expires_idx" ON "match_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_parent_idx" ON "wedding_tasks" USING btree ("parent_task_id");