import { customerSearchWhere } from './admin-customers.js';

describe('customerSearchWhere', () => {
  it('matches phones in any spelling, emails, then names', () => {
    expect(customerSearchWhere('0300 1234567')).toEqual({ phone: '+923001234567' });
    expect(customerSearchWhere('+92-300-1234567')).toEqual({ phone: '+923001234567' });
    expect(customerSearchWhere('ayesha@')).toEqual({
      email: { contains: 'ayesha@', mode: 'insensitive' },
    });
    expect(customerSearchWhere('Ayesha')).toEqual({
      name: { contains: 'Ayesha', mode: 'insensitive' },
    });
  });
});
