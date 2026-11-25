'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ActionState } from '@/lib/action-state';
import { adminCall, saveFailure } from '@/lib/api/admin-call';

/*
 * Review decisions. The review id is bound in the browser, so it is validated here; the API
 * checks the permission and the review's state again (only published reviews can be featured,
 * a review can't be published twice…). Every decision refreshes the shop's ratings.
 */

const idSchema = z.uuid();

function failed(error: unknown): ActionState {
  const { error: message, errors, at } = saveFailure(error);
  return errors ? { fieldErrors: errors, at } : { error: message, at };
}

async function decide(
  rawId: string,
  path: string,
  init: { method: 'POST' | 'PUT' | 'DELETE'; body?: Record<string, unknown> },
  done: string,
): Promise<ActionState> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { error: 'Unknown review.', at: Date.now() };
  try {
    await adminCall(`/admin/reviews/${id.data}${path}`, init);
  } catch (error) {
    return failed(error);
  }
  revalidatePath('/reviews');
  return { done, at: Date.now() };
}

export async function approveReview(id: string): Promise<ActionState> {
  return decide(id, '/approve', { method: 'POST' }, 'Review published.');
}

export async function rejectReview(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const reason = formData.get('reason');
  const text = typeof reason === 'string' ? reason.trim() : '';
  if (text.length < 3) {
    return {
      fieldErrors: { reason: 'Say why in a few words (only staff see it).' },
      at: Date.now(),
    };
  }
  return decide(id, '/reject', { method: 'POST', body: { reason: text } }, 'Review rejected.');
}

export async function featureReview(id: string, featured: boolean): Promise<ActionState> {
  return decide(
    id,
    '/featured',
    { method: 'PUT', body: { featured } },
    featured ? 'Added to the home page testimonials.' : 'Removed from the home page testimonials.',
  );
}

export async function replyToReview(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const reply = formData.get('reply');
  const text = typeof reply === 'string' ? reply.trim() : '';
  if (text.length > 1000) {
    return { fieldErrors: { reply: 'At most 1,000 characters.' }, at: Date.now() };
  }
  return decide(
    id,
    '/reply',
    { method: 'PUT', body: { reply: text || null } },
    text ? 'Reply saved.' : 'Reply removed.',
  );
}

export async function deleteReview(id: string): Promise<ActionState> {
  return decide(id, '', { method: 'DELETE' }, 'Review deleted.');
}
