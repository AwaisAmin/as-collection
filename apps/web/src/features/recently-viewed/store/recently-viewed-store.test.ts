import { describe, expect, it } from 'vitest';

import { pushRecent } from './recently-viewed-store';

describe('pushRecent', () => {
  it('adds new ids to the front', () => {
    expect(pushRecent(['a', 'b'], 'c')).toEqual(['c', 'a', 'b']);
  });

  it('moves an existing id to the front without duplicating it', () => {
    expect(pushRecent(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
  });

  it('keeps at most `limit` ids', () => {
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
  });
});
