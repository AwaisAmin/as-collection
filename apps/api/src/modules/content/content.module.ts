import { Module } from '@nestjs/common';

import {
  AdminMenusController,
  AdminPagesController,
  AdminSettingsController,
} from './admin/admin-content.controller.js';
import { AdminContentService } from './admin/admin-content.service.js';
import { AdminSettingsService } from './admin/admin-settings.service.js';
import { ContentController } from './content.controller.js';
import { ContentService } from './content.service.js';

@Module({
  controllers: [
    ContentController,
    AdminPagesController,
    AdminMenusController,
    AdminSettingsController,
  ],
  providers: [ContentService, AdminContentService, AdminSettingsService],
  exports: [ContentService],
})
export class ContentModule {}
