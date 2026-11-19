import { socialLinks } from './socials';

export interface InstagramPost {
  id: string;
  image: { src: string; alt: string };
  /** Post permalink; falls back to the profile until real posts are linked. */
  href?: string;
}

const profileUrl =
  socialLinks.find((l) => l.platform === 'instagram')?.href ??
  'https://www.instagram.com/as_collection60/';

/**
 * Home page Instagram gallery. Curated by hand for now (images in /public/images/instagram);
 * the backend can later fill this from the Instagram Graph API.
 */
export interface InstagramFeed {
  handle: string;
  profileUrl: string;
  posts: readonly InstagramPost[];
}

export const instagram: InstagramFeed = {
  handle: '@as_collection60',
  profileUrl,
  posts: [
    {
      id: 'post-1',
      image: {
        src: '/images/instagram/post-1.jpg',
        alt: 'Gold kundan jhumkas styled with black embroidery',
      },
    },
    {
      id: 'post-2',
      image: {
        src: '/images/instagram/post-2.jpg',
        alt: 'Close-up of gold floral embroidery on black fabric',
      },
    },
    {
      id: 'post-3',
      image: {
        src: '/images/instagram/post-3.jpg',
        alt: 'Embroidered hem of a maroon stitched kurta',
      },
    },
    {
      id: 'post-4',
      image: { src: '/images/instagram/post-4.jpg', alt: 'Red matte lipstick on a marble stand' },
    },
    {
      id: 'post-5',
      image: {
        src: '/images/instagram/post-5.jpg',
        alt: 'Black chiffon sleeves with gold zari work',
      },
    },
    {
      id: 'post-6',
      image: {
        src: '/images/instagram/post-6.jpg',
        alt: 'Folded beige lawn fabric with gold embroidery',
      },
    },
  ],
};
