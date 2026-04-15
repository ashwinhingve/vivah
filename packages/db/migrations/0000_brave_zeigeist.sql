CREATE TYPE "public"."audit_event_type" AS ENUM('USER_REGISTERED', 'USER_VERIFIED', 'USER_SUSPENDED', 'KYC_SUBMITTED', 'KYC_VERIFIED', 'KYC_REJECTED', 'MATCH_ACCEPTED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'ESCROW_HELD', 'ESCROW_RELEASED', 'ESCROW_DISPUTED', 'CONTRACT_SIGNED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'VENDOR_APPROVED', 'PROFILE_BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."ceremony_type" AS ENUM('WEDDING', 'HALDI', 'MEHNDI', 'SANGEET', 'ENGAGEMENT', 'RECEPTION', 'CORPORATE', 'FESTIVAL', 'COMMUNITY', 'GOVERNMENT', 'SCHOOL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."diet" AS ENUM('VEG', 'NON_VEG', 'JAIN', 'VEGAN', 'EGGETARIAN');--> statement-breakpoint
CREATE TYPE "public"."escrow_status" AS ENUM('HELD', 'RELEASED', 'DISPUTED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."family_status" AS ENUM('MIDDLE_CLASS', 'UPPER_MIDDLE', 'AFFLUENT');--> statement-breakpoint
CREATE TYPE "public"."family_type" AS ENUM('JOINT', 'NUCLEAR', 'EXTENDED');--> statement-breakpoint
CREATE TYPE "public"."family_values" AS ENUM('TRADITIONAL', 'MODERATE', 'LIBERAL');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('MALE', 'FEMALE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."manglik_status" AS ENUM('YES', 'NO', 'PARTIAL');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'BLOCKED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."meal_preference" AS ENUM('VEG', 'NON_VEG', 'JAIN', 'VEGAN', 'EGGETARIAN', 'NO_PREFERENCE');--> statement-breakpoint
CREATE TYPE "public"."nakshatra" AS ENUM('ASHWINI', 'BHARANI', 'KRITTIKA', 'ROHINI', 'MRIGASHIRA', 'ARDRA', 'PUNARVASU', 'PUSHYA', 'ASHLESHA', 'MAGHA', 'PURVA_PHALGUNI', 'UTTARA_PHALGUNI', 'HASTA', 'CHITRA', 'SWATI', 'VISHAKHA', 'ANURADHA', 'JYESHTHA', 'MULA', 'PURVA_ASHADHA', 'UTTARA_ASHADHA', 'SHRAVANA', 'DHANISHTA', 'SHATABHISHA', 'PURVA_BHADRAPADA', 'UTTARA_BHADRAPADA', 'REVATI');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('NEW_MATCH', 'MATCH_ACCEPTED', 'MATCH_DECLINED', 'NEW_MESSAGE', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'ESCROW_RELEASED', 'RSVP_RECEIVED', 'TASK_DUE', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('UPI', 'CARD', 'NETBANKING', 'WALLET', 'EMI', 'CASH');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."premium_tier" AS ENUM('FREE', 'STANDARD', 'PREMIUM');--> statement-breakpoint
CREATE TYPE "public"."rashi" AS ENUM('MESH', 'VRISHABHA', 'MITHUN', 'KARK', 'SINGH', 'KANYA', 'TULA', 'VRISHCHIK', 'DHANU', 'MAKAR', 'KUMBH', 'MEEN');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('PENDING', 'YES', 'NO', 'MAYBE');--> statement-breakpoint
CREATE TYPE "public"."smoking_drinking" AS ENUM('NEVER', 'OCCASIONALLY', 'REGULARLY');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('INDIVIDUAL', 'FAMILY_MEMBER', 'VENDOR', 'EVENT_COORDINATOR', 'ADMIN', 'SUPPORT');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."vendor_category" AS ENUM('PHOTOGRAPHY', 'VIDEOGRAPHY', 'CATERING', 'DECORATION', 'VENUE', 'MAKEUP', 'JEWELLERY', 'CLOTHING', 'MUSIC', 'LIGHTING', 'SECURITY', 'TRANSPORT', 'PRIEST', 'SOUND', 'EVENT_HOSTING', 'RENTAL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('PENDING', 'VERIFIED', 'REJECTED', 'MANUAL_REVIEW');--> statement-breakpoint
CREATE TYPE "public"."wedding_status" AS ENUM('PLANNING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "audit_event_type" NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"actor_id" text,
	"payload" jsonb,
	"content_hash" varchar(64) NOT NULL,
	"prev_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blocked_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" text NOT NULL,
	"vendor_id" uuid NOT NULL,
	"service_id" uuid,
	"event_date" date NOT NULL,
	"ceremony_type" "ceremony_type" DEFAULT 'WEDDING' NOT NULL,
	"status" "booking_status" DEFAULT 'PENDING' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"community" varchar(100),
	"sub_community" varchar(100),
	"mother_tongue" varchar(50),
	"preferred_lang" varchar(10) DEFAULT 'hi',
	"lgbtq_profile" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "community_zones_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "escrow_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"total_held" numeric(12, 2) NOT NULL,
	"released" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "escrow_status" DEFAULT 'HELD' NOT NULL,
	"release_due_at" timestamp,
	"released_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "escrow_accounts_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guest_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guest_lists_wedding_id_unique" UNIQUE("wedding_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_list_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(15),
	"email" varchar(255),
	"relationship" varchar(100),
	"side" varchar(10),
	"rsvp_status" "rsvp_status" DEFAULT 'PENDING' NOT NULL,
	"meal_preference" "meal_preference" DEFAULT 'NO_PREFERENCE' NOT NULL,
	"room_number" varchar(20),
	"plus_ones" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"channel" varchar(20) NOT NULL,
	"opened_at" timestamp,
	"rsvp_at" timestamp,
	"message_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"aadhaar_verified" boolean DEFAULT false NOT NULL,
	"aadhaar_ref_id" varchar(100),
	"photo_analysis" jsonb,
	"duplicate_flag" boolean DEFAULT false NOT NULL,
	"duplicate_reason" text,
	"admin_note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kyc_verifications_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"receiver_id" uuid NOT NULL,
	"status" "match_status" DEFAULT 'PENDING' NOT NULL,
	"message" text,
	"responded_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_a" uuid NOT NULL,
	"profile_b" uuid NOT NULL,
	"total_score" integer NOT NULL,
	"breakdown" jsonb,
	"guna_milan_score" integer,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"push" boolean DEFAULT true NOT NULL,
	"sms" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"marketing" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"sent_via" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"fulfilment_status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"tracking_number" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" text NOT NULL,
	"status" "order_status" DEFAULT 'PLACED' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"shipping_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"shipping_address" jsonb NOT NULL,
	"razorpay_order_id" varchar(255),
	"razorpay_payment_id" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"method" "payment_method",
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"razorpay_order_id" varchar(255),
	"razorpay_payment_id" varchar(255),
	"razorpay_signature" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"settled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100) NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"compare_price" numeric(12, 2),
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"sku" varchar(100),
	"r2_image_keys" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"r2_key" varchar(500) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"file_size" integer,
	"mime_type" varchar(50)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"personal" boolean DEFAULT false NOT NULL,
	"family" boolean DEFAULT false NOT NULL,
	"career" boolean DEFAULT false NOT NULL,
	"lifestyle" boolean DEFAULT false NOT NULL,
	"horoscope" boolean DEFAULT false NOT NULL,
	"photos" boolean DEFAULT false NOT NULL,
	"preferences" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profile_sections_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"mongo_profile_id" varchar(24),
	"verification_status" "verification_status" DEFAULT 'PENDING' NOT NULL,
	"premium_tier" "premium_tier" DEFAULT 'FREE' NOT NULL,
	"profile_completeness" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_active_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"family_inclination_score" integer,
	"function_attendance_score" integer,
	"stay_quotient" varchar(20),
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "safety_mode_unlocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"unlocked_for" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"phone_number" text,
	"phone_number_verified" boolean DEFAULT false NOT NULL,
	"role" text DEFAULT 'INDIVIDUAL' NOT NULL,
	"status" text DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_event_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"event_type" "ceremony_type" NOT NULL,
	"available" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price_from" numeric(12, 2),
	"price_to" numeric(12, 2),
	"price_unit" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"mongo_portfolio_id" varchar(24),
	"business_name" varchar(255) NOT NULL,
	"category" "vendor_category" NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"rating" numeric(3, 2) DEFAULT '0',
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" varchar(50) DEFAULT 'VIEWER' NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"due_date" date,
	"status" varchar(20) DEFAULT 'TODO' NOT NULL,
	"priority" varchar(10) DEFAULT 'MEDIUM' NOT NULL,
	"assigned_to" text,
	"category" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"mongo_wedding_plan_id" varchar(24),
	"wedding_date" date,
	"venue_name" varchar(255),
	"venue_city" varchar(100),
	"budget_total" numeric(12, 2),
	"guest_count" integer,
	"status" "wedding_status" DEFAULT 'PLANNING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocker_id_profiles_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocked_id_profiles_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_vendor_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."vendor_services"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_zones" ADD CONSTRAINT "community_zones_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guest_lists" ADD CONSTRAINT "guest_lists_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guest_lists" ADD CONSTRAINT "guest_lists_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guests" ADD CONSTRAINT "guests_guest_list_id_guest_lists_id_fk" FOREIGN KEY ("guest_list_id") REFERENCES "public"."guest_lists"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_sender_id_profiles_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_receiver_id_profiles_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_scores" ADD CONSTRAINT "match_scores_profile_a_profiles_id_fk" FOREIGN KEY ("profile_a") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "match_scores" ADD CONSTRAINT "match_scores_profile_b_profiles_id_fk" FOREIGN KEY ("profile_b") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_photos" ADD CONSTRAINT "profile_photos_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_sections" ADD CONSTRAINT "profile_sections_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "safety_mode_unlocks" ADD CONSTRAINT "safety_mode_unlocks_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "safety_mode_unlocks" ADD CONSTRAINT "safety_mode_unlocks_unlocked_for_profiles_id_fk" FOREIGN KEY ("unlocked_for") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_event_types" ADD CONSTRAINT "vendor_event_types_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_services" ADD CONSTRAINT "vendor_services_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendors" ADD CONSTRAINT "vendors_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_members" ADD CONSTRAINT "wedding_members_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_members" ADD CONSTRAINT "wedding_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_tasks" ADD CONSTRAINT "wedding_tasks_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_tasks" ADD CONSTRAINT "wedding_tasks_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weddings" ADD CONSTRAINT "weddings_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_unique_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_block" ON "blocked_users" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_customer_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_vendor_idx" ON "bookings" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_date_idx" ON "bookings" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guest_list_idx" ON "guests" USING btree ("guest_list_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_sender_idx" ON "match_requests" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_receiver_idx" ON "match_requests" USING btree ("receiver_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "match_unique_pair" ON "match_requests" USING btree ("sender_id","receiver_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "score_pair_idx" ON "match_scores" USING btree ("profile_a","profile_b");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notif_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notif_read_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_item_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_item_vendor_idx" ON "order_items" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_vendor_idx" ON "products" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_active_idx" ON "products" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photos_profile_idx" ON "profile_photos" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photos_order_idx" ON "profile_photos" USING btree ("profile_id","display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_user_idx" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_status_idx" ON "profiles" USING btree ("verification_status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "safety_unlock_pair_idx" ON "safety_mode_unlocks" USING btree ("profile_id","unlocked_for");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_token_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_phone_idx" ON "user" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_vendor_event" ON "vendor_event_types" USING btree ("vendor_id","event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_city_idx" ON "vendors" USING btree ("city");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_category_idx" ON "vendors" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_wedding_member" ON "wedding_members" USING btree ("wedding_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_wedding_idx" ON "wedding_tasks" USING btree ("wedding_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_status_idx" ON "wedding_tasks" USING btree ("status");