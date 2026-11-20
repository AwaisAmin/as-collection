'use client';

import type { AdminAttributeDto, AdminBrandDto, AdminProductDto } from '@as/contracts';
import { ExternalLink, Plus, Trash2, X } from 'lucide-react';
import { type ReactNode, useActionState, useId, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { createProduct, deleteProduct, type SaveState, updateProduct } from '../actions';
import {
  createPayload,
  draftFromProduct,
  emptyDraft,
  newKey,
  type ProductDraft,
  rupeesToMinor,
  updatePayload,
} from '../form-model';
import { PRODUCT_STATUS } from '../labels';
import { AttributeFields } from './attribute-fields';
import { ImageGallery } from './image-gallery';
import { VariantRows } from './variant-rows';
import { VariantTable } from './variant-table';

export interface CategoryOption {
  id: string;
  label: string;
  isActive: boolean;
  attributes: { attributeId: string; isRequired: boolean }[];
}

interface ProductEditorProps {
  product: AdminProductDto | null;
  categories: readonly CategoryOption[];
  attributes: readonly AdminAttributeDto[];
  brands: readonly AdminBrandDto[];
  canWrite: boolean;
  canUpload: boolean;
  /** The product's page in the shop (active products). */
  shopUrl: string | null;
}

/** Friendly names for API field paths in the error summary. */
const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  slug: 'Web address',
  shortDescription: 'Short description',
  description: 'Description',
  primaryCategoryId: 'Main category',
  categoryIds: 'Other categories',
  brandId: 'Brand',
  tags: 'Tags',
  specifications: 'Specifications',
  seoTitle: 'Search title',
  seoDescription: 'Search description',
  attributes: 'Details',
  media: 'Images',
  variants: 'Variants',
};

const labelFor = (path: string) => {
  const [head = '', index] = path.split('.');
  const base = FIELD_LABELS[head] ?? head;
  return index !== undefined && /^\d+$/.test(index) ? `${base} ${String(Number(index) + 1)}` : base;
};

/** Checks that need no server, with plain messages. */
function localErrors(draft: ProductDraft, isNew: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (draft.name.trim().length < 2) errors.name = 'Give the product a name.';
  if (!draft.primaryCategoryId) errors.primaryCategoryId = 'Choose the main category.';
  if (isNew) {
    if (draft.variants.length > 1 && !draft.optionAttributeIds.length) {
      errors.variants = 'With several variants, choose what customers pick between (e.g. Size).';
    }
    draft.variants.forEach((variant, i) => {
      if (draft.variants.length > 1 && draft.optionAttributeIds.some((a) => !variant.options[a])) {
        errors[`variants.${String(i)}.options`] = 'Choose a value for every option.';
      }
      if (!variant.sku.trim()) errors[`variants.${String(i)}.sku`] = 'Enter a SKU.';
      const price = rupeesToMinor(variant.price);
      if (price === null || Number.isNaN(price)) {
        errors[`variants.${String(i)}.priceMinor`] = 'Enter the price in rupees, e.g. 2490.';
      }
      const compareAt = rupeesToMinor(variant.compareAt);
      if (
        compareAt !== null &&
        (Number.isNaN(compareAt) || (price !== null && compareAt <= price))
      ) {
        errors[`variants.${String(i)}.compareAtPriceMinor`] = 'Must be higher than the price.';
      }
      if (!/^\d+$/.test(variant.stock.trim() || '0')) {
        errors[`variants.${String(i)}.inventory`] = 'Whole units only.';
      }
    });
  }
  return errors;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {description ? <p className="text-[13px] text-muted">{description}</p> : null}
      </div>
      {children}
    </Card>
  );
}

/**
 * Create or edit a product. Everything except variants of a saved product is one form saved
 * together; a stale save (someone else saved meanwhile) is refused, never silently overwritten.
 */
