import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Container } from '@/components/ui/container';
import { Skeleton } from '@/components/ui/skeleton';
import { AccountNav } from '@/features/auth/components/account-nav';

export const metadata: Metadata = {
  title: { default: 'My Account', template: '%s | My Account | AS Collection Hub' },
  robots: { index: false, follow: false },
};

/** Account shell: navigation + page. Every page verifies the session itself (`requireUser`). */
export default function AccountLayout({ children }: LayoutProps<'/account'>) {
  return (
    <main id="main-content" className="flex-1">
      <PageHeader
        title="My Account"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'My Account' }]}
      />
      <Container className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[250px_1fr] lg:items-start">
        <div className="lg:sticky lg:top-6">
          <AccountNav />
        </div>
        <Suspense
          fallback={
            <div className="flex flex-col gap-5">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-48 w-full rounded-card" />
              <Skeleton className="h-48 w-full rounded-card" />
            </div>
          }
        >
          <div className="min-w-0">{children}</div>
        </Suspense>
      </Container>
    </main>
  );
}
