import { Body, Controller, Header, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { StrictRateLimit } from '../../common/http/rate-limit.js';
import { Client } from '../auth/customer-auth.guard.js';
import type { ClientInfo } from '../auth/session.service.js';
import { type ContactMessageBody, contactMessageSchema } from './contact.schemas.js';
import { ContactService } from './contact.service.js';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @StrictRateLimit()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Send a message to the store (phone or email required for the reply)',
    description: '202 `{ received: true }`; 429 CONTACT_RATE_LIMITED after 5 per hour per IP.',
  })
  submit(
    @Body({ schema: contactMessageSchema }) body: ContactMessageBody,
    @Client() client: ClientInfo,
  ) {
    return this.contact.submit(body, client.ip);
  }
}
