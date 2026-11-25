import { useSyncExternalStore } from 'react';

/*
 * "Helpful" votes this browser has made, with the count the API confirmed. Review lists are
 * cached for a few minutes, so without this a vote seemed to vanish on reload (the button
 * un-pressed and the old count came back). Purely a display aid: the API counts each voter once.
 */

const KEY = 'as-helpful-votes';
const MAX = 200;
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

export function rememberHelpfulVote(reviewId: string, count: number): void {
  const votes = parse(read());
  votes[reviewId] = count;
  const kept = Object.fromEntries(Object.entries(votes).slice(-MAX));
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    // Storage full or blocked: the vote still counted on the server.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** The count this browser saw after voting for `reviewId`, or null if it hasn't voted. */
export function useHelpfulVote(reviewId: string): number | null {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const count = parse(raw)[reviewId];
  return typeof count === 'number' ? count : null;
}
