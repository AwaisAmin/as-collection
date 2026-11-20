import { HttpStatus, Injectable } from '@nestjs/common';
import type { z } from 'zod';

import {
  DomainException,
  type FieldError,
  ValidationFailedException,
} from '../../../common/http/problem-details.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { type AuditActor, AuditService, diff } from '../../audit/audit.service.js';
import { CatalogService } from '../catalog.service.js';
import type {
  AdjustStockInput,
  AdminInventoryQuery,
  inventorySettingsSchema,
  movementsQuerySchema,
} from './product-admin.schemas.js';

interface InventoryRow {
  variant_id: string;
  sku: string;
  title: string | null;
  is_active: boolean;
  product_id: string;
  product_name: string;
  product_status: string;
  on_hand: number;
  reserved: number;
  low_stock_threshold: number;
  track_inventory: boolean;
  allow_backorder: boolean;
  updated_at: Date;
  total: bigint;
}

const AVAILABLE = Prisma.sql`(i.on_hand - i.reserved)`;

const STOCK_FILTERS = {
  all: Prisma.empty,
  low: Prisma.sql`AND i.track_inventory AND ${AVAILABLE} > 0 AND ${AVAILABLE} <= i.low_stock_threshold`,
  out: Prisma.sql`AND i.track_inventory AND NOT i.allow_backorder AND ${AVAILABLE} <= 0`,
  backorder: Prisma.sql`AND i.allow_backorder AND i.reserved > i.on_hand`,
} as const;

/** `50%_off` → `50\%\_off` for LIKE patterns. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

const variantNotFound = () =>
  new DomainException(HttpStatus.NOT_FOUND, 'VARIANT_NOT_FOUND', 'Variant not found.');

/**
 * Stock management. Every change to `on_hand` is ledgered (InventoryMovement with who and why)
 * and audited; rows are locked in variant-id order like checkout, so stock takes never deadlock
 * with orders. Stock can never drop below what open orders have reserved (unless backorders
 * are allowed).
 */
