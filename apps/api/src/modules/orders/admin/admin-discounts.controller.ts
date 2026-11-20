import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import type { AuditActor } from '../../audit/audit.service.js';
import { Actor, Staff, StaffAnyOf } from '../../staff/staff-auth.guard.js';
import {
  createDiscountSchema,
  type ListDiscountsQuery,
  listDiscountsQuerySchema,
  updateDiscountSchema,
} from './admin-discounts.schemas.js';
import { AdminDiscountsService } from './admin-discounts.service.js';

type In<T extends z.ZodType> = z.infer<T>;
const idParam = { schema: z.uuid() };

@ApiTags('Admin · Discounts')
@Controller('admin/discounts')
export class AdminDiscountsController {
  constructor(private readonly discounts: AdminDiscountsService) {}

  @Get()
  @StaffAnyOf('discounts.write', 'orders.read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Discount codes (`state`: active, scheduled, expired, used-up, inactive)',
  })
  list(@Query({ schema: listDiscountsQuerySchema }) query: ListDiscountsQuery) {
    return this.discounts.list(query);
  }

  @Get(':id')
  @StaffAnyOf('discounts.write', 'orders.read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'A code with its results (orders, discount given, revenue)' })
  get(@Param('id', idParam) id: string) {
    return this.discounts.get(id);
  }

  @Post()
  @Staff('discounts.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Create a code',
    description: 'PERCENTAGE value in basis points (1500 = 15 %), FIXED_AMOUNT in paisa.',
  })
  create(
    @Body({ schema: createDiscountSchema }) body: In<typeof createDiscountSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.discounts.create(body, actor);
  }

  @Patch(':id')
  @Staff('discounts.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Edit a code (affects future checkouts only)' })
  update(
    @Param('id', idParam) id: string,
    @Body({ schema: updateDiscountSchema }) body: In<typeof updateDiscountSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.discounts.update(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff('discounts.write')
  @ApiOperation({ summary: 'Delete a never-used code (deactivate used ones)' })
  async remove(@Param('id', idParam) id: string, @Actor() actor: AuditActor): Promise<void> {
    await this.discounts.remove(id, actor);
  }
}
