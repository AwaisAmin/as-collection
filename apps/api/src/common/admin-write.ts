import { HttpStatus } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { DomainException } from './http/problem-details.js';
import { slugify, uniqueSlug } from './slug.js';

/* Small building blocks shared by the admin (staff) write services. */

export type Tx = Prisma.TransactionClient;

export const conflict = (code: string, detail: string, extensions?: Record<string, unknown>) =>
  new DomainException(
    HttpStatus.CONFLICT,
    code,
    detail,
    extensions ? { extensions: extensions as never } : undefined,
  );

export const notFound = (code: string, detail: string) =>
  new DomainException(HttpStatus.NOT_FOUND, code, detail);

const LOCKABLE = {
  categories: Prisma.raw('categories'),
  attributes: Prisma.raw('attributes'),
  attribute_values: Prisma.raw('attribute_values'),
  brands: Prisma.raw('brands'),
  collections: Prisma.raw('collections'),
  discounts: Prisma.raw('discounts'),
  pages: Prisma.raw('pages'),
  page_sections: Prisma.raw('page_sections'),
  menus: Prisma.raw('menus'),
  reviews: Prisma.raw('reviews'),
  contact_messages: Prisma.raw('contact_messages'),
  customers: Prisma.raw('customers'),
} as const;

/** `SELECT … FOR UPDATE` on one row; false when it does not exist. */
export async function lockRow(tx: Tx, table: keyof typeof LOCKABLE, id: string): Promise<boolean> {
  const locked =
    await tx.$executeRaw`SELECT 1 FROM ${LOCKABLE[table]} WHERE id = ${id}::uuid FOR UPDATE`;
  return locked > 0;
}

/**
 * Optimistic concurrency for edit forms: the client sends the `updatedAt` it loaded; a newer
 * save by someone else means 409 instead of silently overwriting it.
 */
export function assertFresh(current: Date, expected: Date | undefined, what: string): void {
  if (expected && current.getTime() !== expected.getTime()) {
    throw conflict(
      'STALE_UPDATE',
      `Someone else saved this ${what} since you opened it. Reload to see their changes.`,
      { updatedAt: current.toISOString() },
    );
  }
}

/** A free slug for `name` among `taken` (rows whose slug starts with the base). */
export async function freeSlug(
  name: string,
  fallback: string,
  findTaken: (base: string) => Promise<{ slug: string }[]>,
  maxLength = 120,
): Promise<string> {
  const base = slugify(name, maxLength - 4) || fallback;
  const taken = await findTaken(base);
  return uniqueSlug(base, new Set(taken.map((t) => t.slug)), maxLength);
}

/** Positions 0..n-1 in the given order (ids must be the complete sibling set). */
export function sameMembers(ids: readonly string[], expected: readonly string[]): boolean {
  if (ids.length !== expected.length) return false;
  const set = new Set(expected);
  return ids.every((id) => set.has(id)) && new Set(ids).size === ids.length;
}

/** Image fields must point at public library images; returns field errors for those that don't. */
export async function checkImages(
  tx: Tx,
  fields: Record<string, string | null | undefined>,
): Promise<{ path: string; message: string }[]> {
  const ids = Object.values(fields).filter((id): id is string => typeof id === 'string');
  if (!ids.length) return [];
  const found = new Set(
    (
      await tx.media.findMany({
        where: { id: { in: ids }, visibility: 'PUBLIC' },
        select: { id: true },
      })
    ).map((m) => m.id),
  );
  return Object.entries(fields)
    .filter(([, id]) => typeof id === 'string' && !found.has(id))
    .map(([path]) => ({ path, message: 'Unknown image.' }));
}

/** JSON column value: `null` must be written as SQL NULL explicitly. */
export const jsonOrNull = (value: object | null | undefined) =>
  value === undefined
    ? undefined
    : value === null
      ? Prisma.DbNull
      : (value as Prisma.InputJsonValue);

/** Drops null / undefined members (optional JSON fields are omitted, not stored as null). */
export const compact = <T extends object>(value: T | null | undefined) =>
  value
    ? (Object.fromEntries(Object.entries(value).filter(([, v]) => v != null)) as Partial<T>)
    : value;
