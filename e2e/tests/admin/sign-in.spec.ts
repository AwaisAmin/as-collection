import { expect, test } from '@playwright/test';

import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';
import { totp } from './totp.js';

const email = `owner-${String(Date.now())}${STAFF_DOMAIN}`;
const password = 'quiet harbour lantern 42';

test.beforeAll(async () => {
  await cleanupStaff();
  createStaff(email, 'Test Owner', password);
});
test.afterAll(cleanupStaff);

test('signs in with first-time authenticator setup, sees the dashboard, signs out', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Set up two-step verification' })).toBeVisible();
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  await page.getByText("Can't scan? Enter this key instead").click();
  const secret = (await page.getByTestId('totp-secret').textContent())?.trim() ?? '';
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);

  // Stay clear of a 30-second boundary so the code is still valid when it arrives.
  if (Date.now() % 30_000 > 25_000) await page.waitForTimeout(6_000);
  await page.getByLabel('Authentication code').fill(totp(secret));
  await page.getByRole('button', { name: 'Turn on and sign in' }).click();

  await expect(page).toHaveURL(/localhost:3101\/$/);
  await expect(page.getByRole('heading', { name: /Welcome, Test/ })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Low stock')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

test('rejects a wrong password without revealing whether the account exists', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill('not the right password');
  await page.getByRole('button', { name: 'Continue' }).click();
  // (Next's empty route announcer also has role=alert.)
  await expect(page.getByRole('alert').filter({ hasText: /[a-z]/i })).toBeVisible();
  await expect(page.getByLabel('Work email')).toHaveValue(email);
});
