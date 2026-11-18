import Link from 'next/link';

import { GoldLeafBranch } from '@/components/ornaments/gold-leaf-branch';
import { cn } from '@/lib/utils/cn';

const sizes = {
  sm: {
    mark: 'text-[46px]/[0.82]',
    word: 'text-[17px]/none',
    leaf: 'h-[36px] w-[42px] -top-[3px]',
  },
  md: {
    mark: 'text-[76px]/[0.82]',
    word: 'text-[28px]/none',
    leaf: 'h-[58px] w-[68px] -top-[6px]',
  },
} as const;

interface LogoProps {
  size?: keyof typeof sizes;
  className?: string;
  onClick?: () => void;
}

/** "AS" monogram with gold leaf branch, "Collection Hub" wordmark below. */
export function Logo({ size = 'md', className, onClick }: LogoProps) {
  const s = sizes[size];

  return (
    <Link
      href="/"
      onClick={onClick}
      className={cn('inline-flex shrink-0 flex-col items-center text-ink', className)}
    >
      {/* Accessible name comes from the visible text ("AS Collection Hub"); the space
          between the stacked spans is ignored by flex layout but kept in the name. */}
      <span className={cn('relative -translate-x-[6%] font-display tracking-[-0.045em]', s.mark)}>
        AS
        <GoldLeafBranch className={cn('absolute left-full ml-[2px]', s.leaf)} />
      </span>{' '}
      <span className={cn('font-display whitespace-nowrap', s.word)}>Collection Hub</span>
    </Link>
  );
}
