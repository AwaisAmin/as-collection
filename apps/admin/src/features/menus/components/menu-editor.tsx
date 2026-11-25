'use client';

import type { AdminMenuDto } from '@as/contracts';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { type ReactNode, useActionState, useId, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SaveBar, StaleAlert } from '@/components/ui/save-bar';
import type { SaveState } from '@/lib/action-state';
import { cn } from '@/lib/utils/cn';

import { saveMenu } from '../actions';
import { MAX_MENU_ITEMS, type MenuShape, ROLE_LABELS, shapeOf } from '../labels';
import {
  appendAt,
  canIndent,
  countItems,
  fromDto,
  indentAt,
  type MenuNode,
  moveAt,
  nodeAt,
  outdentAt,
  problemKey,
  removeAt,
  toPayload,
  type TreePath,
  treeProblems,
  updateAt,
} from '../tree';
import { MenuItemDialog } from './menu-item-dialog';

interface Draft {
  name: string;
  items: MenuNode[];
}

type Editing = { mode: 'edit'; path: TreePath } | { mode: 'add'; parentPath: TreePath } | null;

const blank = (): MenuNode => ({
  uid: `new-${crypto.randomUUID()}`,
  label: '',
  url: '',
  openInNewTab: false,
  isVisible: true,
  settings: null,
  children: [],
});

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/** "Shop › Lawn" for every item, to name it in the list of problems. */
function trails(nodes: readonly MenuNode[], prefix = ''): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of nodes) {
    const trail = `${prefix}${node.label.trim() || 'Unnamed item'}`;
    map.set(node.uid, trail);
    for (const [uid, value] of trails(node.children, `${trail} › `)) map.set(uid, value);
  }
  return map;
}

