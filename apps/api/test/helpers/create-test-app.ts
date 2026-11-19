import { Body, Controller, Get, Post } from '@nestjs/common';
import { type NestNodeApplication, NodeAdapter } from '@nestjs/platform-node';
import { Test } from '@nestjs/testing';
import { z } from 'zod';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap/configure-app.js';
import { type Env, loadEnvFiles, parseEnv } from '../../src/config/env.js';

export const TRUSTED_ORIGIN = 'https://shop.example.test';

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
): Promise<{ app: NestNodeApplication; env: Env }> {
  loadEnvFiles(); // DATABASE_URL from apps/api/.env locally; CI sets it directly
  const env = parseEnv({
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: 'test',
    LOG_LEVEL: 'fatal',
    CORS_ORIGINS: TRUSTED_ORIGIN,
    ...overrides,
  });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(env)],
    controllers: [ProbeController],
  }).compile();

  const app = moduleRef.createNestApplication<NestNodeApplication>(new NodeAdapter(), {
    logger: false,
  });
  configureApp(app, env);
  await app.init();
  return { app, env };
}
