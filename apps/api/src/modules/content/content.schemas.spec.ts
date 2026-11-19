import { hrefSchema, PUBLIC_SETTINGS, SECTION_SCHEMAS } from './content.schemas.js';
import { buildMenuTree, isLive } from './content.service.js';

describe('hrefSchema', () => {
  it.each([
    '/shop?sale=1',
    '/about',
    'https://wa.me/923001234567',
    'tel:+923001234567',
    'mailto:a@b.pk',
  ])('accepts %s', (href) => {
    expect(hrefSchema.safeParse(href).success).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,hi',
    '//evil.example',
    '/\\evil.example',
    'http://insecure.example',
    'shop',
  ])('rejects %s', (href) => {
    expect(hrefSchema.safeParse(href).success).toBe(false);
  });
});

describe('PUBLIC_SETTINGS', () => {
  it('serves only whitelisted fields', () => {
    const parsed = PUBLIC_SETTINGS.shipping.parse({
      flatFeeMinor: 25_000,
      freeShippingThresholdMinor: 250_000,
      returnWindowDays: 7,
      courierApiKey: 'secret',
    });
    expect(parsed).toEqual({
      flatFeeMinor: 25_000,
      freeShippingThresholdMinor: 250_000,
      returnWindowDays: 7,
    });
  });
});

describe('SECTION_SCHEMAS', () => {
  it('rejects unsafe links inside section settings', () => {
    const story = {
      title: 'Our Story',
      script: 'x',
      image: { src: '/a.jpg', alt: '' },
      cta: { label: 'Read', href: 'javascript:alert(1)' },
    };
    expect(SECTION_SCHEMAS['brand-story'].safeParse(story).success).toBe(false);
  });
});

describe('isLive', () => {
  const now = new Date('2026-11-20T12:00:00Z');

  it('is live inside [startsAt, endsAt)', () => {
    expect(isLive({ startsAt: null, endsAt: null }, now)).toBe(true);
    expect(isLive({ startsAt: '2026-11-20T12:00:00Z', endsAt: null }, now)).toBe(true);
    expect(isLive({ startsAt: '2026-11-21T00:00:00Z', endsAt: null }, now)).toBe(false);
    expect(isLive({ startsAt: null, endsAt: '2026-11-20T12:00:00Z' }, now)).toBe(false);
  });
});

describe('buildMenuTree', () => {
  const row = (id: string, parentId: string | null, url: string | null = '/shop') => ({
    id,
    parentId,
    label: id,
    url,
    openInNewTab: false,
    settings: null,
  });

  it('nests children and drops unsafe items with their subtree', () => {
    const tree = buildMenuTree([
      row('shop', null),
      row('lawn', 'shop'),
      row('bad', null, 'javascript:alert(1)'),
      row('bad-child', 'bad'),
      row('orphan', 'hidden-parent'),
    ]);
    expect(tree.map((i) => [i.id, i.children.map((c) => c.id)])).toEqual([['shop', ['lawn']]]);
  });
});
