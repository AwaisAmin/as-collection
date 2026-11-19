import { Skeleton } from '@/components/ui/skeleton';
import { ProductGridSkeleton } from '@/features/catalog/components/product-card-skeleton';

export function CatalogBrowserSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[250px_1fr] xl:gap-10">
      <div className="hidden flex-col gap-4 rounded-card border border-gold/40 bg-ivory p-5 lg:flex">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 border-b border-gold/30 pb-5 last:border-0">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-9 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div>
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-10 w-44 rounded-full" />
        </div>
        <ProductGridSkeleton />
      </div>
    </div>
  );
}
