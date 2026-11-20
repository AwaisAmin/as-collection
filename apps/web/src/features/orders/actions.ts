'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';

import { getSessionToken } from '@/features/auth/session';
import { validateScreenshot } from '@/features/checkout/schemas';
import { sniffImageType } from '@/lib/utils/sniff-image';

import { ORDER_NUMBER_PATTERN } from './lib/order-number';
import { ordersService } from './services/orders.service';
import type { OrderAccess } from './types';

export type OrderFormState =
  | { status: 'idle' }
  | { status: 'success'; message: string; at: number }
  | { status: 'error'; message: string; at: number };

const numberSchema = z.string().regex(ORDER_NUMBER_PATTERN);
const accessKeySchema = z.string().min(16).max(64);

/** The confirmation link's key when present, otherwise the signed-in session. */
async function accessFor(rawKey: unknown): Promise<OrderAccess | null> {
  const key = accessKeySchema.safeParse(rawKey);
  if (key.success) return { accessKey: key.data };
  const token = await getSessionToken();
  return token ? { token } : null;
}

const error = (message: string): OrderFormState => ({ status: 'error', message, at: Date.now() });

/** Transfer screenshot for a placed order (first upload failed, or the last one was rejected). */
export async function uploadPaymentProofAction(
  _prev: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const number = numberSchema.safeParse(formData.get('orderNumber'));
  const access = await accessFor(formData.get('key'));
  if (!number.success || !access) return error('Please reload the page and try again.');

  const file = formData.get('screenshot');
  const problem = validateScreenshot(file instanceof File ? file : null);
  if (problem) return error(problem);
  const screenshot = file as File;
  const head = new Uint8Array(await screenshot.slice(0, 16).arrayBuffer());
  if (!sniffImageType(head)) return error('That file doesn’t look like a valid image.');

  const reference =
    String(formData.get('transactionRef') ?? '')
      .trim()
      .slice(0, 40) || undefined;
  const result = await ordersService.uploadPaymentProof(number.data, access, screenshot, reference);
  if (!result.ok) return error(result.error);
  refresh();
  return {
    status: 'success',
    message: 'Screenshot received — we’ll verify your payment shortly.',
    at: Date.now(),
  };
}

/** Cancels a pending, unpaid order (its stock is released). */
export async function cancelOrderAction(
  orderNumber: string,
  key?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const number = numberSchema.safeParse(orderNumber);
  const access = await accessFor(key);
  if (!number.success || !access)
    return { ok: false, error: 'Please reload the page and try again.' };
  const result = await ordersService.cancelOrder(number.data, access);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}
