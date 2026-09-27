import { useSyncExternalStore } from 'react';

/**
 * Wave 4 · per-device guidance preferences (lane G): Settings › 显示地标旗 ("show landmark flags": discovered T1 keep their
 * flag, plan §4.2). Kept in localStorage (try / catch: private windows and blocked storage fall back to the default for
 * this visit) until the lead decides whether it belongs in the frozen store's settings (sf-w4-G.md Requests).
 */

const KEY = 'opus-bay:landmark-flags:v1';
const listeners = new Set<() => void>();
let cached: boolean | null = null;

function read(): boolean {
  if (cached !== null) return cached;
  try { cached = globalThis.localStorage?.getItem(KEY) === '1'; } catch { cached = false; }
  return cached;
}

/** Discovered T1 keep their flag (default off: only undiscovered T1 and the target fly one). */
export const landmarkFlagsPref = (): boolean => read();

export function setLandmarkFlagsPref(v: boolean) {
  cached = !!v;
  try { globalThis.localStorage?.setItem(KEY, v ? '1' : '0'); } catch { /* storage blocked: this visit only */ }
  for (const fn of listeners) fn();
}

export function subscribeLandmarkFlags(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

/** React: the Settings row and anything that redraws on the change. */
export const useLandmarkFlagsPref = () => useSyncExternalStore(subscribeLandmarkFlags, landmarkFlagsPref, () => false);
