import { describe, expect, it } from 'vitest';

import { siteConfig } from '@/config/site';

import { whatsappChatHref, whatsappMessage } from './whatsapp-button';

describe('whatsappMessage', () => {
  it('includes the product link on product pages', () => {
    expect(whatsappMessage('/products/mehr-formal-maxi')).toContain(
      `${siteConfig.url}/products/mehr-formal-maxi`,
    );
  });

  it('uses a generic greeting elsewhere', () => {
    expect(whatsappMessage('/shop')).not.toContain('http');
    expect(whatsappMessage(null)).not.toContain('http');
  });
});

describe('whatsappChatHref', () => {
  it('URL-encodes the message onto the wa.me link', () => {
    const href = whatsappChatHref('/products/a b');
    expect(href.startsWith(`${siteConfig.contact.whatsappHref}?text=`)).toBe(true);
    expect(href).not.toContain(' ');
  });
});
