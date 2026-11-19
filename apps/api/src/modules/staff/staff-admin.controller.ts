import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';

import { type AuditActor, AuditService } from '../audit/audit.service.js';
import {
  auditQuerySchema,
  type CreateRoleBody,
  createRoleSchema,
  type CreateStaffBody,
  createStaffSchema,
  idParamSchema,
  resetPasswordSchema,
  type UpdateRoleBody,
  updateRoleSchema,
  type UpdateStaffBody,
  updateStaffSchema,
} from './staff.schemas.js';
import { StaffAdminService } from './staff-admin.service.js';
import { Actor, CurrentStaff, Staff, StaffAnyOf } from './staff-auth.guard.js';
import type { StaffPrincipal } from './staff-session.service.js';

@ApiTags('Admin · Staff & roles')
@Controller('admin')
export class StaffAdminController {
  constructor(
    private readonly admin: StaffAdminService,
    private readonly audit: AuditService,
  ) {}

  // ─── Staff ───

  @Get('staff')
  @Staff('staff.manage')
  @Header('Cache-Control', 'no-store')
  listStaff() {
    return this.admin.listStaff();
  }

  @Post('staff')
  @Staff('staff.manage')
  @ApiOperation({
    summary: 'Add a staff member with a temporary password (changed at first sign-in)',
  })
  createStaff(
    @CurrentStaff() actor: StaffPrincipal,
    @Actor() audit: AuditActor,
    @Body({ schema: createStaffSchema }) body: CreateStaffBody,
  ) {
    return this.admin.createStaff(actor, audit, body);
  }

  @Patch('staff/:id')
  @Staff('staff.manage')
  @ApiOperation({ summary: 'Rename, enable/disable (signs out) or change roles' })
  updateStaff(
    @CurrentStaff() actor: StaffPrincipal,
    @Actor() audit: AuditActor,
    @Param('id', { schema: idParamSchema }) id: string,
    @Body({ schema: updateStaffSchema }) body: UpdateStaffBody,
  ) {
    return this.admin.updateStaff(actor, audit, id, body);
  }

  @Post('staff/:id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff('staff.manage')
  async resetPassword(
    @CurrentStaff() actor: StaffPrincipal,
    @Actor() audit: AuditActor,
    @Param('id', { schema: idParamSchema }) id: string,
    @Body({ schema: resetPasswordSchema }) body: z.infer<typeof resetPasswordSchema>,
  ) {
    await this.admin.resetPassword(actor, audit, id, body.password);
  }

  @Post('staff/:id/reset-2fa')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff('staff.manage')
  async resetTotp(
    @CurrentStaff() actor: StaffPrincipal,
    @Actor() audit: AuditActor,
    @Param('id', { schema: idParamSchema }) id: string,
  ) {
    await this.admin.resetTotp(actor, audit, id);
  }

  @Post('staff/:id/unlock')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff('staff.manage')
  async unlock(
    @CurrentStaff() actor: StaffPrincipal,
    @Actor() audit: AuditActor,
    @Param('id', { schema: idParamSchema }) id: string,
  ) {
    await this.admin.unlock(actor, audit, id);
  }

  @Post('staff/:id/revoke-sessions')
  @HttpCode(HttpStatus.OK)
  @Staff('staff.manage')
  revokeSessions(
    @CurrentStaff() actor: StaffPrincipal,
    @Actor() audit: AuditActor,
    @Param('id', { schema: idParamSchema }) id: string,
  ) {
    return this.admin.revokeSessions(actor, audit, id);
  }

  // ─── Roles ───

  @Get('roles')
  @StaffAnyOf('staff.manage', 'roles.manage')
  @Header('Cache-Control', 'no-store')
  listRoles() {
    return this.admin.listRoles();
  }

  @Post('roles')
  @Staff('roles.manage')
  createRole(
    @CurrentStaff() actor: StaffPrincipal,
    @Actor() audit: AuditActor,
    @Body({ schema: createRoleSchema }) body: CreateRoleBody,
  ) {
    return this.admin.createRole(actor, audit, body);
  }

  @Patch('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff('roles.manage')
  async updateRole(
    @CurrentStaff() actor: StaffPrincipal,
    @Actor() audit: AuditActor,
    @Param('id', { schema: idParamSchema }) id: string,
    @Body({ schema: updateRoleSchema }) body: UpdateRoleBody,
  ) {
    await this.admin.updateRole(actor, audit, id, body);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Staff('roles.manage')
  async deleteRole(
    @CurrentStaff() actor: StaffPrincipal,
    @Actor() audit: AuditActor,
    @Param('id', { schema: idParamSchema }) id: string,
  ) {
    await this.admin.deleteRole(actor, audit, id);
  }

  // ─── Audit log ───

  @Get('audit-logs')
  @Staff('audit.read')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Audit trail, newest first (cursor: `before` = last id of the page)' })
  auditLogs(@Query({ schema: auditQuerySchema }) query: z.infer<typeof auditQuerySchema>) {
    return this.audit.list(query);
  }
}
