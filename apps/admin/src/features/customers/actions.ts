'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ActionState, SaveState } from '@/lib/action-state';
import { adminCall, parsePayload, saveFailure } from '@/lib/api/admin-call';

/*
 * Customer changes. The id is bound in the browser, so it is validated here; the API checks the
 * permission again, refuses an edit made over someone else's newer one, and audits everything.
 */

const idSchema = z.uuid();

const refresh = (id: string) => {
  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
};

/** Name, marketing consent and the internal note (payload JSON with `updatedAt`). */
export async function updateCustomer(
  rawId: string,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const id = idSchema.safeParse(rawId);
  const body = parsePayload(formData);
  if (!id.success || !body) return { error: 'The form could not be read.', at: Date.now() };
  try {
    await adminCall(`/admin/customers/${id.data}`, { method: 'PATCH', body });
  } catch (error) {
    return saveFailure(error);
  }
  refresh(id.data);
  return { done: 'Customer saved.', at: Date.now() };
}

export async function blockCustomer(
  rawId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { error: 'Unknown customer.', at: Date.now() };
  const raw = formData.get('reason');
  const reason = typeof raw === 'string' ? raw.trim() : '';
  if (reason.length < 3) {
    return {
      fieldErrors: { reason: 'Say why in a few words (only staff see it).' },
      at: Date.now(),
    };
  }
  try {
    const result = await adminCall<{ signedOutSessions: number }>(
      `/admin/customers/${id.data}/block`,
      { method: 'POST', body: { reason } },
    );
    refresh(id.data);
    const n = result.signedOutSessions;
    return {
      done: `Account blocked${n ? `; signed out of ${String(n)} ${n === 1 ? 'device' : 'devices'}` : ''}.`,
      at: Date.now(),
    };
  } catch (error) {
    const { error: message, errors, at } = saveFailure(error);
    return errors ? { fieldErrors: errors, at } : { error: message, at };
  }
}

export async function unblockCustomer(rawId: string): Promise<ActionState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { error: 'Unknown customer.', at: Date.now() };
  try {
    await adminCall(`/admin/customers/${id.data}/unblock`, { method: 'POST' });
  } catch (error) {
    return { error: saveFailure(error).error, at: Date.now() };
  }
  refresh(id.data);
  return { done: 'Account unblocked. They can sign in again.', at: Date.now() };
}
