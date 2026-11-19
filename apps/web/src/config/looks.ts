export interface LookHotspot {
  productSlug: string;
  /** Dot position on the image, in % from the top-left corner. */
  x: number;
  y: number;
}

export interface Look {
  id: string;
  title: string;
  description: string;
  image: { src: string; alt: string };
  hotspots: readonly LookHotspot[];
}

/**
 * The home page "Shop the Look". Images live in /public/images/looks; when swapping the photo,
 * move the hotspot coordinates to match. Managed from the admin panel later.
 */
export const featuredLook: Look | null = {
  id: 'festive-black',
  title: 'The Festive Black Edit',
  description: 'Gold-on-black embroidery, a soft matte lip and a flawless base — dawat-ready.',
  image: {
    src: '/images/looks/festive-black.jpg',
    alt: 'Model in a black chiffon outfit with gold embroidery, gold jhumkas and a soft matte lip',
  },
  hotspots: [
    { productSlug: 'black-sheesha-chiffon-frock', x: 46, y: 74 },
    { productSlug: 'velvet-matte-lipstick', x: 62, y: 35 },
    { productSlug: 'long-wear-liquid-foundation-spf-30', x: 51, y: 27 },
  ],
};
