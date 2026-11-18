'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isActivePath, mainNav } from '@/config/navigation';
import { cn } from '@/lib/utils/cn';

import { navLinkClasses } from './nav-link-classes';
import { ShopDropdown } from './shop-dropdown';

export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className={className}>
      <ul className={cn('flex items-center gap-5 xl:gap-6')}>
        {mainNav.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.label}>
              {item.children ? (
                <ShopDropdown item={{ ...item, children: item.children }} active={active} />
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
    </nav>
  );
}
