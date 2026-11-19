'use client';

import { useEffect } from 'react';

import { useRecentlyViewedStore } from '../store/recently-viewed-store';

/** Records a product page view in the browser's recently-viewed list. Renders nothing. */
export function TrackProductView({ productId }: { productId: string }) {
  const record = useRecentlyViewedStore((s) => s.record);
  useEffect(() => {
    record(productId);
  }, [productId, record]);
  return null;
}
