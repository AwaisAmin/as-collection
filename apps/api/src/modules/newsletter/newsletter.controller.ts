import { Body, Controller, Header, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { StrictRateLimit } from '../../common/http/rate-limit.js';
import {
  type SubscribeBody,
  subscribeSchema,
  type UnsubscribeBody,
  unsubscribeSchema,
} from './newsletter.schemas.js';
import { NewsletterService } from './newsletter.service.js';

@ApiTags('Newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post('subscriptions')
  @HttpCode(HttpStatus.OK)
  @StrictRateLimit()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Subscribe an email (re-subscribing records fresh consent)' })
  subscribe(@Body({ schema: subscribeSchema }) body: SubscribeBody) {
    return this.newsletter.subscribe(body.email, body.source);
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @StrictRateLimit()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Unsubscribe with the signed token from a newsletter email' })
  async unsubscribe(@Body({ schema: unsubscribeSchema }) body: UnsubscribeBody) {
    await this.newsletter.unsubscribe(body.email, body.token);
  }
}
