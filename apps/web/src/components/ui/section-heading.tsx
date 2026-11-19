import { cn } from '@/lib/utils/cn';

import { OrnamentDivider } from './ornament-divider';

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  /** Heading level — pages use h1, sections h2. */
  as?: 'h1' | 'h2';
  align?: 'center' | 'left';
  className?: string;
}

/** Marcellus title + gold ornament divider, matching the card titles on the home page. */
export function SectionHeading({
  title,
  subtitle,
  as: Heading = 'h2',
  align = 'center',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        align === 'center' ? 'items-center text-center' : 'items-start text-left',
        className,
      )}
    >
      <Heading className="font-display text-[34px]/[1.1] text-ink sm:text-[42px]/[1.1]">
        {title}
      </Heading>
      <OrnamentDivider width={110} />
      {subtitle ? <p className="max-w-xl text-[18px] text-muted">{subtitle}</p> : null}
    </div>
  );
}
