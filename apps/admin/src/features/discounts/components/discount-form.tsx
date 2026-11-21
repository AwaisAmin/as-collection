'use client';

import type { AdminDiscountDto, DiscountType } from '@as/contracts';
import { Shuffle } from 'lucide-react';
import { startTransition, useActionState, useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { minorToRupees } from '@/features/products/form-model';
import type { ActionState } from '@/lib/action-state';
import { toPktInput } from '@/lib/format';
import { cn } from '@/lib/utils/cn';

import { saveDiscount } from '../actions';
import { basisPointsToPercent, DISCOUNT_TYPES, randomCode } from '../labels';

/** Create a code or edit one (renaming only while unused). */
export function DiscountForm({
  discount,
  canWrite,
}: {
  discount: AdminDiscountDto | null;
  canWrite: boolean;
}) {
  const id = useId();
  const codeInput = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<DiscountType>(discount?.type ?? 'PERCENTAGE');
  const used = (discount?.usageCount ?? 0) > 0;
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await saveDiscount(discount?.id ?? null, prev, data);
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
      noValidate
      className="flex flex-col gap-6"
    >
      <fieldset disabled={!canWrite} className="contents">
        {discount ? <input type="hidden" name="updatedAt" value={discount.updatedAt} /> : null}
        <input type="hidden" name="type" value={type} />
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}

        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-[16px] font-semibold">Code</h2>
          <Field
            id={`${id}-code`}
            label="Code customers type"
            hint={
              used
                ? 'Customers have used it, so it can’t be renamed.'
                : '3–40 letters, digits, dashes or underscores. Case doesn’t matter.'
            }
            error={errors.code}
            required
          >
            {(control) => (
              <div className="flex gap-2">
                <Input
                  {...control}
                  ref={codeInput}
                  name="code"
                  defaultValue={discount?.code}
                  readOnly={used}
                  maxLength={40}
                  autoComplete="off"
                  className="font-mono uppercase"
                />
                {used ? null : (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (codeInput.current) codeInput.current.value = randomCode();
                    }}
                    title="Make a random code"
                  >
                    <Shuffle aria-hidden size={15} />
                    Generate
                  </Button>
                )}
              </div>
            )}
          </Field>
          <Field
            id={`${id}-description`}
            label="Note"
            hint="For staff, e.g. “Instagram Eid campaign”."
            error={errors.description}
          >
            {(control) => (
              <Input
                {...control}
                name="description"
                defaultValue={discount?.description ?? ''}
                maxLength={300}
              />
            )}
          </Field>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-[16px] font-semibold">What it gives</h2>
          <fieldset className="grid gap-2 sm:grid-cols-3">
            <legend className="sr-only">Discount type</legend>
            {(Object.keys(DISCOUNT_TYPES) as DiscountType[]).map((t) => (
              <label
                key={t}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3',
                  type === t ? 'bg-canvas border-ink' : 'border-line',
                )}
              >
                <input
                  type="radio"
                  name={`${id}-type`}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="mt-1 shrink-0 accent-ink"
                />
                <span className="flex flex-col gap-0.5 text-[14px]">
                  <span className="font-medium">{DISCOUNT_TYPES[t].label}</span>
                  <span className="text-[13px] text-muted">{DISCOUNT_TYPES[t].hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {errors.type ? <p className="text-danger text-[13px]">{errors.type}</p> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {type === 'PERCENTAGE' ? (
              <>
                <Field id={`${id}-percent`} label="Percent off" error={errors.value} required>
                  {(control) => (
                    <Input
                      {...control}
                      name="percent"
                      inputMode="decimal"
                      defaultValue={
                        discount?.type === 'PERCENTAGE' ? basisPointsToPercent(discount.value) : ''
                      }
                      placeholder="15"
                    />
                  )}
                </Field>
                <Field
                  id={`${id}-cap`}
                  label="Up to (Rs)"
                  hint="Optional: the most it takes off one order."
                  error={errors.maxDiscount}
                >
                  {(control) => (
                    <Input
                      {...control}
                      name="maxDiscount"
                      inputMode="decimal"
                      defaultValue={minorToRupees(discount?.maxDiscountMinor)}
                    />
                  )}
                </Field>
              </>
            ) : type === 'FIXED_AMOUNT' ? (
              <Field id={`${id}-amount`} label="Amount off (Rs)" error={errors.value} required>
                {(control) => (
                  <Input
                    {...control}
                    name="amount"
                    inputMode="decimal"
                    defaultValue={
                      discount?.type === 'FIXED_AMOUNT' ? minorToRupees(discount.value) : ''
                    }
                    placeholder="500"
                  />
                )}
              </Field>
            ) : null}
            <Field
              id={`${id}-min`}
              label="Minimum order (Rs)"
              hint="Optional: items total needed to use it."
              error={errors.minSubtotal}
            >
              {(control) => (
                <Input
                  {...control}
                  name="minSubtotal"
                  inputMode="decimal"
                  defaultValue={minorToRupees(discount?.minSubtotalMinor)}
                />
              )}
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[16px] font-semibold">Limits</h2>
            <p className="text-[13px] text-muted">
              Leave empty for no limit. Times are Pakistan time.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${id}-starts`} label="Starts" error={errors.startsAt}>
              {(control) => (
                <Input
                  {...control}
                  type="datetime-local"
                  name="startsAt"
                  defaultValue={toPktInput(discount?.startsAt ?? null)}
                />
              )}
            </Field>
            <Field id={`${id}-ends`} label="Ends" error={errors.endsAt}>
              {(control) => (
                <Input
                  {...control}
                  type="datetime-local"
                  name="endsAt"
                  defaultValue={toPktInput(discount?.endsAt ?? null)}
                />
              )}
            </Field>
            <Field
              id={`${id}-limit`}
              label="Total uses"
              hint={used ? `Used ${String(discount?.usageCount ?? 0)} times so far.` : undefined}
              error={errors.usageLimit}
            >
              {(control) => (
                <Input
                  {...control}
                  name="usageLimit"
                  inputMode="numeric"
                  defaultValue={discount?.usageLimit ?? ''}
                />
              )}
            </Field>
            <Field
              id={`${id}-per-customer`}
              label="Uses per customer"
              hint="Counted by phone number."
              error={errors.perCustomerLimit}
            >
              {(control) => (
                <Input
                  {...control}
                  name="perCustomerLimit"
                  inputMode="numeric"
                  defaultValue={discount?.perCustomerLimit ?? ''}
                />
              )}
            </Field>
          </div>
          <Checkbox
            name="isActive"
            defaultChecked={discount?.isActive ?? true}
            label="On"
            hint="Untick to stop the code working straight away."
          />
        </Card>

        {canWrite ? (
          <div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? 'Saving…' : discount ? 'Save discount' : 'Create discount'}
            </Button>
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}
