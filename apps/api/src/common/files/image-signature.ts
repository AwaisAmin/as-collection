/** Image types accepted for uploads, keyed by MIME type → file extension. */
export const UPLOAD_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type UploadImageType = keyof typeof UPLOAD_IMAGE_TYPES;

const startsWith = (buffer: Buffer, bytes: readonly number[], offset = 0) =>
  buffer.length >= offset + bytes.length && bytes.every((b, i) => buffer[offset + i] === b);

/**
 * The real type of an image from its magic bytes. Never trust the client's Content-Type or file
 * name: a renamed HTML or SVG file must not be stored as an "image".
 */
export function detectImageType(buffer: Buffer): UploadImageType | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // RIFF....WEBP
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  return null;
}
