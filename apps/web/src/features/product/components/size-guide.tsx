'use client';

import { Ruler } from 'lucide-react';

import { Dialog } from '@/components/ui/dialog';
import { useDisclosure } from '@/hooks/use-disclosure';

import { sizeChart } from '../content/size-chart';

export function SizeGuide() {
  const { isOpen, open, close } = useDisclosure();

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 font-body text-[16px] font-semibold text-gold-dark underline-offset-4 hover:underline"
      >
        <Ruler aria-hidden size={16} />
        Size guide
      </button>

      <Dialog
        open={isOpen}
        onClose={close}
        title="Size guide"
        description="Body measurements in inches."
        size="lg"
      >
        <div className="px-5 py-5 sm:px-7 sm:py-6">
          <div className="overflow-x-auto rounded-xl border border-gold/60">
            <table className="w-full min-w-[420px] border-collapse font-body text-[16px]">
              <caption className="sr-only">Stitched garment size chart (inches)</caption>
              <thead className="bg-ink text-white">
                <tr>
                  {sizeChart.columns.map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className="px-4 py-3 text-left font-display font-normal"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sizeChart.rows.map(([size, ...measures]) => (
                  <tr key={size} className="border-t border-gold/40 even:bg-cream">
                    <th scope="row" className="px-4 py-2.5 text-left font-bold text-ink">
                      {size}
                    </th>
                    {measures.map((m, i) => (
                      <td key={i} className="px-4 py-2.5 text-text">
                        {m}″
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-6 font-display text-[19px]">How to measure</h3>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[16px] text-muted marker:text-gold">
            {sizeChart.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      </Dialog>
    </>
  );
}
