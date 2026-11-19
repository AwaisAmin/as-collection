import type { NestNodeApplication } from '@nestjs/platform-node';
import request from 'supertest';

import { createTestApp, TRUSTED_ORIGIN } from './helpers/create-test-app.js';

describe('API foundation (e2e)', () => {
  let app: NestNodeApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app } = await createTestApp({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('health', () => {
    it('reports liveness without a version prefix', async () => {
      const res = await http().get('/api/health/live').expect(200);
      expect(res.body).toMatchObject({ status: 'ok' });
    });

    it('reports readiness, including the database', async () => {
      const res = await http().get('/api/health/ready').expect(200);
      expect(res.body.info.memory_heap.status).toBe('up');
      expect(res.body.info.database.status).toBe('up');
    });
  });

  describe('request id', () => {
    it('generates one per request', async () => {
      const res = await http().get('/api/health/live');
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('reuses a safe incoming id and rejects unsafe ones', async () => {
      const safe = await http().get('/api/health/live').set('X-Request-Id', 'next-req-0001');
      expect(safe.headers['x-request-id']).toBe('next-req-0001');
      const unsafe = await http().get('/api/health/live').set('X-Request-Id', 'bad id<script>');
      expect(unsafe.headers['x-request-id']).not.toBe('bad id<script>');
    });
  });

  describe('security headers', () => {
    it('sends Helmet-equivalent headers on every response', async () => {
      const res = await http().get('/api/health/live');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['strict-transport-security']).toContain('max-age=');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS', () => {
    it('allows configured origins with credentials', async () => {
      const res = await http()
        .options('/api/v1/probe')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBe(TRUSTED_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does not allow unknown origins', async () => {
      const res = await http().get('/api/v1/probe').set('Origin', 'https://evil.example');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('CSRF (Fetch Metadata)', () => {
    const body = { email: 'a@b.co', quantity: 1 };

    it('rejects cross-site state-changing requests with a problem body', async () => {
      const res = await http()
        .post('/api/v1/probe')
        .set('Sec-Fetch-Site', 'cross-site')
        .set('Origin', 'https://evil.example')
        .send(body)
        .expect(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('accepts same-site requests from a trusted origin', async () => {
      await http()
        .post('/api/v1/probe')
        .set('Sec-Fetch-Site', 'same-site')
        .set('Origin', TRUSTED_ORIGIN)
        .send(body)
        .expect(201);
    });

    it('accepts server-to-server requests (no browser headers)', async () => {
      await http().post('/api/v1/probe').send(body).expect(201);
    });
  });

  describe('validation', () => {
    it('returns 422 Problem Details with one entry per invalid field', async () => {
      const res = await http()
        .post('/api/v1/probe')
        .send({ email: 'not-an-email', quantity: 0, admin: true })
        .expect(422);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({
        type: 'about:blank',
        status: 422,
        code: 'VALIDATION_FAILED',
        instance: '/api/v1/probe',
      });
      const paths = (res.body.errors as { path: string }[]).map((e) => e.path);
      expect(paths).toEqual(expect.arrayContaining(['email', 'quantity']));
      // strictObject: unknown keys are rejected, never silently accepted
      expect(JSON.stringify(res.body.errors)).toContain('admin');
    });

    it('rejects prototype-pollution payloads', async () => {
      await http()
        .post('/api/v1/probe')
        .set('Content-Type', 'application/json')
        .send('{"email":"a@b.co","quantity":1,"__proto__":{"isAdmin":true}}')
        .expect(400);
    });
  });

  describe('errors', () => {
    it('renders unknown routes as 404 Problem Details with the full path', async () => {
      const res = await http().get('/api/v1/does-not-exist').expect(404);
      expect(res.body).toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
        instance: '/api/v1/does-not-exist',
      });
      expect(res.body.requestId).toBe(res.headers['x-request-id']);
    });

    it('hides internal error details in production', async () => {
      const res = await http().get('/api/v1/probe/crash').expect(500);
      expect(res.body).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
      expect(JSON.stringify(res.body)).not.toContain('hunter2');
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  describe('API docs', () => {
    it('serves the OpenAPI document', async () => {
      const res = await http().get('/api/docs/json').expect(200);
      expect(res.body.openapi).toMatch(/^3\./);
      expect(Object.keys(res.body.paths)).toContain('/api/health/live');
    });
  });
});

describe('rate limiting (e2e)', () => {
  let app: NestNodeApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp({ RATE_LIMIT_MAX: '3', RATE_LIMIT_TTL_MS: '60000' }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 429 with Retry-After once the limit is exceeded', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 3; i++) await request(server).get('/api/v1/probe').expect(200);
    const res = await request(server).get('/api/v1/probe').expect(429);
    expect(res.body).toMatchObject({ status: 429, code: 'RATE_LIMITED' });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('never rate-limits health checks', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 6; i++) await request(server).get('/api/health/live').expect(200);
  });
});

describe('API docs toggle (e2e)', () => {
  it('is off by default in production', async () => {
    const { app } = await createTestApp({ NODE_ENV: 'production' });
    await request(app.getHttpServer()).get('/api/docs/json').expect(404);
    await app.close();
  });
});
