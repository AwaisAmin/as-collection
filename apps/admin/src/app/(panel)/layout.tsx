import { KeyRound, LogOut } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { Sidebar } from '@/components/shell/sidebar';
import { logoutAction } from '@/features/auth/actions';
import { navigationFor } from '@/lib/navigation';
import { requireStaff } from '@/lib/session';

/** Signed-in admin: sidebar (desktop), section strip (mobile), top bar, page. */
export default function PanelLayout({ children }: LayoutProps<'/'>) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const { staff, permissions } = await requireStaff();
  const groups = navigationFor(permissions);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-8 overflow-y-auto bg-ink px-3 py-5 lg:flex">
        <Link href="/" className="px-3">
          <span className="font-brand block text-[20px] leading-tight text-white">
            AS Collection Hub
          </span>
          <span className="text-[11px] font-semibold tracking-[0.18em] text-gold uppercase">
            Admin
          </span>
        </Link>
        <Sidebar groups={groups} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-surface/95 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur lg:px-8">
          <Link href="/" className="font-brand text-[17px] lg:hidden">
            AS Admin
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden px-2 text-[14px] text-muted sm:inline">{staff.name}</span>
            <Link
              href="/change-password"
              className="hover:bg-canvas inline-flex size-9 items-center justify-center rounded-lg text-muted hover:text-text"
              title="Change password"
            >
              <KeyRound aria-hidden size={17} />
              <span className="sr-only">Change password</span>
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="hover:bg-canvas inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[14px] text-muted hover:text-text"
              >
                <LogOut aria-hidden size={17} />
                Sign out
              </button>
            </form>
          </div>
        </header>

        {/* Below lg: the sections as a scrollable strip. */}
        <div className="relative overflow-x-auto bg-ink px-2 py-2 lg:hidden">
          <Sidebar groups={groups} className="flex-row gap-4 [&_ul]:flex-row [&>div>p]:hidden" />
        </div>

        <main id="main" className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-60 shrink-0 bg-ink lg:block" />
      <div className="flex-1">
        <div className="border-line bg-surface h-14 border-b" />
      </div>
    </div>
  );
}
