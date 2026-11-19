/**
 * MOCK CATALOG — stands in for the API until apps/api exists.
 * Images reuse the brand photos + derived detail crops (public/images/products).
 */
import type { Product, ProductImage, ProductOption, ProductVariant } from '../types';

type RawProduct = Omit<Product, 'rating'>;

const img = (file: string, alt: string): ProductImage => ({ src: `/images/${file}`, alt });

const SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;
type Size = (typeof SIZES)[number];

const sizeOption: ProductOption = { name: 'Size', values: SIZES.map((value) => ({ value })) };

function sizedVariants(
  id: string,
  price: number,
  stock: Partial<Record<Size, number>>,
  compareAtPrice?: number,
): ProductVariant[] {
  return SIZES.map((size) => ({
    id: `${id}-${size.toLowerCase()}`,
    sku: `${id.toUpperCase()}-${size}`,
    options: { Size: size },
    price,
    compareAtPrice,
    stock: stock[size] ?? 0,
  }));
}

function singleVariant(
  id: string,
  price: number,
  stock: number,
  compareAtPrice?: number,
): ProductVariant[] {
  return [
    { id: `${id}-default`, sku: id.toUpperCase(), options: {}, price, compareAtPrice, stock },
  ];
}

function shadeOption(shades: readonly (readonly [string, string, number])[]): ProductOption {
  return { name: 'Shade', values: shades.map(([value, swatch]) => ({ value, swatch })) };
}

function shadeVariants(
  id: string,
  price: number,
  shades: readonly (readonly [string, string, number])[],
  compareAtPrice?: number,
): ProductVariant[] {
  return shades.map(([shade, , stock], i) => ({
    id: `${id}-${i + 1}`,
    sku: `${id.toUpperCase()}-${String(i + 1).padStart(2, '0')}`,
    options: { Shade: shade },
    price,
    compareAtPrice,
    stock,
  }));
}

const unstitchedCare = { label: 'Care', value: 'Dry clean recommended. Iron on reverse.' };
const stitchedCare = { label: 'Care', value: 'Dry clean only. Store folded in a cool, dry place.' };

const lipstickShades = [
  ['Ruby Red', '#9b1b30', 14],
  ['Rosewood', '#8e4a49', 9],
  ['Nude Petal', '#c08a7a', 0],
  ['Berry Wine', '#5e1a2e', 6],
] as const;

const foundationShades = [
  ['110 Porcelain', '#f1d3bd', 5],
  ['220 Warm Beige', '#e0b590', 11],
  ['330 Golden Sand', '#c99a6e', 8],
  ['440 Honey', '#a87449', 3],
] as const;

const compactShades = [
  ['Light', '#ecc9ad', 10],
  ['Medium', '#d9ad88', 12],
  ['Tan', '#b88660', 4],
] as const;

