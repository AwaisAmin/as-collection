import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { Skeleton } from '@/components/ui/skeleton';
import { env } from '@/config/env';
import { serverEnv } from '@/config/env.server';
import { type GoogleOption, LoginFlow } from '@/features/auth/components/login-flow';
import { safeRedirectPath } from '@/features/auth/lib/safe-redirect';
import { getCurrentUser } from '@/features/auth/session';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <main id="main-content" className="flex-1 bg-sand/40">
      <Container className="flex flex-col items-center gap-8 py-14">
        <SectionHeading
          as="h1"
          title="My Account"
          subtitle="Track orders, save addresses and check out faster."
        />
        <Suspense fallback={<Skeleton className="h-120 w-full max-w-md rounded-card" />}>
          <LoginGate searchParams={searchParams} />
        </Suspense>
      </Container>
    </main>
  );
}

async function LoginGate({ searchParams }: Pick<PageProps<'/login'>, 'searchParams'>) {
  const next = safeRedirectPath((await searchParams).next);
  // Already signed in (and finished onboarding)? Skip the form.
  const user = await getCurrentUser();
  if (user?.name) redirect(next);
  return <LoginFlow next={next} google={googleOption()} />;
}

/** Real Google sign-in needs a client id; offline development shows a demo button. */
function googleOption(): GoogleOption {
  if (serverEnv.MOCK_API) return { mode: 'mock' };
  const clientId = env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  return clientId ? { mode: 'google', clientId } : null;
}
