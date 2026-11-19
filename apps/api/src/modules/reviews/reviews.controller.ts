import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';

import { StrictRateLimit } from '../../common/http/rate-limit.js';
import { Client, OptionalCustomerAuthGuard, OptionalSession } from '../auth/customer-auth.guard.js';
import type { AuthSession, ClientInfo } from '../auth/session.service.js';
import { slugSchema } from '../catalog/catalog.schemas.js';
import {
  featuredReviewsQuerySchema,
  type ListReviewsQuery,
  listReviewsQuerySchema,
  reviewIdParamSchema,
  type SubmitReviewBody,
  submitReviewSchema,
} from './reviews.schemas.js';
import { ReviewsService } from './reviews.service.js';

const PUBLIC_CACHE = 'public, max-age=60, stale-while-revalidate=300';

/** Public product reviews (approved only) and moderated submissions. */
@ApiTags('Reviews')
@Controller('catalog')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('products/:slug/reviews')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Approved reviews of a product (sorted, paginated)' })
  list(
    @Param('slug', { schema: slugSchema }) slug: string,
    @Query({ schema: listReviewsQuerySchema }) query: ListReviewsQuery,
  ) {
    return this.reviews.list(slug, query);
  }

  @Get('products/:slug/reviews/summary')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Average, count and per-star distribution for a product' })
  summary(@Param('slug', { schema: slugSchema }) slug: string) {
    return this.reviews.summary(slug);
  }

  @Post('products/:slug/reviews')
  @HttpCode(HttpStatus.ACCEPTED)
  @StrictRateLimit()
  @Header('Cache-Control', 'no-store')
  @UseGuards(OptionalCustomerAuthGuard)
  @ApiOperation({
    summary: 'Submit a review (held for moderation)',
    description:
      '202 `{ id, status: "PENDING" }`. Signed-in customers with a delivered order for the ' +
      'product are marked "Verified purchase". 409 ALREADY_REVIEWED, 429 REVIEW_RATE_LIMITED.',
  })
  submit(
    @Param('slug', { schema: slugSchema }) slug: string,
    @Body({ schema: submitReviewSchema }) body: SubmitReviewBody,
    @OptionalSession() session: AuthSession | null,
    @Client() client: ClientInfo,
  ) {
    return this.reviews.submit(slug, body, session?.customerId ?? null, client.ip);
  }

  @Get('reviews/featured')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Home testimonials: newest five-star verified reviews' })
  featured(
    @Query({ schema: featuredReviewsQuerySchema })
    query: z.infer<typeof featuredReviewsQuerySchema>,
  ) {
    return this.reviews.featured(query.limit);
  }

  @Get('reviews/summary')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Store-wide rating summary' })
  storeSummary() {
    return this.reviews.storeSummary();
  }

  @Post('reviews/:id/helpful')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @UseGuards(OptionalCustomerAuthGuard)
  @ApiOperation({ summary: 'Mark a review helpful (once per voter; repeat votes are ignored)' })
  helpful(
    @Param('id', { schema: reviewIdParamSchema }) id: string,
    @OptionalSession() session: AuthSession | null,
    @Client() client: ClientInfo,
  ) {
    return this.reviews.markHelpful(id, session?.customerId ?? null, client.ip);
  }
}
