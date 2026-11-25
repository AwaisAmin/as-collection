import type { CustomerStatus } from '@as/contracts';
import { z } from 'zod';

import type { BadgeTone } from '@/components/ui/badge';

/*
 * Customer list URL state: `?q=0300…&status=BLOCKED&page=2`. Anything invalid is dropped, so a
 * mistyped link still opens the list.
 */

export const CUSTOMER_STATUS: Record<CustomerStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  BLOCKED: { label: 'Blocked', tone: 'danger' },
};

export const CUSTOMER_PAGE_SIZE = 25;

const first = (value: unknown) => (Array.isArray(value) ? (value[0] as unknown) : value);

const searchSchema = z.object({
  q: z.preprocess(first, z.string().trim().min(1).max(100).optional().catch(undefined)),
  status: z.preprocess(first, z.enum(['ACTIVE', 'BLOCKED']).optional().catch(undefined)),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000).catch(1)),
});

export interface CustomerListQuery {
  q?: string;
  status?: CustomerStatus;
  page: number;
}

export const parseCustomerQuery = (params: Record<string, unknown>): CustomerListQuery =>
  searchSchema.parse(params);

/** `/customers?…` with `change` applied (undefined removes a key; page 1 is left out). */
export function customerListHref(
  query: CustomerListQuery,
  change: Partial<Record<keyof CustomerListQuery, string | number | undefined>>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...change })) {
    if (value === undefined || value === '' || (key === 'page' && value === 1)) continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `/customers?${search}` : '/customers';
}
