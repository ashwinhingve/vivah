CREATE TYPE "public"."inquiry_status" AS ENUM('NEW', 'REPLIED', 'CONVERTED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'ISSUED', 'PAID', 'CANCELLED', 'CREDITED');--> statement-breakpoint
CREATE TYPE "public"."payment_instrument" AS ENUM('CARD', 'UPI', 'NETBANKING', 'WALLET');--> statement-breakpoint
CREATE TYPE "public"."payment_link_status" AS ENUM('ACTIVE', 'PAID', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED', 'ON_HOLD');--> statement-breakpoint
CREATE TYPE "public"."promo_scope" AS ENUM('BOOKING', 'STORE', 'WEDDING', 'ALL');--> statement-breakpoint
CREATE TYPE "public"."promo_type" AS ENUM('PERCENT', 'FLAT');--> statement-breakpoint
CREATE TYPE "public"."refund_reason" AS ENUM('CUSTOMER_REQUEST', 'SERVICE_CANCELLED', 'VENDOR_NO_SHOW', 'DUPLICATE_PAYMENT', 'DISPUTE_RESOLVED', 'FRAUD', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."wallet_txn_reason" AS ENUM('REFUND', 'PROMO', 'REFERRAL', 'CASHBACK', 'PAYMENT', 'TOPUP', 'ADJUSTMENT', 'EXPIRY');--> statement-breakpoint
CREATE TYPE "public"."wallet_txn_type" AS ENUM('CREDIT', 'DEBIT');--> statement-breakpoint
CREATE TYPE "public"."webhook_event_status" AS ENUM('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED', 'DUPLICATE');--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'INVOICE_GENERATED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'INVOICE_CANCELLED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'WALLET_CREDIT';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'WALLET_DEBIT';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'PROMO_REDEEMED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'PAYOUT_INITIATED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'PAYOUT_COMPLETED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'PAYOUT_FAILED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'REFUND_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'REFUND_APPROVED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'REFUND_REJECTED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'PAYMENT_LINK_CREATED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'PAYMENT_LINK_PAID';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'WEBHOOK_RECEIVED';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'WEBHOOK_DUPLICATE';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'REFUND_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'REFUND_PROCESSED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'PAYOUT_INITIATED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'PAYOUT_FAILED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'INVOICE_AVAILABLE';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'WALLET_CREDITED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'WALLET_DEBITED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'PAYMENT_LINK_RECEIVED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'PROMO_APPLIED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'NEW_BOOKING_REQUEST';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'DISPUTE_RAISED_VENDOR';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'DISPUTE_NEEDS_REVIEW';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'DISPUTE_RESOLVED';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"financial_year" varchar(7) NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_sequences_financial_year_unique" UNIQUE("financial_year")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_no" varchar(32) NOT NULL,
	"booking_id" uuid,
	"order_id" uuid,
	"payment_id" uuid,
	"customer_id" text NOT NULL,
	"vendor_id" uuid,
	"customer_name" varchar(255) NOT NULL,
	"customer_gstin" varchar(15),
	"vendor_name" varchar(255),
	"vendor_gstin" varchar(15),
	"place_of_supply" varchar(100),
	"hsn_code" varchar(12),
	"subtotal" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"taxable_value" numeric(12, 2) NOT NULL,
	"cgst" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sgst" numeric(12, 2) DEFAULT '0' NOT NULL,
	"igst" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"tax_breakdown" jsonb,
	"line_items" jsonb NOT NULL,
	"status" "invoice_status" DEFAULT 'ISSUED' NOT NULL,
	"pdf_r2_key" varchar(500),
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_at" timestamp,
	"credit_note_for" uuid,
	"notes" text,
	CONSTRAINT "invoices_invoice_no_unique" UNIQUE("invoice_no")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"short_id" varchar(12) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"description" varchar(500) NOT NULL,
	"customer_name" varchar(255),
	"customer_email" varchar(255),
	"customer_phone" varchar(15),
	"booking_id" uuid,
	"status" "payment_link_status" DEFAULT 'ACTIVE' NOT NULL,
	"razorpay_link_id" varchar(200),
	"razorpay_short_url" varchar(500),
	"razorpay_payment_id" varchar(200),
	"expires_at" timestamp,
	"paid_at" timestamp,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_links_short_id_unique" UNIQUE("short_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"instrument" "payment_instrument" NOT NULL,
	"razorpay_token_id" varchar(200),
	"razorpay_customer_id" varchar(200),
	"card_last4" varchar(4),
	"card_network" varchar(30),
	"card_expiry_month" integer,
	"card_expiry_year" integer,
	"upi_vpa" varchar(100),
	"bank_name" varchar(100),
	"wallet_provider" varchar(50),
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"booking_id" uuid,
	"order_id" uuid,
	"escrow_id" uuid,
	"gross_amount" numeric(12, 2) NOT NULL,
	"platform_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_withheld" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"status" "payout_status" DEFAULT 'SCHEDULED' NOT NULL,
	"razorpay_payout_id" varchar(200),
	"razorpay_transfer_id" varchar(200),
	"vendor_account_ref" varchar(200),
	"scheduled_for" timestamp,
	"processed_at" timestamp,
	"failure_reason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"description" varchar(255),
	"type" "promo_type" NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"scope" "promo_scope" DEFAULT 'ALL' NOT NULL,
	"min_order_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"max_discount" numeric(12, 2),
	"usage_limit" integer,
	"per_user_limit" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp,
	"first_time_user_only" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promo_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promo_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"booking_id" uuid,
	"order_id" uuid,
	"discount" numeric(12, 2) NOT NULL,
	"redeemed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"booking_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"reason" "refund_reason" NOT NULL,
	"reason_details" text,
	"status" "refund_status" DEFAULT 'REQUESTED' NOT NULL,
	"razorpay_refund_id" varchar(200),
	"requested_by" text,
	"approved_by" text,
	"failure_reason" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"processed_at" timestamp,
	"refund_to_wallet" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_blocked_dates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"date" date NOT NULL,
	"reason" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"vendor_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"customer_id" text NOT NULL,
	"ceremony_type" "ceremony_type",
	"event_date" date,
	"guest_count" integer,
	"budget_min" numeric(12, 2),
	"budget_max" numeric(12, 2),
	"message" text NOT NULL,
	"vendor_reply" text,
	"replied_at" timestamp,
	"status" "inquiry_status" DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"booking_id" uuid,
	"reviewer_id" text NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar(200),
	"comment" text,
	"vendor_reply" text,
	"vendor_replied_at" timestamp,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"type" "wallet_txn_type" NOT NULL,
	"reason" "wallet_txn_reason" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"balance_after" numeric(12, 2) NOT NULL,
	"description" varchar(500),
	"reference_type" varchar(50),
	"reference_id" varchar(100),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"lifetime_in" numeric(12, 2) DEFAULT '0' NOT NULL,
	"lifetime_out" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(50) DEFAULT 'razorpay' NOT NULL,
	"event_id" varchar(200) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"status" "webhook_event_status" DEFAULT 'RECEIVED' NOT NULL,
	"payload" jsonb NOT NULL,
	"signature" varchar(500),
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "package_name" varchar(255);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "package_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guest_count" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "event_location" varchar(500);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "proposed_date" date;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "proposed_by" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "proposed_reason" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "proposed_at" timestamp;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "tagline" varchar(255);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "cover_image_key" varchar(500);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "website" varchar(500);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "instagram" varchar(255);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "years_active" integer;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "response_time_hours" integer DEFAULT 24;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "price_min" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "price_max" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "favorite_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payouts" ADD CONSTRAINT "payouts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payouts" ADD CONSTRAINT "payouts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payouts" ADD CONSTRAINT "payouts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payouts" ADD CONSTRAINT "payouts_escrow_id_escrow_accounts_id_fk" FOREIGN KEY ("escrow_id") REFERENCES "public"."escrow_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_promo_id_promo_codes_id_fk" FOREIGN KEY ("promo_id") REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_blocked_dates" ADD CONSTRAINT "vendor_blocked_dates_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_favorites" ADD CONSTRAINT "vendor_favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_favorites" ADD CONSTRAINT "vendor_favorites_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_inquiries" ADD CONSTRAINT "vendor_inquiries_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_inquiries" ADD CONSTRAINT "vendor_inquiries_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addon_booking_idx" ON "booking_addons" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_booking_idx" ON "invoices" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_order_idx" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_customer_idx" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_vendor_idx" ON "invoices" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_issued_idx" ON "invoices" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_links_created_by_idx" ON "payment_links" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_links_status_idx" ON "payment_links" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_links_booking_idx" ON "payment_links" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_user_idx" ON "payment_methods" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_default_idx" ON "payment_methods" USING btree ("user_id","is_default");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payouts_vendor_idx" ON "payouts" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payouts_booking_idx" ON "payouts" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payouts_order_idx" ON "payouts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "promo_active_idx" ON "promo_codes" USING btree ("is_active","valid_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "promo_redemptions_promo_idx" ON "promo_redemptions" USING btree ("promo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "promo_redemptions_user_idx" ON "promo_redemptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_payment_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_booking_idx" ON "refunds" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_status_idx" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_requested_by_idx" ON "refunds" USING btree ("requested_by");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_vendor_blocked_date" ON "vendor_blocked_dates" USING btree ("vendor_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blocked_vendor_idx" ON "vendor_blocked_dates" USING btree ("vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_user_vendor_fav" ON "vendor_favorites" USING btree ("user_id","vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_fav_user_idx" ON "vendor_favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiry_vendor_idx" ON "vendor_inquiries" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiry_customer_idx" ON "vendor_inquiries" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiry_status_idx" ON "vendor_inquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_vendor_idx" ON "vendor_reviews" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_reviewer_idx" ON "vendor_reviews" USING btree ("reviewer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_booking_review" ON "vendor_reviews" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_txn_wallet_idx" ON "wallet_transactions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_txn_user_idx" ON "wallet_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_txn_ref_idx" ON "wallet_transactions" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_txn_created_idx" ON "wallet_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_provider_event_uniq" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_type_idx" ON "webhook_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_status_idx" ON "webhook_events" USING btree ("status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_proposed_by_user_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_rating_idx" ON "vendors" USING btree ("rating");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_popularity_idx" ON "vendors" USING btree ("total_reviews");