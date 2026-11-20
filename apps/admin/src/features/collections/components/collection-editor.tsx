'use client';

import type { AdminAttributeDto, AdminCollectionDetailDto, CollectionType } from '@as/contracts';
import { ExternalLink } from 'lucide-react';
import { type ReactNode, useActionState, useId, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DeleteCard } from '@/components/ui/delete-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SaveBar, StaleAlert } from '@/components/ui/save-bar';
import { Textarea } from '@/components/ui/textarea';
import { type ChosenImage, ImageField } from '@/features/media/components/image-field';
import type { SaveState } from '@/lib/action-state';
import { fromPktInput, toPktInput } from '@/lib/format';
import { cn } from '@/lib/utils/cn';

import { createCollection, deleteCollection, updateCollection } from '../actions';
import { draftFromRules, type DraftRules, rulesPayload } from '../rules';
import { CollectionProducts } from './collection-products';
import { RulesBuilder } from './rules-builder';

interface Draft {
  name: string;
  slug: string;
  description: string;
  type: CollectionType;
  rules: DraftRules;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  image: ChosenImage | null;
  seoTitle: string;
  seoDescription: string;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  slug: 'Web address',
  description: 'Description',
  type: 'Type',
  rules: 'Rules',
  imageId: 'Image',
  startsAt: 'Starts',
  endsAt: 'Ends',
  seoTitle: 'Search title',
  seoDescription: 'Search description',
};

const TYPES: Record<CollectionType, { label: string; hint: string }> = {
  MANUAL: { label: 'Hand-picked', hint: 'You choose the products and their order.' },
  AUTOMATED: {
    label: 'Automatic',
    hint: 'Products that match rules (a tag, a fabric, on sale…) join and leave by themselves.',
  },
};

function draftOf(collection: AdminCollectionDetailDto | null): Draft {
  return {
    name: collection?.name ?? '',
    slug: collection?.slug ?? '',
    description: collection?.description ?? '',
    type: collection?.type ?? 'MANUAL',
    rules: draftFromRules(collection?.rules ?? null),
    isActive: collection?.isActive ?? true,
    startsAt: toPktInput(collection?.startsAt ?? null),
    endsAt: toPktInput(collection?.endsAt ?? null),
    image: collection?.image ?? null,
    seoTitle: collection?.seoTitle ?? '',
    seoDescription: collection?.seoDescription ?? '',
  };
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);

