'use client';

import type { AdminRoleDto, PermissionGroupDto } from '@as/contracts';
import { type FormEvent, useActionState, useId, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DeleteCard } from '@/components/ui/delete-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { SaveState } from '@/lib/action-state';
import { ALL, can } from '@/lib/permissions';
import { cn } from '@/lib/utils/cn';

import { createRole, deleteRole, updateRole } from '../actions';
import { roleKeyFrom } from '../permission-labels';

/**
 * Create or edit a role: name, description and permissions by area. Permissions the editor
 * doesn't hold can't be ticked (the API refuses them too). Built-in roles are read-only.
 */
export function RoleEditor({
  role,
  groups,
  actorPermissions,
  canEdit = true,
}: {
  role: AdminRoleDto | null;
  groups: readonly PermissionGroupDto[];
  actorPermissions: readonly string[];
  /** False: shown read-only (the viewer may see roles but not change them). */
  canEdit?: boolean;
}) {
  const id = useId();
  const isNew = role === null;
  const readOnly = !!role?.isSystem || !canEdit;
  const initial = {
    name: role?.name ?? '',
    key: role?.key ?? '',
    description: role?.description ?? '',
    permissions: [...(role?.permissions ?? [])].sort(),
  };
  const [draft, setDraft] = useState(initial);
  const [keyTouched, setKeyTouched] = useState(false);
  const [local, setLocal] = useState<Record<string, string>>({});
  const key = keyTouched ? draft.key : roleKeyFrom(draft.name);
  const permissions = [...draft.permissions].sort();

  const body: Record<string, unknown> = isNew
    ? {
        key,
        name: draft.name.trim(),
        ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
        permissions,
      }
    : {
        ...(draft.name.trim() !== initial.name ? { name: draft.name.trim() } : {}),
        ...(draft.description.trim() !== initial.description
          ? { description: draft.description.trim() || null }
          : {}),
        ...(JSON.stringify(permissions) !== JSON.stringify(initial.permissions)
          ? { permissions }
          : {}),
      };
  const dirty = isNew ? true : Object.keys(body).length > 0;

  const [state, action, pending] = useActionState<SaveState, FormData>(async (prev, data) => {
    const errors: Record<string, string> = {};
    if (draft.name.trim().length < 2) errors.name = 'Give the role a name.';
    if (isNew && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(key)) {
      errors.key = 'Use lowercase letters, digits and dashes.';
    }
    if (!permissions.length) errors.permissions = 'Tick at least one permission.';
    setLocal(errors);
    if (Object.keys(errors).length) return {};
    const result = role ? await updateRole(role.id, prev, data) : await createRole(prev, data);
    if (result.done) toast.success(result.done);
    return result;
  }, {});
  const errors = { ...(state.errors ?? {}), ...local };
  const [, start] = useTransition();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData();
    data.set('payload', JSON.stringify(body));
    start(() => action(data));
  };

  const toggle = (code: string, on: boolean) =>
    setDraft((d) => ({
      ...d,
      permissions: on ? [...d.permissions, code] : d.permissions.filter((p) => p !== code),
    }));

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {state.error && state.at ? <Alert tone="error">{state.error}</Alert> : null}
        {role?.isSystem ? (
          <Alert tone="info">
            A built-in role: its permissions can’t be changed and it can’t be deleted, so the shop
            always has someone with full access.
          </Alert>
        ) : null}
        <Card className="flex flex-col gap-4 p-5">
          <Field id={`${id}-name`} label="Name" error={errors.name} required>
            {(control) => (
              <Input
                {...control}
                value={draft.name}
                onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
                maxLength={80}
                disabled={readOnly}
              />
            )}
          </Field>
          {isNew ? (
            <Field
              id={`${id}-key`}
              label="Key"
              hint="A short code for the role; it can’t be changed later."
              error={errors.key}
            >
              {(control) => (
                <Input
                  {...control}
                  value={key}
                  onChange={(event) => {
                    setKeyTouched(true);
                    setDraft((d) => ({ ...d, key: event.target.value }));
                  }}
                  maxLength={60}
                  className="font-mono"
                  autoComplete="off"
                />
              )}
            </Field>
          ) : null}
          <Field id={`${id}-description`} label="Description" error={errors.description}>
            {(control) => (
              <Textarea
                {...control}
                rows={2}
                maxLength={300}
                value={draft.description}
                onChange={(event) => setDraft((d) => ({ ...d, description: event.target.value }))}
                disabled={readOnly}
                placeholder="What this person does, e.g. “Packs and ships orders.”"
              />
            )}
          </Field>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <div>
            <h2 className="text-[16px] font-semibold">Permissions</h2>
            {errors.permissions ? (
              <p className="text-danger text-[13px]">{errors.permissions}</p>
            ) : (
              <p className="text-[13px] text-muted">
                Grey options are ones you don’t have yourself, so you can’t give them.
              </p>
            )}
          </div>
          {draft.permissions.includes(ALL) ? (
            <p className="text-[14px] font-medium">Full access to everything.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {groups.map((group) => (
                <fieldset key={group.group} className="flex flex-col gap-2">
                  <legend className="mb-1 text-[13px] font-semibold tracking-wide text-muted uppercase">
                    {group.group}
                  </legend>
                  {group.permissions.map((permission) => {
                    const allowed = can(actorPermissions, permission.code) && !readOnly;
                    return (
                      <label
                        key={permission.code}
                        className={cn(
                          'flex items-start gap-2.5 text-[14px]',
                          allowed ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={draft.permissions.includes(permission.code)}
                          disabled={!allowed}
                          onChange={(event) => toggle(permission.code, event.target.checked)}
                          className="mt-0.5 size-4 shrink-0 accent-ink"
                        />
                        <span>{permission.label}</span>
                      </label>
                    );
                  })}
                </fieldset>
              ))}
            </div>
          )}
        </Card>

        {!readOnly ? (
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || !dirty}>
              {pending ? 'Saving…' : isNew ? 'Create role' : 'Save role'}
            </Button>
            {!isNew && dirty ? (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setDraft(initial);
                  setLocal({});
                }}
              >
                Undo
              </Button>
            ) : null}
          </div>
        ) : null}
      </form>

      {role && !role.isSystem && canEdit ? (
        <DeleteCard
          what="role"
          name={role.name}
          blockedReason={
            role.staffCount
              ? `${String(role.staffCount)} staff ${role.staffCount === 1 ? 'member has' : 'members have'} this role. Take it off them first.`
              : null
          }
          allowedText="Nobody has this role, so it can be deleted."
          consequence="The role is removed. This can’t be undone."
          onDelete={() => deleteRole(role.id)}
        />
      ) : null}
    </div>
  );
}
