-- AlterTable
ALTER TABLE "products" ADD COLUMN     "compare_at_minor" INTEGER,
ADD COLUMN     "in_stock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_on_sale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "price_max_minor" INTEGER,
ADD COLUMN     "price_min_minor" INTEGER,
ADD COLUMN     "rating_average" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "products_status_price_min_minor_idx" ON "products"("status", "price_min_minor");

-- CreateIndex
CREATE INDEX "products_status_rating_average_idx" ON "products"("status", "rating_average" DESC);

-- CreateIndex
CREATE INDEX "products_status_is_featured_is_bestseller_in_stock_publishe_idx" ON "products"("status", "is_featured", "is_bestseller", "in_stock", "published_at" DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Listing summary maintained by triggers (hand-written; Prisma does not manage functions or
-- triggers and never drops them). Every write path — API, admin, seed, raw SQL — stays consistent.
-- ─────────────────────────────────────────────────────────────────────────────

-- Price range, discount and availability of one product, from its ACTIVE variants.
-- A variant without an inventory row is treated as unavailable (never oversell by accident).
CREATE OR REPLACE FUNCTION refresh_product_listing(p_product_id uuid) RETURNS void
LANGUAGE sql AS $$
  UPDATE products p SET
    price_min_minor  = s.min_price,
    price_max_minor  = s.max_price,
    compare_at_minor = s.compare_at,
    is_on_sale       = s.on_sale,
    in_stock         = s.in_stock
  FROM (
    SELECT
      min(v.price_minor) AS min_price,
      max(v.price_minor) AS max_price,
      max(v.compare_at_price_minor) FILTER (
        WHERE v.price_minor = (
          SELECT min(v2.price_minor) FROM product_variants v2
          WHERE v2.product_id = p_product_id AND v2.is_active
        )
      ) AS compare_at,
      coalesce(bool_or(v.compare_at_price_minor > v.price_minor), false) AS on_sale,
      coalesce(bool_or(
        i.variant_id IS NOT NULL
        AND (NOT i.track_inventory OR i.allow_backorder OR i.on_hand - i.reserved > 0)
      ), false) AS in_stock
    FROM product_variants v
    LEFT JOIN inventory_items i ON i.variant_id = v.id
    WHERE v.product_id = p_product_id AND v.is_active
  ) s
  WHERE p.id = p_product_id;
$$;

-- Rating count / sum / average of one product, from APPROVED reviews.
CREATE OR REPLACE FUNCTION refresh_product_rating(p_product_id uuid) RETURNS void
LANGUAGE sql AS $$
  UPDATE products p SET
    rating_count   = s.cnt,
    rating_sum     = s.total,
    rating_average = CASE WHEN s.cnt > 0 THEN round(s.total::numeric / s.cnt, 2)::float8 ELSE 0 END
  FROM (
    SELECT count(*)::int AS cnt, coalesce(sum(r.rating), 0)::int AS total
    FROM reviews r
    WHERE r.product_id = p_product_id AND r.status = 'APPROVED'
  ) s
  WHERE p.id = p_product_id;
$$;

CREATE OR REPLACE FUNCTION trg_variants_refresh_listing() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN PERFORM refresh_product_listing(OLD.product_id); END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id) THEN
    PERFORM refresh_product_listing(NEW.product_id);
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION trg_inventory_refresh_listing() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_product_listing(v.product_id)
  FROM product_variants v
  WHERE v.id IN (OLD.variant_id, NEW.variant_id);
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION trg_reviews_refresh_rating() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN PERFORM refresh_product_rating(OLD.product_id); END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id) THEN
    PERFORM refresh_product_rating(NEW.product_id);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER product_variants_refresh_listing
  AFTER INSERT OR DELETE OR UPDATE OF price_minor, compare_at_price_minor, is_active, product_id
  ON product_variants FOR EACH ROW EXECUTE FUNCTION trg_variants_refresh_listing();

CREATE TRIGGER inventory_items_refresh_listing
  AFTER INSERT OR DELETE OR UPDATE OF on_hand, reserved, track_inventory, allow_backorder
  ON inventory_items FOR EACH ROW EXECUTE FUNCTION trg_inventory_refresh_listing();

CREATE TRIGGER reviews_refresh_rating
  AFTER INSERT OR DELETE OR UPDATE OF status, rating, product_id
  ON reviews FOR EACH ROW EXECUTE FUNCTION trg_reviews_refresh_rating();

-- Backfill existing products.
SELECT refresh_product_listing(id), refresh_product_rating(id) FROM products;
