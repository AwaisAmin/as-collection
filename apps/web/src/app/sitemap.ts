import type { MetadataRoute } from 'next';

import { categories } from '@/config/catalog';
import { siteConfig } from '@/config/site';
import { productHref } from '@/features/catalog/lib/routes';
import { catalogService } from '@/features/catalog/services/catalog.service';

const staticPaths = [
  '/',
  '/shop',
  '/about',
  '/contact',
  '/track-order',
  '/privacy-policy',
  '/terms',
] as const;

const abs = (path: string) => new URL(path, siteConfig.url).toString();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await catalogService.listProductSlugs();
  const products = await Promise.all(slugs.map((slug) => catalogService.getProductBySlug(slug)));

  return [
    ...staticPaths.map((path) => ({
      url: abs(path),
      changeFrequency: 'weekly' as const,
      priority: path === '/' ? 1 : 0.5,
    })),
    ...categories.map(({ href }) => ({
      url: abs(href),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...products.flatMap((p) =>
      p
        ? [
            {
              url: abs(productHref(p.slug)),
              changeFrequency: 'weekly' as const,
              priority: 0.7,
              images: p.images.slice(0, 3).map((img) => abs(img.src)),
            },
          ]
        : [],
    ),
  ];
}
