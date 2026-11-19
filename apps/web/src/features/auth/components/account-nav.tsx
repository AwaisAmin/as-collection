'use client';

import { Heart, LayoutDashboard, LogOut, MapPin, Package, UserRound } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { WithPathname } from '@/components/routing/with-pathname';
import { cn } from '@/lib/utils/cn';

import { logoutAction } from '../actions';

const links: readonly { href: Route; label: string; icon: typeof Package; exact?: boolean }[] = [
  { href: '/account', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/account/orders', label: 'My orders', icon: Package },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/profile', label: 'Profile', icon: UserRound },
  { href: '/wishlist', label: 'Wishlist', icon: Heart },
];

export function AccountNav() {
  return (
    <nav aria-label="Account" className="rounded-card border border-gold/60 bg-ivory p-3">
      <WithPathname>
        {(pathname) => (
          <ul className="scrollbar-none flex gap-1 overflow-x-auto lg:flex-col">
            {links.map(({ href, label, icon: Icon, exact }) => {
              const active =
                pathname !== null && (exact ? pathname === href : pathname.startsWith(href));
              return (
                <li key={href} className="shrink-0">
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-full px-4 py-2.5 font-display text-[16px] whitespace-nowrap transition-colors',
                      active ? 'bg-ink text-white' : 'text-text hover:bg-sand hover:text-gold-dark',
                    )}
                  >
                    <Icon aria-hidden size={18} />
                    {label}
                  </Link>
                </li>
              );
            })}
            <li className="shrink-0 lg:mt-2 lg:border-t lg:border-gold/40 lg:pt-2">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 font-display text-[16px] whitespace-nowrap text-muted transition-colors hover:bg-sand hover:text-ink"
                >
                  <LogOut aria-hidden size={18} />
                  Sign out
                </button>
              </form>
            </li>
          </ul>
        )}
      </WithPathname>
    </nav>
  );
}