function payload(draft: Draft, collection: AdminCollectionDetailDto | null) {
  const body = {
    name: draft.name.trim(),
    description: orNull(draft.description),
    type: draft.type,
    rules: draft.type === 'AUTOMATED' ? rulesPayload(draft.rules).rules : null,
    isActive: draft.isActive,
    startsAt: fromPktInput(draft.startsAt),
    endsAt: fromPktInput(draft.endsAt),
    imageId: draft.image?.id ?? null,
    seoTitle: orNull(draft.seoTitle),
    seoDescription: orNull(draft.seoDescription),
  };
  if (collection) return { ...body, slug: draft.slug.trim(), updatedAt: collection.updatedAt };
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

/** Create or edit a collection: hand-picked products, or rules that pick them. */
export function CollectionEditor({
  collection,
  attributes,
  canWrite,
  canUpload,
  shopUrl,
}: {
  collection: AdminCollectionDetailDto | null;
  attributes: readonly AdminAttributeDto[];
  canWrite: boolean;
  canUpload: boolean;
  shopUrl: string | null;
}) {
  const isNew = collection === null;
  const id = useId();
  const formId = `${id}-collection`;
  const initial = useMemo(() => draftOf(collection), [collection]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [local, setLocal] = useState<Record<string, string>>({});
  const [ruleProblems, setRuleProblems] = useState<Record<string, string>>({});
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const body = useMemo(() => JSON.stringify(payload(draft, collection)), [draft, collection]);
  const dirty = body !== JSON.stringify(payload(initial, collection));

  const [state, action, pending] = useActionState<SaveState, FormData>(async (prev, data) => {
    const errors: Record<string, string> = {};
    if (!draft.name.trim()) errors.name = 'Give the collection a name.';
    const starts = fromPktInput(draft.startsAt);
    const ends = fromPktInput(draft.endsAt);
    if (draft.startsAt && !starts) errors.startsAt = 'Enter a full date and time.';
    if (draft.endsAt && !ends) errors.endsAt = 'Enter a full date and time.';
    if (starts && ends && ends <= starts) errors.endsAt = 'Must be after the start.';
    const rules = rulesPayload(draft.rules);
    setRuleProblems(draft.type === 'AUTOMATED' ? rules.problems : {});
    if (draft.type === 'AUTOMATED' && Object.keys(rules.problems).length) {
      errors.rules = 'Complete or remove the marked rules.';
    } else if (draft.type === 'AUTOMATED' && !rules.rules) {
      errors.rules = 'Add at least one rule.';
    }
    setLocal(errors);
    if (Object.keys(errors).length) return { error: 'Some fields need attention.', at: Date.now() };
    const result = collection
      ? await updateCollection(collection.id, prev, data)
      : await createCollection(prev, data);
    if (result.done) toast.success(result.done);
    return result;
  }, {});
  const errors = { ...(state.errors ?? {}), ...local };
  const rulesError = Object.entries(errors).find(([path]) => path.startsWith('rules'))?.[1];
  const choiceAttributes = attributes.filter(
    (a) => a.type === 'SELECT' || a.type === 'MULTI_SELECT',
  );

  return (
    <div className="flex flex-col gap-6 pb-24">
      <form id={formId} action={action} noValidate>
        <input type="hidden" name="payload" value={body} />
      </form>
      <fieldset disabled={!canWrite} className="contents">
        {state.stale ? <StaleAlert what="collection" /> : null}
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
                    <span className="border-line bg-canvas flex h-10 items-center rounded-l-lg border border-r-0 px-3 text-[14px] whitespace-nowrap text-muted">
                      ?occasion=
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
              <Field id={`${id}-description`} label="Description" error={errors.description}>
                {(control) => (
                  <Textarea
                    {...control}
                    rows={3}
                    value={draft.description}
                    onChange={(event) => set('description', event.target.value)}
                    maxLength={2000}
                  />
                )}
              </Field>
            </Section>

            <Section title="Products">
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">How products are chosen</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(TYPES) as CollectionType[]).map((type) => (
                    <label
                      key={type}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3',
                        draft.type === type ? 'bg-canvas border-ink' : 'border-line',
                      )}
                    >
                      <input
                        type="radio"
                        name={`${id}-type`}
                        checked={draft.type === type}
                        onChange={() => set('type', type)}
                        className="mt-1 shrink-0 accent-ink"
                      />
                      <span className="flex flex-col gap-0.5 text-[14px]">
                        <span className="font-medium">{TYPES[type].label}</span>
                        <span className="text-[13px] text-muted">{TYPES[type].hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {draft.type === 'AUTOMATED' ? (
                <>
                  <RulesBuilder
                    value={draft.rules}
                    onChange={(rules) => set('rules', rules)}
                    attributes={choiceAttributes}
                    problems={ruleProblems}
                  />
                  {rulesError ? <p className="text-danger text-[13px]">{rulesError}</p> : null}
                </>
              ) : collection && collection.type === 'MANUAL' ? (
                <CollectionProducts
                  collectionId={collection.id}
                  initial={collection.products}
                  canWrite={canWrite}
                  locked={dirty}
                />
              ) : (
                <p className="text-[14px] text-muted">
                  {isNew
                    ? 'Create the collection first, then add its products.'
                    : 'Save the change to hand-picked first, then add products.'}
                </p>
              )}
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
            <Section title="Visibility" description="Times are Pakistan time.">
              <Checkbox
                label="Shown in the shop"
                checked={draft.isActive}
                onChange={(event) => set('isActive', event.target.checked)}
              />
              <Field
                id={`${id}-starts`}
                label="Starts"
                hint="Empty: straight away."
                error={errors.startsAt}
              >
                {(control) => (
                  <Input
                    {...control}
                    type="datetime-local"
                    value={draft.startsAt}
                    onChange={(event) => set('startsAt', event.target.value)}
                  />
                )}
              </Field>
              <Field id={`${id}-ends`} label="Ends" hint="Empty: no end." error={errors.endsAt}>
                {(control) => (
                  <Input
                    {...control}
                    type="datetime-local"
                    value={draft.endsAt}
                    onChange={(event) => set('endsAt', event.target.value)}
                  />
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

            <Section title="Picture" description="Used on collection tiles and banners.">
              <ImageField
                label="Image"
                value={draft.image}
                onChange={(value) => set('image', value)}
                canUpload={canUpload}
                error={errors.imageId}
              />
            </Section>

            {collection && canWrite ? (
              <DeleteCard
                what="collection"
                name={collection.name}
                blockedReason={null}
                allowedText="Products stay in the shop; only the collection goes."
                consequence="The collection is removed. Its products are not affected."
                onDelete={() => deleteCollection(collection.id)}
              />
            ) : null}
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
              setRuleProblems({});
            }}
            createLabel="Create collection"
            saveLabel="Save collection"
            newText="New collection"
          />
        ) : null}
      </fieldset>
    </div>
  );
}
