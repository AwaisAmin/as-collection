/**
 * Development seed: the storefront's current catalog and content, as real database rows.
 *
 *   pnpm --filter @as/api db:seed          (or: pnpm exec prisma db seed)
 *
 * Idempotent and CREATE-ONLY: records are keyed by natural keys (slug, code, sku, setting key)
 * and existing rows are never overwritten, so re-running never clobbers admin edits.
 */
import { existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';

import { type Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
import {
  type ContentSnapshot,
  loadCatalog,
  loadContent,
  type ProductSnapshot,
} from './snapshot.js';

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set (see apps/api/.env.example).');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const toMinor = (rupees: number) => Math.round(rupees * 100);
const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// ─── Attribute definitions (derived from the mock catalog's tags and options) ───

interface AttributeDef {
  code: string;
  name: string;
  type: 'SELECT' | 'MULTI_SELECT';
  scope: 'PRODUCT' | 'VARIANT';
  values: readonly { value: string; label: string; swatch?: string }[];
}

const productAttributes: readonly AttributeDef[] = [
  {
    code: 'fabric',
    name: 'Fabric',
    type: 'SELECT',
    scope: 'PRODUCT',
    values: ['lawn', 'chiffon', 'organza', 'velvet', 'jacquard', 'net'].map((v) => ({
      value: v,
      label: v.charAt(0).toUpperCase() + v.slice(1),
    })),
  },
  {
    code: 'color',
    name: 'Colour',
    type: 'MULTI_SELECT',
    scope: 'PRODUCT',
    values: [
      { value: 'black', label: 'Black', swatch: '#111010' },
      { value: 'beige', label: 'Beige', swatch: '#d9c3a5' },
      { value: 'maroon', label: 'Maroon', swatch: '#6b1d2a' },
      { value: 'gold', label: 'Gold', swatch: '#c9a35e' },
      { value: 'red', label: 'Red', swatch: '#b3202f' },
    ],
  },
  {
    code: 'pieces',
    name: 'Pieces',
    type: 'SELECT',
    scope: 'PRODUCT',
    values: [
      { value: '2-piece', label: '2-Piece' },
      { value: '3-piece', label: '3-Piece' },
    ],
  },
  {
    code: 'style',
    name: 'Style',
    type: 'SELECT',
    scope: 'PRODUCT',
    values: [
      { value: 'kurta', label: 'Kurta' },
      { value: 'frock', label: 'Frock' },
      { value: 'maxi', label: 'Maxi' },
      { value: 'shirt', label: 'Shirt' },
    ],
  },
  {
    code: 'product-type',
    name: 'Product type',
    type: 'SELECT',
    scope: 'PRODUCT',
    values: [
      { value: 'lipstick', label: 'Lipstick' },
      { value: 'foundation', label: 'Foundation' },
      { value: 'powder', label: 'Powder & compact' },
      { value: 'brush', label: 'Brushes & tools' },
      { value: 'set', label: 'Gift sets' },
    ],
  },
];

/** Which attributes each category offers as filters / form fields, in order. */
const categoryAttributeCodes: Record<string, readonly string[]> = {
  unstitched: ['fabric', 'color', 'pieces'],
  stitched: ['size', 'fabric', 'color', 'style'],
  makeup: ['product-type', 'shade', 'color'],
};

/** Variant axes, collected from every product's options (Size, Shade). */
function variantAttributes(products: readonly ProductSnapshot[]): AttributeDef[] {
  const byName = new Map<string, Map<string, { label: string; swatch?: string }>>();
  for (const product of products) {
    for (const option of product.options) {
      const values =
        byName.get(option.name) ?? new Map<string, { label: string; swatch?: string }>();
      for (const v of option.values)
        values.set(slugify(v.value), { label: v.value, swatch: v.swatch });
      byName.set(option.name, values);
    }
  }
  return [...byName].map(([name, values]) => ({
    code: slugify(name),
    name,
    type: 'SELECT' as const,
    scope: 'VARIANT' as const,
    values: [...values].map(([value, v]) => ({ value, ...v })),
  }));
}

// ─── Media ───

const webPublic = join(import.meta.dirname, '..', '..', '..', 'web', 'public');
const mimeTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** Storage key mirrors the storefront path today (`images/…`); uploads later go to S3. */
async function ensureMedia(image: { src: string; alt: string }): Promise<string> {
  const storageKey = image.src.replace(/^\//, '');
  const file = join(webPublic, storageKey);
  const sizeBytes = existsSync(file) ? statSync(file).size : 1;
  const media = await prisma.media.upsert({
    where: { storageKey },
    update: {},
    create: {
      storageKey,
      visibility: 'PUBLIC',
      mimeType: mimeTypes[extname(storageKey).toLowerCase()] ?? 'application/octet-stream',
      sizeBytes,
      alt: image.alt,
    },
    select: { id: true },
  });
  return media.id;
}

// ─── Seeders ───

type AttributeIndex = Map<string, { id: string; values: Map<string, string> }>;

async function seedAttributes(defs: readonly AttributeDef[]): Promise<AttributeIndex> {
  const index: AttributeIndex = new Map();
  for (const [position, def] of defs.entries()) {
    const attribute = await prisma.attribute.upsert({
      where: { code: def.code },
      update: {},
      create: { code: def.code, name: def.name, type: def.type, scope: def.scope, position },
    });
    const values = new Map<string, string>();
    for (const [valuePosition, v] of def.values.entries()) {
      const row = await prisma.attributeValue.upsert({
        where: { attributeId_value: { attributeId: attribute.id, value: v.value } },
        update: {},
        create: {
          attributeId: attribute.id,
          value: v.value,
          label: v.label,
          swatch: v.swatch,
          position: valuePosition,
        },
      });
      values.set(v.value, row.id);
    }
    index.set(def.code, { id: attribute.id, values });
  }
  return index;
}

async function seedCategories(
  categories: ReturnType<typeof loadCatalog>['categories'],
  attributes: AttributeIndex,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const [position, c] of categories.entries()) {
    const existing = await prisma.category.findUnique({ where: { slug: c.slug } });
    if (existing) {
      ids.set(c.slug, existing.id);
      continue;
    }
    const [imageId, bannerImageId] = await Promise.all([
      ensureMedia({ src: `/images/${c.image}.jpg`, alt: c.name }),
      ensureMedia(c.banner.image),
    ]);
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.category.create({
        data: {
          slug: c.slug,
          name: c.name,
          path: '/',
          position,
          imageId,
          bannerImageId,
          banner: {
            eyebrow: c.banner.eyebrow,
            description: c.banner.description,
            focus: c.banner.focus,
          },
          attributes: {
            create: (categoryAttributeCodes[c.slug] ?? []).flatMap((code, i) => {
              const attribute = attributes.get(code);
              return attribute ? [{ attributeId: attribute.id, position: i }] : [];
            }),
          },
        },
      });
      return tx.category.update({ where: { id: row.id }, data: { path: `/${row.id}/` } });
    });
    ids.set(c.slug, created.id);
  }
  return ids;
}

