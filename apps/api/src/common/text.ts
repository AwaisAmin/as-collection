import { z } from 'zod';

// Control characters except tab (\t) and line feed (\n); also zero-width/bidi overrides that can
// disguise text in the admin inbox.
const UNSAFE_RANGES: readonly (readonly [number, number])[] = [
  [0x00, 0x08],
  [0x0b, 0x1f],
  [0x7f, 0x7f],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
];
// None of these code points is special inside a character class, so no escaping is needed.
const UNSAFE_CHARS = new RegExp(
  `[${UNSAFE_RANGES.map(([from, to]) => `${String.fromCharCode(from)}-${String.fromCharCode(to)}`).join('')}]`,
  'g',
);

/**
 * Normalises user-written text: NFC, CRLF → LF, unsafe invisible characters removed, trailing
 * spaces trimmed per line, at most one blank line in a row, trimmed. Rendering stays the
 * frontend's job (React escapes); this only keeps stored text clean and honest about its length.
 */
export function cleanText(input: string, { multiline = false } = {}): string {
  let text = input.normalize('NFC').replace(/\r\n?/g, '\n').replace(UNSAFE_CHARS, '');
  if (!multiline) return text.replace(/\s+/g, ' ').trim();
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

interface TextOptions {
  min?: number;
  max: number;
  multiline?: boolean;
  /** Message when shorter than `min` (after cleaning). */
  tooShort?: string;
  tooLong?: string;
}

/** Zod string that is cleaned first, then length-checked (so padding cannot satisfy `min`). */
export const plainText = ({ min = 0, max, multiline = false, tooShort, tooLong }: TextOptions) =>
  z
    .string()
    .max(max * 4) // cheap bound before normalising very large input
    .transform((v) => cleanText(v, { multiline }))
    .pipe(
      z
        .string()
        .min(min, tooShort ?? `Must be at least ${String(min)} characters.`)
        .max(max, tooLong ?? `Must be at most ${String(max)} characters.`),
    );

/** Optional text: missing, null or blank (after cleaning) → `undefined`. */
export const optionalPlainText = (options: TextOptions) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v == null ? undefined : cleanText(v, options)))
    .pipe(
      z
        .string()
        .max(options.max, options.tooLong ?? `Must be at most ${String(options.max)} characters.`)
        .optional()
        .transform((v) => (v === '' ? undefined : v)),
    );
