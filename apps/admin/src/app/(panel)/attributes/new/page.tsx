import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { AttributeForm } from '@/features/attributes/components/attribute-form';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'New attribute' };

export default async function NewAttributePage() {
  const { permissions } = await requireStaff();
  if (!can(permissions, 'catalog.write')) {
    return <Alert tone="error">Your role cannot add attributes.</Alert>;
  }
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/attributes"
          className="inline-flex w-fit items-center gap-1.5 text-[14px] text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden size={16} />
          Attributes
        </Link>
        <h1 className="text-[22px] font-semibold">New attribute</h1>
      </div>
      <Card className="p-5">
        <AttributeForm attribute={null} canWrite />
      </Card>
    </div>
  );
}
