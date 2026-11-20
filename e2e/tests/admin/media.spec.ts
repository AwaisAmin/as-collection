import { expect, type Locator, type Page, test } from '@playwright/test';

import { enrolAndSignIn } from './auth.js';
import { removeOwnImages } from './media-api.js';
import { randomPng } from './png.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/* The image library: upload, describe, delete. */

const run = String(Date.now()).slice(-7);
const email = `media-${run}${STAFF_DOMAIN}`;
const password = 'linen compass meadow 28';
const STAFF_NAME = 'Image Curator';
let token = '';

const shown = (locator: Locator) => locator.filter({ visible: true }).first();

async function sessionToken(page: Page): Promise<string> {
  const cookie = (await page.context().cookies()).find((c) => /as_admin$/.test(c.name));
  return cookie?.value ?? '';
}

test.beforeAll(async () => {
  await cleanupStaff();
  createStaff(email, STAFF_NAME, password);
});
test.afterAll(async () => {
  await removeOwnImages(token, STAFF_NAME);
  await cleanupStaff();
});

test('upload an image to the library, describe it, delete it', async ({ page }) => {
  await enrolAndSignIn(page, email, password);
  token = await sessionToken(page);
  await page
    .getByRole('navigation', { name: 'Admin sections' })
    .getByRole('link', { name: 'Images' })
    .first()
    .click();
  await shown(page.getByRole('link', { name: 'Unused' })).click();
  await expect(page).toHaveURL(/unused=1/);
  await page.getByTestId('library-upload-input').setInputFiles({
    name: `swatch-${run}.png`,
    mimeType: 'image/png',
    buffer: randomPng(),
  });
  await expect(shown(page.getByText('Image uploaded.'))).toBeVisible({ timeout: 20_000 });

  // Newest first: the upload is the first tile.
  const tile = shown(page.getByRole('button', { name: /No description.*Unused/ }));
  await tile.click();
  const dialog = page.getByRole('dialog', { name: 'Image details' });
  await expect(dialog.getByText('Not used anywhere')).toBeVisible();
  await dialog.getByLabel(/^Description/).fill(`E2E swatch ${run}`);
  await dialog.getByRole('button', { name: 'Save description' }).click();
  await expect(shown(page.getByText('Description saved.'))).toBeVisible();

  await shown(page.getByRole('button', { name: new RegExp(`E2E swatch ${run}`) })).click();
  await dialog.getByRole('button', { name: 'Delete image' }).click();
  await dialog.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(shown(page.getByText('Image deleted.'))).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`E2E swatch ${run}`) })).toHaveCount(0);
});
