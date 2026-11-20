'use client';

import { ArrowRight, ChevronDown } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useRef } from 'react';

import { Container } from '@/components/ui/container';
import { images } from '@/config/assets';
import type { NavLink } from '@/config/navigation';
import { activePromotion } from '@/config/promotions';
import { useStoreContent } from '@/features/content/components/store-content-provider';
import { useClickOutside } from '@/hooks/use-click-outside';
import { useDisclosure } from '@/hooks/use-disclosure';
import { useEscapeKey } from '@/hooks/use-escape-key';
import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/utils/cn';

import { navLinkClasses } from './nav-link-classes';

/** Delay before closing on mouse-leave, so crossing the gap to the panel doesn't close it. */
const CLOSE_DELAY_MS = 180;

const linkClasses =
  'block py-1.5 font-body text-[17px] text-muted transition-colors duration-200 hover:text-gold-dark';
const headingClasses = 'font-caps text-[12px] tracking-[0.22em] text-gold-dark uppercase';

function LinkList({ links, onNavigate }: { links: readonly NavLink[]; onNavigate: () => void }) {
  return (
    <ul>
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href} onClick={onNavigate} className={linkClasses}>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Promo card: the live campaign until it ends, otherwise New Arrivals. */
function FeatureCard({ onNavigate }: { onNavigate: () => void }) {
  const now = useNow();
  const promo =
    activePromotion && (now === null || now < Date.parse(activePromotion.endsAt))
      ? activePromotion
      : null;

  const card = promo
    ? {
        href: promo.cta.href,
        image: promo.image,
        eyebrow: promo.eyebrow,
        title: promo.title,
        text: promo.highlight,
        cta: promo.cta.label,
      }
    : {
        href: '/shop?sort=newest' as Route,
        image: images.heroModel,
        eyebrow: 'Just landed',
        title: 'New Arrivals',
        text: 'Fresh festive edits',
        cta: 'Shop new in',
      };

  return (
    <Link
      href={card.href}
      onClick={onNavigate}
      className="group relative flex min-h-65 overflow-hidden rounded-card border border-gold/70 bg-ink"
    >
      <Image
        src={card.image.src}
        alt=""
        fill
        sizes="300px"
        className="object-cover opacity-80 transition-transform duration-700 ease-elegant group-hover:scale-105"
      />
      <span
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-ink via-ink/50 to-transparent"
      />
      <span className="relative mt-auto flex flex-col gap-1 p-5 text-white">
        <span className="font-caps text-[11px] tracking-[0.25em] text-gold-light uppercase">
          {card.eyebrow}
        </span>
        <span className="font-display text-[26px]/tight">{card.title}</span>
        <span className="font-script text-[26px]/tight text-gold-light">{card.text}</span>
        <span className="mt-2 inline-flex items-center gap-1.5 font-display text-[15px]">
          {card.cta}
          <ArrowRight
            aria-hidden
            size={15}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </span>
      </span>
    </Link>
  );
}

/**
 * Desktop "Shop" mega menu (disclosure pattern). Opens on hover or click / Enter; Escape,
 * clicking outside or tabbing away closes it. The panel spans the header (positioned against
 * the `relative` <header>), not the trigger.
 */
export function ShopMegaMenu({ label, active }: { label: string; active: boolean }) {
  const shopMegaMenu = useStoreContent().menus.shopMega;
  const { isOpen, open, close, toggle } = useDisclosure();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const panelId = useId();

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(close, CLOSE_DELAY_MS);
  };
  useEffect(() => cancelClose, []);

  useClickOutside(rootRef, close, isOpen);
  useEscapeKey(() => {
    close();
    buttonRef.current?.focus();
  }, isOpen);

  const navigate = () => {
    cancelClose();
    close();
  };

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => {
        cancelClose();
        open();
      }}
      onMouseLeave={scheduleClose}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={toggle}
        className={navLinkClasses(active)}
      >
        {label}
        <ChevronDown
          aria-hidden
          size={16}
          strokeWidth={2.25}
          className={cn('transition-transform duration-200', isOpen && 'rotate-180')}
        />
      </button>

      <div
        id={panelId}
        hidden={!isOpen}
        className="absolute inset-x-0 top-full z-40 animate-fade-in border-y border-gold bg-ivory shadow-card-hover"
      >
        <Container className="grid grid-cols-[1fr_1fr_1fr_1fr_1.3fr] gap-8 py-8 xl:gap-10">
          {shopMegaMenu.columns.map((column) => (
            <div key={column.href} className="flex flex-col gap-3">
              <Link
                href={column.href}
                onClick={navigate}
                className="font-display text-[19px]/tight text-ink transition-colors hover:text-gold-dark"
              >
                {column.label}
              </Link>
              <LinkList links={column.links} onNavigate={navigate} />
              <Link
                href={column.href}
                onClick={navigate}
                className="mt-1 inline-flex items-center gap-1.5 font-body text-[16px] font-semibold text-gold-dark underline-offset-4 hover:underline"
              >
                Shop all
                <span className="sr-only"> {column.label}</span>
                <ArrowRight aria-hidden size={14} />
              </Link>
            </div>
          ))}

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p className={headingClasses}>Shop by occasion</p>
              <LinkList links={shopMegaMenu.occasions} onNavigate={navigate} />
            </div>
            <div className="flex flex-col gap-2">
              <p className={headingClasses}>Highlights</p>
              <LinkList links={shopMegaMenu.highlights} onNavigate={navigate} />
            </div>
          </div>

          <FeatureCard onNavigate={navigate} />
        </Container>
      </div>
    </div>
  );
}
