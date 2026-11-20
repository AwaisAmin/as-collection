'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/input';

const HEX = /^#(?:[0-9a-f]{3}){1,2}$/i;

/** `#abc` → `#aabbcc` (the colour picker only takes the long form). */
const longHex = (hex: string) =>
  hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;

/** A colour for a value's swatch: type a hex code or pick one; empty means no swatch. */
export function SwatchInput({
  id,
  defaultValue,
  invalid,
  describedBy,
}: {
  id: string;
  defaultValue: string | null;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? '');
  const valid = HEX.test(value);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="Pick a colour"
        value={valid ? longHex(value).toLowerCase() : '#000000'}
        onChange={(event) => setValue(event.target.value)}
        className="border-line bg-surface size-10 shrink-0 cursor-pointer rounded-lg border p-1"
      />
      <Input
        id={id}
        name="swatch"
        value={value}
        onChange={(event) => setValue(event.target.value.trim())}
        placeholder="None, or e.g. #8b1a1a"
        maxLength={7}
        autoComplete="off"
        className="font-mono"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue('')}
          className="text-[13px] text-muted hover:text-text"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
