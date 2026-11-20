import { describe, expect, it } from 'vitest';

import { toAddress, toAddressBody, toUser } from './auth-mappers';
import { describeDevice } from './device';

describe('auth mappers', () => {
  it('shows API customers with local phone numbers', () => {
    expect(
      toUser({
        id: 'c1',
        name: null,
        phone: '+923001234567',
        email: null,
        emailVerified: false,
        googleLinked: false,
        marketingOptIn: false,
        createdAt: '2026-11-20T00:00:00.000Z',
      }),
    ).toEqual({
      id: 'c1',
      phone: '03001234567',
      name: '',
      googleLinked: false,
      createdAt: '2026-11-20T00:00:00.000Z',
    });
  });

  it('round-trips addresses between the form and the API', () => {
    const address = toAddress({
      id: 'a1',
      label: null,
      fullName: 'Ayesha Malik',
      phone: '+923001234567',
      line1: 'House 12, Street 4',
      line2: 'DHA Phase 5',
      city: 'Lahore',
      province: null,
      postalCode: null,
      isDefault: true,
      createdAt: '',
      updatedAt: '',
    });
    expect(address).toEqual({
      id: 'a1',
      label: 'Address',
      recipientName: 'Ayesha Malik',
      phone: '03001234567',
      city: 'Lahore',
      address: 'House 12, Street 4, DHA Phase 5',
      isDefault: true,
    });
    const body = toAddressBody({ ...address, isDefault: false });
    expect(body).toEqual({
      label: 'Address',
      fullName: 'Ayesha Malik',
      phone: '03001234567',
      line1: 'House 12, Street 4, DHA Phase 5',
      city: 'Lahore',
      postalCode: '',
    });
    expect(toAddressBody({ ...address, isDefault: true })).toMatchObject({ isDefault: true });
  });

  it('names devices from their browser', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36',
      ),
    ).toBe('Chrome on Android');
    expect(
      describeDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari on iPhone');
    expect(describeDevice(null)).toBe('Unknown device');
  });
});
