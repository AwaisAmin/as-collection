'use client';

import type { AdminMediaDto } from '@as/contracts';
import { ImageOff, ImagePlus, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { thumbUrl } from '../thumb';
import { ImagePicker } from './image-picker';

/** What a form keeps for one chosen image. */
export interface ChosenImage {
  id: string;
  url: string;
  alt: string | null;
}

export const chosenFromMedia = (media: AdminMediaDto): ChosenImage => ({
  id: media.id,
  url: thumbUrl(media, 640),
  alt: media.alt,
});

/** One image (a category picture, a banner, a brand logo): preview, choose, remove. */
export function ImageField({
  label,
  hint,
  value,
  onChange,
  canUpload,
  error,
  aspect = 'aspect-square',
}: {
  label: string;
  hint?: string;
  value: ChosenImage | null;
  onChange: (image: ChosenImage | null) => void;
  canUpload: boolean;
  error?: string | undefined;
  /** Preview shape, e.g. `aspect-[3/1]` for banners. */
  aspect?: string;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      <div
        className={`border-line bg-canvas flex w-full items-center justify-center overflow-hidden rounded-lg border ${aspect}`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- library preview
          <img src={value.url} alt={value.alt ?? ''} className="size-full object-cover" />
        ) : (
          <ImageOff aria-hidden size={22} className="text-muted" />
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => setPicking(true)}>
          <ImagePlus aria-hidden size={15} />
          {value ? `Change ${label.toLowerCase()}` : `Choose ${label.toLowerCase()}`}
        </Button>
        {value ? (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X aria-hidden size={15} />
            Remove
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="text-danger text-[13px]">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-muted">{hint}</p>
      ) : null}
      {picking ? (
        <ImagePicker
          single
          title={`Choose ${label.toLowerCase()}`}
          confirmLabel="Use this image"
          chosen={new Set()}
          canUpload={canUpload}
          onClose={() => setPicking(false)}
          onAdd={(images) => {
            const first = images[0];
            if (first) onChange(chosenFromMedia(first));
          }}
        />
      ) : null}
    </div>
  );
}
