'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';

import { Logo } from '@/components/brand/logo';
import { WithPathname } from '@/components/routing/with-pathname';
import { Drawer } from '@/components/ui/drawer';
import { IconButton } from '@/components/ui/icon-button';
import { SocialLinks } from '@/components/ui/social-links';
import { isActivePath, mainNav, shopMegaMenu } from '@/config/navigation';
import { useDisclosure } from '@/hooks/use-disclosure';

import { navLinkClasses } from './nav-link-classes';
import { SearchForm } from './search-form';

/** Hamburger trigger + slide-in navigation drawer (below `lg`). */
export function MobileNav() {
  const { isOpen, open, close } = useDisclosure();
  const drawerId = useId();

  return (
    <>
      <IconButton
        aria-label="Open menu"
        aria-expanded={isOpen}
        aria-controls={drawerId}
        onClick={open}
      >
        <Menu aria-hidden size={28} strokeWidth={1.6} />
      </IconButton>

      <Drawer
        id={drawerId}
        open={isOpen}
        onClose={close}
        title="Menu"
        header={<Logo size="sm" onClick={close} />}
        footer={
          <div className="bg-ink px-5 py-4">
            <SocialLinks />
          </div>
        }
      >
        <div className="px-5 pt-5">
          <SearchForm inputId={`${drawerId}-search`} />
        </div>

        <nav aria-label="Mobile" className="px-5 py-4">
          <WithPathname>
            {(pathname) => {
              const isActive = (href: string) => pathname !== null && isActivePath(pathname, href);
              return (
                <ul className="flex flex-col gap-1">
                  {mainNav.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          onClick={close}
                          aria-current={active ? 'page' : undefined}
                          className={navLinkClasses(active, 'drawer')}
                        >
                          {item.label}
                        </Link>
                        {item.children ? (
                          <ul className="mt-1 mb-2 ml-5 flex flex-col border-l border-gold/60 pl-4">
                            {[...item.children, ...shopMegaMenu.highlights]
                              .filter((child) => child.href !== item.href)
                              .map((child) => (
                                <li key={child.label}>
                                  <Link
                                    href={child.href}
                                    onClick={close}
                                    className="block py-2 font-display text-[16px] text-muted transition-colors duration-200 hover:text-gold"
                                  >
                                    {child.label}
                                  </Link>
                                </li>
                              ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                  {(
                    [
                      { href: '/account', label: 'My Account' },
                      { href: '/wishlist', label: 'Wishlist' },
                      { href: '/track-order', label: 'Track Order' },
                    ] as const
                  ).map(({ href, label }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={close}
                        aria-current={isActive(href) ? 'page' : undefined}
                        className={navLinkClasses(isActive(href), 'drawer')}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              );
            }}
          </WithPathname>
        </nav>
      </Drawer>
    </>
  );
}
