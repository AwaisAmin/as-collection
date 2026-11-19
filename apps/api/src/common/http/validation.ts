import { StandardSchemaValidationPipe } from '@nestjs/common';

import { type FieldError, ValidationFailedException } from './problem-details.js';

type IssuePath = readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined;

/** `['items', 0, { key: 'qty' }]` → `items.0.qty`. */
export function formatIssuePath(path: IssuePath): string {
  if (!path || path.length === 0) return '(root)';
  return path
    .map((segment) => (typeof segment === 'object' ? segment.key : segment))
    .map((key) => (typeof key === 'symbol' ? (key.description ?? '') : String(key)))
    .join('.');
}

/**
 * Global validation: any `@Body({ schema })`, `@Query({ schema })` or `@Param(name, { schema })`
 * is checked against its Zod schema (Standard Schema). Failures become 422 Problem Details with
 * one entry per invalid field; parameters without a schema pass through untouched.
 */
export function createValidationPipe(): StandardSchemaValidationPipe {
  return new StandardSchemaValidationPipe({
    exceptionFactory: (issues) =>
      new ValidationFailedException(
        issues.map((issue): FieldError => ({
          path: formatIssuePath(issue.path),
          message: issue.message,
        })),
      ),
  });
}
