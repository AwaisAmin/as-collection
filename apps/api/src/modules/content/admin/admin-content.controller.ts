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
import {
  createPageSchema,
  createSectionSchema,
  menuKeyParamSchema,
  putMenuSchema,
  putSettingSchema,
  reorderIdsSchema,
  updatePageSchema,
  updateSectionSchema,
} from './admin-content.schemas.js';
import { AdminContentService } from './admin-content.service.js';
import { AdminSettingsService } from './admin-settings.service.js';

type In<T extends z.ZodType> = z.infer<T>;
const idParam = { schema: z.uuid() };
const NO_STORE = 'no-store';

@ApiTags('Admin · Pages')
@Controller('admin/pages')
export class AdminPagesController {
  constructor(private readonly content: AdminContentService) {}

  @Get()
  @Staff('content.write')
  @Header('Cache-Control', NO_STORE)
  list() {
    return this.content.pages();
  }

  @Get(':id')
  @Staff('content.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'A page with every section (hidden, scheduled and invalid flagged)' })
  get(@Param('id', idParam) id: string) {
    return this.content.page(id);
  }

  @Post()
  @Staff('content.write')
  @Header('Cache-Control', NO_STORE)
  create(
    @Body({ schema: createPageSchema }) body: In<typeof createPageSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.content.createPage(body, actor);
  }

  @Patch(':id')
  @Staff('content.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Edit title, address, status or SEO (send `updatedAt`)' })
  update(
    @Param('id', idParam) id: string,
    @Body({ schema: updatePageSchema }) body: In<typeof updatePageSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.content.updatePage(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff('content.write')
  async remove(@Param('id', idParam) id: string, @Actor() actor: AuditActor): Promise<void> {
    await this.content.removePage(id, actor);
  }

  @Post(':id/sections')
  @Staff('content.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({
    summary: 'Add a section (returns the page)',
    description:
      '`settings` is validated by the section type’s schema, as the storefront reads it.',
  })
  addSection(
    @Param('id', idParam) id: string,
    @Body({ schema: createSectionSchema }) body: In<typeof createSectionSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.content.addSection(id, body, actor);
  }

  @Post(':id/sections/reorder')
  @HttpCode(HttpStatus.OK)
  @Staff('content.write')
  @Header('Cache-Control', NO_STORE)
  reorderSections(
    @Param('id', idParam) id: string,
    @Body({ schema: reorderIdsSchema }) body: In<typeof reorderIdsSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.content.reorderSections(id, body.ids, actor);
  }

  @Patch(':id/sections/:sectionId')
  @Staff('content.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Edit a section’s settings, visibility or schedule (returns the page)' })
  updateSection(
    @Param('id', idParam) id: string,
    @Param('sectionId', idParam) sectionId: string,
    @Body({ schema: updateSectionSchema }) body: In<typeof updateSectionSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.content.updateSection(id, sectionId, body, actor);
  }

  @Delete(':id/sections/:sectionId')
  @Staff('content.write')
  @Header('Cache-Control', NO_STORE)
  removeSection(
    @Param('id', idParam) id: string,
    @Param('sectionId', idParam) sectionId: string,
    @Actor() actor: AuditActor,
  ) {
    return this.content.removeSection(id, sectionId, actor);
  }
}

@ApiTags('Admin · Menus')
@Controller('admin/menus')
export class AdminMenusController {
  constructor(private readonly content: AdminContentService) {}

  @Get()
  @Staff('content.write')
  @Header('Cache-Control', NO_STORE)
  list() {
    return this.content.menus();
  }

  @Get(':key')
  @Staff('content.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'The full menu tree, hidden items included' })
  get(@Param('key', { schema: menuKeyParamSchema }) key: string) {
    return this.content.menu(key);
  }

  @Put(':key')
  @Staff('content.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({
    summary: 'Create a menu or replace its whole tree',
    description: 'At most 3 levels and 300 items. Send `updatedAt` (null for a new menu).',
  })
  put(
    @Param('key', { schema: menuKeyParamSchema }) key: string,
    @Body({ schema: putMenuSchema }) body: In<typeof putMenuSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.content.putMenu(key, body, actor);
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff('content.write')
  async remove(
    @Param('key', { schema: menuKeyParamSchema }) key: string,
    @Actor() actor: AuditActor,
  ): Promise<void> {
    await this.content.removeMenu(key, actor);
  }
}

@ApiTags('Admin · Settings')
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @Get()
  @Staff('settings.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({ summary: 'Every editable setting with its value and who changed it last' })
  list() {
    return this.settings.list();
  }

  @Get(':key')
  @Staff('settings.write')
  @Header('Cache-Control', NO_STORE)
  get(@Param('key', { schema: z.string().max(100) }) key: string) {
    return this.settings.get(key);
  }

  @Put(':key')
  @Staff('settings.write')
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({
    summary: 'Save a setting (validated by its own schema)',
    description: 'Send `updatedAt` from your last read (null if it did not exist).',
  })
  put(
    @Param('key', { schema: z.string().max(100) }) key: string,
    @Body({ schema: putSettingSchema }) body: In<typeof putSettingSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.settings.put(key, body, actor);
  }
}
