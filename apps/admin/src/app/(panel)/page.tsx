import { Boxes, ClipboardCheck, Inbox, type LucideIcon, Receipt, Star, Truck } from 'lucide-react';
import type { Metadata } from 'next';

import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Dashboard' };

interface Tile {
  label: string;
  hint: string;
  icon: LucideIcon;
  /** null: could not be loaded right now. */
  value: number | null;
}

/** A count from the API; a failed call shows "—" instead of breaking the dashboard. */
async function count<T>(
  path: string,
  token: string,
  pick: (body: T) => number,
): Promise<number | null> {
  try {
    return pick(await apiRequest<T>(path, { token }));
  } catch {
    return null;
  }
}

export default async function DashboardPage({ searchParams }: PageProps<'/'>) {
  const { staff, permissions, token } = await requireStaff();
  const passwordChanged = (await searchParams).password === 'changed';

  type OrderCounts = { toConfirm: number; toShip: number; awaitingPaymentReview: number };
  const orders = can(permissions, 'orders.read')
    ? await apiRequest<OrderCounts>('/admin/orders/counts', { token }).catch(() => null)
    : undefined;

  const tiles: Tile[] = [];
  if (orders !== undefined) {
    tiles.push(
      {
        label: 'Orders to confirm',
        hint: 'Placed, waiting for a call or check',
        icon: ClipboardCheck,
        value: orders?.toConfirm ?? null,
      },
      {
        label: 'Payments to verify',
        hint: 'Transfer screenshots waiting',
        icon: Receipt,
        value: orders?.awaitingPaymentReview ?? null,
      },
      {
        label: 'Orders to ship',
        hint: 'Confirmed or being packed',
        icon: Truck,
        value: orders?.toShip ?? null,
      },
    );
  }
  const [reviews, inbox, lowStock] = await Promise.all([
    can(permissions, 'reviews.moderate')
      ? count<{ PENDING: number }>('/admin/reviews/counts', token, (b) => b.PENDING)
      : undefined,
    can(permissions, 'inbox.read')
      ? count<{ NEW: number }>('/admin/inbox/counts', token, (b) => b.NEW)
      : undefined,
    can(permissions, 'catalog.read')
      ? count<{ total: number }>('/admin/inventory?stock=low&pageSize=1', token, (b) => b.total)
      : undefined,
  ]);
  if (reviews !== undefined)
    tiles.push({
      label: 'Reviews to moderate',
      hint: 'Waiting for approval',
      icon: Star,
      value: reviews,
    });
  if (inbox !== undefined)
    tiles.push({ label: 'Unread messages', hint: 'Contact form inbox', icon: Inbox, value: inbox });
  if (lowStock !== undefined)
    tiles.push({
      label: 'Low stock',
      hint: 'Variants at or below their alert level',
      icon: Boxes,
      value: lowStock,
    });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-semibold">Welcome, {staff.name.split(' ')[0]}</h1>
        <p className="text-[14px] text-muted">What needs attention right now.</p>
      </div>

      {passwordChanged ? (
        <Alert tone="success">Your password was changed. Other devices were signed out.</Alert>
      ) : null}

      {tiles.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tiles.map((tile) => (
            <li key={tile.label}>
              <Card className="flex items-start gap-4 p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold-dark">
                  <tile.icon aria-hidden size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-muted">{tile.label}</p>
                  <p className="text-[28px] leading-tight font-semibold tabular-nums">
                    {tile.value ?? '—'}
                  </p>
                  <p className="text-[13px] text-muted">{tile.hint}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Alert>Your role doesn&apos;t include any dashboard areas yet. Ask an administrator.</Alert>
      )}
    </div>
  );
}
