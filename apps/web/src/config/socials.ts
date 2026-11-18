export const socialPlatforms = ['facebook', 'instagram', 'tiktok', 'youtube'] as const;
export type SocialPlatform = (typeof socialPlatforms)[number];

export interface SocialLink {
  platform: SocialPlatform;
  label: string;
  href: string;
}

export const socialLinks: readonly SocialLink[] = [
  { platform: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/share/1E9KNLqtSp/' },
  { platform: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/as_collection60/' },
  { platform: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@ascollection16' },
  { platform: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@ASCollectionHub' },
];
