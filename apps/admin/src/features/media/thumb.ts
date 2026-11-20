import type { AdminMediaDto } from '@as/contracts';

/** The smallest copy at least `width` wide (falls back to the original). */
export function thumbUrl(media: Pick<AdminMediaDto, 'url' | 'variants'>, width = 320): string {
  return media.variants.find((v) => v.width >= width)?.url ?? media.url;
}
