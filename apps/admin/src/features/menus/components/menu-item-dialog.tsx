'use client';

import { type FormEvent, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { HREF_MESSAGE, isMenuHref, type MenuRole, ROLE_LABELS } from '../labels';
import type { MenuNode } from '../tree';

export interface ItemDialogProps {
  title: string;
  /** The item being edited, or a blank one being added. */
  node: MenuNode;
  /** Top items of the Shop menu choose what they are. */
  withRole: boolean;
  /** Other names at the same level (names must differ). */
  siblingLabels: readonly string[];
  submitLabel: string;
  onSave: (node: MenuNode) => void;
  onClose: () => void;
}

/** Name, link and visibility of one menu item; changes stay in the editor until it is saved. */
export function MenuItemDialog({
  title,
  node,
  withRole,
  siblingLabels,
  submitLabel,
  onSave,
  onClose,
}: ItemDialogProps) {
  const id = useId();
  const [label, setLabel] = useState(node.label);
  const [url, setUrl] = useState(node.url);
  const [isVisible, setVisible] = useState(node.isVisible);
  const [role, setRole] = useState<MenuRole | ''>(node.settings?.kind ?? '');
  const [errors, setErrors] = useState<{ label?: string; url?: string }>({});
  const needsUrl = !(withRole && role === 'feature-card');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const name = label.trim();
    const link = url.trim();
    const next: typeof errors = {};
    if (!name) next.label = 'Give it a name.';
    else if (siblingLabels.some((other) => other.trim().toLowerCase() === name.toLowerCase())) {
      next.label = 'Another item at this level has the same name.';
    }
    if (link && !isMenuHref(link)) next.url = HREF_MESSAGE;
    else if (!link && needsUrl) next.url = 'Add where it leads.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const settings = withRole
      ? { ...(node.settings ?? {}), kind: role || undefined }
      : node.settings;
    onSave({ ...node, label: name, url: link, isVisible, settings });
  };

  return (
    <Dialog open onClose={onClose} title={title}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field id={`${id}-label`} label="Name" error={errors.label} required>
          {(control) => (
            <Input
              {...control}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={80}
              autoComplete="off"
            />
          )}
        </Field>
        {withRole ? (
          <Field
            id={`${id}-role`}
            label="Shows as"
            hint={role ? ROLE_LABELS[role].hint : 'Not shown in the Shop menu until it has a role.'}
          >
            {(control) => (
              <Select
                {...control}
                value={role}
                onChange={(event) => setRole(event.target.value as MenuRole | '')}
              >
                <option value="">Nothing (kept, not shown)</option>
                {(Object.keys(ROLE_LABELS) as MenuRole[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {ROLE_LABELS[kind].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
        <Field
          id={`${id}-url`}
          label="Link"
          hint={
            needsUrl
              ? 'A page of the shop (/shop/stitched?q=kurta), an https:// address, tel: or mailto:.'
              : 'Optional: the card links to what it shows.'
          }
          error={errors.url}
          required={needsUrl}
        >
          {(control) => (
            <Input
              {...control}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              maxLength={500}
              autoComplete="off"
              spellCheck={false}
              placeholder="/shop"
            />
          )}
        </Field>
        <Checkbox
          label="Shown in the shop"
          hint="Hidden items, and everything under them, stay out of the shop."
          checked={isVisible}
          onChange={(event) => setVisible(event.target.checked)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </Dialog>
  );
}
