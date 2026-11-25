import type { AdminRoleDto } from '@as/contracts';
import { Plus } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { roleSummary } from '@/features/staff/permission-labels';
import { apiRequest } from '@/lib/api/http-client';
import { can, canAny } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Roles' };

export default async function RolesPage({ searchParams }: PageProps<'/roles'>) {
  const { token, permissions } = await requireStaff();
  if (!canAny(permissions, ['roles.manage', 'staff.manage'])) {
    return <Alert tone="error">Your role does not include roles.</Alert>;
  }
  const roles = await apiRequest<AdminRoleDto[]>('/admin/roles', { token }).catch(() => null);
  const deleted = (await searchParams).deleted === '1';

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold">Roles</h1>
          <p className="text-[14px] text-muted">
            Sets of permissions. Give staff one or more roles; their access is everything their
            roles allow.
          </p>
        </div>
        {can(permissions, 'roles.manage') ? (
          <ButtonLink href={'/roles/new' as Route}>
            <Plus aria-hidden size={16} />
            New role
          </ButtonLink>
        ) : null}
      </div>
      {deleted ? <Alert tone="success">Role deleted.</Alert> : null}
      {!roles ? (
        <Alert tone="error">Roles could not be loaded right now. Refresh to try again.</Alert>
      ) : (
        <ul className="border-line bg-surface shadow-card divide-line flex flex-col divide-y rounded-card border">
          {roles.map((role) => (
            <li key={role.id} className="hover:bg-canvas/50 relative px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/roles/${role.id}` as Route}
                  className="font-medium after:absolute after:inset-0 hover:underline"
                >
                  {role.name}
                </Link>
                {role.isSystem ? <Badge>Built in</Badge> : null}
              </div>
              {role.description ? (
                <p className="text-[14px] wrap-break-word">{role.description}</p>
              ) : null}
              <p className="text-[13px] text-muted">
                {roleSummary(role.permissions)} · {role.staffCount}{' '}
                {role.staffCount === 1 ? 'person' : 'people'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
