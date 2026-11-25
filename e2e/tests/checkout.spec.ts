import { expect, test } from '@playwright/test';
import pg from 'pg';

import { cleanupTestData, reservedUnits, testPhone } from './db.js';

/*
 * A guest places a cash-on-delivery order, tracks it and cancels it (stock held, then released);
 * discount codes are refused with a reason, applied, and saved on the order.
 */

const SKU = 'MKUP-002-01'; // first shade of the foundation (selected by default)

const CODES = { valid: 'E2EBROWSER300', expired: 'E2EBROWSEROLD' };

async function withDb<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

const removeCodes = () =>
  withDb((client) => client.query("DELETE FROM discounts WHERE code LIKE 'E2EBROWSER%'"));

test.beforeAll(async () => {
  await cleanupTestData();
  await removeCodes();
  await withDb((client) =>
    client.query(
      `INSERT INTO discounts (id, code, type, value, starts_at, ends_at, usage_count, is_active, updated_at)
       VALUES (uuidv7(), $1, 'FIXED_AMOUNT', 30000, NULL, NULL, 0, true, now()),
              (uuidv7(), $2, 'FIXED_AMOUNT', 30000, now() - interval '9 days', now() - interval '1 day', 0, true, now())`,
      [CODES.valid, CODES.expired],
    ),
  );
});
test.afterAll(async () => {
  await cleanupTestData();
  await removeCodes();
});

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
  // The confirmation link now says so (no "keep cash ready"), and nothing is owed.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Order cancelled' })).toBeVisible();
  await expect(page.getByText('Nothing to pay')).toBeVisible();
});

test('discount codes: refused with a reason, applied, saved on the order', async ({ page }) => {
  await page.goto('/products/long-wear-liquid-foundation-spf-30'); // Rs 2,490 + Rs 250 delivery
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  await page.goto('/checkout');
  const code = page.getByLabel('Discount code');

  await code.fill('nope123');
  await code.press('Enter'); // applies the code — never places the order
  await expect(page.getByText(/couldn’t find that code/)).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);
  await code.fill(CODES.expired.toLowerCase());
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('This code has expired.')).toBeVisible();

  await code.fill(CODES.valid);
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(`Code ${CODES.valid} applied`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Place order · Rs 2,440' })).toBeVisible();

  const phone = testPhone();
  await page.getByLabel('Full name').fill('E2E Coupon Guest');
  await page.getByLabel('Mobile number').fill(phone);
  await page.getByLabel('City').fill('Karachi');
  await page.getByLabel('Full address').fill('Flat 4, Block 2, Gulshan');
  await page.getByRole('radio', { name: /Cash on Delivery/ }).check({ force: true });
  await page.getByRole('button', { name: /Place order/ }).click();
  await expect(page).toHaveURL(/\/order-confirmation\//, { timeout: 20_000 });
  await expect(page.getByText('−Rs 300')).toBeVisible();

  const saved = await withDb(
    async (client) =>
      (
        await client.query<{ discount_code: string; discount_minor: number; total_minor: number }>(
          'SELECT discount_code, discount_minor, total_minor FROM orders WHERE phone = $1',
          [`+92${phone.replace(/\D/g, '').slice(1)}`],
        )
      ).rows[0],
  );
  expect(saved).toEqual({
    discount_code: CODES.valid,
    discount_minor: 30_000,
    total_minor: 244_000,
  });
});
