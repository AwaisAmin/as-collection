'use client';

import type { AdminMediaDto } from '@as/contracts';
import { Check, Search, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState, useTransition } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { browseImages, uploadImages } from '@/features/media/actions';
import { thumbUrl } from '@/features/media/thumb';
import { cn } from '@/lib/utils/cn';

/**
 * Pick images for a product: upload new ones (several at once) or choose from the library.
 * Images already on the product are shown as chosen and can't be added twice.
 */
export function ImagePicker({
  onClose,
  onAdd,
  chosen,
  canUpload,
}: {
  onClose: () => void;
  onAdd: (images: AdminMediaDto[]) => void;
  chosen: ReadonlySet<string>;
  canUpload: boolean;
}) {
  const [items, setItems] = useState<AdminMediaDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Map<string, AdminMediaDto>>(new Map());
  const [error, setError] = useState<string | null>(null);
  /** Shown inside the dialog: toasts would sit behind the modal. */
  const [failures, setFailures] = useState<{ name: string; error: string }[]>([]);
  const [loading, startLoading] = useTransition();
  const [uploading, startUploading] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const searchId = useId();

  const load = (q: string, before?: string) =>
    startLoading(async () => {
      const page = await browseImages({ q, ...(before ? { before } : {}) });
      if (!page) {
        setError('The image library could not be loaded.');
        return;
      }
      setError(null);
      setItems((current) => (before ? [...current, ...page.items] : page.items));
      setCursor(page.nextCursor);
    });

  // Mounted only while open: each opening starts with a fresh library page.
  useEffect(() => {
    load('');
  }, []);

  const toggle = (media: AdminMediaDto) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(media.id)) next.delete(media.id);
      else next.set(media.id, media);
      return next;
    });

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    const body = new FormData();
    for (const file of files) body.append('files', file);
    startUploading(async () => {
      const result = await uploadImages(body);
      setFailures(result.failed);
      if (result.uploaded.length) {
        // New uploads go to the top of the library and are selected straight away.
        setItems((current) => [
          ...result.uploaded,
          ...current.filter((m) => !result.uploaded.some((u) => u.id === m.id)),
        ]);
        setSelected((current) => {
          const next = new Map(current);
          for (const media of result.uploaded) if (!chosen.has(media.id)) next.set(media.id, media);
          return next;
        });
      }
      if (fileInput.current) fileInput.current.value = '';
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add images"
      description="Upload new photos or choose from the library. JPG, PNG or WEBP up to 20 MB; they are optimised automatically."
      className="max-w-3xl"
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <form
          className="relative flex-1"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            load(query);
          }}
        >
          <label htmlFor={searchId} className="sr-only">
            Search images by description
          </label>
          <Search
            aria-hidden
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by description"
            maxLength={100}
            className="pl-9"
          />
        </form>
        {canUpload ? (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => upload(event.target.files)}
              data-testid="image-upload-input"
            />
            <Button
              variant="secondary"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              <Upload aria-hidden size={16} />
              {uploading ? 'Uploading…' : 'Upload photos'}
            </Button>
          </>
        ) : null}
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {failures.length ? (
        <Alert tone="error">
          <p>
            {failures.length === 1
              ? 'One photo was not uploaded:'
              : `${String(failures.length)} photos were not uploaded:`}
          </p>
          <ul className="list-disc pl-5">
            {failures.map((failure, index) => (
              <li key={`${failure.name}-${String(index)}`}>
                {failure.name}: {failure.error}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="-mx-1 max-h-[55vh] overflow-y-auto px-1">
        {items.length ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {items.map((media) => {
              const already = chosen.has(media.id);
              const isSelected = selected.has(media.id);
              return (
                <li key={media.id}>
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => toggle(media)}
                    aria-pressed={isSelected}
                    aria-label={`${media.alt ?? 'Untitled image'}${already ? ' (already added)' : ''}`}
                    className={cn(
                      'border-line bg-canvas relative block aspect-square w-full overflow-hidden rounded-md border-2',
                      isSelected ? 'border-gold-dark' : 'border-transparent',
                      already && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- library thumbnails */}
                    <img
                      src={thumbUrl(media)}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                    {isSelected ? (
                      <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-gold-dark text-white">
                        <Check aria-hidden size={13} />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-10 text-center text-[14px] text-muted">
            {loading ? 'Loading…' : 'No images yet. Upload some photos to start.'}
          </p>
        )}
        {cursor ? (
          <div className="flex justify-center pt-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => load(query, cursor)}
            >
              {loading ? 'Loading…' : 'Show more'}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted">
          {selected.size ? `${String(selected.size)} selected` : 'Select one or more images.'}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose}>
            Back
          </Button>
          <Button
            disabled={!selected.size}
            onClick={() => {
              onAdd([...selected.values()]);
              onClose();
            }}
          >
            Add to product
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
