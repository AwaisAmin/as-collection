import type { Metadata, Route } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { Card } from '@/components/ui/card';
import { LoginForm } from '@/features/auth/components/login-form';
import { safeNextPath } from '@/features/auth/safe-next';
import { getStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <Card className="p-6">
      <Suspense fallback={<div className="h-64" />}>
        <LoginGate searchParams={searchParams} />
      </Suspense>
    </Card>
  );
}

async function LoginGate({ searchParams }: Pick<PageProps<'/login'>, 'searchParams'>) {
  const next = safeNextPath((await searchParams).next);
  const session = await getStaff();
  if (session) redirect((session.staff.mustChangePassword ? '/change-password' : next) as Route);
  return <LoginForm next={next} />;
}
