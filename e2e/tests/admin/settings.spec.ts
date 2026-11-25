import { expect, type Locator, test } from '@playwright/test';
import pg from 'pg';

import { variantStock } from '../db.js';
import { enrolAndSignIn } from './auth.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/*
 * Store settings: a new delivery fee reaches the real checkout, the contact links are derived from
 * the number typed, a bad announcement link is refused, payment details are confirmed as real.
 * Every setting is put back as it was.
 */

const API = 'http://127.0.0.1:4100/api/v1';
const SKU = 'MKUP-002-01'; // Rs 2,490: below the free-delivery threshold
const run = String(Date.now()).slice(-7);
const email = `settings-${run}${STAFF_DOMAIN}`;
const password = 'harbour violet compass 63';
let snapshot: { key: string; value: unknown }[] = [];

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

const stored = (key: string) =>
  withDb(
    async (client) =>
      (
        await client.query<{ value: Record<string, unknown> }>(
          'SELECT value FROM settings WHERE key = $1',
          [key],
        )
      ).rows[0]?.value,
  );

async function restoreSettings(): Promise<void> {
  await withDb(async (client) => {
    for (const { key, value } of snapshot) {
      await client.query('UPDATE settings SET value = $2 WHERE key = $1', [
        key,
        JSON.stringify(value),
      ]);
    }
  });
}

test.beforeAll(async () => {
  snapshot = await withDb(
    async (client) =>
      (await client.query<{ key: string; value: unknown }>('SELECT key, value FROM settings')).rows,
  );
  await cleanupStaff();
  createStaff(email, 'Store Manager', password);
});
test.afterAll(async () => {
  await restoreSettings();
  await cleanupStaff();
});

test('settings reach the shop and checkout', async ({ page, request }) => {
  await enrolAndSignIn(page, email, password);
  await page
    .getByRole('navigation', { name: 'Admin sections' })
    .getByRole('link', { name: 'Settings' })
    .first()
    .click();

  // Delivery fee: checkout charges the new one straight away.
  const delivery = shown(page.getByRole('region', { name: 'Delivery and returns' }));
  await delivery.getByLabel(/^Delivery fee/).fill('300');
  await delivery.getByRole('button', { name: 'Save delivery and returns' }).click();
  await expect(shown(page.getByText(/^Saved\./))).toBeVisible();
  const { variantId } = await variantStock(SKU);
  await expect
    .poll(async () => {
      const quote = await request.post(`${API}/checkout/quote`, {
        data: { lines: [{ variantId, quantity: 1 }] },
      });
      return ((await quote.json()) as { shippingMinor: number }).shippingMinor;
    })
    .toBe(30_000);

  // Contact: a wrong number is refused; WhatsApp follows the phone when left empty.
  const contact = shown(page.getByRole('region', { name: 'Contact' }));
  await contact.getByLabel(/^Phone/).fill('12345');
  await contact.getByRole('button', { name: 'Save contact' }).click();
  await expect(contact.getByText(/Enter a Pakistani mobile number/)).toBeVisible();
  await contact.getByLabel(/^Phone/).fill('0300 1234567');
  await contact.getByLabel(/^WhatsApp/).fill('');
  await contact.getByRole('button', { name: 'Save contact' }).click();
  // Saved once the card shows who changed it (the button is also disabled while saving).
  await expect(contact.getByText(/by Store Manager/)).toBeVisible();
  expect(await stored('store.contact')).toMatchObject({
    phone: '0300-1234567',
    phoneHref: 'tel:+923001234567',
    whatsappHref: 'https://wa.me/923001234567',
  });

  // Announcement bar: the shop's link rules apply.
  const bar = shown(page.getByRole('region', { name: 'Announcement bar' }));
  await bar.getByRole('button', { name: 'Add a message' }).click();
  const message = bar.getByRole('listitem').last();
  await message.getByLabel(/text$/).fill(`E2E ${run} sale`);
  await message.getByLabel(/link$/).fill('javascript:alert(1)');
  await bar.getByRole('button', { name: 'Save announcement bar' }).click();
  await expect(bar.getByText(/Use a site path/)).toBeVisible();
  await message.getByLabel(/link$/).fill('/shop?sale=1');
  await bar.getByRole('button', { name: 'Save announcement bar' }).click();
  // Saved once the card shows who changed it (the button is also disabled while saving).
  await expect(bar.getByText(/by Store Manager/)).toBeVisible();
  const announcements = (await stored('announcements')) as unknown as { text: string }[];
  expect(announcements.at(-1)).toMatchObject({ text: `E2E ${run} sale`, href: '/shop?sale=1' });

  // Payment accounts: confirmed as the real ones.
  const payments = shown(page.getByRole('region', { name: 'Payment accounts' }));
  await expect(payments.getByText(/still the sample details/)).toBeVisible();
  await payments.getByLabel('Bank transfer line 3 value').fill('1234-5678901234');
  await payments.getByLabel('These are the real accounts').check();
  // Ticking the box already hides the warning.
  await expect(payments.getByText(/still the sample details/)).toBeHidden();
  await payments.getByRole('button', { name: 'Save payment accounts' }).click();
  // Saved once the card shows who changed it (the button is also disabled while saving).
  await expect(payments.getByText(/by Store Manager/)).toBeVisible();
  const accounts = await stored('payments.transfer-accounts');
  expect(accounts).toMatchObject({ isPlaceholder: false });
  expect(JSON.stringify(accounts)).toContain('1234-5678901234');
});
