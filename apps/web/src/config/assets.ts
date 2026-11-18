/**
 * Image asset registry. Swap the files in /public/images (keep the same names)
 * or point these paths at a CDN — components never hardcode image paths.
 */
export const images = {
  heroModel: {
    src: '/images/hero-model.png',
    alt: 'Model wearing a black outfit with gold embroidery and statement gold earrings',
  },
  unstitched: {
    src: '/images/unstitched.png',
    alt: 'Stack of folded black and beige unstitched fabrics with gold embroidery',
  },
  stitched: {
    src: '/images/stitched.png',
    alt: 'Maroon embroidered stitched kurta on a hanger',
  },
  makeup: {
    src: '/images/makeup.png',
    alt: 'Red lipstick, foundation bottle, compact powder and makeup brush on a marble pedestal',
  },
  flowersLeft: { src: '/images/flowers-left.png', alt: '' },
  flowersRight: { src: '/images/flowers-right.png', alt: '' },
  palmLeaf: { src: '/images/palm-leaf.png', alt: '' },
  goldLeaf: { src: '/images/gold-leaf.svg', alt: '' },
} as const satisfies Record<string, { src: string; alt: string }>;

export type ImageKey = keyof typeof images;
