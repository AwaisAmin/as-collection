'use server';

import { z } from 'zod';

import { authService } from '@/features/auth/services/auth.service';
import { getCurrentUser, getSessionToken } from '@/features/auth/session';
import { ordersService } from '@/features/orders/services/orders.service';
import { clientInfo } from '@/lib/api/client-ip';
import { ApiError } from '@/lib/api/http-client';
import { reportError } from '@/lib/errors/report-error';
import { sniffImageType } from '@/lib/utils/sniff-image';

import {
  type CheckoutField,
  checkoutFieldsSchema,
  checkoutLinesSchema,
  fieldErrorsFrom,
  validateScreenshot,
} from './schemas';
import type { CheckoutState } from './types';

const metaSchema = z.object({
  checkoutId: z.uuid(),
  expectedTotal: z.coerce.number().int().nonnegative(),
});

function fail(
  fieldErrors: Partial<Record<CheckoutField, string>>,
  message?: string,
  extra: Partial<Extract<CheckoutState, { status: 'error' }>> = {},
): CheckoutState {
  return { status: 'error', fieldErrors, message, at: Date.now(), ...extra };
}

export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const text = (key: string) => String(formData.get(key) ?? '');

  const fields = checkoutFieldsSchema.safeParse({
    fullName: text('fullName'),
    phone: text('phone'),
    email: text('email'),
    city: text('city'),
    address: text('address'),
    postalCode: text('postalCode'),
    notes: text('notes'),
    paymentMethod: text('paymentMethod') || undefined,
    transferChannel: text('transferChannel') || undefined,
    transactionRef: text('transactionRef'),
  });

  const fieldErrors: Partial<Record<CheckoutField, string>> = fields.success
    ? {}
    : fieldErrorsFrom(fields.error);

  // Payment proof (manual transfers only): size/type checks + real file signature.
  let screenshot: File | undefined;
  if (text('paymentMethod') === 'bank_transfer') {
    const file = formData.get('screenshot');
    const problem = validateScreenshot(file instanceof File ? file : null);
    if (problem) {
      fieldErrors.screenshot = problem;
    } else {
      const f = file as File;
      const head = new Uint8Array(await f.slice(0, 16).arrayBuffer());
      const realType = sniffImageType(head);
      if (!realType) fieldErrors.screenshot = 'That file doesn’t look like a valid image.';
      else screenshot = f;
    }
  }

  if (!fields.success || Object.keys(fieldErrors).length > 0) {
    return fail(fieldErrors, 'Please check the highlighted fields.');
  }

  const meta = metaSchema.safeParse({
    checkoutId: text('checkoutId'),
    expectedTotal: text('expectedTotal'),
  });
  let lines: z.output<typeof checkoutLinesSchema>;
  try {
    lines = checkoutLinesSchema.parse(JSON.parse(text('lines') || '[]'));
  } catch {
    return fail({}, 'Your cart could not be read. Please refresh the page and try again.');
  }
  if (!meta.success) return fail({}, 'Something went wrong. Please refresh and try again.');

  const f = fields.data;
  const user = await getCurrentUser();
  const token = await getSessionToken();
  try {
    const result = await ordersService.placeOrder(
      {
        checkoutId: meta.data.checkoutId,
        userId: user?.id,
        expectedTotal: meta.data.expectedTotal,
        customer: { fullName: f.fullName, phone: f.phone, email: f.email || undefined },
        shipping: {
          city: f.city,
          address: f.address,
          postalCode: f.postalCode || undefined,
          notes: f.notes || undefined,
        },
        payment: {
          method: f.paymentMethod,
          channel: f.paymentMethod === 'bank_transfer' ? f.transferChannel : undefined,
          transactionRef: f.transactionRef || undefined,
          screenshot,
        },
        lines,
      },
      { token, ...(await clientInfo()) },
    );

    if (!result.ok) {
      return fail(
        {},
        result.reason === 'stock_changed'
          ? 'Some items in your cart just sold out or have less stock. We updated your cart — please review it and place your order again.'
          : 'Prices in your cart changed. We updated your cart — please review the new total and place your order again.',
        { snapshots: result.snapshots, ...(result.shipping ? { shipping: result.shipping } : {}) },
      );
    }

    // Best-effort: saving to the address book must never fail a placed order.
    if (user && token && formData.get('saveAddress') === 'on') {
      try {
        const existing = await authService.listAddresses(token);
        const duplicate = existing.some(
          (a) => a.city.toLowerCase() === f.city.toLowerCase() && a.address === f.address,
        );
        if (!duplicate) {
          await authService.saveAddress(token, {
            label: existing.length === 0 ? 'Home' : `Address ${existing.length + 1}`,
            recipientName: f.fullName,
            phone: f.phone,
            city: f.city,
            address: f.address,
            postalCode: f.postalCode || undefined,
          });
        }
      } catch (error) {
        reportError(error, { action: 'checkout.saveAddress' });
      }
    }

    return {
      status: 'success',
      orderNumber: result.order.orderNumber,
      accessKey: result.accessKey,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      return fail(
        {},
        error.problem?.errors?.[0]?.message ?? 'Please check your details and try again.',
      );
    }
    if (error instanceof ApiError && error.status === 429) {
      return fail({}, 'Too many attempts. Please wait a minute and try again.');
    }
    reportError(error, { action: 'checkout.placeOrder' });
    return fail({}, 'We couldn’t place your order right now. Please try again in a moment.');
  }
}
