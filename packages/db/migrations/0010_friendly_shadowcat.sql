CREATE INDEX IF NOT EXISTS "escrow_status_idx" ON "escrow_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "escrow_release_due_idx" ON "escrow_accounts" USING btree ("release_due_at","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_verified_active_idx" ON "vendors" USING btree ("verified","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wedding_member_user_idx" ON "wedding_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weddings_profile_idx" ON "weddings" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weddings_status_idx" ON "weddings" USING btree ("status");