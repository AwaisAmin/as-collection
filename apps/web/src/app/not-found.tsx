import { NotFoundView } from '@/components/shared/status-views';

/** Unmatched URLs (rendered in the root layout). Store pages use (site)/not-found.tsx. */
export default function NotFound() {
  return <NotFoundView />;
}
