import 'server-only';

import { serverEnv } from '@/config/env.server';
import { apiRequest } from '@/lib/api/http-client';

export interface SubscribeResult {
  alreadySubscribed: boolean;
}

/** Port: what the app needs from "newsletter", independent of transport. */
export interface NewsletterService {
  subscribe(email: string): Promise<SubscribeResult>;
}

/** Adapter: NestJS API. */
const httpNewsletterService: NewsletterService = {
  subscribe: (email) =>
    apiRequest<SubscribeResult>('/newsletter/subscriptions', { method: 'POST', body: { email } }),
};

/** Adapter: in-memory mock for local development before the API is running. */
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
