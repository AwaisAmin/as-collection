'use client';

import type { AdminAttributeDto, AdminVariantDto } from '@as/contracts';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useTransition } from 'react';
import { toast } from 'sonner';

import { ActionDialog } from '@/components/ui/action-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatMoney } from '@/lib/format';

import { deleteVariant, saveVariant } from '../actions';
import { minorToRupees } from '../form-model';

/** The attributes this product's variants differ by (from the variants themselves). */
function optionAttributes(
  variants: readonly AdminVariantDto[],
  attributes: readonly AdminAttributeDto[],
) {
  const used = new Set(variants.flatMap((v) => v.options.map((o) => o.attributeId)));
  return attributes.filter((a) => used.has(a.id));
}

const money = (label: string) => `${label} (Rs)`;

/** Fields of the add / edit variant dialog (plain named inputs; the server reads them). */
function VariantFields({
  variant,
  options,
  errors,
}: {
  variant: AdminVariantDto | null;
  options: readonly AdminAttributeDto[];
  errors: Record<string, string>;
}) {
  const id = useId();
  const chosen = new Map(variant?.options.map((o) => [o.attributeId, o.valueId]) ?? []);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-sku`} label="SKU" error={errors.sku} required>
          {(control) => (
            <Input
              {...control}
              name="sku"
              defaultValue={variant?.sku}
              maxLength={64}
              autoComplete="off"
              className="font-mono uppercase"
              required
            />
          )}
        </Field>
        <Field
          id={`${id}-title`}
          label="Name"
          hint="Optional, e.g. “Large / Black”."
          error={errors.title}
        >
          {(control) => (
            <Input {...control} name="title" defaultValue={variant?.title ?? ''} maxLength={200} />
          )}
        </Field>
      </div>
      {options.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {options.map((attribute) => (
            <Field
              key={attribute.id}
              id={`${id}-option-${attribute.id}`}
              label={attribute.name}
              error={errors.options}
            >
              {(control) => (
                <Select
                  {...control}
                  name={`option.${attribute.id}`}
                  defaultValue={chosen.get(attribute.id) ?? ''}
                >
                  <option value="">—</option>
                  {attribute.values.map((value) => (
                    <option key={value.id} value={value.id}>
                      {value.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${id}-price`} label={money('Price')} error={errors.price} required>
          {(control) => (
            <Input
              {...control}
              name="price"
              inputMode="decimal"
              defaultValue={minorToRupees(variant?.priceMinor)}
              required
            />
          )}
        </Field>
        <Field
          id={`${id}-compare`}
          label={money('Was price')}
          hint="Shows as a sale."
          error={errors.compareAt}
        >
          {(control) => (
            <Input
              {...control}
              name="compareAt"
              inputMode="decimal"
              defaultValue={minorToRupees(variant?.compareAtPriceMinor)}
            />
          )}
        </Field>
        <Field
          id={`${id}-cost`}
          label={money('Cost')}
          hint="Only staff see it."
          error={errors.cost}
        >
          {(control) => (
            <Input
              {...control}
              name="cost"
              inputMode="decimal"
              defaultValue={minorToRupees(variant?.costMinor)}
            />
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-barcode`} label="Barcode" error={errors.barcode}>
          {(control) => (
            <Input
              {...control}
              name="barcode"
              defaultValue={variant?.barcode ?? ''}
              maxLength={64}
              autoComplete="off"
            />
          )}
        </Field>
        <Field id={`${id}-weight`} label="Weight (grams)" error={errors.weight}>
          {(control) => (
            <Input
              {...control}
              name="weight"
              inputMode="numeric"
              defaultValue={variant?.weightGrams ?? ''}
            />
          )}
        </Field>
      </div>
      {variant ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={`${id}-stock`}
            label="Units in stock"
            hint="Later changes are made as stock adjustments."
            error={errors.stock}
          >
            {(control) => <Input {...control} name="stock" inputMode="numeric" defaultValue="0" />}
          </Field>
          <div className="flex flex-col gap-2 sm:pt-6">
            <Checkbox name="trackInventory" defaultChecked label="Track stock" />
            <Checkbox name="allowBackorder" label="Sell when out of stock" />
          </div>
        </div>
      )}
      <Checkbox
        name="isActive"
        defaultChecked={variant?.isActive ?? true}
        label="Available for sale"
        hint="Untick to hide this variant without deleting it."
      />
    </div>
  );
}

function DeleteVariant({ productId, variant }: { productId: string; variant: AdminVariantDto }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`Delete ${variant.sku}`}
      title="Delete (never ordered)"
      className="hover:text-danger"
      onClick={() =>
        start(async () => {
          const result = await deleteVariant(productId, variant.id);
          if (result.done) toast.success(result.done);
          else toast.error(result.error ?? 'Could not delete the variant.');
        })
      }
    >
      <Trash2 aria-hidden size={15} />
    </Button>
  );
}

/**
 * The variants of a saved product. Each is added, edited or deleted on its own; stock levels
 * change through stock adjustments, so they are shown here but not edited.
 */
export function VariantTable({
  productId,
  variants,
  attributes,
  canWrite,
  locked,
}: {
  productId: string;
  variants: readonly AdminVariantDto[];
  attributes: readonly AdminAttributeDto[];
  canWrite: boolean;
  /** Unsaved product changes: variant edits would reload the form and lose them. */
  locked: boolean;
}) {
  const options = optionAttributes(variants, attributes);
  const fallbackOptions = options.length
    ? options
    : attributes.filter((a) => a.scope === 'VARIANT' && a.type === 'SELECT');
  const onlyOne = variants.length <= 1;

  return (
    <div className="flex flex-col gap-3">
      {locked && canWrite ? (
        <p className="text-warning text-[13px]">
          Save or undo your product changes to edit variants.
        </p>
      ) : null}
      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-[14px]">
          <thead className="bg-canvas/60 text-[12px] font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th scope="col" className="px-3 py-2.5">
                Variant
              </th>
              <th scope="col" className="px-3 py-2.5 text-right">
                Price
              </th>
              <th scope="col" className="px-3 py-2.5 text-right">
                Available
              </th>
              {canWrite ? (
                <th scope="col" className="px-3 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {variants.map((variant) => (
              <tr key={variant.id}>
                <td className="px-3 py-2.5">
                  <p className="font-mono text-[13px] font-medium">{variant.sku}</p>
                  <p className="text-[13px] text-muted">
                    {variant.options.map((o) => o.value).join(' / ') || variant.title || '—'}
                  </p>
                  {!variant.isActive ? <Badge>Hidden</Badge> : null}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {formatMoney(variant.priceMinor)}
                  {variant.compareAtPriceMinor ? (
                    <p className="text-[13px] text-muted line-through">
                      {formatMoney(variant.compareAtPriceMinor)}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {!variant.inventory || !variant.inventory.trackInventory ? (
                    <span className="text-muted">Not tracked</span>
                  ) : (
                    <span className={variant.inventory.isLow ? 'text-warning' : undefined}>
                      {variant.inventory.available}
                      {variant.inventory.reserved ? (
                        <span className="block text-[12px] text-muted">
                          {variant.inventory.reserved} held by orders
                        </span>
                      ) : null}
                    </span>
                  )}
                </td>
                {canWrite ? (
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <ActionDialog
                        trigger={<Pencil aria-hidden size={15} />}
                        triggerLabel={`Edit ${variant.sku}`}
                        triggerVariant="ghost"
                        triggerSize="sm"
                        triggerClassName="w-auto"
                        disabled={locked}
                        title={`Edit variant ${variant.sku}`}
                        submitLabel="Save variant"
                        dialogClassName="max-w-xl"
                        action={saveVariant.bind(null, productId, variant.id)}
                      >
                        {(errors) => (
                          <VariantFields variant={variant} options={options} errors={errors} />
                        )}
                      </ActionDialog>
                      {!variant.hasOrders && !onlyOne ? (
                        locked ? null : (
                          <DeleteVariant productId={productId} variant={variant} />
                        )
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canWrite ? (
        <div>
          <ActionDialog
            trigger={
              <>
                <Plus aria-hidden size={16} />
                Add variant
              </>
            }
            disabled={locked}
            title="Add variant"
            submitLabel="Add variant"
            dialogClassName="max-w-xl"
            action={saveVariant.bind(null, productId, null)}
          >
            {(errors) => <VariantFields variant={null} options={fallbackOptions} errors={errors} />}
          </ActionDialog>
        </div>
      ) : null}
    </div>
  );
}
