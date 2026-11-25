/* Staff accounts and roles (`/admin/staff`, `/admin/roles`, `/admin/auth/permissions`). */

export type StaffStatus = 'ACTIVE' | 'DISABLED';

export interface AdminStaffDto {
  id: string;
  email: string;
  name: string;
  status: StaffStatus;
  /** Has set up an authenticator app. */
  totpEnabled: boolean;
  /** Still on a temporary password. */
  mustChangePassword: boolean;
  /** Locked for a while after too many wrong passwords. */
  locked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: { id: string; key: string; name: string }[];
}

export interface AdminRoleDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  /** Built in: its permissions can't be changed and it can't be deleted. */
  isSystem: boolean;
  /** Permission codes; `*` means every permission. */
  permissions: string[];
  staffCount: number;
}

/** The permission catalog, grouped for the role editor. */
export interface PermissionGroupDto {
  group: string;
  permissions: readonly { code: string; label: string }[];
}
