import 'server-only';

import type {
  DiscountRejection,
  OrderDto,
  OrderPageDto,
  PlacedOrderDto,
  QuoteDto,
  TrackedOrderDto,
} from '@as/contracts';

import { env } from '@/config/env';
import { siteConfig } from '@/config/site';
import { toMinor, toRupees } from '@/features/catalog/services/api-mappers';
import { ApiError, apiFindOrNull, apiRequest, type RequestOptions } from '@/lib/api/http-client';
import { reportError } from '@/lib/errors/report-error';

import {
  quoteShippingRules,
  quoteSnapshots,
  toApiPaymentMethod,
  toOrder,
  toOrderSummary,
  toTrackedOrder,
} from '../lib/order-mappers';
import type { OrderAccess, PlaceOrderResult } from '../types';
import type { DiscountCheck, OrderActionResult, OrdersService } from './orders.service';

/* Adapter: the NestJS checkout and orders API. Order reads are never cached (personal data). */

const SITE_ORIGIN = new URL(env.NEXT_PUBLIC_SITE_URL).origin;
const orderPath = (number: string) => `/orders/${encodeURIComponent(number)}`;

/** Access key (guest confirmation link) or the customer's session. */
const accessOptions = (access: OrderAccess): Pick<RequestOptions, 'headers' | 'token'> =>
  'accessKey' in access
    ? { headers: { 'X-Order-Access-Key': access.accessKey } }
    : { token: access.token };

/** API refusals customers can act on, in plain words; anything else is reported. */
function actionFailure(error: unknown, action: string): OrderActionResult {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return { ok: false, error: error.fieldErrors.file ?? error.message };
  }
  reportError(error, { action });
  return { ok: false, error: 'Something went wrong. Please try again in a moment.' };
}

async function uploadProof(
  number: string,
  access: OrderAccess,
  file: File,
  reference: string | undefined,
): Promise<OrderDto> {
  const form = new FormData();
  form.set('file', file, file.name || 'payment.jpg');
  if (reference) form.set('reference', reference);
  return apiRequest<OrderDto>(`${orderPath(number)}/payment-proof`, {
    method: 'POST',
    body: form,
    ...accessOptions(access),
    timeoutMs: 30_000,
  });
}

/** Why a code was refused, in the shopper's words. */
export function discountMessage(reason: DiscountRejection, minSubtotalMinor?: number): string {
  switch (reason) {
    case 'NOT_FOUND':
      return 'We couldn’t find that code. Check the spelling and try again.';
    case 'INACTIVE':
      return 'This code isn’t active.';
    case 'NOT_STARTED':
      return 'This code isn’t active yet.';
    case 'EXPIRED':
      return 'This code has expired.';
    case 'USAGE_LIMIT':
      return 'This code has already been used the maximum number of times.';
    case 'MIN_SUBTOTAL':
      return minSubtotalMinor
        ? `Spend Rs ${toRupees(minSubtotalMinor).toLocaleString('en-PK')} or more to use this code.`
        : 'Your order is below this code’s minimum.';
  }
}

