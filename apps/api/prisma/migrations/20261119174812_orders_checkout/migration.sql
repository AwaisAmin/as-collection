-- Existing rows (none in production) get a placeholder hash; new rows must provide one.
ALTER TABLE "orders" ADD COLUMN "request_hash" CHAR(64) NOT NULL DEFAULT repeat('0', 64);
ALTER TABLE "orders" ALTER COLUMN "request_hash" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "orders_discount_id_phone_idx" ON "orders"("discount_id", "phone");

-- Order numbers are read out on the phone: AS-YYMMDD-XXXXX without 0/O/1/I/L.
ALTER TABLE "orders" ADD CONSTRAINT "orders_number_format_check"
  CHECK ("number" ~ '^AS-[0-9]{6}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$');
ALTER TABLE "orders" ADD CONSTRAINT "orders_hashes_check"
  CHECK ("access_key_hash" ~ '^[0-9a-f]{64}$' AND "request_hash" ~ '^[0-9a-f]{64}$');
