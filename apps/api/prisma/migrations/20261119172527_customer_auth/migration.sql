-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "email_verified_at" TIMESTAMPTZ(3);

-- At most one default address per customer (Prisma cannot express partial unique indexes).
CREATE UNIQUE INDEX "addresses_one_default_per_customer"
  ON "addresses" ("customer_id") WHERE "is_default";

-- A verified email must have an email.
ALTER TABLE "customers" ADD CONSTRAINT "customers_email_verified_check"
  CHECK ("email_verified_at" IS NULL OR "email" IS NOT NULL);

-- OTP rate limits count recent challenges per requester IP.
CREATE INDEX "otp_challenges_ip_hash_created_at_idx"
  ON "otp_challenges" ("ip_hash", "created_at" DESC) WHERE "ip_hash" IS NOT NULL;

-- Session lookups by customer for "signed-in devices" (active first, newest first).
CREATE INDEX "customer_sessions_customer_active_idx"
  ON "customer_sessions" ("customer_id", "created_at" DESC) WHERE "revoked_at" IS NULL;
