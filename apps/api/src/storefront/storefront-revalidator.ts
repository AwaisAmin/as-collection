import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../app.module.js';

/** Cache tags the storefront uses (its `POST /api/revalidate` accepts exactly these). */
export type StorefrontTag = 'catalog' | 'content' | 'settings' | 'reviews';

/**
 * Tells the storefront (Next.js) to drop its cached pages for the given tags right after staff
 * edits, instead of waiting for them to expire. Fire-and-forget: never slows down or fails the
 * edit; a missed call only means the storefront refreshes on its own a few minutes later.
 */
@Injectable()
export class StorefrontRevalidator {
  private readonly logger = new Logger('Storefront');
  private readonly url: string | undefined;
  private readonly secret: string | undefined;

  constructor(@Inject(ConfigService) config: AppConfig) {
    this.url = config.get('STOREFRONT_REVALIDATE_URL', { infer: true });
    this.secret = config.get('STOREFRONT_REVALIDATE_SECRET', { infer: true });
  }

  /** Returns at once; the request runs in the background (3 s timeout). */
  revalidate(...tags: StorefrontTag[]): void {
    if (!this.url || !this.secret || tags.length === 0) return;
    void this.send([...new Set(tags)]);
  }

  /** Exposed for tests: resolves when the storefront answered (or the attempt failed). */
  async send(tags: StorefrontTag[]): Promise<boolean> {
    if (!this.url || !this.secret) return false;
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Revalidate-Secret': this.secret },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(3_000),
      });
      if (!response.ok) {
        this.logger.warn(
          `Storefront revalidation of ${tags.join(', ')} failed: HTTP ${String(response.status)}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(
        `Storefront revalidation of ${tags.join(', ')} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
