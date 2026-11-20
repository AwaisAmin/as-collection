import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

const tones = {
  error: { icon: CircleAlert, classes: 'border-danger/30 bg-danger/5 text-danger' },
  success: { icon: CircleCheck, classes: 'border-success/30 bg-success/5 text-success' },
  info: { icon: Info, classes: 'border-line bg-canvas text-text' },
} as const;

export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  const { icon: Icon, classes } = tones[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-lg border px-3 py-2.5 text-[14px]', classes, className)}
    >
      <Icon aria-hidden size={18} className="mt-px shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
