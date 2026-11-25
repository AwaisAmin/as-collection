import type { AdminRoleDto, AdminStaffDto } from '@as/contracts';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { StaffDetailsForm, StaffSecurityActions } from '@/features/staff/components/staff-forms';
import { apiRequest } from '@/lib/api/http-client';
import { formatDateTime } from '@/lib/format';
import { can, covers } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Staff member' };

export default async function StaffMemberPage({ params, searchParams }: PageProps<'/staff/[id]'>) {
  const { token, permissions, staff: me } = await requireStaff();
  if (!can(permissions, 'staff.manage')) {
    return <Alert tone="error">Your role does not include managing staff.</Alert>;
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [list, roles] = await Promise.all([
    apiRequest<AdminStaffDto[]>('/admin/staff', { token }),
    apiRequest<AdminRoleDto[]>('/admin/roles', { token }).catch(() => []),
  ]);
  const person = list.find((s) => s.id === id);
  if (!person) notFound();
  const created = (await searchParams).created === '1';

  const isSelf = person.id === me.id;
  const held = roles
    .filter((role) => person.roles.some((r) => r.id === role.id))
    .flatMap((role) => role.permissions);
  // Someone with access you lack can't be managed by you (the API refuses it too).
  const canManage = isSelf || covers(permissions, held);

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/staff"
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden size={16} />
          Staff
        </Link>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[22px] font-semibold wrap-break-word">{person.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted">
            {isSelf ? <Badge tone="gold">You</Badge> : null}
            {person.status === 'ACTIVE' ? (
              <Badge tone="success">Access on</Badge>
            ) : (
              <Badge tone="danger">Access off</Badge>
            )}
            {person.locked ? <Badge tone="warning">Locked</Badge> : null}
            <span className="break-all">{person.email}</span>
          </div>
        </div>
      </div>

      {created ? (
        <Alert tone="success">
          Staff member added. Give them the temporary password privately; at first sign-in they
          choose their own and set up an authenticator app.
        </Alert>
      ) : null}
      {!canManage ? (
        <Alert tone="info">
          This person has access you don’t have, so only someone with that access can change them.
        </Alert>
      ) : null}

      <Card className="flex flex-col gap-4 p-5">
        <h2 className="text-[16px] font-semibold">Details and roles</h2>
        {/* Remounts after each save so the form starts from what was stored. */}
        <StaffDetailsForm
          key={`${person.name}|${person.roles.map((r) => r.id).join(',')}`}
          staff={person}
          roles={roles}
          actorPermissions={permissions}
          isSelf={isSelf}
          canManage={canManage}
        />
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[16px] font-semibold">Sign-in and security</h2>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[14px]">
            <dt className="text-muted">Last sign-in</dt>
            <dd>{person.lastLoginAt ? formatDateTime(person.lastLoginAt) : 'Never'}</dd>
            <dt className="text-muted">Password</dt>
            <dd>{person.mustChangePassword ? 'Temporary (not changed yet)' : 'Their own'}</dd>
            <dt className="text-muted">Authenticator</dt>
            <dd>{person.totpEnabled ? 'Set up' : 'Not set up yet'}</dd>
            <dt className="text-muted">Added</dt>
            <dd>{formatDateTime(person.createdAt)}</dd>
          </dl>
        </div>
        {isSelf ? (
          <p className="text-[14px] text-muted">
            To change your own password, use{' '}
            <Link href="/change-password" className="text-text underline underline-offset-4">
              Change password
            </Link>
            . Another administrator can reset your authenticator if you lose your phone.
          </p>
        ) : canManage ? (
          <StaffSecurityActions staff={person} />
        ) : null}
      </Card>
    </div>
  );
}
