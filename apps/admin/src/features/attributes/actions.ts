'use server';

import type { AdminAttributeDto } from '@as/contracts';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import type { ActionState } from '@/lib/action-state';
import { adminCall, saveFailure } from '@/lib/api/admin-call';
import { ApiError } from '@/lib/api/http-client';

/*
 * Attributes and their values. The API keeps codes and value slugs fixed once made (they are in
 * shop filter links), and allows type / scope changes and deletes only while nothing uses them.
 */

const idSchema = z.uuid();
const typeSchema = z.enum(['SELECT', 'MULTI_SELECT', 'TEXT', 'NUMBER', 'BOOLEAN']);
const scopeSchema = z.enum(['PRODUCT', 'VARIANT']);

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

/** 422 field errors by the form's field names (`values.3.label` → `values`). */
function failed(error: unknown): ActionState {
  if (error instanceof ApiError && error.status === 422) {
    const fieldErrors = error.fieldErrors;
    return Object.keys(fieldErrors).length
      ? { fieldErrors, at: Date.now() }
      : { error: error.message, at: Date.now() };
  }
  return saveFailure(error);
}

function refresh(id?: string) {
  revalidatePath('/attributes');
  revalidatePath('/categories', 'layout');
  revalidatePath('/products', 'layout');
  if (id) revalidatePath(`/attributes/${id}`);
}

export async function createAttribute(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const type = typeSchema.safeParse(field(formData, 'type'));
  const scope = scopeSchema.safeParse(field(formData, 'scope'));
  const name = field(formData, 'name');
  if (!name || !type.success || !scope.success) {
    return {
      fieldErrors: {
        ...(name ? {} : { name: 'Give the attribute a name.' }),
        ...(type.success ? {} : { type: 'Choose a type.' }),
      },
      at: Date.now(),
    };
  }
  // One value per line; blank lines ignored.
  const labels = field(formData, 'values')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const code = field(formData, 'code');
  let created: AdminAttributeDto;
  try {
    created = await adminCall<AdminAttributeDto>('/admin/attributes', {
      method: 'POST',
      body: {
        name,
        type: type.data,
        scope: scope.data,
        unit: field(formData, 'unit') || null,
        isFilterable: formData.get('isFilterable') === 'on',
        isVisible: formData.get('isVisible') === 'on',
        values:
          type.data === 'SELECT' || type.data === 'MULTI_SELECT'
            ? labels.map((label) => ({ label }))
            : [],
        ...(code ? { code } : {}),
      },
    });
  } catch (error) {
    return failed(error);
  }
  refresh(created.id);
  redirect(`/attributes/${created.id}?created=1` as Route);
}

export async function updateAttribute(
  rawId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(rawId);
  const type = typeSchema.safeParse(field(formData, 'type'));
  const scope = scopeSchema.safeParse(field(formData, 'scope'));
  if (!id.success || !type.success || !scope.success) {
    return { error: 'The form could not be read.', at: Date.now() };
  }
  const name = field(formData, 'name');
  if (!name) return { fieldErrors: { name: 'Give the attribute a name.' }, at: Date.now() };
  try {
    await adminCall(`/admin/attributes/${id.data}`, {
      method: 'PATCH',
      body: {
        name,
        type: type.data,
        scope: scope.data,
        unit: field(formData, 'unit') || null,
        isFilterable: formData.get('isFilterable') === 'on',
        isVisible: formData.get('isVisible') === 'on',
        updatedAt: field(formData, 'updatedAt'),
      },
    });
  } catch (error) {
    return failed(error);
  }
  refresh(id.data);
  return { done: 'Attribute saved.', at: Date.now() };
}

export async function deleteAttribute(rawId: string): Promise<ActionState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { error: 'Unknown attribute.', at: Date.now() };
  try {
    await adminCall(`/admin/attributes/${id.data}`, { method: 'DELETE' });
  } catch (error) {
    return saveFailure(error);
  }
  refresh();
  redirect('/attributes?deleted=1' as Route);
}

// ─── Values ───

/** `#abc` / `#a1b2c3`, or empty for no swatch. */
const swatchOf = (raw: string) => (raw ? raw.toLowerCase() : null);

export async function saveValue(
  rawAttributeId: string,
  rawValueId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const attributeId = idSchema.safeParse(rawAttributeId);
  const valueId = rawValueId === null ? null : idSchema.safeParse(rawValueId);
  if (!attributeId.success || (valueId && !valueId.success)) {
    return { error: 'Unknown value.', at: Date.now() };
  }
  const label = field(formData, 'label');
  if (!label) return { fieldErrors: { label: 'Enter the value, e.g. Lawn.' }, at: Date.now() };
  const swatch = swatchOf(field(formData, 'swatch'));
  if (swatch && !/^#(?:[0-9a-f]{3}){1,2}$/.test(swatch)) {
    return { fieldErrors: { swatch: 'Use a colour like #8b1a1a.' }, at: Date.now() };
  }
  const base = `/admin/attributes/${attributeId.data}/values`;
  const slug = field(formData, 'value');
  try {
    await (valueId?.success
      ? adminCall(`${base}/${valueId.data}`, { method: 'PATCH', body: { label, swatch } })
      : adminCall(base, {
          method: 'POST',
          body: { label, swatch, ...(slug ? { value: slug } : {}) },
        }));
  } catch (error) {
    return failed(error);
  }
  refresh(attributeId.data);
  return { done: valueId ? 'Value saved.' : `Added “${label}”.`, at: Date.now() };
}

export async function deleteValue(
  rawAttributeId: string,
  rawValueId: string,
): Promise<ActionState> {
  const attributeId = idSchema.safeParse(rawAttributeId);
  const valueId = idSchema.safeParse(rawValueId);
  if (!attributeId.success || !valueId.success) return { error: 'Unknown value.', at: Date.now() };
  try {
    await adminCall(`/admin/attributes/${attributeId.data}/values/${valueId.data}`, {
      method: 'DELETE',
    });
  } catch (error) {
    return saveFailure(error);
  }
  refresh(attributeId.data);
  return { done: 'Value deleted.', at: Date.now() };
}

/** Swaps the display positions of two values (moving one up or down). */
export async function swapValues(
  rawAttributeId: string,
  a: { id: string; position: number },
  b: { id: string; position: number },
): Promise<ActionState> {
  const attributeId = idSchema.safeParse(rawAttributeId);
  const ids = z.array(z.object({ id: z.uuid(), position: z.number().int().min(0).max(100_000) }));
  const pair = ids.safeParse([a, b]);
  if (!attributeId.success || !pair.success) return { error: 'Unknown value.', at: Date.now() };
  const [first, second] = pair.data as [
    { id: string; position: number },
    { id: string; position: number },
  ];
  // Equal positions (never reordered): spread them so the swap is visible.
  const [p1, p2] =
    first.position === second.position
      ? [first.position, first.position + 1]
      : [first.position, second.position];
  const base = `/admin/attributes/${attributeId.data}/values`;
  try {
    await adminCall(`${base}/${first.id}`, { method: 'PATCH', body: { position: p2 } });
    await adminCall(`${base}/${second.id}`, { method: 'PATCH', body: { position: p1 } });
  } catch (error) {
    return saveFailure(error);
  }
  refresh(attributeId.data);
  return { done: 'Order saved.', at: Date.now() };
}
