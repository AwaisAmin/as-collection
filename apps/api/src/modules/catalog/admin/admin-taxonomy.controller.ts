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
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import type { AuditActor } from '../../audit/audit.service.js';
import { Actor, Staff } from '../../staff/staff-auth.guard.js';
import { AdminAttributesService } from './admin-attributes.service.js';
import { AdminCategoriesService } from './admin-categories.service.js';
import { AdminCollectionsService } from './admin-collections.service.js';
import {
  adminCollectionRulesSchema,
  attributeValueSchema,
  collectionProductsSchema,
  createAttributeSchema,
  createBrandSchema,
  createCategorySchema,
  createCollectionSchema,
  reorderSchema,
  updateAttributeSchema,
  updateAttributeValueSchema,
  updateBrandSchema,
  updateCategorySchema,
  updateCollectionSchema,
} from './taxonomy.schemas.js';

type In<T extends z.ZodType> = z.infer<T>;
const idParam = { schema: z.uuid() };
const NO_STORE = 'no-store';

@ApiTags('Admin · Categories')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: AdminCategoriesService) {}

  @Get()
  @Staff('catalog.read')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'The whole category tree, active or not, with product counts' })
  tree() {
    return this.categories.tree();
  }

  @Get(':id')
  @Staff('catalog.read')
  @Header('Cache-Control', NO_STORE)
  get(@Param('id', idParam) id: string) {
    return this.categories.get(id);
  }

  @Post()
  @Staff('catalog.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Create a category (at the end of its parent’s children)' })
  create(
    @Body({ schema: createCategorySchema }) body: In<typeof createCategorySchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.categories.create(body, actor);
  }

  @Post('reorder')
  @HttpCode(HttpStatus.OK)
  @Staff('catalog.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Set the order of one parent’s children (returns the tree)' })
  reorder(
    @Body({ schema: reorderSchema }) body: In<typeof reorderSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.categories.reorder(body.parentId, body.ids, actor);
  }

  @Patch(':id')
  @Staff('catalog.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({
    summary: 'Edit or move a category',
    description: 'Send `updatedAt` from your last read. `parentId` moves it with its subtree.',
  })
  update(
    @Param('id', idParam) id: string,
    @Body({ schema: updateCategorySchema }) body: In<typeof updateCategorySchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.categories.update(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff('catalog.write')
  @ApiOperation({ summary: 'Delete an empty category (no subcategories, not a main category)' })
  async remove(@Param('id', idParam) id: string, @Actor() actor: AuditActor): Promise<void> {
    await this.categories.remove(id, actor);
  }
}

@ApiTags('Admin · Attributes')
@Controller('admin/attributes')
export class AdminAttributesController {
  constructor(private readonly attributes: AdminAttributesService) {}

  @Get()
  @Staff('catalog.read')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'All attributes with their values and usage' })
  list() {
    return this.attributes.list();
  }

  @Get(':id')
  @Staff('catalog.read')
  @Header('Cache-Control', NO_STORE)
  get(@Param('id', idParam) id: string) {
    return this.attributes.get(id);
  }

  @Post()
  @Staff('catalog.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Create an attribute (filter or variant option) with its values' })
  create(
    @Body({ schema: createAttributeSchema }) body: In<typeof createAttributeSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.attributes.create(body, actor);
  }

  @Patch(':id')
  @Staff('catalog.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Edit an attribute (type and scope only while unused)' })
  update(
    @Param('id', idParam) id: string,
    @Body({ schema: updateAttributeSchema }) body: In<typeof updateAttributeSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.attributes.update(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff('catalog.write')
  @ApiOperation({ summary: 'Delete an unused attribute' })
  async remove(@Param('id', idParam) id: string, @Actor() actor: AuditActor): Promise<void> {
    await this.attributes.remove(id, actor);
  }

  @Post(':id/values')
  @Staff('catalog.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Add a value (returns the attribute)' })
  addValue(
    @Param('id', idParam) id: string,
    @Body({ schema: attributeValueSchema }) body: In<typeof attributeValueSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.attributes.addValue(id, body, actor);
  }

  @Patch(':id/values/:valueId')
  @Staff('catalog.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Edit a value’s label, swatch or position (returns the attribute)' })
  updateValue(
    @Param('id', idParam) id: string,
    @Param('valueId', idParam) valueId: string,
    @Body({ schema: updateAttributeValueSchema }) body: In<typeof updateAttributeValueSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.attributes.updateValue(id, valueId, body, actor);
  }

  @Delete(':id/values/:valueId')
  @Staff('catalog.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Delete an unused value (returns the attribute)' })
  removeValue(
    @Param('id', idParam) id: string,
    @Param('valueId', idParam) valueId: string,
    @Actor() actor: AuditActor,
  ) {
    return this.attributes.removeValue(id, valueId, actor);
  }
}

