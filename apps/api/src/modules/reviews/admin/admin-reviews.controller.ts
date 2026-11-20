import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import type { AuditActor } from '../../audit/audit.service.js';
import { Actor, Staff } from '../../staff/staff-auth.guard.js';
import {
  type AdminReviewsQuery,
  adminReviewsQuerySchema,
  AdminReviewsService,
  featureReviewSchema,
  rejectReviewSchema,
  replyReviewSchema,
} from './admin-reviews.service.js';

const idParam = { schema: z.uuid() };

@ApiTags('Admin · Reviews')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: AdminReviewsService) {}

  @Get()
  @Staff('reviews.moderate')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Reviews, newest first (filter by status, rating, product, text)' })
  list(@Query({ schema: adminReviewsQuerySchema }) query: AdminReviewsQuery) {
    return this.reviews.list(query);
  }

  @Get('counts')
  @Staff('reviews.moderate')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Reviews per status (PENDING = waiting for moderation)' })
  counts() {
    return this.reviews.counts();
  }

  @Get(':id')
  @Staff('reviews.moderate')
  @Header('Cache-Control', 'no-store')
  get(@Param('id', idParam) id: string) {
    return this.reviews.get(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Staff('reviews.moderate')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Publish (the product rating updates)' })
  approve(@Param('id', idParam) id: string, @Actor() actor: AuditActor) {
    return this.reviews.approve(id, actor);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Staff('reviews.moderate')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Reject or unpublish, with an internal reason' })
  reject(
    @Param('id', idParam) id: string,
    @Body({ schema: rejectReviewSchema }) body: z.infer<typeof rejectReviewSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.reviews.reject(id, body.reason, actor);
  }

  @Put(':id/featured')
  @Staff('reviews.moderate')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Pick (or unpick) a published review for the home testimonials' })
  feature(
    @Param('id', idParam) id: string,
    @Body({ schema: featureReviewSchema }) body: z.infer<typeof featureReviewSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.reviews.feature(id, body.featured, actor);
  }

  @Put(':id/reply')
  @Staff('reviews.moderate')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Public reply from the store (null removes it)' })
  reply(
    @Param('id', idParam) id: string,
    @Body({ schema: replyReviewSchema }) body: z.infer<typeof replyReviewSchema>,
    @Actor() actor: AuditActor,
  ) {
    return this.reviews.reply(id, body.reply, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff('reviews.moderate')
  @ApiOperation({ summary: 'Delete permanently (spam); rejecting keeps the record' })
  async remove(@Param('id', idParam) id: string, @Actor() actor: AuditActor): Promise<void> {
    await this.reviews.remove(id, actor);
  }
}
