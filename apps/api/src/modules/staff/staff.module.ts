import { Global, Module } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { StaffAdminController } from './staff-admin.controller.js';
import { StaffAdminService } from './staff-admin.service.js';
import { StaffAuthController } from './staff-auth.controller.js';
import { StaffAuthGuard } from './staff-auth.guard.js';
import { StaffAuthService } from './staff-auth.service.js';
import { StaffSessionService } from './staff-session.service.js';

/**
 * Staff accounts, sessions, roles and the audit log. Global so every admin feature module can
 * use `@Staff('…')` and `AuditService` without re-importing.
 */
@Global()
@Module({
  controllers: [StaffAuthController, StaffAdminController],
  providers: [
    StaffSessionService,
    StaffAuthService,
    StaffAdminService,
    StaffAuthGuard,
    AuditService,
  ],
  exports: [StaffSessionService, StaffAuthGuard, AuditService],
})
export class StaffModule {}
