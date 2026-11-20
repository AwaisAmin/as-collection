import type { SectionDto } from '@as/contracts';
import { describe, expect, it } from 'vitest';

import { defaultHomeSections } from '@/features/home/lib/default-sections';

import { liveSections } from './sections';

const now = new Date('2026-11-20T12:00:00Z');
const section = (id: string, type: string, endsAt: string | null = null): SectionDto => ({
  id,
  type,
  settings: {},
  endsAt,
});

describe('liveSections', () => {
  it('keeps known, unexpired sections in order', () => {
    const result = liveSections(
      [
        section('a', 'hero'),
        section('b', 'marquee'),
        section('c', 'sale-banner', '2026-11-20T11:59:59Z'),
        section('d', 'testimonials', '2026-12-01T00:00:00Z'),
      ],
      now,
    );
    expect(result.map((s) => s.id)).toEqual(['a', 'd']);
  });

  it('keeps the bundled home page design (all twelve section types, unique ids)', () => {
    const ids = defaultHomeSections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(liveSections(defaultHomeSections, now)).toHaveLength(defaultHomeSections.length);
  });
});
