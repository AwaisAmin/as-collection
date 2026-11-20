import { availableActions, canReviewPayment, checkTransition } from './order-workflow.js';

const cod = { paymentMethod: 'COD', paymentStatus: 'UNPAID' } as const;
const transfer = { paymentMethod: 'BANK_TRANSFER', paymentStatus: 'UNPAID' } as const;

describe('order workflow', () => {
  it('walks a COD order through fulfilment', () => {
    expect(availableActions({ ...cod, status: 'PENDING' })).toEqual(['confirm', 'cancel']);
    expect(availableActions({ ...cod, status: 'CONFIRMED' })).toEqual([
      'process',
      'ship',
      'cancel',
    ]);
    expect(availableActions({ ...cod, status: 'PROCESSING' })).toEqual(['ship', 'cancel']);
    expect(availableActions({ ...cod, status: 'SHIPPED' })).toEqual(['deliver', 'return']);
    expect(availableActions({ ...cod, status: 'DELIVERED' })).toEqual(['return']);
    expect(availableActions({ ...cod, status: 'CANCELLED' })).toEqual([]);
  });

  it('requires a verified transfer before confirming or shipping', () => {
    expect(checkTransition({ ...transfer, status: 'PENDING' }, 'confirm')).toMatchObject({
      allowed: false,
      code: 'PAYMENT_NOT_VERIFIED',
    });
    expect(
      checkTransition({ ...transfer, paymentStatus: 'PAID', status: 'PENDING' }, 'confirm'),
    ).toEqual({ allowed: true });
    expect(availableActions({ ...transfer, status: 'PENDING' })).toEqual(['cancel']);
  });

  it('refunds only paid orders that were cancelled or returned', () => {
    const paid = { ...transfer, paymentStatus: 'PAID' } as const;
    expect(checkTransition({ ...paid, status: 'CANCELLED' }, 'refund').allowed).toBe(true);
    expect(checkTransition({ ...paid, status: 'DELIVERED' }, 'refund').allowed).toBe(false);
    expect(checkTransition({ ...transfer, status: 'CANCELLED' }, 'refund').allowed).toBe(false);
  });

  it('reviews payments only for open, unpaid transfer orders', () => {
    expect(canReviewPayment({ ...transfer, status: 'PENDING' })).toBe(true);
    expect(canReviewPayment({ ...transfer, status: 'CANCELLED' })).toBe(false);
    expect(canReviewPayment({ ...transfer, paymentStatus: 'PAID', status: 'CONFIRMED' })).toBe(
      false,
    );
    expect(canReviewPayment({ ...cod, status: 'PENDING' })).toBe(false);
  });
});
