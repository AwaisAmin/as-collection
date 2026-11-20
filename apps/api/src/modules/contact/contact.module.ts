import { Module } from '@nestjs/common';

import { AdminContactController, AdminContactService } from './admin/admin-contact.js';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';

@Module({
  controllers: [ContactController, AdminContactController],
  providers: [ContactService, AdminContactService],
})
export class ContactModule {}
