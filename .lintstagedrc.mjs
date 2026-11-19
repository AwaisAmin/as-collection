import path from 'node:path';

const webDir = path.resolve('apps/web');
const apiDir = path.resolve('apps/api');
const quote = (files) => files.map((f) => `"${f}"`).join(' ');

/** ESLint --fix first (may reorder imports), Prettier last (final formatting). */
const eslintThenPrettier = (dir) => (files) => [
  `pnpm --dir "${dir}" exec eslint --fix --max-warnings=0 ${quote(files)}`,
  `prettier --write ${quote(files)}`,
];

export default {
  'apps/web/**/*.{ts,tsx,mjs}': eslintThenPrettier(webDir),
  'apps/api/**/*.{ts,mjs}': eslintThenPrettier(apiDir),
  '!(apps/web/**|apps/api/**)*.{js,mjs,cjs,ts,tsx}': 'prettier --write',
  '*.{json,css,md,yml,yaml}': 'prettier --write',
};
