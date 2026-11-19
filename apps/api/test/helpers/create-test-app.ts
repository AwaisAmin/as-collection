import { Body, Controller, Get, Post } from '@nestjs/common';
import { type NestNodeApplication, NodeAdapter } from '@nestjs/platform-node';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { z } from 'zod';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap/configure-app.js';
import { type Env, loadEnvFiles, parseEnv } from '../../src/config/env.js';

export const TRUSTED_ORIGIN = 'https://shop.example.test';

/** Minimal valid production settings (secrets and an OTP provider are mandatory there). */
export const PRODUCTION_ENV = {
  NODE_ENV: 'production',
  AUTH_SECRET: 'e2e-production-secret-0123456789abcdefghij',
  OTP_CHANNELS: 'sms',
  TWILIO_ACCOUNT_SID: 'AC-e2e',
  TWILIO_AUTH_TOKEN: 'e2e-token',
  TWILIO_FROM: '+15005550006',
} as const;

const probeSchema = z.strictObject({
  email: z.email(),
  quantity: z.number().int().min(1),
});

/** Test-only routes that exercise the global pipeline (never registered in production). */
@Controller('probe')
class ProbeController {
  @Get()
  ok() {
    return { ok: true };
  }

  @Post()
  create(@Body({ schema: probeSchema }) body: z.infer<typeof probeSchema>) {
    return body;
  }

  @Get('crash')
  crash(): never {
    throw new Error('database password is hunter2');
  }
}

/** Boots the real app (same `configureApp` as production) on the Node adapter. */
export async function createTestApp(
  overrides: Record<string, string> = {},
  /** Swap providers, e.g. `(b) => b.overrideProvider(TOKEN).useValue(fake)`. */
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<{ app: NestNodeApplication; env: Env }> {
  loadEnvFiles(); // DATABASE_URL from apps/api/.env locally; CI sets it directly
  const env = parseEnv({
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
    NODE_ENV: 'test',
    LOG_LEVEL: 'fatal',
    CORS_ORIGINS: TRUSTED_ORIGIN,
    ...overrides,
  });

  const moduleRef = await customize(
    Test.createTestingModule({
      imports: [AppModule.forRoot(env)],
      controllers: [ProbeController],
    }),
  ).compile();

  const app = moduleRef.createNestApplication<NestNodeApplication>(new NodeAdapter(), {
    logger: false,
  });
  configureApp(app, env);
  await app.init();
  return { app, env };
}
