import { NotFoundView } from '@/components/shared/status-views';

/** `notFound()` inside store pages (unknown product/category/order) — keeps header/footer. */
export default function SiteNotFound() {
  return <NotFoundView />;
}
