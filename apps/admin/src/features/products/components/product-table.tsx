import type { AdminProductListItemDto } from '@as/contracts';
import { ImageOff, TriangleAlert } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';

import { priceRange, PRODUCT_STATUS } from '../labels';

const href = (product: AdminProductListItemDto) => `/products/${product.id}` as Route;

function Thumb({ product }: { product: AdminProductListItemDto }) {
  return (
    <span className="border-line bg-canvas flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border">
      {product.image ? (
        // Library images are already resized WebP copies; the optimizer adds nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image.url} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <ImageOff aria-hidden size={18} className="text-muted" />
      )}
    </span>
  );
}

function Stock({ product }: { product: AdminProductListItemDto }) {
  if (product.stock === null) return <span className="text-muted">Not tracked</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={product.stock <= 0 ? 'text-danger' : undefined}>
        {product.stock <= 0 ? 'Out of stock' : `${String(product.stock)} in stock`}
      </span>
      {product.lowStockVariants > 0 && product.stock > 0 ? (
        <span
          className="text-warning inline-flex items-center gap-1 text-[13px]"
          title="Variants at or below their alert level"
        >
          <TriangleAlert aria-hidden size={14} />
          {product.lowStockVariants} low
        </span>
      ) : null}
    </span>
  );
}

/** Products as a table on wide screens and as cards on phones. */
export function ProductTable({ products }: { products: readonly AdminProductListItemDto[] }) {
  return (
    <>
      <div className="border-line bg-surface shadow-card hidden overflow-x-auto rounded-card border md:block">
        <table className="w-full text-left text-[14px]">
          <thead className="border-line bg-canvas/60 border-b text-[12px] font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-3">
                Product
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Stock
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Price
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {products.map((product) => {
              const status = PRODUCT_STATUS[product.status];
              return (
                <tr key={product.id} className="hover:bg-canvas/50 relative">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Thumb product={product} />
                      <div className="min-w-0">
                        <Link
                          href={href(product)}
                          className="font-medium after:absolute after:inset-0 hover:underline"
                        >
                          {product.name}
                        </Link>
                        <p className="text-[13px] text-muted">
                          {product.category.name} · {product.variantCount}{' '}
                          {product.variantCount === 1 ? 'variant' : 'variants'} · edited{' '}
                          {formatDate(product.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Stock product={product} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {priceRange(product.priceMinMinor, product.priceMaxMinor)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {products.map((product) => {
          const status = PRODUCT_STATUS[product.status];
          return (
            <li key={product.id}>
              <Link
                href={href(product)}
                className="border-line bg-surface shadow-card flex gap-3 rounded-card border p-3"
              >
                <Thumb product={product} />
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-[14px]">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-[13px] text-muted">
                    {product.category.name} ·{' '}
                    {priceRange(product.priceMinMinor, product.priceMaxMinor)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <Stock product={product} />
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
