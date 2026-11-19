import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';

import { StrictRateLimit } from '../../common/http/rate-limit.js';
import { Client } from '../auth/customer-auth.guard.js';
import type { ClientInfo } from '../auth/session.service.js';
import { PERMISSION_GROUPS } from './permissions.js';
import {
  challengeSchema,
  changePasswordSchema,
  loginSchema,
  verifyCodeSchema,
} from './staff.schemas.js';
import { AllowPendingPasswordChange, CurrentStaff, Staff } from './staff-auth.guard.js';
import { StaffAuthService } from './staff-auth.service.js';
import type { StaffPrincipal } from './staff-session.service.js';

/**
 * Admin panel sign-in. The admin app's server keeps the token in an HttpOnly cookie and sends it
 * as a bearer token (same BFF pattern as the storefront). All responses are `no-store`.
 */
@ApiTags('Admin · Auth')
@Controller('admin/auth')
export class StaffAuthController {
  constructor(private readonly auth: StaffAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @StrictRateLimit()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Step 1: email + password',
    description:
      '`TOTP_REQUIRED` / `TOTP_ENROLMENT_REQUIRED` with a 5-minute `challengeToken`, or ' +
      '`AUTHENTICATED` (only when 2FA is disabled in development). 401 INVALID_CREDENTIALS ' +
      'never says whether the email exists or the account is locked.',
  })
  login(
    @Body({ schema: loginSchema }) body: z.infer<typeof loginSchema>,
    @Client() client: ClientInfo,
  ) {
    return this.auth.login(body.email, body.password, client);
  }

  @Post('totp/enrol')
  @HttpCode(HttpStatus.OK)
  @StrictRateLimit()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'First sign-in: get a new authenticator secret + otpauth:// URI (QR)' })
  enrol(@Body({ schema: challengeSchema }) body: z.infer<typeof challengeSchema>) {
    return this.auth.startEnrolment(body.challengeToken);
  }

  @Post('totp/verify')
  @HttpCode(HttpStatus.OK)
  @StrictRateLimit()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Step 2: the 6-digit authenticator code → session token' })
  verify(
    @Body({ schema: verifyCodeSchema }) body: z.infer<typeof verifyCodeSchema>,
    @Client() client: ClientInfo,
  ) {
    return this.auth.verifyCode(body.challengeToken, body.code, client);
  }

  @Get('session')
  @Staff()
  @AllowPendingPasswordChange()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'The signed-in staff member and their effective permissions' })
  session(@CurrentStaff() staff: StaffPrincipal) {
    return {
      staff: {
        id: staff.staffId,
        email: staff.email,
        name: staff.name,
        mustChangePassword: staff.mustChangePassword,
        totpEnabled: staff.totpEnabled,
      },
      permissions: [...staff.permissions].sort(),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff()
  @AllowPendingPasswordChange()
  async logout(@CurrentStaff() staff: StaffPrincipal, @Client() client: ClientInfo) {
    await this.auth.logout(staff, client);
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @StrictRateLimit()
  @Staff()
  @AllowPendingPasswordChange()
  @ApiOperation({ summary: 'Change own password (signs out other sessions)' })
  async changePassword(
    @CurrentStaff() staff: StaffPrincipal,
    @Body({ schema: changePasswordSchema }) body: z.infer<typeof changePasswordSchema>,
    @Client() client: ClientInfo,
  ) {
    await this.auth.changePassword(staff, body.currentPassword, body.newPassword, client);
  }

  @Get('permissions')
  @Staff()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Permission catalog for the role editor' })
  permissions() {
    return PERMISSION_GROUPS;
  }
}
