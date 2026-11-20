'use client';

import type { AdminCategoryNodeDto } from '@as/contracts';
import { ArrowDown, ArrowUp, FolderTree, ImageOff, Plus } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

import { reorderCategories } from '../actions';
import { moved } from '../tree';

const MAX_DEPTH = 10;

const iconButton =
  'hover:bg-canvas inline-flex size-8 items-center justify-center rounded-md text-muted hover:text-text disabled:pointer-events-none disabled:opacity-30';

function counts(node: AdminCategoryNodeDto): string {
  const parts = [
    `${String(node.counts.products)} ${node.counts.products === 1 ? 'product' : 'products'}`,
  ];
  if (node.counts.extraProducts) parts.push(`+${String(node.counts.extraProducts)} listed here`);
  if (node.counts.children) {
    parts.push(
      `${String(node.counts.children)} ${node.counts.children === 1 ? 'subcategory' : 'subcategories'}`,
    );
  }
  return parts.join(' · ');
}

function Level({
  nodes,
  parentId,
  canWrite,
  pending,
  onMove,
}: {
  nodes: readonly AdminCategoryNodeDto[];
  parentId: string | null;
  canWrite: boolean;
  pending: boolean;
  onMove: (parentId: string | null, ids: string[]) => void;
}) {
  const ids = nodes.map((n) => n.id);
  return (
    <ul className={cn('flex flex-col', parentId && 'border-line ml-5 border-l pl-3')}>
      {nodes.map((node, index) => (
        <li key={node.id} className="flex flex-col">
          <div className="hover:bg-canvas/60 flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="border-line bg-canvas flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border">
              {node.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- library thumbnail
                <img src={node.image.url} alt="" className="size-full object-cover" />
              ) : (
                <ImageOff aria-hidden size={16} className="text-muted" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/categories/${node.id}` as Route}
                  className="font-medium hover:underline"
                >
                  {node.name}
                </Link>
                {!node.isActive ? <Badge>Hidden</Badge> : null}
              </div>
              <p className="text-[13px] text-muted">{counts(node)}</p>
            </div>
            {canWrite ? (
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  className={iconButton}
                  disabled={pending || index === 0}
                  onClick={() => onMove(parentId, moved(ids, index, -1))}
                  title="Move up"
                >
                  <ArrowUp aria-hidden size={16} />
                  <span className="sr-only">Move {node.name} up</span>
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={pending || index === nodes.length - 1}
                  onClick={() => onMove(parentId, moved(ids, index, 1))}
                  title="Move down"
                >
                  <ArrowDown aria-hidden size={16} />
                  <span className="sr-only">Move {node.name} down</span>
                </button>
                {node.depth < MAX_DEPTH ? (
                  <Link
                    href={`/categories/new?parent=${node.id}` as Route}
                    className={iconButton}
                    title="Add a subcategory"
                  >
                    <Plus aria-hidden size={16} />
                    <span className="sr-only">Add a subcategory to {node.name}</span>
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
          {node.children.length ? (
            <Level
              nodes={node.children}
              parentId={node.id}
              canWrite={canWrite}
              pending={pending}
              onMove={onMove}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** The whole category tree as the shop shows it; order changes save at once. */
export function CategoryTree({
  tree,
  canWrite,
}: {
  tree: readonly AdminCategoryNodeDto[];
  canWrite: boolean;
}) {
  const [pending, start] = useTransition();
  if (!tree.length) {
    return (
      <div className="border-line bg-surface rounded-card border border-dashed px-6 py-12 text-center">
        <FolderTree aria-hidden size={22} className="mx-auto text-muted" />
        <p className="mt-2 font-medium">No categories yet</p>
        <p className="text-[14px] text-muted">Add one to organise the shop.</p>
      </div>
    );
  }
  return (
    <div
      className="border-line bg-surface shadow-card rounded-card border p-3"
      aria-busy={pending}
      data-testid="category-tree"
    >
      <Level
        nodes={tree}
        parentId={null}
        canWrite={canWrite}
        pending={pending}
        onMove={(parentId, ids) =>
          start(async () => {
            const result = await reorderCategories(parentId, ids);
            if (result.error) toast.error(result.error);
          })
        }
      />
    </div>
  );
}
