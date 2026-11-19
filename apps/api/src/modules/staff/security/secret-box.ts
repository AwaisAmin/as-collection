import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for small secrets at rest (staff TOTP seeds). Output: `v1.<iv>.<tag>.<ciphertext>`
 * (base64url). The version prefix leaves room for key rotation; `aad` binds a ciphertext to its
 * row, so a secret copied onto another account fails to decrypt.
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(keyBase64: string) {
    this.key = Buffer.from(keyBase64, 'base64');
    if (this.key.length !== 32) throw new Error('SecretBox key must be 32 bytes');
  }

  seal(plaintext: string, aad: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(aad));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv, tag, ciphertext]
      .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
      .join('.');
  }

  /** Throws if the value was tampered with, sealed for another `aad`, or under another key. */
  open(sealed: string, aad: string): string {
    const [version, iv, tag, ciphertext] = sealed.split('.');
    if (version !== 'v1' || !iv || !tag || ciphertext === undefined) {
      throw new Error('Unsupported sealed value');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
