import { randomUUID } from 'node:crypto';

import { type APIRequestContext, expect, type Locator, test } from '@playwright/test';

import { cleanupTestData, testPhone, variantStock } from '../db.js';
import { enrolAndSignIn } from './auth.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/*
 * A customer pays by bank transfer and uploads a screenshot; staff find the order in the
 * "Payments to check" queue, look at the screenshot, accept it, ship and deliver the order.
 */

const API = 'http://127.0.0.1:4100/api/v1';
const SKU = 'MKUP-002-01';
const email = `orders-${String(Date.now())}${STAFF_DOMAIN}`;
const password = 'copper kettle morning 77';
// A 1×1 PNG: the API checks the file's signature, not its size.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/** Next keeps the previous page mounted but hidden; assert on what is on screen. */
const shown = (locator: Locator) => locator.filter({ visible: true }).first();

async function placeTransferOrder(request: APIRequestContext, variantId: string) {
  const lines = [{ variantId, quantity: 1 }];
  const quote = await request.post(`${API}/checkout/quote`, { data: { lines } });
  expect(quote.ok()).toBe(true);
  const { totalMinor } = (await quote.json()) as { totalMinor: number };

  const placed = await request.post(`${API}/orders`, {
    headers: { 'Idempotency-Key': randomUUID() },
    data: {
      customer: { fullName: 'E2E Transfer Buyer', phone: testPhone(), email: '' },
      shipping: { line1: 'House 7, Street 2, Gulberg III', city: 'Lahore' },
      paymentMethod: 'BANK_TRANSFER',
      lines,
      expectedTotalMinor: totalMinor,
    },
  });
  expect(placed.status()).toBe(201);
  const { order, accessKey } = (await placed.json()) as {
    order: { number: string };
    accessKey: string;
  };

  const proof = await request.post(`${API}/orders/${order.number}/payment-proof`, {
    headers: { 'X-Order-Access-Key': accessKey },
    multipart: {
      file: { name: 'receipt.png', mimeType: 'image/png', buffer: PNG },
      reference: 'TXN-E2E-001',
      amountMinor: String(totalMinor),
    },
  });
  expect(proof.ok()).toBe(true);
  return order.number;
}

test.beforeAll(async () => {
  await cleanupTestData();
  await cleanupStaff();
  createStaff(email, 'Order Manager', password);
});
test.afterAll(async () => {
  await cleanupTestData();
  await cleanupStaff();
});

test('verify a transfer payment, then ship and deliver the order', async ({ page, request }) => {
  const before = await variantStock(SKU);
  const number = await placeTransferOrder(request, before.variantId);

  await enrolAndSignIn(page, email, password);
  await page
    .getByRole('navigation', { name: 'Admin sections' })
    .getByRole('link', { name: 'Orders' })
    .first()
    .click();
  await page.getByRole('link', { name: /Payments to check/ }).click();
  await shown(page.getByRole('link', { name: number })).click();

  await expect(page.getByRole('heading', { name: number })).toBeVisible();
  await expect(shown(page.getByText('Check payment'))).toBeVisible();

  // The screenshot is streamed through the admin (a real image, not a broken link).
  const screenshot = page.getByRole('img', { name: `Payment screenshot for ${number}` });
  await expect(screenshot).toBeVisible();
  await expect
    .poll(() => screenshot.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(shown(page.getByText('TXN-E2E-001'))).toBeVisible();

  // Accept → paid and confirmed.
  await page.getByRole('button', { name: 'Accept payment' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Accept payment' }).click();
  await expect(shown(page.getByText('Payment accepted. The order is marked paid.'))).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(shown(page.getByText('Paid', { exact: true }))).toBeVisible();
  await expect(shown(page.getByText('Confirmed', { exact: true }))).toBeVisible();

  // Ship: the courier is required.
  await page.getByRole('button', { name: 'Mark as shipped' }).click();
  await dialog.getByRole('button', { name: 'Mark as shipped' }).click();
  await expect(dialog.getByText('Enter the courier (e.g. TCS, Leopards).')).toBeVisible();
  await dialog.getByLabel('Courier').fill('TCS');
  await dialog.getByLabel('Tracking number').fill('TCS-778899');
  await dialog.getByRole('button', { name: 'Mark as shipped' }).click();
  await expect(shown(page.getByText('Marked as shipped.'))).toBeVisible();
  await expect(shown(page.getByText('TCS-778899'))).toBeVisible();

  // Shipping turns the reservation into a sale.
  const shipped = await variantStock(SKU);
  expect(shipped.onHand).toBe(before.onHand - 1);
  expect(shipped.reserved).toBe(before.reserved);

  await page.getByRole('button', { name: 'Mark as delivered' }).click();
  await dialog.getByRole('button', { name: 'Mark as delivered' }).click();
  await expect(shown(page.getByText('Marked as delivered.'))).toBeVisible();
  await expect(shown(page.getByText('Delivered', { exact: true }))).toBeVisible();

  // A note the customer can see.
  await page.getByLabel('Add a note').fill('Thank you for shopping with us!');
  await page.getByLabel(/Show to the customer/).check();
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(shown(page.getByText('Note added and shown to the customer.'))).toBeVisible();
  await expect(shown(page.getByText('Customer sees this'))).toBeVisible();

  // The order now sits in the delivered queue.
  await page.goto('/orders?view=delivered');
  await expect(shown(page.getByRole('link', { name: number }))).toBeVisible();
});
