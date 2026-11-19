import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, type NodeResponse } from '@nestjs/platform-node';
import { ApiBearerAuth, ApiConsumes, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';

import { ValidationFailedException } from '../../common/http/problem-details.js';
import { StrictRateLimit } from '../../common/http/rate-limit.js';
import {
  CurrentSession,
  CustomerAuthGuard,
  OptionalCustomerAuthGuard,
  OptionalSession,
} from '../auth/customer-auth.guard.js';
import type { AuthSession } from '../auth/session.service.js';
import {
  accountOrdersQuerySchema,
  idempotencyKeySchema,
  orderNumberParamSchema,
  type PaymentProofFields,
  paymentProofFieldsSchema,
  type PlaceOrderBody,
  placeOrderSchema,
  type QuoteBody,
  quoteSchema,
  trackOrderSchema,
} from './checkout.schemas.js';
import { CheckoutService } from './checkout.service.js';
import { MAX_PROOF_BYTES, OrdersService } from './orders.service.js';

const ACCESS_KEY_HEADER = 'x-order-access-key';

const orderAccessHeader = ApiHeader({
  name: 'X-Order-Access-Key',
  required: false,
  description:
    'Key from the order confirmation (guests). Signed-in owners send their bearer token.',
});

/**
 * Checkout and orders. Every response is `no-store`: orders hold personal data. Amounts are
 * integer paisa. Guests prove ownership with the access key returned at checkout.
 */
@ApiTags('Orders')
@Controller()
export class OrdersController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly orders: OrdersService,
  ) {}

  @Post('checkout/quote')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @UseGuards(OptionalCustomerAuthGuard)
  @ApiOperation({
    summary: 'Price a cart: live prices, stock problems, coupon, shipping and totals',
  })
  quote(@Body({ schema: quoteSchema }) body: QuoteBody) {
    return this.checkout.quote(body);
  }

  @Post('orders')
  @StrictRateLimit()
  @Header('Cache-Control', 'no-store')
  @UseGuards(OptionalCustomerAuthGuard)
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: '16–64 URL-safe chars' })
  @ApiOperation({
    summary: 'Place an order (COD or manual transfer)',
    description:
      '201 with the order and its access key; 200 when replaying the same Idempotency-Key. ' +
      '409 OUT_OF_STOCK / PRICE_CHANGED / DISCOUNT_INVALID include a fresh `quote`.',
  })
  async placeOrder(
    @Body({ schema: placeOrderSchema }) body: PlaceOrderBody,
    @Headers('idempotency-key') rawKey: string | undefined,
    @OptionalSession() session: AuthSession | null,
    @Res({ passthrough: true }) res: NodeResponse,
  ) {
    const key = idempotencyKeySchema.safeParse(rawKey);
    if (!key.success) {
      throw new ValidationFailedException([
        { path: 'Idempotency-Key', message: key.error.issues[0]?.message ?? 'Invalid header.' },
      ]);
    }
    const placed = await this.checkout.placeOrder(body, key.data, session?.customerId ?? null);
    res.statusCode = placed.replayed ? HttpStatus.OK : HttpStatus.CREATED;
    res.setHeader('Location', `/api/v1/orders/${placed.order.number}`);
    return { order: placed.order, accessKey: placed.accessKey };
  }

  @Get('orders/:number')
  @Header('Cache-Control', 'no-store')
  @UseGuards(OptionalCustomerAuthGuard)
  @orderAccessHeader
  @ApiOperation({ summary: 'Order details for its owner (access key or session)' })
  get(
    @Param('number', { schema: orderNumberParamSchema }) number: string,
    @Headers(ACCESS_KEY_HEADER) accessKey: string | undefined,
    @OptionalSession() session: AuthSession | null,
  ) {
    return this.orders.get(number, { accessKey, customerId: session?.customerId });
  }

  @Post('orders/:number/cancel')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @UseGuards(OptionalCustomerAuthGuard)
  @orderAccessHeader
  @ApiOperation({ summary: 'Cancel a pending, unpaid order (releases its stock)' })
  cancel(
    @Param('number', { schema: orderNumberParamSchema }) number: string,
    @Headers(ACCESS_KEY_HEADER) accessKey: string | undefined,
    @OptionalSession() session: AuthSession | null,
  ) {
    return this.orders.cancel(number, { accessKey, customerId: session?.customerId });
  }

  @Post('orders/:number/payment-proof')
  @HttpCode(HttpStatus.CREATED)
  @StrictRateLimit()
  @Header('Cache-Control', 'no-store')
  @UseGuards(OptionalCustomerAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      // One file, a few text fields, nothing else: bounded memory per request.
      limits: { fileSize: MAX_PROOF_BYTES, files: 1, fields: 4, parts: 5, fieldSize: 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @orderAccessHeader
  @ApiOperation({
    summary: 'Upload a transfer screenshot (JPG, PNG or WEBP, max 5 MB)',
    description: 'multipart/form-data: `file`, optional `reference` and `amountMinor`.',
  })
  uploadPaymentProof(
    @Param('number', { schema: orderNumberParamSchema }) number: string,
    @Headers(ACCESS_KEY_HEADER) accessKey: string | undefined,
    @OptionalSession() session: AuthSession | null,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @Body({ schema: paymentProofFieldsSchema }) fields: PaymentProofFields,
  ) {
    return this.orders.uploadPaymentProof(
      number,
      { accessKey, customerId: session?.customerId },
      file,
      fields,
    );
  }

  @Post('orders/track')
  @HttpCode(HttpStatus.OK)
  @StrictRateLimit()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Track an order by number + checkout phone (no personal details)' })
  track(@Body({ schema: trackOrderSchema }) body: z.infer<typeof trackOrderSchema>) {
    return this.orders.track(body.number, body.phone);
  }

  // ─── Signed-in customer ───

  @Get('account/orders')
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Order history (incl. guest orders linked by verified phone)' })
  history(
    @CurrentSession() session: AuthSession,
    @Query({ schema: accountOrdersQuerySchema }) query: z.infer<typeof accountOrdersQuerySchema>,
  ) {
    return this.orders.listForCustomer(session.customerId, query.page, query.pageSize);
  }

  @Get('account/orders/:number')
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  accountOrder(
    @CurrentSession() session: AuthSession,
    @Param('number', { schema: orderNumberParamSchema }) number: string,
  ) {
    return this.orders.getForCustomer(session.customerId, number);
  }
}
