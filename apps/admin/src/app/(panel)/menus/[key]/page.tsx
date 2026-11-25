import type { AdminMenuDto } from '@as/contracts';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Alert } from '@/components/ui/alert';
import { MenuEditor } from '@/features/menus/components/menu-editor';
import { shapeOf } from '@/features/menus/labels';
import { apiFindOrNull } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Edit menu' };

export default async function MenuEditorPage({ params }: PageProps<'/menus/[key]'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'content.write')) {
    return <Alert tone="error">Your role does not include shop content.</Alert>;
  }
  const { key } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) || key.length > 60) notFound();
  const menu = await apiFindOrNull<AdminMenuDto>(`/admin/menus/${key}`, { token });
  if (!menu) notFound();

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/menus"
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden size={16} />
          Menus
        </Link>
        <div>
          <h1 className="text-[22px] font-semibold">{menu.name}</h1>
          <p className="text-[14px] text-muted">
            {shapeOf(menu.key).where} Changes show in the shop within a moment of saving.
          </p>
        </div>
      </div>
      {/* Remount after each save so the editor starts from what was stored. */}
      <MenuEditor key={menu.updatedAt} menu={menu} canWrite />
    </div>
  );
}
