'use server';

import { reportError } from '@/lib/errors/report-error';

import { CONTACT_HONEYPOT, type ContactField, contactSchema } from './schema';

export type ContactState =
  | { status: 'idle' }
  | { status: 'success' }
  | {
      status: 'error';
      message?: string;
      fieldErrors: Partial<Record<ContactField, string>>;
      at: number;
    };

/* Mock "inbox" — the API will store messages and notify staff (email / WhatsApp). */
const inbox: unknown[] = ((globalThis as { __asInbox?: unknown[] }).__asInbox ??= []);

export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  if (String(formData.get(CONTACT_HONEYPOT) ?? '')) return { status: 'success' };

  const parsed = contactSchema.safeParse({
    name: formData.get('name') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    topic: formData.get('topic') || undefined,
    orderNumber: formData.get('orderNumber') ?? '',
    message: formData.get('message') ?? '',
  });

  if (!parsed.success) {
    const fieldErrors: Partial<Record<ContactField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as ContactField;
      fieldErrors[key] ??= issue.message;
    }
    // Zod skips object-level refinements while fields are invalid — check reachability here too,
    // so every problem is reported in one round trip.
    if (
      !String(formData.get('phone') ?? '').trim() &&
      !String(formData.get('email') ?? '').trim()
    ) {
      fieldErrors.phone ??= 'Add a phone number or email so we can reply.';
    }
    return { status: 'error', fieldErrors, at: Date.now() };
  }

  try {
    inbox.push({ ...parsed.data, receivedAt: new Date().toISOString() });
    return { status: 'success' };
  } catch (error) {
    reportError(error, { action: 'contact.send' });
    return {
      status: 'error',
      message: 'We couldn’t send your message. Please try WhatsApp or call us instead.',
      fieldErrors: {},
      at: Date.now(),
    };
  }
}
