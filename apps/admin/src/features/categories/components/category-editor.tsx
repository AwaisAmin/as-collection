'use client';

import type { AdminAttributeDto, AdminCategoryDto, AdminCategoryNodeDto } from '@as/contracts';
import { ExternalLink, Trash2 } from 'lucide-react';
import { type ReactNode, useActionState, useId, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SaveBar, StaleAlert } from '@/components/ui/save-bar';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { type ChosenImage, ImageField } from '@/features/media/components/image-field';
import type { SaveState } from '@/lib/action-state';

import { createCategory, deleteCategory, updateCategory } from '../actions';
import { flatten, subtreeIds } from '../tree';

interface Draft {
  name: string;
  slug: string;
  parentId: string;
  description: string;
  isActive: boolean;
  image: ChosenImage | null;
  bannerImage: ChosenImage | null;
  eyebrow: string;
  bannerText: string;
  focus: string;
  /** attributeId → required */
  filters: Record<string, boolean>;
  seoTitle: string;
  seoDescription: string;
}

const FOCUS = [
  { value: '50% 15%', label: 'Top' },
  { value: '50% 35%', label: 'Upper middle' },
  { value: '50% 50%', label: 'Centre' },
  { value: '50% 70%', label: 'Lower middle' },
  { value: '50% 90%', label: 'Bottom' },
];

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  slug: 'Web address',
  parentId: 'Parent',
  description: 'Description',
  imageId: 'Image',
  bannerImageId: 'Banner image',
  banner: 'Banner text',
  attributes: 'Filters',
  seoTitle: 'Search title',
  seoDescription: 'Search description',
};

const image = (ref: AdminCategoryDto['image']): ChosenImage | null =>
  ref ? { id: ref.id, url: ref.url, alt: ref.alt } : null;

function draftOf(category: AdminCategoryDto | null, parentId: string | null): Draft {
  return {
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    parentId: category ? (category.parentId ?? '') : (parentId ?? ''),
    description: category?.description ?? '',
    isActive: category?.isActive ?? true,
    image: image(category?.image ?? null),
    bannerImage: image(category?.bannerImage ?? null),
    eyebrow: category?.banner?.eyebrow ?? '',
    bannerText: category?.banner?.description ?? '',
    focus: category?.banner?.focus ?? '',
    filters: Object.fromEntries(
      (category?.attributes ?? []).map((a) => [a.attributeId, a.isRequired]),
    ),
    seoTitle: category?.seoTitle ?? '',
    seoDescription: category?.seoDescription ?? '',
  };
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);

