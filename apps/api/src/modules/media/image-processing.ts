import sharp, { type Metadata } from 'sharp';

/** Widths of the responsive copies (only those smaller than the image itself are made). */
export const VARIANT_WIDTHS = [320, 640, 960, 1280, 1920] as const;
/** The stored "full" image fits in this square; larger uploads are scaled down. */
export const MAX_DIMENSION = 2560;
export const MIN_DIMENSION = 64;
/** Decompression-bomb guard: refuse anything above ~50 megapixels before decoding it. */
const MAX_INPUT_PIXELS = 50_000_000;

export interface EncodedImage {
  body: Buffer;
  width: number;
  height: number;
}

export interface ProcessedImage {
  full: EncodedImage;
  /** Ascending width, all smaller than `full`. */
  variants: (EncodedImage & { width: number })[];
}

export class ImageRejectedError extends Error {}

/**
 * Re-encodes an upload as WebP: applies the EXIF orientation, converts to sRGB and drops every
 * piece of metadata (GPS position, camera serials, embedded thumbnails). Re-encoding also means
 * a crafted "polyglot" file never reaches the bucket byte-for-byte.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const source = sharp(input, {
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: 'error',
    animated: false,
  }).autoOrient();

  let metadata: Metadata;
  try {
    metadata = await source.metadata();
  } catch {
    throw new ImageRejectedError('The image could not be read. It may be damaged or too large.');
  }
  const swap = (metadata.orientation ?? 1) >= 5; // 90° rotations swap the sides
  const width = swap ? metadata.height : metadata.width;
  const height = swap ? metadata.width : metadata.height;
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    throw new ImageRejectedError(
      `The image must be at least ${String(MIN_DIMENSION)}×${String(MIN_DIMENSION)} pixels.`,
    );
  }

  const encode = async (maxWidth: number, maxHeight: number, quality: number) => {
    try {
      const { data, info } = await source
        .clone()
        .resize({ width: maxWidth, height: maxHeight, fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 4, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });
      return { body: data, width: info.width, height: info.height };
    } catch {
      throw new ImageRejectedError('The image could not be processed. Try exporting it again.');
    }
  };

  const full = await encode(MAX_DIMENSION, MAX_DIMENSION, 86);
  const variants: EncodedImage[] = [];
  for (const variantWidth of VARIANT_WIDTHS) {
    if (variantWidth >= full.width) break;
    variants.push(await encode(variantWidth, MAX_DIMENSION * 4, 80));
  }
  return { full, variants };
}
