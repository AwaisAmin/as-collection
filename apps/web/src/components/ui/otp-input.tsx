'use client';

import { type ClipboardEvent, type KeyboardEvent, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils/cn';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired when all digits are filled (auto-submit). */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}

/**
 * One box per digit: auto-advance, backspace goes back, arrow keys move, pasting a full
 * code fills every box, and `autocomplete="one-time-code"` lets phones offer the SMS code.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  describedBy,
  autoFocus,
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  // Focus the first box when shown and whenever the code is cleared (e.g. after a wrong code).
  useEffect(() => {
    if (autoFocus && value === '' && !disabled) refs.current[0]?.focus();
  }, [autoFocus, value, disabled]);

  function update(next: string) {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
    return clean;
  }

  function setDigit(index: number, digit: string) {
    const chars = digits.slice();
    chars[index] = digit;
    const clean = update(chars.join(''));
    if (digit && index < length - 1) refs.current[Math.min(clean.length, length - 1)]?.focus();
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      setDigit(index - 1, '');
      refs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const clean = update(event.clipboardData.getData('text'));
    refs.current[Math.min(clean.length, length - 1)]?.focus();
  }

  return (
    <div
      role="group"
      aria-label="Verification code"
      aria-describedby={describedBy}
      className="flex justify-center gap-2 sm:gap-3"
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, '').slice(-1))}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          className={cn(
            'size-12 rounded-xl border-[1.5px] bg-ivory text-center font-body text-[24px] font-bold text-ink transition-shadow sm:size-14',
            'focus:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-gold-dark)]',
            invalid ? 'border-gold-dark shadow-[0_0_0_2px_var(--color-gold-light)]' : 'border-gold',
            'disabled:opacity-60',
          )}
        />
      ))}
    </div>
  );
}