@Injectable()
export class AdminInventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
  ) {}

  async list(query: AdminInventoryQuery) {
    const search = query.q
      ? Prisma.sql`AND (v.sku LIKE ${`${escapeLike(query.q.toUpperCase())}%`}
          OR p.name ILIKE ${`%${escapeLike(query.q)}%`})`
      : Prisma.empty;
    const order =
      query.stock === 'all'
        ? Prisma.sql`p.name ASC, v.position ASC, v.id ASC`
        : Prisma.sql`${AVAILABLE} ASC, v.sku ASC`;
    const rows = await this.prisma.$queryRaw<InventoryRow[]>`
      SELECT v.id AS variant_id, v.sku, v.title, v.is_active,
             p.id AS product_id, p.name AS product_name, p.status::text AS product_status,
             i.on_hand, i.reserved, i.low_stock_threshold, i.track_inventory, i.allow_backorder,
             i.updated_at, count(*) OVER () AS total
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      JOIN inventory_items i ON i.variant_id = v.id
      WHERE TRUE ${search} ${STOCK_FILTERS[query.stock]}
      ORDER BY ${order}
      LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`;
    const total = Number(rows[0]?.total ?? 0);
    return {
      items: rows.map((r) => ({
        variantId: r.variant_id,
        sku: r.sku,
        title: r.title,
        isActive: r.is_active,
        product: { id: r.product_id, name: r.product_name, status: r.product_status },
        onHand: r.on_hand,
        reserved: r.reserved,
        available: r.on_hand - r.reserved,
        lowStockThreshold: r.low_stock_threshold,
        trackInventory: r.track_inventory,
        allowBackorder: r.allow_backorder,
        updatedAt: r.updated_at,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  /** Applies all changes or none (422 with the failing lines). */
  async adjust(input: AdjustStockInput, actor: AuditActor) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const ids = input.items.map((i) => i.variantId);
        const locked = await tx.$queryRaw<
          {
            variant_id: string;
            on_hand: number;
            reserved: number;
            track_inventory: boolean;
            allow_backorder: boolean;
          }[]
        >`
          SELECT variant_id, on_hand, reserved, track_inventory, allow_backorder
          FROM inventory_items
          WHERE variant_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
          ORDER BY variant_id
          FOR UPDATE`;
        const byId = new Map(locked.map((row) => [row.variant_id, row]));
        const skus = new Map(
          (
            await tx.productVariant.findMany({
              where: { id: { in: ids } },
              select: { id: true, sku: true },
            })
          ).map((v) => [v.id, v.sku]),
        );

        const errors: FieldError[] = [];
        const changes: {
          variantId: string;
          sku: string;
          from: number;
          to: number;
          reserved: number;
        }[] = [];
        input.items.forEach((item, i) => {
          const path = `items.${String(i)}`;
          const row = byId.get(item.variantId);
          const sku = skus.get(item.variantId);
          if (!row || !sku) {
            errors.push({ path: `${path}.variantId`, message: 'Unknown variant.' });
            return;
          }
          if (!row.track_inventory) {
            errors.push({ path, message: `Stock is not tracked for ${sku}.` });
            return;
          }
          const to = 'set' in item ? item.set : row.on_hand + item.add;
          if (to < 0) {
            errors.push({ path, message: `${sku} has only ${String(row.on_hand)} in stock.` });
          } else if (to < row.reserved && !row.allow_backorder) {
            errors.push({
              path,
              message: `${sku} cannot go below ${String(row.reserved)}: that many are reserved by open orders.`,
            });
          } else if (to !== row.on_hand) {
            changes.push({
              variantId: item.variantId,
              sku,
              from: row.on_hand,
              to,
              reserved: row.reserved,
            });
          }
        });
        if (errors.length) throw new ValidationFailedException(errors);

        for (const change of changes) {
          await tx.$executeRaw`
            UPDATE inventory_items
            SET on_hand = ${change.to}, version = version + 1, updated_at = now()
            WHERE variant_id = ${change.variantId}::uuid`;
        }
        await tx.inventoryMovement.createMany({
          data: changes.map((c) => ({
            variantId: c.variantId,
            delta: c.to - c.from,
            reason: input.reason,
            reference: input.reference ?? null,
            note: input.note ?? null,
            actorStaffId: actor.staffId,
          })),
        });
        if (changes.length) {
          await this.audit.record(
            actor,
            {
              action: 'inventory.adjust',
              entityType: 'inventory',
              changes: {
                reason: input.reason,
                note: input.note ?? null,
                items: changes.map(({ sku, from, to }) => ({ sku, from, to })),
              },
            },
            tx,
          );
        }
        return changes;
      },
      { timeout: 20_000 },
    );
    if (result.length) await this.catalog.invalidate();
    return {
      changed: result.map((c) => ({
        variantId: c.variantId,
        sku: c.sku,
        onHand: c.to,
        delta: c.to - c.from,
        available: c.to - c.reserved,
      })),
      unchanged: input.items.length - result.length,
    };
  }

  async updateSettings(
    variantId: string,
    input: z.infer<typeof inventorySettingsSchema>,
    actor: AuditActor,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$executeRaw`
        SELECT 1 FROM inventory_items WHERE variant_id = ${variantId}::uuid FOR UPDATE`;
      if (!locked) throw variantNotFound();
      const before = await tx.inventoryItem.findUniqueOrThrow({
        where: { variantId },
        select: {
          onHand: true,
          reserved: true,
          lowStockThreshold: true,
          trackInventory: true,
          allowBackorder: true,
          variant: { select: { sku: true } },
        },
      });
      if (input.allowBackorder === false && before.reserved > before.onHand) {
        throw new DomainException(
          HttpStatus.CONFLICT,
          'BACKORDERS_OPEN',
          `Open orders have reserved ${String(before.reserved)} of ${before.variant.sku} but only ${String(before.onHand)} are in stock. Restock before turning backorders off.`,
        );
      }
      const row = await tx.inventoryItem.update({
        where: { variantId },
        data: { ...input, version: { increment: 1 } },
        select: {
          onHand: true,
          reserved: true,
          lowStockThreshold: true,
          trackInventory: true,
          allowBackorder: true,
        },
      });
      await this.audit.record(
        actor,
        {
          action: 'inventory.settings',
          entityType: 'inventory',
          entityId: variantId,
          changes: { sku: before.variant.sku, ...diff(before, input) },
        },
        tx,
      );
      return row;
    });
    await this.catalog.invalidate();
    return { variantId, ...updated, available: updated.onHand - updated.reserved };
  }

  async movements(variantId: string, query: z.infer<typeof movementsQuerySchema>) {
    const exists = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true },
    });
    if (!exists) throw variantNotFound();
    const rows = await this.prisma.inventoryMovement.findMany({
      where: { variantId, id: query.before ? { lt: query.before } : undefined },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        delta: true,
        reason: true,
        reference: true,
        note: true,
        createdAt: true,
        actorStaff: { select: { id: true, name: true } },
      },
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map(({ actorStaff, ...m }) => ({ ...m, by: actorStaff })),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }
}
