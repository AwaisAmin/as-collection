import {
  type APIRequestContext,
  expect,
  type Locator,
  request as http,
  test,
} from '@playwright/test';

import { enrolAndSignIn } from './auth.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/*
 * Menus: a footer link is refused with a bad address, added, moved, saved (the shop's menu shows
 * it), then hidden (the shop drops it). On the header menu an item is nested and taken out again
 * without saving. The footer is saved back through the API exactly as it was.
 */

const API = 'http://127.0.0.1:4100/api/v1';
const run = String(Date.now()).slice(-7);
const email = `menus-${run}${STAFF_DOMAIN}`;
const password = 'saffron harbour lantern 47';
const LINK = `E2E ${run}`;

interface MenuItem {
  label: string;
  url: string | null;
  openInNewTab: boolean;
  isVisible?: boolean;
  settings: unknown;
  children: MenuItem[];
}
interface Menu {
  name: string;
  updatedAt: string;
  items: MenuItem[];
}

let token = '';
let original: Menu | undefined;

const shown = (locator: Locator) => locator.filter({ visible: true }).first();

const asPayload = (items: MenuItem[]): MenuItem[] =>
  items.map(({ label, url, openInNewTab, isVisible, settings, children }) => ({
    label,
    url,
    openInNewTab,
    isVisible,
    settings,
    children: asPayload(children),
  }));

async function adminApi(): Promise<APIRequestContext> {
  return http.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
}

const shopFooter = async (request: APIRequestContext) =>
  ((await (await request.get(`${API}/content/menus/footer`)).json()) as Menu).items.map(
    (i) => i.label,
  );

test.beforeAll(async () => {
  await cleanupStaff();
  createStaff(email, 'Content Editor', password);
});
test.afterAll(async () => {
  if (token && original) {
    const api = await adminApi();
    try {
      const current = (await (await api.get(`${API}/admin/menus/footer`)).json()) as Menu;
      const put = await api.put(`${API}/admin/menus/footer`, {
        data: {
          name: original.name,
          items: asPayload(original.items),
          updatedAt: current.updatedAt,
        },
      });
      expect(put.status()).toBe(200);
    } finally {
      await api.dispose();
    }
  }
  await cleanupStaff();
});

test('edit the footer and nest header items', async ({ page, request }) => {
  await enrolAndSignIn(page, email, password);
  token = (await page.context().cookies()).find((c) => /as_admin$/.test(c.name))?.value ?? '';
  const api = await adminApi();
  original = (await (await api.get(`${API}/admin/menus/footer`)).json()) as Menu;
  await api.dispose();
  const before = original.items.map((i) => i.label);

  await page
    .getByRole('navigation', { name: 'Admin sections' })
    .getByRole('link', { name: 'Menus' })
    .first()
    .click();
  await shown(page.getByRole('link', { name: 'Footer links' })).click();
  await expect(shown(page.getByRole('heading', { name: 'Footer links', level: 1 }))).toBeVisible();

  // A bad address is refused in the dialog; a site path is accepted.
  await shown(page.getByRole('button', { name: 'Add a link' })).click();
  const dialog = page.getByRole('dialog', { name: 'Add a link' });
  await dialog.getByLabel(/^Name/).fill(LINK);
  await dialog.getByLabel(/^Link/).fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(dialog.getByText(/Use a site path/)).toBeVisible();
  await dialog.getByLabel(/^Link/).fill('/shop?sale=1');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(dialog).toBeHidden();

  // Last → one place up, then save: the shop's footer has it in that place.
  await shown(page.getByRole('button', { name: `Move “${LINK}” up` })).click();
  await shown(page.getByRole('button', { name: 'Save menu' })).click();
  await expect(shown(page.getByText('All changes saved'))).toBeVisible();
  const expected = [...before.slice(0, -1), LINK, ...before.slice(-1)];
  await expect.poll(() => shopFooter(request)).toEqual(expected);

  // Hidden: kept in the menu, gone from the shop.
  await shown(page.getByRole('button', { name: `Edit “${LINK}”` })).click();
  const edit = page.getByRole('dialog', { name: `Edit “${LINK}”` });
  await edit.getByLabel('Shown in the shop').uncheck();
  await edit.getByRole('button', { name: 'Done' }).click();
  await expect(shown(page.getByText('Hidden', { exact: true }))).toBeVisible();
  await shown(page.getByRole('button', { name: 'Save menu' })).click();
  await expect(shown(page.getByText('All changes saved'))).toBeVisible();
  await expect.poll(() => shopFooter(request)).toEqual(before);

  // Header menu: "About Us" goes under "Shop" and back out, then the edit is undone unsaved.
  await shown(page.getByRole('link', { name: 'Menus', exact: true })).click();
  await shown(page.getByRole('link', { name: 'Main navigation' })).click();
  const about = 'Move “About Us” under the item above';
  await shown(page.getByRole('button', { name: about })).click();
  const shop = shown(page.getByRole('listitem').filter({ hasText: /^Shop/ }));
  await expect(shop.getByRole('button', { name: 'Move “About Us” out a level' })).toBeEnabled();
  // Two levels at most: nothing can go under a sub-link.
  await expect(shop.getByRole('button', { name: /Add .* under “About Us”/ })).toHaveCount(0);
  await shop.getByRole('button', { name: 'Move “About Us” out a level' }).click();
  await shown(page.getByRole('button', { name: 'Move “About Us” up' })).click();
  await expect(shown(page.getByText('Unsaved changes'))).toBeVisible();
  await shown(page.getByRole('button', { name: 'Undo changes' })).click();
  await expect(shown(page.getByText('All changes saved'))).toBeVisible();
});
