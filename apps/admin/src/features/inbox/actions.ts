'use server';

import type { ContactStatus } from '@as/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ActionState } from '@/lib/action-state';
import { adminCall, saveFailure } from '@/lib/api/admin-call';

/*
 * Inbox changes. The message id and status are bound in the browser, so they are validated here;
 * the API checks the permission again and audits every change.
 */

const idSchema = z.uuid();
const statusSchema = z.enum(['NEW', 'READ', 'ARCHIVED'] satisfies ContactStatus[]);

const DONE: Record<ContactStatus, string> = {
  NEW: 'Marked as unread.',
  READ: 'Moved back to the inbox.',
  ARCHIVED: 'Archived.',
};

async function patch(rawId: string, body: Record<string, unknown>): Promise<ActionState | null> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { error: 'Unknown message.', at: Date.now() };
  try {
    await adminCall(`/admin/inbox/${id.data}`, { method: 'PATCH', body });
  } catch (error) {
    const { error: message, errors, at } = saveFailure(error);
    return errors ? { fieldErrors: errors, at } : { error: message, at };
  }
  revalidatePath('/inbox');
  revalidatePath(`/inbox/${id.data}`);
  return null;
}

export async function setMessageStatus(id: string, rawStatus: string): Promise<ActionState> {
  const status = statusSchema.safeParse(rawStatus);
  if (!status.success) return { error: 'Unknown status.', at: Date.now() };
  return (await patch(id, { status: status.data })) ?? { done: DONE[status.data], at: Date.now() };
}

/** Opening a new message marks it read (silently: no toast). */
export async function markRead(id: string): Promise<void> {
  await patch(id, { status: 'READ' });
}

export async function saveStaffNote(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = formData.get('staffNote');
  const note = typeof raw === 'string' ? raw.trim() : '';
  if (note.length > 2000) {
    return { fieldErrors: { staffNote: 'At most 2,000 characters.' }, at: Date.now() };
  }
  return (
    (await patch(id, { staffNote: note || null })) ?? {
      done: note ? 'Note saved.' : 'Note removed.',
      at: Date.now(),
    }
  );
}
