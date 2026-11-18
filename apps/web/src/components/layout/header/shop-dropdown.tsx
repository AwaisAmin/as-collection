'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useId, useRef } from 'react';

import type { NavItem } from '@/config/navigation';
import { useClickOutside } from '@/hooks/use-click-outside';
import { useDisclosure } from '@/hooks/use-disclosure';
import { useEscapeKey } from '@/hooks/use-escape-key';
import { cn } from '@/lib/utils/cn';

import { navLinkClasses } from './nav-link-classes';

interface ShopDropdownProps {
  item: NavItem & { children: NonNullable<NavItem['children']> };
  active: boolean;
}

/** Disclosure-style dropdown: opens on hover (pointer) or click/Enter (keyboard). */
export function ShopDropdown({ item, active }: ShopDropdownProps) {
  const { isOpen, open, close, toggle } = useDisclosure();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useClickOutside(rootRef, close, isOpen);
  useEscapeKey(() => {
    close();
    buttonRef.current?.focus();
  }, isOpen);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={open}
      onMouseLeave={close}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={toggle}
        className={navLinkClasses(active)}
      >
        {item.label}
        <ChevronDown
          aria-hidden
          size={16}
          strokeWidth={2.25}
          className={cn('transition-transform duration-200', isOpen && 'rotate-180')}
        />
      </button>

      {/* pt-3 keeps a hover bridge between trigger and panel */}
      <div
        id={menuId}
        hidden={!isOpen}
        className="absolute top-full left-1/2 z-40 -translate-x-1/2 pt-3"
      >
        <ul className="min-w-56 rounded-card border border-gold bg-ivory py-2 shadow-card-hover">
          {item.children.map((child) => (
            <li key={child.label}>
              <Link
                href={child.href}
                onClick={close}
                className="block px-5 py-2.5 font-display text-[16px] text-text transition-colors duration-200 hover:bg-cream hover:text-gold"
              >
                {child.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
