import type { AdminRoleDto, PermissionGroupDto } from '@as/contracts';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { RoleEditor } from '@/features/staff/components/role-editor';
import { apiRequest } from '@/lib/api/http-client';
import { can, canAny } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Role' };

/** `/roles/new` creates a role; `/roles/<id>` edits one. */
export default async function RolePage({ params, searchParams }: PageProps<'/roles/[id]'>) {
  const { token, permissions } = await requireStaff();
  if (!canAny(permissions, ['roles.manage', 'staff.manage'])) {
    return <Alert tone="error">Your role does not include roles.</Alert>;
  }
  const { id } = await params;
  const isNew = id === 'new';
  if (!isNew && !z.uuid().safeParse(id).success) notFound();
  if (isNew && !can(permissions, 'roles.manage')) notFound();
  const [roles, groups] = await Promise.all([
    apiRequest<AdminRoleDto[]>('/admin/roles', { token }),
    apiRequest<PermissionGroupDto[]>('/admin/auth/permissions', { token }),
  ]);
  const role = isNew ? null : (roles.find((r) => r.id === id) ?? null);
  if (!isNew && !role) notFound();
  const created = (await searchParams).created === '1';
  const canEdit = can(permissions, 'roles.manage');

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/roles"
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden size={16} />
          Roles
        </Link>
        <h1 className="text-[22px] font-semibold wrap-break-word">
          {role ? role.name : 'New role'}
        </h1>
      </div>
      {created ? (
        <Alert tone="success">Role created. Give it to staff on their page under Staff.</Alert>
      ) : null}
      {!canEdit ? <Alert tone="info">You can see roles but not change them.</Alert> : null}
      <RoleEditor
        // Remounts after each save so the form starts from what was stored.
        key={role ? `${role.name}|${role.description ?? ''}|${role.permissions.join(',')}` : 'new'}
        role={role}
        groups={groups}
        actorPermissions={permissions}
        canEdit={canEdit}
      />
    </div>
  );
}
