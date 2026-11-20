import { expect, type Locator, type Page, test } from '@playwright/test';
import pg from 'pg';

import { enrolAndSignIn } from './auth.js';
import { removeOwnImages } from './media-api.js';
import { randomPng } from './png.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/*
 * Staff create a product with an uploaded photo and two variants, publish it, change a
 * variant's price, then delete it again.
 */

const API = 'http://127.0.0.1:4100/api/v1';
const run = String(Date.now()).slice(-7);
const name = `E2E Test Kurta ${run}`;
const email = `catalog-${run}${STAFF_DOMAIN}`;
const password = 'velvet orchard lantern 31';
const STAFF_NAME = 'Catalog Manager';

const shown = (locator: Locator) => locator.filter({ visible: true }).first();

/** Removes what a failed run may have left (the test itself deletes through the admin). */
async function cleanupProducts(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM inventory_movements m USING product_variants v, products p
        WHERE m.variant_id = v.id AND v.product_id = p.id AND p.name LIKE 'E2E Test Kurta %'`,
    );
    await client.query(`DELETE FROM products WHERE name LIKE 'E2E Test Kurta %'`);
  } finally {
    await client.end();
  }
}

/** The staff session token from the browser, to tidy up through the API. */
async function sessionToken(page: Page): Promise<string> {
  const cookie = (await page.context().cookies()).find((c) => /as_admin$/.test(c.name));
  return cookie?.value ?? '';
}

/** Session of this run's staff member (set after sign-in), for clean-up even after a failure. */
let token = '';

test.beforeAll(async () => {
  await cleanupProducts();
  await cleanupStaff();
  createStaff(email, STAFF_NAME, password);
});
test.afterAll(async () => {
  await cleanupProducts();
  await removeOwnImages(token, STAFF_NAME);
  await cleanupStaff();
});

test('create, publish, edit and delete a product', async ({ page }) => {
  await enrolAndSignIn(page, email, password);
  token = await sessionToken(page);
  await page
    .getByRole('navigation', { name: 'Admin sections' })
    .getByRole('link', { name: 'Products' })
    .first()
    .click();
  await expect(shown(page.getByRole('heading', { name: 'Products', exact: true }))).toBeVisible();
  // The seeded catalog is listed.
  await expect(
    shown(page.getByRole('link', { name: 'Long Wear Liquid Foundation SPF 30' })),
  ).toBeVisible();

  await shown(page.getByRole('link', { name: 'New product' })).click();
  await expect(shown(page.getByRole('heading', { name: 'New product' }))).toBeVisible();

  // Missing basics are caught before anything is sent.
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(shown(page.getByText('Give the product a name.'))).toBeVisible();

  await page.getByLabel(/^Name/).fill(name);
  await page.getByLabel('Short description').fill('Hand-finished cotton kurta.');
  await page.getByLabel('Main category').selectOption({ index: 1 });

  // Upload a photo from the picker; it is selected straight away.
  await page.getByRole('button', { name: 'Add images' }).click();
  const picker = page.getByRole('dialog', { name: 'Add images' });
  await picker.getByTestId('image-upload-input').setInputFiles({
    name: 'kurta.png',
    mimeType: 'image/png',
    buffer: randomPng(),
  });
  await expect(picker.getByText('1 selected')).toBeVisible({ timeout: 20_000 });
  await picker.getByRole('button', { name: 'Add to product' }).click();
  await expect(page.getByText('Main image')).toBeVisible();
  await page.getByLabel('Description (alt text)').fill('Kurta, front view');

  // Two sizes.
  await page.getByRole('checkbox', { name: 'Size' }).check();
  const first = page.getByRole('listitem', { name: 'Variant 1' });
  await first.getByLabel('Size').selectOption({ index: 1 });
  await first.getByLabel('SKU').fill(`E2E-${run}-S`);
  await first.getByLabel(/^Price \(Rs\)/).fill('4,500');
  await first.getByLabel('Units in stock').fill('5');
  await page.getByRole('button', { name: 'Add variant' }).click();
  const second = page.getByRole('listitem', { name: 'Variant 2' });
  await expect(second.getByLabel(/^Price \(Rs\)/)).toHaveValue('4,500');
  await second.getByLabel('SKU').fill(`E2E-${run}-M`);
  await second.getByLabel('Size').selectOption({ index: 2 });
  await second.getByLabel('Units in stock').fill('3');

  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}\?created=1/, { timeout: 20_000 });
  await expect(shown(page.getByText(/Product created\./))).toBeVisible();
  await expect(shown(page.getByRole('heading', { name }))).toBeVisible();
  await expect(shown(page.getByText(`E2E-${run}-S`))).toBeVisible();
  await expect(shown(page.getByText(`E2E-${run}-M`))).toBeVisible();
  const productId = /\/products\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? '';
  const mediaSrc = await shown(page.getByRole('img', { name: 'Kurta, front view' })).getAttribute(
    'src',
  );
  expect(mediaSrc).toMatch(/\.webp$/);

  // Publish.
  await shown(page.getByLabel('Visibility')).selectOption('ACTIVE');
  await expect(shown(page.getByText('Unsaved changes'))).toBeVisible();
  // Variants wait while the product has unsaved changes.
  await expect(
    shown(page.getByText('Save or undo your product changes to edit variants.')),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(shown(page.getByText('Product saved.'))).toBeVisible();
  await expect(shown(page.getByText('All changes saved'))).toBeVisible();
  await expect(shown(page.getByRole('link', { name: /View in the shop/ }))).toBeVisible();

  // Change a variant's price in its dialog.
  await page.getByRole('button', { name: `Edit E2E-${run}-M` }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Price \(Rs\)/).fill('4800');
  await dialog.getByLabel(/^Was price/).fill('4000');
  await dialog.getByRole('button', { name: 'Save variant' }).click();
  await expect(dialog.getByText(/higher than the price/)).toBeVisible();
  await dialog.getByLabel(/^Was price/).fill('');
  await dialog.getByRole('button', { name: 'Save variant' }).click();
  await expect(shown(page.getByText('Variant saved.'))).toBeVisible();
  await expect(shown(page.getByText('Rs 4,500 – Rs 4,800'))).toBeVisible();

  // Find it in the list, then delete it (never ordered).
  await page.goto(`/products?q=${encodeURIComponent(name)}`);
  await expect(shown(page.getByRole('link', { name }))).toBeVisible();
  await shown(page.getByRole('link', { name })).click();
  await page.getByRole('button', { name: 'Delete product' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete product' }).click();
  await expect(page).toHaveURL(/\/products\?deleted=1/);
  await expect(shown(page.getByText('The product was deleted.'))).toBeVisible();

  // The uploaded photo is now unused: remove it from the library (and storage) via the API.
  expect(productId).not.toBe('');
  expect(await removeOwnImages(token, STAFF_NAME)).toBe(1);
});
