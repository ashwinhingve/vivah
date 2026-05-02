CREATE TYPE "public"."kyc_appeal_status" AS ENUM('PENDING', 'UNDER_REVIEW', 'UPHELD', 'DENIED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."kyc_document_status" AS ENUM('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."kyc_document_type" AS ENUM('AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE', 'EMPLOYMENT_LETTER', 'EDUCATION_CERTIFICATE', 'BANK_STATEMENT', 'UTILITY_BILL', 'SELFIE', 'LIVENESS_VIDEO', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."kyc_event_type" AS ENUM('INITIATED', 'AADHAAR_VERIFIED', 'AADHAAR_FAILED', 'PHOTO_ANALYZED', 'LIVENESS_CHECKED', 'FACE_MATCH_CHECKED', 'PAN_VERIFIED', 'PAN_FAILED', 'BANK_VERIFIED', 'BANK_FAILED', 'DOCUMENT_UPLOADED', 'DOCUMENT_VERIFIED', 'DOCUMENT_REJECTED', 'SANCTIONS_CHECKED', 'SANCTIONS_HIT', 'CRIMINAL_CHECKED', 'ADDRESS_VERIFIED', 'EMPLOYMENT_VERIFIED', 'EDUCATION_VERIFIED', 'RISK_SCORED', 'AUTO_VERIFIED', 'AUTO_REJECTED', 'MANUAL_APPROVED', 'MANUAL_REJECTED', 'INFO_REQUESTED', 'INFO_PROVIDED', 'APPEAL_FILED', 'APPEAL_UPHELD', 'APPEAL_DENIED', 'REVERIFICATION_REQUESTED', 'EXPIRED', 'LOCKED', 'UNLOCKED', 'LEVEL_UPGRADED');--> statement-breakpoint
CREATE TYPE "public"."kyc_level" AS ENUM('NONE', 'BASIC', 'STANDARD', 'PREMIUM', 'ELITE');--> statement-breakpoint
ALTER TYPE "public"."verification_status" ADD VALUE 'EXPIRED';--> statement-breakpoint
ALTER TYPE "public"."verification_status" ADD VALUE 'LOCKED';--> statement-breakpoint
ALTER TYPE "public"."verification_status" ADD VALUE 'INFO_REQUESTED';--> statement-breakpoint
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
ALTER TABLE "kyc_verifications" ADD COLUMN "aadhaar_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "selfie_r2_key" varchar(500);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "liveness_score" integer;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "liveness_video_r2_key" varchar(500);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "liveness_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "face_match_score" integer;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "face_match_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "pan_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "pan_ref_id" varchar(100);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "pan_last4" varchar(4);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "pan_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "bank_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "bank_ref_id" varchar(100);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "bank_account_last4" varchar(4);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "bank_ifsc" varchar(11);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "bank_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "address_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "address_verification_method" varchar(30);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "address_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "employment_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "employment_method" varchar(30);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "employment_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "education_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "education_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "sanctions_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "sanctions_hit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "sanctions_lists" jsonb;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "criminal_check_ref" varchar(100);--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "criminal_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "criminal_cleared" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "risk_score" integer;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "risk_factors" jsonb;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "verification_level" "kyc_level" DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "reverification_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "last_attempt_at" timestamp;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD COLUMN "locked_until" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deletion_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
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