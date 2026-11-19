'use client';

import { useActionState, useEffect, useId } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { pakistanCities } from '@/config/cities';
import { formatPkMobile } from '@/lib/utils/phone';

import { type FormState, saveAddressAction } from '../actions';
import type { AddressFormField } from '../schemas';
import type { Address } from '../types';

const initial: FormState<AddressFormField> = { status: 'idle' };

interface AddressFormProps {
  address?: Address;
  defaults?: { recipientName?: string; phone?: string };
  onSaved: () => void;
}

export function AddressForm({ address, defaults, onSaved }: AddressFormProps) {
  const [state, formAction, pending] = useActionState(saveAddressAction, initial);
  const base = useId();
  const errors = state.status === 'error' ? state.fieldErrors : {};

  useEffect(() => {
    if (state.status === 'success') {
      toast.success(state.message);
      onSaved();
    }
  }, [state, onSaved]);

  return (
    <form
      action={formAction}
      noValidate
      className="grid grid-cols-1 gap-5 px-5 py-6 sm:grid-cols-2 sm:px-7"
    >
      {address ? <input type="hidden" name="addressId" value={address.id} /> : null}
      {state.status === 'error' && state.message ? (
        <p role="alert" className="text-[15px] font-semibold text-gold-dark sm:col-span-2">
          {state.message}
        </p>
      ) : null}

      <FormField
        id={`${base}-label`}
        label="Label"
        required
        error={errors.label}
        hint="e.g. Home, Office, Ammi"
      >
        {(a11y) => (
          <Input {...a11y} name="label" maxLength={30} defaultValue={address?.label ?? 'Home'} />
        )}
      </FormField>
      <FormField id={`${base}-name`} label="Recipient name" required error={errors.recipientName}>
        {(a11y) => (
          <Input
            {...a11y}
            name="recipientName"
            autoComplete="name"
            maxLength={80}
            defaultValue={address?.recipientName ?? defaults?.recipientName}
          />
        )}
      </FormField>
      <FormField id={`${base}-phone`} label="Mobile number" required error={errors.phone}>
        {(a11y) => (
          <Input
            {...a11y}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={16}
            defaultValue={
              address?.phone
                ? formatPkMobile(address.phone)
                : defaults?.phone
                  ? formatPkMobile(defaults.phone)
                  : ''
            }
          />
        )}
      </FormField>
      <FormField id={`${base}-city`} label="City" required error={errors.city}>
        {(a11y) => (
          <>
            <Input
              {...a11y}
              name="city"
              list={`${base}-cities`}
              maxLength={60}
              defaultValue={address?.city}
            />
            <datalist id={`${base}-cities`}>
              {pakistanCities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </>
        )}
      </FormField>
      <FormField
        id={`${base}-address`}
        label="Full address"
        required
        error={errors.address}
        className="sm:col-span-2"
      >
        {(a11y) => (
          <Textarea
            {...a11y}
            name="address"
            rows={3}
            maxLength={250}
            defaultValue={address?.address}
          />
        )}
      </FormField>
      <FormField id={`${base}-postal`} label="Postal code" error={errors.postalCode}>
        {(a11y) => (
          <Input
            {...a11y}
            name="postalCode"
            inputMode="numeric"
            maxLength={5}
            defaultValue={address?.postalCode}
          />
        )}
      </FormField>
      <label className="flex items-center gap-3 self-end pb-3 text-[16px]">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={address?.isDefault}
          className="size-5 accent-ink"
        />
        Use as default address
      </label>

      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : address ? 'Save changes' : 'Add address'}
        </Button>
      </div>
    </form>
  );
}
