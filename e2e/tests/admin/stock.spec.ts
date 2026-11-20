import { expect, type Locator, test } from '@playwright/test';
import pg from 'pg';

import { variantStock } from '../db.js';
import { enrolAndSignIn } from './auth.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/*
 * Stock: receive a delivery, a refused removal, a stock count that puts the level back, the
 * history, and the alert level.
 */

const SKU = 'MKUP-002-01';
const run = String(Date.now()).slice(-7);
const email = `stock-${run}${STAFF_DOMAIN}`;
const password = 'granite harbour candle 64';
let originalThreshold: number | null = null;

const shown = (locator: Locator) => locator.filter({ visible: true }).first();

async function withDb<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** Undo every stock change this run's staff made (should the test stop halfway). */
async function revertOwnStockChanges(): Promise<void> {
  await withDb(async (client) => {
    await client.query('BEGIN');
    const staff = `SELECT id FROM staff_users WHERE email = $1`;
    await client.query(
      `UPDATE inventory_items i SET on_hand = i.on_hand - t.delta, version = version + 1
         FROM (SELECT variant_id, sum(delta)::int AS delta FROM inventory_movements
                WHERE actor_staff_id IN (${staff}) GROUP BY variant_id) t
        WHERE i.variant_id = t.variant_id`,
      [email],
    );
    await client.query(`DELETE FROM inventory_movements WHERE actor_staff_id IN (${staff})`, [
      email,
    ]);
    if (originalThreshold !== null) {
      await client.query(
        `UPDATE inventory_items SET low_stock_threshold = $1
          WHERE variant_id = (SELECT id FROM product_variants WHERE sku = $2)`,
        [originalThreshold, SKU],
      );
    }
    await client.query('COMMIT');
  });
}

test.beforeAll(async () => {
  await cleanupStaff();
  createStaff(email, 'Stock Keeper', password);
  originalThreshold = await withDb(
    async (client) =>
      (
        await client.query<{ low_stock_threshold: number }>(
          `SELECT i.low_stock_threshold FROM inventory_items i
             JOIN product_variants v ON v.id = i.variant_id WHERE v.sku = $1`,
          [SKU],
        )
      ).rows[0]?.low_stock_threshold ?? null,
  );
});
test.afterAll(async () => {
  await revertOwnStockChanges();
  await cleanupStaff();
});

test('receive stock, count it back, see the history', async ({ page }) => {
  const before = await variantStock(SKU);
  await enrolAndSignIn(page, email, password);
  await page
    .getByRole('navigation', { name: 'Admin sections' })
    .getByRole('link', { name: 'Stock' })
    .first()
    .click();
  await shown(page.getByRole('searchbox')).fill(SKU);
  await shown(page.getByRole('button', { name: 'Search' })).click();
  await expect(page).toHaveURL(new RegExp(`q=${SKU}`));

  // A delivery of 5.
  await shown(page.getByRole('button', { name: `Adjust stock of ${SKU}` })).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Units/).fill('5');
  await expect(
    dialog.getByText(`${String(before.onHand)} → ${String(before.onHand + 5)} in stock.`),
  ).toBeVisible();
  await dialog.getByLabel('Reference').fill('INV-E2E-7');
  await dialog.getByRole('button', { name: 'Save stock' }).click();
  await expect(
    shown(page.getByText(`${SKU}: ${String(before.onHand + 5)} in stock (+5).`)),
  ).toBeVisible();
  expect((await variantStock(SKU)).onHand).toBe(before.onHand + 5);

  // Removing more than is on the shelf is refused, and the typed amount stays.
  await shown(page.getByRole('button', { name: `Adjust stock of ${SKU}` })).click();
  await dialog.getByText('Remove', { exact: true }).click();
  await dialog.getByLabel(/^Units/).fill('100000');
  await dialog.getByRole('button', { name: 'Save stock' }).click();
  await expect(dialog.getByText(/has only \d+ in stock/)).toBeVisible();
  await expect(dialog.getByLabel(/^Units/)).toHaveValue('100000');
  await dialog.getByRole('button', { name: 'Back' }).click();

  // A stock count puts it back to where it was.
  await shown(page.getByRole('button', { name: 'Stock count' })).click();
  await shown(page.getByLabel(`Counted units of ${SKU}`)).fill(String(before.onHand));
  await shown(page.getByRole('button', { name: 'Save counts' })).click();
  await expect(shown(page.getByText('Saved 1 count.'))).toBeVisible();
  expect((await variantStock(SKU)).onHand).toBe(before.onHand);

  // Alert level.
  await shown(page.getByRole('button', { name: `Stock settings of ${SKU}` })).click();
  await dialog.getByLabel(/^Low-stock alert at/).fill('4');
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(shown(page.getByText('Stock settings saved.'))).toBeVisible();

  // History: newest first, with reasons, reference and who.
  await shown(page.getByRole('link', { name: `History of ${SKU}` })).click();
  await expect(shown(page.getByRole('heading', { name: SKU }))).toBeVisible();
  const history = shown(page.getByRole('list').filter({ hasText: 'New stock arrived' }));
  await expect(history.getByRole('listitem').first()).toContainText('Stock count correction');
  await expect(history.getByRole('listitem').first()).toContainText('−5');
  await expect(history).toContainText('INV-E2E-7');
  await expect(history).toContainText('Stock Keeper');
  await expect(shown(page.getByText('Alert at'))).toBeVisible();
});
