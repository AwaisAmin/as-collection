import { cn } from '@/lib/utils/cn';

type NavLayout = 'bar' | 'drawer';

const layouts: Record<NavLayout, { base: string; active: string; idle: string }> = {
  /** Desktop header row. */
  bar: {
    base: 'inline-flex items-center gap-1.5 py-3.25 text-[18px] leading-none',
    active: 'px-7',
    idle: 'px-1.5',
  },
  /** Full-width rows in the mobile drawer. */
  drawer: {
    base: 'flex px-5 py-3 text-[19px]',
    active: '',
    idle: '',
  },
};

/** Shared look for nav entries; the active one becomes the black pill with gold border. */
export function navLinkClasses(active: boolean, layout: NavLayout = 'bar', className?: string) {
  const l = layouts[layout];
  return cn(
    'rounded-full border-[1.5px] font-display transition-colors duration-200',
    l.base,
    active
      ? ['border-gold bg-ink text-white', l.active]
      : ['border-transparent text-text hover:text-gold', l.idle],
    className,
  );
}
