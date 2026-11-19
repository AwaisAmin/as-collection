-- CreateEnum
CREATE TYPE "ContactTopic" AS ENUM ('ORDER', 'RETURNS', 'PRODUCT', 'WHOLESALE', 'OTHER');

-- AlterTable
ALTER TABLE "contact_messages" ADD COLUMN     "order_number" VARCHAR(20),
ADD COLUMN     "topic" "ContactTopic" NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "ip_hash" CHAR(64);

-- ─── Hand-written: integrity + partial indexes (Prisma does not model these) ───

-- A contact message must be answerable.
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_reachable_check"
  CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL);
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_order_number_check"
  CHECK ("order_number" IS NULL OR "order_number" ~ '^AS-[0-9]{6}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$');
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_ip_hash_check"
  CHECK ("ip_hash" IS NULL OR "ip_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_ip_hash_check"
  CHECK ("ip_hash" IS NULL OR "ip_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_text_check"
  CHECK (length("author_name") >= 2 AND length("title") >= 3 AND length("body") >= 10);

-- Per-IP abuse limits look up recent rows by hashed IP.
CREATE INDEX "contact_messages_ip_recent_idx" ON "contact_messages" ("ip_hash", "created_at" DESC)
  WHERE "ip_hash" IS NOT NULL;
CREATE INDEX "reviews_ip_recent_idx" ON "reviews" ("ip_hash", "created_at" DESC)
  WHERE "ip_hash" IS NOT NULL;

-- One live (pending or approved) review per signed-in customer per product.
CREATE UNIQUE INDEX "reviews_one_live_per_customer_product" ON "reviews" ("product_id", "customer_id")
  WHERE "customer_id" IS NOT NULL AND "status" <> 'REJECTED';

-- Featured testimonials: approved five-star verified reviews, newest first.
CREATE INDEX "reviews_featured_idx" ON "reviews" ("created_at" DESC)
  WHERE "status" = 'APPROVED' AND "rating" = 5 AND "is_verified_purchase";
