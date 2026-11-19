'use client';

import { FaWhatsapp } from 'react-icons/fa6';

import { WithPathname } from '@/components/routing/with-pathname';
import { siteConfig } from '@/config/site';

/** Pre-filled chat message — on a product page it carries the product link. */
export function whatsappMessage(pathname: string | null): string {
  if (pathname?.startsWith('/products/')) {
    return `Hi ${siteConfig.name}! I'm interested in this product: ${siteConfig.url}${pathname}`;
  }
  return `Hi ${siteConfig.name}! I have a question.`;
}

export function whatsappChatHref(pathname: string | null): string {
  return `${siteConfig.contact.whatsappHref}?text=${encodeURIComponent(whatsappMessage(pathname))}`;
}

/**
 * Floating "Chat with us" button, bottom-right on every storefront page. Sits below drawers and
 * dialogs (z-40 vs z-50); the label slides out on hover / focus on larger screens.
 */
export function WhatsAppButton() {
  return (
    <aside aria-label="Chat support">
      <WithPathname>
        {(pathname) => (
          <a
            href={whatsappChatHref(pathname)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with us on WhatsApp (opens in a new tab)"
            className="group fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex h-14 animate-fade-in items-center rounded-full border-[1.5px] border-gold bg-ink pr-3.75 pl-3.75 text-white shadow-gold-glow transition-all duration-300 ease-elegant hover:-translate-y-0.5 sm:right-6 sm:bottom-6 print:hidden"
          >
            <FaWhatsapp aria-hidden className="size-6.25 shrink-0 text-[#25D366]" />
            <span
              aria-hidden
              className="max-w-0 overflow-hidden font-display text-[16px] whitespace-nowrap transition-all duration-300 ease-elegant group-hover:ml-2.5 group-hover:max-w-40 group-focus-visible:ml-2.5 group-focus-visible:max-w-40"
            >
              Chat with us
            </span>
          </a>
        )}
      </WithPathname>
    </aside>
  );
}
