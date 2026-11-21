'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ActionState, SaveState } from '@/lib/action-state';
import { adminCall, parsePayload, saveFailure } from '@/lib/api/admin-call';

/*
 * Page sections. Settings are validated by the API with the very schema the shop reads them with;
 * every change refreshes the shop's home page.
 */

const idSchema = z.uuid();

const pathOf = (pageId: string) => `/admin/pages/${pageId}/sections`;

/** Adds a section (`sectionId` null) or saves one (the payload carries its `updatedAt`). */
export async function saveSection(
  rawPageId: string,
  rawSectionId: string | null,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const pageId = idSchema.safeParse(rawPageId);
  const sectionId = rawSectionId === null ? null : idSchema.safeParse(rawSectionId);
  const body = parsePayload(formData);
  if (!pageId.success || (sectionId && !sectionId.success) || !body) {
    return { error: 'The form could not be read.', at: Date.now() };
  }
  try {
    await (sectionId?.success
      ? adminCall(`${pathOf(pageId.data)}/${sectionId.data}`, { method: 'PATCH', body })
      : adminCall(pathOf(pageId.data), { method: 'POST', body }));
  } catch (error) {
    return saveFailure(error);
  }
  revalidatePath(`/pages/${pageId.data}`);
  return { done: sectionId ? 'Section saved.' : 'Section added.', at: Date.now() };
}

/** Shows or hides a section without touching its settings. */
export async function setSectionVisible(
  rawPageId: string,
  section: { id: string; updatedAt: string },
  isVisible: boolean,
): Promise<ActionState> {
  const pageId = idSchema.safeParse(rawPageId);
  const sectionId = idSchema.safeParse(section.id);
  if (!pageId.success || !sectionId.success) return { error: 'Unknown section.', at: Date.now() };
  try {
    await adminCall(`${pathOf(pageId.data)}/${sectionId.data}`, {
      method: 'PATCH',
      body: { isVisible, updatedAt: section.updatedAt },
    });
  } catch (error) {
    return saveFailure(error);
  }
  revalidatePath(`/pages/${pageId.data}`);
  return { done: isVisible ? 'Section shown.' : 'Section hidden.', at: Date.now() };
}

export async function deleteSection(rawPageId: string, rawSectionId: string): Promise<ActionState> {
  const pageId = idSchema.safeParse(rawPageId);
  const sectionId = idSchema.safeParse(rawSectionId);
  if (!pageId.success || !sectionId.success) return { error: 'Unknown section.', at: Date.now() };
  try {
    await adminCall(`${pathOf(pageId.data)}/${sectionId.data}`, { method: 'DELETE' });
  } catch (error) {
    return saveFailure(error);
  }
  revalidatePath(`/pages/${pageId.data}`);
  return { done: 'Section removed.', at: Date.now() };
}

/** The new order of all the page's sections. */
export async function reorderSections(rawPageId: string, ids: string[]): Promise<ActionState> {
  const pageId = idSchema.safeParse(rawPageId);
  const parsed = z.array(z.uuid()).min(1).max(200).safeParse(ids);
  if (!pageId.success || !parsed.success)
    return { error: 'The order could not be read.', at: Date.now() };
  try {
    await adminCall(`${pathOf(pageId.data)}/reorder`, {
      method: 'POST',
      body: { ids: parsed.data },
    });
  } catch (error) {
    return saveFailure(error);
  }
  revalidatePath(`/pages/${pageId.data}`);
  return { done: 'Order saved.', at: Date.now() };
}

/** Title and search-engine text of a page (the home page keeps its address and stays published). */
export async function updatePageDetails(
  rawPageId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const pageId = idSchema.safeParse(rawPageId);
  if (!pageId.success) return { error: 'Unknown page.', at: Date.now() };
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };
  const title = text('title');
  if (!title) return { fieldErrors: { title: 'Give the page a title.' }, at: Date.now() };
  try {
    await adminCall(`/admin/pages/${pageId.data}`, {
      method: 'PATCH',
      body: {
        title,
        seoTitle: text('seoTitle') || null,
        seoDescription: text('seoDescription') || null,
        updatedAt: text('updatedAt'),
      },
    });
  } catch (error) {
    const failure = saveFailure(error);
    return failure.stale
      ? { error: 'Someone else saved this page meanwhile. Reload and try again.', at: Date.now() }
      : { error: failure.error ?? 'Could not save.', at: failure.at ?? Date.now() };
  }
  revalidatePath(`/pages/${pageId.data}`);
  revalidatePath('/pages');
  return { done: 'Page details saved.', at: Date.now() };
}
