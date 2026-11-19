'use client';

import { SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { countActiveFilters } from '@/features/catalog/lib/catalog-url';
import { useDisclosure } from '@/hooks/use-disclosure';
import { pluralize } from '@/lib/utils/format';

import { useCatalogNavigation } from './catalog-navigation';
import { FilterPanel, type FilterPanelProps } from './filter-panel';

/** "Filters" button + drawer (below `lg`). Filters apply live; the footer button just closes. */
export function MobileFilters({ total, ...panel }: FilterPanelProps & { total: number }) {
  const { isOpen, open, close } = useDisclosure();
  const { isPending } = useCatalogNavigation();
  const active = countActiveFilters(panel.query);

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-gold bg-ivory px-4 font-body text-[16px] font-semibold text-text transition-colors hover:bg-sand lg:hidden"
      >
        <SlidersHorizontal aria-hidden size={17} />
        Filters
        {active > 0 ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-ink text-[12px] text-white">
            {active}
          </span>
        ) : null}
      </button>

      <Drawer
        open={isOpen}
        onClose={close}
        title="Filters"
        side="right"
        footer={
          <div className="border-t border-gold/60 p-4">
            <Button onClick={close} className="w-full" disabled={isPending}>
              {isPending ? 'Updating…' : `Show ${pluralize(total, 'result')}`}
            </Button>
          </div>
        }
      >
        <FilterPanel {...panel} className="px-5" />
      </Drawer>
    </>
  );
}
