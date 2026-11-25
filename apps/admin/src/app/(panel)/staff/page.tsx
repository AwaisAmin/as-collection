import type { AdminRoleDto, AdminStaffDto } from '@as/contracts';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AddStaffDialog } from '@/features/staff/components/staff-forms';
import { apiRequest } from '@/lib/api/http-client';
import { formatDateTime } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Staff' };

export default async function StaffPage() {
  const { token, permissions, staff: me } = await requireStaff();
  if (!can(permissions, 'staff.manage')) {
    return <Alert tone="error">Your role does not include managing staff.</Alert>;
  }
  const [list, roles] = await Promise.all([
    apiRequest<AdminStaffDto[]>('/admin/staff', { token }).catch(() => null),
    apiRequest<AdminRoleDto[]>('/admin/roles', { token }).catch(() => []),
  ]);

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold">Staff</h1>
          <p className="text-[14px] text-muted">
            Who can open this admin and what each person may do (set by their roles).
          </p>
        </div>
        <AddStaffDialog roles={roles} actorPermissions={permissions} />
      </div>

      {!list ? (
        <Alert tone="error">Staff could not be loaded right now. Refresh to try again.</Alert>
      ) : (
        <ul className="border-line bg-surface shadow-card divide-line flex flex-col divide-y rounded-card border">
          {list.map((person) => (
            <li
              key={person.id}
              className="hover:bg-canvas/50 relative flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/staff/${person.id}` as Route}
                    className="font-medium after:absolute after:inset-0 hover:underline"
                  >
                    {person.name}
                  </Link>
                  {person.id === me.id ? <Badge tone="gold">You</Badge> : null}
                  {person.status === 'DISABLED' ? <Badge tone="danger">Access off</Badge> : null}
                  {person.locked ? <Badge tone="warning">Locked</Badge> : null}
                  {person.mustChangePassword ? <Badge>Temporary password</Badge> : null}
                  {!person.totpEnabled ? <Badge>No authenticator yet</Badge> : null}
                </div>
                <p className="text-[13px] break-all text-muted">{person.email}</p>
              </div>
              <div className="text-[13px] text-muted sm:text-right">
                <p className="text-text">
                  {person.roles.map((r) => r.name).join(', ') || 'No role'}
                </p>
                <p>
                  {person.lastLoginAt
                    ? `Last signed in ${formatDateTime(person.lastLoginAt)}`
                    : 'Never signed in'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
