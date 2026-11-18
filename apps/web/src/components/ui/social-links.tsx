import type { IconType } from 'react-icons';
import { FaFacebook, FaFacebookF, FaInstagram, FaTiktok, FaYoutube } from 'react-icons/fa6';

import { type SocialLink, socialLinks, type SocialPlatform } from '@/config/socials';
import { cn } from '@/lib/utils/cn';

/** `plain` = white glyphs (top bar). `circle` = white discs with black glyphs (footer). */
type Variant = 'plain' | 'circle';

const icons: Record<Variant, Record<SocialPlatform, IconType>> = {
  plain: { facebook: FaFacebook, instagram: FaInstagram, tiktok: FaTiktok, youtube: FaYoutube },
  circle: { facebook: FaFacebookF, instagram: FaInstagram, tiktok: FaTiktok, youtube: FaYoutube },
};

interface SocialLinksProps {
  variant?: Variant;
  links?: readonly SocialLink[];
  className?: string;
}

export function SocialLinks({
  variant = 'plain',
  links = socialLinks,
  className,
}: SocialLinksProps) {
  return (
    <ul className={cn('flex items-center gap-4', className)}>
      {links.map(({ platform, label, href }) => {
        const Icon = icons[variant][platform];
        return (
          <li key={platform}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Follow us on ${label} (opens in a new tab)`}
              className={cn(
                'inline-flex items-center justify-center transition-all duration-300',
                variant === 'plain'
                  ? 'text-white hover:text-gold'
                  : 'size-9 rounded-full bg-ivory text-ink hover:-translate-y-0.5 hover:bg-gold',
              )}
            >
              <Icon aria-hidden size={variant === 'plain' ? 21 : 19} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
