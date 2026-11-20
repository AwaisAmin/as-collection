-- Taxonomy integrity: URL-safe slugs and codes everywhere (admin-editable since B7c), hex swatches.
ALTER TABLE "brands" ADD CONSTRAINT "brands_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "collections" ADD CONSTRAINT "collections_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "tags" ADD CONSTRAINT "tags_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "attributes" ADD CONSTRAINT "attributes_code_format_check" CHECK ("code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_swatch_format_check" CHECK ("swatch" IS NULL OR "swatch" ~ '^#[0-9a-f]{3}([0-9a-f]{3})?$');
-- Variant options are single-choice by definition.
ALTER TABLE "attributes" ADD CONSTRAINT "attributes_variant_select_check" CHECK ("scope" <> 'VARIANT' OR "type" = 'SELECT');
