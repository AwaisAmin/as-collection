'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { SaveState } from '@/lib/action-state';
import { adminCall, saveFailure } from '@/lib/api/admin-call';

/*
 * Store settings. Each is validated by the API with the same rules the shop and checkout read it
 * with; saving refreshes the shop at once (a new delivery fee applies to the next checkout).
 */

const keySchema = z.enum([
  'store.profile',
  'store.contact',
  'store.socials',
  'shipping',
  'payments.transfer-accounts',
  'home.trust-features',
  'announcements',
]);

const MAX_VALUE_CHARS = 50_000;

export async function saveSetting(
  rawKey: string,
  updatedAt: string | null,
  value: unknown,
): Promise<SaveState> {
  const key = keySchema.safeParse(rawKey);
  if (!key.success) return { error: 'Unknown setting.', at: Date.now() };
  if (JSON.stringify(value).length > MAX_VALUE_CHARS) {
    return { error: 'That is too much to save at once.', at: Date.now() };
  }
  try {
    await adminCall(`/admin/settings/${key.data}`, {
      method: 'PUT',
      body: { value, updatedAt },
    });
  } catch (error) {
    const failure = saveFailure(error);
    if (failure.errors) {
      // `value.fields.0.value` → `fields.0.value` (paths inside this setting).
      failure.errors = Object.fromEntries(
        Object.entries(failure.errors).map(([path, message]) => [
          path.replace(/^value\.?/, ''),
          message,
        ]),
      );
    }
    return failure;
  }
  revalidatePath('/settings');
  return { done: 'Saved. The shop shows it within a moment.', at: Date.now() };
}
