import { z } from 'zod';

import { plainText } from '../../common/text.js';
import { emailSchema } from '../newsletter/newsletter.schemas.js';
import { isKnownPermission } from './permissions.js';
import { passwordSchema } from './security/password.js';

export const loginSchema = z.strictObject({
  email: emailSchema,
  // Not the policy schema: existing passwords are checked as typed (bounded length only).
  password: z.string().min(1).max(256),
});

export const challengeSchema = z.strictObject({ challengeToken: z.string().min(10).max(512) });

export const verifyCodeSchema = challengeSchema.extend({
  code: z
    .string()
    .transform((v) => v.replace(/\s/g, ''))
    .pipe(z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.')),
});

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1).max(256),
  newPassword: passwordSchema,
});

const idList = z
  .array(z.uuid())
  .max(20)
  .transform((ids) => [...new Set(ids)]);

export const createStaffSchema = z.strictObject({
  email: emailSchema,
  name: plainText({ min: 2, max: 120 }),
  /** Temporary password; the staff member must change it at first sign-in. */
  password: passwordSchema,
  roleIds: idList.default([]),
});

export const updateStaffSchema = z
  .strictObject({
    name: plainText({ min: 2, max: 120 }).optional(),
    status: z.enum(['ACTIVE', 'DISABLED']).optional(),
    roleIds: idList.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

export const resetPasswordSchema = z.strictObject({ password: passwordSchema });

const permissionList = z
  .array(z.string().refine(isKnownPermission, 'Unknown permission.'))
  .max(100)
  .transform((list) => [...new Set(list)].sort());

export const createRoleSchema = z.strictObject({
  key: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, digits and dashes.')
    .max(60),
  name: plainText({ min: 2, max: 80 }),
  description: plainText({ max: 300 }).optional(),
  permissions: permissionList,
});

export const updateRoleSchema = z
  .strictObject({
    name: plainText({ min: 2, max: 80 }).optional(),
    description: plainText({ max: 300 }).nullable().optional(),
    permissions: permissionList.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

export const idParamSchema = z.uuid();

export const auditQuerySchema = z.looseObject({
  actorStaffId: z.uuid().optional(),
  entityType: z
    .string()
    .regex(/^[a-z-]{1,60}$/)
    .optional(),
  entityId: z.string().max(64).optional(),
  action: z
    .string()
    .regex(/^[a-z.-]{1,100}$/)
    .optional(),
  before: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateStaffBody = z.infer<typeof createStaffSchema>;
export type UpdateStaffBody = z.infer<typeof updateStaffSchema>;
export type CreateRoleBody = z.infer<typeof createRoleSchema>;
export type UpdateRoleBody = z.infer<typeof updateRoleSchema>;
