import type { Route } from 'next';

import { categories } from './catalog';

export interface NavLink {
  label: string;
  href: Route;
}

export interface NavItem extends NavLink {
  /** Optional dropdown items. */
  children?: readonly NavLink[];
}

export const mainNav: readonly NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'Shop',
    href: '/shop',
    children: [
      { label: 'All Products', href: '/shop' },
      ...categories.map(({ name, href }) => ({ label: name, href })),
    ],
  },
  { label: 'About Us', href: '/about' },
  { label: 'Contact Us', href: '/contact' },
];

export const footerNav: readonly NavLink[] = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms & Conditions', href: '/terms' },
  { label: 'Contact Us', href: '/contact' },
];

/** Whether `href` should be considered active for the current `pathname`. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
