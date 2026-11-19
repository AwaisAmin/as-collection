import { defineConfig } from 'vitest/config';

/** End-to-end tests: boot the real app (same bootstrap as production) and call it over HTTP. */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    // Each file boots its own app; keep them sequential so ports and env never clash.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
