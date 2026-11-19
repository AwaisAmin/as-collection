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
  className?: string;
}

/** Visible trail + schema.org BreadcrumbList for search results. */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
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
      <ol className="flex flex-wrap items-center gap-1.5 text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li>
                {item.href && !last ? (
                  <Link
                    href={item.href}
                    className="transition-colors duration-200 hover:text-gold-dark"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? 'page' : undefined} className="text-text">
                    {item.label}
                  </span>
                )}
              </li>
              {!last ? (
                <li aria-hidden className="text-gold">
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
