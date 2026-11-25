import { randomBytes } from 'node:crypto';

import { expect, type Locator, test } from '@playwright/test';
import pg from 'pg';

import { EMAIL_DOMAIN, PHONE_PREFIX } from '../db.js';
import { enrolAndSignIn } from './auth.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/*
 * Customers: found by a mobile number typed the local way, profile with address and devices,
 * details and an internal note saved, an edit refused after someone else's change, the account
 * blocked (signed out everywhere) and unblocked. The test customer is written straight to the
 * database (with two signed-in devices) and removed afterwards.
 */

const run = String(Date.now()).slice(-7);
const email = `customers-${run}${STAFF_DOMAIN}`;
const password = 'meadow copper kite 24';
const PHONE = `${PHONE_PREFIX}${run}`; // +92396xxxxxxx
const LOCAL = `0396-${run}`;
const NAME = `E2E ${run} Hina`;
let customerId = '';

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

const customer = () =>
  withDb(
    async (client) =>
      (
        await client.query<{
          name: string;
          staff_note: string | null;
          status: string;
          live_sessions: string;
        }>(
          `SELECT name, staff_note, status,
                  (SELECT count(*) FROM customer_sessions s
                    WHERE s.customer_id = c.id AND s.revoked_at IS NULL) AS live_sessions
             FROM customers c WHERE id = $1`,
          [customerId],
        )
      ).rows[0],
  );

test.beforeAll(async () => {
  await cleanupStaff();
  createStaff(email, 'Support Lead', password);
  await withDb(async (client) => {
    customerId = (
      await client.query<{ id: string }>(
        `INSERT INTO customers (id, name, phone, email, phone_verified_at, updated_at)
         VALUES (uuidv7(), $1, $2, $3, now(), now()) RETURNING id`,
        [NAME, PHONE, `hina-${run}${EMAIL_DOMAIN}`],
      )
    ).rows[0]!.id;
    await client.query(
      `INSERT INTO addresses (id, customer_id, label, full_name, phone, line1, city, province,
                              is_default, updated_at)
       VALUES (uuidv7(), $1, 'Home', $2, $3, 'House 12, Street 4, Gulberg III', 'Lahore', 'Punjab',
               true, now())`,
      [customerId, NAME, PHONE],
    );
    for (let i = 0; i < 2; i += 1) {
      await client.query(
        `INSERT INTO customer_sessions (id, customer_id, token_hash, expires_at)
         VALUES (uuidv7(), $1, $2, now() + interval '7 days')`,
        [customerId, randomBytes(32).toString('hex')],
      );
    }
  });
});
test.afterAll(async () => {
  await withDb((client) => client.query('DELETE FROM customers WHERE id = $1', [customerId]));
  await cleanupStaff();
});

test('find, edit, block and unblock a customer', async ({ page }) => {
  await enrolAndSignIn(page, email, password);
  await page
    .getByRole('navigation', { name: 'Admin sections' })
    .getByRole('link', { name: 'Customers' })
    .first()
    .click();

  // Found by the number typed the local way.
  await shown(page.getByRole('searchbox', { name: 'Search customers' })).fill(LOCAL);
  await shown(page.getByRole('button', { name: 'Search' })).click();
  await shown(page.getByRole('link', { name: NAME })).click();
  await expect(shown(page.getByRole('heading', { name: NAME, level: 1 }))).toBeVisible();
  await expect(
    shown(page.getByText('House 12, Street 4, Gulberg III, Lahore, Punjab')),
  ).toBeVisible();
  const devices = shown(page.getByText('Signed in on')).locator('..');
  await expect(devices).toContainText('2');

  // Details and the internal note.
  await shown(page.getByLabel('Name')).fill(`${NAME} Malik`);
  await shown(page.getByLabel('Internal note')).fill('Prefers delivery after 5 pm.');
  await shown(page.getByRole('button', { name: 'Save customer' })).click();
  await expect(shown(page.getByRole('heading', { name: `${NAME} Malik`, level: 1 }))).toBeVisible();
  expect(await customer()).toMatchObject({
    name: `${NAME} Malik`,
    staff_note: 'Prefers delivery after 5 pm.',
  });

  // Someone else changes the customer meanwhile: this edit is refused, nothing overwritten.
  await withDb((client) =>
    client.query(`UPDATE customers SET updated_at = now() + interval '1 second' WHERE id = $1`, [
      customerId,
    ]),
  );
  await shown(page.getByLabel('Internal note')).fill('An outdated edit');
  await shown(page.getByRole('button', { name: 'Save customer' })).click();
  await expect(shown(page.getByText(/Someone else saved this customer/))).toBeVisible();
  expect((await customer())?.staff_note).toBe('Prefers delivery after 5 pm.');
  await page.reload();

  // Block: a reason is required; every device is signed out.
  await shown(page.getByRole('button', { name: 'Block account' })).click();
  const dialog = page.getByRole('dialog', { name: 'Block this account' });
  await dialog.getByRole('button', { name: 'Block account' }).click();
  await expect(dialog.getByText(/Say why in a few words/)).toBeVisible();
  await dialog.getByLabel(/^Reason/).fill('Repeated fake orders');
  await dialog.getByRole('button', { name: 'Block account' }).click();
  await expect(dialog).toBeHidden();
  await expect(shown(page.getByText(/signed out of 2 devices/))).toBeVisible();
  await expect(shown(page.getByText(/Repeated fake orders\. They can’t sign in\./))).toBeVisible();
  expect(await customer()).toMatchObject({ status: 'BLOCKED', live_sessions: '0' });

  // Listed under Blocked; unblocked again.
  await page.goto('/customers?status=BLOCKED');
  await expect(shown(page.getByRole('link', { name: `${NAME} Malik` }))).toBeVisible();
  await shown(page.getByRole('link', { name: `${NAME} Malik` })).click();
  await shown(page.getByRole('button', { name: 'Unblock account' })).click();
  await expect.poll(async () => (await customer())?.status).toBe('ACTIVE');
  await expect(shown(page.getByText(/They can sign in again/))).toBeVisible();
  await expect(shown(page.getByRole('button', { name: 'Block account' }))).toBeEnabled();
});
