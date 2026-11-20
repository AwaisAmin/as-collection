import { MapPin, Package, UserRound } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { ButtonLink } from '@/components/ui/button';
import { authService } from '@/features/auth/services/auth.service';
import { requireSession } from '@/features/auth/session';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { ordersService } from '@/features/orders/services/orders.service';
import { formatDate, formatPrice } from '@/lib/utils/format';
import { formatPkMobile } from '@/lib/utils/phone';

export const metadata: Metadata = { title: 'Overview' };

export default async function AccountOverviewPage() {
  const { user, token } = await requireSession('/account');
  const [orders, addresses] = await Promise.all([
    ordersService.listOrdersForCustomer({ userId: user.id, phone: user.phone }),
    authService.listAddresses(token),
  ]);
  const defaultAddress = addresses.find((a) => a.isDefault);
  const firstName = user.name.split(' ')[0] || 'there';

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-display text-[30px]">Welcome back, {firstName}!</h2>
        <p className="mt-1 text-[17px] text-muted">
          Here&apos;s a quick look at your orders and saved details.
        </p>
      </div>

      <section
        aria-labelledby="recent-orders"
        className="rounded-card border border-gold/60 bg-ivory p-5 sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id="recent-orders" className="flex items-center gap-2 font-display text-[21px]">
            <Package aria-hidden size={20} className="text-gold-dark" />
            Recent orders
          </h3>
          {orders.length > 0 ? (
            <Link
              href="/account/orders"
              className="text-[15px] font-semibold text-gold-dark hover:underline"
            >
              View all
            </Link>
          ) : null}
        </div>
        {orders.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-[17px] text-muted">You haven&apos;t placed any orders yet.</p>
            <ButtonLink href="/shop" size="sm" withArrow>
              Start shopping
            </ButtonLink>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-gold/40">
            {orders.slice(0, 3).map((o) => (
              <li key={o.orderNumber}>
                <Link
                  href={`/account/orders/${o.orderNumber}` as Route}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:text-gold-dark"
                >
                  <span>
                    <span className="block font-body text-[17px] font-bold">{o.orderNumber}</span>
                    <span className="text-[15px] text-muted">
                      {formatDate(o.createdAt)} · {formatPrice(o.totals.total)}
                    </span>
                  </span>
                  <OrderStatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section
          aria-labelledby="profile-card"
          className="rounded-card border border-gold/60 bg-ivory p-5 sm:p-6"
        >
          <h3 id="profile-card" className="mb-3 flex items-center gap-2 font-display text-[21px]">
            <UserRound aria-hidden size={20} className="text-gold-dark" />
            Profile
          </h3>
          <p className="text-[17px] font-bold">{user.name}</p>
          <p className="text-[16px] text-muted">
            {user.phone ? formatPkMobile(user.phone) : 'No phone added yet'}
          </p>
          {user.email ? <p className="text-[16px] text-muted">{user.email}</p> : null}
          <Link
            href="/account/profile"
            className="mt-3 inline-block text-[15px] font-semibold text-gold-dark hover:underline"
          >
            Edit profile
          </Link>
        </section>

        <section
          aria-labelledby="address-card"
          className="rounded-card border border-gold/60 bg-ivory p-5 sm:p-6"
        >
          <h3 id="address-card" className="mb-3 flex items-center gap-2 font-display text-[21px]">
            <MapPin aria-hidden size={20} className="text-gold-dark" />
            Default address
          </h3>
          {defaultAddress ? (
            <address className="text-[16px] not-italic">
              <span className="font-bold">{defaultAddress.label}</span> ·{' '}
              {defaultAddress.recipientName}
              <br />
              {defaultAddress.address}, {defaultAddress.city}
            </address>
          ) : (
            <p className="text-[16px] text-muted">
              No saved addresses yet — they&apos;re saved automatically at checkout.
            </p>
          )}
          <Link
            href="/account/addresses"
            className="mt-3 inline-block text-[15px] font-semibold text-gold-dark hover:underline"
          >
            Manage addresses
          </Link>
        </section>
      </div>
    </div>
  );
}
