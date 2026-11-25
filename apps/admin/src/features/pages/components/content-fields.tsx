'use client';

import type { ContentImage, ContentLink } from '@as/contracts';
import { ImageOff, ImagePlus } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ImagePicker } from '@/features/media/components/image-picker';

import { previewSrc, toContentSrc } from '../content-image';

/** A section image: preview, choose from the library, and its description (required by the shop). */
export function ContentImageField({
  label,
  value,
  onChange,
  storefrontUrl,
  canUpload,
  error,
  aspect = 'aspect-[4/3]',
  preview = true,
}: {
  label: string;
  value: ContentImage | undefined;
  onChange: (image: ContentImage) => void;
  storefrontUrl: string;
  canUpload: boolean;
  error?: string | undefined;
  aspect?: string;
  /** False when the picture is shown elsewhere (the hotspot map). */
  preview?: boolean;
}) {
  const id = useId();
  const [picking, setPicking] = useState(false);
  const src = value?.src ? previewSrc(value.src, storefrontUrl) : '';
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">
        {label}
        <span className="text-danger"> *</span>
      </span>
      {!preview && src ? null : (
        <div
          className={`border-line bg-canvas flex w-full max-w-xs items-center justify-center overflow-hidden rounded-lg border ${aspect}`}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview from the shop / library
            <img src={src} alt={value?.alt ?? ''} className="size-full object-cover" />
          ) : (
            <ImageOff aria-hidden size={22} className="text-muted" />
          )}
        </div>
      )}
      <div>
        <Button variant="secondary" size="sm" onClick={() => setPicking(true)}>
          <ImagePlus aria-hidden size={15} />
          {src ? 'Change picture' : 'Choose picture'}
        </Button>
      </div>
      <Field
        id={`${id}-alt`}
        label="Picture description"
        hint="What it shows, for screen readers and search engines."
        error={error}
        required
      >
        {(control) => (
          <Input
            {...control}
            value={value?.alt ?? ''}
            onChange={(event) => onChange({ src: value?.src ?? '', alt: event.target.value })}
            maxLength={200}
          />
        )}
      </Field>
      {picking ? (
        <ImagePicker
          single
          title={`Choose ${label.toLowerCase()}`}
          confirmLabel="Use this picture"
          chosen={new Set()}
          canUpload={canUpload}
          onClose={() => setPicking(false)}
          onAdd={(images) => {
            const media = images[0];
            if (media) {
              onChange({
                src: toContentSrc(media.url),
                alt: value?.alt || media.alt || '',
              });
            }
          }}
        />
      ) : null}
    </div>
  );
}

/** A button: its text and where it goes. */
export function LinkFields({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: ContentLink | undefined;
  onChange: (link: ContentLink) => void;
  error?: string | undefined;
}) {
  const id = useId();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id={`${id}-label`} label={`${label} text`} required>
        {(control) => (
          <Input
            {...control}
            value={value?.label ?? ''}
            onChange={(event) => onChange({ label: event.target.value, href: value?.href ?? '' })}
            maxLength={80}
          />
        )}
      </Field>
      <Field
        id={`${id}-href`}
        label={`${label} link`}
        hint="A shop path like /shop?sale=1, or an https:// address."
        error={error}
        required
      >
        {(control) => (
          <Input
            {...control}
            value={value?.href ?? ''}
            onChange={(event) => onChange({ label: value?.label ?? '', href: event.target.value })}
            maxLength={500}
            autoComplete="off"
          />
        )}
      </Field>
    </div>
  );
}
