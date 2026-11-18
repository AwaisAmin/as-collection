import { Fragment } from 'react';

import { Container } from '@/components/ui/container';
import { SocialLinks } from '@/components/ui/social-links';
import { VerticalDivider } from '@/components/ui/vertical-divider';
import { type Announcement, announcements } from '@/config/announcements';
import { cn } from '@/lib/utils/cn';

interface AnnouncementItemProps extends Announcement {
  className?: string;
  /** False for the duplicated (aria-hidden) marquee copy so it isn't tabbable. */
  focusable?: boolean;
}

function AnnouncementItem({
  icon: Icon,
  text,
  href,
  className,
  focusable = true,
}: AnnouncementItemProps) {
  const classes = cn('inline-flex items-center gap-3 whitespace-nowrap', className);
  const content = (
    <>
      <Icon aria-hidden size={24} strokeWidth={1.5} className="shrink-0" />
      <span>{text}</span>
    </>
  );

  return href ? (
    <a
      href={href}
      tabIndex={focusable ? undefined : -1}
      className={cn(classes, 'transition-colors duration-200 hover:text-gold')}
    >
      {content}
    </a>
  ) : (
    <span className={classes}>{content}</span>
  );
}

/** Black announcement bar. Static row on desktop, auto-scrolling marquee below `lg`. */
export function TopBar() {
  return (
    <aside
      aria-label="Store announcements"
      className="bg-ink font-body text-[15px] font-semibold text-white"
    >
      {/* Desktop */}
      <Container className="hidden h-11 items-center justify-between lg:flex">
        <ul className="contents">
          {announcements.map((item) => (
            <Fragment key={item.id}>
              <li>
                <AnnouncementItem {...item} />
              </li>
              <li aria-hidden className="flex h-[26px]">
                <VerticalDivider />
              </li>
            </Fragment>
          ))}
        </ul>
        <SocialLinks />
      </Container>

      {/* Mobile / tablet marquee */}
      <div className="flex h-10 items-center overflow-hidden lg:hidden">
        <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center">
              {announcements.map((item) => (
                <li key={item.id} className="flex items-center">
                  <AnnouncementItem {...item} focusable={copy === 0} className="px-6" />
                  <VerticalDivider className="h-5 self-center" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </aside>
  );
}
