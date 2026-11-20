'use client';

import type { AdminMediaDto } from '@as/contracts';
import { Copy, ExternalLink, Trash2 } from 'lucide-react';
import { startTransition, useActionState, useId, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { ActionState } from '@/lib/action-state';
import { formatBytes, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils/cn';

import { deleteImage, updateImageAlt } from '../actions';
import { thumbUrl } from '../thumb';

const count = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/** "Used by 2 products, 1 category" / "Not used anywhere". */
export function usageText(usage: AdminMediaDto['usage']): string {
  const parts = [
    usage.products ? count(usage.products, 'product', 'products') : null,
    usage.categories ? count(usage.categories, 'category', 'categories') : null,
    usage.brands ? count(usage.brands, 'brand', 'brands') : null,
    usage.collections ? count(usage.collections, 'collection', 'collections') : null,
  ].filter(Boolean);
  return parts.length ? `Used by ${parts.join(', ')}` : 'Not used anywhere';
}

const totalUsage = (usage: AdminMediaDto['usage']) =>
  usage.products + usage.categories + usage.brands + usage.collections;

/** A library tile; opens the image's details (description, where it's used, delete). */
export function MediaCard({ media, canWrite }: { media: AdminMediaDto; canWrite: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const used = totalUsage(media.usage);
  const [state, action, saving] = useActionState<ActionState, FormData>(async (prev, data) => {
    const result = await updateImageAlt(media.id, prev, data);
    if (result.done) {
      toast.success(result.done);
      setOpen(false);
    }
    return result;
  }, {});
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          setDeleteError(null);
          setOpen(true);
        }}
        className="border-line bg-surface shadow-card group flex w-full flex-col overflow-hidden rounded-lg border text-left"
      >
        <span className="bg-canvas block aspect-square overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- library thumbnails */}
          <img
            src={thumbUrl(media)}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        </span>
        <span className="flex flex-col gap-0.5 p-2 text-[13px]">
          <span className={cn('truncate', media.alt ? 'text-text' : 'text-muted italic')}>
            {media.alt ?? 'No description'}
          </span>
          <span className={used ? 'text-muted' : 'text-warning'}>
            {used ? usageText(media.usage) : 'Unused'}
          </span>
        </span>
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Image details"
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-4 sm:flex-row">
          <a
            href={media.url}
            target="_blank"
            rel="noopener"
            className="border-line bg-canvas block shrink-0 overflow-hidden rounded-md border sm:w-56"
            title="Open full size"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- library preview */}
            <img
              src={thumbUrl(media, 640)}
              alt={media.alt ?? ''}
              className="aspect-square w-full object-contain"
            />
          </a>
          <div className="flex min-w-0 flex-1 flex-col gap-3 text-[14px]">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted">Size</dt>
              <dd className="tabular-nums">
                {media.width && media.height
                  ? `${String(media.width)} × ${String(media.height)} px · `
                  : ''}
                {formatBytes(media.sizeBytes)}
              </dd>
              <dt className="text-muted">Added</dt>
              <dd>
                {formatDateTime(media.createdAt)}
                {media.uploadedBy ? ` by ${media.uploadedBy.name}` : ''}
              </dd>
              <dt className="text-muted">Use</dt>
              <dd>{usageText(media.usage)}</dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(media.url)
                    .then(() => toast.success('Link copied.'))
                    .catch(() => toast.error('Could not copy the link.'));
                }}
              >
                <Copy aria-hidden size={14} />
                Copy link
              </Button>
              <a
                href={media.url}
                target="_blank"
                rel="noopener"
                className="border-line hover:bg-canvas inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-[13px]"
              >
                <ExternalLink aria-hidden size={14} />
                Full size
              </a>
            </div>
          </div>
        </div>

        {canWrite ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              startTransition(() => action(data));
            }}
            className="flex flex-col gap-3"
            noValidate
          >
            {state.error ? <Alert tone="error">{state.error}</Alert> : null}
            <Field
              id={`${id}-alt`}
              label="Description (alt text)"
              hint="What the photo shows, for screen readers and search engines. Products can override it."
              error={state.fieldErrors?.alt}
            >
              {(control) => (
                <Input {...control} name="alt" defaultValue={media.alt ?? ''} maxLength={300} />
              )}
            </Field>
            {deleteError ? <Alert tone="error">{deleteError}</Alert> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              {used ? (
                <p className="text-[13px] text-muted">In use, so it can&apos;t be deleted.</p>
              ) : confirming ? (
                <div className="flex items-center gap-2">
                  <span className="text-[13px]">Delete for good?</span>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={deleting}
                    onClick={() =>
                      startDelete(async () => {
                        const result = await deleteImage(media.id);
                        if (result.done) {
                          toast.success(result.done);
                          setOpen(false);
                        } else {
                          setDeleteError(result.error ?? 'Could not delete the image.');
                        }
                      })
                    }
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                    Keep
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:text-danger w-fit"
                  onClick={() => setConfirming(true)}
                >
                  <Trash2 aria-hidden size={14} />
                  Delete image
                </Button>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Close
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save description'}
                </Button>
              </div>
            </div>
          </form>
        ) : null}
      </Dialog>
    </>
  );
}
