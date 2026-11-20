'use client';

import type { AdminAttributeDto, ProductAttributeValueDto } from '@as/contracts';
import { X } from 'lucide-react';
import { useId, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';

import { hasValue } from '../form-model';

type Values = Record<string, ProductAttributeValueDto>;

/**
 * Product details used for shop filters and the product page (Fabric, Season…). Attributes the
 * product's categories ask for are always shown; others can be added.
 */
export function AttributeFields({
  attributes,
  values,
  onChange,
  required,
  errors,
}: {
  /** Product-level attributes. */
  attributes: readonly AdminAttributeDto[];
  values: Values;
  onChange: (values: Values) => void;
  /** attributeId → required by one of the product's categories. */
  required: ReadonlyMap<string, boolean>;
  errors: Record<string, string>;
}) {
  const id = useId();
  const [added, setAdded] = useState<string[]>([]);
  const shown = attributes.filter(
    (a) => required.has(a.id) || a.id in values || added.includes(a.id),
  );
  const addable = attributes.filter((a) => !shown.includes(a));
  // The API reports errors by position in the list it was sent (filled-in details only).
  const sent = Object.values(values).filter(hasValue);

  const set = (
    attributeId: string,
    entry: Omit<ProductAttributeValueDto, 'attributeId'> | null,
  ) => {
    const next = { ...values };
    if (entry) next[attributeId] = { attributeId, ...entry };
    else delete next[attributeId];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      {shown.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {shown.map((attribute) => {
            const value = values[attribute.id];
            const controlId = `${id}-${attribute.id}`;
            const index = sent.findIndex((entry) => entry.attributeId === attribute.id);
            const error = index >= 0 ? errors[`attributes.${String(index)}`] : undefined;
            const removable = !required.has(attribute.id);
            return (
              <div key={attribute.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={controlId} className="text-[13px] font-medium">
                    {attribute.name}
                    {attribute.unit ? (
                      <span className="text-muted"> ({attribute.unit})</span>
                    ) : null}
                    {required.get(attribute.id) ? <span className="text-danger"> *</span> : null}
                  </label>
                  {removable ? (
                    <button
                      type="button"
                      onClick={() => {
                        set(attribute.id, null);
                        setAdded((list) => list.filter((a) => a !== attribute.id));
                      }}
                      className="text-muted hover:text-text"
                      title={`Remove ${attribute.name}`}
                    >
                      <X aria-hidden size={14} />
                      <span className="sr-only">Remove {attribute.name}</span>
                    </button>
                  ) : null}
                </div>
                <AttributeControl
                  id={controlId}
                  attribute={attribute}
                  value={value}
                  onChange={(entry) => set(attribute.id, entry)}
                />
                {error ? <p className="text-danger text-[13px]">{error}</p> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[14px] text-muted">
          No details yet. Choose a category, or add the ones that apply.
        </p>
      )}
      {addable.length ? (
        <label className="flex max-w-xs flex-col gap-1.5">
          <span className="text-[13px] font-medium">Add a detail</span>
          <Select
            value=""
            onChange={(event) => {
              const attributeId = event.target.value;
              if (attributeId) setAdded((list) => [...list, attributeId]);
            }}
          >
            <option value="">Choose…</option>
            {addable.map((attribute) => (
              <option key={attribute.id} value={attribute.id}>
                {attribute.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
    </div>
  );
}

function AttributeControl({
  id,
  attribute,
  value,
  onChange,
}: {
  id: string;
  attribute: AdminAttributeDto;
  value: ProductAttributeValueDto | undefined;
  onChange: (entry: Omit<ProductAttributeValueDto, 'attributeId'> | null) => void;
}) {
  switch (attribute.type) {
    case 'SELECT':
      return (
        <Select
          id={id}
          value={value?.valueIds?.[0] ?? ''}
          onChange={(event) =>
            onChange(event.target.value ? { valueIds: [event.target.value] } : null)
          }
        >
          <option value="">—</option>
          {attribute.values.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </Select>
      );
    case 'MULTI_SELECT': {
      const chosen = new Set(value?.valueIds ?? []);
      return (
        <div id={id} role="group" aria-label={attribute.name} className="flex flex-wrap gap-1.5">
          {attribute.values.map((v) => {
            const on = chosen.has(v.id);
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = new Set(chosen);
                  if (on) next.delete(v.id);
                  else next.add(v.id);
                  onChange(next.size ? { valueIds: [...next] } : null);
                }}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px]',
                  on ? 'border-ink bg-ink text-white' : 'border-line bg-surface hover:bg-canvas',
                )}
              >
                {v.swatch ? (
                  <span
                    aria-hidden
                    className="border-line size-3 rounded-full border"
                    style={{ background: v.swatch }}
                  />
                ) : null}
                {v.label}
              </button>
            );
          })}
        </div>
      );
    }
    case 'NUMBER':
      return (
        <Input
          id={id}
          inputMode="decimal"
          defaultValue={value?.number ?? ''}
          onChange={(event) => {
            const raw = event.target.value.trim();
            const n = Number(raw);
            onChange(raw === '' || Number.isNaN(n) ? null : { number: n });
          }}
        />
      );
    case 'BOOLEAN':
      return (
        <Select
          id={id}
          value={value?.boolean === undefined ? '' : String(value.boolean)}
          onChange={(event) =>
            onChange(event.target.value === '' ? null : { boolean: event.target.value === 'true' })
          }
        >
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      );
    default:
      return (
        <Input
          id={id}
          value={value?.text ?? ''}
          maxLength={500}
          onChange={(event) => onChange(event.target.value ? { text: event.target.value } : null)}
        />
      );
  }
}
