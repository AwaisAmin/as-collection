import { expect, type Locator, test } from '@playwright/test';
import pg from 'pg';

import { variantStock } from '../db.js';
import { enrolAndSignIn } from './auth.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/*
 * A discount code from creation to use: made in the admin, applied by the real checkout quote,
 * changed to free delivery, switched off, deleted.
 */

const API = 'http://127.0.0.1:4100/api/v1';
const SKU = 'MKUP-002-01'; // Rs 2,490
const run = String(Date.now()).slice(-7);
const CODE = `E2E${run}`;
const email = `discounts-${run}${STAFF_DOMAIN}`;
const password = 'marigold lantern quarry 44';

const shown = (locator: Locator) => locator.filter({ visible: true }).first();

async function cleanupDiscounts(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM discounts WHERE code LIKE 'E2E%'`);
  } finally {
    await client.end();
  }
}

test.beforeAll(async () => {
  await cleanupDiscounts();
  await cleanupStaff();
  createStaff(email, 'Promotions', password);
});
test.afterAll(async () => {
  await cleanupDiscounts();
  await cleanupStaff();
});

test('create a code, use it at checkout, change it, switch it off, delete it', async ({
  page,
  request,
}) => {
  await enrolAndSignIn(page, email, password);
  await page
    .getByRole('navigation', { name: 'Admin sections' })
    .getByRole('link', { name: 'Discounts' })
    .first()
    .click();
  await shown(page.getByRole('link', { name: 'New discount' })).click();

  // The generator makes readable codes; we then type our own.
  const code = shown(page.getByLabel(/^Code customers type/));
  await shown(page.getByRole('button', { name: 'Generate' })).click();
  await expect(code).toHaveValue(/^AS-[A-HJKMNP-Z2-9]{6}$/);
  await code.fill(CODE);

  // A wrong percentage is refused and what was typed stays.
  await shown(page.getByRole('textbox', { name: /^Percent off/ })).fill('150');
  await shown(page.getByLabel(/^Up to/)).fill('1000');
  await shown(page.getByLabel(/^Minimum order/)).fill('3000');
  await shown(page.getByLabel(/^Total uses/)).fill('50');
  await shown(page.getByRole('button', { name: 'Create discount' })).click();
  await expect(shown(page.getByText('Enter a percentage from 0.01 to 100.'))).toBeVisible();
  await expect(shown(page.getByLabel(/^Up to/))).toHaveValue('1000');
  await shown(page.getByRole('textbox', { name: /^Percent off/ })).fill('15');
  await shown(page.getByRole('button', { name: 'Create discount' })).click();

  await expect(page).toHaveURL(/\/discounts\/[0-9a-f-]{36}\?created=1/);
  await expect(shown(page.getByText('Discount created.'))).toBeVisible();
  await expect(shown(page.getByRole('heading', { name: CODE }))).toBeVisible();
  await expect(
    shown(page.getByText('15% off, up to Rs 1,000 · orders over Rs 3,000')),
  ).toBeVisible();
  await expect(shown(page.getByText('Active', { exact: true }))).toBeVisible();

  // The checkout applies it (in any case): 15% of Rs 4,980 = Rs 747.
  const { variantId } = await variantStock(SKU);
  const quote = await request.post(`${API}/checkout/quote`, {
    data: { lines: [{ variantId, quantity: 2 }], discountCode: CODE.toLowerCase() },
  });
  expect(quote.ok()).toBe(true);
  expect(((await quote.json()) as { discountMinor: number }).discountMinor).toBe(74_700);

  // Free delivery instead.
  await shown(page.getByText('Free delivery', { exact: true })).click();
  await shown(page.getByRole('button', { name: 'Save discount' })).click();
  await expect(shown(page.getByText('Discount saved.'))).toBeVisible();
  await expect(shown(page.getByText('Free delivery · orders over Rs 3,000'))).toBeVisible();

  // Off: the checkout no longer accepts it.
  await shown(page.getByLabel(/^On/)).uncheck();
  await shown(page.getByRole('button', { name: 'Save discount' })).click();
  await expect(shown(page.getByText('Off', { exact: true }))).toBeVisible();
  const refused = await request.post(`${API}/checkout/quote`, {
    data: { lines: [{ variantId, quantity: 2 }], discountCode: CODE },
  });
  expect(((await refused.json()) as { discountMinor: number }).discountMinor).toBe(0);

  // Listed under Off, then deleted (never used).
  await page.goto('/discounts?state=inactive');
  await expect(shown(page.getByRole('link', { name: CODE }))).toBeVisible();
  await shown(page.getByRole('link', { name: CODE })).click();
  await shown(page.getByRole('button', { name: 'Delete discount' })).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete discount' }).click();
  await expect(page).toHaveURL(/\/discounts\?deleted=1/);
  await expect(shown(page.getByText('The discount was deleted.'))).toBeVisible();
});
