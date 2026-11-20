import { type Cookie, expect, type Locator, type Page, test } from '@playwright/test';
import pg from 'pg';

import { enrolAndSignIn } from './auth.js';
import { removeOwnImages } from './media-api.js';
import { randomPng } from './png.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/*
 * Categories: create one with a picture and a filter, add a subcategory, reorder, move the
 * subcategory to the top level, delete both. Brands: add, hide, delete.
 */

const run = String(Date.now()).slice(-7);
const email = `taxonomy-${run}${STAFF_DOMAIN}`;
const password = 'quartz lantern meadow 19';
const STAFF_NAME = 'Catalog Editor';
const CATEGORY = `E2E Cat ${run}`;
const SUB = `E2E Sub ${run}`;
const BRAND = `E2E Brand ${run}`;
let token = '';
/** The first test's session, reused by the second (a new sign-in would need a fresh code). */
let session: Cookie | undefined;
let topLevel: { id: string; position: number }[] = [];

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

async function cleanupTaxonomy(): Promise<void> {
  await withDb(async (client) => {
    // Children first (a category with subcategories can't go).
    await client.query(`DELETE FROM categories WHERE name LIKE 'E2E Sub %'`);
    await client.query(`DELETE FROM categories WHERE name LIKE 'E2E Cat %'`);
    await client.query(`DELETE FROM brands WHERE name LIKE 'E2E Brand %'`);
    for (const { id, position } of topLevel) {
      await client.query('UPDATE categories SET position = $2 WHERE id = $1', [id, position]);
    }
  });
}

async function saveSession(page: Page): Promise<void> {
  session = (await page.context().cookies()).find((c) => /as_admin$/.test(c.name));
  token = session?.value ?? '';
}

/** The names of the top-level categories, in order, as the tree shows them. */
async function topLevelNames(page: Page): Promise<string[]> {
  const rows = shown(page.getByTestId('category-tree')).locator(':scope > ul > li > div');
  return rows.locator('a[href^="/categories/"]:not([href*="new"])').allTextContents();
}

test.beforeAll(async () => {
  topLevel = await withDb(
    async (client) =>
      (
        await client.query<{ id: string; position: number }>(
          'SELECT id, position FROM categories WHERE parent_id IS NULL',
        )
      ).rows,
  );
  await cleanupTaxonomy();
  await cleanupStaff();
  createStaff(email, STAFF_NAME, password);
});
test.afterAll(async () => {
  await cleanupTaxonomy();
  await removeOwnImages(token, STAFF_NAME);
  await cleanupStaff();
});

test('build, reorder, move and delete categories', async ({ page }) => {
  await enrolAndSignIn(page, email, password);
  await saveSession(page);
  await page
    .getByRole('navigation', { name: 'Admin sections' })
    .getByRole('link', { name: 'Categories' })
    .first()
    .click();
  await expect(shown(page.getByRole('link', { name: 'Makeup', exact: true }))).toBeVisible();

  // New top-level category with a picture and one filter.
  await shown(page.getByRole('link', { name: 'New category' })).click();
  await shown(page.getByLabel(/^Name/)).fill(CATEGORY);
  await shown(page.getByLabel(/^Small heading/)).fill('New season');
  await shown(page.getByRole('button', { name: 'Choose image' })).click();
  const picker = page.getByRole('dialog', { name: 'Choose image' });
  await picker.getByTestId('image-upload-input').setInputFiles({
    name: `category-${run}.png`,
    mimeType: 'image/png',
    buffer: randomPng(),
  });
  await expect(picker.getByText('1 selected')).toBeVisible({ timeout: 20_000 });
  await picker.getByRole('button', { name: 'Use this image' }).click();
  await expect(shown(page.getByRole('button', { name: 'Change image' }))).toBeVisible();
  const filters = shown(page.getByRole('heading', { name: 'Filters' })).locator('xpath=../..');
  await filters.getByRole('checkbox').first().check();
  await shown(page.getByRole('button', { name: 'Create category' })).click();
  await expect(page).toHaveURL(/\/categories\/[0-9a-f-]{36}\?created=1/);
  await expect(shown(page.getByText('Category created.'))).toBeVisible();
  await expect(shown(page.getByText('Top level'))).toBeVisible();

  // A subcategory from the tree's "+".
  await page.goto('/categories');
  await shown(page.getByRole('link', { name: `Add a subcategory to ${CATEGORY}` })).click();
  await expect(shown(page.getByText(`Inside ${CATEGORY}`))).toBeVisible();
  await shown(page.getByLabel(/^Name/)).fill(SUB);
  await shown(page.getByRole('button', { name: 'Create category' })).click();
  await expect(shown(page.getByText('Category created.'))).toBeVisible();
  await expect(shown(page.getByText(`${CATEGORY} › ${SUB}`))).toBeVisible();

  // Reorder: the new category moves up one place.
  await page.goto('/categories');
  await expect(shown(page.getByRole('link', { name: CATEGORY, exact: true }))).toBeVisible();
  const before = await topLevelNames(page);
  expect(before.at(-1)).toBe(CATEGORY);
  await shown(page.getByRole('button', { name: `Move ${CATEGORY} up` })).click();
  await expect
    .poll(() => topLevelNames(page))
    .toEqual([...before.slice(0, -2), CATEGORY, before.at(-2)]);

  // Move the subcategory to the top level.
  await shown(page.getByRole('link', { name: SUB, exact: true })).click();
  await shown(page.getByLabel('Parent')).selectOption('');
  await shown(page.getByRole('button', { name: 'Save category' })).click();
  await expect(shown(page.getByText('Category saved.'))).toBeVisible();
  await expect(shown(page.getByText('Top level'))).toBeVisible();

  // Both are empty now: delete them.
  for (const name of [SUB, CATEGORY]) {
    await page.goto('/categories');
    await shown(page.getByRole('link', { name, exact: true })).click();
    await shown(page.getByRole('button', { name: 'Delete category' })).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete category' }).click();
    await expect(page).toHaveURL(/\/categories\?deleted=1/);
  }
  await expect(page.getByRole('link', { name: CATEGORY, exact: true })).toHaveCount(0);
});

test('add, hide and delete a brand', async ({ page }) => {
  test.skip(!session, 'needs the session from the first test');
  if (session) await page.context().addCookies([session]);
  await page.goto('/brands');
  await shown(page.getByRole('button', { name: 'New brand' })).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Name/).fill(BRAND);
  await dialog.getByRole('button', { name: 'Add brand' }).click();
  await expect(shown(page.getByText('Brand added.'))).toBeVisible();
  await expect(shown(page.getByText(BRAND))).toBeVisible();

  await shown(page.getByRole('button', { name: `Edit ${BRAND}` })).click();
  await dialog.getByLabel('Shown in the shop').uncheck();
  await dialog.getByRole('button', { name: 'Save brand' }).click();
  await expect(shown(page.getByText('Brand saved.'))).toBeVisible();
  await expect(
    shown(page.getByRole('listitem').filter({ hasText: BRAND })).getByText('Hidden'),
  ).toBeVisible();

  await shown(page.getByRole('button', { name: `Delete ${BRAND}` })).click();
  await expect(shown(page.getByText('Brand deleted.'))).toBeVisible();
  await expect(page.getByText(BRAND)).toHaveCount(0);
});
