import { existsSync } from 'node:fs';

import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env itself; Node's built-in loader keeps real env vars untouched.
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/seed.ts',
  },
  datasource: {
    // `generate` must work without a database (CI, Docker build), so no `env()` (it throws).
    url: process.env.DATABASE_URL ?? '',
  },
});
