import { VersioningType } from '@nestjs/common';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { ProblemDetailsFilter } from '../common/http/problem-details.filter.js';
import { REQUEST_ID_HEADER } from '../common/http/request-id.middleware.js';
import { createValidationPipe } from '../common/http/validation.js';
import type { Env } from '../config/env.js';

export const GLOBAL_PREFIX = 'api';

/**
 * Everything that turns a Nest app into *this* API. Shared by `main.ts` and the e2e tests,
 * so tests exercise exactly what production runs.
 *
 * Routes: `/api/v1/...` (URI versioning), `/api/health/*` (version-neutral), `/api/docs`.
 */
export function configureApp(app: NestNodeApplication, env: Env): NestNodeApplication {
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Helmet-equivalent headers (CSP, HSTS, nosniff, frame-ancestors…), built into Nest 12.
  // `upgrade-insecure-requests` only in production: on plain-http localhost it breaks the docs UI.
  app.useSecurityHeaders({
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    ...(env.NODE_ENV === 'production'
      ? {}
      : { contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null } } }),
  });

  // Only known browser origins may call the API with cookies.
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Order-Access-Key',
      REQUEST_ID_HEADER,
    ],
    exposedHeaders: [REQUEST_ID_HEADER, 'Retry-After'],
    maxAge: 600,
  });

  // Rejects cross-site state-changing requests (Fetch Metadata / Origin check).
  app.enableCsrfProtection({ trustedOrigins: env.CORS_ORIGINS });

  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ProblemDetailsFilter(env.NODE_ENV !== 'production'));
  app.enableShutdownHooks();

  if (env.SWAGGER_ENABLED) setupApiDocs(app);
  return app;
}

function setupApiDocs(app: NestNodeApplication): void {
  const config = new DocumentBuilder()
    .setTitle('AS Collection Hub API')
    .setDescription(
      'Storefront and admin API. Errors use RFC 9457 Problem Details (application/problem+json).',
    )
    .setVersion('1')
    .build();

  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config), {
    useGlobalPrefix: true,
    jsonDocumentUrl: 'docs/json',
  });
}
