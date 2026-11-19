import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';

import type { Env } from '../config/env.js';
import type { ObjectStorage } from './object-storage.js';

type StorageEnv = Pick<
  Env,
  | 'NODE_ENV'
  | 'S3_ENDPOINT'
  | 'S3_REGION'
  | 'S3_ACCESS_KEY_ID'
  | 'S3_SECRET_ACCESS_KEY'
  | 'S3_FORCE_PATH_STYLE'
  | 'S3_PRIVATE_BUCKET'
>;

/**
 * S3 implementation. Objects are written without any public ACL; the private bucket must never
 * have a public policy. Outside production the bucket is created on startup for convenience;
 * production buckets are provisioned by infrastructure.
 */
export class S3ObjectStorage implements ObjectStorage, OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Storage');
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly env: StorageEnv) {
    this.bucket = env.S3_PRIVATE_BUCKET;
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials:
        env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
          : undefined,
      maxAttempts: 3,
      requestHandler: { connectionTimeout: 3_000, requestTimeout: 15_000 },
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.env.NODE_ENV === 'production') return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created bucket ${this.bucket}`);
        return;
      }
      // Storage down in development: uploads fail with 503, everything else keeps working.
      this.logger.warn(
        `Storage unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  onApplicationShutdown(): void {
    this.client.destroy();
  }

  async putPrivate({
    key,
    body,
    contentType,
  }: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
        // Never rendered inline by a browser, even if someone obtains a URL.
        ContentDisposition: 'attachment',
        CacheControl: 'private, no-store',
      }),
    );
  }

  async deletePrivate(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
