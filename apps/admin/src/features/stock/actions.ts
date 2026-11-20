'use server';

import type { StockAdjustResultDto } from '@as/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ActionState } from '@/lib/action-state';
import { adminCall as call } from '@/lib/api/admin-call';
import { ApiError } from '@/lib/api/http-client';

import { MANUAL_REASONS } from './labels';

/*
 * Stock changes. Every change is ledgered by the API with the reason and who made it; stock can
 * never drop below what open orders hold (unless backorders are allowed).
 */

const idSchema = z.uuid();
const reasonSchema = z.enum(MANUAL_REASONS);
const MAX_UNITS = 1_000_000;

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

/** A whole number of units, or null. */
function units(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || !/^\s*\d+\s*$/.test(value)) return null;
  const n = Number(value);
  return n <= MAX_UNITS ? n : null;
}

function failure(error: unknown): ActionState {
  const at = Date.now();
  if (error instanceof ApiError) {
    if (error.status === 422) {
      return { error: error.problem?.errors?.[0]?.message ?? error.message, at };
    }
    if (error.status === 403) return { error: 'Your role does not allow stock changes.', at };
    if (error.status >= 400 && error.status < 500) return { error: error.message, at };
  }
  return { error: 'Could not save right now. Please try again.', at };
}

function refresh(variantId?: string) {
  revalidatePath('/stock');
  revalidatePath('/products', 'layout');
  revalidatePath('/');
  if (variantId) revalidatePath(`/stock/${variantId}`);
}

/** One variant: add, remove or set a count, with a reason. */
export async function adjustStock(
  rawVariantId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const variantId = idSchema.safeParse(rawVariantId);
  if (!variantId.success) return { error: 'Unknown variant.', at: Date.now() };
  const mode = formData.get('mode');
  const amount = units(formData.get('amount'));
  const reason = reasonSchema.safeParse(formData.get('reason'));
  const fieldErrors: Record<string, string> = {};
  if (amount === null || (mode !== 'set' && amount === 0)) {
    fieldErrors.amount = mode === 'set' ? 'Enter the count, e.g. 12.' : 'Enter how many units.';
  }
  if (!reason.success) fieldErrors.reason = 'Choose a reason.';
  if (amount === null || !reason.success || Object.keys(fieldErrors).length) {
    return { fieldErrors, at: Date.now() };
  }
  const item =
    mode === 'set'
      ? { variantId: variantId.data, set: amount }
      : { variantId: variantId.data, add: mode === 'remove' ? -amount : amount };
  let result: StockAdjustResultDto;
  try {
    result = await call<StockAdjustResultDto>('/admin/inventory/adjustments', {
      method: 'POST',
      body: {
        reason: reason.data,
        note: text(formData, 'note'),
        reference: text(formData, 'reference'),
        items: [item],
      },
    });
  } catch (error) {
    return failure(error);
  }
  refresh(variantId.data);
  const changed = result.changed[0];
  if (!changed) return { done: 'Nothing changed: that is already the count.', at: Date.now() };
  const sign = changed.delta > 0 ? '+' : '';
  return {
    done: `${changed.sku}: ${String(changed.onHand)} in stock (${sign}${String(changed.delta)}).`,
    at: Date.now(),
  };
}

/** Alert level, tracking and backorders of one variant. */
export async function saveStockSettings(
  rawVariantId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const variantId = idSchema.safeParse(rawVariantId);
  if (!variantId.success) return { error: 'Unknown variant.', at: Date.now() };
  const threshold = units(formData.get('lowStockThreshold'));
  if (threshold === null || threshold > 100_000) {
    return { fieldErrors: { lowStockThreshold: 'Enter a whole number, e.g. 3.' }, at: Date.now() };
  }
  try {
    await call(`/admin/inventory/${variantId.data}`, {
      method: 'PATCH',
      body: {
        lowStockThreshold: threshold,
        trackInventory: formData.get('trackInventory') === 'on',
        allowBackorder: formData.get('allowBackorder') === 'on',
      },
    });
  } catch (error) {
    return failure(error);
  }
  refresh(variantId.data);
  return { done: 'Stock settings saved.', at: Date.now() };
}

/**
 * A stock count of the rows on screen: every `count.<variantId>` that differs from its
 * `was.<variantId>` becomes a `set`. All lines are applied, or none.
 */
export async function saveStockCounts(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const reason = reasonSchema.safeParse(formData.get('reason'));
  if (!reason.success) return { error: 'Choose a reason for the counts.', at: Date.now() };
  const items: { variantId: string; set: number }[] = [];
  const fieldErrors: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith('count.')) continue;
    const variantId = name.slice('count.'.length);
    if (!idSchema.safeParse(variantId).success) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    const count = units(value);
    if (count === null) {
      fieldErrors[variantId] = 'Whole units only.';
      continue;
    }
    if (count !== units(formData.get(`was.${variantId}`))) items.push({ variantId, set: count });
  }
  if (Object.keys(fieldErrors).length) {
    return { error: 'Some counts are not whole numbers.', fieldErrors, at: Date.now() };
  }
  if (!items.length) return { error: 'No count was changed.', at: Date.now() };
  if (items.length > 500) return { error: 'Save at most 500 counts at once.', at: Date.now() };
  let result: StockAdjustResultDto;
  try {
    result = await call<StockAdjustResultDto>('/admin/inventory/adjustments', {
      method: 'POST',
      body: { reason: reason.data, note: text(formData, 'note'), items },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      // The messages name the SKU; show each next to its row as well.
      for (const problem of error.problem?.errors ?? []) {
        const line = items[Number(problem.path.split('.')[1])];
        if (line) fieldErrors[line.variantId] = problem.message;
      }
      return { error: 'Nothing was saved. Fix the marked rows.', fieldErrors, at: Date.now() };
    }
    return failure(error);
  }
  refresh();
  const n = result.changed.length;
  return { done: `Saved ${String(n)} ${n === 1 ? 'count' : 'counts'}.`, at: Date.now() };
}
