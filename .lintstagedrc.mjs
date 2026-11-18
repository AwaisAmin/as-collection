import path from 'node:path';

const webDir = path.resolve('apps/web');
const quote = (files) => files.map((f) => `"${f}"`).join(' ');

/**
 * Order matters: ESLint --fix first (may reorder imports), Prettier last (final formatting).
 */
export default {
  'apps/web/**/*.{ts,tsx,mjs}': (files) => [
    `pnpm --dir "${webDir}" exec eslint --fix --max-warnings=0 ${quote(files)}`,
    `prettier --write ${quote(files)}`,
  ],
  '!(apps/web/**)*.{js,mjs,cjs,ts,tsx}': 'prettier --write',
  '*.{json,css,md,yml,yaml}': 'prettier --write',
};
