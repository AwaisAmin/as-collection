'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef } from 'react';

import { Logo } from '@/components/brand/logo';
import { IconButton } from '@/components/ui/icon-button';
import { SocialLinks } from '@/components/ui/social-links';
import { isActivePath, mainNav } from '@/config/navigation';
import { useDisclosure } from '@/hooks/use-disclosure';
import { useEscapeKey } from '@/hooks/use-escape-key';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';
import { cn } from '@/lib/utils/cn';

import { navLinkClasses } from './nav-link-classes';
import { SearchForm } from './search-form';

/** Hamburger trigger + slide-in drawer (below `lg`). */
export function MobileNav() {
  const { isOpen, open, close } = useDisclosure();
  const pathname = usePathname();
  const drawerId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  useLockBodyScroll(isOpen);
  useEscapeKey(close, isOpen);
  useFocusTrap(drawerRef, isOpen);

  // Move focus into the drawer on open, and back to the trigger on close.
  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen]);

  return (
    <>
      <IconButton
        ref={triggerRef}
        aria-label="Open menu"
        aria-expanded={isOpen}
        aria-controls={drawerId}
        onClick={open}
        className="text-ink"
      >
        <Menu aria-hidden size={28} strokeWidth={1.6} />
      </IconButton>

      {/* Overlay */}
      <div
        aria-hidden
        onClick={close}
        className={cn(
          'fixed inset-0 z-50 bg-ink/50 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        id={drawerId}
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        inert={!isOpen}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[86%] max-w-sm flex-col overflow-y-auto border-r border-gold bg-ivory shadow-card-hover transition-transform duration-300 ease-elegant',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-gold/60 px-5 py-4">
          <Logo size="sm" onClick={close} />
          <IconButton ref={closeRef} aria-label="Close menu" onClick={close}>
            <X aria-hidden size={26} strokeWidth={1.6} />
          </IconButton>
        </div>

        <div className="px-5 pt-5">
          <SearchForm inputId={`${drawerId}-search`} />
        </div>

        <nav aria-label="Mobile" className="flex-1 px-5 py-4">
          <ul className="flex flex-col gap-1">
            {mainNav.map((item) => {
              const active = isActivePath(pathname, item.href);
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
                      {item.children
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
            <li>
              <Link
                href="/account"
                onClick={close}
                aria-current={isActivePath(pathname, '/account') ? 'page' : undefined}
                className={navLinkClasses(isActivePath(pathname, '/account'), 'drawer')}
              >
                My Account
              </Link>
            </li>
          </ul>
        </nav>

        <div className="bg-ink px-5 py-4">
          <SocialLinks />
        </div>
      </div>
    </>
  );
}
