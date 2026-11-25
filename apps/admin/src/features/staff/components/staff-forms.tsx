'use client';

import type { AdminRoleDto, AdminStaffDto } from '@as/contracts';
import { RefreshCw } from 'lucide-react';
import { type FormEvent, useActionState, useId, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { ActionDialog } from '@/components/ui/action-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { ActionState, SaveState } from '@/lib/action-state';
import { covers } from '@/lib/permissions';
import { cn } from '@/lib/utils/cn';

import {
  createStaff,
  resetStaffPassword,
  resetStaffTotp,
  saveStaffDetails,
  setStaffStatus,
  signOutStaff,
  unlockStaff,
} from '../actions';
import { passwordProblem, temporaryPassword } from '../password';
import { roleSummary } from '../permission-labels';

/** Role checkboxes; roles granting access the actor lacks are shown but can't be ticked. */
export function RoleChecklist({
  roles,
  actorPermissions,
  selected,
  onChange,
  name,
}: {
  roles: readonly AdminRoleDto[];
  actorPermissions: readonly string[];
  selected: readonly string[];
  onChange?: (ids: string[]) => void;
  /** Form field name (uncontrolled forms). */
  name?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-[13px] font-medium">Roles</legend>
      {roles.map((role) => {
        const allowed = covers(actorPermissions, role.permissions);
        return (
          <label
            key={role.id}
            className={cn(
              'border-line flex items-start gap-2.5 rounded-lg border p-3 text-[14px]',
              allowed ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="checkbox"
              name={name}
              value={role.id}
              disabled={!allowed}
              {...(onChange
                ? {
                    checked: selected.includes(role.id),
                    onChange: (event) =>
                      onChange(
                        event.target.checked
                          ? [...selected, role.id]
                          : selected.filter((id) => id !== role.id),
                      ),
                  }
                : { defaultChecked: selected.includes(role.id) })}
              className="mt-0.5 size-4 shrink-0 accent-ink"
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">{role.name}</span>
              <span className="text-[13px] text-muted">
                {allowed
                  ? roleSummary(role.permissions)
                  : 'Has access you don’t have, so you can’t give it.'}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function PasswordField({ id, error, email }: { id: string; error?: string; email?: string }) {
  const [value, setValue] = useState(() => temporaryPassword());
  const problem = email ? passwordProblem(value, email) : null;
  return (
    <Field
      id={id}
      label="Temporary password"
      hint="Share it privately (in person or a call). They choose their own at first sign-in."
      error={error ?? problem ?? undefined}
      required
    >
      {(control) => (
        <div className="flex gap-2">
          <Input
            {...control}
            name="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
          <Button
            variant="secondary"
            aria-label="Make a new password"
            title="Make a new password"
            onClick={() => setValue(temporaryPassword())}
          >
            <RefreshCw aria-hidden size={16} />
          </Button>
        </div>
      )}
    </Field>
  );
}

/** "Add staff member": name, work email, a temporary password and roles. */
export function AddStaffDialog({
  roles,
  actorPermissions,
}: {
  roles: readonly AdminRoleDto[];
  actorPermissions: readonly string[];
}) {
  const id = useId();
  const [email, setEmail] = useState('');
  return (
    <ActionDialog
      trigger="Add staff member"
      triggerVariant="primary"
      title="Add a staff member"
      description="They sign in with this email and the temporary password, then choose their own password and set up an authenticator app."
      submitLabel="Add staff member"
      action={createStaff}
      dialogClassName="max-w-lg"
    >
      {(errors) => (
        <>
          <Field id={`${id}-name`} label="Name" error={errors.name} required>
            {(control) => <Input {...control} name="name" maxLength={120} autoComplete="off" />}
          </Field>
          <Field id={`${id}-email`} label="Work email" error={errors.email} required>
            {(control) => (
              <Input
                {...control}
                name="email"
                type="email"
                maxLength={254}
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>
          <PasswordField id={`${id}-password`} error={errors.password} email={email} />
          <RoleChecklist
            roles={roles}
            actorPermissions={actorPermissions}
            selected={[]}
            name="roleIds"
          />
        </>
      )}
    </ActionDialog>
  );
}

/** Name and roles of a staff member (own roles can only be changed by someone else). */
export function StaffDetailsForm({
  staff,
  roles,
  actorPermissions,
  isSelf,
  canManage,
}: {
  staff: AdminStaffDto;
  roles: readonly AdminRoleDto[];
  actorPermissions: readonly string[];
  isSelf: boolean;
  canManage: boolean;
}) {
  const id = useId();
  const initial = { name: staff.name, roleIds: staff.roles.map((r) => r.id).sort() };
  const [draft, setDraft] = useState(initial);
  const body: Record<string, unknown> = {};
  if (draft.name.trim() !== initial.name) body.name = draft.name.trim();
  const roleIds = [...draft.roleIds].sort();
  if (!isSelf && JSON.stringify(roleIds) !== JSON.stringify(initial.roleIds))
    body.roleIds = roleIds;
  const dirty = Object.keys(body).length > 0;

  const [state, action, pending] = useActionState<SaveState, FormData>(async (prev, data) => {
    const result = await saveStaffDetails(staff.id, prev, data);
    if (result.done) toast.success(result.done);
    return result;
  }, {});
  const [, start] = useTransition();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData();
    data.set('payload', JSON.stringify(body));
    start(() => action(data));
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {state.error && state.at ? <Alert tone="error">{state.error}</Alert> : null}
      <fieldset disabled={!canManage} className="flex flex-col gap-4">
        <Field id={`${id}-name`} label="Name" error={state.errors?.name}>
          {(control) => (
            <Input
              {...control}
              value={draft.name}
              onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
              maxLength={120}
            />
          )}
        </Field>
        {isSelf ? (
          <p className="text-[14px] text-muted">
            Your roles: {staff.roles.map((r) => r.name).join(', ') || 'none'}. Ask another
            administrator to change your own access.
          </p>
        ) : (
          <RoleChecklist
            roles={roles}
            actorPermissions={actorPermissions}
            selected={draft.roleIds}
            onChange={(ids) => setDraft((d) => ({ ...d, roleIds: ids }))}
          />
        )}
      </fieldset>
      {canManage ? (
        <div className="flex gap-2">
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
          {dirty ? (
            <Button variant="ghost" disabled={pending} onClick={() => setDraft(initial)}>
              Undo
            </Button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function ConfirmAction({
  label,
  title,
  description,
  submitLabel,
  danger,
  run,
}: {
  label: string;
  title: string;
  description: string;
  submitLabel: string;
  danger?: boolean;
  run: () => Promise<ActionState>;
}) {
  return (
    <ActionDialog
      trigger={label}
      triggerClassName={danger ? 'text-danger' : undefined}
      title={title}
      description={description}
      submitLabel={submitLabel}
      submitVariant={danger ? 'danger' : 'primary'}
      action={() => run()}
    />
  );
}

/** Password, authenticator, lock-out, sessions and access on/off. */
export function StaffSecurityActions({ staff }: { staff: AdminStaffDto }) {
  const id = useId();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {staff.locked ? (
        <Button
          disabled={pending}
          className="w-full sm:w-auto"
          onClick={() =>
            start(async () => {
              const result = await unlockStaff(staff.id);
              if (result.done) toast.success(result.done);
              else if (result.error) toast.error(result.error);
            })
          }
        >
          Unlock
        </Button>
      ) : null}
      <ActionDialog
        trigger="Reset password"
        title="Set a temporary password"
        description="They are signed out everywhere and must choose a new password at next sign-in."
        submitLabel="Set temporary password"
        action={resetStaffPassword.bind(null, staff.id)}
      >
        {(errors) => (
          <PasswordField id={`${id}-reset`} error={errors.password} email={staff.email} />
        )}
      </ActionDialog>
      {staff.totpEnabled ? (
        <ConfirmAction
          label="Reset authenticator"
          title="Reset the authenticator app"
          description="For a lost or replaced phone. They are signed out everywhere and set up the app again at next sign-in."
          submitLabel="Reset authenticator"
          run={() => resetStaffTotp(staff.id)}
        />
      ) : null}
      <ConfirmAction
        label="Sign out everywhere"
        title="Sign out on every device"
        description="Ends every admin session of this staff member. They can sign in again."
        submitLabel="Sign out everywhere"
        run={() => signOutStaff(staff.id)}
      />
      {staff.status === 'ACTIVE' ? (
        <ConfirmAction
          label="Turn off access"
          title="Turn off access"
          description="They are signed out at once and can’t sign in until access is turned on again. Their past work stays in the activity log."
          submitLabel="Turn off access"
          danger
          run={() => setStaffStatus(staff.id, 'DISABLED')}
        />
      ) : (
        <ConfirmAction
          label="Turn access back on"
          title="Turn access back on"
          description="They can sign in again with their password and authenticator."
          submitLabel="Turn on"
          run={() => setStaffStatus(staff.id, 'ACTIVE')}
        />
      )}
    </div>
  );
}
