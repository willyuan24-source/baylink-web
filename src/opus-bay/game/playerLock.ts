import { runtime } from '../core/runtime';

/**
 * Wave 5 · the player lock (plan sf-w5-plan.md §2 MF1, §4.2). The API below is FROZEN at day 0 (W5-0b, the lead):
 * `holdLock`, `lockHeld`, `lockReport`, `setLockRefresher`, `LockSource`. Lane F owns the internals from W5-F1 (the
 * lock becomes derived every frame; no module writes `runtime.player.locked` directly any more).
 *
 *   const release = holdLock('travel');   // the feet are held until `release()` (idempotent)
 *   …
 *   release();                            // the refresher (flow's refreshLock) derives the lock again
 *
 * Anything that stops the player for a while (a trip, a camera beat, an activity, the shop's try-on) holds the lock
 * through here and releases it when it ends, whichever way it ends. Releasing never frees the feet by itself: it asks
 * the refresher (game/flow.ts registers `refreshLock`, which reads the dialogue, fishing, the cinema, a ride, the phase
 * and `lockHeld()`) to decide, so a dialogue still open keeps the player where they are. Before flow registers (node
 * tests without flow, the first module evaluations), the holds alone decide.
 *
 * The day-0 bug this closes (owner F1, 需要对话后，才能移动): the first-arrival reveal locked the player and the cinema's
 * finish never recomputed the lock; only the next dialogue's close did.
 */

export type LockSource = 'dialogue' | 'fishing' | 'cinema' | 'ride' | 'phase' | 'travel' | 'panel' | 'activity' | 'shop';

interface Hold { source: LockSource; key?: string; since: number }

const holds = new Map<number, Hold>();
let seq = 0;
let refresher: (() => void) | null = null;

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Re-derive the lock: flow's refreshLock once it registered, else the holds alone. */
function refresh() {
  if (refresher) refresher();
  else runtime.player.locked = holds.size > 0;
}

/** Hold the player still until the returned function is called (calling it again does nothing). */
export function holdLock(source: LockSource, key?: string): () => void {
  const id = ++seq;
  holds.set(id, key === undefined ? { source, since: clock() } : { source, key, since: clock() });
  runtime.player.locked = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds.delete(id);
    refresh();
  };
}

/** Anything holds the lock right now. */
export function lockHeld(): boolean {
  return holds.size > 0;
}

/** Who holds it (oldest first), for the watchdog's DEV log, QA hooks and tests. `since` is performance.now() ms. */
export function lockReport(): { source: LockSource; key?: string; since: number }[] {
  return [...holds.values()].map(h => ({ ...h }));
}

/** game/flow.ts registers `refreshLock` (no import cycle: cinema, fastTravel and the lanes' modules never import flow for it). */
export function setLockRefresher(fn: () => void): void {
  refresher = fn;
}
