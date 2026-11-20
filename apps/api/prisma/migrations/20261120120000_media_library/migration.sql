-- Media library: responsive variants and upload de-duplication.
ALTER TABLE "media" ADD COLUMN "variants" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX "media_checksum_sha256_idx" ON "media"("checksum_sha256");

ALTER TABLE "media" ADD CONSTRAINT "media_variants_array_check" CHECK (jsonb_typeof("variants") = 'array');
ALTER TABLE "media" ADD CONSTRAINT "media_checksum_format_check" CHECK ("checksum_sha256" IS NULL OR "checksum_sha256" ~ '^[0-9a-f]{64}$');
