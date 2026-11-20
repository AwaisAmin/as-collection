/** Private object storage (S3-compatible). Swappable in tests via `OBJECT_STORAGE`. */
export interface ObjectStorage {
  putPrivate(input: { key: string; body: Buffer; contentType: string }): Promise<void>;
  deletePrivate(key: string): Promise<void>;
  /**
   * Short-lived GET URL for a private object (staff viewing a payment screenshot). Signed
   * locally — no network call — and useless after `expiresInSeconds`.
   */
  signedPrivateUrl(
    key: string,
    options: { expiresInSeconds: number; contentType: string },
  ): Promise<string>;
  /**
   * Public, immutable object (keys are never reused), cached forever by browsers and the CDN.
   * Only server-generated images are written here.
   */
  putPublic(input: { key: string; body: Buffer; contentType: string }): Promise<void>;
  /** Deletes public objects; missing keys are ignored. */
  deletePublic(keys: readonly string[]): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

/** In-memory storage for tests. */
export class MemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();
  readonly publicObjects = new Map<string, { body: Buffer; contentType: string }>();

  putPrivate({ key, body, contentType }: { key: string; body: Buffer; contentType: string }) {
    this.objects.set(key, { body, contentType });
    return Promise.resolve();
  }

  deletePrivate(key: string) {
    this.objects.delete(key);
    return Promise.resolve();
  }

  signedPrivateUrl(key: string, { expiresInSeconds }: { expiresInSeconds: number }) {
    return Promise.resolve(
      `memory://private/${encodeURIComponent(key)}?expires=${String(expiresInSeconds)}`,
    );
  }

  putPublic({ key, body, contentType }: { key: string; body: Buffer; contentType: string }) {
    this.publicObjects.set(key, { body, contentType });
    return Promise.resolve();
  }

  deletePublic(keys: readonly string[]) {
    for (const key of keys) this.publicObjects.delete(key);
    return Promise.resolve();
  }
}
