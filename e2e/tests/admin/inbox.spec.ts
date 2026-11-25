import { readFile } from 'node:fs/promises';

import { expect, type Locator, test } from '@playwright/test';
import pg from 'pg';

import { enrolAndSignIn } from './auth.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/*
 * Inbox and newsletter: a new contact message is read by opening it, gets an internal note, is
 * archived, brought back and marked unread; subscribers are listed by status and downloaded as
 * CSV (the export is audited). Test messages and subscribers are written straight to the
 * database (the shop's per-visitor limits don't apply) and removed afterwards.
 */

const run = String(Date.now()).slice(-7);
const email = `inbox-${run}${STAFF_DOMAIN}`;
const password = 'amber trellis comet 39';
const SENDER = `E2E ${run} Sana`;
const SUBJECT = `E2E ${run} parcel question`;
const SUBSCRIBED = `e2e-${run}-in@example.com`;
const LEFT = `e2e-${run}-out@example.com`;

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

const message = () =>
  withDb(
    async (client) =>
      (
        await client.query<{ status: string; staff_note: string | null }>(
          'SELECT status, staff_note FROM contact_messages WHERE name = $1',
          [SENDER],
        )
      ).rows[0],
  );

test.beforeAll(async () => {
  await cleanupStaff();
  createStaff(email, 'Support Agent', password);
  await withDb(async (client) => {
    await client.query(
      `INSERT INTO contact_messages (id, name, email, phone, subject, topic, order_number, message,
                                     created_at, updated_at)
       VALUES (uuidv7(), $1, 'sana@example.com', '+923001234567', $2, 'ORDER', 'AS-260101-ABCDE',
               'My parcel has not arrived yet. Can you check where it is?', now(), now())`,
      [SENDER, SUBJECT],
    );
    await client.query(
      `INSERT INTO newsletter_subscribers (id, email, status, source, unsubscribed_at)
       VALUES (uuidv7(), $1, 'SUBSCRIBED', 'footer', NULL),
              (uuidv7(), $2, 'UNSUBSCRIBED', 'checkout', now())`,
      [SUBSCRIBED, LEFT],
    );
  });
});
test.afterAll(async () => {
  await withDb(async (client) => {
    await client.query('DELETE FROM contact_messages WHERE name = $1', [SENDER]);
    await client.query('DELETE FROM newsletter_subscribers WHERE email LIKE $1', [`e2e-${run}-%`]);
  });
  await cleanupStaff();
});

test('read, note, archive and restore a message; list and export subscribers', async ({ page }) => {
  await enrolAndSignIn(page, email, password);
  const nav = page.getByRole('navigation', { name: 'Admin sections' });
  await nav.getByRole('link', { name: 'Inbox' }).first().click();

  // New: found by the sender's name; opening it marks it read.
  await shown(page.getByRole('searchbox', { name: 'Search' })).fill(SENDER);
  await shown(page.getByRole('button', { name: 'Apply' })).click();
  await shown(page.getByRole('link', { name: SUBJECT })).click();
  await expect(shown(page.getByRole('heading', { name: SUBJECT, level: 1 }))).toBeVisible();
  await expect.poll(async () => (await message())?.status).toBe('READ');

  // Reply links go to the sender; the order number doesn't match an order.
  await expect(shown(page.getByRole('link', { name: 'Reply by email' }))).toHaveAttribute(
    'href',
    /^mailto:sana@example\.com\?subject=Re%3A/,
  );
  await expect(shown(page.getByRole('link', { name: 'WhatsApp' }))).toHaveAttribute(
    'href',
    'https://wa.me/923001234567',
  );
  await expect(shown(page.getByText(/No order has this number/))).toBeVisible();

  // Internal note.
  await shown(page.getByLabel('Internal note')).fill('Called her, courier delayed by rain.');
  await shown(page.getByRole('button', { name: 'Save note' })).click();
  await expect
    .poll(async () => (await message())?.staff_note)
    .toBe('Called her, courier delayed by rain.');
  await expect(shown(page.getByText(/Last changed by Support Agent/))).toBeVisible();

  // Archive, back to the inbox, unread again.
  await shown(page.getByRole('button', { name: 'Archive' })).click();
  await expect.poll(async () => (await message())?.status).toBe('ARCHIVED');
  await shown(page.getByRole('button', { name: 'Move back to inbox' })).click();
  await expect.poll(async () => (await message())?.status).toBe('READ');
  await shown(page.getByRole('button', { name: 'Mark as unread' })).click();
  await expect.poll(async () => (await message())?.status).toBe('NEW');

  // Newsletter: each list holds its own people.
  await nav.getByRole('link', { name: 'Newsletter' }).first().click();
  await shown(page.getByRole('searchbox', { name: 'Search by email' })).fill(`e2e-${run}`);
  await shown(page.getByRole('button', { name: 'Search' })).click();
  await expect(shown(page.getByRole('cell', { name: SUBSCRIBED }))).toBeVisible();
  await expect(page.getByRole('cell', { name: LEFT })).toHaveCount(0);
  await shown(page.getByRole('link', { name: /^Unsubscribed/ })).click();
  await expect(shown(page.getByRole('cell', { name: LEFT }))).toBeVisible();

  // CSV of the subscribed list: downloaded through the admin, recorded in the audit log.
  await shown(page.getByRole('link', { name: /^Subscribed/ })).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    shown(page.getByRole('link', { name: 'Download subscribers (CSV)' })).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^subscribers-subscribed-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile((await download.path()) ?? '', 'utf8');
  expect(csv.split('\r\n')[0]).toBe('email,status,source,consent_at,unsubscribed_at');
  expect(csv).toContain(`${SUBSCRIBED},SUBSCRIBED,footer,`);
  expect(csv).not.toContain(LEFT);
  const audited = await withDb(
    async (client) =>
      (
        await client.query(
          `SELECT 1 FROM audit_logs a JOIN staff_users s ON s.id = a.actor_staff_id
            WHERE a.action = 'newsletter.export' AND s.email = $1`,
          [email],
        )
      ).rowCount,
  );
  expect(audited).toBe(1);
});
