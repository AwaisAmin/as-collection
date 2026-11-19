import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestNodeApplication } from '@nestjs/platform-node';

import { AppModule } from './app.module.js';
import { configureApp, GLOBAL_PREFIX } from './bootstrap/configure-app.js';
import { createHttpAdapter } from './bootstrap/http-adapter.js';
import { createLogger } from './common/logging/create-logger.js';
import { loadEnvFiles, parseEnv } from './config/env.js';

async function bootstrap(): Promise<void> {
  loadEnvFiles();
  const env = parseEnv(process.env); // fail fast, listing every invalid variable
  const logger = createLogger(env);

  const app = await NestFactory.create<NestNodeApplication>(
    AppModule.forRoot(env),
    createHttpAdapter(env),
    { logger, bufferLogs: true },
  );
  configureApp(app, env);

  // Keep-alive longer than typical load balancers (60 s) avoids 502s on reused connections.
  const server = app.getHttpServer();
  server.keepAliveTimeout = 72_000;
  server.headersTimeout = 75_000;
  server.requestTimeout = 30_000;

  await app.listen(env.PORT, env.HOST);
  const url = `http://localhost:${env.PORT}/${GLOBAL_PREFIX}`;
  Logger.log(`API ready on ${url}${env.SWAGGER_ENABLED ? ` · docs ${url}/docs` : ''}`, 'Bootstrap');
}

try {
  await bootstrap();
} catch (error) {
  // The Nest logger may not exist yet (e.g. invalid environment) — write to stderr directly.
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
}
