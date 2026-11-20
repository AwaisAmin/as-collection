import type { Metadata, Route } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { getStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Change password' };

export default function ChangePasswordPage() {
  return (
    <Card className="p-6">
      <Suspense fallback={<div className="h-72" />}>
        <ChangePassword />
      </Suspense>
    </Card>
  );
}

async function ChangePassword() {
  const session = await getStaff();
  if (!session) redirect('/login?next=/change-password' as Route);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[18px] font-semibold">Change your password</h1>
        <p className="text-[14px] text-muted">Signed in as {session.staff.email}</p>
      </div>
      {session.staff.mustChangePassword ? (
        <Alert>Please choose a new password before continuing.</Alert>
      ) : null}
      <ChangePasswordForm />
    </div>
  );
}