/** Product-level attribute values derived from tags (fabric, colour, pieces, style, type). */
function productAttributeRows(product: ProductSnapshot, attributes: AttributeIndex) {
  const rows: Prisma.ProductAttributeValueCreateWithoutProductInput[] = [];
  for (const def of productAttributes) {
    const attribute = attributes.get(def.code);
    if (!attribute) continue;
    for (const tag of product.tags) {
      const valueId = attribute.values.get(tag);
      if (!valueId) continue;
      rows.push({
        attribute: { connect: { id: attribute.id } },
        value: { connect: { id: valueId } },
      });
      if (def.type === 'SELECT') break; // single-valued
    }
  }
  return rows;
}

async function seedProducts(
  products: readonly ProductSnapshot[],
  categoryIds: Map<string, string>,
  attributes: AttributeIndex,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>(); // snapshot id → db id
  for (const p of products) {
    const primaryCategoryId = categoryIds.get(p.category);
    if (!primaryCategoryId) throw new Error(`Unknown category "${p.category}" on ${p.slug}`);

    const existing = await prisma.product.findUnique({
      where: { slug: p.slug },
      select: { id: true },
    });
    if (existing) {
      ids.set(p.id, existing.id);
      continue;
    }

    const mediaIds = await Promise.all(p.images.map((image) => ensureMedia(image)));
    const created = await prisma.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        description: p.description.join('\n\n'),
        status: 'ACTIVE',
        primaryCategoryId,
        specifications: p.details,
        sizeGuide: p.sizeGuide ?? null,
        isFeatured: p.featured ?? false,
        isBestseller: p.bestseller ?? false,
        publishedAt: new Date(p.createdAt),
        createdAt: new Date(p.createdAt),
        media: {
          create: mediaIds.map((mediaId, position) => ({
            mediaId,
            position,
            alt: p.images[position]?.alt,
          })),
        },
        tags: {
          create: p.tags.map((tag) => ({
            tag: { connectOrCreate: { where: { slug: tag }, create: { slug: tag, name: tag } } },
          })),
        },
        attributes: { create: productAttributeRows(p, attributes) },
        variants: {
          create: p.variants.map((v, position) => ({
            sku: v.sku,
            title: Object.values(v.options).join(' / ') || null,
            priceMinor: toMinor(v.price),
            compareAtPriceMinor: v.compareAtPrice ? toMinor(v.compareAtPrice) : null,
            position,
            inventory: { create: { onHand: v.stock } },
            options: {
              create: Object.entries(v.options).map(([name, value]) => {
                const attribute = attributes.get(slugify(name));
                const valueId = attribute?.values.get(slugify(value));
                if (!attribute || !valueId) throw new Error(`Unknown option ${name}=${value}`);
                return { attributeId: attribute.id, valueId };
              }),
            },
          })),
        },
      },
      select: { id: true },
    });
    ids.set(p.id, created.id);
  }
  return ids;
}

