-- Moderation: review replies and staff picks, contact notes, customer blocking details.
-- AlterTable
ALTER TABLE "contact_messages" ADD COLUMN     "staff_note" VARCHAR(2000);

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "blocked_at" TIMESTAMPTZ(3),
ADD COLUMN     "blocked_reason" VARCHAR(300),
ADD COLUMN     "staff_note" VARCHAR(2000);

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "replied_at" TIMESTAMPTZ(3),
ADD COLUMN     "replied_by_staff_id" UUID,
ADD COLUMN     "reply" VARCHAR(1000);

-- CreateIndex
CREATE INDEX "customers_name_trgm_idx" ON "customers" USING GIN ("name" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_replied_by_staff_id_fkey" FOREIGN KEY ("replied_by_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-written integrity rules.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_featured_approved_check" CHECK (NOT "is_featured" OR "status" = 'APPROVED');
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reply_check" CHECK (("reply" IS NULL) = ("replied_at" IS NULL));
ALTER TABLE "customers" ADD CONSTRAINT "customers_blocked_check" CHECK (("status" = 'BLOCKED') = ("blocked_at" IS NOT NULL));

-- Staff-picked testimonials, newest pick first.
CREATE INDEX "reviews_staff_featured_idx" ON "reviews" ("moderated_at" DESC) WHERE "is_featured";
