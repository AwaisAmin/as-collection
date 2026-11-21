import { expect, type Locator, test } from '@playwright/test';
import pg from 'pg';

import { enrolAndSignIn } from './auth.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/*
 * The home page editor: add a product carousel, fix a rejected link, move it, hide it, remove it.
 * The home page's own sections are put back exactly as they were.
 */

const run = String(Date.now()).slice(-7);
const email = `pages-${run}${STAFF_DOMAIN}`;
const password = 'cobalt meadow lantern 81';
const TITLE = `E2E Picks ${run}`;
let snapshot: { id: string; position: number; is_visible: boolean }[] = [];

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

async function restoreHome(): Promise<void> {
  await withDb(async (client) => {
    await client.query(`DELETE FROM page_sections WHERE settings->>'title' LIKE 'E2E %'`);
    for (const s of snapshot) {
      await client.query('UPDATE page_sections SET position = $2, is_visible = $3 WHERE id = $1', [
        s.id,
        s.position,
        s.is_visible,
      ]);
    }
  });
}

test.beforeAll(async () => {
  snapshot = await withDb(
    async (client) =>
      (
        await client.query<{ id: string; position: number; is_visible: boolean }>(
          `SELECT s.id, s.position, s.is_visible FROM page_sections s
             JOIN pages p ON p.id = s.page_id WHERE p.slug = 'home'`,
        )
      ).rows,
  );
  await restoreHome();
  await cleanupStaff();
  createStaff(email, 'Content Editor', password);
});
test.afterAll(async () => {
  await restoreHome();
  await cleanupStaff();
});

test('add, fix, move, hide and remove a home page section', async ({ page }) => {
  await enrolAndSignIn(page, email, password);
  await page
    .getByRole('navigation', { name: 'Admin sections' })
    .getByRole('link', { name: 'Pages' })
    .first()
    .click();
  await shown(page.getByRole('link', { name: /^Home/ })).click();
  const list = shown(page.getByTestId('section-list'));
  await expect(list.getByRole('listitem').first()).toBeVisible();
  const count = await list.getByRole('listitem').count();

  // Add a carousel of products on sale.
  await shown(page.getByRole('button', { name: 'Add section' })).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Type').selectOption('product-carousel');
  await dialog.getByLabel(/^Heading/).fill(TITLE);
  await dialog.getByLabel(/^Products/).selectOption('on-sale');
  await dialog.getByLabel(/^How many products/).fill('4');
  await dialog.getByRole('button', { name: 'Add section' }).click();
  await expect(shown(page.getByText('Section added.'))).toBeVisible();
  await expect(list.getByRole('listitem')).toHaveCount(count + 1);
  const added = list.getByRole('listitem').filter({ hasText: TITLE });
  await expect(added).toContainText('On sale · up to 4');
  await expect(added).toContainText('Live');

  // A link the shop won't accept is refused; a site path is fine.
  await added.getByRole('button', { name: 'Edit Product carousel' }).click();
  await dialog.getByLabel(/^Button text/).fill('Shop the sale');
  await dialog.getByLabel(/^Button link/).fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: 'Save section' }).click();
  await expect(dialog.getByText(/Use a site path/)).toBeVisible();
  await dialog.getByLabel(/^Button link/).fill('/shop?sale=1');
  await dialog.getByRole('button', { name: 'Save section' }).click();
  await expect(shown(page.getByText('Section saved.'))).toBeVisible();

  // Move it up one place (it was added last).
  const titles = () => list.getByRole('listitem').allTextContents();
  expect((await titles()).at(-1)).toContain(TITLE);
  await added.getByRole('button', { name: 'Move Product carousel up' }).click();
  await expect.poll(async () => (await titles()).at(-2) ?? '').toContain(TITLE);

  // Hide it, then remove it.
  await added.getByRole('button', { name: 'Hide Product carousel' }).click();
  await expect(shown(page.getByText('Section hidden.'))).toBeVisible();
  await expect(added).toContainText('Hidden');
  await added.getByRole('button', { name: 'Remove Product carousel' }).click();
  await added.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(shown(page.getByText('Section removed.'))).toBeVisible();
  await expect(list.getByRole('listitem')).toHaveCount(count);
});
