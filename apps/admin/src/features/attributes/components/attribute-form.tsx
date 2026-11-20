'use client';

import type { AdminAttributeDto, AttributeScope, AttributeType } from '@as/contracts';
import { startTransition, useActionState, useId, useState } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ActionState } from '@/lib/action-state';

import { createAttribute, updateAttribute } from '../actions';
import { ATTRIBUTE_SCOPES, ATTRIBUTE_TYPES, hasValueList } from '../labels';

/** Create an attribute (with its first values) or edit its settings. */
export function AttributeForm({
  attribute,
  canWrite,
}: {
  attribute: AdminAttributeDto | null;
  canWrite: boolean;
}) {
  const id = useId();
  const used = attribute ? attribute.usage.products + attribute.usage.variants > 0 : false;
  const [type, setType] = useState<AttributeType>(attribute?.type ?? 'SELECT');
  const [scope, setScope] = useState<AttributeScope>(attribute?.scope ?? 'PRODUCT');
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = attribute
      ? await updateAttribute(attribute.id, prev, data)
      : await createAttribute(prev, data);
    if (result.done) toast.success(result.done);
    return result;
  }, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form
      // Submitted by hand so a refused save keeps what was typed.
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <fieldset disabled={!canWrite} className="contents">
        {attribute ? <input type="hidden" name="updatedAt" value={attribute.updatedAt} /> : null}
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${id}-name`} label="Name" error={errors.name} required>
            {(control) => (
              <Input {...control} name="name" defaultValue={attribute?.name} maxLength={80} />
            )}
          </Field>
          <Field
            id={`${id}-code`}
            label="Filter code"
            hint={
              attribute
                ? 'Used in shop filter links; it can’t change.'
                : 'Optional: made from the name. It can’t change later.'
            }
            error={errors.code}
          >
            {(control) => (
              <Input
                {...control}
                name="code"
                defaultValue={attribute?.code}
                readOnly={Boolean(attribute)}
                maxLength={60}
                autoComplete="off"
                className="font-mono"
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={`${id}-scope`}
            label="Used as"
            hint={used ? 'In use, so this can’t change.' : ATTRIBUTE_SCOPES[scope].hint}
            error={errors.scope}
          >
            {(control) => (
              <Select
                {...control}
                name={used ? undefined : 'scope'}
                value={scope}
                disabled={used}
                onChange={(event) => {
                  const next = event.target.value as AttributeScope;
                  setScope(next);
                  // Variant options are always single-choice.
                  if (next === 'VARIANT') setType('SELECT');
                }}
              >
                {(Object.keys(ATTRIBUTE_SCOPES) as AttributeScope[]).map((s) => (
                  <option key={s} value={s}>
                    {ATTRIBUTE_SCOPES[s].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            id={`${id}-type`}
            label="Type"
            hint={used ? 'In use, so this can’t change.' : ATTRIBUTE_TYPES[type].hint}
            error={errors.type}
          >
            {(control) => (
              <Select
                {...control}
                name={used ? undefined : 'type'}
                value={type}
                disabled={used || scope === 'VARIANT'}
                onChange={(event) => setType(event.target.value as AttributeType)}
              >
                {(Object.keys(ATTRIBUTE_TYPES) as AttributeType[]).map((t) => (
                  <option key={t} value={t}>
                    {ATTRIBUTE_TYPES[t].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {/* Disabled controls aren't submitted: send the fixed values explicitly. */}
        {used || scope === 'VARIANT' ? <input type="hidden" name="type" value={type} /> : null}
        {used ? <input type="hidden" name="scope" value={scope} /> : null}

        {type === 'NUMBER' ? (
          <Field id={`${id}-unit`} label="Unit" hint="e.g. cm, m, ml." error={errors.unit}>
            {(control) => (
              <Input
                {...control}
                name="unit"
                defaultValue={attribute?.unit ?? ''}
                maxLength={20}
                className="sm:max-w-40"
              />
            )}
          </Field>
        ) : (
          <input type="hidden" name="unit" value={attribute?.unit ?? ''} />
        )}

        {!attribute && hasValueList(type) ? (
          <Field
            id={`${id}-values`}
            label="Values"
            hint="One per line, in display order. Colours and more values can be added after saving."
            error={errors.values}
          >
            {(control) => (
              <Textarea {...control} name="values" rows={5} placeholder={'Lawn\nChiffon\nSilk'} />
            )}
          </Field>
        ) : null}

        <div className="flex flex-col gap-2">
          <Checkbox
            name="isFilterable"
            defaultChecked={attribute?.isFilterable ?? true}
            label="Shop filter"
            hint="Shoppers can filter by it on category pages that use it."
          />
          <Checkbox
            name="isVisible"
            defaultChecked={attribute?.isVisible ?? true}
            label="Shown on the product page"
          />
        </div>

        {canWrite ? (
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : attribute ? 'Save attribute' : 'Create attribute'}
            </Button>
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}
