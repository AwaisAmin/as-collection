'use client';

import { KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { useActionState, useId } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

import { loginAction, type LoginState } from '../actions';

const initial: LoginState = { step: 'credentials' };

/** Email + password, then the authenticator code (or first-time authenticator setup). */
export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  const id = useId();

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {state.step === 'credentials' ? (
        <>
          <div className="flex items-center gap-2 text-[15px] text-muted">
            <KeyRound aria-hidden size={18} />
            Sign in with your staff account.
          </div>
          {state.error ? <Alert tone="error">{state.error}</Alert> : null}
          <Field id={`${id}-email`} label="Work email" required>
            {(control) => (
              <Input
                {...control}
                name="email"
                type="email"
                autoComplete="username"
                defaultValue={state.email}
                autoFocus
                required
              />
            )}
          </Field>
          <Field id={`${id}-password`} label="Password" required>
            {(control) => (
              <Input
                {...control}
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            )}
          </Field>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? 'Signing in…' : 'Continue'}
          </Button>
        </>
      ) : null}

      {state.step === 'enrol' ? (
        <>
          <div className="flex gap-3">
            <ShieldCheck aria-hidden size={22} className="mt-0.5 shrink-0 text-gold-dark" />
            <div className="flex flex-col gap-1">
              <h2 className="text-[16px] font-semibold">Set up two-step verification</h2>
              <p className="text-[14px] text-muted">
                Scan this code with an authenticator app (Google Authenticator, Microsoft
                Authenticator, 1Password…), then enter the 6-digit code it shows.
              </p>
            </div>
          </div>
          <div
            className="border-line mx-auto rounded-lg border bg-white p-2"
            // Server-generated SVG of our own otpauth:// URI.
            dangerouslySetInnerHTML={{ __html: state.qrSvg }}
            role="img"
            aria-label="QR code for your authenticator app"
          />
          <details className="text-[13px] text-muted">
            <summary className="cursor-pointer">Can&apos;t scan? Enter this key instead</summary>
            <code
              data-testid="totp-secret"
              className="bg-canvas mt-2 block rounded px-2 py-1.5 font-mono text-[13px] break-all text-text"
            >
              {state.secret}
            </code>
          </details>
        </>
      ) : null}

      {state.step !== 'credentials' ? (
        <>
          {state.step === 'code' ? (
            <div className="flex items-center gap-2 text-[15px] text-muted">
              <Smartphone aria-hidden size={18} />
              Enter the 6-digit code from your authenticator app.
            </div>
          ) : null}
          <input type="hidden" name="challengeToken" value={state.challengeToken} />
          {state.error ? <Alert tone="error">{state.error}</Alert> : null}
          <Field id={`${id}-code`} label="Authentication code" required>
            {(control) => (
              <Input
                {...control}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]*"
                maxLength={7}
                autoFocus
                required
                className="font-mono tracking-[0.3em]"
              />
            )}
          </Field>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? 'Verifying…' : state.step === 'enrol' ? 'Turn on and sign in' : 'Verify'}
          </Button>
        </>
      ) : null}
    </form>
  );
}
