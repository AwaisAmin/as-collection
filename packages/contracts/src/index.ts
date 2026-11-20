/*
 * Response shapes of the public API — the single source of truth for both the NestJS API (which
 * returns them) and the storefront's typed client (which reads them). Types only: nothing here
 * exists at runtime, so neither app bundles this package.
 *
 * Conventions: money is integer minor units (paisa, `…Minor`); dates are ISO strings; enums are
 * the database's UPPERCASE values unless noted.
 */
export type * from './catalog.js';
export type * from './engagement.js';
export type * from './account.js';
export type * from './orders.js';
