import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';

import type { AuditActor } from '../../audit/audit.service.js';
import { Actor, Staff } from '../../staff/staff-auth.guard.js';
import { orderNumberParamSchema } from '../checkout.schemas.js';
import {
  acceptProofSchema,
  addNoteSchema,
  type AdminOrdersQuery,
  adminOrdersQuerySchema,
  cancelSchema,
  noteOnlySchema,
  proofIdParamSchema,
  refundSchema,
  rejectProofSchema,
  returnSchema,
  shipSchema,
} from './admin-orders.schemas.js';
import { AdminOrdersService } from './admin-orders.service.js';

type In<T extends z.ZodType> = z.infer<T>;
const numberParam = { schema: orderNumberParamSchema };

/**
 * Staff order management. Every response is `no-store` (personal data). State changes return
 * the updated order including `actions` (what can happen next) for the admin panel's buttons.
 */
@ApiTags('Admin · Orders')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  @Staff('orders.read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Search and filter orders',
    description: '`q`: order number, phone (any spelling) or part of the customer name.',
  })
  list(@Query({ schema: adminOrdersQuerySchema }) query: AdminOrdersQuery) {
    return this.orders.list(query);
  }

  @Get('counts')
  @Staff('orders.read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Counts per status, payment checks waiting, orders to ship' })
  counts() {
    return this.orders.counts();
  }

  @Get(':number')
  @Staff('orders.read')
  @Header('Cache-Control', 'no-store')
  get(@Param('number', numberParam) number: string) {
    return this.orders.get(number);
  }

  @Post(':number/confirm')
  @HttpCode(HttpStatus.OK)
  @Staff('orders.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Confirm (transfers: only after the payment is verified)' })
  confirm(
    @Param('number', numberParam) number: string,
    @Body({ schema: noteOnlySchema }) body: In<typeof noteOnlySchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.orders.transition(number, { action: 'confirm', ...body }, actor);
  }

  @Post(':number/process')
  @HttpCode(HttpStatus.OK)
  @Staff('orders.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Mark as being packed' })
  process(
    @Param('number', numberParam) number: string,
    @Body({ schema: noteOnlySchema }) body: In<typeof noteOnlySchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.orders.transition(number, { action: 'process', ...body }, actor);
  }

  @Post(':number/ship')
  @HttpCode(HttpStatus.OK)
  @Staff('orders.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Hand over to the courier (reserved stock becomes a sale)',
    description: '409 INSUFFICIENT_STOCK when a tracked variant is not physically in stock.',
  })
  ship(
    @Param('number', numberParam) number: string,
    @Body({ schema: shipSchema }) body: In<typeof shipSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.orders.transition(number, { action: 'ship', ...body }, actor);
  }

  @Post(':number/deliver')
  @HttpCode(HttpStatus.OK)
  @Staff('orders.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Mark delivered (cash on delivery becomes PAID)' })
  deliver(
    @Param('number', numberParam) number: string,
    @Body({ schema: noteOnlySchema }) body: In<typeof noteOnlySchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.orders.transition(number, { action: 'deliver', ...body }, actor);
  }

  @Post(':number/cancel')
  @HttpCode(HttpStatus.OK)
  @Staff('orders.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Cancel before shipping (releases stock and the coupon use)' })
  cancel(
    @Param('number', numberParam) number: string,
    @Body({ schema: cancelSchema }) body: In<typeof cancelSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.orders.transition(number, { action: 'cancel', ...body }, actor);
  }

  @Post(':number/return')
  @HttpCode(HttpStatus.OK)
  @Staff('orders.refund')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Record a return (optionally put the items back in stock)' })
  returnOrder(
    @Param('number', numberParam) number: string,
    @Body({ schema: returnSchema }) body: In<typeof returnSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.orders.transition(number, { action: 'return', ...body }, actor);
  }

  @Post(':number/refund')
  @HttpCode(HttpStatus.OK)
  @Staff('orders.refund')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Record a refund of a paid, cancelled or returned order' })
  refund(
    @Param('number', numberParam) number: string,
    @Body({ schema: refundSchema }) body: In<typeof refundSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.orders.transition(number, { action: 'refund', ...body }, actor);
  }

  @Post(':number/notes')
  @HttpCode(HttpStatus.CREATED)
  @Staff('orders.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Add a note (internal by default, or shown to the customer)' })
  addNote(
    @Param('number', numberParam) number: string,
    @Body({ schema: addNoteSchema }) body: In<typeof addNoteSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.orders.addNote(number, body.note, body.customerVisible, actor);
  }

  // ─── Payment proofs ───

  @Get(':number/payment-proofs/:proofId/url')
  @Staff('payments.review')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Signed 5-minute link to the screenshot (each view is audited)' })
  proofUrl(
    @Param('number', numberParam) number: string,
    @Param('proofId', { schema: proofIdParamSchema }) proofId: string,
    @Actor() actor: AuditActor,
  ) {
    return this.orders.proofUrl(number, proofId, actor);
  }

  @Post(':number/payment-proofs/:proofId/accept')
  @HttpCode(HttpStatus.OK)
  @Staff('payments.review')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Payment received → PAID (a pending order is confirmed too)' })
  acceptProof(
    @Param('number', numberParam) number: string,
    @Param('proofId', { schema: proofIdParamSchema }) proofId: string,
    @Body({ schema: acceptProofSchema }) body: In<typeof acceptProofSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.orders.acceptProof(number, proofId, body.note, actor);
  }

  @Post(':number/payment-proofs/:proofId/reject')
  @HttpCode(HttpStatus.OK)
  @Staff('payments.review')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Reject with a reason shown to the customer (they can re-upload)' })
  rejectProof(
    @Param('number', numberParam) number: string,
    @Param('proofId', { schema: proofIdParamSchema }) proofId: string,
    @Body({ schema: rejectProofSchema }) body: In<typeof rejectProofSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.orders.rejectProof(number, proofId, body.reason, actor);
  }
}
