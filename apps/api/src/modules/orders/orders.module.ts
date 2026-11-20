import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { AdminDiscountsController } from './admin/admin-discounts.controller.js';
import { AdminDiscountsService } from './admin/admin-discounts.service.js';
import { AdminOrdersController } from './admin/admin-orders.controller.js';
import { AdminOrdersService } from './admin/admin-orders.service.js';
import { CheckoutService } from './checkout.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { StoreSettingsService } from './store-settings.service.js';

/**
 * Checkout (quotes, placement), order access, tracking, cancellation and payment proofs, plus
 * the staff side (workflow, payment review, discount codes) under /admin.
 */
@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [OrdersController, AdminOrdersController, AdminDiscountsController],
  providers: [
    CheckoutService,
    OrdersService,
    StoreSettingsService,
    AdminOrdersService,
    AdminDiscountsService,
  ],
  exports: [CheckoutService, OrdersService, StoreSettingsService, AdminOrdersService],
})
export class OrdersModule {}
