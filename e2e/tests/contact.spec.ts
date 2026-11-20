import { expect, test } from '@playwright/test';

import { cleanupTestData, EMAIL_DOMAIN } from './db.js';

/** Contact form and newsletter sign-up reach the API. */

test.beforeAll(cleanupTestData);
test.afterAll(cleanupTestData);

test('the contact form sends a message', async ({ page }) => {
  await page.goto('/contact');
  await page.getByLabel('Your name').fill('E2E Browser Visitor');
  await page.getByRole('textbox', { name: 'Email (optional)' }).fill(`visitor${EMAIL_DOMAIN}`);
  await page.getByLabel('Topic').selectOption('Order enquiry');
  await page
    .getByRole('textbox', { name: 'Message' })
    .fill('Browser test of the contact form. Please ignore.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Message sent — thank you!')).toBeVisible();
});

test('the newsletter form subscribes an email', async ({ page }) => {
  await page.goto('/contact');
  const form = page.getByRole('form', { name: 'Newsletter signup' });
  await form.getByPlaceholder('Enter your email address').fill(`reader${EMAIL_DOMAIN}`);
  await form.getByRole('button', { name: 'Subscribe' }).click();
  await expect(page.getByText(/Thank you for subscribing/)).toBeVisible();
});
