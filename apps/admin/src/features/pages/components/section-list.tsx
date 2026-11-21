'use client';

import type { AdminSectionDto, SectionType } from '@as/contracts';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ActionState } from '@/lib/action-state';
import { formatDateTime } from '@/lib/format';

import { deleteSection, reorderSections, setSectionVisible } from '../actions';
import {
  ADDABLE_TYPES,
  isKnownType,
  SECTION_STATES,
  SECTION_TYPES,
  sectionState,
  sectionSummary,
} from '../sections';
import { SectionDialog } from './section-dialog';
import type { SectionLookups } from './section-settings';

const iconButton =
  'hover:bg-canvas inline-flex size-8 items-center justify-center rounded-md text-muted hover:text-text disabled:pointer-events-none disabled:opacity-30';

/** The page's sections top to bottom, as the shop shows them. */
export function SectionList({
  pageId,
  sections,
  lookups,
  canWrite,
}: {
  pageId: string;
  sections: readonly AdminSectionDto[];
  lookups: SectionLookups;
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState<AdminSectionDto | 'new' | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const names = useMemo(
    () => ({
      categories: new Map(lookups.categories.map((c) => [c.value, c.label.replace(/^(— )+/, '')])),
      collections: new Map(lookups.collections.map((c) => [c.value, c.label])),
    }),
    [lookups],
  );
  // One-of-a-kind sections that are already on the page can't be added again.
  const addable = ADDABLE_TYPES.filter(
    (type) => SECTION_TYPES[type].repeatable || !sections.some((s) => s.type === type),
  );
  const ids = sections.map((s) => s.id);

  const run = (work: () => Promise<ActionState>, announce = false) =>
    start(async () => {
      const result = await work();
      if (result.error) toast.error(result.error);
      else if (announce && result.done) toast.success(result.done);
    });
  const move = (index: number, by: -1 | 1) => {
    const next = [...ids];
    const [id] = next.splice(index, 1);
    if (id) next.splice(index + by, 0, id);
    run(() => reorderSections(pageId, next));
  };

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2" aria-busy={pending} data-testid="section-list">
        {sections.map((section, index) => {
          const meta = isKnownType(section.type)
            ? SECTION_TYPES[section.type as SectionType]
            : null;
          const state = SECTION_STATES[sectionState(section)];
          return (
            <li
              key={section.id}
              aria-label={meta?.label ?? section.type}
              className="border-line bg-surface shadow-card flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center"
            >
              <span className="hidden w-6 text-right text-[13px] text-muted tabular-nums sm:block">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{meta?.label ?? section.type}</p>
                  <Badge tone={state.tone}>{state.label}</Badge>
                </div>
                <p className="truncate text-[13px] text-muted">{sectionSummary(section, names)}</p>
                {section.startsAt || section.endsAt ? (
                  <p className="text-[12px] text-muted">
                    {section.startsAt ? `from ${formatDateTime(section.startsAt)}` : ''}
                    {section.startsAt && section.endsAt ? ' ' : ''}
                    {section.endsAt ? `until ${formatDateTime(section.endsAt)}` : ''}
                  </p>
                ) : null}
              </div>
              {canWrite ? (
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    className={iconButton}
                    disabled={pending || index === 0}
                    onClick={() => move(index, -1)}
                    title="Move up"
                  >
                    <ArrowUp aria-hidden size={16} />
                    <span className="sr-only">Move {meta?.label ?? section.type} up</span>
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    disabled={pending || index === sections.length - 1}
                    onClick={() => move(index, 1)}
                    title="Move down"
                  >
                    <ArrowDown aria-hidden size={16} />
                    <span className="sr-only">Move {meta?.label ?? section.type} down</span>
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    disabled={pending}
                    onClick={() =>
                      run(() => setSectionVisible(pageId, section, !section.isVisible), true)
                    }
                    title={section.isVisible ? 'Hide' : 'Show'}
                  >
                    {section.isVisible ? (
                      <EyeOff aria-hidden size={16} />
                    ) : (
                      <Eye aria-hidden size={16} />
                    )}
                    <span className="sr-only">
                      {section.isVisible ? 'Hide' : 'Show'} {meta?.label ?? section.type}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    onClick={() => setEditing(section)}
                    title="Edit"
                  >
                    <Pencil aria-hidden size={16} />
                    <span className="sr-only">Edit {meta?.label ?? section.type}</span>
                  </button>
                  {confirming === section.id ? (
                    <span className="ml-1 flex items-center gap-1">
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          setConfirming(null);
                          run(() => deleteSection(pageId, section.id), true);
                        }}
                      >
                        Remove
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                        Keep
                      </Button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={`${iconButton} hover:text-danger`}
                      onClick={() => setConfirming(section.id)}
                      title="Remove"
                    >
                      <Trash2 aria-hidden size={16} />
                      <span className="sr-only">Remove {meta?.label ?? section.type}</span>
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {!sections.length ? (
        <p className="border-line rounded-lg border border-dashed px-4 py-8 text-center text-[14px] text-muted">
          No sections yet.
        </p>
      ) : null}
      {canWrite && addable.length ? (
        <div>
          <Button variant="secondary" onClick={() => setEditing('new')}>
            <Plus aria-hidden size={16} />
            Add section
          </Button>
        </div>
      ) : null}
      {editing ? (
        <SectionDialog
          pageId={pageId}
          section={editing === 'new' ? null : editing}
          addableTypes={addable}
          lookups={lookups}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
