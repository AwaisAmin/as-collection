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
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

/** In-memory storage for tests. */
export class MemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

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
}
