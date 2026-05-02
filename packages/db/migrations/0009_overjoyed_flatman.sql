CREATE TYPE "public"."ceremony_status" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."wedding_coordinator_scope" AS ENUM('VIEW', 'EDIT', 'DAY_OF', 'FULL');--> statement-breakpoint
CREATE TYPE "public"."family_relationship" AS ENUM('FATHER', 'MOTHER', 'SIBLING', 'GUARDIAN', 'GRANDPARENT', 'UNCLE', 'AUNT', 'COUSIN', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."family_verification_badge" AS ENUM('NONE', 'FAMILY_VERIFIED', 'PARENT_VERIFIED');--> statement-breakpoint
CREATE TYPE "public"."wedding_incident_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."plan_interval" AS ENUM('MONTHLY', 'QUARTERLY', 'YEARLY');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('STANDARD', 'PREMIUM');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('OPEN', 'INVESTIGATING', 'RESOLVED', 'WRITE_OFF');--> statement-breakpoint
CREATE TYPE "public"."rsvp_question_type" AS ENUM('TEXT', 'BOOLEAN', 'CHOICE');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('CREATED', 'AUTHENTICATED', 'ACTIVE', 'PENDING', 'PAUSED', 'HALTED', 'CANCELLED', 'COMPLETED', 'EXPIRED');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'BUDGET_ALERT';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'CEREMONY_REMINDER';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'DAY_OF_CHECKIN';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'INCIDENT_RAISED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'COORDINATOR_ASSIGNED';--> statement-breakpoint
ALTER TYPE "public"."rental_booking_status" ADD VALUE 'DISPUTED';--> statement-breakpoint
ALTER TYPE "public"."wedding_reminder_type" ADD VALUE 'CEREMONY_T_30D';--> statement-breakpoint
ALTER TYPE "public"."wedding_reminder_type" ADD VALUE 'CEREMONY_T_7D';--> statement-breakpoint
ALTER TYPE "public"."wedding_reminder_type" ADD VALUE 'CEREMONY_T_1D';--> statement-breakpoint
ALTER TYPE "public"."wedding_reminder_type" ADD VALUE 'CEREMONY_T_1H';--> statement-breakpoint
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
ALTER TABLE "bookings" ADD COLUMN "wedding_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "ceremony_id" uuid;--> statement-breakpoint
ALTER TABLE "ceremonies" ADD COLUMN "status" "ceremony_status" DEFAULT 'SCHEDULED' NOT NULL;--> statement-breakpoint
ALTER TABLE "ceremonies" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "ceremonies" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "arrived_at" timestamp;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "checked_in_by" text;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "muted_types" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "commission_pct" numeric(5, 2) DEFAULT '3.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "bank_verification_status" varchar(16) DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "wedding_expenses" ADD COLUMN "ceremony_id" uuid;--> statement-breakpoint
ALTER TABLE "wedding_reminders" ADD COLUMN "ceremony_id" uuid;--> statement-breakpoint
ALTER TABLE "wedding_reminders" ADD COLUMN "channel" varchar(20) DEFAULT 'IN_APP' NOT NULL;--> statement-breakpoint
ALTER TABLE "wedding_reminders" ADD COLUMN "failed_at" timestamp;--> statement-breakpoint
ALTER TABLE "wedding_reminders" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wedding_timeline_events" ADD COLUMN "vendor_checked_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wedding_timeline_events" ADD COLUMN "vendor_checked_in_at" timestamp;--> statement-breakpoint
ALTER TABLE "wedding_timeline_events" ADD COLUMN "vendor_checked_in_by" text;--> statement-breakpoint
ALTER TABLE "wedding_timeline_events" ADD COLUMN "actual_start_at" timestamp;--> statement-breakpoint
ALTER TABLE "wedding_timeline_events" ADD COLUMN "actual_end_at" timestamp;--> statement-breakpoint
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