export function ProductEditor({
  product,
  categories,
  attributes,
  brands,
  canWrite,
  canUpload,
  shopUrl,
}: ProductEditorProps) {
  const isNew = product === null;
  const id = useId();
  const formId = `${id}-product`;
  const initial = useMemo(() => (product ? draftFromProduct(product) : emptyDraft()), [product]);
  const [draft, setDraft] = useState<ProductDraft>(initial);
  const [local, setLocal] = useState<Record<string, string>>({});
  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    // An edited field's own message goes away at once.
    setLocal((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const payload = useMemo(
    () => JSON.stringify(product ? updatePayload(draft, product.updatedAt) : createPayload(draft)),
    [draft, product],
  );
  const initialPayload = useMemo(
    () =>
      JSON.stringify(product ? updatePayload(initial, product.updatedAt) : createPayload(initial)),
    [initial, product],
  );
  const dirty = payload !== initialPayload;

  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    async (prev, formData) => {
      const errors = localErrors(draft, isNew);
      setLocal(errors);
      if (Object.keys(errors).length) {
        return { error: 'Some fields need attention.', at: Date.now() };
      }
      const result = product
        ? await updateProduct(product.id, prev, formData)
        : await createProduct(prev, formData);
      if (result.done) toast.success(result.done);
      return result;
    },
    {},
  );
  const errors = { ...(state.errors ?? {}), ...local };
  const errorList = Object.entries(errors);

  const productAttributes = attributes.filter((a) => a.scope === 'PRODUCT');
  const optionAttributes = attributes.filter((a) => a.scope === 'VARIANT' && a.type === 'SELECT');
  const required = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const categoryId of [draft.primaryCategoryId, ...draft.categoryIds]) {
      for (const a of categories.find((c) => c.id === categoryId)?.attributes ?? []) {
        map.set(a.attributeId, (map.get(a.attributeId) ?? false) || a.isRequired);
      }
    }
    return map;
  }, [categories, draft.primaryCategoryId, draft.categoryIds]);

  const skus = product
    ? product.variants.map((v) => v.sku)
    : draft.variants.map((v) => v.sku.trim().toUpperCase()).filter(Boolean);
  const status = PRODUCT_STATUS[draft.status];

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* The product is sent as one JSON field. The form holds only that, so the variant
          dialogs' own forms are never nested inside it; the save button targets it by id. */}
      <form id={formId} action={formAction} noValidate>
        <input type="hidden" name="payload" value={payload} />
      </form>
      <fieldset disabled={!canWrite} className="contents">
        {state.stale ? (
          <Alert tone="error">
            Someone else saved this product while you were editing.{' '}
            <a href="" className="font-medium underline">
              Reload
            </a>{' '}
            to see their changes (yours will be lost), then edit again.
          </Alert>
        ) : null}

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-6">
            <Section title="Basics">
              <Field id={`${id}-name`} label="Name" error={errors.name} required>
                {(control) => (
                  <Input
                    {...control}
                    value={draft.name}
                    onChange={(event) => set('name', event.target.value)}
                    maxLength={200}
                  />
                )}
              </Field>
              <Field
                id={`${id}-slug`}
                label="Web address"
                hint={
                  isNew
                    ? 'Leave empty to make one from the name.'
                    : 'Changing it breaks links people saved.'
                }
                error={errors.slug}
              >
                {(control) => (
                  <div className="flex items-center">
                    <span className="border-line bg-canvas flex h-10 items-center rounded-l-lg border border-r-0 px-3 text-[14px] text-muted">
                      /products/
                    </span>
                    <Input
                      {...control}
                      value={draft.slug}
                      onChange={(event) => set('slug', event.target.value)}
                      maxLength={120}
                      autoComplete="off"
                      className="min-w-0 rounded-l-none"
                    />
                  </div>
                )}
              </Field>
              <Field
                id={`${id}-short`}
                label="Short description"
                hint="One or two lines under the name."
                error={errors.shortDescription}
              >
                {(control) => (
                  <Textarea
                    {...control}
                    rows={2}
                    value={draft.shortDescription}
                    onChange={(event) => set('shortDescription', event.target.value)}
                    maxLength={500}
                  />
                )}
              </Field>
              <Field
                id={`${id}-description`}
                label="Description"
                hint="Markdown: **bold**, *italic*, lists with “- ”."
                error={errors.description}
              >
                {(control) => (
                  <Textarea
                    {...control}
                    rows={8}
                    value={draft.description}
                    onChange={(event) => set('description', event.target.value)}
                    maxLength={20_000}
                  />
                )}
              </Field>
            </Section>

            <Section
              title="Images"
              description="Order matters: the first image is the main photo in listings."
            >
              <ImageGallery
                images={draft.images}
                onChange={(images) => set('images', images)}
                skus={skus}
                canUpload={canUpload && canWrite}
                error={Object.entries(errors).find(([path]) => path.startsWith('media'))?.[1]}
              />
            </Section>

            <Section
              title="Variants"
              description={
                isNew
                  ? 'What customers choose between, each with its own SKU, price and stock.'
                  : 'What customers choose between, each with its own SKU and price.'
              }
            >
              {product ? (
                <VariantTable
                  productId={product.id}
                  productName={product.name}
                  variants={product.variants}
                  attributes={attributes}
                  canWrite={canWrite}
                  locked={dirty}
                />
              ) : (
                <VariantRows
                  variants={draft.variants}
                  onChange={(variants) => set('variants', variants)}
                  optionAttributes={optionAttributes}
                  optionAttributeIds={draft.optionAttributeIds}
                  onOptionAttributesChange={(ids) => set('optionAttributeIds', ids)}
                  errors={errors}
                />
              )}
            </Section>

            <Section title="Details" description="Used by shop filters and on the product page.">
              <AttributeFields
                attributes={productAttributes}
                values={draft.attributes}
                onChange={(values) => set('attributes', values)}
                required={required}
                errors={errors}
              />
            </Section>

            <Section title="Specifications" description="Label and value pairs, e.g. Fabric: Lawn.">
              {draft.specifications.length ? (
                <ul className="flex flex-col gap-2">
                  {draft.specifications.map((spec, index) => (
                    <li key={spec.key} className="flex items-start gap-2">
                      <Input
                        aria-label={`Specification ${String(index + 1)} label`}
                        placeholder="Label"
                        value={spec.label}
                        maxLength={80}
                        onChange={(event) =>
                          set(
                            'specifications',
                            draft.specifications.map((s, i) =>
                              i === index ? { ...s, label: event.target.value } : s,
                            ),
                          )
                        }
                        className="w-2/5"
                      />
                      <Input
                        aria-label={`Specification ${String(index + 1)} value`}
                        placeholder="Value"
                        value={spec.value}
                        maxLength={300}
                        onChange={(event) =>
                          set(
                            'specifications',
                            draft.specifications.map((s, i) =>
                              i === index ? { ...s, value: event.target.value } : s,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          set(
                            'specifications',
                            draft.specifications.filter((_, i) => i !== index),
                          )
                        }
                        className="hover:bg-canvas hover:text-danger inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted"
                        title="Remove"
                      >
                        <Trash2 aria-hidden size={16} />
                        <span className="sr-only">Remove specification {index + 1}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={draft.specifications.length >= 40}
                  onClick={() =>
                    set('specifications', [
                      ...draft.specifications,
                      { key: newKey(), label: '', value: '' },
                    ])
                  }
                >
                  <Plus aria-hidden size={15} />
                  Add specification
                </Button>
              </div>
            </Section>

            <Section
              title="Search engines"
              description="Leave empty to use the name and short description."
            >
              <Field id={`${id}-seo-title`} label="Search title" error={errors.seoTitle}>
                {(control) => (
                  <Input
                    {...control}
                    value={draft.seoTitle}
                    onChange={(event) => set('seoTitle', event.target.value)}
                    maxLength={160}
                  />
                )}
              </Field>
              <Field
                id={`${id}-seo-description`}
                label="Search description"
                error={errors.seoDescription}
              >
                {(control) => (
                  <Textarea
                    {...control}
                    rows={2}
                    value={draft.seoDescription}
                    onChange={(event) => set('seoDescription', event.target.value)}
                    maxLength={320}
                  />
                )}
              </Field>
            </Section>
          </div>

          <div className="flex flex-col gap-6 lg:sticky lg:top-20">
            <Section title="Status">
              <Field id={`${id}-status`} label="Visibility" hint={status.hint}>
                {(control) => (
                  <Select
                    {...control}
                    value={draft.status}
                    onChange={(event) =>
                      set('status', event.target.value as ProductDraft['status'])
                    }
                  >
                    {(['DRAFT', 'ACTIVE', 'ARCHIVED'] as const).map((s) => (
                      <option key={s} value={s}>
                        {PRODUCT_STATUS[s].label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {shopUrl ? (
                <a
                  href={shopUrl}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 text-[14px] text-gold-dark hover:underline"
                >
                  View in the shop
                  <ExternalLink aria-hidden size={14} />
                </a>
              ) : null}
            </Section>

            <Section title="Organisation">
              <Field
                id={`${id}-category`}
                label="Main category"
                error={errors.primaryCategoryId}
                required
              >
                {(control) => (
                  <Select
                    {...control}
                    value={draft.primaryCategoryId}
                    onChange={(event) => set('primaryCategoryId', event.target.value)}
                  >
                    <option value="">Choose…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                        {c.isActive ? '' : ' (hidden)'}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <ExtraCategories
                categories={categories}
                primaryId={draft.primaryCategoryId}
                value={draft.categoryIds}
                onChange={(ids) => set('categoryIds', ids)}
                error={errors.categoryIds}
              />
              <Field id={`${id}-brand`} label="Brand" error={errors.brandId}>
                {(control) => (
                  <Select
                    {...control}
                    value={draft.brandId}
                    onChange={(event) => set('brandId', event.target.value)}
                  >
                    <option value="">No brand</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field
                id={`${id}-tags`}
                label="Tags"
                hint="Separate with commas: eid, wedding, new-in."
                error={errors.tags}
              >
                {(control) => (
                  <Input
                    {...control}
                    value={draft.tags}
                    onChange={(event) => set('tags', event.target.value)}
                  />
                )}
              </Field>
            </Section>

            <Section title="Highlights">
              <Checkbox
                label="Featured"
                hint="Shown in featured sections."
                checked={draft.isFeatured}
                onChange={(event) => set('isFeatured', event.target.checked)}
              />
              <Checkbox
                label="Bestseller"
                hint="Gets the bestseller badge."
                checked={draft.isBestseller}
                onChange={(event) => set('isBestseller', event.target.checked)}
              />
            </Section>

            {product && canWrite ? <DeleteProduct product={product} /> : null}
          </div>
        </div>

        {canWrite ? (
          <div className="border-line bg-surface/95 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur lg:left-60">
            <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-8">
              <div className="min-w-0 text-[14px]" role="status" aria-live="polite">
                {state.error && !state.stale && state.at ? (
                  <details className="text-danger">
                    <summary className="cursor-pointer">{state.error}</summary>
                    {errorList.length ? (
                      <ul className="mt-1 list-disc pl-5 text-[13px]">
                        {errorList.map(([path, message]) => (
                          <li key={path}>
                            {labelFor(path)}: {message}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </details>
                ) : (
                  <span className="text-muted">
                    {isNew ? 'New product' : dirty ? 'Unsaved changes' : 'All changes saved'}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {!isNew && dirty ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDraft(initial);
                      setLocal({});
                    }}
                    disabled={pending}
                  >
                    <X aria-hidden size={16} />
                    Undo changes
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  form={formId}
                  disabled={pending || (!isNew && !dirty)}
                  className="flex-1"
                >
                  {pending ? 'Saving…' : isNew ? 'Create product' : 'Save product'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </fieldset>
    </div>
  );
}

/** Extra categories as a scrollable checklist (the main category is always included). */
function ExtraCategories({
  categories,
  primaryId,
  value,
  onChange,
  error,
}: {
  categories: readonly CategoryOption[];
  primaryId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string | undefined;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="pb-1.5 text-[13px] font-medium">Also show in</legend>
      <div className="border-line max-h-48 overflow-y-auto rounded-lg border p-2">
        {categories
          .filter((c) => c.id !== primaryId)
          .map((c) => (
            <Checkbox
              key={c.id}
              label={c.label}
              checked={value.includes(c.id)}
              onChange={(event) =>
                onChange(event.target.checked ? [...value, c.id] : value.filter((v) => v !== c.id))
              }
              className="py-1"
            />
          ))}
      </div>
      {error ? <p className="text-danger text-[13px]">{error}</p> : null}
    </fieldset>
  );
}

function DeleteProduct({ product }: { product: AdminProductDto }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ordered = product.summary.orders > 0;
  return (
    <Card className="flex flex-col gap-2 p-5">
      <h2 className="text-[16px] font-semibold">Remove</h2>
      {ordered ? (
        <p className="text-[13px] text-muted">
          This product has been ordered, so it can&apos;t be deleted. Set it to Archived to hide it.
        </p>
      ) : (
        <>
          <p className="text-[13px] text-muted">Never ordered, so it can be deleted for good.</p>
          <div>
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              <Trash2 aria-hidden size={15} />
              Delete product
            </Button>
          </div>
          <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title={`Delete “${product.name}”?`}
            description="The product and its variants are removed. Images stay in the library."
          >
            {error ? <Alert tone="error">{error}</Alert> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Back
              </Button>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await deleteProduct(product.id);
                    setError(result.error ?? null);
                  })
                }
              >
                {pending ? 'Deleting…' : 'Delete product'}
              </Button>
            </div>
          </Dialog>
        </>
      )}
    </Card>
  );
}
