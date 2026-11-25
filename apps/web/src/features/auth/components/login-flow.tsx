'use client';

import { ArrowLeft, MessageCircle, Smartphone } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useId, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { OtpInput } from '@/components/ui/otp-input';

import {
  completeProfileAction,
  googleSignInAction,
  requestOtpAction,
  verifyOtpAction,
} from '../actions';
import { GoogleButton } from './google-button';

/** Google sign-in: offered when the store has a Google client id. */
export type GoogleOption = { mode: 'google'; clientId: string } | null;

type Step = 'phone' | 'code' | 'name';

/** Phone → 6-digit code (WhatsApp/SMS) → name (first time only). Google as a one-tap alternative. */
export function LoginFlow({ next, google }: { next: Route; google: GoogleOption }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [displayPhone, setDisplayPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [isPending, startTransition] = useTransition();
  const base = useId();
  const errorId = `${base}-error`;

  // Resend countdown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  function finish() {
    router.replace(next);
    router.refresh();
  }

  function sendCode(rawPhone: string) {
    setError(null);
    startTransition(async () => {
      const result = await requestOtpAction(rawPhone);
      if (!result.ok) {
        setError(result.error);
        // The API's own wait: the countdown shows it instead of a "Resend" that will fail.
        if (result.retryIn) setResendIn(result.retryIn);
        return;
      }
      setPhone(result.phone);
      setDisplayPhone(result.displayPhone);
      setResendIn(result.resendIn);
      setCode('');
      setStep('code');
      if (result.devCode) {
        toast(`Demo code: ${result.devCode}`, {
          description: 'Development mode — in production this arrives on WhatsApp/SMS.',
          duration: 15000,
        });
      }
    });
  }

  function verify(value: string) {
    setError(null);
    startTransition(async () => {
      const result = await verifyOtpAction(phone, value);
      if (!result.ok) {
        setError(result.error);
        setCode('');
        if (result.restart) setResendIn(0);
        return;
      }
      if (result.needsName) setStep('name');
      else finish();
    });
  }

  function onPhoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendCode(String(new FormData(event.currentTarget).get('phone') ?? ''));
  }

  function onNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '');
    setError(null);
    startTransition(async () => {
      const result = await completeProfileAction(name);
      if (!result.ok) setError(result.error);
      else finish();
    });
  }

  function signInWithGoogle(credential: string) {
    setError(null);
    startTransition(async () => {
      const result = await googleSignInAction(credential);
      if (!result.ok) setError(result.error);
      else if (result.needsName) setStep('name');
      else finish();
    });
  }

  const errorText = error ? (
    <p id={errorId} role="alert" className="text-center text-[15px] font-semibold text-gold-dark">
      {error}
    </p>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-md rounded-card border border-gold bg-ivory p-6 shadow-soft sm:p-8">
      {step === 'phone' ? (
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-gold bg-cream">
              <Smartphone aria-hidden className="size-6 text-gold-dark" />
            </span>
            <h2 className="font-display text-[26px]">Sign in or create an account</h2>
            <p className="mt-2 text-[16px] text-muted">
              Enter your mobile number — we&apos;ll send a 6-digit code on WhatsApp.
            </p>
          </div>

          <form onSubmit={onPhoneSubmit} noValidate className="flex flex-col gap-4">
            <FormField
              id={`${base}-phone`}
              label="Mobile number"
              required
              error={error ?? undefined}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="03XX-XXXXXXX"
                  defaultValue={displayPhone}
                  maxLength={16}
                  autoFocus
                  size="lg"
                />
              )}
            </FormField>
            <Button
              type="submit"
              size="lg"
              disabled={isPending}
              className="h-13 w-full text-[20px]"
            >
              <MessageCircle aria-hidden size={19} />
              {isPending ? 'Sending code…' : 'Send code'}
            </Button>
          </form>

          {google ? (
            <>
              <div className="flex items-center gap-3 text-[15px] text-muted" aria-hidden>
                <span className="h-px flex-1 bg-gold/50" />
                or
                <span className="h-px flex-1 bg-gold/50" />
              </div>

              <GoogleButton clientId={google.clientId} onCredential={signInWithGoogle} />
            </>
          ) : null}

          <p className="text-center text-[14px] text-muted">
            No password needed. New here? Your account is created automatically.
          </p>
        </div>
      ) : null}

      {step === 'code' ? (
        <div className="flex flex-col gap-6">
          <button
            type="button"
            onClick={() => {
              setStep('phone');
              setError(null);
            }}
            className="inline-flex w-fit items-center gap-1.5 text-[15px] font-semibold text-gold-dark hover:underline"
          >
            <ArrowLeft aria-hidden size={16} />
            Change number
          </button>
          <div className="text-center">
            <h2 className="font-display text-[26px]">Enter the code</h2>
            <p className="mt-2 text-[16px] text-muted">
              We sent a 6-digit code to <span className="font-bold text-ink">{displayPhone}</span>.
            </p>
          </div>

          <OtpInput
            value={code}
            onChange={(v) => {
              setCode(v);
              setError(null);
            }}
            onComplete={verify}
            disabled={isPending}
            invalid={Boolean(error)}
            describedBy={error ? errorId : undefined}
            autoFocus
          />
          {errorText}

          <Button
            onClick={() => verify(code)}
            disabled={isPending || code.length !== 6}
            size="lg"
            className="h-13 w-full text-[20px]"
          >
            {isPending ? 'Verifying…' : 'Verify & continue'}
          </Button>

          <p className="text-center text-[15px] text-muted">
            Didn&apos;t get it?{' '}
            {resendIn > 0 ? (
              <span>Resend in {resendIn}s</span>
            ) : (
              <button
                type="button"
                onClick={() => sendCode(phone)}
                disabled={isPending}
                className="font-semibold text-gold-dark underline-offset-4 hover:underline"
              >
                Resend code
              </button>
            )}
          </p>
        </div>
      ) : null}

      {step === 'name' ? (
        <form onSubmit={onNameSubmit} noValidate className="flex flex-col gap-6">
          <div className="text-center">
            <h2 className="font-display text-[26px]">Welcome to AS Collection Hub!</h2>
            <p className="mt-2 text-[16px] text-muted">One last thing — what should we call you?</p>
          </div>
          <FormField id={`${base}-name`} label="Full name" required error={error ?? undefined}>
            {(a11y) => (
              <Input {...a11y} name="name" autoComplete="name" maxLength={80} autoFocus size="lg" />
            )}
          </FormField>
          <Button type="submit" size="lg" disabled={isPending} className="h-13 w-full text-[20px]">
            {isPending ? 'Saving…' : 'Continue'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
