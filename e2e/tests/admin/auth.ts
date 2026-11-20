import { expect, type Page } from '@playwright/test';

import { totp } from './totp.js';

/** First sign-in of a new staff account: password, authenticator setup, dashboard. */
export async function enrolAndSignIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByText("Can't scan? Enter this key instead").click();
  const secret = (await page.getByTestId('totp-secret').textContent())?.trim() ?? '';
  // Stay clear of a 30-second boundary so the code is still valid when it arrives.
  if (Date.now() % 30_000 > 25_000) await page.waitForTimeout(6_000);
  await page.getByLabel('Authentication code').fill(totp(secret));
  await page.getByRole('button', { name: 'Turn on and sign in' }).click();
  await expect(page.getByRole('heading', { name: /^Welcome, / })).toBeVisible();
}
