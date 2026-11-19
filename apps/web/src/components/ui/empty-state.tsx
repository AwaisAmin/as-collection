import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Usually a ButtonLink ("Continue shopping"). */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 rounded-card border border-dashed border-gold/70 bg-ivory px-6 py-14 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-16 items-center justify-center rounded-full border border-gold bg-cream">
          <Icon aria-hidden className="size-7 text-gold-dark" strokeWidth={1.5} />
        </span>
      ) : null}
      <h2 className="font-display text-[26px] leading-tight">{title}</h2>
      {description ? <p className="max-w-md text-[18px] text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
