import { HttpStatus } from '@nestjs/common';

import { DomainException } from '../../common/http/problem-details.js';
import type { Prisma } from '../../generated/prisma/client.js';

/*
 * Stock bookkeeping for an order's lines, inside the caller's transaction. Lines are processed
 * in variant-id order (same as checkout) so concurrent transactions never deadlock. Untracked
 * variants are skipped. Every change to `on_hand` writes an InventoryMovement row.
 */

type Tx = Prisma.TransactionClient;

export interface StockLine {
  variantId: string | null;
  quantity: number;
}

const sorted = (lines: readonly StockLine[]) =>
  lines
    .filter((l): l is { variantId: string; quantity: number } => l.variantId !== null)
    .toSorted((a, b) => a.variantId.localeCompare(b.variantId));

/** Gives reserved units back (order cancelled before shipping). */
export async function releaseReservation(tx: Tx, lines: readonly StockLine[]): Promise<void> {
  for (const { variantId, quantity } of sorted(lines)) {
    await tx.$executeRaw`
      UPDATE inventory_items
      SET reserved = GREATEST(reserved - ${quantity}, 0), version = version + 1, updated_at = now()
      WHERE variant_id = ${variantId}::uuid AND track_inventory`;
  }
}

/**
 * Shipping: the reservation becomes a sale (on_hand and reserved both drop). Fails if a tracked
 * variant does not physically have the units (e.g. a backorder not yet restocked).
 */
export async function commitSale(
  tx: Tx,
  lines: readonly StockLine[],
  reference: string,
  staffId: string | null,
): Promise<void> {
  for (const { variantId, quantity } of sorted(lines)) {
    const updated = await tx.$executeRaw`
      UPDATE inventory_items
      SET on_hand = on_hand - ${quantity}, reserved = GREATEST(reserved - ${quantity}, 0),
          version = version + 1, updated_at = now()
      WHERE variant_id = ${variantId}::uuid AND track_inventory AND on_hand >= ${quantity}`;
    if (updated === 0) {
      const item = await tx.inventoryItem.findUnique({
        where: { variantId },
        select: { trackInventory: true, variant: { select: { sku: true } } },
      });
      if (!item?.trackInventory) continue; // untracked or deleted variant: nothing to count
      throw new DomainException(
        HttpStatus.CONFLICT,
        'INSUFFICIENT_STOCK',
        `Not enough stock of ${item.variant.sku} to ship. Restock it first.`,
        { extensions: { sku: item.variant.sku } },
      );
    }
    await tx.inventoryMovement.create({
      data: { variantId, delta: -quantity, reason: 'SALE', reference, actorStaffId: staffId },
    });
  }
}

/** Returned goods go back on the shelf. */
export async function restock(
  tx: Tx,
  lines: readonly StockLine[],
  reference: string,
  staffId: string | null,
): Promise<void> {
  for (const { variantId, quantity } of sorted(lines)) {
    const updated = await tx.$executeRaw`
      UPDATE inventory_items
      SET on_hand = on_hand + ${quantity}, version = version + 1, updated_at = now()
      WHERE variant_id = ${variantId}::uuid AND track_inventory`;
    if (updated > 0) {
      await tx.inventoryMovement.create({
        data: { variantId, delta: quantity, reason: 'RETURN', reference, actorStaffId: staffId },
      });
    }
  }
}

/** A cancelled order no longer counts towards its coupon's usage limit. */
export async function releaseDiscount(tx: Tx, discountId: string | null): Promise<void> {
  if (!discountId) return;
  await tx.$executeRaw`
    UPDATE discounts SET usage_count = GREATEST(usage_count - 1, 0), updated_at = now()
    WHERE id = ${discountId}::uuid`;
}
