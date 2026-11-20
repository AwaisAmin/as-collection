import pg from 'pg';

/** Every customer, order and code these tests create uses this phone prefix (0396…). */
export const PHONE_PREFIX = '+92396';
export const EMAIL_DOMAIN = '@e2e-browser.example.test';

/** A fresh local test number, e.g. "0396-1234567". */
export function testPhone(): string {
  const digits = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
  return `0396-${digits}`;
}

async function withClient<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/**
 * Removes everything the browser tests created. Stock held by test orders that are still open
 * is released first, so the seeded catalog's stock is exactly as before.
 */
export async function cleanupTestData(): Promise<void> {
  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(
        `UPDATE inventory_items i
           SET reserved = GREATEST(i.reserved - t.quantity, 0), version = version + 1
         FROM (SELECT oi.variant_id, sum(oi.quantity)::int AS quantity
                 FROM orders o JOIN order_items oi ON oi.order_id = o.id
                WHERE o.phone LIKE $1 AND o.status IN ('PENDING','CONFIRMED','PROCESSING')
                GROUP BY oi.variant_id) t
        WHERE i.variant_id = t.variant_id AND i.track_inventory`,
        [`${PHONE_PREFIX}%`],
      );
      // Shipped / returned test orders moved stock in the ledger: undo those movements.
      await client.query(
        `UPDATE inventory_items i
           SET on_hand = i.on_hand - t.delta, version = version + 1
         FROM (SELECT m.variant_id, sum(m.delta)::int AS delta
                 FROM inventory_movements m JOIN orders o ON o.number = m.reference
                WHERE o.phone LIKE $1
                GROUP BY m.variant_id) t
        WHERE i.variant_id = t.variant_id`,
        [`${PHONE_PREFIX}%`],
      );
      await client.query(
        `DELETE FROM inventory_movements m USING orders o
          WHERE o.number = m.reference AND o.phone LIKE $1`,
        [`${PHONE_PREFIX}%`],
      );
      const proofs = await client.query<{ media_id: string }>(
        `SELECT p.media_id FROM payment_proofs p JOIN orders o ON o.id = p.order_id WHERE o.phone LIKE $1`,
        [`${PHONE_PREFIX}%`],
      );
      await client.query('DELETE FROM orders WHERE phone LIKE $1', [`${PHONE_PREFIX}%`]);
      if (proofs.rows.length) {
        await client.query('DELETE FROM media WHERE id = ANY($1::uuid[])', [
          proofs.rows.map((r) => r.media_id),
        ]);
      }
      await client.query('DELETE FROM customers WHERE phone LIKE $1', [`${PHONE_PREFIX}%`]);
      await client.query('DELETE FROM otp_challenges WHERE phone LIKE $1', [`${PHONE_PREFIX}%`]);
      await client.query('DELETE FROM contact_messages WHERE email LIKE $1', [`%${EMAIL_DOMAIN}`]);
      await client.query('DELETE FROM newsletter_subscribers WHERE email LIKE $1', [
        `%${EMAIL_DOMAIN}`,
      ]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

/** A variant's id and stock (units on the shelf, units held by open orders). */
export async function variantStock(
  sku: string,
): Promise<{ variantId: string; onHand: number; reserved: number }> {
  return withClient(async (client) => {
    const result = await client.query<{ variant_id: string; on_hand: number; reserved: number }>(
      `SELECT v.id AS variant_id, i.on_hand, i.reserved
         FROM product_variants v JOIN inventory_items i ON i.variant_id = v.id
        WHERE v.sku = $1`,
      [sku],
    );
    const row = result.rows[0];
    if (!row) throw new Error(`No variant ${sku}`);
    return { variantId: row.variant_id, onHand: row.on_hand, reserved: row.reserved };
  });
}

/** Units of a variant held by open checkouts and orders. */
export async function reservedUnits(sku: string): Promise<number> {
  return withClient(async (client) => {
    const result = await client.query<{ reserved: number }>(
      `SELECT i.reserved FROM inventory_items i JOIN product_variants v ON v.id = i.variant_id
        WHERE v.sku = $1`,
      [sku],
    );
    return result.rows[0]?.reserved ?? 0;
  });
}
