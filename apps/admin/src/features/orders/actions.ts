'use server';

import type { AdminOrderDto, StaffOrderAction } from '@as/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { clientInfo } from '@/lib/api/client-ip';
import { ApiError, apiRequest } from '@/lib/api/http-client';
import { requireStaff } from '@/lib/session';

/*
 * Order changes from the order page. Bound arguments (order number, action, proof id) come from
 * the browser like any form field, so they are validated here; the API checks the permission,
 * the order's state and every field again.
 */

export interface ActionState {
  /** Set on success; the dialog closes and shows this as a toast. */
  done?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Changes on every result, so the form can react to repeated identical outcomes. */
  at?: number;
}

const numberSchema = z.string().regex(/^AS-\d{6}-[23456789A-HJKMNP-Z]{5}$/);
const actionSchema = z.enum([
  'confirm',
  'process',
  'ship',
  'deliver',
  'cancel',
  'return',
  'refund',
] satisfies StaffOrderAction[]);
const proofIdSchema = z.uuid();

/** A trimmed text field; empty → left out (the API treats it as "not given"). */
const text = (formData: FormData, name: string): string | undefined => {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const BODY: Record<StaffOrderAction, (formData: FormData) => Record<string, unknown>> = {
  confirm: (f) => ({ note: text(f, 'note') }),
  process: (f) => ({ note: text(f, 'note') }),
  deliver: (f) => ({ note: text(f, 'note') }),
  ship: (f) => ({
    courier: text(f, 'courier') ?? '',
    trackingNumber: text(f, 'trackingNumber'),
    note: text(f, 'note'),
  }),
  cancel: (f) => ({ reason: text(f, 'reason') ?? '' }),
  return: (f) => ({ restock: f.get('restock') === 'on', note: text(f, 'note') }),
  refund: (f) => ({ reference: text(f, 'reference'), note: text(f, 'note') }),
};

const DONE: Record<StaffOrderAction, string> = {
  confirm: 'Order confirmed.',
  process: 'Marked as packing.',
  ship: 'Marked as shipped.',
  deliver: 'Marked as delivered.',
  cancel: 'Order cancelled.',
  return: 'Return recorded.',
  refund: 'Refund recorded.',
};

function failed(error: unknown): ActionState {
  if (error instanceof ApiError) {
    const fieldErrors = error.fieldErrors;
    if (error.status === 422 && Object.keys(fieldErrors).length) {
      return { fieldErrors, at: Date.now() };
    }
    if (error.status === 403) {
      return { error: 'Your role does not allow this.', at: Date.now() };
    }
    if (error.status >= 400 && error.status < 500) {
      return { error: error.message, at: Date.now() };
    }
  }
  return { error: 'Could not save right now. Please try again.', at: Date.now() };
}

async function send(path: string, body: Record<string, unknown>): Promise<void> {
  const { token } = await requireStaff();
  const { ip, userAgent } = await clientInfo();
  await apiRequest<AdminOrderDto>(path, {
    method: 'POST',
    body,
    token,
    clientIp: ip,
    userAgent,
  });
}

const orderPath = (number: string) => `/admin/orders/${encodeURIComponent(number)}`;

function refresh(number: string) {
  revalidatePath(`/orders/${number}`);
  revalidatePath('/orders');
  revalidatePath('/');
}

export async function orderTransition(
  rawNumber: string,
  rawAction: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const number = numberSchema.safeParse(rawNumber);
  const action = actionSchema.safeParse(rawAction);
  if (!number.success || !action.success) return { error: 'Unknown order.', at: Date.now() };
  try {
    await send(`${orderPath(number.data)}/${action.data}`, BODY[action.data](formData));
  } catch (error) {
    return failed(error);
  }
  refresh(number.data);
  return { done: DONE[action.data], at: Date.now() };
}

export async function addOrderNote(
  rawNumber: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const number = numberSchema.safeParse(rawNumber);
  if (!number.success) return { error: 'Unknown order.', at: Date.now() };
  const note = text(formData, 'note');
  if (!note) return { fieldErrors: { note: 'Write the note first.' }, at: Date.now() };
  const customerVisible = formData.get('customerVisible') === 'on';
  try {
    await send(`${orderPath(number.data)}/notes`, { note, customerVisible });
  } catch (error) {
    return failed(error);
  }
  refresh(number.data);
  return {
    done: customerVisible ? 'Note added and shown to the customer.' : 'Note added.',
    at: Date.now(),
  };
}

export async function reviewPaymentProof(
  rawNumber: string,
  rawProofId: string,
  decision: 'accept' | 'reject',
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const number = numberSchema.safeParse(rawNumber);
  const proofId = proofIdSchema.safeParse(rawProofId);
  if (!number.success || !proofId.success || (decision !== 'accept' && decision !== 'reject')) {
    return { error: 'Unknown payment screenshot.', at: Date.now() };
  }
  const body =
    decision === 'accept'
      ? { note: text(formData, 'note') }
      : { reason: text(formData, 'reason') ?? '' };
  try {
    await send(`${orderPath(number.data)}/payment-proofs/${proofId.data}/${decision}`, body);
  } catch (error) {
    return failed(error);
  }
  refresh(number.data);
  return {
    done:
      decision === 'accept'
        ? 'Payment accepted. The order is marked paid.'
        : 'Screenshot rejected. The customer can upload a new one.',
    at: Date.now(),
  };
}
