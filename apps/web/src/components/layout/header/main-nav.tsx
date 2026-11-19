'use client';

import Link from 'next/link';

import { WithPathname } from '@/components/routing/with-pathname';
import { isActivePath, mainNav } from '@/config/navigation';

import { navLinkClasses } from './nav-link-classes';
import { ShopMegaMenu } from './shop-mega-menu';

export function MainNav({ className }: { className?: string }) {
  return (
    <nav aria-label="Main" className={className}>
      <WithPathname>
        {(pathname) => (
          <ul className="flex items-center gap-5 xl:gap-6">
            {mainNav.map((item) => {
              const active = pathname !== null && isActivePath(pathname, item.href);
              return (
                <li key={item.label}>
                  {item.children ? (
                    <ShopMegaMenu label={item.label} active={active} />
                  ) : (
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={navLinkClasses(active)}
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </WithPathname>
    </nav>
  );
}
