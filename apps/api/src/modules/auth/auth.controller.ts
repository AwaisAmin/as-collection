import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';

import { StrictRateLimit } from '../../common/http/rate-limit.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  googleSignInSchema,
  requestOtpSchema,
  type VerifyOtpBody,
  verifyOtpSchema,
} from './auth.schemas.js';
import { AuthService } from './auth.service.js';
import { customerSelect, toCustomerDto } from './customer.dto.js';
import { Client, CurrentSession, CustomerAuthGuard } from './customer-auth.guard.js';
import { type AuthSession, type ClientInfo, SessionService } from './session.service.js';

/**
 * Customer sign-in. Designed for a server-side caller (the storefront's Next.js server), which
 * keeps the returned token in an HttpOnly cookie and forwards it as `Authorization: Bearer`.
 * Tokens never need to reach browser JavaScript.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('otp')
  @HttpCode(HttpStatus.ACCEPTED)
  @StrictRateLimit()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Send a login code (WhatsApp, SMS fallback)',
    description: 'Same response whether or not an account exists. 429 with Retry-After if limited.',
  })
  requestOtp(
    @Body({ schema: requestOtpSchema }) body: z.infer<typeof requestOtpSchema>,
    @Client() client: ClientInfo,
  ) {
    return this.auth.requestOtp(body.phone, client);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @StrictRateLimit()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Verify the code and sign in (creates the account on first login)' })
  verifyOtp(@Body({ schema: verifyOtpSchema }) body: VerifyOtpBody, @Client() client: ClientInfo) {
    return this.auth.verifyOtp(body.phone, body.code, client);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @StrictRateLimit()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Sign in with a Google ID token' })
  google(
    @Body({ schema: googleSignInSchema }) body: z.infer<typeof googleSignInSchema>,
    @Client() client: ClientInfo,
  ) {
    return this.auth.signInWithGoogle(body.idToken, client);
  }

  @Get('session')
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'The signed-in customer and session expiry' })
  async session(@CurrentSession() session: AuthSession) {
    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: session.customerId },
      select: customerSelect,
    });
    return { customer: toCustomerDto(customer), expiresAt: session.expiresAt.toISOString() };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out this session' })
  async logout(@CurrentSession() session: AuthSession): Promise<void> {
    await this.sessions.revoke(session.customerId, session.sessionId);
  }
}
