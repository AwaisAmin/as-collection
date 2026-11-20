import { type Cookie, expect, type Locator, type Page, test } from '@playwright/test';
import pg from 'pg';

import { enrolAndSignIn } from './auth.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/*
 * Attributes: create with values, add a coloured value, reorder, rename, delete a value, change
 * settings, delete. Collections: an automatic one checked with a preview, a hand-picked one with
 * products and a schedule, reorder, delete.
 */

const run = String(Date.now()).slice(-7);
const email = `merch-${run}${STAFF_DOMAIN}`;
const password = 'saffron window harbour 52';
const ATTRIBUTE = `E2E Season ${run}`;
const AUTO = `E2E Edit ${run}`;
const PICKS = `E2E Picks ${run}`;
let session: Cookie | undefined;
let positions: { id: string; position: number }[] = [];

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

async function cleanupMerchandising(): Promise<void> {
  await withDb(async (client) => {
    await client.query(`DELETE FROM collections WHERE name LIKE 'E2E %'`);
    await client.query(`DELETE FROM attributes WHERE name LIKE 'E2E Season %'`);
    for (const { id, position } of positions) {
      await client.query('UPDATE collections SET position = $2 WHERE id = $1', [id, position]);
    }
  });
}

async function signedIn(page: Page): Promise<void> {
  if (session) {
    await page.context().addCookies([session]);
    return;
  }
  await enrolAndSignIn(page, email, password);
  session = (await page.context().cookies()).find((c) => /as_admin$/.test(c.name));
}

const collectionNames = (page: Page) =>
  shown(page.getByTestId('collection-list'))
    .locator(':scope > li a[href^="/collections/"]')
    .allTextContents();

test.beforeAll(async () => {
  positions = await withDb(
    async (client) =>
      (await client.query<{ id: string; position: number }>('SELECT id, position FROM collections'))
        .rows,
  );
  await cleanupMerchandising();
  await cleanupStaff();
  createStaff(email, 'Merchandiser', password);
});
test.afterAll(async () => {
  await cleanupMerchandising();
  await cleanupStaff();
});

