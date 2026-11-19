import { ChevronRight } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';

import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils/cn';

export interface BreadcrumbItem {
  label: string;
  /** Omit for the current page (last item). */
  href?: Route;
}

interface BreadcrumbsProps {
  items: readonly BreadcrumbItem[];
  /** `light` for dark backgrounds (photo banners). */
  tone?: 'default' | 'light';
  className?: string;
}

const tones = {
  default: {
    list: 'text-muted',
    link: 'hover:text-gold-dark',
    current: 'text-text',
    sep: 'text-gold',
  },
  light: {
    list: 'text-white/80',
    link: 'hover:text-gold-light',
    current: 'text-white',
    sep: 'text-gold-light',
  },
} as const;

/** Visible trail + schema.org BreadcrumbList for search results. */
export function Breadcrumbs({ items, tone = 'default', className }: BreadcrumbsProps) {
  const t = tones[tone];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: new URL(item.href, siteConfig.url).toString() } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className={cn('font-body text-[15px]', className)}>
      <ol className={cn('flex flex-wrap items-center gap-1.5', t.list)}>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li>
                {item.href && !last ? (
                  <Link href={item.href} className={cn('transition-colors duration-200', t.link)}>
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? 'page' : undefined} className={t.current}>
                    {item.label}
                  </span>
                )}
              </li>
              {!last ? (
                <li aria-hidden className={t.sep}>
                  <ChevronRight size={14} />
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
    </nav>
  );
}
