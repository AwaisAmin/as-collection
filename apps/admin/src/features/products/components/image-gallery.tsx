'use client';

import type { AdminMediaDto } from '@as/contracts';
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ImagePicker } from '@/features/media/components/image-picker';

import type { DraftImage } from '../form-model';

const iconButton =
  'hover:bg-canvas inline-flex size-8 items-center justify-center rounded-md text-muted hover:text-text disabled:pointer-events-none disabled:opacity-40';

/**
 * The product's gallery in display order: the first image is the main one in listings. Each
 * image can carry its own alt text here and be tied to one variant (a shade, a colour).
 */
export function ImageGallery({
  images,
  onChange,
  skus,
  canUpload,
  error,
}: {
  images: DraftImage[];
  onChange: (images: DraftImage[]) => void;
  /** SKUs images can be tied to. */
  skus: readonly string[];
  canUpload: boolean;
  error?: string | undefined;
}) {
  const [picking, setPicking] = useState(false);
  const id = useId();

  const move = (index: number, by: -1 | 1) => {
    const next = [...images];
    const [image] = next.splice(index, 1);
    if (image) next.splice(index + by, 0, image);
    onChange(next);
  };
  const update = (index: number, change: Partial<DraftImage>) =>
    onChange(images.map((image, i) => (i === index ? { ...image, ...change } : image)));
  const add = (media: AdminMediaDto[]) =>
    onChange([
      ...images,
      ...media.map((m) => ({
        mediaId: m.id,
        url: m.variants.find((v) => v.width >= 320)?.url ?? m.url,
        alt: '',
        mediaAlt: m.alt,
        variantSku: '',
      })),
    ]);

  return (
    <div className="flex flex-col gap-3">
      {images.length ? (
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((image, index) => (
            <li
              key={image.mediaId}
              className="border-line flex flex-col gap-2 rounded-lg border p-2"
              aria-label={`Image ${String(index + 1)} of ${String(images.length)}`}
            >
              <div className="bg-canvas relative aspect-[4/5] overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element -- library thumbnails */}
                <img
                  src={image.url}
                  alt={image.alt || image.mediaAlt || ''}
                  className="size-full object-cover"
                />
                {index === 0 ? (
                  <span className="absolute top-2 left-2 rounded-full bg-ink/80 px-2 py-0.5 text-[12px] font-medium text-white">
                    Main image
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex">
                  <button
                    type="button"
                    className={iconButton}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    title="Move earlier"
                  >
                    <ArrowLeft aria-hidden size={16} />
                    <span className="sr-only">Move earlier</span>
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    disabled={index === images.length - 1}
                    onClick={() => move(index, 1)}
                    title="Move later"
                  >
                    <ArrowRight aria-hidden size={16} />
                    <span className="sr-only">Move later</span>
                  </button>
                </div>
                <button
                  type="button"
                  className={`${iconButton} hover:text-danger`}
                  onClick={() => onChange(images.filter((_, i) => i !== index))}
                  title="Remove from this product"
                >
                  <Trash2 aria-hidden size={16} />
                  <span className="sr-only">Remove image {index + 1}</span>
                </button>
              </div>
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="text-muted">Description (alt text)</span>
                <Input
                  value={image.alt}
                  onChange={(event) => update(index, { alt: event.target.value })}
                  placeholder={image.mediaAlt ?? 'What the photo shows'}
                  maxLength={300}
                  className="h-9"
                />
              </label>
              {skus.length > 1 ? (
                <label
                  className="flex flex-col gap-1 text-[13px]"
                  htmlFor={`${id}-${image.mediaId}`}
                >
                  <span className="text-muted">Shown for</span>
                  <Select
                    id={`${id}-${image.mediaId}`}
                    value={image.variantSku}
                    onChange={(event) => update(index, { variantSku: event.target.value })}
                  >
                    <option value="">All variants</option>
                    {skus.map((sku) => (
                      <option key={sku} value={sku}>
                        {sku}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="border-line rounded-lg border border-dashed px-4 py-8 text-center text-[14px] text-muted">
          No images yet. The first image becomes the main photo in the shop.
        </p>
      )}
      {error ? <p className="text-danger text-[13px]">{error}</p> : null}
      <div>
        <Button variant="secondary" onClick={() => setPicking(true)} disabled={images.length >= 30}>
          <ImagePlus aria-hidden size={16} />
          Add images
        </Button>
      </div>
      {picking ? (
        <ImagePicker
          onClose={() => setPicking(false)}
          onAdd={add}
          chosen={new Set(images.map((i) => i.mediaId))}
          canUpload={canUpload}
        />
      ) : null}
    </div>
  );
}
