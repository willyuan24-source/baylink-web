import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { flow } from './flowStore';

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
 *
 * W5-F1 (lane F, the internals): the lock is DERIVED. `deriveLock()` is the one writer of `runtime.player.locked`:
 *
 *   locked = a dialogue is open || fishing || riding (a line / the streetcar) || the phase is not 'playing' || a hold
 *
 * (a camera sequence and a 飞过去 trip hold 'cinema' / 'travel' while they run.) game/Systems.tsx derives it every frame,
 * flow's refreshLock (the refresher) derives it at once when a dialogue, a ride or a phase changes, and a release
 * derives it at once — so nothing can leave the feet locked after the thing that locked them has ended, and a
 * forgotten hold is the only way left to be stuck: the watchdog (game/lockWatchdog) drops those after 1 s. No other
 * module writes `runtime.player.locked` (tests/opus-bay-w5-lock.test.ts greps the source). Internals for game/flow,
 * the watchdog, Systems and tests (not part of the frozen API): `deriveLock`, `dropHolds`.
 */

export type LockSource = 'dialogue' | 'fishing' | 'cinema' | 'ride' | 'phase' | 'travel' | 'panel' | 'activity' | 'shop';

interface Hold { source: LockSource; key?: string; since: number }

const holds = new Map<number, Hold>();
let seq = 0;
let refresher: (() => void) | null = null;

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * W5-F1 · derive the lock from what is open now and write it (the one writer of `runtime.player.locked`); returns it.
 * Cheap (two store reads): Systems.tsx calls it every frame.
 */
export function deriveLock(): boolean {
  const s = game.get(), f = flow.get();
  const locked = !!s.dialogue.nodeId || !!f.fishing || s.riding !== null || s.phase !== 'playing' || holds.size > 0;
  runtime.player.locked = locked;
  return locked;
}

/** W5-F1 · the watchdog drops holds nothing explains any more (a forgotten release); returns how many went. */
export function dropHolds(which: (h: { source: LockSource; key?: string; since: number }) => boolean): number {
  let n = 0;
  for (const [id, h] of [...holds]) if (which({ ...h })) { holds.delete(id); n++; }
  if (n) deriveLock();
  return n;
}

/** Re-derive the lock now (flow's refreshLock when it registered: the same derive). */
function refresh() {
  if (refresher) refresher();
  else deriveLock();
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

/** game/flow.ts registers `refreshLock` = deriveLock (no import cycle: cinema, fastTravel and the lanes' modules never import flow for it). */
export function setLockRefresher(fn: () => void): void {
  refresher = fn;
}
