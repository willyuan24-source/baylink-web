/**
 * W7-P5 · the world's first frame, for work that must not compete with it (lane P: a phone's first load).
 *
 *   markFirstFrame()     game/GameRoot.tsx's FirstFrame calls it on the world's first rendered frame (once per page);
 *                        it also marks `opus-bay:first-frame` for load measurements
 *   afterFirstFrame(fn)  run fn then (at once when the frame is already drawn); returns an unsubscribe
 *
 * The live catalog prefetch (ui/Overlay.tsx) waits for it: its ≈ 125 KB gzip download and 0.6 MB parse used to land
 * while a phone was still loading the city (sf-w7-P.md part c).
 */
let drawn = false;
const waiting = new Set<() => void>();

export function markFirstFrame(): void {
  if (drawn) return;
  drawn = true;
  try { performance.mark?.('opus-bay:first-frame'); } catch { /* no performance timeline */ }
  const fns = [...waiting];
  waiting.clear();
  for (const fn of fns) fn();
}

export function afterFirstFrame(fn: () => void): () => void {
  if (drawn) { fn(); return () => {}; }
  waiting.add(fn);
  return () => { waiting.delete(fn); };
}

export const firstFrameDrawn = (): boolean => drawn;
