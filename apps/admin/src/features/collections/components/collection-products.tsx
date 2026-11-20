'use client';

import type { CollectionProductDto } from '@as/contracts';
import { ArrowDown, ArrowUp, Check, ImageOff, Plus, Search, X } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PRODUCT_STATUS } from '@/features/products/labels';
import { formatMoney } from '@/lib/format';

import { searchProducts, setCollectionProducts } from '../actions';

const iconButton =
  'hover:bg-canvas inline-flex size-8 items-center justify-center rounded-md text-muted hover:text-text disabled:pointer-events-none disabled:opacity-30';

function Thumb({ product }: { product: CollectionProductDto }) {
  return (
    <span className="border-line bg-canvas flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border">
      {product.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- library thumbnail
        <img src={product.image.url} alt="" className="size-full object-cover" />
      ) : (
        <ImageOff aria-hidden size={15} className="text-muted" />
      )}
    </span>
  );
}

function ProductSearch({
  chosen,
  onAdd,
  onClose,
}: {
  chosen: ReadonlySet<string>;
  onAdd: (product: CollectionProductDto) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CollectionProductDto[] | null>(null);
  const [pending, start] = useTransition();
  const search = (q: string) =>
    start(async () => {
      setResults(await searchProducts(q));
    });
  // First page (A–Z) when opened.
  useEffect(() => {
    search('');
  }, []);

  return (
    <Dialog open onClose={onClose} title="Add products" className="max-w-xl">
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
        className={`divide-line -mx-1 max-h-[50vh] divide-y overflow-y-auto px-1 transition-opacity ${pending ? 'opacity-50' : ''}`}
        aria-busy={pending}
      >
        {results === null ? (
          <li className="py-6 text-center text-[14px] text-muted">
            {pending ? 'Searching…' : 'Search failed. Try again.'}
          </li>
        ) : results.length ? (
          results.map((product) => {
            const added = chosen.has(product.id);
            return (
              <li key={product.id} className="flex items-center gap-3 py-2">
                <Thumb product={product} />
                <div className="min-w-0 flex-1 text-[14px]">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-[13px] text-muted">
                    {PRODUCT_STATUS[product.status].label}
                    {product.priceMinMinor !== null
                      ? ` · ${formatMoney(product.priceMinMinor)}`
                      : ''}
                  </p>
                </div>
                <Button
                  variant={added ? 'ghost' : 'secondary'}
                  size="sm"
                  disabled={added}
                  onClick={() => onAdd(product)}
                  aria-label={added ? `${product.name} added` : `Add ${product.name}`}
                >
                  {added ? <Check aria-hidden size={15} /> : <Plus aria-hidden size={15} />}
                  {added ? 'Added' : 'Add'}
                </Button>
              </li>
            );
          })
        ) : (
          <li className="py-6 text-center text-[14px] text-muted">No products match.</li>
        )}
      </ul>
      <div className="flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </Dialog>
  );
}

/** A hand-picked collection's products in display order; saved as a whole list. */
export function CollectionProducts({
  collectionId,
  initial,
  canWrite,
  locked,
}: {
  collectionId: string;
  initial: readonly CollectionProductDto[];
  canWrite: boolean;
  /** Unsaved settings: saving the list would reload the page and lose them. */
  locked: boolean;
}) {
  const [items, setItems] = useState<CollectionProductDto[]>([...initial]);
  const [searching, setSearching] = useState(false);
  const [pending, start] = useTransition();
  const dirty = items.map((p) => p.id).join() !== initial.map((p) => p.id).join();

  const move = (index: number, by: -1 | 1) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    if (item) next.splice(index + by, 0, item);
    setItems(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {items.length ? (
        <ol className="border-line divide-line flex flex-col divide-y rounded-lg border">
          {items.map((product, index) => (
            <li key={product.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-6 text-right text-[13px] text-muted tabular-nums">
                {index + 1}
              </span>
              <Thumb product={product} />
              <div className="min-w-0 flex-1 text-[14px]">
                <p className="font-medium">{product.name}</p>
                {product.status !== 'ACTIVE' ? (
                  <Badge tone={PRODUCT_STATUS[product.status].tone}>
                    {PRODUCT_STATUS[product.status].label} — not shown
                  </Badge>
                ) : null}
              </div>
              {canWrite ? (
                <div className="flex shrink-0">
                  <button
                    type="button"
                    className={iconButton}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    title="Move up"
                  >
                    <ArrowUp aria-hidden size={15} />
                    <span className="sr-only">Move {product.name} up</span>
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                    title="Move down"
                  >
                    <ArrowDown aria-hidden size={15} />
                    <span className="sr-only">Move {product.name} down</span>
                  </button>
                  <button
                    type="button"
                    className={`${iconButton} hover:text-danger`}
                    onClick={() => setItems(items.filter((p) => p.id !== product.id))}
                    title="Remove from the collection"
                  >
                    <X aria-hidden size={15} />
                    <span className="sr-only">Remove {product.name}</span>
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="border-line rounded-lg border border-dashed px-4 py-6 text-center text-[14px] text-muted">
          No products yet.
        </p>
      )}
      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSearching(true)}>
            <Plus aria-hidden size={15} />
            Add products
          </Button>
          {dirty ? (
            <>
              <Button
                size="sm"
                disabled={pending || locked}
                onClick={() =>
                  start(async () => {
                    const result = await setCollectionProducts(
                      collectionId,
                      items.map((p) => p.id),
                    );
                    if (result.done) toast.success(result.done);
                    else toast.error(result.error ?? 'Could not save the products.');
                  })
                }
              >
                {pending ? 'Saving…' : 'Save products'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setItems([...initial])}>
                Undo
              </Button>
              {locked ? (
                <span className="text-warning text-[13px]">
                  Save the collection settings first.
                </span>
              ) : (
                <span className="text-warning text-[13px]">Unsaved product list</span>
              )}
            </>
          ) : null}
        </div>
      ) : null}
      {searching ? (
        <ProductSearch
          chosen={new Set(items.map((p) => p.id))}
          onAdd={(product) => setItems((current) => [...current, product])}
          onClose={() => setSearching(false)}
        />
      ) : null}
    </div>
  );
}
