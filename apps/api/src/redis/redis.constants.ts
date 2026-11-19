/** Injection token for the shared ioredis client: `@Inject(REDIS) private readonly redis: Redis`. */
export const REDIS = Symbol('REDIS');
