import { type Cookie, expect, type Locator, type Page, test } from '@playwright/test';
import pg from 'pg';

import { enrolAndSignIn } from './auth.js';
import { removeOwnImages } from './media-api.js';
import { randomPng } from './png.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/*
 * The home page editor: add a product carousel, fix a rejected link, move it, hide it, remove it;
 * then the visual editors (a shop-the-look hotspot placed on the photo, the sale banner, an
 * Instagram post uploaded from here). The home page's own sections are put back exactly.
 */

const run = String(Date.now()).slice(-7);
const email = `pages-${run}${STAFF_DOMAIN}`;
const password = 'cobalt meadow lantern 81';
const STAFF_NAME = 'Content Editor';
const TITLE = `E2E Picks ${run}`;
let snapshot: { id: string; position: number; is_visible: boolean; settings: unknown }[] = [];
/** The first test's session, reused by the second (a new sign-in would need a fresh code). */
let session: Cookie | undefined;

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
      await client.query(
        'UPDATE page_sections SET position = $2, is_visible = $3, settings = $4 WHERE id = $1',
        [s.id, s.position, s.is_visible, JSON.stringify(s.settings)],
      );
    }
  });
}

const sectionSettings = (type: string) =>
  withDb(
    async (client) =>
      (
        await client.query<{ settings: Record<string, unknown> }>(
          `SELECT s.settings FROM page_sections s JOIN pages p ON p.id = s.page_id
            WHERE p.slug = 'home' AND s.type = $1`,
          [type],
        )
      ).rows[0]?.settings ?? {},
  );

async function openHome(page: Page): Promise<Locator> {
  await page.goto('/pages');
  await shown(page.getByRole('link', { name: /^Home/ })).click();
  const list = shown(page.getByTestId('section-list'));
  await expect(list.getByRole('listitem').first()).toBeVisible();
  return list;
}

test.beforeAll(async () => {
  snapshot = await withDb(
    async (client) =>
      (
        await client.query<{
          id: string;
          position: number;
          is_visible: boolean;
          settings: unknown;
        }>(
          `SELECT s.id, s.position, s.is_visible, s.settings FROM page_sections s
             JOIN pages p ON p.id = s.page_id WHERE p.slug = 'home'`,
        )
      ).rows,
  );
  await restoreHome();
  await cleanupStaff();
  createStaff(email, STAFF_NAME, password);
});
test.afterAll(async () => {
  await restoreHome();
  await removeOwnImages(session?.value ?? '', STAFF_NAME);
  await cleanupStaff();
});

test('add, fix, move, hide and remove a home page section', async ({ page }) => {
  await enrolAndSignIn(page, email, password);
  session = (await page.context().cookies()).find((c) => /as_admin$/.test(c.name));
  await page
    .getByRole('navigation', { name: 'Admin sections' })
    .getByRole('link', { name: 'Pages' })
    .first()
    .click();
  const list = await openHome(page);
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

test('visual editors: a look hotspot, the sale banner and an Instagram post', async ({ page }) => {
  test.skip(!session, 'needs the session from the first test');
  if (session) await page.context().addCookies([session]);
  const list = await openHome(page);
  const dialog = page.getByRole('dialog', { name: /^Edit / });

  // Shop the look: a new product dot, placed by clicking the photo.
  const lookBefore = (await sectionSettings('shop-the-look')).look as {
    hotspots: { productSlug: string }[];
  };
  await list.getByRole('button', { name: 'Edit Shop the look' }).click();
  await expect(dialog.getByTestId('look-photo')).toBeVisible();
  await dialog.getByRole('button', { name: 'Add a product' }).click();
  const chooser = page.getByRole('dialog', { name: 'Choose a product' });
  await chooser.getByRole('searchbox').fill('kurta');
  await chooser.getByRole('searchbox').press('Enter');
  const option = chooser.getByRole('button', { name: /kurta/i }).first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(dialog.getByRole('status')).toContainText('Click on the photo');
  const photo = dialog.getByTestId('look-photo');
  const box = await photo.boundingBox();
  if (!box) throw new Error('photo not laid out');
  await photo.click({ position: { x: box.width * 0.2, y: box.height * 0.8 } });
  await dialog.getByRole('button', { name: 'Save section' }).click();
  // Closes only once saved (an earlier "saved" toast may still be showing).
  await expect(dialog).toBeHidden();
  const lookAfter = (await sectionSettings('shop-the-look')).look as {
    hotspots: { productSlug: string; x: number; y: number }[];
  };
  expect(lookAfter.hotspots).toHaveLength(lookBefore.hotspots.length + 1);
  const placed = lookAfter.hotspots.at(-1);
  expect(placed?.x).toBeGreaterThan(15);
  expect(placed?.x).toBeLessThan(25);
  expect(placed?.y).toBeGreaterThan(75);
  expect(placed?.y).toBeLessThan(85);

  // Sale banner: a new highlight; an empty title is refused by the shop's rules.
  await list.getByRole('button', { name: 'Edit Sale banner' }).click();
  await dialog.getByLabel(/^Highlight/).fill(`E2E ${run}: 30% off`);
  await dialog.getByLabel(/^Title/).fill('');
  await dialog.getByRole('button', { name: 'Save section' }).click();
  await expect(dialog.getByRole('alert').first()).toBeVisible();
  await dialog.getByLabel(/^Title/).fill('Festive Sale');
  await dialog.getByRole('button', { name: 'Save section' }).click();
  // Closes only once saved (an earlier "saved" toast may still be showing).
  await expect(dialog).toBeHidden();
  expect((await sectionSettings('sale-banner')).highlight).toBe(`E2E ${run}: 30% off`);

  // Instagram: a post uploaded from the editor, stored as a site path the shop serves.
  const postsBefore = ((await sectionSettings('instagram-gallery')).posts as unknown[]).length;
  await list.getByRole('button', { name: 'Edit Instagram gallery' }).click();
  await dialog.getByRole('button', { name: 'Add posts' }).click();
  const picker = page.getByRole('dialog', { name: 'Add posts' });
  await picker.getByTestId('image-upload-input').setInputFiles({
    name: `insta-${run}.png`,
    mimeType: 'image/png',
    buffer: randomPng(),
  });
  await expect(picker.getByText('1 selected')).toBeVisible({ timeout: 20_000 });
  await picker.getByRole('button', { name: 'Add posts' }).click();
  const newPost = dialog.getByRole('listitem', { name: `Post ${String(postsBefore + 1)}` });
  await newPost.getByLabel(/description$/).fill(`E2E post ${run}`);
  await dialog.getByRole('button', { name: 'Save section' }).click();
  // Closes only once saved (an earlier "saved" toast may still be showing).
  await expect(dialog).toBeHidden();
  const posts = (await sectionSettings('instagram-gallery')).posts as {
    image: { src: string; alt: string };
  }[];
  expect(posts).toHaveLength(postsBefore + 1);
  expect(posts.at(-1)?.image).toMatchObject({ alt: `E2E post ${run}` });
  expect(posts.at(-1)?.image.src).toMatch(/^(\/media\/|https:\/\/)/);

  // Put the gallery back before the upload is removed from the library (afterAll).
  await restoreHome();
});
