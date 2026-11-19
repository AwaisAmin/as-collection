'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils/cn';

interface CopyButtonProps {
  value: string;
  /** What is being copied, for the accessible name ("Copy IBAN"). */
  label: string;
  className?: string;
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Couldn’t copy — please select and copy it manually.');
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border border-gold/70 px-2.5 py-1 font-body text-[13px] font-semibold text-ink transition-colors hover:bg-sand',
        className,
      )}
    >
      {copied ? <Check aria-hidden size={13} /> : <Copy aria-hidden size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
