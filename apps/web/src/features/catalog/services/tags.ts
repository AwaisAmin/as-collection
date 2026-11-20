/** Next.js cache tags for catalog reads (revalidated when the store's catalog changes). */
export const CATALOG_TAG = 'catalog';

/** A product's reviews. */
export const reviewsTag = (productSlug: string) => `reviews:${productSlug}`;

/** Store-wide review reads (home testimonials, store rating). */
export const REVIEWS_TAG = 'reviews';

/** Reviews per page on the product page. */
export const REVIEWS_PAGE_SIZE = 5;
