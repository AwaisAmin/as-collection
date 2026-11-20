import type { AdminBrandDto } from '@as/contracts';
import type { Metadata } from 'next';

import { Alert } from '@/components/ui/alert';
import { BrandList } from '@/features/brands/components/brand-list';
import { apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Brands' };

export default async function BrandsPage() {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'catalog.read')) {
    return <Alert tone="error">Your role does not include the catalog.</Alert>;
  }
  const brands = await apiRequest<AdminBrandDto[]>('/admin/brands', { token }).catch(() => null);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">Brands</h1>
        <p className="text-[14px] text-muted">Labels products can belong to.</p>
      </div>
      {brands ? (
        <BrandList
          brands={brands}
          canWrite={can(permissions, 'catalog.write')}
          canUpload={can(permissions, 'media.write')}
        />
      ) : (
        <Alert tone="error">Brands could not be loaded right now. Refresh to try again.</Alert>
      )}
    </div>
  );
}
