import type { AdminCategoryNodeDto } from '@as/contracts';
import { describe, expect, it } from 'vitest';

import { findNode, flatten, moved, pathOf, subtreeIds } from './tree';

const node = (id: string, children: AdminCategoryNodeDto[] = []) =>
  ({ id, name: id, children }) as unknown as AdminCategoryNodeDto;

const tree = [node('women', [node('lawn', [node('printed')]), node('silk')]), node('beauty')];

describe('category tree helpers', () => {
  it('walks the tree in display order', () => {
    expect(flatten(tree).map((n) => n.id)).toEqual(['women', 'lawn', 'printed', 'silk', 'beauty']);
    expect(findNode(tree, 'printed')?.id).toBe('printed');
    expect(findNode(tree, 'nope')).toBeNull();
  });

  it('knows a subtree and a path', () => {
    const women = findNode(tree, 'women');
    expect(women && [...subtreeIds(women)]).toEqual(['women', 'lawn', 'printed', 'silk']);
    expect(pathOf(tree, 'printed')).toEqual(['women', 'lawn', 'printed']);
  });

  it('moves one place and ignores moves past the ends', () => {
    expect(moved(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moved(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moved(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
});
