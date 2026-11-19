import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { CheckoutService } from './checkout.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { StoreSettingsService } from './store-settings.service.js';

/** Checkout (quotes, placement), order access, tracking, cancellation and payment proofs. */
@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [OrdersController],
  providers: [CheckoutService, OrdersService, StoreSettingsService],
  exports: [CheckoutService, OrdersService, StoreSettingsService],
})
export class OrdersModule {}