/** The whole menu as a tree: add, rename, move, nest and hide items, then save it at once. */
export function MenuEditor({ menu, canWrite }: { menu: AdminMenuDto; canWrite: boolean }) {
  const id = useId();
  const formId = `${id}-menu`;
  const shape = shapeOf(menu.key);
  const initial = useMemo<Draft>(() => ({ name: menu.name, items: fromDto(menu.items) }), [menu]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [editing, setEditing] = useState<Editing>(null);
  const [local, setLocal] = useState<Record<string, string>>({});
  const setItems = (change: (items: MenuNode[]) => MenuNode[]) =>
    setDraft((current) => ({ ...current, items: change(current.items) }));

  const payloadOf = (d: Draft) => ({
    name: d.name.trim(),
    items: toPayload(d.items),
    updatedAt: menu.updatedAt,
  });
  const body = JSON.stringify(payloadOf(draft));
  const dirty = body !== JSON.stringify(payloadOf(initial));
  const total = countItems(draft.items);

  const [state, action, pending] = useActionState<SaveState, FormData>(async (prev, data) => {
    const problems = treeProblems(draft.items, shape);
    if (!draft.name.trim()) problems.name = 'Give the menu a name.';
    setLocal(problems);
    if (Object.keys(problems).length) {
      return { error: 'Some items need attention.', at: Date.now() };
    }
    const result = await saveMenu(menu.key, prev, data);
    if (result.done) toast.success(result.done);
    return result;
  }, {});

  // API problems are placed on the item their path names; the rest stay general.
  const apiProblems: Record<string, string> = {};
  const general: string[] = [];
  for (const [path, message] of Object.entries(state.errors ?? {})) {
    const key = path === 'name' ? 'name' : problemKey(draft.items, path);
    if (key) apiProblems[key] = message;
    else general.push(message);
  }
  const problems = { ...apiProblems, ...local };
  const names = trails(draft.items);
  const listLabels: Record<string, string> = { name: 'Menu name' };
  for (const key of Object.keys(problems)) {
    const [uid = '', field] = key.split(':');
    if (field)
      listLabels[key] = `${names.get(uid) ?? 'Item'} (${field === 'url' ? 'link' : 'name'})`;
  }

  const editedNode = editing?.mode === 'edit' ? nodeAt(draft.items, editing.path) : null;
  const parentPathOf = (e: NonNullable<Editing>) =>
    e.mode === 'edit' ? e.path.slice(0, -1) : e.parentPath;
  const siblingsOf = (e: NonNullable<Editing>) => {
    const parentPath = parentPathOf(e);
    const list = parentPath.length
      ? (nodeAt(draft.items, parentPath)?.children ?? [])
      : draft.items;
    return list.filter((n) => n !== editedNode).map((n) => n.label);
  };
  const levelWord = (depth: number) => shape.levels[depth - 1] ?? 'sub-link';

  return (
    <div className="flex flex-col gap-6 pb-24">
      <form id={formId} action={action} noValidate>
        <input type="hidden" name="payload" value={body} />
      </form>
      {state.stale ? <StaleAlert what="menu" /> : null}
      {general.length ? <Alert tone="error">{general.join(' ')}</Alert> : null}

      <fieldset disabled={!canWrite} className="contents">
        <Card className="flex flex-col gap-4 p-5">
          <Field
            id={`${id}-name`}
            label="Menu name"
            hint="Only staff see it."
            error={problems.name}
            required
          >
            {(control) => (
              <Input
                {...control}
                value={draft.name}
                onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
                maxLength={120}
                className="sm:max-w-sm"
              />
            )}
          </Field>
          {shape.hint ? <p className="text-[13px] text-muted">{shape.hint}</p> : null}
        </Card>

        <Card className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-semibold">Items</h2>
            <p className="text-[13px] text-muted">
              {total} of {MAX_MENU_ITEMS} · up to {shape.depth}{' '}
              {shape.depth === 1 ? 'level' : 'levels'}
            </p>
          </div>
          {draft.items.length ? (
            <Rows
              nodes={draft.items}
              parentPath={[]}
              shape={shape}
              problems={problems}
              full={total >= MAX_MENU_ITEMS}
              canWrite={canWrite}
              onEdit={(path) => setEditing({ mode: 'edit', path })}
              onAdd={(parentPath) => setEditing({ mode: 'add', parentPath })}
              onChange={setItems}
            />
          ) : (
            <p className="text-[14px] text-muted">
              No items: the shop shows its built-in {menu.name.toLowerCase()} instead.
            </p>
          )}
          {canWrite ? (
            <Button
              variant="secondary"
              className="self-start"
              disabled={total >= MAX_MENU_ITEMS}
              onClick={() => setEditing({ mode: 'add', parentPath: [] })}
            >
              <Plus aria-hidden size={16} />
              Add {article(levelWord(1))} {levelWord(1)}
            </Button>
          ) : null}
        </Card>
      </fieldset>

      {editing && (editing.mode === 'add' || editedNode) ? (
        <MenuItemDialog
          title={
            editing.mode === 'add'
              ? `Add ${article(levelWord(editing.parentPath.length + 1))} ${levelWord(editing.parentPath.length + 1)}`
              : `Edit “${editedNode?.label ?? ''}”`
          }
          node={editedNode ?? blank()}
          withRole={!!shape.roles && parentPathOf(editing).length === 0}
          siblingLabels={siblingsOf(editing)}
          submitLabel={editing.mode === 'add' ? 'Add' : 'Done'}
          onClose={() => setEditing(null)}
          onSave={(node) => {
            setItems((items) =>
              editing.mode === 'add'
                ? appendAt(items, editing.parentPath, node)
                : updateAt(items, editing.path, () => node),
            );
            // Its problems are fixed by the dialog's own checks.
            setLocal((current) =>
              Object.fromEntries(
                Object.entries(current).filter(([key]) => !key.startsWith(`${node.uid}:`)),
              ),
            );
            setEditing(null);
          }}
        />
      ) : null}

      {canWrite ? (
        <SaveBar
          formId={formId}
          state={state}
          errors={problems}
          labels={listLabels}
          isNew={false}
          dirty={dirty}
          pending={pending}
          onUndo={() => {
            setDraft(initial);
            setLocal({});
          }}
          createLabel="Save menu"
          saveLabel="Save menu"
          newText=""
        />
      ) : null}
    </div>
  );
}

interface RowsProps {
  nodes: readonly MenuNode[];
  parentPath: TreePath;
  shape: MenuShape;
  problems: Record<string, string>;
  /** The menu holds the most items it can. */
  full: boolean;
  canWrite: boolean;
  onEdit: (path: TreePath) => void;
  onAdd: (parentPath: TreePath) => void;
  onChange: (change: (items: MenuNode[]) => MenuNode[]) => void;
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-8 px-0"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function Rows(props: RowsProps) {
  const { nodes, parentPath, shape, problems, full, canWrite, onEdit, onAdd, onChange } = props;
  const depth = parentPath.length + 1;
  return (
    <ol
      className={cn(
        'flex flex-col gap-2',
        depth > 1 && 'border-line ml-3 border-l pl-3 sm:ml-4 sm:pl-4',
      )}
    >
      {nodes.map((node, index) => {
        const path = [...parentPath, index];
        const name = `“${node.label}”`;
        const kind = node.settings?.kind;
        const unshown = depth > shape.depth;
        const labelProblem = problems[`${node.uid}:label`];
        const urlProblem = problems[`${node.uid}:url`];
        return (
          <li key={node.uid} className="flex flex-col gap-2">
            <div
              className={cn(
                'border-line flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center',
                (labelProblem ?? urlProblem) && 'border-danger/60',
                !node.isVisible && 'bg-canvas/60',
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium break-words">{node.label || 'Unnamed item'}</span>
                  {!node.isVisible ? (
                    <Badge>
                      <EyeOff aria-hidden size={12} className="mr-1" />
                      Hidden
                    </Badge>
                  ) : null}
                  {shape.roles && depth === 1 ? (
                    kind ? (
                      <Badge tone="gold">{ROLE_LABELS[kind].label}</Badge>
                    ) : (
                      <Badge tone="warning">No role: not shown</Badge>
                    )
                  ) : null}
                  {unshown ? <Badge tone="warning">Too deep: not shown</Badge> : null}
                </div>
                <span className="truncate text-[13px] text-muted">{node.url || 'No link'}</span>
                {labelProblem ? <p className="text-danger text-[13px]">{labelProblem}</p> : null}
                {urlProblem ? <p className="text-danger text-[13px]">{urlProblem}</p> : null}
              </div>
              {canWrite ? (
                <div className="-ml-1 flex flex-wrap items-center gap-0.5 sm:ml-0">
                  <IconButton
                    label={`Move ${name} up`}
                    disabled={index === 0}
                    onClick={() => onChange((items) => moveAt(items, path, -1))}
                  >
                    <ArrowUp aria-hidden size={16} />
                  </IconButton>
                  <IconButton
                    label={`Move ${name} down`}
                    disabled={index === nodes.length - 1}
                    onClick={() => onChange((items) => moveAt(items, path, 1))}
                  >
                    <ArrowDown aria-hidden size={16} />
                  </IconButton>
                  {shape.depth > 1 ? (
                    <>
                      <IconButton
                        label={`Move ${name} out a level`}
                        disabled={depth === 1}
                        onClick={() => onChange((items) => outdentAt(items, path))}
                      >
                        <ArrowLeft aria-hidden size={16} />
                      </IconButton>
                      <IconButton
                        label={`Move ${name} under the item above`}
                        disabled={index === 0 || !canIndentPath(props, path)}
                        onClick={() => onChange((items) => indentAt(items, path))}
                      >
                        <ArrowRight aria-hidden size={16} />
                      </IconButton>
                    </>
                  ) : null}
                  {depth < shape.depth ? (
                    <IconButton
                      label={`Add ${shape.levels[depth] ?? 'a sub-link'} under ${name}`}
                      disabled={full}
                      onClick={() => onAdd(path)}
                    >
                      <Plus aria-hidden size={16} />
                    </IconButton>
                  ) : null}
                  <IconButton label={`Edit ${name}`} onClick={() => onEdit(path)}>
                    <Pencil aria-hidden size={16} />
                  </IconButton>
                  <IconButton
                    label={`Remove ${name}${node.children.length ? ' and its items' : ''}`}
                    onClick={() => onChange((items) => removeAt(items, path))}
                  >
                    <Trash2 aria-hidden size={16} className="text-danger" />
                  </IconButton>
                </div>
              ) : null}
            </div>
            {node.children.length ? (
              <Rows {...props} nodes={node.children} parentPath={path} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Indenting checks against the whole tree, which only the top list holds. */
function canIndentPath(props: RowsProps, path: TreePath): boolean {
  const siblings = props.nodes;
  const index = path.at(-1) ?? 0;
  const above = siblings[index - 1];
  const node = siblings[index];
  if (!above || !node) return false;
  // Same rule as `canIndent`, from the sibling list we already have.
  return canIndent([above, node], [1], props.shape.depth - (path.length - 1));
}
