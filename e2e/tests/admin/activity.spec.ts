import { expect, type Locator, request as http, test } from '@playwright/test';
import pg from 'pg';

import { enrolAndSignIn } from './auth.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/*
 * Activity log: the sign-in and a role change made through the API appear with who did what,
 * filtered by area and person, linked to the record and to that record's own history. Filtering
 * by an area with an underscore (the inbox) works. The test role and log entries are removed.
 */

const API = 'http://127.0.0.1:4100/api/v1';
const run = String(Date.now()).slice(-7);
const email = `activity-${run}${STAFF_DOMAIN}`;
const password = 'ember glacier pocket 72';
const ROLE = `E2E ${run} Auditors`;

const shown = (locator: Locator) => locator.filter({ visible: true }).first();

test.beforeAll(async () => {
  await cleanupStaff();
  createStaff(email, 'Audit Owner', password);
});
test.afterAll(async () => {
  // Staff cleanup also purges their (append-only) log entries.
  await cleanupStaff();
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('DELETE FROM roles WHERE name = $1', [ROLE]);
  await client.end();
});

test('see who changed what, filter it and follow a record', async ({ page }) => {
  await enrolAndSignIn(page, email, password);
  const token = (await page.context().cookies()).find((c) => /as_admin$/.test(c.name))?.value;
  const api = await http.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${token ?? ''}` },
  });
  const created = await api.post(`${API}/admin/roles`, {
    data: { key: `e2e-${run}-auditors`, name: ROLE, permissions: ['audit.read'] },
  });
  expect(created.status()).toBe(201);
  const roleId = ((await created.json()) as { id: string }).id;
  await api.dispose();

  await page
    .getByRole('navigation', { name: 'Admin sections' })
    .getByRole('link', { name: 'Activity log' })
    .first()
    .click();

  // Their own sign-in, filtered by person.
  await shown(page.getByLabel('Who')).selectOption({ label: 'Audit Owner' });
  await shown(page.getByRole('button', { name: 'Apply' })).click();
  await expect(shown(page.getByText('signed in', { exact: true }))).toBeVisible();

  // The role change, filtered by area: linked to the role and to its own history.
  await shown(page.getByLabel('Area')).selectOption({ label: 'Roles' });
  await shown(page.getByRole('button', { name: 'Apply' })).click();
  const entry = shown(page.getByRole('listitem').filter({ hasText: 'created a role' }));
  await expect(entry).toContainText('Audit Owner');
  await expect(entry).toContainText(`name: ${ROLE}`);
  await expect(entry.getByRole('link', { name: 'Open' })).toHaveAttribute(
    'href',
    `/roles/${roleId}`,
  );
  await entry.getByRole('link', { name: 'History' }).click();
  await expect(shown(page.getByText('Showing one record’s history'))).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'created a role' })).toHaveCount(1);

  // Raw details are there for checking.
  await shown(page.getByText('Details', { exact: true })).click();
  await expect(shown(page.getByText('role.create', { exact: true }))).toBeVisible();

  // An area whose key has an underscore (the inbox) can be filtered too.
  await page.goto('/activity?area=contact_message');
  await expect(shown(page.getByText('Nothing matches'))).toBeVisible();

  // Opened again from a staff page, the filters show the new URL's choices (not the last ones).
  const nav = page.getByRole('navigation', { name: 'Admin sections' });
  await nav.getByRole('link', { name: 'Staff' }).first().click();
  await shown(page.getByRole('link', { name: 'Audit Owner' })).click();
  await shown(page.getByRole('link', { name: 'Their activity' })).click();
  await expect(page).toHaveURL(/actor=/);
  await expect(shown(page.getByLabel('Who'))).not.toHaveValue('');
  await expect(shown(page.getByLabel('Area'))).toHaveValue('');
});
