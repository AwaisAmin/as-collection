'use server';

import type { AdminStaffDto, StaffStatus } from '@as/contracts';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import type { ActionState, SaveState } from '@/lib/action-state';
import { adminCall, parsePayload, saveFailure } from '@/lib/api/admin-call';
import { ApiError } from '@/lib/api/http-client';

/*
 * Staff and role changes. Ids come from the browser, so they are validated here. The API is the
 * real guard: nobody can grant access they don't have, change their own access, or remove the
 * last person with full access — its explanation is shown as is.
 */

const idSchema = z.uuid();
const idList = z.array(z.uuid()).max(50);

function failure(error: unknown): ActionState {
  if (error instanceof ApiError && error.status === 403 && error.code !== 'FORBIDDEN') {
    return { error: error.message, at: Date.now() };
  }
  const { error: message, errors, at } = saveFailure(error);
  return errors
    ? { fieldErrors: firstSegment(errors), error: message, at }
    : { error: message, at };
}

const firstSegment = (errors: Record<string, string>) =>
  Object.fromEntries(Object.entries(errors).map(([path, m]) => [path.split('.')[0] ?? path, m]));

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

const refreshStaff = (id?: string) => {
  revalidatePath('/staff');
  if (id) revalidatePath(`/staff/${id}`);
  revalidatePath('/roles');
};

// ─── Staff ───

export async function createStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roleIds = idList.safeParse(formData.getAll('roleIds'));
  if (!roleIds.success) return { error: 'The form could not be read.', at: Date.now() };
  const body = {
    name: text(formData, 'name'),
    email: text(formData, 'email').toLowerCase(),
    password: text(formData, 'password'),
    roleIds: roleIds.data,
  };
  let created: AdminStaffDto;
  try {
    created = await adminCall<AdminStaffDto>('/admin/staff', { method: 'POST', body });
  } catch (error) {
    return failure(error);
  }
  refreshStaff();
  redirect(`/staff/${created.id}?created=1` as Route);
}

/** Name and roles (payload JSON). */
export async function saveStaffDetails(
  rawId: string,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const id = idSchema.safeParse(rawId);
  const body = parsePayload(formData);
  if (!id.success || !body) return { error: 'The form could not be read.', at: Date.now() };
  try {
    await adminCall(`/admin/staff/${id.data}`, { method: 'PATCH', body });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return { error: error.message, at: Date.now() };
    }
    return saveFailure(error);
  }
  refreshStaff(id.data);
  return { done: 'Staff member saved.', at: Date.now() };
}

async function staffCall(
  rawId: string,
  path: string,
  init: { method: 'POST' | 'PATCH'; body?: Record<string, unknown> },
  done: string,
): Promise<ActionState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { error: 'Unknown staff member.', at: Date.now() };
  try {
    await adminCall(`/admin/staff/${id.data}${path}`, init);
  } catch (error) {
    return failure(error);
  }
  refreshStaff(id.data);
  return { done, at: Date.now() };
}

export async function setStaffStatus(id: string, status: StaffStatus): Promise<ActionState> {
  if (status !== 'ACTIVE' && status !== 'DISABLED') return { error: 'Unknown status.' };
  return staffCall(
    id,
    '',
    { method: 'PATCH', body: { status } },
    status === 'DISABLED' ? 'Access turned off; signed out everywhere.' : 'Access turned on.',
  );
}

export async function resetStaffPassword(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return staffCall(
    id,
    '/reset-password',
    { method: 'POST', body: { password: text(formData, 'password') } },
    'Temporary password set; they were signed out everywhere.',
  );
}

export async function resetStaffTotp(id: string): Promise<ActionState> {
  return staffCall(
    id,
    '/reset-2fa',
    { method: 'POST' },
    'Authenticator removed; they set up a new one at next sign-in.',
  );
}

export async function unlockStaff(id: string): Promise<ActionState> {
  return staffCall(id, '/unlock', { method: 'POST' }, 'Unlocked; they can sign in again.');
}

export async function signOutStaff(id: string): Promise<ActionState> {
  return staffCall(id, '/revoke-sessions', { method: 'POST' }, 'Signed out on every device.');
}

// ─── Roles ───

export async function createRole(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const body = parsePayload(formData);
  if (!body) return { error: 'The form could not be read.', at: Date.now() };
  let role: { id: string };
  try {
    role = await adminCall<{ id: string }>('/admin/roles', { method: 'POST', body });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return { error: error.message, at: Date.now() };
    }
    return saveFailure(error);
  }
  refreshStaff();
  redirect(`/roles/${role.id}?created=1` as Route);
}

export async function updateRole(
  rawId: string,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const id = idSchema.safeParse(rawId);
  const body = parsePayload(formData);
  if (!id.success || !body) return { error: 'The form could not be read.', at: Date.now() };
  try {
    await adminCall(`/admin/roles/${id.data}`, { method: 'PATCH', body });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return { error: error.message, at: Date.now() };
    }
    return saveFailure(error);
  }
  refreshStaff();
  revalidatePath(`/roles/${id.data}`);
  return { done: 'Role saved.', at: Date.now() };
}

export async function deleteRole(rawId: string): Promise<ActionState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { error: 'Unknown role.', at: Date.now() };
  try {
    await adminCall(`/admin/roles/${id.data}`, { method: 'DELETE' });
  } catch (error) {
    return failure(error);
  }
  refreshStaff();
  redirect('/roles?deleted=1' as Route);
}
