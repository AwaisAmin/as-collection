import { describe, expect, it } from 'vitest';

import { kurta, lipstick } from '@/features/catalog/lib/test-fixtures';

import {
  initialSelection,
  isValueAvailable,
  missingOptions,
  stockStatus,
} from './variant-selection';

describe('variant selection', () => {
  it('requires sizes to be chosen explicitly', () => {
    expect(initialSelection(kurta)).toEqual({});
    expect(missingOptions(kurta, {})).toEqual(['Size']);
  });

  it('preselects the first in-stock shade', () => {
    expect(initialSelection(lipstick)).toEqual({ Shade: 'Ruby Red' });
    expect(missingOptions(lipstick, { Shade: 'Ruby Red' })).toEqual([]);
  });

  it('marks sold-out values unavailable', () => {
    expect(isValueAvailable(kurta, {}, 'Size', 'M')).toBe(true);
    expect(isValueAvailable(kurta, {}, 'Size', 'XL')).toBe(false);
    expect(isValueAvailable(lipstick, {}, 'Shade', 'Nude Petal')).toBe(false);
  });

  it('describes stock levels', () => {
    expect(stockStatus(0).level).toBe('out');
    expect(stockStatus(2)).toEqual({ level: 'low', label: 'Only 2 left — order soon' });
    expect(stockStatus(20).level).toBe('in');
  });
});
