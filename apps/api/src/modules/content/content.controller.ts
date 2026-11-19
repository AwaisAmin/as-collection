import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { slugSchema } from '../catalog/catalog.schemas.js';
import { menuKeySchema } from './content.schemas.js';
import { ContentService } from './content.service.js';

const PUBLIC_CACHE = 'public, max-age=60, stale-while-revalidate=300';

const settingKeySchema = z.string().regex(/^[a-z0-9.-]{1,100}$/);

/** Public, read-only storefront content. Admin edits invalidate the Redis cache (B7). */
@ApiTags('Content')
@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('pages/:slug')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({
    summary: 'A published page and its live sections, in order ("home", "about", …)',
    description:
      'Each section has a `type` (hero, product-carousel, sale-banner, …) and validated ' +
      '`settings`. Scheduled sections appear only inside their window.',
  })
  page(@Param('slug', { schema: slugSchema }) slug: string) {
    return this.content.page(slug);
  }

  @Get('menus/:key')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Navigation menu tree ("main", "shop-mega", "footer")' })
  menu(@Param('key', { schema: menuKeySchema }) key: string) {
    return this.content.menu(key);
  }

  @Get('settings')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({
    summary: 'All public store settings (profile, contact, socials, shipping, payments…)',
  })
  settings() {
    return this.content.settings();
  }

  @Get('settings/:key')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'One public store setting' })
  setting(@Param('key', { schema: settingKeySchema }) key: string) {
    return this.content.setting(key);
  }

  @Get('promotions/active')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'The live campaign (sale banner), or null' })
  async activePromotion() {
    return { promotion: await this.content.activePromotion() };
  }
}
