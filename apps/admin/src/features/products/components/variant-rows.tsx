'use client';

import type { AdminAttributeDto } from '@as/contracts';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';

import { type DraftVariant, emptyVariant } from '../form-model';

const MAX_VARIANTS = 100;

/**
 * Variants of a new product: what the customer chooses between (size, shade…), each with its
 * own SKU, price and starting stock. A product with no options has a single variant.
 */
export function VariantRows({
  variants,
  onChange,
  optionAttributes,
  optionAttributeIds,
  onOptionAttributesChange,
  errors,
}: {
  variants: DraftVariant[];
  onChange: (variants: DraftVariant[]) => void;
  /** Attributes variants can differ by. */
  optionAttributes: readonly AdminAttributeDto[];
  optionAttributeIds: string[];
  onOptionAttributesChange: (ids: string[]) => void;
  errors: Record<string, string>;
}) {
  const used = optionAttributes.filter((a) => optionAttributeIds.includes(a.id));
  const update = (index: number, change: Partial<DraftVariant>) =>
    onChange(variants.map((v, i) => (i === index ? { ...v, ...change } : v)));
  const error = (index: number, ...fields: string[]) =>
    fields.map((f) => errors[`variants.${String(index)}.${f}`]).find(Boolean);

  return (
    <div className="flex flex-col gap-4">
      {optionAttributes.length ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1 text-[13px] font-medium">Customers choose by</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {optionAttributes.map((attribute) => (
              <Checkbox
                key={attribute.id}
                label={attribute.name}
                checked={optionAttributeIds.includes(attribute.id)}
                onChange={(event) =>
                  onOptionAttributesChange(
                    event.target.checked
                      ? [...optionAttributeIds, attribute.id]
                      : optionAttributeIds.filter((id) => id !== attribute.id),
                  )
                }
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      <ol className="flex flex-col gap-3">
        {variants.map((variant, index) => {
          const label = `Variant ${String(index + 1)}`;
          return (
            <li
              key={variant.key}
              aria-label={label}
              className="border-line flex flex-col gap-3 rounded-lg border p-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-muted">{label}</p>
                {variants.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => onChange(variants.filter((_, i) => i !== index))}
                    className="hover:text-danger text-muted"
                    title={`Remove ${label}`}
                  >
                    <Trash2 aria-hidden size={15} />
                    <span className="sr-only">Remove {label}</span>
                  </button>
                ) : null}
              </div>
              {used.length ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {used.map((attribute) => (
                    <label key={attribute.id} className="flex flex-col gap-1 text-[13px]">
                      <span className="font-medium">{attribute.name}</span>
                      <Select
                        value={variant.options[attribute.id] ?? ''}
                        onChange={(event) =>
                          update(index, {
                            options: { ...variant.options, [attribute.id]: event.target.value },
                          })
                        }
                        aria-invalid={error(index, 'options') ? true : undefined}
                      >
                        <option value="">—</option>
                        {attribute.values.map((value) => (
                          <option key={value.id} value={value.id}>
                            {value.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-4">
                <Cell label="SKU" error={error(index, 'sku')} required>
                  <Input
                    value={variant.sku}
                    onChange={(event) => update(index, { sku: event.target.value })}
                    maxLength={64}
                    autoComplete="off"
                    className="font-mono uppercase"
                    aria-invalid={error(index, 'sku') ? true : undefined}
                  />
                </Cell>
                <Cell label="Price (Rs)" error={error(index, 'priceMinor')} required>
                  <Input
                    value={variant.price}
                    onChange={(event) => update(index, { price: event.target.value })}
                    inputMode="decimal"
                    aria-invalid={error(index, 'priceMinor') ? true : undefined}
                  />
                </Cell>
                <Cell label="Was price (Rs)" error={error(index, 'compareAtPriceMinor')}>
                  <Input
                    value={variant.compareAt}
                    onChange={(event) => update(index, { compareAt: event.target.value })}
                    inputMode="decimal"
                  />
                </Cell>
                <Cell label="Units in stock" error={error(index, 'inventory')}>
                  <Input
                    value={variant.stock}
                    onChange={(event) => update(index, { stock: event.target.value })}
                    inputMode="numeric"
                  />
                </Cell>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <Checkbox
                  label="Track stock"
                  checked={variant.trackInventory}
                  onChange={(event) => update(index, { trackInventory: event.target.checked })}
                />
                <Checkbox
                  label="Sell when out of stock"
                  checked={variant.allowBackorder}
                  onChange={(event) => update(index, { allowBackorder: event.target.checked })}
                />
              </div>
              {error(index, 'options', 'title', 'costMinor') ? (
                <p className="text-danger text-[13px]">
                  {error(index, 'options', 'title', 'costMinor')}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {errors.variants ? <p className="text-danger text-[13px]">{errors.variants}</p> : null}
      <div>
        <Button
          variant="secondary"
          disabled={variants.length >= MAX_VARIANTS}
          onClick={() => {
            const last = variants.at(-1);
            // Most variants share the price: start the new row from the last one's.
            onChange([
              ...variants,
              { ...emptyVariant(), price: last?.price ?? '', compareAt: last?.compareAt ?? '' },
            ]);
          }}
        >
          <Plus aria-hidden size={16} />
          Add variant
        </Button>
      </div>
    </div>
  );
}

function Cell({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string | undefined;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={cn('flex flex-col gap-1 text-[13px]')}>
      <span className="font-medium">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
      {children}
      {error ? <span className="text-danger">{error}</span> : null}
    </label>
  );
}
