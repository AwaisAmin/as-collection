'use client';

import { CircleAlert, Lock, ShoppingBag } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type ReactNode,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { pakistanCities } from '@/config/cities';
import type { TransferChannel } from '@/config/payments';
import type { Address } from '@/features/auth/types';
import { OrderSummary } from '@/features/cart/components/order-summary';
import { useCart } from '@/features/cart/hooks/use-cart';
import { useCartStore } from '@/features/cart/store/cart-store';
import { useShippingRulesStore } from '@/features/cart/store/shipping-rules-store';
import type { CartItem } from '@/features/cart/types';
import type { PaymentMethod } from '@/features/orders/types';
import { cn } from '@/lib/utils/cn';
import { formatPrice } from '@/lib/utils/format';
import { formatPkMobile } from '@/lib/utils/phone';

import { placeOrder } from '../actions';
import {
  type CheckoutField,
  checkoutFieldsSchema,
  fieldErrorsFrom,
  validateScreenshot,
} from '../schemas';
import { initialCheckoutState } from '../types';
import { PaymentSection } from './payment-section';

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-gold/60 bg-ivory p-5 sm:p-7">
      <h2 className="mb-5 flex items-center gap-3 font-display text-[22px]">
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full border border-gold bg-ink font-body text-[15px] font-bold text-white"
        >
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SummaryLines({ items }: { items: CartItem[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.variantId} className="flex items-center gap-3">
          <span className="relative aspect-3/4 w-14 shrink-0 overflow-hidden rounded-lg border border-gold/50 bg-sand">
            <Image src={item.image.src} alt="" fill sizes="56px" className="object-cover" />
            <span className="absolute top-0 right-0 flex size-5 items-center justify-center rounded-bl-lg bg-ink text-[11px] font-bold text-white">
              {item.quantity}
            </span>
          </span>
          <span className="min-w-0 flex-1 text-[15px] leading-snug">
            <span className="block font-display text-ink">{item.name}</span>
            {Object.keys(item.options).length > 0 ? (
              <span className="block text-muted">{Object.values(item.options).join(' · ')}</span>
            ) : null}
          </span>
          <span className="font-body text-[15px] font-bold text-ink">
            {formatPrice(item.price * item.quantity)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Signed-in customer's details (undefined for guests). */
export interface CheckoutPrefill {
  name: string;
  phone: string;
  email?: string;
  addresses: Address[];
}

export function CheckoutView({ prefill }: { prefill?: CheckoutPrefill }) {
  const savedAddresses = prefill?.addresses ?? [];
  const initialAddress = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
  const [selectedAddressId, setSelectedAddressId] = useState<string>(initialAddress?.id ?? 'new');
  const router = useRouter();
  const { items, totals, hydrated } = useCart();
  const syncWithServer = useCartStore((s) => s.syncWithServer);
  const setShippingRules = useShippingRulesStore((s) => s.setRules);
  const clearCart = useCartStore((s) => s.clear);

  const [state, formAction, pending] = useActionState(placeOrder, initialCheckoutState);
  const [, startTransition] = useTransition();
  const [clientErrors, setClientErrors] = useState<Partial<Record<CheckoutField, string>>>({});
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [channel, setChannel] = useState<TransferChannel>('bank');
  // Idempotency key: created on first submit (never during prerender) and reused on retries.
  const checkoutIdRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const base = useId();

  const serverErrors = state.status === 'error' ? state.fieldErrors : {};
  const errors = { ...serverErrors, ...clientErrors };
  const purchasable = items.filter((i) => !i.unavailable);

  // React to the action result: success → clear cart + confirmation; changes → sync cart.
  useEffect(() => {
    if (state.status === 'success') {
      clearCart();
      router.replace(`/order-confirmation/${state.orderNumber}?key=${state.accessKey}` as Route);
    } else if (state.status === 'error') {
      if (state.shipping) setShippingRules(state.shipping);
      if (state.snapshots) syncWithServer(state.snapshots);
      alertRef.current?.focus();
    }
  }, [state, clearCart, router, syncWithServer, setShippingRules]);

  /** Fill delivery fields from a saved address (or clear them for a new one). */
  function selectAddress(id: string) {
    setSelectedAddressId(id);
    const form = formRef.current;
    if (!form) return;
    const a = savedAddresses.find((x) => x.id === id);
    const set = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) el.value = value;
    };
    if (a) {
      set('fullName', a.recipientName);
      set('phone', formatPkMobile(a.phone));
      set('city', a.city);
      set('address', a.address);
      set('postalCode', a.postalCode ?? '');
    } else {
      set('fullName', prefill?.name ?? '');
      set('phone', prefill?.phone ? formatPkMobile(prefill.phone) : '');
      set('city', '');
      set('address', '');
      set('postalCode', '');
    }
    setClientErrors({});
  }

  function clearError(field: CheckoutField) {
    setClientErrors(({ [field]: _removed, ...rest }) => rest);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Manual submission (no `action` prop) so React doesn't reset the form — fields and the
    // chosen screenshot are kept if the server returns an error.
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = checkoutFieldsSchema.safeParse({
      ...Object.fromEntries(
        [
          'fullName',
          'phone',
          'email',
          'city',
          'address',
          'postalCode',
          'notes',
          'transactionRef',
        ].map((k) => [k, String(formData.get(k) ?? '')]),
      ),
      paymentMethod: method ?? undefined,
      transferChannel: method === 'bank_transfer' ? channel : undefined,
    });
    const nextErrors = parsed.success ? {} : fieldErrorsFrom(parsed.error);
    if (method === 'bank_transfer') {
      const problem = validateScreenshot(formData.get('screenshot') as File | null);
      if (problem) nextErrors.screenshot = problem;
    }
    setClientErrors(nextErrors);

    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${firstInvalid}"], [name="paymentMethod"]`)
        ?.focus();
      return;
    }

    formData.set(
      'lines',
      JSON.stringify(purchasable.map((i) => ({ variantId: i.variantId, quantity: i.quantity }))),
    );
    checkoutIdRef.current ??= crypto.randomUUID();
    formData.set('checkoutId', checkoutIdRef.current);
    formData.set('expectedTotal', String(totals.total));
    if (method !== 'bank_transfer') formData.delete('screenshot');
    startTransition(() => formAction(formData));
  }

  if (!hydrated) {
    return (
      <div aria-busy className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-64 w-full rounded-card" />
          <Skeleton className="h-80 w-full rounded-card" />
        </div>
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    );
  }

  if (purchasable.length === 0 && state.status !== 'success') {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        description="Add something you love, then come back to check out."
        action={
          <ButtonLink href="/shop" withArrow>
            Continue shopping
          </ButtonLink>
        }
      />
    );
  }

  const blocked = totals.unavailableCount > 0;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby={`${base}-title`}
      className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px] lg:items-start xl:gap-12"
    >
      <h2 id={`${base}-title`} className="sr-only">
        Checkout
      </h2>

      {/* Mobile: collapsible summary first */}
      <details className="group rounded-card border border-gold bg-ivory lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-display text-[18px] [&::-webkit-details-marker]:hidden">
          <span>
            Order summary{' '}
            <span className="font-body text-[15px] text-muted">({totals.itemCount})</span>
          </span>
          <span className="flex items-center gap-2 font-body text-[18px] font-bold">
            {formatPrice(totals.total)}
            <span aria-hidden className="text-gold-dark transition-transform group-open:rotate-180">
              ▾
            </span>
          </span>
        </summary>
        <div className="border-t border-gold/50 px-5 py-4">
          <SummaryLines items={purchasable} />
        </div>
      </details>

      <div className="flex flex-col gap-6">
        <div ref={alertRef} tabIndex={-1} className="empty:hidden focus-visible:outline-none">
          {state.status === 'error' && state.message ? (
            <p
              role="alert"
              className="flex gap-3 rounded-xl border border-gold bg-sand px-4 py-3 text-[16px] font-semibold text-ink"
            >
              <CircleAlert aria-hidden size={20} className="mt-0.5 shrink-0 text-gold-dark" />
              {state.message}
            </p>
          ) : null}
        </div>

        <Section step={1} title="Contact details">
          {!prefill ? (
            <p className="-mt-2 mb-5 text-[15px] text-muted">
              Have an account?{' '}
              <Link
                href={'/login?next=/checkout' as Route}
                className="font-semibold text-gold-dark underline-offset-4 hover:underline"
              >
                Sign in
              </Link>{' '}
              for faster checkout — or continue as a guest.
            </p>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              id={`${base}-name`}
              label="Full name"
              required
              error={errors.fullName}
              className="sm:col-span-2"
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  name="fullName"
                  autoComplete="name"
                  maxLength={80}
                  defaultValue={initialAddress?.recipientName ?? prefill?.name}
                  onChange={() => clearError('fullName')}
                />
              )}
            </FormField>
            <FormField
              id={`${base}-phone`}
              label="Mobile number"
              required
              error={errors.phone}
              hint="For delivery updates, e.g. 0300-1234567"
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="03XX-XXXXXXX"
                  maxLength={16}
                  defaultValue={
                    initialAddress
                      ? formatPkMobile(initialAddress.phone)
                      : prefill?.phone
                        ? formatPkMobile(prefill.phone)
                        : undefined
                  }
                  onChange={() => clearError('phone')}
                />
              )}
            </FormField>
            <FormField
              id={`${base}-email`}
              label="Email"
              error={errors.email}
              hint="For your order receipt"
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={120}
                  defaultValue={prefill?.email}
                  onChange={() => clearError('email')}
                />
              )}
            </FormField>
          </div>
        </Section>

        <Section step={2} title="Delivery address">
          {savedAddresses.length > 0 ? (
            <fieldset className="mb-6">
              <legend className="mb-3 px-1 font-display text-[16px]">Deliver to</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[...savedAddresses, null].map((a) => {
                  const id = a?.id ?? 'new';
                  const checked = selectedAddressId === id;
                  return (
                    <label
                      key={id}
                      className={cn(
                        'flex cursor-pointer gap-3 rounded-2xl border-[1.5px] p-4 transition-colors',
                        checked
                          ? 'border-ink bg-ivory shadow-soft'
                          : 'border-gold/60 hover:border-gold',
                        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-gold-dark',
                      )}
                    >
                      <input
                        type="radio"
                        name="savedAddress"
                        value={id}
                        checked={checked}
                        onChange={() => selectAddress(id)}
                        className="mt-1 size-4 shrink-0 accent-ink"
                      />
                      {a ? (
                        <span className="min-w-0 text-[15px] leading-snug">
                          <span className="block font-display text-[16px] text-ink">
                            {a.label}
                            {a.isDefault ? <span className="text-muted"> · Default</span> : null}
                          </span>
                          <span className="block text-muted">
                            {a.recipientName}, {a.address}, {a.city}
                          </span>
                        </span>
                      ) : (
                        <span className="font-display text-[16px] text-ink">+ New address</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id={`${base}-city`} label="City" required error={errors.city}>
              {(a11y) => (
                <>
                  <Input
                    {...a11y}
                    name="city"
                    list={`${base}-cities`}
                    autoComplete="address-level2"
                    maxLength={60}
                    defaultValue={initialAddress?.city}
                    onChange={() => clearError('city')}
                  />
                  <datalist id={`${base}-cities`}>
                    {pakistanCities.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              )}
            </FormField>
            <FormField id={`${base}-postal`} label="Postal code" error={errors.postalCode}>
              {(a11y) => (
                <Input
                  {...a11y}
                  name="postalCode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={5}
                  defaultValue={initialAddress?.postalCode}
                  onChange={() => clearError('postalCode')}
                />
              )}
            </FormField>
            <FormField
              id={`${base}-address`}
              label="Full address"
              required
              error={errors.address}
              hint="House / flat, street, area / sector, nearby landmark"
              className="sm:col-span-2"
            >
              {(a11y) => (
                <Textarea
                  {...a11y}
                  name="address"
                  rows={3}
                  autoComplete="street-address"
                  maxLength={250}
                  defaultValue={initialAddress?.address}
                  onChange={() => clearError('address')}
                />
              )}
            </FormField>
            {prefill && selectedAddressId === 'new' ? (
              <label className="flex items-center gap-3 text-[16px] sm:col-span-2">
                <input
                  type="checkbox"
                  name="saveAddress"
                  defaultChecked
                  className="size-5 accent-ink"
                />
                Save this address to my account
              </label>
            ) : null}
            <FormField
              id={`${base}-notes`}
              label="Order notes"
              error={errors.notes}
              className="sm:col-span-2"
            >
              {(a11y) => (
                <Textarea
                  {...a11y}
                  name="notes"
                  rows={2}
                  maxLength={300}
                  placeholder="e.g. Please call before delivery"
                  onChange={() => clearError('notes')}
                />
              )}
            </FormField>
          </div>
        </Section>

        <Section step={3} title="Payment">
          <PaymentSection
            method={method}
            onMethodChange={setMethod}
            channel={channel}
            onChannelChange={setChannel}
            total={totals.total}
            errors={errors}
            clearError={clearError}
          />
        </Section>
      </div>

      <div className="flex flex-col gap-5 lg:sticky lg:top-6">
        <div className="hidden rounded-card border border-gold/60 bg-ivory p-6 lg:block">
          <h2 className="mb-4 font-display text-[20px]">Your items</h2>
          <SummaryLines items={purchasable} />
        </div>
        <OrderSummary
          totals={totals}
          title="Payment summary"
          action={
            <>
              <Button
                type="submit"
                size="lg"
                disabled={pending || blocked}
                className="h-13 w-full px-5 text-[18px] sm:px-10 sm:text-[20px]"
              >
                <Lock aria-hidden size={18} />
                {pending ? 'Placing order…' : `Place order · ${formatPrice(totals.total)}`}
              </Button>
              {blocked ? (
                <p className="mt-2 text-center text-[14px] font-semibold text-gold-dark">
                  Remove sold-out items from your cart to continue.
                </p>
              ) : null}
            </>
          }
        />
        <p className="px-2 text-center text-[14px] text-muted">
          By placing your order you agree to our terms. We&apos;ll call or message to confirm your
          order before dispatch.
        </p>
      </div>
    </form>
  );
}
