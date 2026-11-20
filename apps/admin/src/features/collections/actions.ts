'use server';

import type {
  AdminCollectionDto,
  AdminProductListDto,
  CollectionPreviewDto,
  CollectionProductDto,
} from '@as/contracts';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import type { ActionState, SaveState } from '@/lib/action-state';
import { adminCall, parsePayload, saveFailure } from '@/lib/api/admin-call';
import { ApiError } from '@/lib/api/http-client';

/*
 * Collections: settings and rules (one JSON save, conflict-checked), the hand-picked product list
 * (saved separately, in order), display order, and a dry run of rules before saving them.
 */

const idSchema = z.uuid();

function refresh(id?: string) {
  revalidatePath('/collections');
  if (id) revalidatePath(`/collections/${id}`);
}

export async function createCollection(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const body = parsePayload(formData);
  if (!body) return { error: 'The form could not be read. Reload and try again.', at: Date.now() };
  let created: AdminCollectionDto;
  try {
    created = await adminCall<AdminCollectionDto>('/admin/collections', { method: 'POST', body });
  } catch (error) {
    return saveFailure(error);
  }
  refresh(created.id);
  redirect(`/collections/${created.id}?created=1` as Route);
}

export async function updateCollection(
  rawId: string,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const id = idSchema.safeParse(rawId);
  const body = parsePayload(formData);
  if (!id.success || !body) return { error: 'The form could not be read.', at: Date.now() };
  try {
    await adminCall(`/admin/collections/${id.data}`, { method: 'PATCH', body });
  } catch (error) {
    return saveFailure(error);
  }
  refresh(id.data);
  return { done: 'Collection saved.', at: Date.now() };
}

export async function deleteCollection(rawId: string): Promise<ActionState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { error: 'Unknown collection.', at: Date.now() };
  try {
    await adminCall(`/admin/collections/${id.data}`, { method: 'DELETE' });
  } catch (error) {
    return saveFailure(error);
  }
  refresh();
  redirect('/collections?deleted=1' as Route);
}

const idsSchema = z.array(z.uuid()).max(2_000);

/** Display order of all collections. */
export async function reorderCollections(ids: string[]): Promise<ActionState> {
  const parsed = idsSchema.min(1).safeParse(ids);
  if (!parsed.success) return { error: 'The order could not be read.', at: Date.now() };
  try {
    await adminCall('/admin/collections/reorder', { method: 'POST', body: { ids: parsed.data } });
  } catch (error) {
    return saveFailure(error);
  }
  refresh();
  return { done: 'Order saved.', at: Date.now() };
}

/** Replaces a hand-picked collection's products, in this order. */
export async function setCollectionProducts(
  rawId: string,
  productIds: string[],
): Promise<ActionState> {
  const id = idSchema.safeParse(rawId);
  const ids = idsSchema.safeParse(productIds);
  if (!id.success || !ids.success) return { error: 'The list could not be read.', at: Date.now() };
  try {
    await adminCall(`/admin/collections/${id.data}/products`, {
      method: 'PUT',
      body: { productIds: ids.data },
    });
  } catch (error) {
    return saveFailure(error);
  }
  refresh(id.data);
  return { done: 'Products saved.', at: Date.now() };
}

export type PreviewResult =
  { ok: true; preview: CollectionPreviewDto } | { ok: false; error: string };

/** What the rules would match right now (validated by the API against the catalog). */
export async function previewRules(rules: unknown): Promise<PreviewResult> {
  if (!rules || typeof rules !== 'object' || JSON.stringify(rules).length > 20_000) {
    return { ok: false, error: 'Add at least one complete rule.' };
  }
  try {
    const preview = await adminCall<CollectionPreviewDto>('/admin/collections/preview', {
      method: 'POST',
      body: { rules },
    });
    return { ok: true, preview };
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      return { ok: false, error: error.problem?.errors?.[0]?.message ?? error.message };
    }
    return { ok: false, error: saveFailure(error).error ?? 'The preview failed.' };
  }
}

/** Products to pick from (name, slug or SKU), any status. */
export async function searchProducts(query: string): Promise<CollectionProductDto[] | null> {
  const q = z.string().trim().min(1).max(100).safeParse(query);
  try {
    const list = await adminCall<AdminProductListDto>('/admin/products', {
      query: { q: q.success ? q.data : undefined, sort: 'name', pageSize: 20 },
    });
    return list.items.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      status: p.status,
      priceMinMinor: p.priceMinMinor,
      image: p.image,
    }));
  } catch {
    return null;
  }
}
