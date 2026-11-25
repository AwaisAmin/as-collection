import { expect, type Locator, test } from '@playwright/test';
import pg from 'pg';

import { enrolAndSignIn } from './auth.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/*
 * Staff and roles: a role is created with two permissions, a staff member is added with it and a
 * temporary password, their password is reset and their access turned off and on, the role can't
 * be deleted while someone has it, then it is taken off them and deleted. Your own roles can't be
 * changed from your own page. Test staff and roles are removed afterwards.
 */

const run = String(Date.now()).slice(-7);
const email = `staff-${run}${STAFF_DOMAIN}`;
const password = 'lantern quarry violet 16';
const ROLE = `E2E ${run} Packers`;
const MEMBER = `E2E ${run} Bilal`;
const MEMBER_EMAIL = `bilal-${run}${STAFF_DOMAIN}`;

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

const member = () =>
  withDb(
    async (client) =>
      (
        await client.query<{ status: string; must_change_password: boolean; roles: string | null }>(
          `SELECT s.status, s.must_change_password,
                  (SELECT string_agg(r.name, ',') FROM staff_roles sr JOIN roles r ON r.id = sr.role_id
                    WHERE sr.staff_id = s.id) AS roles
             FROM staff_users s WHERE s.email = $1`,
          [MEMBER_EMAIL],
        )
      ).rows[0],
  );

const rolePermissions = () =>
  withDb(async (client) =>
    (
      await client.query<{ permission: string }>(
        `SELECT p.permission FROM role_permissions p JOIN roles r ON r.id = p.role_id
          WHERE r.name = $1 ORDER BY 1`,
        [ROLE],
      )
    ).rows.map((r) => r.permission),
  );

test.beforeAll(async () => {
  await cleanupStaff();
  createStaff(email, 'Store Owner', password);
});
test.afterAll(async () => {
  await cleanupStaff();
  await withDb((client) => client.query('DELETE FROM roles WHERE name LIKE $1', [`E2E ${run}%`]));
});

test('roles and staff: create, assign, reset, turn off, delete', async ({ page }) => {
  await enrolAndSignIn(page, email, password);
  const nav = page.getByRole('navigation', { name: 'Admin sections' });

  // A role with two order permissions.
  await nav.getByRole('link', { name: 'Roles' }).first().click();
  await shown(page.getByRole('link', { name: 'New role' })).click();
  await shown(page.getByLabel(/^Name/)).fill(ROLE);
  await expect(shown(page.getByLabel('Key'))).toHaveValue(`e2e-${run}-packers`);
  await shown(page.getByRole('button', { name: 'Create role' })).click();
  await expect(shown(page.getByText('Tick at least one permission.'))).toBeVisible();
  await shown(page.getByLabel('View orders and customer details on them')).check();
  await shown(page.getByLabel('Confirm, ship, deliver and cancel orders')).check();
  await shown(page.getByRole('button', { name: 'Create role' })).click();
  await expect(shown(page.getByText(/Role created/))).toBeVisible();
  expect(await rolePermissions()).toEqual(['orders.read', 'orders.write']);

  // A staff member with that role and a temporary password.
  await nav.getByRole('link', { name: 'Staff' }).first().click();
  await shown(page.getByRole('button', { name: 'Add staff member' })).click();
  const add = page.getByRole('dialog', { name: 'Add a staff member' });
  await add.getByLabel(/^Name/).fill(MEMBER);
  await add.getByLabel(/^Work email/).fill(MEMBER_EMAIL);
  await expect(add.getByLabel(/^Temporary password/)).toHaveValue(/^[\w]{4}(-[\w]{4}){3}$/);
  await add.getByRole('checkbox', { name: new RegExp(ROLE) }).check();
  await add.getByRole('button', { name: 'Add staff member' }).click();
  await expect(shown(page.getByRole('heading', { name: MEMBER, level: 1 }))).toBeVisible();
  await expect(shown(page.getByText(/Staff member added/))).toBeVisible();
  expect(await member()).toMatchObject({
    status: 'ACTIVE',
    must_change_password: true,
    roles: ROLE,
  });

  // Password reset, access off and back on.
  await shown(page.getByRole('button', { name: 'Reset password' })).click();
  const reset = page.getByRole('dialog', { name: 'Set a temporary password' });
  await reset.getByRole('button', { name: 'Set temporary password' }).click();
  await expect(reset).toBeHidden();
  await shown(page.getByRole('button', { name: 'Turn off access' })).click();
  await page
    .getByRole('dialog', { name: 'Turn off access' })
    .getByRole('button', { name: 'Turn off access' })
    .click();
  await expect.poll(async () => (await member())?.status).toBe('DISABLED');
  await shown(page.getByRole('button', { name: 'Turn access back on' })).click();
  await page
    .getByRole('dialog', { name: 'Turn access back on' })
    .getByRole('button', { name: 'Turn on' })
    .click();
  await expect.poll(async () => (await member())?.status).toBe('ACTIVE');

  // The role can't be deleted while Bilal has it.
  await nav.getByRole('link', { name: 'Roles' }).first().click();
  await shown(page.getByRole('link', { name: ROLE })).click();
  await expect(shown(page.getByText(/1 staff member has this role/))).toBeVisible();

  // Take it off him, then delete it.
  await nav.getByRole('link', { name: 'Staff' }).first().click();
  await shown(page.getByRole('link', { name: MEMBER })).click();
  await shown(page.getByRole('checkbox', { name: new RegExp(ROLE) })).uncheck();
  await shown(page.getByRole('button', { name: 'Save', exact: true })).click();
  await expect.poll(async () => (await member())?.roles ?? null).toBeNull();
  await nav.getByRole('link', { name: 'Roles' }).first().click();
  await shown(page.getByRole('link', { name: ROLE })).click();
  await shown(page.getByRole('button', { name: 'Delete role' })).click();
  await page
    .getByRole('dialog', { name: `Delete “${ROLE}”?` })
    .getByRole('button', { name: 'Delete role' })
    .click();
  await expect(shown(page.getByText('Role deleted.'))).toBeVisible();
  expect(await rolePermissions()).toEqual([]);

  // Your own access can only be changed by someone else.
  await nav.getByRole('link', { name: 'Staff' }).first().click();
  await shown(page.getByRole('link', { name: 'Store Owner' })).click();
  await expect(
    shown(page.getByText(/Ask another administrator to change your own access/)),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Turn off access' })).toHaveCount(0);
});
