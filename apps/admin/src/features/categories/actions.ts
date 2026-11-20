'use server';

import type { AdminCategoryDto } from '@as/contracts';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import type { ActionState, SaveState } from '@/lib/action-state';
import { adminCall, parsePayload, saveFailure } from '@/lib/api/admin-call';

/*
 * Category writes. The API locks the tree for moves and reorders, refuses stale saves and
 * deleting categories that still have subcategories or products, and refreshes the shop.
 */

const idSchema = z.uuid();

function refresh(id?: string) {
  revalidatePath('/categories');
  revalidatePath('/products', 'layout');
  if (id) revalidatePath(`/categories/${id}`);
}

export async function createCategory(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const body = parsePayload(formData);
  if (!body) return { error: 'The form could not be read. Reload and try again.', at: Date.now() };
  let created: AdminCategoryDto;
  try {
    created = await adminCall<AdminCategoryDto>('/admin/categories', { method: 'POST', body });
  } catch (error) {
    return saveFailure(error);
  }
  refresh(created.id);
  redirect(`/categories/${created.id}?created=1` as Route);
}

export async function updateCategory(
  rawId: string,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const id = idSchema.safeParse(rawId);
  const body = parsePayload(formData);
  if (!id.success || !body) return { error: 'The form could not be read.', at: Date.now() };
  try {
    await adminCall(`/admin/categories/${id.data}`, { method: 'PATCH', body });
  } catch (error) {
    return saveFailure(error);
  }
  refresh(id.data);
  return { done: 'Category saved.', at: Date.now() };
}

export async function deleteCategory(rawId: string): Promise<ActionState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { error: 'Unknown category.', at: Date.now() };
  try {
    await adminCall(`/admin/categories/${id.data}`, { method: 'DELETE' });
  } catch (error) {
    return saveFailure(error);
  }
  refresh();
  redirect('/categories?deleted=1' as Route);
}

const reorderSchema = z.object({
  parentId: z.uuid().nullable(),
  ids: z.array(z.uuid()).min(1).max(500),
});

/** The new order of one parent's subcategories (all of them). */
export async function reorderCategories(
  parentId: string | null,
  ids: string[],
): Promise<ActionState> {
  const parsed = reorderSchema.safeParse({ parentId, ids });
  if (!parsed.success) return { error: 'The order could not be read.', at: Date.now() };
  try {
    await adminCall('/admin/categories/reorder', { method: 'POST', body: parsed.data });
  } catch (error) {
    return saveFailure(error);
  }
  refresh();
  return { done: 'Order saved.', at: Date.now() };
}
