import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';

import { StrictRateLimit } from '../../common/http/rate-limit.js';
import { CurrentSession, CustomerAuthGuard } from '../auth/customer-auth.guard.js';
import { type AuthSession, SessionService } from '../auth/session.service.js';
import {
  type CreateAddressBody,
  createAddressSchema,
  type UpdateAddressBody,
  updateAddressSchema,
  type UpdateProfileBody,
  updateProfileSchema,
  uuidParamSchema,
  verifyPhoneSchema,
} from './account.schemas.js';
import { AccountService } from './account.service.js';
import { AddressService } from './address.service.js';

/** The signed-in customer's own data. Every route requires a session. */
@ApiTags('Account')
@ApiBearerAuth()
@UseGuards(CustomerAuthGuard)
@Controller('account')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly addresses: AddressService,
    private readonly sessions: SessionService,
  ) {}

  // ─── Profile ───

  @Get()
  @Header('Cache-Control', 'no-store')
  profile(@CurrentSession() session: AuthSession) {
    return this.account.profile(session.customerId);
  }

  @Patch()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Update name, email (unverified until proven) or marketing consent' })
  updateProfile(
    @CurrentSession() session: AuthSession,
    @Body({ schema: updateProfileSchema }) body: UpdateProfileBody,
  ) {
    return this.account.updateProfile(session.customerId, body);
  }

  @Post('phone')
  @HttpCode(HttpStatus.OK)
  @StrictRateLimit()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Add or change the phone with a code from POST /auth/otp' })
  verifyPhone(
    @CurrentSession() session: AuthSession,
    @Body({ schema: verifyPhoneSchema }) body: z.infer<typeof verifyPhoneSchema>,
  ) {
    return this.account.verifyPhone(session.customerId, body.phone, body.code);
  }

  // ─── Address book ───

  @Get('addresses')
  @Header('Cache-Control', 'no-store')
  listAddresses(@CurrentSession() session: AuthSession) {
    return this.addresses.list(session.customerId);
  }

  @Post('addresses')
  @Header('Cache-Control', 'no-store')
  createAddress(
    @CurrentSession() session: AuthSession,
    @Body({ schema: createAddressSchema }) body: CreateAddressBody,
  ) {
    return this.addresses.create(session.customerId, body);
  }

  @Patch('addresses/:id')
  @Header('Cache-Control', 'no-store')
  updateAddress(
    @CurrentSession() session: AuthSession,
    @Param('id', { schema: uuidParamSchema }) id: string,
    @Body({ schema: updateAddressSchema }) body: UpdateAddressBody,
  ) {
    return this.addresses.update(session.customerId, id, body);
  }

  @Delete('addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAddress(
    @CurrentSession() session: AuthSession,
    @Param('id', { schema: uuidParamSchema }) id: string,
  ): Promise<void> {
    await this.addresses.remove(session.customerId, id);
  }

  // ─── Signed-in devices ───

  @Get('sessions')
  @Header('Cache-Control', 'no-store')
  listSessions(@CurrentSession() session: AuthSession) {
    return this.sessions.list(session.customerId, session.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentSession() session: AuthSession,
    @Param('id', { schema: uuidParamSchema }) id: string,
  ): Promise<void> {
    const revoked = await this.sessions.revoke(session.customerId, id);
    if (!revoked) throw new NotFoundException('Session not found.');
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign out every other device' })
  async revokeOtherSessions(@CurrentSession() session: AuthSession) {
    return { revoked: await this.sessions.revokeAll(session.customerId, session.sessionId) };
  }
}
