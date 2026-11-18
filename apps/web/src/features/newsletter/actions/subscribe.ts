'use server';

import { ApiError } from '@/lib/api/http-client';
import { reportError } from '@/lib/errors/report-error';

import { HONEYPOT_FIELD, newsletterSchema, type SubscribeState } from '../schema';
import { newsletterService } from '../services/newsletter.service';

export async function subscribeToNewsletter(
  _prev: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  const rawEmail = String(formData.get('email') ?? '');
  const at = Date.now();

  // Bots fill every field; humans never see this one. Pretend success, do nothing.
  if (String(formData.get(HONEYPOT_FIELD) ?? '').length > 0) {
    return { status: 'success', message: 'Thank you for subscribing!', email: '', at };
  }

  const parsed = newsletterSchema.safeParse({ email: rawEmail });
  if (!parsed.success) {
    return {
      status: 'error',
      field: 'email',
      message: parsed.error.issues[0]?.message ?? 'Please enter a valid email address.',
      email: rawEmail,
      at,
    };
  }

  try {
    const { alreadySubscribed } = await newsletterService.subscribe(parsed.data.email);
    return {
      status: 'success',
      message: alreadySubscribed
        ? "You're already on our list — thank you!"
        : 'Thank you for subscribing! Look out for our latest offers.',
      email: '',
      at,
    };
  } catch (error) {
    reportError(error, { action: 'newsletter.subscribe' });

    let message = "We couldn't subscribe you right now. Please try again shortly.";
    if (error instanceof ApiError) {
      if (error.status === 422 || error.status === 400) message = error.message;
      if (error.status === 429) message = 'Too many attempts. Please wait a moment and try again.';
    }
    return { status: 'error', message, email: rawEmail, at };
  }
}