export const apiOrdersService: OrdersService = {
  async checkDiscount(lines, code, ctx): Promise<DiscountCheck> {
    const quote = await apiRequest<QuoteDto>('/checkout/quote', {
      method: 'POST',
      body: { lines, discountCode: code },
      token: ctx.token,
      clientIp: ctx.ip,
      userAgent: ctx.userAgent,
    });
    const result = quote.discount;
    if (!result) return { ok: false, code, message: 'This code can’t be used.' };
    if (!result.applied) {
      return {
        ok: false,
        code: result.code,
        message: discountMessage(result.reason, result.minSubtotalMinor),
      };
    }
    return {
      ok: true,
      code: result.code,
      discount: toRupees(result.discountMinor),
      freeShipping: result.freeShipping,
      total: toRupees(quote.totalMinor),
    };
  },

  async placeOrder(input, ctx): Promise<PlaceOrderResult> {
    let placed: PlacedOrderDto;
    try {
      placed = await apiRequest<PlacedOrderDto>('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': input.checkoutId },
        body: {
          customer: {
            fullName: input.customer.fullName,
            phone: input.customer.phone,
            email: input.customer.email ?? '',
          },
          shipping: {
            line1: input.shipping.address,
            city: input.shipping.city,
            postalCode: input.shipping.postalCode ?? '',
          },
          ...(input.shipping.notes ? { notes: input.shipping.notes } : {}),
          paymentMethod: toApiPaymentMethod(input.payment.method, input.payment.channel),
          lines: input.lines,
          ...(input.discountCode ? { discountCode: input.discountCode } : {}),
          expectedTotalMinor: toMinor(input.expectedTotal),
        },
        token: ctx.token,
        clientIp: ctx.ip,
        userAgent: ctx.userAgent,
        timeoutMs: 20_000,
      });
    } catch (error) {
      const quote =
        error instanceof ApiError ? (error.problem?.quote as QuoteDto | undefined) : undefined;
      if (error instanceof ApiError && error.status === 409 && quote) {
        return {
          ok: false,
          reason:
            error.code === 'OUT_OF_STOCK'
              ? 'stock_changed'
              : error.code === 'DISCOUNT_INVALID'
                ? 'discount_invalid'
                : 'price_changed',
          snapshots: quoteSnapshots(quote),
          shipping: quoteShippingRules(quote, siteConfig.shippingFee),
        };
      }
      throw error;
    }

    let order = placed.order;
    let proofUploaded = true;
    const { screenshot } = input.payment;
    if (screenshot && order.actions.canUploadPaymentProof) {
      try {
        order = await uploadProof(
          order.number,
          { accessKey: placed.accessKey },
          screenshot,
          input.payment.transactionRef,
        );
      } catch (error) {
        // The order stands; the confirmation page asks for the screenshot again.
        reportError(error, { action: 'checkout.paymentProof' });
        proofUploaded = false;
      }
    }
    return {
      ok: true,
      order: toOrder(order, SITE_ORIGIN),
      accessKey: placed.accessKey,
      proofUploaded,
    };
  },

  async getOrder(orderNumber, access) {
    const dto =
      'token' in access
        ? await apiFindOrNull<OrderDto>(`/account/orders/${encodeURIComponent(orderNumber)}`, {
            token: access.token,
          })
        : await apiFindOrNull<OrderDto>(orderPath(orderNumber), accessOptions(access)).catch(
            (error: unknown) => {
              // A wrong access key is a 403: same as "no such order" for the visitor.
              if (error instanceof ApiError && error.status === 403) return null;
              throw error;
            },
          );
    return dto ? toOrder(dto, SITE_ORIGIN) : null;
  },

  async trackOrder(orderNumber, phone, ctx) {
    const dto = await apiFindOrNull<TrackedOrderDto>('/orders/track', {
      method: 'POST',
      body: { number: orderNumber, phone },
      clientIp: ctx.ip,
    }).catch((error: unknown) => {
      // Invalid number / phone format: nothing to show.
      if (error instanceof ApiError && error.status === 422) return null;
      throw error;
    });
    return dto ? toTrackedOrder(dto, SITE_ORIGIN) : null;
  },

  async listOrders(token) {
    const page = await apiRequest<OrderPageDto>('/account/orders', {
      query: { page: 1, pageSize: 50 },
      token,
    });
    return page.items.map((o) => toOrderSummary(o, SITE_ORIGIN));
  },

  async cancelOrder(orderNumber, access) {
    try {
      const dto = await apiRequest<OrderDto>(`${orderPath(orderNumber)}/cancel`, {
        method: 'POST',
        ...accessOptions(access),
      });
      return { ok: true, order: toOrder(dto, SITE_ORIGIN) };
    } catch (error) {
      return actionFailure(error, 'orders.cancel');
    }
  },

  async uploadPaymentProof(orderNumber, access, file, reference) {
    try {
      return {
        ok: true,
        order: toOrder(await uploadProof(orderNumber, access, file, reference), SITE_ORIGIN),
      };
    } catch (error) {
      return actionFailure(error, 'orders.paymentProof');
    }
  },
};
