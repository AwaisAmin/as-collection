export const socialPlatforms = ['facebook', 'instagram', 'tiktok', 'youtube'] as const;
export type SocialPlatform = (typeof socialPlatforms)[number];

export interface SocialLink {
  platform: SocialPlatform;
  label: string;
  href: string;
}

export const socialLinks: readonly SocialLink[] = [
  { platform: 'facebook', label: 'Facebook', href: 'https://facebook.com/' },
  { platform: 'instagram', label: 'Instagram', href: 'https://instagram.com/' },
  { platform: 'tiktok', label: 'TikTok', href: 'https://tiktok.com/' },
  { platform: 'youtube', label: 'YouTube', href: 'https://youtube.com/' },
];