function payload(draft: Draft, category: AdminCategoryDto | null) {
  const hasBanner = Boolean(draft.eyebrow.trim() || draft.bannerText.trim() || draft.focus);
  const body = {
    name: draft.name.trim(),
    parentId: draft.parentId || null,
    description: orNull(draft.description),
    isActive: draft.isActive,
    imageId: draft.image?.id ?? null,
    bannerImageId: draft.bannerImage?.id ?? null,
    banner: hasBanner
      ? {
          eyebrow: orNull(draft.eyebrow),
          description: orNull(draft.bannerText),
          focus: draft.focus || null,
        }
      : null,
    attributes: Object.entries(draft.filters).map(([attributeId, isRequired]) => ({
      attributeId,
      isRequired,
    })),
    seoTitle: orNull(draft.seoTitle),
    seoDescription: orNull(draft.seoDescription),
  };
  if (category) return { ...body, slug: draft.slug.trim(), updatedAt: category.updatedAt };
  return draft.slug.trim() ? { ...body, slug: draft.slug.trim() } : body;
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

/** Create or edit a category; moving it to another parent moves its subcategories too. */
export function CategoryEditor({
  category,
  parentId,
  tree,
  attributes,
  canWrite,
  canUpload,
  shopUrl,
}: {
  category: AdminCategoryDto | null;
  /** New categories: the parent chosen from the tree. */
  parentId: string | null;
  tree: readonly AdminCategoryNodeDto[];
  attributes: readonly AdminAttributeDto[];
  canWrite: boolean;
  canUpload: boolean;
  shopUrl: string | null;
}) {
  const isNew = category === null;
  const id = useId();
  const formId = `${id}-category`;
  const initial = useMemo(() => draftOf(category, parentId), [category, parentId]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [local, setLocal] = useState<Record<string, string>>({});
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key === 'name') setLocal({});
  };

  const body = useMemo(() => JSON.stringify(payload(draft, category)), [draft, category]);
  const dirty = body !== JSON.stringify(payload(initial, category));

  const [state, action, pending] = useActionState<SaveState, FormData>(async (prev, data) => {
    if (draft.name.trim().length < 1) {
      setLocal({ name: 'Give the category a name.' });
      return { error: 'Some fields need attention.', at: Date.now() };
    }
    const result = category
      ? await updateCategory(category.id, prev, data)
      : await createCategory(prev, data);
    if (result.done) toast.success(result.done);
    return result;
  }, {});
  const errors = { ...(state.errors ?? {}), ...local };

  // A category can't move under itself or anything below it.
  const parents = useMemo(() => {
    const own = category ? flatten(tree).find((n) => n.id === category.id) : undefined;
    const blocked = own ? subtreeIds(own) : new Set<string>();
    return flatten(tree).filter((n) => !blocked.has(n.id) && n.depth < 10);
  }, [tree, category]);

  const attributeError = Object.entries(errors).find(([path]) => path.startsWith('attributes'));

  return (
    <div className="flex flex-col gap-6 pb-24">
      <form id={formId} action={action} noValidate>
        <input type="hidden" name="payload" value={body} />
      </form>
      <fieldset disabled={!canWrite} className="contents">
        {state.stale ? <StaleAlert what="category" /> : null}
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-6">
            <Section title="Basics">
              <Field id={`${id}-name`} label="Name" error={errors.name} required>
                {(control) => (
                  <Input
                    {...control}
                    value={draft.name}
                    onChange={(event) => set('name', event.target.value)}
                    maxLength={120}
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
                      /shop/
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
                id={`${id}-description`}
                label="Description"
                hint="Shown at the top of the category page."
                error={errors.description}
              >
                {(control) => (
                  <Textarea
                    {...control}
                    rows={4}
                    value={draft.description}
                    onChange={(event) => set('description', event.target.value)}
                    maxLength={2000}
                  />
                )}
              </Field>
            </Section>

            <Section
              title="Banner"
              description="The wide picture and text at the top of the category page."
            >
              <ImageField
                label="Banner image"
                value={draft.bannerImage}
                onChange={(value) => set('bannerImage', value)}
                canUpload={canUpload}
                aspect="aspect-[3/1]"
                error={errors.bannerImageId}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id={`${id}-eyebrow`}
                  label="Small heading"
                  hint="e.g. “New season”."
                  error={errors['banner.eyebrow']}
                >
                  {(control) => (
                    <Input
                      {...control}
                      value={draft.eyebrow}
                      onChange={(event) => set('eyebrow', event.target.value)}
                      maxLength={80}
                    />
                  )}
                </Field>
                <Field
                  id={`${id}-focus`}
                  label="Keep in view"
                  hint="Which part of the picture stays visible on phones."
                >
                  {(control) => (
                    <Select
                      {...control}
                      value={draft.focus}
                      onChange={(event) => set('focus', event.target.value)}
                    >
                      <option value="">Automatic</option>
                      {FOCUS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                      {draft.focus && !FOCUS.some((f) => f.value === draft.focus) ? (
                        <option value={draft.focus}>Custom ({draft.focus})</option>
                      ) : null}
                    </Select>
                  )}
                </Field>
              </div>
              <Field
                id={`${id}-banner-text`}
                label="Banner text"
                error={errors['banner.description']}
              >
                {(control) => (
                  <Textarea
                    {...control}
                    rows={2}
                    value={draft.bannerText}
                    onChange={(event) => set('bannerText', event.target.value)}
                    maxLength={400}
                  />
                )}
              </Field>
            </Section>

            <Section
              title="Filters"
              description="Details shoppers can filter by on this page; subcategories use them too. “Required” makes products here fill them in."
            >
              {attributes.length ? (
                <ul className="divide-line flex flex-col divide-y">
                  {attributes.map((attribute) => {
                    const on = attribute.id in draft.filters;
                    return (
                      <li
                        key={attribute.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <Checkbox
                          label={attribute.name}
                          hint={
                            attribute.scope === 'VARIANT'
                              ? 'Variant option'
                              : attribute.isFilterable
                                ? undefined
                                : 'Not filterable in the shop'
                          }
                          checked={on}
                          onChange={(event) => {
                            const next = { ...draft.filters };
                            if (event.target.checked) next[attribute.id] = false;
                            else delete next[attribute.id];
                            set('filters', next);
                          }}
                        />
                        {on ? (
                          <Checkbox
                            label="Required"
                            checked={draft.filters[attribute.id] ?? false}
                            onChange={(event) =>
                              set('filters', {
                                ...draft.filters,
                                [attribute.id]: event.target.checked,
                              })
                            }
                            className="text-[13px]"
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[14px] text-muted">No attributes yet.</p>
              )}
              {attributeError ? (
                <p className="text-danger text-[13px]">{attributeError[1]}</p>
              ) : null}
            </Section>

            <Section
              title="Search engines"
              description="Leave empty to use the name and description."
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
            <Section title="Placement">
              <Checkbox
                label="Shown in the shop"
                hint="Untick to hide this category in the shop."
                checked={draft.isActive}
                onChange={(event) => set('isActive', event.target.checked)}
              />
              <Field
                id={`${id}-parent`}
                label="Parent"
                hint={
                  !isNew && category?.counts.children
                    ? 'Its subcategories move with it.'
                    : undefined
                }
                error={errors.parentId}
              >
                {(control) => (
                  <Select
                    {...control}
                    value={draft.parentId}
                    onChange={(event) => set('parentId', event.target.value)}
                  >
                    <option value="">None (top level)</option>
                    {parents.map((n) => (
                      <option key={n.id} value={n.id}>
                        {`${'— '.repeat(n.depth + 1)}${n.name}`}
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

            <Section title="Picture" description="Used in menus and category tiles.">
              <ImageField
                label="Image"
                value={draft.image}
                onChange={(value) => set('image', value)}
                canUpload={canUpload}
                error={errors.imageId}
              />
            </Section>

            {category && canWrite ? <DeleteCategory category={category} /> : null}
          </div>
        </div>

        {canWrite ? (
          <SaveBar
            formId={formId}
            state={state}
            errors={errors}
            labels={FIELD_LABELS}
            isNew={isNew}
            dirty={dirty}
            pending={pending}
            onUndo={() => {
              setDraft(initial);
              setLocal({});
            }}
            createLabel="Create category"
            saveLabel="Save category"
            newText="New category"
          />
        ) : null}
      </fieldset>
    </div>
  );
}

function DeleteCategory({ category }: { category: AdminCategoryDto }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const blockers = [
    category.counts.children ? 'it has subcategories' : null,
    category.counts.products ? 'it is the main category of some products' : null,
  ].filter(Boolean);
  return (
    <Card className="flex flex-col gap-2 p-5">
      <h2 className="text-[16px] font-semibold">Remove</h2>
      {blockers.length ? (
        <p className="text-[13px] text-muted">
          Can&apos;t be deleted while {blockers.join(' and ')}. Untick “Shown in the shop” to hide
          it instead.
        </p>
      ) : (
        <>
          <p className="text-[13px] text-muted">Empty, so it can be deleted.</p>
          <div>
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              <Trash2 aria-hidden size={15} />
              Delete category
            </Button>
          </div>
          <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title={`Delete “${category.name}”?`}
            description="Products listed here as an extra category stay in their main category."
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
                    const result = await deleteCategory(category.id);
                    setError(result.error ?? null);
                  })
                }
              >
                {pending ? 'Deleting…' : 'Delete category'}
              </Button>
            </div>
          </Dialog>
        </>
      )}
    </Card>
  );
}
