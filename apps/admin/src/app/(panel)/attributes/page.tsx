import type { AdminAttributeDto } from '@as/contracts';
import { Plus } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { ATTRIBUTE_SCOPES, ATTRIBUTE_TYPES, hasValueList } from '@/features/attributes/labels';
import { apiRequest } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Attributes' };

function usage(attribute: AdminAttributeDto): string {
  const { products, variants, categories } = attribute.usage;
  const parts = [
    products ? `${String(products)} ${products === 1 ? 'product' : 'products'}` : null,
    variants ? `${String(variants)} ${variants === 1 ? 'variant' : 'variants'}` : null,
    categories ? `${String(categories)} ${categories === 1 ? 'category' : 'categories'}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Not used yet';
}

export default async function AttributesPage({ searchParams }: PageProps<'/attributes'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'catalog.read')) {
    return <Alert tone="error">Your role does not include the catalog.</Alert>;
  }
  const [attributes, params] = await Promise.all([
    apiRequest<AdminAttributeDto[]>('/admin/attributes', { token }).catch(() => null),
    searchParams,
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Attributes</h1>
          <p className="text-[14px] text-muted">
            Product details and shop filters (Fabric, Colour) and the options customers choose
            between (Size, Shade).
          </p>
        </div>
        {can(permissions, 'catalog.write') ? (
          <ButtonLink href="/attributes/new">
            <Plus aria-hidden size={17} />
            New attribute
          </ButtonLink>
        ) : null}
      </div>
      {params.deleted === '1' ? <Alert tone="success">The attribute was deleted.</Alert> : null}

      {!attributes ? (
        <Alert tone="error">Attributes could not be loaded right now. Refresh to try again.</Alert>
      ) : attributes.length ? (
        <ul className="border-line bg-surface shadow-card divide-line flex flex-col divide-y rounded-card border">
          {attributes.map((attribute) => (
            <li key={attribute.id} className="hover:bg-canvas/50 relative px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/attributes/${attribute.id}` as Route}
                  className="font-medium after:absolute after:inset-0 hover:underline"
                >
                  {attribute.name}
                </Link>
                <Badge tone={attribute.scope === 'VARIANT' ? 'gold' : 'neutral'}>
                  {ATTRIBUTE_SCOPES[attribute.scope].label}
                </Badge>
                {attribute.isFilterable && attribute.scope === 'PRODUCT' ? (
                  <Badge tone="success">Filter</Badge>
                ) : null}
                {!attribute.isVisible ? <Badge>Not shown</Badge> : null}
              </div>
              <p className="text-[13px] text-muted">
                {ATTRIBUTE_TYPES[attribute.type].label}
                {hasValueList(attribute.type)
                  ? ` · ${String(attribute.values.length)} ${attribute.values.length === 1 ? 'value' : 'values'}`
                  : ''}
                {attribute.unit ? ` · ${attribute.unit}` : ''} · {usage(attribute)}
              </p>
              {hasValueList(attribute.type) && attribute.values.length ? (
                <p className="mt-1 flex flex-wrap gap-1.5 text-[12px]">
                  {attribute.values.slice(0, 12).map((value) => (
                    <span
                      key={value.id}
                      className="border-line inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
                    >
                      {value.swatch ? (
                        <span
                          aria-hidden
                          className="border-line size-2.5 rounded-full border"
                          style={{ background: value.swatch }}
                        />
                      ) : null}
                      {value.label}
                    </span>
                  ))}
                  {attribute.values.length > 12 ? (
                    <span className="text-muted">+{attribute.values.length - 12} more</span>
                  ) : null}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-line bg-surface rounded-card border border-dashed px-6 py-12 text-center">
          <p className="font-medium">No attributes yet</p>
          <p className="text-[14px] text-muted">Add Size or Fabric to get started.</p>
        </div>
      )}
    </div>
  );
}
