import { SLUG_PATTERN, slugify, uniqueSlug } from './slug.js';

describe('slugify', () => {
  it('makes URL-safe slugs that pass the database check', () => {
    const slug = slugify('  Noor-e-Zar Embroidered Lawn (3 Pc) — Ruby Red!  ');
    expect(slug).toBe('noor-e-zar-embroidered-lawn-3-pc-ruby-red');
    expect(SLUG_PATTERN.test(slug)).toBe(true);
    expect(slugify('Crème Brûlée')).toBe('creme-brulee');
  });

  it('returns "" when nothing usable is left, and respects the length limit', () => {
    expect(slugify('لان سوٹ')).toBe('');
    const long = slugify('a '.repeat(200), 20);
    expect(long.length).toBeLessThanOrEqual(20);
    expect(SLUG_PATTERN.test(long)).toBe(true);
  });
});

describe('uniqueSlug', () => {
  it('appends the first free number', () => {
    expect(uniqueSlug('lawn', new Set())).toBe('lawn');
    expect(uniqueSlug('lawn', new Set(['lawn', 'lawn-2']))).toBe('lawn-3');
  });
});
