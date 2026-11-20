import type { AdminCategoryNodeDto } from '@as/contracts';

/** Every category in display order, depth-first. */
export function flatten(nodes: readonly AdminCategoryNodeDto[]): AdminCategoryNodeDto[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

export function findNode(
  nodes: readonly AdminCategoryNodeDto[],
  id: string,
): AdminCategoryNodeDto | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/** The ids of a category and everything under it (it can't move into any of them). */
export function subtreeIds(node: AdminCategoryNodeDto): Set<string> {
  return new Set(flatten([node]).map((n) => n.id));
}

/** `ids` with the item at `index` swapped one place up (-1) or down (+1). */
export function moved(ids: readonly string[], index: number, by: -1 | 1): string[] {
  const target = index + by;
  if (index < 0 || target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[target]] = [next[target] as string, next[index] as string];
  return next;
}

/** "Women › Lawn › Printed" for a category. */
export function pathOf(nodes: readonly AdminCategoryNodeDto[], id: string): string[] {
  for (const node of nodes) {
    if (node.id === id) return [node.name];
    const below = pathOf(node.children, id);
    if (below.length) return [node.name, ...below];
  }
  return [];
}
