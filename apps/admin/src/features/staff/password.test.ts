import { describe, expect, it } from 'vitest';

import { passwordProblem, temporaryPassword } from './password';

describe('temporary passwords', () => {
  it('are four groups of four unambiguous characters', () => {
    const password = temporaryPassword();
    expect(password).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{4}(-[a-km-zA-HJ-NP-Z2-9]{4}){3}$/);
    expect(password).not.toMatch(/[01lIoO]/);
    expect(passwordProblem(password, 'ayesha@example.com')).toBeNull();
  });

  it('differ every time', () => {
    expect(new Set(Array.from({ length: 50 }, () => temporaryPassword())).size).toBe(50);
  });
});

describe('password rules', () => {
  it('match the API', () => {
    expect(passwordProblem('short', 'a@b.co')).toMatch(/12 characters/);
    expect(passwordProblem('aaaaaaaaaaaaaa', 'a@b.co')).toMatch(/repetitive/);
    expect(passwordProblem('my-ayesha-password', 'ayesha@example.com')).toMatch(/email name/);
    expect(passwordProblem('harbour violet compass', 'ayesha@example.com')).toBeNull();
  });
});

describe('role labels', () => {
  it('summarise access and make keys', async () => {
    const { roleKeyFrom, roleSummary } = await import('./permission-labels');
    expect(roleSummary(['*'])).toBe('Full access to everything');
    expect(roleSummary(['orders.read', 'orders.write', 'inbox.read'])).toBe(
      'Orders, Inbox · 3 permissions',
    );
    expect(roleKeyFrom('  Order Manager (Lahore) ')).toBe('order-manager-lahore');
  });
});
