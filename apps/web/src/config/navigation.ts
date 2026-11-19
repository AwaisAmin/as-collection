import type { Route } from 'next';

import { categories, type CategorySlug } from './catalog';
import { occasionHref, occasions } from './occasions';

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

/** Quick links under each category in the Shop mega menu (search within the category). */
const categoryLinks: Record<CategorySlug, readonly { label: string; q: string }[]> = {
  unstitched: [
    { label: 'Lawn', q: 'lawn' },
    { label: 'Chiffon', q: 'chiffon' },
    { label: 'Organza', q: 'organza' },
    { label: 'Velvet', q: 'velvet' },
  ],
  stitched: [
    { label: 'Kurtas', q: 'kurta' },
    { label: 'Frocks', q: 'frock' },
    { label: 'Maxis', q: 'maxi' },
    { label: 'Shirts', q: 'shirt' },
  ],
  makeup: [
    { label: 'Lipstick', q: 'lipstick' },
    { label: 'Foundation', q: 'foundation' },
    { label: 'Powder & compact', q: 'powder' },
    { label: 'Brushes & tools', q: 'brush' },
  ],
};

export interface MegaMenuColumn extends NavLink {
  links: readonly NavLink[];
}

/** Desktop Shop mega menu: one column per category, occasions, and highlight links. */
export const shopMegaMenu = {
  columns: categories.map((c): MegaMenuColumn => ({
    label: c.name,
    href: c.href,
    links: categoryLinks[c.slug].map(({ label, q }) => ({
      label,
      href: `${c.href}?q=${encodeURIComponent(q)}` as Route,
    })),
  })),
  occasions: occasions.map((o): NavLink => ({ label: o.name, href: occasionHref(o.slug) })),
  highlights: [
    { label: 'New Arrivals', href: '/shop?sort=newest' as Route },
    { label: 'Best Sellers', href: '/shop?sort=rating' as Route },
    { label: 'On Sale', href: '/shop?sale=1' as Route },
    { label: 'All Products', href: '/shop' },
  ] satisfies NavLink[],
} as const;

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
