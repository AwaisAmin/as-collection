/*
 * Temporary passwords for new staff and resets: 16 random characters from an alphabet without
 * look-alikes (no 0/O, 1/l/I), in groups of four so they are easy to read out or type.
 * The staff member must replace it at first sign-in.
 */

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function temporaryPassword(random: (n: number) => Uint32Array = randomWords): string {
  // Rejection sampling keeps every character equally likely.
  const limit = Math.floor(2 ** 32 / ALPHABET.length) * ALPHABET.length;
  const chars: string[] = [];
  while (chars.length < 16) {
    for (const value of random(16)) {
      if (value < limit && chars.length < 16) chars.push(ALPHABET[value % ALPHABET.length] ?? '');
    }
  }
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-');
}

function randomWords(n: number): Uint32Array {
  return crypto.getRandomValues(new Uint32Array(n));
}

/** The API's rules, checked before sending (it checks them again). */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < 12) return 'Use at least 12 characters.';
  if (password.length > 128) return 'Use at most 128 characters.';
  if (new Set(password).size < 5) return 'Use a less repetitive password.';
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  if (local.length >= 4 && password.toLowerCase().includes(local)) {
    return 'Do not include the email name in the password.';
  }
  return null;
}
