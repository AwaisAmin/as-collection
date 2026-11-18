import type { MetadataRoute } from 'next';

import { categories } from '@/config/catalog';
import { siteConfig } from '@/config/site';

const staticPaths = ['/', '/shop', '/about', '/contact', '/privacy-policy', '/terms'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...staticPaths.map((path) => ({
      url: new URL(path, siteConfig.url).toString(),
      changeFrequency: 'weekly' as const,
      priority: path === '/' ? 1 : 0.6,
    })),
    ...categories.map(({ href }) => ({
      url: new URL(href, siteConfig.url).toString(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
