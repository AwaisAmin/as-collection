import { Skeleton } from '@/components/ui/skeleton';

/**
 * Per-segment Suspense boundary for account pages: they read the session at request time,
 * so navigating between them streams the page body while the shell stays interactive.
 */
export default function AccountLoading() {
  return (
    <div aria-busy className="flex flex-col gap-5">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-40 w-full rounded-card" />
      <Skeleton className="h-40 w-full rounded-card" />
    </div>
  );
}
