import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';

import {
  facetsQuerySchema,
  listProductsQuerySchema,
  relatedQuerySchema,
  slugSchema,
  variantLookupQuerySchema,
} from './catalog.schemas.js';
import { CatalogService } from './catalog.service.js';

/** Shared caches (CDN, browser) may keep public catalog reads briefly; edits invalidate Redis. */
const PUBLIC_CACHE = 'public, max-age=60, stale-while-revalidate=300';

/**
 * Public, read-only storefront catalog. Prices are integer minor units (paisa).
 * Admin write endpoints live in the admin module and call `CatalogService.invalidate()`.
 */
@ApiTags('Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Category tree (active categories, any depth)' })
  categories() {
    return this.catalog.categoryTree();
  }

  @Get('categories/:slug')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Category page data: banner, breadcrumbs, children, filters' })
  category(@Param('slug', { schema: slugSchema }) slug: string) {
    return this.catalog.categoryDetail(slug);
  }

  @Get('collections')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Live collections (occasions, campaigns)' })
  collections() {
    return this.catalog.collections();
  }

  @Get('collections/:slug')
  @Header('Cache-Control', PUBLIC_CACHE)
  collection(@Param('slug', { schema: slugSchema }) slug: string) {
    return this.catalog.collection(slug);
  }

  @Get('products')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({
    summary: 'Search, filter, sort and paginate products',
    description:
      'Attribute filters: `f.<code>=v1,v2` (e.g. `f.fabric=lawn,chiffon&f.size=m`). ' +
      'Prices (`min`, `max`) in minor units. Sorts: featured, newest, price-asc, price-desc, rating.',
  })
  products(
    @Query({ schema: listProductsQuerySchema }) query: z.output<typeof listProductsQuerySchema>,
  ) {
    return this.catalog.listProducts(query);
  }

  @Get('products/:slug')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Product page: gallery, options, variants, availability, specs' })
  product(@Param('slug', { schema: slugSchema }) slug: string) {
    return this.catalog.productDetail(slug);
  }

  @Get('products/:slug/related')
  @Header('Cache-Control', PUBLIC_CACHE)
  related(
    @Param('slug', { schema: slugSchema }) slug: string,
    @Query({ schema: relatedQuerySchema }) query: z.output<typeof relatedQuerySchema>,
  ) {
    return this.catalog.relatedProducts(slug, query.limit);
  }

  @Get('facets')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({
    summary: 'Filter options with product counts for a category / search / collection',
  })
  facets(@Query({ schema: facetsQuerySchema }) query: z.output<typeof facetsQuerySchema>) {
    return this.catalog.facets(query);
  }

  @Get('variants')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Fresh price & availability for cart / checkout validation (uncached)' })
  variants(
    @Query({ schema: variantLookupQuerySchema }) query: z.output<typeof variantLookupQuerySchema>,
  ) {
    return this.catalog.variantSnapshots(query.ids);
  }
}
