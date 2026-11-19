'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onTick: () => void) {
  const id = window.setInterval(onTick, 1000);
  return () => window.clearInterval(id);
}

/** Whole-second timestamp, so the snapshot stays stable between ticks. */
const getSnapshot = () => Math.floor(Date.now() / 1000) * 1000;
const getServerSnapshot = () => null;

/**
 * Current time (ms), updated every second. `null` during SSR and hydration, so the server
 * HTML never contains a time that would mismatch on the client.
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
