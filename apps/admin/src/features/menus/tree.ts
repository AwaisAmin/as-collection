import type { AdminMenuItemDto, MenuItemSettingsDto } from '@as/contracts';

import { HREF_MESSAGE, isMenuHref, type MenuShape } from './labels';

/*
 * The menu editor's draft: a tree addressed by index paths ([2, 0] = first child of the third
 * top item). Every edit returns a new tree; the whole tree is saved at once.
 */

export interface MenuNode {
  /** Stable while editing (the item's id, or a new one); never sent to the API. */
  uid: string;
  label: string;
  url: string;
  openInNewTab: boolean;
  isVisible: boolean;
  settings: MenuItemSettingsDto | null;
  children: MenuNode[];
}

export type TreePath = readonly number[];

export const fromDto = (items: readonly AdminMenuItemDto[]): MenuNode[] =>
  items.map((item) => ({
    uid: item.id,
    label: item.label,
    url: item.url ?? '',
    openInNewTab: item.openInNewTab,
    isVisible: item.isVisible,
    settings: item.settings,
    children: fromDto(item.children),
  }));

const cleanSettings = (settings: MenuItemSettingsDto | null): MenuItemSettingsDto | null => {
  if (!settings) return null;
  const kept = Object.fromEntries(
    Object.entries(settings).filter(([, value]) => value !== undefined && value !== ''),
  );
  return Object.keys(kept).length ? (kept as MenuItemSettingsDto) : null;
};

export interface MenuItemPayload {
  label: string;
  url: string | null;
  openInNewTab: boolean;
  isVisible: boolean;
  settings: MenuItemSettingsDto | null;
  children: MenuItemPayload[];
}

/** The body's `items`: what the API stores (ids are regenerated on every save). */
export const toPayload = (nodes: readonly MenuNode[]): MenuItemPayload[] =>
  nodes.map((node) => ({
    label: node.label.trim(),
    url: node.url.trim() || null,
    openInNewTab: node.openInNewTab,
    isVisible: node.isVisible,
    settings: cleanSettings(node.settings),
    children: toPayload(node.children),
  }));

export const countItems = (nodes: readonly MenuNode[]): number =>
  nodes.reduce((sum, node) => sum + 1 + countItems(node.children), 0);

/** Levels from this node down (a leaf is 1). */
export const heightOf = (node: MenuNode): number => 1 + Math.max(0, ...node.children.map(heightOf));

export function nodeAt(nodes: readonly MenuNode[], path: TreePath): MenuNode | null {
  const [head, ...rest] = path;
  const node = head === undefined ? undefined : nodes[head];
  if (!node) return null;
  return rest.length ? nodeAt(node.children, rest) : node;
}

/** Applies `change` to the sibling list that holds `path`'s last index. */
function inList(
  nodes: readonly MenuNode[],
  parentPath: TreePath,
  change: (list: MenuNode[]) => MenuNode[],
): MenuNode[] {
  const [head, ...rest] = parentPath;
  if (head === undefined) return change([...nodes]);
  return nodes.map((node, index) =>
    index === head ? { ...node, children: inList(node.children, rest, change) } : node,
  );
}

export const updateAt = (
  nodes: readonly MenuNode[],
  path: TreePath,
  change: (node: MenuNode) => MenuNode,
): MenuNode[] =>
  inList(nodes, path.slice(0, -1), (list) =>
    list.map((node, index) => (index === path.at(-1) ? change(node) : node)),
  );

export const removeAt = (nodes: readonly MenuNode[], path: TreePath): MenuNode[] =>
  inList(nodes, path.slice(0, -1), (list) => list.filter((_, index) => index !== path.at(-1)));

/** Adds `node` as the last child of `parentPath` ([] = the top level). */
export const appendAt = (
  nodes: readonly MenuNode[],
  parentPath: TreePath,
  node: MenuNode,
): MenuNode[] => inList(nodes, parentPath, (list) => [...list, node]);

/** One place up (-1) or down (1) among its siblings; unchanged past either end. */
export const moveAt = (nodes: readonly MenuNode[], path: TreePath, delta: -1 | 1): MenuNode[] =>
  inList(nodes, path.slice(0, -1), (list) => {
    const from = path.at(-1) ?? 0;
    const to = from + delta;
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    const [node] = next.splice(from, 1);
    if (node) next.splice(to, 0, node);
    return next;
  });

/** Whether the node can go under the sibling above it without passing `maxDepth`. */
export function canIndent(nodes: readonly MenuNode[], path: TreePath, maxDepth: number): boolean {
  const node = nodeAt(nodes, path);
  return !!node && (path.at(-1) ?? 0) > 0 && path.length + heightOf(node) <= maxDepth;
}

/** Moves the node to the end of the sibling above it. */
export function indentAt(nodes: readonly MenuNode[], path: TreePath): MenuNode[] {
  const index = path.at(-1) ?? 0;
  const node = nodeAt(nodes, path);
  if (!node || index === 0) return [...nodes];
  const without = removeAt(nodes, path);
  return appendAt(without, [...path.slice(0, -1), index - 1], node);
}

/** Moves the node out of its parent, right after it. */
export function outdentAt(nodes: readonly MenuNode[], path: TreePath): MenuNode[] {
  const node = nodeAt(nodes, path);
  if (!node || path.length < 2) return [...nodes];
  const parentPath = path.slice(0, -1);
  const parentIndex = parentPath.at(-1) ?? 0;
  const without = removeAt(nodes, path);
  return inList(without, parentPath.slice(0, -1), (list) => [
    ...list.slice(0, parentIndex + 1),
    node,
    ...list.slice(parentIndex + 1),
  ]);
}

/** Problems keyed `${uid}:${field}` (field: label | url). */
export function treeProblems(nodes: readonly MenuNode[], shape: MenuShape): Record<string, string> {
  const problems: Record<string, string> = {};
  const walk = (list: readonly MenuNode[], depth: number) => {
    const seen = new Set<string>();
    for (const node of list) {
      const label = node.label.trim();
      const url = node.url.trim();
      if (!label) problems[`${node.uid}:label`] = 'Give it a name.';
      else if (label.length > 80) problems[`${node.uid}:label`] = 'At most 80 characters.';
      else if (seen.has(label.toLowerCase())) {
        problems[`${node.uid}:label`] = 'Another item at this level has the same name.';
      }
      seen.add(label.toLowerCase());
      const needsUrl = !(depth === 1 && shape.roles && node.settings?.kind === 'feature-card');
      if (url && !isMenuHref(url)) problems[`${node.uid}:url`] = HREF_MESSAGE;
      else if (!url && needsUrl) problems[`${node.uid}:url`] = 'Add where it leads.';
      walk(node.children, depth + 1);
    }
  };
  walk(nodes, 1);
  return problems;
}

/** `items.0.children.1.label` (an API error path) → `${uid}:label`; null if it isn't an item. */
export function problemKey(nodes: readonly MenuNode[], apiPath: string): string | null {
  const parts = apiPath.split('.');
  if (parts[0] !== 'items') return null;
  const path: number[] = [];
  let i = 1;
  while (i < parts.length && /^\d+$/.test(parts[i] ?? '')) {
    path.push(Number(parts[i]));
    if (parts[i + 1] === 'children' && /^\d+$/.test(parts[i + 2] ?? '')) i += 2;
    else {
      i += 1;
      break;
    }
  }
  const node = path.length ? nodeAt(nodes, path) : null;
  if (!node) return null;
  const field = parts[i] === 'url' ? 'url' : 'label';
  return `${node.uid}:${field}`;
}
