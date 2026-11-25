import { describe, expect, it } from 'vitest';

import { MENU_SHAPES, shapeOf } from './labels';
import {
  canIndent,
  countItems,
  indentAt,
  type MenuNode,
  moveAt,
  outdentAt,
  problemKey,
  removeAt,
  toPayload,
  treeProblems,
} from './tree';

const node = (uid: string, children: MenuNode[] = [], url = `/${uid}`): MenuNode => ({
  uid,
  label: uid,
  url,
  openInNewTab: false,
  isVisible: true,
  settings: null,
  children,
});

const labels = (nodes: MenuNode[]): unknown =>
  nodes.map((n) => (n.children.length ? [n.uid, labels(n.children)] : n.uid));

const tree = [node('home'), node('shop', [node('lawn'), node('silk')]), node('about')];

describe('menu tree editing', () => {
  it('moves among siblings and ignores moves past the ends', () => {
    expect(labels(moveAt(tree, [1, 1], -1))).toEqual(['home', ['shop', ['silk', 'lawn']], 'about']);
    expect(labels(moveAt(tree, [0], -1))).toEqual(labels(tree));
    expect(labels(moveAt(tree, [2], 1))).toEqual(labels(tree));
  });

  it('indents under the item above and outdents to just after the parent', () => {
    expect(labels(indentAt(tree, [2]))).toEqual(['home', ['shop', ['lawn', 'silk', 'about']]]);
    expect(labels(outdentAt(tree, [1, 0]))).toEqual(['home', ['shop', ['silk']], 'lawn', 'about']);
  });

  it('never indents past the levels the shop shows', () => {
    expect(canIndent(tree, [0], 2)).toBe(false); // nothing above it
    expect(canIndent(tree, [2], 2)).toBe(true);
    expect(canIndent(tree, [1, 1], 2)).toBe(false); // would be a third level
    expect(canIndent(tree, [1, 1], 3)).toBe(true);
    // "shop" has children, so under "home" it would need 3 levels.
    expect(canIndent([node('home'), tree[1] as MenuNode], [1], 2)).toBe(false);
  });

  it('removes an item with everything under it', () => {
    const left = removeAt(tree, [1]);
    expect(labels(left)).toEqual(['home', 'about']);
    expect(countItems(tree)).toBe(5);
  });

  it('sends trimmed values without editor ids or empty settings', () => {
    const [first] = toPayload([
      { ...node('x'), label: ' Sale ', url: '', settings: { badge: '' } },
    ]);
    expect(first).toEqual({
      label: 'Sale',
      url: null,
      openInNewTab: false,
      isVisible: true,
      settings: null,
      children: [],
    });
  });
});

describe('menu problems', () => {
  it('asks for a name, a valid link and unique names per level', () => {
    const problems = treeProblems(
      [
        { ...node('a'), label: ' ' },
        { ...node('b'), label: 'Bad link', url: 'javascript:alert(1)' },
        { ...node('c'), url: '' },
        { ...node('d'), label: 'B' },
        { ...node('e'), label: 'b' },
      ],
      shapeOf('footer'),
    );
    expect(Object.keys(problems).sort()).toEqual(['a:label', 'b:url', 'c:url', 'e:label']);
  });

  it('lets a Shop menu feature card go without a link', () => {
    const card = { ...node('card', [], ''), settings: { kind: 'feature-card' as const } };
    expect(treeProblems([card], MENU_SHAPES['shop-mega'] ?? shapeOf('x'))).toEqual({});
    expect(treeProblems([card], shapeOf('footer'))).toHaveProperty('card:url');
  });

  it('places API error paths on the item they name', () => {
    expect(problemKey(tree, 'items.1.children.1.url')).toBe('silk:url');
    expect(problemKey(tree, 'items.2.label')).toBe('about:label');
    expect(problemKey(tree, 'items.9.label')).toBeNull();
    expect(problemKey(tree, 'name')).toBeNull();
  });
});
