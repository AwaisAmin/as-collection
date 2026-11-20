'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ActionState } from '@/lib/action-state';
import { adminCall, saveFailure } from '@/lib/api/admin-call';
import { ApiError } from '@/lib/api/http-client';

/* Brand writes (name, web address, description, logo, shown in the shop). */

const idSchema = z.uuid();

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

export async function saveBrand(
  rawId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = rawId === null ? null : idSchema.safeParse(rawId);
  if (id && !id.success) return { error: 'Unknown brand.', at: Date.now() };
  const name = field(formData, 'name');
  if (!name) return { fieldErrors: { name: 'Give the brand a name.' }, at: Date.now() };
  const slug = field(formData, 'slug');
  const logoId = idSchema.safeParse(field(formData, 'logoId'));
  const body = {
    name,
    description: field(formData, 'description') || null,
    logoId: logoId.success ? logoId.data : null,
    isActive: formData.get('isActive') === 'on',
    ...(slug || id ? { slug } : {}),
    ...(id ? { updatedAt: field(formData, 'updatedAt') } : {}),
  };
  try {
    await (id?.success
      ? adminCall(`/admin/brands/${id.data}`, { method: 'PATCH', body })
      : adminCall('/admin/brands', { method: 'POST', body }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      return { fieldErrors: error.fieldErrors, at: Date.now() };
    }
    return saveFailure(error);
  }
  revalidatePath('/brands');
  revalidatePath('/products', 'layout');
  return { done: id ? 'Brand saved.' : 'Brand added.', at: Date.now() };
}

export async function deleteBrand(rawId: string): Promise<ActionState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { error: 'Unknown brand.', at: Date.now() };
  try {
    await adminCall(`/admin/brands/${id.data}`, { method: 'DELETE' });
  } catch (error) {
    return saveFailure(error);
  }
  revalidatePath('/brands');
  return { done: 'Brand deleted.', at: Date.now() };
}
