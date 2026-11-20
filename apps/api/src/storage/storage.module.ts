import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../app.module.js';
import { OBJECT_STORAGE } from './object-storage.js';
import { S3ObjectStorage } from './s3-object-storage.js';

/** Global object storage (`@Inject(OBJECT_STORAGE)`). */
@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: AppConfig) =>
        new S3ObjectStorage({
          NODE_ENV: config.get('NODE_ENV', { infer: true }),
          S3_ENDPOINT: config.get('S3_ENDPOINT', { infer: true }),
          S3_PUBLIC_ENDPOINT: config.get('S3_PUBLIC_ENDPOINT', { infer: true }),
          S3_REGION: config.get('S3_REGION', { infer: true }),
          S3_ACCESS_KEY_ID: config.get('S3_ACCESS_KEY_ID', { infer: true }),
          S3_SECRET_ACCESS_KEY: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
          S3_FORCE_PATH_STYLE: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
          S3_PRIVATE_BUCKET: config.get('S3_PRIVATE_BUCKET', { infer: true }),
        }),
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
