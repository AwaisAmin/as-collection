import { Module } from '@nestjs/common';

import { AdminInventoryService } from './admin/admin-inventory.service.js';
import {
  AdminInventoryController,
  AdminProductsController,
} from './admin/admin-products.controller.js';
import { AdminProductsService } from './admin/admin-products.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  controllers: [CatalogController, AdminProductsController, AdminInventoryController],
  providers: [CatalogService, AdminProductsService, AdminInventoryService],
  exports: [CatalogService],
})
export class CatalogModule {}
