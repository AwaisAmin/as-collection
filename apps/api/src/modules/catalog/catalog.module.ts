import { Module } from '@nestjs/common';

import { AdminAttributesService } from './admin/admin-attributes.service.js';
import { AdminCategoriesService } from './admin/admin-categories.service.js';
import { AdminCollectionsService } from './admin/admin-collections.service.js';
import { AdminInventoryService } from './admin/admin-inventory.service.js';
import {
  AdminInventoryController,
  AdminProductsController,
} from './admin/admin-products.controller.js';
import { AdminProductsService } from './admin/admin-products.service.js';
import {
  AdminAttributesController,
  AdminBrandsController,
  AdminCategoriesController,
  AdminCollectionsController,
} from './admin/admin-taxonomy.controller.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  controllers: [
    CatalogController,
    AdminProductsController,
    AdminInventoryController,
    AdminCategoriesController,
    AdminAttributesController,
    AdminBrandsController,
    AdminCollectionsController,
  ],
  providers: [
    CatalogService,
    AdminProductsService,
    AdminInventoryService,
    AdminCategoriesService,
    AdminAttributesService,
    AdminCollectionsService,
  ],
  exports: [CatalogService],
})
export class CatalogModule {}
