import { describe, expect, it } from 'vitest';

import { formatMoney, formatPhone, fromPktInput, toPktInput } from './format';

describe('formatting', () => {
  it('shows rupees and local phone numbers', () => {
    expect(formatMoney(249_000)).toBe('Rs 2,490');
    expect(formatMoney(-125_050)).toBe('−Rs 1,250.5');
    expect(formatPhone('+923001234567')).toBe('0300 1234567');
  });

  it('converts schedule times as Pakistan time', () => {
    expect(fromPktInput('2026-12-01T09:30')).toBe('2026-12-01T04:30:00.000Z');
    expect(toPktInput('2026-12-01T04:30:00.000Z')).toBe('2026-12-01T09:30');
    expect(toPktInput('2026-11-30T19:00:00.000Z')).toBe('2026-12-01T00:00');
    expect(fromPktInput('')).toBeNull();
    expect(toPktInput(null)).toBe('');
  });
});
