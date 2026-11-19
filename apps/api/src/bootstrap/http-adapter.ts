import { NodeAdapter } from '@nestjs/platform-node';

import type { Env } from '../config/env.js';

/** Parse a TRUST_PROXY value: `false` → trust nobody, otherwise an address/CIDR list. */
export function trustProxyFrom(value: string): string | string[] | false {
  if (value === 'false') return false;
  const list = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return list.length === 1 ? (list[0] ?? false) : list;
}

/**
 * The HTTP adapter used by the server and the e2e tests alike, so client-IP handling (rate
 * limits, hashed IPs) is tested exactly as it runs in production.
 */
export const createHttpAdapter = (env: Env) =>
  new NodeAdapter({ trustProxy: trustProxyFrom(env.TRUST_PROXY) });
