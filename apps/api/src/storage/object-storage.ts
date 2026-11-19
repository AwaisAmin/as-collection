/** Private object storage (S3-compatible). Swappable in tests via `OBJECT_STORAGE`. */
export interface ObjectStorage {
  putPrivate(input: { key: string; body: Buffer; contentType: string }): Promise<void>;
  deletePrivate(key: string): Promise<void>;
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
}
