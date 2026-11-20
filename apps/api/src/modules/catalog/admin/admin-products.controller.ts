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
import { Actor, Staff } from '../../staff/staff-auth.guard.js';
import { AdminInventoryService } from './admin-inventory.service.js';
import { AdminProductsService } from './admin-products.service.js';
import {
  adjustStockSchema,
  type AdminInventoryQuery,
  adminInventoryQuerySchema,
  type AdminProductsQuery,
  adminProductsQuerySchema,
  createProductSchema,
  createVariantSchema,
  inventorySettingsSchema,
  movementsQuerySchema,
  updateProductSchema,
  updateVariantSchema,
} from './product-admin.schemas.js';

type In<T extends z.ZodType> = z.infer<T>;
const idParam = { schema: z.uuid() };

/**
 * Staff product editing. Writes return the full product (with the new `updatedAt` to send on
 * the next save); every write is audited and refreshes the storefront cache.
 */
@ApiTags('Admin · Products')
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: AdminProductsService) {}

  @Get()
  @Staff('catalog.read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Search and filter products (`q`: name, slug or SKU prefix)' })
  list(@Query({ schema: adminProductsQuerySchema }) query: AdminProductsQuery) {
    return this.products.list(query);
  }

  @Get(':id')
  @Staff('catalog.read')
  @Header('Cache-Control', 'no-store')
  get(@Param('id', idParam) id: string) {
    return this.products.get(id);
  }

  @Post()
  @Staff('catalog.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Create a product with its variants',
    description:
      'The slug is generated from the name when omitted. Initial stock is ledgered as RESTOCK.',
  })
  create(
    @Body({ schema: createProductSchema }) body: In<typeof createProductSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.products.create(body, actor);
  }

  @Patch(':id')
  @Staff('catalog.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Edit a product',
    description:
      'Send `updatedAt` from your last read; 409 STALE_UPDATE if someone saved in between. ' +
      'List fields replace the whole list.',
  })
  update(
    @Param('id', idParam) id: string,
    @Body({ schema: updateProductSchema }) body: In<typeof updateProductSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.products.update(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff('catalog.write')
  @ApiOperation({ summary: 'Delete a never-ordered product (archive ordered ones instead)' })
  async remove(@Param('id', idParam) id: string, @Actor() actor: AuditActor): Promise<void> {
    await this.products.remove(id, actor);
  }

  @Post(':id/variants')
  @Staff('catalog.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Add a variant (returns the product)' })
  createVariant(
    @Param('id', idParam) id: string,
    @Body({ schema: createVariantSchema }) body: In<typeof createVariantSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.products.createVariant(id, body, actor);
  }

  @Patch(':id/variants/:variantId')
  @Staff('catalog.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Edit a variant: SKU, prices, options, active (returns the product)' })
  updateVariant(
    @Param('id', idParam) id: string,
    @Param('variantId', idParam) variantId: string,
    @Body({ schema: updateVariantSchema }) body: In<typeof updateVariantSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.products.updateVariant(id, variantId, body, actor);
  }

  @Delete(':id/variants/:variantId')
  @Staff('catalog.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Delete a never-ordered variant (returns the product)' })
  removeVariant(
    @Param('id', idParam) id: string,
    @Param('variantId', idParam) variantId: string,
    @Actor() actor: AuditActor,
  ) {
    return this.products.removeVariant(id, variantId, actor);
  }
}

/** Stock levels, ledgered adjustments and per-variant stock settings. */
@ApiTags('Admin · Inventory')
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private readonly inventory: AdminInventoryService) {}

  @Get()
  @Staff('catalog.read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Stock per variant (`stock`: all, low, out, backorder)' })
  list(@Query({ schema: adminInventoryQuerySchema }) query: AdminInventoryQuery) {
    return this.inventory.list(query);
  }

  @Post('adjustments')
  @HttpCode(HttpStatus.OK)
  @Staff('inventory.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Change stock (all lines or none)',
    description: 'Each line `add` (±) or `set` (a stock count). Ledgered with the reason.',
  })
  adjust(
    @Body({ schema: adjustStockSchema }) body: In<typeof adjustStockSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.inventory.adjust(body, actor);
  }

  @Patch(':variantId')
  @Staff('inventory.write')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Low-stock alert level, tracking and backorders' })
  updateSettings(
    @Param('variantId', idParam) variantId: string,
    @Body({ schema: inventorySettingsSchema }) body: In<typeof inventorySettingsSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.inventory.updateSettings(variantId, body, actor);
  }

  @Get(':variantId/movements')
  @Staff('catalog.read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Stock history, newest first' })
  movements(
    @Param('variantId', idParam) variantId: string,
    @Query({ schema: movementsQuerySchema }) query: In<typeof movementsQuerySchema>,
  ) {
    return this.inventory.movements(variantId, query);
  }
}
