import { diff, redact } from './audit.service.js';

describe('redact', () => {
  it('replaces secrets at any depth and serialises dates', () => {
    expect(
      redact({
        name: 'Sana',
        password: 'hunter2hunter2',
        nested: [
          { totpSecret: 'ABC', passwordHash: '$argon2id$…', apiKey: 'k', key: 'order-manager' },
        ],
        at: new Date('2026-11-20T00:00:00Z'),
      }),
    ).toEqual({
      name: 'Sana',
      password: '[redacted]',
      nested: [
        {
          totpSecret: '[redacted]',
          passwordHash: '[redacted]',
          apiKey: '[redacted]',
          key: 'order-manager',
        },
      ],
      at: '2026-11-20T00:00:00.000Z',
    });
  });
});

describe('diff', () => {
  it('keeps only changed fields', () => {
    expect(
      diff({ name: 'A', status: 'ACTIVE', roles: ['x'] }, { name: 'A', status: 'DISABLED' }),
    ).toEqual({
      before: { status: 'ACTIVE' },
      after: { status: 'DISABLED' },
    });
    expect(diff({ name: 'A' }, { name: 'A' })).toBeNull();
  });
});
