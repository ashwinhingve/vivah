DO $$ BEGIN CREATE TYPE "public"."kyc_appeal_status" AS ENUM('PENDING', 'UNDER_REVIEW', 'UPHELD', 'DENIED', 'WITHDRAWN'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."kyc_document_status" AS ENUM('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."kyc_document_type" AS ENUM('AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE', 'EMPLOYMENT_LETTER', 'EDUCATION_CERTIFICATE', 'BANK_STATEMENT', 'UTILITY_BILL', 'SELFIE', 'LIVENESS_VIDEO', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."kyc_event_type" AS ENUM('INITIATED', 'AADHAAR_VERIFIED', 'AADHAAR_FAILED', 'PHOTO_ANALYZED', 'LIVENESS_CHECKED', 'FACE_MATCH_CHECKED', 'PAN_VERIFIED', 'PAN_FAILED', 'BANK_VERIFIED', 'BANK_FAILED', 'DOCUMENT_UPLOADED', 'DOCUMENT_VERIFIED', 'DOCUMENT_REJECTED', 'SANCTIONS_CHECKED', 'SANCTIONS_HIT', 'CRIMINAL_CHECKED', 'ADDRESS_VERIFIED', 'EMPLOYMENT_VERIFIED', 'EDUCATION_VERIFIED', 'RISK_SCORED', 'AUTO_VERIFIED', 'AUTO_REJECTED', 'MANUAL_APPROVED', 'MANUAL_REJECTED', 'INFO_REQUESTED', 'INFO_PROVIDED', 'APPEAL_FILED', 'APPEAL_UPHELD', 'APPEAL_DENIED', 'REVERIFICATION_REQUESTED', 'EXPIRED', 'LOCKED', 'UNLOCKED', 'LEVEL_UPGRADED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."kyc_level" AS ENUM('NONE', 'BASIC', 'STANDARD', 'PREMIUM', 'ELITE'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
ALTER TYPE "public"."verification_status" ADD VALUE IF NOT EXISTS 'EXPIRED';--> statement-breakpoint
ALTER TYPE "public"."verification_status" ADD VALUE IF NOT EXISTS 'LOCKED';--> statement-breakpoint
ALTER TYPE "public"."verification_status" ADD VALUE IF NOT EXISTS 'INFO_REQUESTED';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"type" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"rejection_context" text,
	"user_message" text NOT NULL,
	"evidence_r2_keys" jsonb,
	"status" "kyc_appeal_status" DEFAULT 'PENDING' NOT NULL,
	"resolver_id" text,
	"resolver_note" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"event_type" "kyc_event_type" NOT NULL,
	"actor_id" text,
	"actor_role" varchar(20),
	"from_status" "verification_status",
	"to_status" "verification_status",
	"from_level" "kyc_level",
	"to_level" "kyc_level",
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"document_type" "kyc_document_type" NOT NULL,
	"status" "kyc_document_status" DEFAULT 'PENDING' NOT NULL,
	"r2_key" varchar(500) NOT NULL,
	"document_last4" varchar(8),
	"expires_at" timestamp,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"verified_at" timestamp,
	"verified_by" text,
	"rejection_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "aadhaar_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "selfie_r2_key" varchar(500);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "liveness_score" integer;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "liveness_video_r2_key" varchar(500);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "liveness_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "face_match_score" integer;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "face_match_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "pan_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "pan_ref_id" varchar(100);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "pan_last4" varchar(4);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "pan_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "bank_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "bank_ref_id" varchar(100);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "bank_account_last4" varchar(4);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "bank_ifsc" varchar(11);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "bank_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "address_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "address_verification_method" varchar(30);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "address_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "employment_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "employment_method" varchar(30);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "employment_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "education_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "education_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "sanctions_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "sanctions_hit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "sanctions_lists" jsonb;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "criminal_check_ref" varchar(100);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "criminal_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "criminal_cleared" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "risk_score" integer;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "risk_factors" jsonb;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "verification_level" "kyc_level" DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "reverification_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN IF NOT EXISTS "locked_until" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_appeals" ADD CONSTRAINT "kyc_appeals_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_appeals" ADD CONSTRAINT "kyc_appeals_resolver_id_user_id_fk" FOREIGN KEY ("resolver_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_audit_log" ADD CONSTRAINT "kyc_audit_log_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_audit_log" ADD CONSTRAINT "kyc_audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_events_user_time_idx" ON "auth_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_events_type_time_idx" ON "auth_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_appeal_profile_idx" ON "kyc_appeals" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_appeal_status_idx" ON "kyc_appeals" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_audit_profile_idx" ON "kyc_audit_log" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_audit_event_idx" ON "kyc_audit_log" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_doc_profile_idx" ON "kyc_documents" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_doc_type_idx" ON "kyc_documents" USING btree ("document_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "kyc_doc_unique_active" ON "kyc_documents" USING btree ("profile_id","document_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "two_factor_user_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_level_idx" ON "kyc_verifications" USING btree ("verification_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_expires_idx" ON "kyc_verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_risk_idx" ON "kyc_verifications" USING btree ("risk_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_deletion_idx" ON "user" USING btree ("deletion_requested_at");
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."gift_registry_status" AS ENUM('AVAILABLE', 'CLAIMED', 'PURCHASED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."guest_age_group" AS ENUM('ADULT', 'CHILD', 'INFANT'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."invitation_type" AS ENUM('SAVE_THE_DATE', 'INVITATION', 'RSVP_REMINDER', 'THANK_YOU'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."match_request_priority" AS ENUM('NORMAL', 'SUPER_LIKE'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."mood_board_category" AS ENUM('DECOR', 'ATTIRE', 'MAKEUP', 'VENUE', 'FLORAL', 'INVITATION', 'CAKE', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."report_category" AS ENUM('HARASSMENT', 'FAKE_PROFILE', 'INAPPROPRIATE_CONTENT', 'SCAM', 'UNDERAGE', 'SPAM', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."report_status" AS ENUM('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."seating_table_shape" AS ENUM('ROUND', 'RECT', 'SQUARE', 'OVAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."wedding_vendor_role" AS ENUM('PHOTOGRAPHER', 'VIDEOGRAPHER', 'CATERER', 'DECORATOR', 'MUSICIAN', 'DJ', 'MAKEUP_ARTIST', 'MEHENDI_ARTIST', 'PRIEST', 'PLANNER', 'TRANSPORT', 'VENUE', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."wedding_vendor_status" AS ENUM('SHORTLISTED', 'INQUIRED', 'BOOKED', 'CONFIRMED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."wedding_document_type" AS ENUM('CONTRACT', 'RECEIPT', 'PERMIT', 'ID', 'INSURANCE', 'INVOICE', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."wedding_expense_status" AS ENUM('DRAFT', 'DUE', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."wedding_member_role" AS ENUM('OWNER', 'EDITOR', 'VIEWER'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."wedding_reminder_type" AS ENUM('TASK_DUE', 'RSVP_FOLLOWUP', 'VENDOR_PAYMENT', 'GUEST_REMINDER', 'COUNTDOWN'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
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
ALTER TABLE "ceremonies" ADD COLUMN IF NOT EXISTS "venue_address" text;--> statement-breakpoint
ALTER TABLE "ceremonies" ADD COLUMN IF NOT EXISTS "dress_code" varchar(100);--> statement-breakpoint
ALTER TABLE "ceremonies" ADD COLUMN IF NOT EXISTS "expected_guests" integer;--> statement-breakpoint
ALTER TABLE "ceremonies" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ceremonies" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "plus_one_names" jsonb;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "age_group" varchar(10) DEFAULT 'ADULT' NOT NULL;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "is_vip" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "dietary_notes" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "accessibility_notes" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "invited_to_ceremonies" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "type" varchar(20) DEFAULT 'INVITATION' NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "error_message" text;--> statement-breakpoint
ALTER TABLE "match_requests" ADD COLUMN IF NOT EXISTS "priority" "match_request_priority" DEFAULT 'NORMAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "match_requests" ADD COLUMN IF NOT EXISTS "acceptance_message" text;--> statement-breakpoint
ALTER TABLE "match_requests" ADD COLUMN IF NOT EXISTS "decline_reason" varchar(64);--> statement-breakpoint
ALTER TABLE "match_requests" ADD COLUMN IF NOT EXISTS "seen_at" timestamp;--> statement-breakpoint
ALTER TABLE "wedding_tasks" ADD COLUMN IF NOT EXISTS "parent_task_id" uuid;--> statement-breakpoint
ALTER TABLE "wedding_tasks" ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "wedding_tasks" ADD COLUMN IF NOT EXISTS "estimated_hours" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "wedding_tasks" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN IF NOT EXISTS "partner_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN IF NOT EXISTS "title" varchar(255);--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN IF NOT EXISTS "venue_address" text;--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN IF NOT EXISTS "bride_name" varchar(255);--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN IF NOT EXISTS "groom_name" varchar(255);--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN IF NOT EXISTS "hashtag" varchar(80);--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN IF NOT EXISTS "primary_color" varchar(20);--> statement-breakpoint
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
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."ceremony_status" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."wedding_coordinator_scope" AS ENUM('VIEW', 'EDIT', 'DAY_OF', 'FULL'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."family_relationship" AS ENUM('FATHER', 'MOTHER', 'SIBLING', 'GUARDIAN', 'GRANDPARENT', 'UNCLE', 'AUNT', 'COUSIN', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."family_verification_badge" AS ENUM('NONE', 'FAMILY_VERIFIED', 'PARENT_VERIFIED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."wedding_incident_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."plan_interval" AS ENUM('MONTHLY', 'QUARTERLY', 'YEARLY'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."plan_tier" AS ENUM('STANDARD', 'PREMIUM'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."reconciliation_status" AS ENUM('OPEN', 'INVESTIGATING', 'RESOLVED', 'WRITE_OFF'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."rsvp_question_type" AS ENUM('TEXT', 'BOOLEAN', 'CHOICE'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."subscription_status" AS ENUM('CREATED', 'AUTHENTICATED', 'ACTIVE', 'PENDING', 'PAUSED', 'HALTED', 'CANCELLED', 'COMPLETED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'BUDGET_ALERT';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'CEREMONY_REMINDER';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'DAY_OF_CHECKIN';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'INCIDENT_RAISED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'COORDINATOR_ASSIGNED';--> statement-breakpoint
ALTER TYPE "public"."rental_booking_status" ADD VALUE IF NOT EXISTS 'DISPUTED';--> statement-breakpoint
ALTER TYPE "public"."wedding_reminder_type" ADD VALUE IF NOT EXISTS 'CEREMONY_T_30D';--> statement-breakpoint
ALTER TYPE "public"."wedding_reminder_type" ADD VALUE IF NOT EXISTS 'CEREMONY_T_7D';--> statement-breakpoint
ALTER TYPE "public"."wedding_reminder_type" ADD VALUE IF NOT EXISTS 'CEREMONY_T_1D';--> statement-breakpoint
ALTER TYPE "public"."wedding_reminder_type" ADD VALUE IF NOT EXISTS 'CEREMONY_T_1H';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" text NOT NULL,
	"reported_user_id" text,
	"match_request_id" uuid,
	"message_id" varchar(100),
	"reason" varchar(64) NOT NULL,
	"details" text,
	"status" varchar(24) DEFAULT 'PENDING' NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"platform" varchar(16) NOT NULL,
	"app_version" varchar(32),
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dispute_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"resolution_id" varchar(100) NOT NULL,
	"outcome" varchar(24) NOT NULL,
	"amount_vendor" numeric(12, 2),
	"amount_customer" numeric(12, 2),
	"resolved_by" text NOT NULL,
	"resolved_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "family_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"relationship" "family_relationship" NOT NULL,
	"is_managing" boolean DEFAULT false NOT NULL,
	"manager_user_id" text,
	"phone" varchar(15),
	"email" varchar(255),
	"notes" text,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "family_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp,
	"verified_by" text,
	"badge" "family_verification_badge" DEFAULT 'NONE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "family_verifications_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guest_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"line1" varchar(255),
	"line2" varchar(255),
	"city" varchar(100),
	"state" varchar(100),
	"pincode" varchar(10),
	"country" varchar(50) DEFAULT 'India' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guest_addresses_guest_id_unique" UNIQUE("guest_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guest_ceremony_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"ceremony_id" uuid NOT NULL,
	"rsvp_status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"plus_ones" integer DEFAULT 0 NOT NULL,
	"meal_pref" varchar(20),
	"responded_at" timestamp,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitation_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"channel" varchar(20) NOT NULL,
	"type" varchar(20) DEFAULT 'INVITATION' NOT NULL,
	"guest_ids" jsonb NOT NULL,
	"previewed_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"sent_by" text,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"payment_id" uuid,
	"vendor_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"platform_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" varchar(24) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"tier" "plan_tier" NOT NULL,
	"interval" "plan_interval" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"razorpay_plan_id" varchar(200),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reconciliation_discrepancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid,
	"razorpay_payment_id" varchar(200),
	"field" varchar(50) NOT NULL,
	"expected" text,
	"actual" text,
	"status" "reconciliation_status" DEFAULT 'OPEN' NOT NULL,
	"notes" text,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rsvp_custom_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer_text" text,
	"answer_bool" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rsvp_custom_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"question_text" varchar(500) NOT NULL,
	"question_type" "rsvp_question_type" DEFAULT 'TEXT' NOT NULL,
	"choices" jsonb,
	"is_required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rsvp_deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"deadline" timestamp NOT NULL,
	"enforced" boolean DEFAULT false NOT NULL,
	"reminder_days" integer[] DEFAULT '{7,3,1}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rsvp_deadlines_wedding_id_unique" UNIQUE("wedding_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"payment_id" uuid,
	"razorpay_payment_id" varchar(200),
	"amount" numeric(12, 2) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"status" varchar(24) DEFAULT 'CHARGED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"razorpay_subscription_id" varchar(200),
	"status" "subscription_status" DEFAULT 'CREATED' NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"grace_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"short_url" varchar(500),
	"notes" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_coordinator_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"coordinator_user_id" text NOT NULL,
	"scope" "wedding_coordinator_scope" DEFAULT 'FULL' NOT NULL,
	"assigned_by" text,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"ceremony_id" uuid,
	"severity" "wedding_incident_severity" DEFAULT 'LOW' NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"reported_by" text,
	"resolved_by" text,
	"resolved_at" timestamp,
	"resolution" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "wedding_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "ceremony_id" uuid;--> statement-breakpoint
ALTER TABLE "ceremonies" ADD COLUMN IF NOT EXISTS "status" "ceremony_status" DEFAULT 'SCHEDULED' NOT NULL;--> statement-breakpoint
ALTER TABLE "ceremonies" ADD COLUMN IF NOT EXISTS "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "ceremonies" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "arrived_at" timestamp;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "checked_in_by" text;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "muted_types" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "commission_pct" numeric(5, 2) DEFAULT '3.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "bank_verification_status" varchar(16) DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "wedding_expenses" ADD COLUMN IF NOT EXISTS "ceremony_id" uuid;--> statement-breakpoint
ALTER TABLE "wedding_reminders" ADD COLUMN IF NOT EXISTS "ceremony_id" uuid;--> statement-breakpoint
ALTER TABLE "wedding_reminders" ADD COLUMN IF NOT EXISTS "channel" varchar(20) DEFAULT 'IN_APP' NOT NULL;--> statement-breakpoint
ALTER TABLE "wedding_reminders" ADD COLUMN IF NOT EXISTS "failed_at" timestamp;--> statement-breakpoint
ALTER TABLE "wedding_reminders" ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wedding_timeline_events" ADD COLUMN IF NOT EXISTS "vendor_checked_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wedding_timeline_events" ADD COLUMN IF NOT EXISTS "vendor_checked_in_at" timestamp;--> statement-breakpoint
ALTER TABLE "wedding_timeline_events" ADD COLUMN IF NOT EXISTS "vendor_checked_in_by" text;--> statement-breakpoint
ALTER TABLE "wedding_timeline_events" ADD COLUMN IF NOT EXISTS "actual_start_at" timestamp;--> statement-breakpoint
ALTER TABLE "wedding_timeline_events" ADD COLUMN IF NOT EXISTS "actual_end_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_reported_user_id_user_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dispute_resolutions" ADD CONSTRAINT "dispute_resolutions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "family_members" ADD CONSTRAINT "family_members_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "family_members" ADD CONSTRAINT "family_members_manager_user_id_user_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "family_verifications" ADD CONSTRAINT "family_verifications_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "family_verifications" ADD CONSTRAINT "family_verifications_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guest_addresses" ADD CONSTRAINT "guest_addresses_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guest_ceremony_invites" ADD CONSTRAINT "guest_ceremony_invites_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guest_ceremony_invites" ADD CONSTRAINT "guest_ceremony_invites_ceremony_id_ceremonies_id_fk" FOREIGN KEY ("ceremony_id") REFERENCES "public"."ceremonies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitation_batches" ADD CONSTRAINT "invitation_batches_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitation_batches" ADD CONSTRAINT "invitation_batches_sent_by_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_splits" ADD CONSTRAINT "payment_splits_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_splits" ADD CONSTRAINT "payment_splits_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_splits" ADD CONSTRAINT "payment_splits_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reconciliation_discrepancies" ADD CONSTRAINT "reconciliation_discrepancies_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rsvp_custom_answers" ADD CONSTRAINT "rsvp_custom_answers_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rsvp_custom_answers" ADD CONSTRAINT "rsvp_custom_answers_question_id_rsvp_custom_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."rsvp_custom_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rsvp_custom_questions" ADD CONSTRAINT "rsvp_custom_questions_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rsvp_deadlines" ADD CONSTRAINT "rsvp_deadlines_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_coordinator_assignments" ADD CONSTRAINT "wedding_coordinator_assignments_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_coordinator_assignments" ADD CONSTRAINT "wedding_coordinator_assignments_coordinator_user_id_user_id_fk" FOREIGN KEY ("coordinator_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_coordinator_assignments" ADD CONSTRAINT "wedding_coordinator_assignments_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_incidents" ADD CONSTRAINT "wedding_incidents_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_incidents" ADD CONSTRAINT "wedding_incidents_ceremony_id_ceremonies_id_fk" FOREIGN KEY ("ceremony_id") REFERENCES "public"."ceremonies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_incidents" ADD CONSTRAINT "wedding_incidents_reported_by_user_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_incidents" ADD CONSTRAINT "wedding_incidents_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_reports_reporter_idx" ON "chat_reports" USING btree ("reporter_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_reports_status_idx" ON "chat_reports" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "device_tokens_token_idx" ON "device_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_tokens_user_idx" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dispute_resolutions_unique_idx" ON "dispute_resolutions" USING btree ("booking_id","resolution_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "family_member_profile_idx" ON "family_members" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gci_unique_guest_ceremony" ON "guest_ceremony_invites" USING btree ("guest_id","ceremony_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gci_guest_idx" ON "guest_ceremony_invites" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gci_ceremony_idx" ON "guest_ceremony_invites" USING btree ("ceremony_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gci_ceremony_rsvp_idx" ON "guest_ceremony_invites" USING btree ("ceremony_id","rsvp_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inv_batch_wedding_idx" ON "invitation_batches" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_splits_booking_idx" ON "payment_splits" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_splits_vendor_idx" ON "payment_splits" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recon_status_idx" ON "reconciliation_discrepancies" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recon_payment_idx" ON "reconciliation_discrepancies" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recon_rzp_payment_field_idx" ON "reconciliation_discrepancies" USING btree ("razorpay_payment_id","field");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rsvp_a_unique" ON "rsvp_custom_answers" USING btree ("guest_id","question_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rsvp_a_guest_idx" ON "rsvp_custom_answers" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rsvp_q_wedding_idx" ON "rsvp_custom_questions" USING btree ("wedding_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_charges_sub_idx" ON "subscription_charges" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coordinator_unique_assignment" ON "wedding_coordinator_assignments" USING btree ("wedding_id","coordinator_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coordinator_wedding_idx" ON "wedding_coordinator_assignments" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coordinator_user_idx" ON "wedding_coordinator_assignments" USING btree ("coordinator_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_wedding_idx" ON "wedding_incidents" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_ceremony_idx" ON "wedding_incidents" USING btree ("ceremony_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_severity_idx" ON "wedding_incidents" USING btree ("wedding_id","severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_open_idx" ON "wedding_incidents" USING btree ("wedding_id","resolved_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ceremony_id_ceremonies_id_fk" FOREIGN KEY ("ceremony_id") REFERENCES "public"."ceremonies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guests" ADD CONSTRAINT "guests_checked_in_by_user_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_expenses" ADD CONSTRAINT "wedding_expenses_ceremony_id_ceremonies_id_fk" FOREIGN KEY ("ceremony_id") REFERENCES "public"."ceremonies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_reminders" ADD CONSTRAINT "wedding_reminders_ceremony_id_ceremonies_id_fk" FOREIGN KEY ("ceremony_id") REFERENCES "public"."ceremonies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_timeline_events" ADD CONSTRAINT "wedding_timeline_events_vendor_checked_in_by_user_id_fk" FOREIGN KEY ("vendor_checked_in_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_wedding_idx" ON "bookings" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_ceremony_idx" ON "bookings" USING btree ("ceremony_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ceremonies_status_idx" ON "ceremonies" USING btree ("wedding_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guest_arrived_idx" ON "guests" USING btree ("guest_list_id","arrived_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_ceremony_idx" ON "wedding_expenses" USING btree ("wedding_id","ceremony_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminder_ceremony_idx" ON "wedding_reminders" USING btree ("ceremony_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "escrow_status_idx" ON "escrow_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "escrow_release_due_idx" ON "escrow_accounts" USING btree ("release_due_at","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_verified_active_idx" ON "vendors" USING btree ("verified","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wedding_member_user_idx" ON "wedding_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weddings_profile_idx" ON "weddings" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weddings_status_idx" ON "weddings" USING btree ("status");
--> statement-breakpoint
