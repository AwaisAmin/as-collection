import type { SectionDto, SectionType, TypedSectionDto } from '@as/contracts';

const KNOWN: ReadonlySet<SectionType> = new Set<SectionType>([
  'hero',
  'category-grid',
  'trust-bar',
  'product-carousel',
  'product-tabs',
  'recently-viewed',
  'sale-banner',
  'collection-grid',
  'shop-the-look',
  'testimonials',
  'brand-story',
  'instagram-gallery',
]);

/**
 * Sections this storefront can render and that are still live. The API already validated each
 * section's settings against its type's schema (the contract), and drops scheduled ones outside
 * their window; `endsAt` is re-checked here because pages are cached for a few minutes.
 */
export function liveSections(sections: readonly SectionDto[], now: Date): TypedSectionDto[] {
  return sections.filter(
    (s) => KNOWN.has(s.type as SectionType) && (s.endsAt === null || new Date(s.endsAt) > now),
  ) as TypedSectionDto[];
}
