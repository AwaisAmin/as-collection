'use server';

import type { AdminProductDto } from '@as/contracts';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import type { ActionState } from '@/lib/action-state';
import { clientInfo } from '@/lib/api/client-ip';
import { ApiError, apiRequest, type RequestOptions } from '@/lib/api/http-client';
import { requireStaff } from '@/lib/session';

import { rupeesToMinor } from './form-model';

/*
 * Product writes from the editor. The browser sends the product as JSON; it is only shape-checked
 * here (size, ids) — the API validates every field, checks permissions and refuses stale saves.
 */

export interface SaveState {
  done?: string;
  error?: string;
  /** API field errors by dotted path (`name`, `variants.0.sku`, `media.2.mediaId`). */
  errors?: Record<string, string>;
  /** Someone else saved the product meanwhile. */
  stale?: boolean;
  at?: number;
}

const MAX_PAYLOAD_CHARS = 200_000;
const idSchema = z.uuid();

async function call<T>(path: string, options: RequestOptions): Promise<T> {
  const { token } = await requireStaff();
  const { ip, userAgent } = await clientInfo();
  return apiRequest<T>(path, { ...options, token, clientIp: ip, userAgent });
}

function failure(error: unknown): SaveState {
  const at = Date.now();
  if (error instanceof ApiError) {
    if (error.code === 'STALE_UPDATE') {
      return { stale: true, error: error.message, at };
    }
    if (error.status === 422 && error.problem?.errors?.length) {
      const errors: Record<string, string> = {};
      for (const { path, message } of error.problem.errors) errors[path] ??= message;
      return { error: 'Some fields need attention.', errors, at };
    }
    if (error.status === 403) return { error: 'Your role does not allow this.', at };
    if (error.status === 413) return { error: 'That file is too large (20 MB at most).', at };
    if (error.status >= 400 && error.status < 500) return { error: error.message, at };
  }
  return { error: 'Could not save right now. Please try again.', at };
}

function parsePayload(formData: FormData): Record<string, unknown> | null {
  const raw = formData.get('payload');
  if (typeof raw !== 'string' || raw.length > MAX_PAYLOAD_CHARS) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function refresh(id?: string) {
  revalidatePath('/products');
  if (id) revalidatePath(`/products/${id}`);
}

/** Creates the product, then opens it. */
export async function createProduct(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const body = parsePayload(formData);
  if (!body) return { error: 'The form could not be read. Reload and try again.', at: Date.now() };
  let created: AdminProductDto;
  try {
    created = await call<AdminProductDto>('/admin/products', { method: 'POST', body });
  } catch (error) {
    return failure(error);
  }
  refresh(created.id);
  redirect(`/products/${created.id}?created=1` as Route);
}

export async function updateProduct(
  rawId: string,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const id = idSchema.safeParse(rawId);
  const body = parsePayload(formData);
  if (!id.success || !body) return { error: 'The form could not be read.', at: Date.now() };
  try {
    await call(`/admin/products/${id.data}`, { method: 'PATCH', body });
  } catch (error) {
    return failure(error);
  }
  refresh(id.data);
  return { done: 'Product saved.', at: Date.now() };
}

export async function deleteProduct(rawId: string): Promise<SaveState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { error: 'Unknown product.', at: Date.now() };
  try {
    await call(`/admin/products/${id.data}`, { method: 'DELETE' });
  } catch (error) {
    return failure(error);
  }
  refresh();
  redirect('/products?deleted=1' as Route);
}

// ─── Variants (existing products) ───

/** API field paths → the variant form's field names. */
const VARIANT_FIELDS: Record<string, string> = {
  sku: 'sku',
  title: 'title',
  priceMinor: 'price',
  compareAtPriceMinor: 'compareAt',
  costMinor: 'cost',
  barcode: 'barcode',
  weightGrams: 'weight',
  options: 'options',
  inventory: 'stock',
};

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

/** Rupees → paisa (null when empty); invalid input becomes -1 so the API names the field. */
const paisa = (value: string) => {
  const minor = rupeesToMinor(value);
  return minor === null ? null : Number.isNaN(minor) ? -1 : minor;
};

function variantBody(formData: FormData, isNew: boolean) {
  const weight = field(formData, 'weight');
  const options = [...formData.entries()].flatMap(([name, value]) =>
    name.startsWith('option.') && typeof value === 'string' && value
      ? [{ attributeId: name.slice('option.'.length), valueId: value }]
      : [],
  );
  return {
    sku: field(formData, 'sku'),
    title: field(formData, 'title') || null,
    priceMinor: paisa(field(formData, 'price')) ?? -1,
    compareAtPriceMinor: paisa(field(formData, 'compareAt')),
    costMinor: paisa(field(formData, 'cost')),
    barcode: field(formData, 'barcode') || null,
    weightGrams: weight ? (Number.isInteger(Number(weight)) ? Number(weight) : -1) : null,
    isActive: formData.get('isActive') === 'on',
    options,
    ...(isNew
      ? {
          inventory: {
            onHand: Number.isInteger(Number(field(formData, 'stock') || '0'))
              ? Number(field(formData, 'stock') || '0')
              : -1,
            trackInventory: formData.get('trackInventory') === 'on',
            allowBackorder: formData.get('allowBackorder') === 'on',
          },
        }
      : {}),
  };
}

export async function saveVariant(
  rawProductId: string,
  rawVariantId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const productId = idSchema.safeParse(rawProductId);
  const variantId = rawVariantId === null ? null : idSchema.safeParse(rawVariantId);
  if (!productId.success || (variantId && !variantId.success)) {
    return { error: 'Unknown variant.', at: Date.now() };
  }
  const base = `/admin/products/${productId.data}/variants`;
  try {
    await (variantId?.success
      ? call(`${base}/${variantId.data}`, { method: 'PATCH', body: variantBody(formData, false) })
      : call(base, { method: 'POST', body: variantBody(formData, true) }));
  } catch (error) {
    const result = failure(error);
    if (!result.errors)
      return { error: result.error ?? 'Could not save.', at: result.at ?? Date.now() };
    const fieldErrors: Record<string, string> = {};
    for (const [path, message] of Object.entries(result.errors)) {
      const name = VARIANT_FIELDS[path.split('.')[0] ?? ''] ?? '';
      if (name) fieldErrors[name] ??= message;
    }
    return {
      error: Object.keys(fieldErrors).length ? undefined : Object.values(result.errors)[0],
      fieldErrors,
      at: Date.now(),
    };
  }
  refresh(productId.data);
  return { done: variantId ? 'Variant saved.' : 'Variant added.', at: Date.now() };
}

export async function deleteVariant(
  rawProductId: string,
  rawVariantId: string,
): Promise<SaveState> {
  const productId = idSchema.safeParse(rawProductId);
  const variantId = idSchema.safeParse(rawVariantId);
  if (!productId.success || !variantId.success)
    return { error: 'Unknown variant.', at: Date.now() };
  try {
    await call(`/admin/products/${productId.data}/variants/${variantId.data}`, {
      method: 'DELETE',
    });
  } catch (error) {
    return failure(error);
  }
  refresh(productId.data);
  return { done: 'Variant deleted.', at: Date.now() };
}
