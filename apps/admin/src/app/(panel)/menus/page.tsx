import type { AdminMenuListItemDto } from '@as/contracts';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { shapeOf } from '@/features/menus/labels';
import { apiRequest } from '@/lib/api/http-client';
import { formatDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Menus' };

export default async function MenusPage() {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'content.write')) {
    return <Alert tone="error">Your role does not include shop content.</Alert>;
  }
  const menus = await apiRequest<AdminMenuListItemDto[]>('/admin/menus', { token }).catch(
    () => null,
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">Menus</h1>
        <p className="text-[14px] text-muted">
          The shop’s navigation: header, the Shop menu and the footer.
        </p>
      </div>
      {!menus ? (
        <Alert tone="error">Menus could not be loaded right now. Refresh to try again.</Alert>
      ) : (
        <ul className="border-line bg-surface shadow-card divide-line flex flex-col divide-y rounded-card border">
          {menus.map((menu) => (
            <li key={menu.id} className="hover:bg-canvas/50 relative px-4 py-3">
              <Link
                href={`/menus/${menu.key}` as Route}
                className="font-medium after:absolute after:inset-0 hover:underline"
              >
                {menu.name}
              </Link>
              <p className="text-[13px] text-muted">{shapeOf(menu.key).where}</p>
              <p className="text-[13px] text-muted">
                {menu.items} {menu.items === 1 ? 'item' : 'items'} · edited{' '}
                {formatDate(menu.updatedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
