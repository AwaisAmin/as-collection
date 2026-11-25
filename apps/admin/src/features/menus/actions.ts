'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { SaveState } from '@/lib/action-state';
import { adminCall, parsePayload, saveFailure } from '@/lib/api/admin-call';

/*
 * Menus are saved whole: the payload is the tree the editor shows plus the `updatedAt` it was
 * loaded with, so a save never overwrites someone else's newer menu. The API checks the links,
 * the depth (3) and the size (300 items), and refreshes the shop's cached menu.
 */

const keySchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(60);

export async function saveMenu(
  rawKey: string,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const key = keySchema.safeParse(rawKey);
  const body = parsePayload(formData);
  if (!key.success || !body) return { error: 'The form could not be read.', at: Date.now() };
  try {
    await adminCall(`/admin/menus/${key.data}`, { method: 'PUT', body });
  } catch (error) {
    return saveFailure(error);
  }
  revalidatePath('/menus');
  revalidatePath(`/menus/${key.data}`);
  return { done: 'Menu saved. The shop shows it within a moment.', at: Date.now() };
}
