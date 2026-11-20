import { Module } from '@nestjs/common';

import { AdminNewsletterController, AdminNewsletterService } from './admin/admin-newsletter.js';
import { NewsletterController } from './newsletter.controller.js';
import { NewsletterService } from './newsletter.service.js';

@Module({
  controllers: [NewsletterController, AdminNewsletterController],
  providers: [NewsletterService, AdminNewsletterService],
  exports: [NewsletterService],
})
export class NewsletterModule {}
