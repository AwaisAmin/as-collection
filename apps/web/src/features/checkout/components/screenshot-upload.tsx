'use client';

import { ImageUp, X } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';

import type { FieldA11yProps } from '@/components/ui/form-field';
import { cn } from '@/lib/utils/cn';

import { ACCEPTED_SCREENSHOT_TYPES } from '../schemas';

interface ScreenshotUploadProps extends FieldA11yProps {
  name: string;
  onChange?: () => void;
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Native file input (keyboard/screen-reader friendly, submits with the form) styled as a
 * drop-style button, with an image preview once a file is chosen.
 */
export function ScreenshotUpload({ name, onChange, ...a11y }: ScreenshotUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Revoke object URLs to avoid leaking memory.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setPreview(next && next.type.startsWith('image/') ? URL.createObjectURL(next) : null);
    onChange?.();
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = '';
    setFile(null);
    setPreview(null);
    onChange?.();
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        className={cn(
          'flex cursor-pointer items-center gap-4 rounded-2xl border-[1.5px] border-dashed border-gold bg-ivory px-5 py-4 transition-colors hover:bg-sand/60',
          'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-gold-dark',
          a11y['aria-invalid'] && 'border-solid shadow-[0_0_0_2px_var(--color-gold-light)]',
        )}
      >
        <input
          ref={inputRef}
          {...a11y}
          type="file"
          name={name}
          accept={ACCEPTED_SCREENSHOT_TYPES.join(',')}
          onChange={handleChange}
          className="sr-only"
        />
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-gold bg-cream">
          <ImageUp aria-hidden size={20} className="text-gold-dark" />
        </span>
        <span className="font-body leading-tight">
          <span className="block text-[16px] font-bold text-ink">
            {file ? 'Change screenshot' : 'Upload payment screenshot'}
          </span>
          <span className="block text-[14px] text-muted">JPG, PNG or WEBP · up to 5 MB</span>
        </span>
      </label>

      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-gold/50 bg-ivory p-2.5">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img
              src={preview}
              alt=""
              className="size-14 rounded-lg border border-gold/40 object-cover"
            />
          ) : null}
          <p className="min-w-0 flex-1 text-[15px]">
            <span className="block truncate font-semibold text-ink">{file.name}</span>
            <span className="text-muted">{formatBytes(file.size)}</span>
          </p>
          <button
            type="button"
            onClick={clear}
            aria-label="Remove screenshot"
            className="rounded-full p-2 text-muted transition-colors hover:bg-sand hover:text-ink"
          >
            <X aria-hidden size={18} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
