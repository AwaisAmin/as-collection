import type { AdminAttributeDto } from '@as/contracts';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AttributeForm } from '@/features/attributes/components/attribute-form';
import { DeleteAttribute } from '@/features/attributes/components/delete-attribute';
import { ValueList } from '@/features/attributes/components/value-list';
import { ATTRIBUTE_SCOPES, hasValueList } from '@/features/attributes/labels';
import { apiFindOrNull } from '@/lib/api/http-client';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Edit attribute' };

export default async function AttributePage({
  params,
  searchParams,
}: PageProps<'/attributes/[id]'>) {
  const { token, permissions } = await requireStaff();
  if (!can(permissions, 'catalog.read')) {
    return <Alert tone="error">Your role does not include the catalog.</Alert>;
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [attribute, query] = await Promise.all([
    apiFindOrNull<AdminAttributeDto>(`/admin/attributes/${id}`, { token }),
    searchParams,
  ]);
  if (!attribute) notFound();
  const canWrite = can(permissions, 'catalog.write');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/attributes"
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden size={16} />
          Attributes
        </Link>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[22px] font-semibold">{attribute.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted">
            <Badge tone={attribute.scope === 'VARIANT' ? 'gold' : 'neutral'}>
              {ATTRIBUTE_SCOPES[attribute.scope].label}
            </Badge>
            <span className="font-mono">f.{attribute.code}</span>
          </div>
        </div>
      </div>
      {query.created === '1' ? <Alert tone="success">Attribute created.</Alert> : null}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-[16px] font-semibold">Settings</h2>
          {/* Remounts after every save so the form starts from what was stored. */}
          <AttributeForm key={attribute.updatedAt} attribute={attribute} canWrite={canWrite} />
        </Card>
        <div className="flex flex-col gap-6">
          {hasValueList(attribute.type) ? (
            <Card className="flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-[16px] font-semibold">Values</h2>
                <p className="text-[13px] text-muted">In the order shoppers see them.</p>
              </div>
              <ValueList attribute={attribute} canWrite={canWrite} />
            </Card>
          ) : null}
          {canWrite ? <DeleteAttribute attribute={attribute} /> : null}
        </div>
      </div>
    </div>
  );
}
