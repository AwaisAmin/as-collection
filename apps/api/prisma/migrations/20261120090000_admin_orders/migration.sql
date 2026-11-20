-- ─── Hand-written: indexes for the admin order screens and background jobs ───
-- The partial indexes are not modelled by Prisma; the trigram and created_at indexes are
-- declared in the schema too (orders.prisma / customers.prisma), so there is no drift.

-- Payment review queue: transfers waiting for a staff check, oldest first.
CREATE INDEX "orders_awaiting_verification_idx" ON "orders" ("placed_at")
  WHERE "payment_status" = 'AWAITING_VERIFICATION';

-- Auto-cancel job: open transfer orders that were never paid.
CREATE INDEX "orders_unpaid_transfers_idx" ON "orders" ("placed_at")
  WHERE "status" = 'PENDING' AND "payment_method" <> 'COD'
    AND "payment_status" IN ('UNPAID', 'FAILED');

-- Admin search by customer name ("ayesha", "khan") without a full scan.
CREATE INDEX "orders_customer_name_trgm_idx" ON "orders" USING gin ("customer_name" gin_trgm_ops);

-- Cleanup jobs: expired customer sessions and old OTP challenges.
CREATE INDEX IF NOT EXISTS "otp_challenges_created_at_idx" ON "otp_challenges" ("created_at");
