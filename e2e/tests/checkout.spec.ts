import { expect, test } from '@playwright/test';

import { cleanupTestData, reservedUnits, testPhone } from './db.js';

/** A guest places a cash-on-delivery order, tracks it and cancels it; stock is held, then released. */

const SKU = 'MKUP-002-01'; // first shade of the foundation (selected by default)

test.beforeAll(cleanupTestData);
test.afterAll(cleanupTestData);

test('guest COD order: place, track, cancel', async ({ page }) => {
  const reservedBefore = await reservedUnits(SKU);
  const phone = testPhone();

  await page.goto('/products/long-wear-liquid-foundation-spf-30');
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  await page.goto('/checkout');

  await page.getByLabel('Full name').fill('E2E Browser Guest');
  await page.getByLabel('Mobile number').fill(phone);
  await page.getByLabel('City').fill('Lahore');
  await page.getByLabel('Full address').fill('House 12, Street 4, DHA Phase 5');
  await page.getByRole('radio', { name: /Cash on Delivery/ }).check({ force: true });
  await page.getByRole('button', { name: /Place order/ }).click();

  await expect(page).toHaveURL(/\/order-confirmation\/AS-\d{6}-[A-Z0-9]{5}\?key=/, {
    timeout: 20_000,
  });
  await expect(page.getByRole('heading', { name: /Thank you, E2E!/ })).toBeVisible();
  const orderNumber = /AS-\d{6}-[A-Z0-9]{5}/.exec(page.url())?.[0] ?? '';
  expect(await reservedUnits(SKU)).toBe(reservedBefore + 1);

  // Public tracking: progress only, never personal details.
  const confirmationUrl = page.url();
  await page.goto(`/track-order?order=${orderNumber}&phone=${encodeURIComponent(phone)}`);
  await expect(page.getByRole('heading', { name: orderNumber })).toBeVisible();
  await expect(page.getByText('Lahore')).toBeVisible();
  await expect(page.getByText('E2E Browser Guest')).toHaveCount(0);

  // Cancel from the confirmation page: the held unit goes back on sale.
  await page.goto(confirmationUrl);
  await page.getByRole('button', { name: 'Cancel order' }).click();
  await page.getByRole('button', { name: 'Yes, cancel it' }).click();
  await expect(page.getByText(`Order ${orderNumber} cancelled`)).toBeVisible();
  await expect.poll(() => reservedUnits(SKU)).toBe(reservedBefore);
});