async function seedReviews(
  reviews: ReturnType<typeof loadCatalog>['reviews'],
  productIds: Map<string, string>,
): Promise<void> {
  const byProduct = Map.groupBy(reviews, (r) => r.productId);
  for (const [snapshotId, list] of byProduct) {
    const productId = productIds.get(snapshotId);
    if (!productId) continue;
    if ((await prisma.review.count({ where: { productId } })) > 0) continue;
    await prisma.review.createMany({
      data: list.map((r) => ({
        productId,
        authorName: r.author,
        city: r.city,
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: 'APPROVED' as const,
        isVerifiedPurchase: r.verifiedPurchase,
        helpfulCount: r.helpfulCount,
        createdAt: new Date(r.createdAt),
        moderatedAt: new Date(r.createdAt),
      })),
    });
  }
  // product rating_count / rating_sum / rating_average are maintained by a database trigger.
}

async function seedCollections(
  content: ContentSnapshot,
  products: readonly ProductSnapshot[],
  productIds: Map<string, string>,
): Promise<void> {
  for (const [position, occasion] of content.occasions.entries()) {
    if (await prisma.collection.findUnique({ where: { slug: occasion.slug } })) continue;
    const imageId = await ensureMedia(occasion.image);
    const members = products.filter((p) => p.occasions.includes(occasion.slug));
    await prisma.collection.create({
      data: {
        slug: occasion.slug,
        name: occasion.name,
        description: occasion.blurb,
        type: 'MANUAL',
        imageId,
        position,
        products: {
          create: members.flatMap((p, i) => {
            const productId = productIds.get(p.id);
            return productId ? [{ productId, position: i }] : [];
          }),
        },
      },
    });
  }

  await prisma.collection.upsert({
    where: { slug: 'festive-sale' },
    update: {},
    create: {
      slug: 'festive-sale',
      name: 'Festive Sale',
      description: 'Everything currently on sale.',
      type: 'AUTOMATED',
      rules: { all: [{ field: 'onSale', op: 'eq', value: true }] },
      position: content.occasions.length,
      endsAt: content.promotion ? new Date(content.promotion.endsAt) : null,
    },
  });
}