@ApiTags('Admin · Brands')
@Controller('admin/brands')
export class AdminBrandsController {
  constructor(private readonly attributes: AdminAttributesService) {}

  @Get()
  @Staff('catalog.read')
  @Header('Cache-Control', NO_STORE)
  list() {
    return this.attributes.brands();
  }

  @Post()
  @Staff('catalog.write')
  @Header('Cache-Control', NO_STORE)
  create(
    @Body({ schema: createBrandSchema }) body: In<typeof createBrandSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.attributes.createBrand(body, actor);
  }

  @Patch(':id')
  @Staff('catalog.write')
  @Header('Cache-Control', NO_STORE)
  update(
    @Param('id', idParam) id: string,
    @Body({ schema: updateBrandSchema }) body: In<typeof updateBrandSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.attributes.updateBrand(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff('catalog.write')
  @ApiOperation({ summary: 'Delete a brand no product uses' })
  async remove(@Param('id', idParam) id: string, @Actor() actor: AuditActor): Promise<void> {
    await this.attributes.removeBrand(id, actor);
  }
}

@ApiTags('Admin · Collections')
@Controller('admin/collections')
export class AdminCollectionsController {
  constructor(private readonly collections: AdminCollectionsService) {}

  @Get()
  @Staff('catalog.read')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'All collections with state (live, scheduled, ended, hidden) and size' })
  list() {
    return this.collections.list();
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @Staff('catalog.read')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Which live products automated rules match, before saving' })
  preview(
    @Body({ schema: z.object({ rules: adminCollectionRulesSchema }) })
    body: {
      rules: In<typeof adminCollectionRulesSchema>;
    },
  ) {
    return this.collections.preview(body.rules);
  }

  @Post('reorder')
  @HttpCode(HttpStatus.OK)
  @Staff('catalog.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Set the display order of all collections' })
  reorder(
    @Body({ schema: z.object({ ids: z.array(z.uuid()).min(1).max(1_000) }) })
    body: { ids: string[] },
    @Actor() actor: AuditActor,
  ) {
    return this.collections.reorder(body.ids, actor);
  }

  @Get(':id')
  @Staff('catalog.read')
  @Header('Cache-Control', NO_STORE)
  get(@Param('id', idParam) id: string) {
    return this.collections.get(id);
  }

  @Post()
  @Staff('catalog.write')
  @Header('Cache-Control', NO_STORE)
  create(
    @Body({ schema: createCollectionSchema }) body: In<typeof createCollectionSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.collections.create(body, actor);
  }

  @Patch(':id')
  @Staff('catalog.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Edit a collection (send `updatedAt` from your last read)' })
  update(
    @Param('id', idParam) id: string,
    @Body({ schema: updateCollectionSchema }) body: In<typeof updateCollectionSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.collections.update(id, body, actor);
  }

  @Put(':id/products')
  @Staff('catalog.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Replace a hand-picked collection’s products, in order' })
  setProducts(
    @Param('id', idParam) id: string,
    @Body({ schema: collectionProductsSchema }) body: In<typeof collectionProductsSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.collections.setProducts(id, body.productIds, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff('catalog.write')
  async remove(@Param('id', idParam) id: string, @Actor() actor: AuditActor): Promise<void> {
    await this.collections.remove(id, actor);
  }
}
