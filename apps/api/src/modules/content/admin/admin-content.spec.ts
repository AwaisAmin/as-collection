import { ValidationFailedException } from '../../../common/http/problem-details.js';
import { putMenuSchema } from './admin-content.schemas.js';
import { flattenMenu, parseSectionSettings } from './admin-content.service.js';

describe('parseSectionSettings', () => {
  it('stores settings exactly as the storefront will read them', () => {
    const parsed = parseSectionSettings('testimonials', {
      title: 'Loved by you',
      limit: 6,
      extra: 1,
    });
    expect(parsed).toEqual({ title: 'Loved by you', limit: 6 });
  });

  it('points at the bad setting, and refuses unknown types', () => {
    try {
      parseSectionSettings('brand-story', {
        title: 'Our story',
        script: 'Since 2019',
        image: { src: 'javascript:alert(1)', alt: '' },
        cta: { label: 'Read', href: '//evil.example' },
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationFailedException);
      expect((error as ValidationFailedException).errors.map((e) => e.path)).toEqual([
        'settings.image.src',
        'settings.cta.href',
      ]);
    }
    expect(() => parseSectionSettings('marquee', {})).toThrow(ValidationFailedException);
  });
});

describe('menus', () => {
  const item = (label: string, children: object[] = []) => ({ label, url: '/shop', children });

  it('flattens a tree parents-first with sibling positions', () => {
    const menu = putMenuSchema.parse({
      name: 'Main',
      updatedAt: null,
      items: [item('Shop', [item('Lawn'), item('Silk')]), item('Sale')],
    });
    const rows = flattenMenu('m', menu.items);
    expect(rows.map((r) => [r.label, r.position])).toEqual([
      ['Shop', 0],
      ['Lawn', 0],
      ['Silk', 1],
      ['Sale', 1],
    ]);
    expect(rows[1]?.parentId).toBe(rows[0]?.id);
    expect(rows[3]?.parentId).toBeNull();
  });

  it('refuses unsafe links and trees deeper than three levels', () => {
    expect(
      putMenuSchema.safeParse({
        name: 'Main',
        updatedAt: null,
        items: [{ label: 'X', url: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false);
    expect(
      putMenuSchema.safeParse({
        name: 'Main',
        updatedAt: null,
        items: [item('1', [item('2', [item('3', [item('4')])])])],
      }).success,
    ).toBe(false);
  });
});
