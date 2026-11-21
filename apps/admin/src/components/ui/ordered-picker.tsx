'use client';

import { ArrowDown, ArrowUp, X } from 'lucide-react';

import { Select } from './select';

const iconButton =
  'hover:bg-canvas inline-flex size-8 items-center justify-center rounded-md text-muted hover:text-text disabled:pointer-events-none disabled:opacity-30';

/** Choose items from a list and put them in order (tiles, tabs…). */
export function OrderedPicker({
  label,
  options,
  value,
  onChange,
  max,
  emptyText,
  error,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: readonly string[];
  onChange: (value: string[]) => void;
  max: number;
  emptyText: string;
  error?: string | undefined;
}) {
  const names = new Map(options.map((o) => [o.value, o.label]));
  const remaining = options.filter((o) => !value.includes(o.value));
  const move = (index: number, by: -1 | 1) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    if (item !== undefined) next.splice(index + by, 0, item);
    onChange(next);
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-1.5 text-[13px] font-medium">{label}</legend>
      {value.length ? (
        <ol className="border-line divide-line flex flex-col divide-y rounded-lg border">
          {value.map((item, index) => (
            <li key={item} className="flex items-center gap-2 px-3 py-1.5 text-[14px]">
              <span className="w-5 text-right text-[13px] text-muted tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                {names.get(item) ?? <span className="text-warning">{item} (not found)</span>}
              </span>
              <button
                type="button"
                className={iconButton}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                title="Move up"
              >
                <ArrowUp aria-hidden size={15} />
                <span className="sr-only">Move {names.get(item) ?? item} up</span>
              </button>
              <button
                type="button"
                className={iconButton}
                disabled={index === value.length - 1}
                onClick={() => move(index, 1)}
                title="Move down"
              >
                <ArrowDown aria-hidden size={15} />
                <span className="sr-only">Move {names.get(item) ?? item} down</span>
              </button>
              <button
                type="button"
                className={`${iconButton} hover:text-danger`}
                onClick={() => onChange(value.filter((v) => v !== item))}
                title="Remove"
              >
                <X aria-hidden size={15} />
                <span className="sr-only">Remove {names.get(item) ?? item}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[14px] text-muted">{emptyText}</p>
      )}
      {remaining.length && value.length < max ? (
        <Select
          value=""
          onChange={(event) => {
            if (event.target.value) onChange([...value, event.target.value]);
          }}
          aria-label={`Add to ${label}`}
          className="sm:max-w-xs"
        >
          <option value="">Add…</option>
          {remaining.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : null}
      {error ? <p className="text-danger text-[13px]">{error}</p> : null}
    </fieldset>
  );
}
