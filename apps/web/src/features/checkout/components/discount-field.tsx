'use client';

import { Tag, X } from 'lucide-react';
import { type KeyboardEvent, useId, useState } from 'react';

import { Button } from '@/components/ui/button';

interface DiscountFieldProps {
  /** The applied code, if any. */
  applied: string | null;
  /** Why the last code was refused (or why an applied one was dropped). */
  error: string | null;
  checking: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
}

/**
 * Discount code entry inside the checkout form. It has no `name` and Enter applies the code, so
 * typing a code can never submit (place) the order.
 */
export function DiscountField({ applied, error, checking, onApply, onRemove }: DiscountFieldProps) {
  const id = useId();
  const [code, setCode] = useState('');

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-gold/60 bg-white/60 px-4 py-2.5">
        <p className="flex items-center gap-2 text-[16px]">
          <Tag aria-hidden size={16} className="text-gold-dark" />
          <span>
            Code <span className="font-bold tracking-wide">{applied}</span> applied
          </span>
        </p>
        <button
          type="button"
          onClick={onRemove}
          disabled={checking}
          aria-label={`Remove discount code ${applied}`}
          className="inline-flex items-center gap-1 text-[15px] text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          <X aria-hidden size={15} />
          Remove
        </button>
      </div>
    );
  }

  const apply = () => {
    if (code.trim()) onApply(code.trim());
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      apply();
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-code`} className="px-1 font-display text-[16px] text-ink">
        Discount code
      </label>
      <div className="flex gap-2">
        <input
          id={`${id}-code`}
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onKeyDown={onKeyDown}
          maxLength={40}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          placeholder="e.g. EID15"
          className="h-11 min-w-0 flex-1 rounded-full border border-gold bg-transparent px-4 text-[16px] tracking-wide placeholder:tracking-normal placeholder:text-muted focus:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-gold-dark)]"
        />
        <Button
          type="button"
          size="sm"
          onClick={apply}
          disabled={checking || !code.trim()}
          className="h-11 shrink-0"
        >
          {checking ? 'Checking…' : 'Apply'}
        </Button>
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="px-1 text-[15px] font-semibold text-gold-dark"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
