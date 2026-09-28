import { emit } from '../core/events';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { cinemaActive } from './cinema';
import { travelActive } from './fastTravel';
import { flow } from './flowStore';
import { lockReport, type LockSource } from './playerLock';

/**
 * Wave 5 · W5-0b (plan sf-w5-plan.md §2 MF1 step 1): the lock watchdog, a safety net under game/playerLock. Every frame
 * (game/Systems.tsx, right after the other systems): when the player has been locked for more than 1 s and nothing
 * explains it — the game is playing, no dialogue, panel, cinematic, ride, fishing or trip is open, and no activity /
 * shop / panel hold is live — the feet are freed, a `stuck` event says where (what: 'watchdog', `source`: the holds
 * left, else 'unknown') and DEV builds warn. R (unstuck: the keyboard's R, the gamepad's right stick) frees such a lock
 * at once. A release is a bug with a source, never the fix: the scripted phone runs expect none (plan MF1 acceptance).
 */

export const WATCHDOG_S = 1;

/** Holds whose state no store flag shows: the hold itself explains the lock (lanes A, E and the panels, wave 5). */
const SELF_EXPLAINED: ReadonlySet<LockSource> = new Set<LockSource>(['panel', 'activity', 'shop']);

/** What explains a lock right now (null: nothing does). */
export function lockExplanation(): LockSource | null {
  const s = game.get(), f = flow.get();
  if (s.phase !== 'playing') return 'phase';
  if (s.dialogue.nodeId) return 'dialogue';
  if (s.panel.kind) return 'panel';
  if (cinemaActive() || f.cinematic) return 'cinema';
  if (s.riding !== null || f.ride || s.move.mode === 'transit') return 'ride';
  if (f.fishing) return 'fishing';
  if (travelActive() || s.move.mode === 'travel') return 'travel';
  for (const h of lockReport()) if (SELF_EXPLAINED.has(h.source)) return h.source;
  return null;
}

/** DEV / QA read-out (`__opusBay.lock.watchdog`). */
export const watchdogStats = { releases: 0, last: null as null | { x: number; z: number; source: string; reset: boolean } };

let unexplained = 0;
let resetSeen = input.resetCount;

/** One frame; returns true when it freed the player this frame. */
export function stepLockWatchdog(dt: number): boolean {
  const reset = input.resetCount !== resetSeen;
  resetSeen = input.resetCount;
  const p = runtime.player;
  if (!p.locked || lockExplanation()) { unexplained = 0; return false; }
  unexplained += dt;
  if (unexplained <= WATCHDOG_S && !reset) return false;
  unexplained = 0;
  const holds = lockReport();
  const source = holds.length ? holds.map(h => (h.key ? `${h.source}:${h.key}` : h.source)).join(',') : 'unknown';
  p.locked = false;
  watchdogStats.releases++;
  watchdogStats.last = { x: p.x, z: p.z, source, reset };
  emit({ type: 'stuck', x: p.x, z: p.z, what: 'watchdog', source });
  if (import.meta.env?.DEV) console.warn(`[opus-bay] lock watchdog freed the player at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}: nothing explained the lock (holds: ${source}${reset ? '; R pressed' : ''})`);
  return true;
}