export const rawProducts: readonly RawProduct[] = [
  // ───────────────────────── Unstitched ─────────────────────────
  {
    id: 'unst-001',
    slug: 'noor-e-zar-embroidered-lawn-3-piece',
    name: 'Noor-e-Zar Embroidered Lawn 3-Piece',
    category: 'unstitched',
    shortDescription: 'Jet-black lawn with dense gold zari embroidery and a chiffon dupatta.',
    description: [
      'Noor-e-Zar pairs a deep black lawn shirt with intricate gold zari embroidery along the neckline, front panel and sleeves.',
      'Completed with dyed trousers and a lightweight embroidered chiffon dupatta — an effortless choice for dawats and festive evenings.',
    ],
    images: [
      img('unstitched.jpg', 'Noor-e-Zar 3-piece suit, folded'),
      img('products/unstitched-embroidery.jpg', 'Close-up of gold zari embroidery on black lawn'),
      img('products/unstitched-border.jpg', 'Embroidered border detail'),
      img('products/model-outfit.jpg', 'Styled look in black and gold'),
    ],
    options: [],
    variants: singleVariant('unst-001', 6490, 18, 7990),
    details: [
      { label: 'Fabric', value: 'Lawn shirt · Chiffon dupatta · Cambric trouser' },
      { label: 'Pieces', value: '3-Piece (Shirt, Dupatta, Trouser)' },
      { label: 'Shirt', value: '3.0 m embroidered front, back & sleeves' },
      { label: 'Work', value: 'Gold zari & sequin embroidery' },
      unstitchedCare,
    ],
    tags: ['lawn', 'black', 'gold', 'festive', '3-piece'],
    occasions: ['eid', 'dawat'],
    featured: true,
    bestseller: true,
    createdAt: '2026-11-08T10:00:00.000Z',
  },
  {
    id: 'unst-002',
    slug: 'ivory-dream-embroidered-organza-3-piece',
    name: 'Ivory Dream Embroidered Organza 3-Piece',
    category: 'unstitched',
    shortDescription: 'Soft beige organza with tonal gold floral embroidery.',
    description: [
      'A delicate ivory-beige organza shirt layered with tonal gold floral motifs and a scalloped border.',
      'Comes with a matching organza dupatta and raw silk trouser fabric.',
    ],
    images: [
      img('products/unstitched-beige.jpg', 'Ivory organza suit with gold floral embroidery'),
      img('unstitched.jpg', 'Suit shown folded with coordinating pieces'),
      img('products/unstitched-embroidery.jpg', 'Embroidery close-up'),
    ],
    options: [],
    variants: singleVariant('unst-002', 8990, 7),
    details: [
      { label: 'Fabric', value: 'Organza shirt & dupatta · Raw silk trouser' },
      { label: 'Pieces', value: '3-Piece' },
      { label: 'Work', value: 'Tonal gold thread & pearl embroidery' },
      unstitchedCare,
    ],
    tags: ['organza', 'beige', 'gold', 'formal', '3-piece'],
    occasions: ['wedding', 'dawat'],
    featured: true,
    createdAt: '2026-10-28T10:00:00.000Z',
  },
  {
    id: 'unst-003',
    slug: 'midnight-tilla-work-lawn-2-piece',
    name: 'Midnight Tilla Work Lawn 2-Piece',
    category: 'unstitched',
    shortDescription: 'Everyday-luxe black lawn with fine tilla buttis.',
    description: [
      'Fine tilla buttis scattered over breathable black lawn, finished with a broad embroidered hem border.',
      'A versatile 2-piece for work, family gatherings and casual dinners.',
    ],
    images: [
      img('products/unstitched-border.jpg', 'Black lawn with tilla buttis'),
      img('products/unstitched-embroidery.jpg', 'Tilla embroidery close-up'),
      img('unstitched.jpg', 'Folded 2-piece suit'),
    ],
    options: [],
    variants: singleVariant('unst-003', 3490, 26),
    details: [
      { label: 'Fabric', value: 'Lawn shirt · Cambric trouser' },
      { label: 'Pieces', value: '2-Piece (Shirt, Trouser)' },
      { label: 'Work', value: 'Tilla buttis with embroidered hem' },
      unstitchedCare,
    ],
    tags: ['lawn', 'black', 'casual', '2-piece'],
    occasions: ['everyday'],
    bestseller: true,
    createdAt: '2026-08-14T10:00:00.000Z',
  },
  {
    id: 'unst-004',
    slug: 'siyah-chiffon-gold-zari-suit',
    name: 'Siyah Chiffon Gold Zari Suit',
    category: 'unstitched',
    shortDescription: 'Sheer black chiffon with a heavily embroidered neckline.',
    description: [
      'Sheer black chiffon with a statement embroidered neckline and sleeves — the classic Pakistani formal silhouette.',
      'Includes inner fabric, a jacquard dupatta and silk trouser fabric.',
    ],
    images: [
      img('products/model-outfit.jpg', 'Black chiffon suit with gold zari'),
      img('products/model-portrait.jpg', 'Styled with statement earrings'),
      img('products/unstitched-embroidery.jpg', 'Neckline embroidery detail'),
    ],
    options: [],
    variants: singleVariant('unst-004', 7490, 3, 8990),
    details: [
      { label: 'Fabric', value: 'Chiffon shirt · Jacquard dupatta · Silk trouser' },
      { label: 'Pieces', value: '3-Piece + inner' },
      { label: 'Work', value: 'Zari, sequins & cut-dana' },
      unstitchedCare,
    ],
    tags: ['chiffon', 'black', 'gold', 'formal', '3-piece'],
    occasions: ['dawat', 'wedding'],
    featured: true,
    createdAt: '2026-11-15T10:00:00.000Z',
  },
  {
    id: 'unst-005',
    slug: 'gulnar-jacquard-unstitched-3-piece',
    name: 'Gulnar Jacquard Unstitched 3-Piece',
    category: 'unstitched',
    shortDescription: 'Woven jacquard with gold floral jaal and embroidered borders.',
    description: [
      'Rich woven jacquard with an all-over floral jaal, paired with embroidered borders for the daman and sleeves.',
    ],
    images: [
      img('products/unstitched-embroidery.jpg', 'Gulnar jacquard suit'),
      img('products/unstitched-beige.jpg', 'Border and jaal details'),
    ],
    options: [],
    variants: singleVariant('unst-005', 5290, 0),
    details: [
      { label: 'Fabric', value: 'Jacquard shirt · Organza dupatta · Cambric trouser' },
      { label: 'Pieces', value: '3-Piece' },
      unstitchedCare,
    ],
    tags: ['jacquard', 'black', 'gold', '3-piece'],
    occasions: ['dawat', 'eid'],
    createdAt: '2026-07-02T10:00:00.000Z',
  },
  {
    id: 'unst-006',
    slug: 'zarnigar-velvet-shawl-suit',
    name: 'Zarnigar Velvet Shawl Suit',
    category: 'unstitched',
    shortDescription: 'Winter velvet shirt with an embroidered pashmina-style shawl.',
    description: [
      'A plush velvet shirt with gold embroidered neckline, paired with a warm embroidered shawl for winter weddings.',
    ],
    images: [
      img('products/unstitched-border.jpg', 'Velvet shawl suit'),
      img('unstitched.jpg', 'Folded suit with shawl'),
    ],
    options: [],
    variants: singleVariant('unst-006', 11990, 5),
    details: [
      { label: 'Fabric', value: 'Velvet shirt · Embroidered shawl · Silk trouser' },
      { label: 'Pieces', value: '3-Piece' },
      { label: 'Season', value: 'Winter' },
      unstitchedCare,
    ],
    tags: ['velvet', 'winter', 'formal', '3-piece'],
    occasions: ['wedding', 'dawat'],
    createdAt: '2026-11-17T10:00:00.000Z',
  },

  // ───────────────────────── Stitched ─────────────────────────
  {
    id: 'stch-001',
    slug: 'maroon-ruby-embroidered-kurta',
    name: 'Maroon Ruby Embroidered Kurta',
    category: 'stitched',
    shortDescription: 'Deep maroon chiffon kurta with gold embroidery and sheer sleeves.',
    description: [
      'A deep maroon kurta with gold and beige embroidery on the neckline, front panel and sleeves, finished with a scalloped embroidered hem.',
      'Fully lined, with sheer chiffon sleeves. Pair with gold heels and jhumkas for weddings and dawats.',
    ],
    images: [
      img('stitched.jpg', 'Maroon embroidered kurta on a hanger'),
      img('products/stitched-neckline.jpg', 'Neckline embroidery'),
      img('products/stitched-hem.jpg', 'Scalloped embroidered hem'),
      img('products/stitched-sleeve.jpg', 'Sheer embroidered sleeve'),
    ],
    options: [sizeOption],
    variants: sizedVariants('stch-001', 9990, { XS: 2, S: 6, M: 8, L: 4, XL: 0 }, 12500),
    details: [
      { label: 'Fabric', value: 'Chiffon with silk inner' },
      { label: 'Length', value: '46 inches (Size M)' },
      { label: 'Fit', value: 'Straight, true to size' },
      { label: 'Work', value: 'Gold zari, sequins & pearls' },
      stitchedCare,
    ],
    tags: ['chiffon', 'maroon', 'gold', 'formal', 'kurta'],
    occasions: ['eid', 'dawat'],
    sizeGuide: 'stitched',
    featured: true,
    bestseller: true,
    createdAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'stch-002',
    slug: 'black-sheesha-chiffon-frock',
    name: 'Black Sheesha Chiffon Frock',
    category: 'stitched',
    shortDescription: 'Flared black chiffon frock with gold embroidery and mirror work.',
    description: [
      'A graceful flared frock in black chiffon with gold embroidery and delicate sheesha (mirror) accents.',
    ],
    images: [
      img('products/model-portrait.jpg', 'Black chiffon frock with gold embroidery'),
      img('products/model-outfit.jpg', 'Embroidery and sleeve detail'),
      img('products/model-earring.jpg', 'Styled with gold chandbali earrings'),
    ],
    options: [sizeOption],
    variants: sizedVariants('stch-002', 12500, { S: 3, M: 5, L: 2, XL: 1 }),
    details: [
      { label: 'Fabric', value: 'Chiffon with grip inner' },
      { label: 'Length', value: '52 inches (Size M)' },
      { label: 'Fit', value: 'Fitted bodice, flared skirt' },
      stitchedCare,
    ],
    tags: ['chiffon', 'black', 'gold', 'formal', 'frock'],
    occasions: ['wedding', 'dawat'],
    sizeGuide: 'stitched',
    featured: true,
    createdAt: '2026-11-12T10:00:00.000Z',
  },
  {
    id: 'stch-003',
    slug: 'zarqa-gold-embroidered-kurta-set',
    name: 'Zarqa Gold Embroidered Kurta Set',
    category: 'stitched',
    shortDescription: 'Kurta, trouser and dupatta set with all-over gold buttis.',
    description: [
      'A ready-to-wear 3-piece set: embroidered kurta, straight trousers and a chiffon dupatta with a gold border.',
    ],
    images: [
      img('products/stitched-neckline.jpg', 'Zarqa kurta set'),
      img('stitched.jpg', 'Full-length view'),
      img('products/stitched-hem.jpg', 'Hem border'),
    ],
    options: [sizeOption],
    variants: sizedVariants('stch-003', 8490, { XS: 4, S: 7, M: 9, L: 6, XL: 3 }),
    details: [
      { label: 'Fabric', value: 'Lawn kurta · Cambric trouser · Chiffon dupatta' },
      { label: 'Pieces', value: '3-Piece' },
      stitchedCare,
    ],
    tags: ['lawn', 'maroon', 'gold', '3-piece', 'kurta'],
    occasions: ['eid', 'everyday'],
    sizeGuide: 'stitched',
    createdAt: '2026-09-20T10:00:00.000Z',
  },
  {
    id: 'stch-004',
    slug: 'mehr-formal-maxi',
    name: 'Mehr Formal Maxi',
    category: 'stitched',
    shortDescription: 'Floor-length maxi with an embroidered bodice and sheer sleeves.',
    description: [
      'Mehr is a floor-length formal maxi with an embroidered bodice, sheer sleeves and a softly flared skirt.',
    ],
    images: [
      img('products/stitched-hem.jpg', 'Mehr formal maxi'),
      img('products/stitched-sleeve.jpg', 'Sleeve embroidery'),
      img('stitched.jpg', 'Full view'),
    ],
    options: [sizeOption],
    variants: sizedVariants('stch-004', 14990, { S: 2, M: 3, L: 2 }, 17990),
    details: [
      { label: 'Fabric', value: 'Net with silk lining' },
      { label: 'Length', value: '58 inches (Size M)' },
      stitchedCare,
    ],
    tags: ['net', 'maroon', 'formal', 'maxi', 'bridal'],
    occasions: ['wedding'],
    sizeGuide: 'stitched',
    createdAt: '2026-10-10T10:00:00.000Z',
  },
  {
    id: 'stch-005',
    slug: 'amber-lawn-straight-shirt',
    name: 'Amber Lawn Straight Shirt',
    category: 'stitched',
    shortDescription: 'Everyday embroidered lawn shirt with a straight cut.',
    description: [
      'A breathable everyday lawn shirt with embroidered neckline and sleeves in a clean straight cut.',
    ],
    images: [
      img('products/stitched-sleeve.jpg', 'Amber lawn shirt'),
      img('products/stitched-neckline.jpg', 'Neckline detail'),
    ],
    options: [sizeOption],
    variants: sizedVariants('stch-005', 4990, { XS: 8, S: 12, M: 15, L: 10, XL: 6 }),
    details: [
      { label: 'Fabric', value: 'Lawn' },
      { label: 'Length', value: '42 inches (Size M)' },
      stitchedCare,
    ],
    tags: ['lawn', 'casual', 'shirt'],
    occasions: ['everyday'],
    sizeGuide: 'stitched',
    bestseller: true,
    createdAt: '2026-06-18T10:00:00.000Z',
  },

  // ───────────────────────── Makeup ─────────────────────────
  {
    id: 'mkup-001',
    slug: 'velvet-matte-lipstick',
    name: 'Velvet Matte Lipstick',
    category: 'makeup',
    shortDescription: 'Long-wear matte lipstick in a gold-embossed case.',
    description: [
      'A creamy, highly pigmented matte lipstick that glides on smoothly and stays comfortable for up to 8 hours.',
      'Housed in a black and gold floral-embossed case.',
    ],
    images: [
      img('products/makeup-lipstick.jpg', 'Velvet Matte Lipstick in Ruby Red'),
      img('makeup.jpg', 'Lipstick with the AS makeup collection'),
    ],
    options: [shadeOption(lipstickShades)],
    variants: shadeVariants('mkup-001', 1290, lipstickShades, 1490),
    details: [
      { label: 'Finish', value: 'Matte' },
      { label: 'Net weight', value: '3.8 g' },
      { label: 'Wear', value: 'Up to 8 hours' },
    ],
    tags: ['lipstick', 'matte', 'red'],
    occasions: ['everyday', 'dawat'],
    featured: true,
    bestseller: true,
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'mkup-002',
    slug: 'long-wear-liquid-foundation-spf-30',
    name: 'Long Wear Liquid Foundation SPF 30',
    category: 'makeup',
    shortDescription: 'Natural-finish, medium-to-full coverage with SPF 30.',
    description: [
      'A lightweight liquid foundation with buildable medium-to-full coverage, a natural finish and SPF 30.',
    ],
    images: [
      img('products/makeup-foundation.jpg', 'Long Wear Liquid Foundation bottle'),
      img('makeup.jpg', 'Foundation with the AS makeup collection'),
    ],
    options: [shadeOption(foundationShades)],
    variants: shadeVariants('mkup-002', 2490, foundationShades),
    details: [
      { label: 'Finish', value: 'Natural' },
      { label: 'Coverage', value: 'Medium to full' },
      { label: 'Volume', value: '30 ml' },
      { label: 'SPF', value: '30' },
    ],
    tags: ['foundation', 'base', 'spf'],
    occasions: ['everyday', 'wedding'],
    featured: true,
    createdAt: '2026-09-02T10:00:00.000Z',
  },
  {
    id: 'mkup-003',
    slug: 'silk-finish-compact-powder',
    name: 'Silk Finish Compact Powder',
    category: 'makeup',
    shortDescription: 'Finely milled pressed powder with a mirror compact.',
    description: [
      'Finely milled pressed powder that sets makeup and controls shine for a soft, silky finish.',
    ],
    images: [
      img('products/makeup-compact.jpg', 'Silk Finish Compact Powder, open'),
      img('makeup.jpg', 'Compact with the AS makeup collection'),
    ],
    options: [shadeOption(compactShades)],
    variants: shadeVariants('mkup-003', 1690, compactShades),
    details: [
      { label: 'Finish', value: 'Soft matte' },
      { label: 'Net weight', value: '12 g' },
    ],
    tags: ['powder', 'compact', 'base'],
    occasions: ['everyday'],
    createdAt: '2026-08-22T10:00:00.000Z',
  },
  {
    id: 'mkup-004',
    slug: 'pro-kabuki-powder-brush',
    name: 'Pro Kabuki Powder Brush',
    category: 'makeup',
    shortDescription: 'Ultra-soft synthetic bristles with a gold ferrule.',
    description: [
      'A dense, ultra-soft synthetic brush for seamless powder and foundation blending.',
    ],
    images: [
      img('products/makeup-brush.jpg', 'Pro Kabuki Powder Brush'),
      img('makeup.jpg', 'Brush with the AS makeup collection'),
    ],
    options: [],
    variants: singleVariant('mkup-004', 899, 30),
    details: [
      { label: 'Bristles', value: 'Synthetic, cruelty-free' },
      { label: 'Handle', value: 'Black lacquer with gold floral print' },
    ],
    tags: ['brush', 'tools'],
    occasions: ['everyday'],
    createdAt: '2026-11-10T10:00:00.000Z',
  },
  {
    id: 'mkup-005',
    slug: 'glam-essentials-makeup-set',
    name: 'Glam Essentials Makeup Set',
    category: 'makeup',
    shortDescription: 'Lipstick, foundation, compact and brush — gift-boxed.',
    description: [
      'Everything for a complete look in one gift box: Velvet Matte Lipstick (Ruby Red), Long Wear Foundation, Silk Finish Compact and the Pro Kabuki Brush.',
    ],
    images: [
      img('makeup.jpg', 'Glam Essentials Makeup Set'),
      img('products/makeup-lipstick.jpg', 'Included lipstick'),
      img('products/makeup-compact.jpg', 'Included compact'),
      img('products/makeup-brush.jpg', 'Included brush'),
    ],
    options: [],
    variants: singleVariant('mkup-005', 5490, 9, 6370),
    details: [
      { label: 'Includes', value: 'Lipstick · Foundation · Compact · Brush' },
      { label: 'Packaging', value: 'Black & gold gift box' },
    ],
    tags: ['set', 'gift'],
    occasions: ['wedding', 'eid'],
    featured: true,
    createdAt: '2026-11-14T10:00:00.000Z',
  },
];