async function seedSettings(content: ContentSnapshot): Promise<void> {
  const { site } = content;
  const settings: Record<string, Prisma.InputJsonValue> = {
    'store.profile': {
      name: site.name,
      shortName: site.shortName,
      tagline: site.tagline,
      description: site.description,
      locale: site.locale,
      currency: site.currency,
    },
    'store.contact': site.contact as Prisma.InputJsonObject,
    'store.socials': content.socials,
    shipping: {
      flatFeeMinor: toMinor(site.shippingFee),
      freeShippingThresholdMinor: toMinor(site.freeShippingThreshold),
      returnWindowDays: site.returnWindowDays,
    },
    // Placeholder account details until the owner provides real ones.
    'payments.transfer-accounts': {
      isPlaceholder: true,
      ...content.payments,
    },
    'home.trust-features': content.trustFeatures as Prisma.InputJsonArray,
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}

async function seedHomePage(
  content: ContentSnapshot,
  categorySlugs: readonly string[],
): Promise<void> {
  if (await prisma.page.findUnique({ where: { slug: 'home' } })) return;

  const sections: { type: string; settings: Prisma.InputJsonObject; endsAt?: Date }[] = [
    { type: 'hero', settings: { variant: 'reference-design' } },
    { type: 'category-grid', settings: { categorySlugs: [...categorySlugs] } },
    { type: 'trust-bar', settings: { settingKey: 'home.trust-features' } },
    {
      type: 'product-carousel',
      settings: {
        title: 'New Arrivals',
        subtitle: 'Fresh lawn, festive formals and beauty picks — just landed.',
        source: { kind: 'newest' },
        limit: 8,
        cta: { label: 'View all new arrivals', href: '/shop?sort=newest' },
      },
    },
    {
      type: 'product-tabs',
      settings: {
        title: 'Best Sellers',
        subtitle: 'The pieces our customers keep coming back for.',
        source: { kind: 'bestsellers' },
        tabs: categorySlugs.map((slug) => ({ categorySlug: slug })),
        limit: 4,
      },
    },
    { type: 'recently-viewed', settings: { minItems: 2 } },
    ...(content.promotion
      ? [
          {
            type: 'sale-banner',
            settings: { ...content.promotion } as Prisma.InputJsonObject,
            endsAt: new Date(content.promotion.endsAt),
          },
        ]
      : []),
    {
      type: 'collection-grid',
      settings: {
        title: 'Shop by Occasion',
        subtitle: 'From everyday lawn to wedding-season showstoppers.',
        collectionSlugs: content.occasions.map((o) => o.slug),
      },
    },
    ...(content.look
      ? [
          {
            type: 'shop-the-look',
            settings: {
              title: 'Shop the Look',
              subtitle: 'Tap the dots to see every piece in this look.',
              look: content.look,
            } as Prisma.InputJsonObject,
          },
        ]
      : []),
    { type: 'testimonials', settings: { title: 'Loved by Our Customers', limit: 8 } },
    {
      type: 'brand-story',
      settings: {
        title: 'Our Story',
        script: 'Because You Deserve the Best',
        image: {
          src: '/images/brand/story.jpg',
          alt: 'Close-up of gold floral embroidery on black fabric',
        },
        cta: { label: 'Read our story', href: '/about' },
      },
    },
    {
      type: 'instagram-gallery',
      settings: {
        title: 'Follow Us on Instagram',
        subtitle: 'New drops, styling ideas and behind-the-scenes — every week.',
        ...content.instagram,
      },
    },
  ];

  await prisma.page.create({
    data: {
      slug: 'home',
      title: 'Home',
      status: 'PUBLISHED',
      sections: {
        create: sections.map((s, position) => ({ ...s, position })),
      },
    },
  });
}

async function seedMenus(content: ContentSnapshot): Promise<void> {
  const { mainNav, footerNav, shopMegaMenu } = content.navigation;

  if (!(await prisma.menu.findUnique({ where: { key: 'main' } }))) {
    await prisma.menu.create({ data: { key: 'main', name: 'Main navigation' } }).then((menu) =>
      Promise.all(
        mainNav.map((item, position) =>
          prisma.menuItem.create({
            data: {
              menuId: menu.id,
              label: item.label,
              url: item.href,
              position,
              children: {
                create: (item.children ?? []).map((child, i) => ({
                  menuId: menu.id,
                  label: child.label,
                  url: child.href,
                  position: i,
                })),
              },
            },
          }),
        ),
      ),
    );
  }

  if (!(await prisma.menu.findUnique({ where: { key: 'footer' } }))) {
    await prisma.menu.create({
      data: {
        key: 'footer',
        name: 'Footer links',
        items: {
          create: footerNav.map((l, position) => ({ label: l.label, url: l.href, position })),
        },
      },
    });
  }

  if (!(await prisma.menu.findUnique({ where: { key: 'shop-mega' } }))) {
    const menu = await prisma.menu.create({ data: { key: 'shop-mega', name: 'Shop mega menu' } });
    const groups = [
      ...shopMegaMenu.columns.map((c) => ({ ...c, settings: { kind: 'category-column' } })),
      {
        label: 'Shop by occasion',
        href: '/shop',
        links: shopMegaMenu.occasions,
        settings: { kind: 'link-group' },
      },
      {
        label: 'Highlights',
        href: '/shop',
        links: shopMegaMenu.highlights,
        settings: { kind: 'link-group' },
      },
    ];
    for (const [position, group] of groups.entries()) {
      await prisma.menuItem.create({
        data: {
          menuId: menu.id,
          label: group.label,
          url: group.href,
          position,
          settings: group.settings,
          children: {
            create: group.links.map((l, i) => ({
              menuId: menu.id,
              label: l.label,
              url: l.href,
              position: i,
            })),
          },
        },
      });
    }
    await prisma.menuItem.create({
      data: {
        menuId: menu.id,
        label: 'Feature card',
        position: groups.length,
        settings: { kind: 'feature-card', source: 'active-promotion', fallback: 'new-arrivals' },
      },
    });
  }
}

/** Built-in roles. Fine-grained permissions arrive with the staff module; "*" = everything. */
async function seedRoles(): Promise<void> {
  await prisma.role.upsert({
    where: { key: 'super-admin' },
    update: {},
    create: {
      key: 'super-admin',
      name: 'Super admin',
      description: 'Full access to every part of the admin panel.',
      isSystem: true,
      permissions: { create: [{ permission: '*' }] },
    },
  });
}

async function main(): Promise<void> {
  const started = Date.now();
  const catalog = loadCatalog();
  const content = loadContent();

  const attributes = await seedAttributes([
    ...variantAttributes(catalog.products),
    ...productAttributes,
  ]);
  const categoryIds = await seedCategories(catalog.categories, attributes);
  const productIds = await seedProducts(catalog.products, categoryIds, attributes);
  await seedReviews(catalog.reviews, productIds);
  await seedCollections(content, catalog.products, productIds);
  await seedSettings(content);
  await seedHomePage(
    content,
    catalog.categories.map((c) => c.slug),
  );
  await seedMenus(content);
  await seedRoles();

  const counts = await prisma.$transaction([
    prisma.category.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.review.count(),
    prisma.collection.count(),
    prisma.pageSection.count(),
    prisma.menuItem.count(),
    prisma.setting.count(),
  ]);
  const labels = [
    'categories',
    'products',
    'variants',
    'reviews',
    'collections',
    'page sections',
    'menu items',
    'settings',
  ];
  process.stdout.write(
    `Seed complete in ${Date.now() - started} ms — ${labels.map((l, i) => `${counts[i]} ${l}`).join(', ')}\n`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
