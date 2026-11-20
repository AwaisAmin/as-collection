import 'server-only';

import type { NewsletterSource, SubscribeResultDto } from '@as/contracts';

import { apiRequest } from '@/lib/api/http-client';

export type SubscribeResult = SubscribeResultDto;

/** Port: what the app needs from "newsletter", independent of transport. */
export interface NewsletterService {
  subscribe(
    email: string,
    context: { source: NewsletterSource; ip: string | null },
  ): Promise<SubscribeResult>;
}

/** Adapter: NestJS API. */
const httpNewsletterService: NewsletterService = {
  subscribe: (email, { source, ip }) =>
    apiRequest<SubscribeResult>('/newsletter/subscriptions', {
      method: 'POST',
      body: { email, source },
      clientIp: ip,
    }),
};

/** The NestJS newsletter API. */
export const newsletterService: NewsletterService = httpNewsletterService;
