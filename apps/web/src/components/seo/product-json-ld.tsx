import { siteConfig } from '@/config/site';
import { productHref } from '@/features/catalog/lib/routes';
import type { Product } from '@/features/catalog/types';

/** schema.org Product with offers + rating → rich results (price, stock, stars) in Google. */
/** `categories`: the visible category path, top level first. */
export function ProductJsonLd({
  product,
  categories,
}: {
  product: Product;
  categories: readonly string[];
}) {
  const url = new URL(productHref(product.slug), siteConfig.url).toString();
  const prices = product.variants.map((v) => v.price);
  const inStock = product.variants.some((v) => v.stock > 0);
  const availability = `https://schema.org/${inStock ? 'InStock' : 'OutOfStock'}`;

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription,
    sku: product.variants[0]?.sku,
    category: categories.join(' > ') || undefined,
    image: product.images.map((img) => new URL(img.src, siteConfig.url).toString()),
    brand: { '@type': 'Brand', name: siteConfig.name },
    url,
    offers:
      product.variants.length > 1
        ? {
            '@type': 'AggregateOffer',
            priceCurrency: siteConfig.currency,
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: product.variants.length,
            availability,
            url,
          }
        : {
            '@type': 'Offer',
            priceCurrency: siteConfig.currency,
            price: prices[0],
            availability,
            url,
          },
    ...(product.rating.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating.average,
            reviewCount: product.rating.count,
            bestRating: 5,
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
