import { expect, test } from '@playwright/test';

import { cleanupTestData, testPhone } from './db.js';

/** Phone-code sign-in, first-time name, address book, signed-in devices and sign-out. */

test.beforeAll(cleanupTestData);
test.afterAll(cleanupTestData);

test('sign in with a code, manage the account, sign out', async ({ page }) => {
  await page.goto('/login?next=/account/profile');
  await page.getByLabel('Mobile number').fill(testPhone());
  await page.getByRole('button', { name: 'Send code' }).click();

  // The API echoes codes in development (OTP_DEV_ECHO); the storefront shows them in a toast.
  const toast = page.getByText(/Demo code: \d{6}/);
  await expect(toast).toBeVisible();
  const code = /\d{6}/.exec((await toast.textContent()) ?? '')?.[0] ?? '';
  await page.getByLabel('Digit 1 of 6').pressSequentially(code);

  await page.getByLabel('Full name').fill('E2E Browser Customer');
  await page.getByRole('button', { name: 'Continue' }).click();
  // Verifies the code, creates the account and redirects: allow for a busy machine.
  await expect(page).toHaveURL(/\/account\/profile$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Signed-in devices' })).toBeVisible();
  await expect(page.getByText('This device')).toBeVisible();

  await page.goto('/account/addresses');
  await page.getByRole('button', { name: 'Add address' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('City').fill('Karachi');
  await dialog.getByLabel('Full address').fill('Flat 3, Block 7, Clifton');
  await dialog.getByRole('button', { name: 'Add address' }).click();
  await expect(page.getByText('Address added.')).toBeVisible();
  await expect(page.getByText('Flat 3, Block 7, Clifton')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
});
