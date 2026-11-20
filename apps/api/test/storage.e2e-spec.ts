import { randomUUID } from 'node:crypto';

import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { loadEnvFiles, parseEnv } from '../src/config/env.js';
import { S3ObjectStorage } from '../src/storage/s3-object-storage.js';

/** Real S3 round trip against the local RustFS (docker compose) or the CI storage service. */
describe('S3 object storage (e2e)', () => {
  loadEnvFiles();
  const env = parseEnv({ ...process.env, NODE_ENV: 'test', S3_PRIVATE_BUCKET: 'as-e2e-private' });
  const storage = new S3ObjectStorage(env);
  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials:
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : undefined,
  });

  beforeAll(async () => {
    await storage.onModuleInit(); // creates the bucket outside production
  });

  afterAll(() => {
    storage.onApplicationShutdown();
    client.destroy();
  });

  it('stores private objects as attachments and deletes them', async () => {
    const key = `e2e/${randomUUID()}.png`;
    const body = Buffer.from('fake-png-bytes');
    await storage.putPrivate({ key, body, contentType: 'image/png' });

    const object = await client.send(new GetObjectCommand({ Bucket: 'as-e2e-private', Key: key }));
    expect(object.ContentType).toBe('image/png');
    expect(object.ContentDisposition).toBe('attachment');
    const bytes = await object.Body?.transformToByteArray();
    expect(bytes && Buffer.from(bytes).equals(body)).toBe(true);

    await storage.deletePrivate(key);
    await expect(
      client.send(new HeadObjectCommand({ Bucket: 'as-e2e-private', Key: key })),
    ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
  });

  it('serves an object through a short-lived signed URL, and nothing else', async () => {
    const key = `e2e/${randomUUID()}.png`;
    const body = Buffer.from('signed-bytes');
    await storage.putPrivate({ key, body, contentType: 'image/png' });
    try {
      const url = await storage.signedPrivateUrl(key, {
        expiresInSeconds: 60,
        contentType: 'image/png',
      });
      const res = await fetch(url);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/png');
      expect(res.headers.get('content-disposition')).toBe('inline');
      expect(Buffer.from(await res.arrayBuffer()).equals(body)).toBe(true);

      // Same signature for another object, or a tampered signature: refused.
      const otherKey = url.replace(key, `e2e/${randomUUID()}.png`);
      expect((await fetch(otherKey)).status).toBe(403);
      const tampered = url.replace(
        /X-Amz-Signature=([0-9a-f])/,
        (_m, c: string) => `X-Amz-Signature=${c === '0' ? '1' : '0'}`,
      );
      expect((await fetch(tampered)).status).toBe(403);
    } finally {
      await storage.deletePrivate(key);
    }
  });

  it('refuses anonymous reads (the bucket is private)', async () => {
    const key = `e2e/${randomUUID()}.png`;
    await storage.putPrivate({ key, body: Buffer.from('secret'), contentType: 'image/png' });
    try {
      const res = await fetch(`${env.S3_ENDPOINT ?? ''}/as-e2e-private/${key}`);
      expect([401, 403]).toContain(res.status);
    } finally {
      await storage.deletePrivate(key);
    }
  });
});
