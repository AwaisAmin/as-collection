'use client';

import type {
  CollectionProductDto,
  ContentImage,
  ContentLink,
  SectionSettingsMap,
} from '@as/contracts';
import { ArrowDown, ArrowUp, ImagePlus, MapPin, Search, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { searchProducts } from '@/features/collections/actions';
import { ImagePicker } from '@/features/media/components/image-picker';
import { fromPktInput, toPktInput } from '@/lib/format';
import { cn } from '@/lib/utils/cn';

import { productNames } from '../actions';
import { nextId, percentPosition, previewSrc, toContentSrc } from '../content-image';
import { ContentImageField, LinkFields } from './content-fields';

type Settings = Record<string, unknown>;

export interface RichContext {
  storefrontUrl: string;
  canUpload: boolean;
}

const iconButton =
  'hover:bg-canvas inline-flex size-8 items-center justify-center rounded-md text-muted hover:text-text disabled:pointer-events-none disabled:opacity-30';

/** Visual editors of the image-led section types. */
export function RichSettings({
  type,
  settings,
  onChange,
  errors,
  context,
}: {
  type: string;
  settings: Settings;
  onChange: (settings: Settings) => void;
  /** API messages by setting name (`image`, `cta`, `look`…). */
  errors: Record<string, string>;
  context: RichContext;
}) {
  const id = useId();
  const set = (key: string, value: unknown) => onChange({ ...settings, [key]: value });
  const text = (key: string, source: Settings = settings) =>
    typeof source[key] === 'string' ? (source[key] as string) : '';
  const textField = (
    key: string,
    label: string,
    options: { max: number; required?: boolean; rows?: number; hint?: string },
  ) => (
    <Field
      id={`${id}-${key}`}
      label={label}
      hint={options.hint}
      error={errors[key]}
      required={options.required}
    >
      {(control) =>
        options.rows ? (
          <Textarea
            {...control}
            rows={options.rows}
            value={text(key)}
            onChange={(event) => set(key, event.target.value)}
            maxLength={options.max}
          />
        ) : (
          <Input
            {...control}
            value={text(key)}
            onChange={(event) => set(key, event.target.value)}
            maxLength={options.max}
          />
        )
      }
    </Field>
  );

  switch (type) {
    case 'sale-banner': {
      const endsAt = typeof settings.endsAt === 'string' ? settings.endsAt : '';
      return (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {textField('eyebrow', 'Small heading', { max: 60, hint: 'e.g. “Limited time”.' })}
            {textField('title', 'Title', { max: 120, required: true })}
          </div>
          {textField('highlight', 'Highlight', { max: 120, hint: 'e.g. “Up to 20% off”.' })}
          {textField('description', 'Text', { max: 400, rows: 3 })}
          <Field
            id={`${id}-ends`}
            label="Countdown ends"
            hint="Pakistan time. The banner hides itself afterwards."
            error={errors.endsAt}
            required
          >
            {(control) => (
              <Input
                {...control}
                type="datetime-local"
                value={toPktInput(endsAt || null)}
                onChange={(event) => set('endsAt', fromPktInput(event.target.value) ?? '')}
                className="sm:max-w-64"
              />
            )}
          </Field>
          <LinkFields
            label="Button"
            value={settings.cta as ContentLink | undefined}
            onChange={(cta) => set('cta', cta)}
            error={errors.cta}
          />
          <ContentImageField
            label="Picture"
            value={settings.image as ContentImage | undefined}
            onChange={(image) => set('image', image)}
            storefrontUrl={context.storefrontUrl}
            canUpload={context.canUpload}
            error={errors.image}
          />
        </>
      );
    }
    case 'brand-story':
      return (
        <>
          {textField('title', 'Heading', { max: 120, required: true })}
          {textField('script', 'Handwritten line', {
            max: 120,
            hint: 'Shown in script lettering, e.g. “Because You Deserve the Best”.',
          })}
          <LinkFields
            label="Button"
            value={settings.cta as ContentLink | undefined}
            onChange={(cta) => set('cta', cta)}
            error={errors.cta}
          />
          <ContentImageField
            label="Picture"
            value={settings.image as ContentImage | undefined}
            onChange={(image) => set('image', image)}
            storefrontUrl={context.storefrontUrl}
            canUpload={context.canUpload}
            error={errors.image}
          />
        </>
      );
    case 'instagram-gallery':
      return (
        <>
          {textField('title', 'Heading', { max: 120, required: true })}
          {textField('subtitle', 'Line under the heading', { max: 300 })}
          <div className="grid gap-4 sm:grid-cols-2">
            {textField('handle', 'Instagram name', { max: 60, hint: 'e.g. @ascollectionhub' })}
            {textField('profileUrl', 'Profile address', {
              max: 500,
              required: true,
              hint: 'https://instagram.com/…',
            })}
          </div>
          <PostList
            posts={(settings.posts as SectionSettingsMap['instagram-gallery']['posts']) ?? []}
            onChange={(posts) => set('posts', posts)}
            context={context}
            error={errors.posts}
          />
        </>
      );
    case 'shop-the-look': {
      const look = (settings.look ?? {}) as Partial<SectionSettingsMap['shop-the-look']['look']>;
      const setLook = (change: Partial<SectionSettingsMap['shop-the-look']['look']>) =>
        set('look', { ...look, ...change });
      return (
        <>
          {textField('title', 'Section heading', { max: 120, required: true })}
          {textField('subtitle', 'Line under the heading', { max: 300 })}
          <div className="border-line flex flex-col gap-4 rounded-lg border p-3">
            <Field id={`${id}-look-title`} label="Look name" error={errors.look}>
              {(control) => (
                <Input
                  {...control}
                  value={look.title ?? ''}
                  onChange={(event) => setLook({ title: event.target.value })}
                  maxLength={120}
                />
              )}
            </Field>
            <Field id={`${id}-look-description`} label="About the look">
              {(control) => (
                <Textarea
                  {...control}
                  rows={2}
                  value={look.description ?? ''}
                  onChange={(event) => setLook({ description: event.target.value })}
                  maxLength={400}
                />
              )}
            </Field>
            <ContentImageField
              label="Photo"
              value={look.image}
              onChange={(image) => setLook({ image })}
              storefrontUrl={context.storefrontUrl}
              canUpload={context.canUpload}
              aspect="aspect-[4/5]"
              preview={false}
            />
            <HotspotEditor
              image={look.image}
              hotspots={look.hotspots ?? []}
              onChange={(hotspots) => setLook({ hotspots })}
              storefrontUrl={context.storefrontUrl}
            />
          </div>
        </>
      );
    }
    default:
      return null;
  }
}

type Post = SectionSettingsMap['instagram-gallery']['posts'][number];

/** Instagram posts: pictures in order, each with a description and an optional link. */
function PostList({
  posts,
  onChange,
  context,
  error,
}: {
  posts: Post[];
  onChange: (posts: Post[]) => void;
  context: RichContext;
  error?: string | undefined;
}) {
  const [picking, setPicking] = useState(false);
  const update = (index: number, change: Partial<Post>) =>
    onChange(posts.map((p, i) => (i === index ? { ...p, ...change } : p)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...posts];
    const [post] = next.splice(index, 1);
    if (post) next.splice(index + by, 0, post);
    onChange(next);
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-1.5 text-[13px] font-medium">Posts</legend>
      {posts.length ? (
        <ol className="flex flex-col gap-2">
          {posts.map((post, index) => (
            <li
              key={post.id}
              aria-label={`Post ${String(index + 1)}`}
              className="border-line flex gap-3 rounded-lg border p-2"
            >
              <span className="bg-canvas size-16 shrink-0 overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element -- preview */}
                <img
                  src={previewSrc(post.image.src, context.storefrontUrl)}
                  alt=""
                  className="size-full object-cover"
                />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Input
                  value={post.image.alt}
                  onChange={(event) =>
                    update(index, { image: { ...post.image, alt: event.target.value } })
                  }
                  placeholder="What the picture shows"
                  aria-label={`Post ${String(index + 1)} description`}
                  maxLength={200}
                  className="h-9"
                />
                <Input
                  value={post.href ?? ''}
                  onChange={(event) =>
                    update(index, { href: event.target.value ? event.target.value : undefined })
                  }
                  placeholder="Link (optional): https://instagram.com/p/…"
                  aria-label={`Post ${String(index + 1)} link`}
                  maxLength={500}
                  className="h-9"
                />
              </div>
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  className={iconButton}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  title="Move earlier"
                >
                  <ArrowUp aria-hidden size={15} />
                  <span className="sr-only">Move post {index + 1} earlier</span>
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={index === posts.length - 1}
                  onClick={() => move(index, 1)}
                  title="Move later"
                >
                  <ArrowDown aria-hidden size={15} />
                  <span className="sr-only">Move post {index + 1} later</span>
                </button>
                <button
                  type="button"
                  className={`${iconButton} hover:text-danger`}
                  onClick={() => onChange(posts.filter((_, i) => i !== index))}
                  title="Remove"
                >
                  <Trash2 aria-hidden size={15} />
                  <span className="sr-only">Remove post {index + 1}</span>
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[14px] text-muted">No posts yet.</p>
      )}
      {error ? <p className="text-danger text-[13px]">{error}</p> : null}
      <div>
        <Button
          variant="secondary"
          size="sm"
          disabled={posts.length >= 24}
          onClick={() => setPicking(true)}
        >
          <ImagePlus aria-hidden size={15} />
          Add posts
        </Button>
      </div>
      {picking ? (
        <ImagePicker
          title="Add posts"
          confirmLabel="Add posts"
          chosen={new Set()}
          canUpload={context.canUpload}
          onClose={() => setPicking(false)}
          onAdd={(images) => {
            const next = [...posts];
            for (const media of images.slice(0, 24 - posts.length)) {
              next.push({
                id: nextId(
                  'post',
                  next.map((p) => p.id),
                ),
                image: { src: toContentSrc(media.url), alt: media.alt ?? '' },
              });
            }
            onChange(next);
          }}
        />
      ) : null}
    </fieldset>
  );
}

type Hotspot = SectionSettingsMap['shop-the-look']['look']['hotspots'][number];

/**
 * Product dots on the look's photo. "Add a product" picks one, then a click on the photo places it;
 * choosing a dot and clicking again moves it.
 */
function HotspotEditor({
  image,
  hotspots,
  onChange,
  storefrontUrl,
}: {
  image: ContentImage | undefined;
  hotspots: Hotspot[];
  onChange: (hotspots: Hotspot[]) => void;
  storefrontUrl: string;
}) {
  const photo = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const slugs = hotspots.map((h) => h.productSlug).join(',');

  // Product names for the dots (looked up once per set of products).
  useEffect(() => {
    if (!slugs) return;
    let cancelled = false;
    void productNames(slugs.split(',')).then((found) => {
      if (!cancelled) setNames((current) => ({ ...current, ...found }));
    });
    return () => {
      cancelled = true;
    };
  }, [slugs]);

  const src = image?.src ? previewSrc(image.src, storefrontUrl) : '';

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] font-medium">Products in the photo</p>
      {src ? (
        <div
          ref={photo}
          role="button"
          tabIndex={-1}
          aria-label="Photo: click to place the chosen product"
          data-testid="look-photo"
          onClick={(event) => {
            if (active === null || !photo.current) return;
            const position = percentPosition(
              { x: event.clientX, y: event.clientY },
              photo.current.getBoundingClientRect(),
            );
            onChange(hotspots.map((h, i) => (i === active ? { ...h, ...position } : h)));
            setActive(null);
          }}
          className={cn(
            // Same frame as the shop (3:4, photo cropped to fill), so dots land where they show.
            'border-line relative aspect-3/4 w-full max-w-xs overflow-hidden rounded-lg border',
            active !== null && 'cursor-crosshair ring-2 ring-gold-dark',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- preview */}
          <img
            src={src}
            alt={image?.alt ?? ''}
            className="absolute inset-0 size-full object-cover select-none"
            draggable={false}
          />
          {hotspots.map((h, index) => (
            <span
              key={`${h.productSlug}-${String(index)}`}
              aria-hidden
              className={cn(
                'absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white shadow',
                index === active ? 'bg-gold-dark' : 'bg-ink/80',
              )}
              style={{ left: `${String(h.x)}%`, top: `${String(h.y)}%` }}
            >
              {index + 1}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[14px] text-muted">Choose the photo first, then add products to it.</p>
      )}
      {active !== null ? (
        <p className="text-[13px] text-gold-dark" role="status">
          Click on the photo where “
          {names[hotspots[active]?.productSlug ?? ''] ?? hotspots[active]?.productSlug}” is.
        </p>
      ) : null}
      {hotspots.length ? (
        <ol className="border-line divide-line flex flex-col divide-y rounded-lg border">
          {hotspots.map((h, index) => (
            <li
              key={`${h.productSlug}-${String(index)}`}
              className="flex items-center gap-2 px-3 py-1.5 text-[14px]"
            >
              <span className="w-5 text-right text-[13px] text-muted tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {names[h.productSlug] ?? h.productSlug}
              </span>
              <span className="text-[12px] text-muted tabular-nums">
                {Math.round(h.x)}%, {Math.round(h.y)}%
              </span>
              <button
                type="button"
                className={iconButton}
                disabled={!src}
                onClick={() => setActive(index === active ? null : index)}
                title="Move on the photo"
              >
                <MapPin aria-hidden size={15} />
                <span className="sr-only">
                  Move {names[h.productSlug] ?? h.productSlug} on the photo
                </span>
              </button>
              <button
                type="button"
                className={`${iconButton} hover:text-danger`}
                onClick={() => {
                  onChange(hotspots.filter((_, i) => i !== index));
                  setActive(null);
                }}
                title="Remove"
              >
                <Trash2 aria-hidden size={15} />
                <span className="sr-only">Remove {names[h.productSlug] ?? h.productSlug}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      <div>
        <Button
          variant="secondary"
          size="sm"
          disabled={!src || hotspots.length >= 12}
          onClick={() => setPicking(true)}
        >
          Add a product
        </Button>
      </div>
      {picking ? (
        <ProductChooser
          onClose={() => setPicking(false)}
          onChoose={(product) => {
            setNames((current) => ({ ...current, [product.slug]: product.name }));
            onChange([...hotspots, { productSlug: product.slug, x: 50, y: 50 }]);
            // Placed in the middle; the next click on the photo puts it where it belongs.
            setActive(hotspots.length);
            setPicking(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** Find one product by name, slug or SKU. */
function ProductChooser({
  onChoose,
  onClose,
}: {
  onChoose: (product: CollectionProductDto) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CollectionProductDto[] | null>(null);
  const [pending, start] = useTransition();
  const search = (q: string) =>
    start(async () => {
      setResults(await searchProducts(q));
    });
  useEffect(() => {
    search('');
  }, []);
  return (
    <Dialog open onClose={onClose} title="Choose a product" className="max-w-lg">
      <div className="relative" role="search">
        <Search
          aria-hidden
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            search(query);
          }}
          placeholder="Name, slug or SKU — press Enter"
          aria-label="Search products"
          className="pl-9"
          autoFocus
        />
      </div>
      <ul
        className={cn(
          'divide-line -mx-1 max-h-[50vh] divide-y overflow-y-auto px-1 transition-opacity',
          pending && 'opacity-50',
        )}
        aria-busy={pending}
      >
        {results?.map((product) => (
          <li key={product.id}>
            <button
              type="button"
              onClick={() => onChoose(product)}
              className="hover:bg-canvas flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-[14px]"
            >
              <span className="bg-canvas size-10 shrink-0 overflow-hidden rounded">
                {product.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- thumbnail
                  <img src={product.image.url} alt="" className="size-full object-cover" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">{product.name}</span>
            </button>
          </li>
        ))}
        {results && !results.length ? (
          <li className="py-6 text-center text-[14px] text-muted">No products match.</li>
        ) : null}
      </ul>
    </Dialog>
  );
}
