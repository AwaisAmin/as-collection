import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

/*
 * Browser tests of the real storefront against the real API and database (seeded catalog).
 *
 * Needs: Docker services (`pnpm services:up`), migrated + seeded database, and a built API
 * (`pnpm --filter @as/api build`). Playwright then starts the API, builds the storefront against
 * it (pages are prerendered from API data) and starts it. Ports 4100 / 3100 keep clear of the
 * usual dev servers. `E2E_SKIP_WEB_BUILD=1` reuses an existing storefront build.
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const apiEnvFile = `${root}apps/api/.env`;
// Locally the API's .env provides DATABASE_URL etc.; CI sets them in the environment.
if (!process.env.DATABASE_URL && existsSync(apiEnvFile)) process.loadEnvFile(apiEnvFile);

const API_PORT = 4100;
const WEB_PORT = 3100;
const ADMIN_PORT = 3101;
const ADMIN_URL = `http://localhost:${String(ADMIN_PORT)}`;
const WEB_URL = `http://localhost:${String(WEB_PORT)}`;
const API_URL = `http://127.0.0.1:${String(API_PORT)}/api/v1`;

const apiEnv = {
  PORT: String(API_PORT),
  NODE_ENV: 'development',
  JOBS_ENABLED: 'false',
  // Codes come back in the response (development only; the API refuses this in production).
  OTP_CHANNELS: 'log',
  OTP_DEV_ECHO: 'true',
  RATE_LIMIT_MAX: '2000',
  AUTH_RATE_LIMIT_MAX: '2000',
  // Image URLs then point at the storefront under test, which serves the seed images.
  MEDIA_PUBLIC_BASE_URL: WEB_URL,
};

const webEnv = {
  // The API's .env (loaded above) sets NODE_ENV=development; a production build needs its own.
  NODE_ENV: 'production',
  NEXT_PUBLIC_SITE_URL: WEB_URL,
  API_URL,
  MOCK_API: 'false',
  NEXT_TELEMETRY_DISABLED: '1',
};

const adminEnv = {
  NODE_ENV: 'production',
  API_URL,
  STOREFRONT_URL: WEB_URL,
  NEXT_TELEMETRY_DISABLED: '1',
};

const adminCommand = [
  process.env.E2E_SKIP_WEB_BUILD ? null : 'pnpm --filter @as/admin build',
  `pnpm --filter @as/admin exec next start --port ${String(ADMIN_PORT)}`,
]
  .filter(Boolean)
  .join(' && ');

const webCommand = [
  process.env.E2E_SKIP_WEB_BUILD ? null : 'pnpm --filter @as/web build',
  `pnpm --filter @as/web exec next start --port ${String(WEB_PORT)}`,
]
  .filter(Boolean)
  .join(' && ');

export default defineConfig({
  testDir: './tests',
  // Tests share one database and one stock level: run them one after another.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-PK',
    timezoneId: 'Asia/Karachi',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /admin\// },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /browse\.spec\.ts/ },
    {
      name: 'admin',
      use: { ...devices['Desktop Chrome'], baseURL: ADMIN_URL },
      testMatch: /admin\/.*\.spec\.ts/,
    },
  ],
  webServer: [
    {
      name: 'api',
      command: 'node --enable-source-maps dist/main.js',
      cwd: `${root}apps/api`,
      url: `http://127.0.0.1:${String(API_PORT)}/api/health/ready`,
      env: { ...process.env, ...apiEnv } as Record<string, string>,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      name: 'admin',
      command: adminCommand,
      cwd: root,
      url: `${ADMIN_URL}/login`,
      env: { ...process.env, ...adminEnv } as Record<string, string>,
      reuseExistingServer: !process.env.CI,
      timeout: 6 * 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      name: 'web',
      command: webCommand,
      cwd: root,
      url: WEB_URL,
      env: { ...process.env, ...webEnv } as Record<string, string>,
      reuseExistingServer: !process.env.CI,
      timeout: 6 * 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
