'use server';

import type { ContactReceivedDto, ContactTopic } from '@as/contracts';

import { clientIp } from '@/lib/api/client-ip';
import { ApiError, apiRequest } from '@/lib/api/http-client';
import { reportError } from '@/lib/errors/report-error';

import { CONTACT_HONEYPOT, type ContactField, contactSchema, type contactTopics } from './schema';

export type ContactState =
  | { status: 'idle' }
  | { status: 'success' }
  | {
      status: 'error';
      message?: string;
      fieldErrors: Partial<Record<ContactField, string>>;
      at: number;
    };

/** Form topics (labels) → the API's topic codes. */
const TOPICS: Record<(typeof contactTopics)[number], ContactTopic> = {
  'Order enquiry': 'ORDER',
  'Returns & exchange': 'RETURNS',
  'Product question': 'PRODUCT',
  'Bulk / wholesale': 'WHOLESALE',
  Other: 'OTHER',
};

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
    const { topic, ...fields } = parsed.data;
    await apiRequest<ContactReceivedDto>('/contact', {
      method: 'POST',
      body: { ...fields, topic: TOPICS[topic] },
      clientIp: await clientIp(),
    });
    return { status: 'success' };
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      return {
        status: 'error',
        fieldErrors: error.fieldErrors as Partial<Record<ContactField, string>>,
        at: Date.now(),
      };
    }
    if (error instanceof ApiError && error.status === 429) {
      return {
        status: 'error',
        message: 'You have sent several messages already. Please wait a while or WhatsApp us.',
        fieldErrors: {},
        at: Date.now(),
      };
    }
    reportError(error, { action: 'contact.send' });
    return {
      status: 'error',
      message: 'We couldn’t send your message. Please try WhatsApp or call us instead.',
      fieldErrors: {},
      at: Date.now(),
    };
  }
}
