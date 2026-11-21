'use server';

import type { AdminDiscountDto } from '@as/contracts';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { rupeesToMinor } from '@/features/products/form-model';
import type { ActionState } from '@/lib/action-state';
import { adminCall, saveFailure } from '@/lib/api/admin-call';
import { ApiError } from '@/lib/api/http-client';
import { fromPktInput } from '@/lib/format';

import { percentToBasisPoints } from './labels';

/*
 * Discount codes. The API refuses renaming or deleting codes customers have used, a usage limit
 * below the uses so far, and stale saves; changes affect future checkouts only.
 */

const idSchema = z.uuid();
const typeSchema = z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']);

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

/** Builds the body, or the messages of fields that can't be read. */
function readForm(formData: FormData) {
  const errors: Record<string, string> = {};
  const type = typeSchema.safeParse(field(formData, 'type'));
  if (!type.success) errors.type = 'Choose what the code gives.';
  const code = field(formData, 'code').toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
    errors.code = 'Use 3–40 letters, digits, dashes or underscores.';
  }

  let value = 0;
  if (type.data === 'PERCENTAGE') {
    const bp = percentToBasisPoints(field(formData, 'percent'));
    if (bp === null || Number.isNaN(bp) || bp < 1 || bp > 10_000) {
      errors.value = 'Enter a percentage from 0.01 to 100.';
    } else value = bp;
  } else if (type.data === 'FIXED_AMOUNT') {
    const minor = rupeesToMinor(field(formData, 'amount'));
    if (minor === null || Number.isNaN(minor) || minor < 1) {
      errors.value = 'Enter the amount off in rupees.';
    } else value = minor;
  }

  const money = (name: string, key: string) => {
    const raw = field(formData, name);
    if (!raw) return null;
    const minor = rupeesToMinor(raw);
    if (minor === null || Number.isNaN(minor) || minor < 1) {
      errors[key] = 'Enter an amount in rupees.';
      return null;
    }
    return minor;
  };
  const count = (name: string) => {
    const raw = field(formData, name);
    if (!raw) return null;
    if (!/^\d+$/.test(raw) || Number(raw) < 1) {
      errors[name] = 'Enter a whole number, or leave empty for no limit.';
      return null;
    }
    return Number(raw);
  };
  const time = (name: string) => {
    const raw = field(formData, name);
    if (!raw) return null;
    const iso = fromPktInput(raw);
    if (!iso) errors[name] = 'Enter a full date and time.';
    return iso;
  };

  const startsAt = time('startsAt');
  const endsAt = time('endsAt');
  if (startsAt && endsAt && endsAt <= startsAt) errors.endsAt = 'Must be after the start.';

  const body = {
    code,
    description: field(formData, 'description') || null,
    type: type.data,
    value,
    minSubtotalMinor: money('minSubtotal', 'minSubtotalMinor'),
    maxDiscountMinor: type.data === 'PERCENTAGE' ? money('maxDiscount', 'maxDiscountMinor') : null,
    startsAt,
    endsAt,
    usageLimit: count('usageLimit'),
    perCustomerLimit: count('perCustomerLimit'),
    isActive: formData.get('isActive') === 'on',
  };
  return { body, errors };
}

/** API paths → the form's field names (`minSubtotalMinor` → `minSubtotal` …). */
const FORM_FIELDS: Record<string, string> = {
  minSubtotalMinor: 'minSubtotal',
  maxDiscountMinor: 'maxDiscount',
};

function formErrors(errors: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [FORM_FIELDS[k] ?? k, v]));
}

export async function saveDiscount(
  rawId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = rawId === null ? null : idSchema.safeParse(rawId);
  if (id && !id.success) return { error: 'Unknown discount.', at: Date.now() };
  const { body, errors } = readForm(formData);
  if (Object.keys(errors).length) {
    return {
      error: 'Some fields need attention.',
      fieldErrors: formErrors(errors),
      at: Date.now(),
    };
  }
  let saved: AdminDiscountDto;
  try {
    saved = await (id?.success
      ? adminCall<AdminDiscountDto>(`/admin/discounts/${id.data}`, {
          method: 'PATCH',
          body: { ...body, updatedAt: field(formData, 'updatedAt') },
        })
      : adminCall<AdminDiscountDto>('/admin/discounts', { method: 'POST', body }));
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CODE_TAKEN') {
      return { fieldErrors: { code: error.message }, at: Date.now() };
    }
    if (error instanceof ApiError && error.status === 422) {
      return {
        error: 'Some fields need attention.',
        fieldErrors: formErrors(error.fieldErrors),
        at: Date.now(),
      };
    }
    const failure = saveFailure(error);
    return failure.stale
      ? {
          error: 'Someone else saved this code meanwhile. Reload to see their changes.',
          at: Date.now(),
        }
      : failure;
  }
  revalidatePath('/discounts');
  if (!id) redirect(`/discounts/${saved.id}?created=1` as Route);
  revalidatePath(`/discounts/${saved.id}`);
  return { done: 'Discount saved.', at: Date.now() };
}

export async function deleteDiscount(rawId: string): Promise<ActionState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { error: 'Unknown discount.', at: Date.now() };
  try {
    await adminCall(`/admin/discounts/${id.data}`, { method: 'DELETE' });
  } catch (error) {
    return saveFailure(error);
  }
  revalidatePath('/discounts');
  redirect('/discounts?deleted=1' as Route);
}
