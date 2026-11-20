import 'server-only';

import type { NewsletterSource, SubscribeResultDto } from '@as/contracts';

import { serverEnv } from '@/config/env.server';
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

/** Adapter: in-memory mock for offline development (`MOCK_API=true`). */
const subscribed = new Set<string>();
const mockNewsletterService: NewsletterService = {
  async subscribe(email) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const alreadySubscribed = subscribed.has(email);
    subscribed.add(email);
    return { alreadySubscribed };
  },
};

export const newsletterService: NewsletterService = serverEnv.MOCK_API
  ? mockNewsletterService
  : httpNewsletterService;
