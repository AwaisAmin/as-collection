import { expect, type Locator, type Page, test } from '@playwright/test';
import pg from 'pg';

import { enrolAndSignIn } from './auth.js';
import { cleanupStaff, createStaff, STAFF_DOMAIN } from './staff-db.js';

/*
 * Review moderation: two waiting reviews (written straight to the database, so the shop's
 * per-visitor limit doesn't apply). One is published (the product rating counts it), answered and
 * shown on the home page, then unpublished; the other is rejected with a reason and deleted.
 * Every test review is removed afterwards (the ratings follow by trigger).
 */

const API = 'http://127.0.0.1:4100/api/v1';
const SKU = 'MKUP-002-01';
const run = String(Date.now()).slice(-7);
const email = `reviews-${run}${STAFF_DOMAIN}`;
const password = 'velvet orchard signal 58';
const GOOD = `E2E ${run} lovely shade`;
const SPAM = `E2E ${run} cheap followers`;
let productId = '';

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

const ratingCount = () =>
  withDb(
    async (client) =>
      (
        await client.query<{ rating_count: number }>(
          'SELECT rating_count FROM products WHERE id = $1',
          [productId],
        )
      ).rows[0]?.rating_count ?? -1,
  );

const reviewCount = () =>
  withDb(async (client) =>
    Number(
      (
        await client.query<{ n: string }>('SELECT count(*) AS n FROM reviews WHERE title LIKE $1', [
          `E2E ${run}%`,
        ])
      ).rows[0]?.n,
    ),
  );

test.beforeAll(async () => {
  await cleanupStaff();
  createStaff(email, 'Review Moderator', password);
  await withDb(async (client) => {
    productId = (
      await client.query<{ product_id: string }>(
        'SELECT product_id FROM product_variants WHERE sku = $1',
        [SKU],
      )
    ).rows[0]!.product_id;
    for (const [title, rating, body] of [
      [SPAM, 1, 'Buy cheap followers at our site, best prices.'],
      [GOOD, 5, 'The colour is exactly as shown and lasts all day.'],
    ] as const) {
      await client.query(
        `INSERT INTO reviews (id, product_id, author_name, city, rating, title, body, status,
                              created_at, updated_at)
         VALUES (uuidv7(), $1, 'Ayesha', 'Lahore', $2, $3, $4, 'PENDING', now(), now())`,
        [productId, rating, title, body],
      );
    }
  });
});
test.afterAll(async () => {
  await withDb((client) =>
    client.query('DELETE FROM reviews WHERE title LIKE $1', [`E2E ${run}%`]),
  );
  await cleanupStaff();
});

/** The review card titled `title` in the list on screen. */
const card = (page: Page, title: string) =>
  shown(page.getByRole('region', { name: title, exact: true }));

async function openList(page: Page, tab: string): Promise<void> {
  const link = shown(page.getByRole('navigation', { name: 'Review lists' })).getByRole('link', {
    name: new RegExp(`^${tab}`),
  });
  await link.click();
  // Type only once the tab's page is in (text typed into the previous page would be lost).
  await expect(
    shown(page.getByRole('navigation', { name: 'Review lists' })).getByRole('link', {
      name: new RegExp(`^${tab}`),
    }),
  ).toHaveAttribute('aria-current', 'page');
  await shown(page.getByRole('searchbox', { name: 'Search' })).fill(`E2E ${run}`);
  await shown(page.getByRole('button', { name: 'Apply' })).click();
  await expect(page).toHaveURL(new RegExp(`q=E2E`));
}

test('publish, answer, feature, unpublish, reject and delete reviews', async ({
  page,
  request,
}) => {
  await enrolAndSignIn(page, email, password);
  await page
    .getByRole('navigation', { name: 'Admin sections' })
    .getByRole('link', { name: 'Reviews' })
    .first()
    .click();
  const countBefore = await ratingCount();

  // Both wait for a decision.
  await openList(page, 'Waiting');
  await expect(card(page, GOOD)).toBeVisible();
  await expect(card(page, SPAM)).toBeVisible();

  // Publish: it leaves the waiting list and counts in the product rating.
  await card(page, GOOD)
    .getByRole('button', { name: `Publish “${GOOD}”` })
    .click();
  await expect(page.getByRole('region', { name: GOOD, exact: true })).toHaveCount(0);
  await expect.poll(ratingCount).toBe(countBefore + 1);

  // Reject needs a reason (staff only).
  await card(page, SPAM)
    .getByRole('button', { name: `Reject “${SPAM}”` })
    .click();
  const reject = page.getByRole('dialog', { name: 'Reject review' });
  await reject.getByRole('button', { name: 'Reject' }).click();
  await expect(reject.getByText(/Say why in a few words/)).toBeVisible();
  await reject.getByLabel(/^Reason/).fill('Spam link to another site');
  await reject.getByRole('button', { name: 'Reject' }).click();
  await expect(reject).toBeHidden();
  await expect(page.getByRole('region', { name: SPAM, exact: true })).toHaveCount(0);

  // Published: answer it and pick it for the home page.
  await openList(page, 'Published');
  await card(page, GOOD)
    .getByRole('button', { name: `Reply to “${GOOD}”` })
    .click();
  const reply = page.getByRole('dialog', { name: 'Reply to this review' });
  await reply.getByLabel('Reply').fill('Thank you, Ayesha! Enjoy it.');
  await reply.getByRole('button', { name: 'Save reply' }).click();
  await expect(reply).toBeHidden();
  await expect(card(page, GOOD).getByText('Thank you, Ayesha! Enjoy it.')).toBeVisible();
  await card(page, GOOD)
    .getByRole('button', { name: `Show “${GOOD}” on the home page` })
    .click();
  await expect(card(page, GOOD).getByText('On the home page')).toBeVisible();
  await expect
    .poll(async () => {
      const featured = await request.get(`${API}/catalog/reviews/featured?limit=12`);
      return JSON.stringify(await featured.json());
    })
    .toContain(GOOD);

  // Unpublish: out of the rating and off the home page.
  await card(page, GOOD)
    .getByRole('button', { name: `Unpublish “${GOOD}”` })
    .click();
  const unpublish = page.getByRole('dialog', { name: 'Unpublish review' });
  await unpublish.getByLabel(/^Reason/).fill('Asked by the customer');
  await unpublish.getByRole('button', { name: 'Unpublish' }).click();
  await expect(unpublish).toBeHidden();
  await expect.poll(ratingCount).toBe(countBefore);

  // Rejected: the reason shows; spam is deleted for good.
  await openList(page, 'Rejected');
  await expect(card(page, SPAM).getByText('Spam link to another site')).toBeVisible();
  await expect(card(page, GOOD).getByText('Asked by the customer')).toBeVisible();
  await card(page, SPAM)
    .getByRole('button', { name: `Delete “${SPAM}”` })
    .click();
  const remove = page.getByRole('dialog', { name: 'Delete review permanently' });
  await remove.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(remove).toBeHidden();
  await expect(page.getByRole('region', { name: SPAM, exact: true })).toHaveCount(0);
  expect(await reviewCount()).toBe(1);
});
