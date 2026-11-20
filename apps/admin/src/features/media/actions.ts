'use server';

import type { AdminMediaDto, AdminMediaListDto } from '@as/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ActionState } from '@/lib/action-state';
import { adminCall as call } from '@/lib/api/admin-call';
import { ApiError } from '@/lib/api/http-client';

/*
 * The image library. Uploads are re-encoded by the API (WebP, metadata stripped, responsive
 * copies); identical files are recognised and not stored twice.
 */

const idSchema = z.uuid();

function failure(error: unknown): ActionState {
  const at = Date.now();
  if (error instanceof ApiError) {
    if (error.status === 403) return { error: 'Your role does not allow changing images.', at };
    if (error.status === 413) return { error: 'That file is too large (20 MB at most).', at };
    if (error.status === 422) {
      return { error: error.problem?.errors?.[0]?.message ?? error.message, at };
    }
    if (error.status >= 400 && error.status < 500) return { error: error.message, at };
  }
  return { error: 'Could not save right now. Please try again.', at };
}

const MAX_FILES = 12;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface UploadResult {
  uploaded: AdminMediaDto[];
  /** Per file that failed: its name and why. */
  failed: { name: string; error: string }[];
}

/** Uploads images to the library (each is converted to WebP by the API). */
export async function uploadImages(formData: FormData): Promise<UploadResult> {
  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  const result: UploadResult = { uploaded: [], failed: [] };
  for (const [index, file] of files.entries()) {
    if (index >= MAX_FILES) {
      result.failed.push({
        name: file.name,
        error: `Upload at most ${String(MAX_FILES)} at once.`,
      });
      continue;
    }
    if (!IMAGE_TYPES.has(file.type)) {
      result.failed.push({ name: file.name, error: 'Use JPG, PNG or WEBP.' });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      result.failed.push({ name: file.name, error: 'Larger than 20 MB.' });
      continue;
    }
    const body = new FormData();
    body.set('file', file, file.name);
    try {
      result.uploaded.push(
        await call<AdminMediaDto>('/admin/media', { method: 'POST', body, timeoutMs: 60_000 }),
      );
    } catch (error) {
      result.failed.push({ name: file.name, error: failure(error).error ?? 'Upload failed.' });
    }
  }
  if (result.uploaded.length) revalidatePath('/media');
  return result;
}

const librarySchema = z.object({
  q: z.string().trim().max(100).optional(),
  before: z.uuid().optional(),
});

/** A page of the image library for the picker. */
export async function browseImages(input: {
  q?: string;
  before?: string;
}): Promise<AdminMediaListDto | null> {
  const parsed = librarySchema.safeParse(input);
  if (!parsed.success) return null;
  try {
    return await call<AdminMediaListDto>('/admin/media', {
      query: { q: parsed.data.q || undefined, before: parsed.data.before, limit: 30 },
    });
  } catch {
    return null;
  }
}

/** Changes an image's description (alt text); products may override it. */
export async function updateImageAlt(
  rawId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { error: 'Unknown image.', at: Date.now() };
  const alt = formData.get('alt');
  const value = typeof alt === 'string' ? alt.trim() : '';
  if (value.length > 300) {
    return { fieldErrors: { alt: 'Use at most 300 characters.' }, at: Date.now() };
  }
  try {
    await call(`/admin/media/${id.data}`, { method: 'PATCH', body: { alt: value || null } });
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/media');
  return { done: 'Description saved.', at: Date.now() };
}

/** Deletes an unused image and its stored copies (refused while it is used anywhere). */
export async function deleteImage(rawId: string): Promise<ActionState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { error: 'Unknown image.', at: Date.now() };
  try {
    await call(`/admin/media/${id.data}`, { method: 'DELETE' });
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/media');
  return { done: 'Image deleted.', at: Date.now() };
}
