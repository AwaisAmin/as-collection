import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs `fn` with a request context visible to everything it calls (logs, errors, services). */
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** The current request's id, or `undefined` outside a request (startup, jobs). */
export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
