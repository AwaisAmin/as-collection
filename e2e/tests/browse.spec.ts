import { expect, test } from '@playwright/test';

/** Browsing on real catalog data: home sections, filters, a product page (desktop + mobile). */

test('home page renders the sections arranged in the admin', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'New Arrivals' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Best Sellers' })).toBeAttached();
  await expect(page.getByRole('heading', { name: 'Shop by Occasion' })).toBeAttached();
  // Announcement bar and footer come from the store settings.
  await expect(page.getByText('Cash on Delivery Available').first()).toBeAttached();
  await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeAttached();
});

test('shop filters narrow the catalog', async ({ page }) => {
  await page.goto('/shop/makeup?shade=Ruby%20Red');
  await expect(page.getByText(/Showing 1–1 of 1 product\b/)).toBeVisible();
});

test('a product page shows price, options and reviews', async ({ page }) => {
  await page.goto('/products/long-wear-liquid-foundation-spf-30');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Long Wear Liquid Foundation SPF 30' }),
  ).toBeVisible();
  await expect(page.getByText('Rs 2,490').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Customer Reviews' })).toBeAttached();
});