test('build an attribute with values, then retire it', async ({ page }) => {
  await signedIn(page);
  await page.goto('/attributes');
  await shown(page.getByRole('link', { name: 'New attribute' })).click();
  await shown(page.getByLabel(/^Name/)).fill(ATTRIBUTE);
  await shown(page.getByLabel(/^Values/)).fill('Summer\nWinter');
  await shown(page.getByRole('button', { name: 'Create attribute' })).click();
  await expect(page).toHaveURL(/\/attributes\/[0-9a-f-]{36}\?created=1/);
  await expect(shown(page.getByText('Attribute created.'))).toBeVisible();

  const values = shown(page.getByRole('heading', { name: 'Values' })).locator('xpath=../..');
  await expect(values.getByText('Summer', { exact: true })).toBeVisible();
  await expect(values.getByText('Winter', { exact: true })).toBeVisible();

  // A coloured value.
  await values.getByRole('button', { name: 'Add value' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Label/).fill('Spring');
  await dialog.getByRole('textbox', { name: /^Swatch colour/ }).fill('#88cc44');
  await dialog.getByRole('button', { name: 'Add value' }).click();
  await expect(shown(page.getByText('Added “Spring”.'))).toBeVisible();

  // Move it to the top (two places up).
  await values.getByRole('button', { name: 'Move Spring up' }).click();
  await expect(values.getByRole('button', { name: 'Move Spring up' })).toBeEnabled();
  await values.getByRole('button', { name: 'Move Spring up' }).click();
  await expect(values.getByRole('button', { name: 'Move Spring up' })).toBeDisabled();

  // Rename one, delete another (unused).
  await values.getByRole('button', { name: 'Edit Summer' }).click();
  await dialog.getByLabel(/^Label/).fill('High summer');
  await dialog.getByRole('button', { name: 'Save value' }).click();
  await expect(shown(page.getByText('Value saved.'))).toBeVisible();
  await values.getByRole('button', { name: 'Delete Winter' }).click();
  await expect(shown(page.getByText('Value deleted.'))).toBeVisible();
  await expect(values.getByRole('listitem')).toHaveCount(2);

  // Settings, then delete it.
  await shown(page.getByLabel('Shop filter')).uncheck();
  await shown(page.getByRole('button', { name: 'Save attribute' })).click();
  await expect(shown(page.getByText('Attribute saved.'))).toBeVisible();
  await expect(shown(page.getByLabel('Shop filter'))).not.toBeChecked();
  await shown(page.getByRole('button', { name: 'Delete attribute' })).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete attribute' }).click();
  await expect(page).toHaveURL(/\/attributes\?deleted=1/);
});

test('automatic and hand-picked collections', async ({ page }) => {
  await signedIn(page);

  // Automatic: in-stock products, checked with a preview before saving.
  await page.goto('/collections/new');
  await shown(page.getByLabel(/^Name/)).fill(AUTO);
  await shown(page.getByText('Automatic', { exact: true })).click();
  const rule = shown(page.getByRole('listitem', { name: 'Rule 1' }));
  await rule.getByLabel('Condition').selectOption('inStock');
  await shown(page.getByRole('button', { name: 'Preview matches' })).click();
  await expect(shown(page.getByText(/^\d+ live products? match right now\./))).toBeVisible();
  await shown(page.getByRole('button', { name: 'Create collection' })).click();
  await expect(shown(page.getByText('Collection created.'))).toBeVisible();
  await expect(shown(page.getByText('Live', { exact: true }))).toBeVisible();

  // Hand-picked: two products, reordered, starting tomorrow.
  await page.goto('/collections/new');
  await shown(page.getByLabel(/^Name/)).fill(PICKS);
  await shown(page.getByRole('button', { name: 'Create collection' })).click();
  await expect(shown(page.getByText('Collection created.'))).toBeVisible();
  await shown(page.getByRole('button', { name: 'Add products' })).click();
  const picker = page.getByRole('dialog', { name: 'Add products' });
  await picker.getByRole('searchbox').fill('kurta');
  await picker.getByRole('searchbox').press('Enter');
  // Only search results (the A–Z list shown first is replaced).
  const adds = picker.getByRole('button', { name: /^Add .*kurta/i });
  await expect(adds.first()).toBeVisible();
  const first = ((await adds.nth(0).getAttribute('aria-label')) ?? '').replace(/^Add /, '');
  const second = ((await adds.nth(1).getAttribute('aria-label')) ?? '').replace(/^Add /, '');
  await adds.nth(0).click();
  await picker.getByRole('button', { name: `Add ${second}` }).click();
  await picker.getByRole('button', { name: 'Done' }).click();
  await shown(page.getByRole('button', { name: `Move ${first} down` })).click();
  await shown(page.getByRole('button', { name: 'Save products' })).click();
  await expect(shown(page.getByText('Products saved.'))).toBeVisible();
  await expect(shown(page.getByText('2 products'))).toBeVisible();

  const tomorrow = new Date(Date.now() + 36 * 3600_000).toISOString().slice(0, 10);
  await shown(page.getByLabel(/^Starts/)).fill(`${tomorrow}T09:00`);
  await shown(page.getByRole('button', { name: 'Save collection' })).click();
  await expect(shown(page.getByText('Collection saved.'))).toBeVisible();
  await expect(shown(page.getByText('Scheduled', { exact: true }))).toBeVisible();
  const picked = withDb(async (client) =>
    (
      await client.query<{ name: string }>(
        `SELECT p.name FROM collection_products cp
             JOIN collections c ON c.id = cp.collection_id JOIN products p ON p.id = cp.product_id
            WHERE c.name = $1 ORDER BY cp.position`,
        [PICKS],
      )
    ).rows.map((r) => r.name),
  );
  expect(await picked).toEqual([second, first]);

  // Display order: the newest (last) moves up one place.
  await page.goto('/collections');
  await expect(shown(page.getByRole('link', { name: PICKS }))).toBeVisible();
  const before = await collectionNames(page);
  expect(before.at(-1)).toBe(PICKS);
  await shown(page.getByRole('button', { name: `Move ${PICKS} up` })).click();
  await expect
    .poll(() => collectionNames(page))
    .toEqual([...before.slice(0, -2), PICKS, before.at(-2)]);

  // Delete both.
  for (const name of [PICKS, AUTO]) {
    await page.goto('/collections');
    await shown(page.getByRole('link', { name, exact: true })).click();
    await shown(page.getByRole('button', { name: 'Delete collection' })).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete collection' }).click();
    await expect(page).toHaveURL(/\/collections\?deleted=1/);
  }
});
