import { emit } from '../core/events';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { cinemaActive } from './cinema';
import { travelActive } from './fastTravel';
import { flow } from './flowStore';
import { deriveLock, dropHolds, lockReport, type LockSource } from './playerLock';
import { openOverlays } from '../ui/slots';

/**
 * Wave 5 · W5-0b (plan sf-w5-plan.md §2 MF1 step 1): the lock watchdog, a safety net under game/playerLock. Every frame
 * (game/Systems.tsx, right after the other systems): when the player has been locked for more than 1 s and nothing
 * explains it — the game is playing, no dialogue, panel, cinematic, ride, fishing or trip is open, and no activity /
 * shop / panel hold is live — the feet are freed, a `stuck` event says where (what: 'watchdog', `source`: the holds
 * left, else 'unknown') and DEV builds warn. R (unstuck: the keyboard's R, the gamepad's right stick) frees such a lock
 * at once. A release is a bug with a source, never the fix: the scripted phone runs expect none (plan MF1 acceptance).
 *
 * W5-F1: the lock is derived (game/playerLock deriveLock), so what can still lock the feet with nothing to explain it
 * is a hold nobody released (a camera beat or a trip that ended without its release) — the watchdog drops those holds
 * and derives the lock again; it never writes the lock itself.
 */

export const WATCHDOG_S = 1;

/**
 * W6-K2 (the lead's decision, sf-w6-lead.md §6; sf-w5-summary NEXT #5): an `activity` / `shop` / `panel` hold explains
 * the lock by itself, so one its owner never released (a leak) held the feet for good. Past HOLD_TIMEOUT_S such a hold no
 * longer explains the lock: the watchdog frees the player a second later and logs it (the `stuck` event's source names
 * the hold and how long it was held; DEV warns; `watchdogStats.timeouts`). A real activity, the shop or a panel open that
 * long lets the feet go (its own UI stays; walking away is the player's choice).
 */
export const HOLD_TIMEOUT_S = 90;
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
/**
 * W6-K2-review: a `panel` / `shop` hold is owned by a ui/slots sheet (the album, a letter, the goals step, the 小铺: each
 * takes it on mount and gives it back on unmount), so while a sheet is on screen it is not a leak — the player is reading
 * it and can close it. Before, 90 s in the album or the 小铺 freed the feet under the sheet (the album's ← / → turned the
 * page AND walked the player; a `stuck` event and a DEV warning for a panel that was simply open). An `activity` hold has
 * no sheet to show for it (PlayKit is a lazy chunk): it times out as the lead decided.
 */
const sheetUp = (source: LockSource) => (source === 'panel' || source === 'shop') && openOverlays().length > 0;
const timedOut = (h: { source: LockSource; since: number }, now: number) =>
  SELF_EXPLAINED.has(h.source) && now - h.since >= HOLD_TIMEOUT_S * 1000 && !sheetUp(h.source);

/** Holds whose state no store flag shows: the hold itself explains the lock (lanes A, E and the panels, wave 5). */
const SELF_EXPLAINED: ReadonlySet<LockSource> = new Set<LockSource>(['panel', 'activity', 'shop']);

/** What explains a lock right now (null: nothing does). */
export function lockExplanation(now = nowMs()): LockSource | null {
  const s = game.get(), f = flow.get();
  if (s.phase !== 'playing') return 'phase';
  if (s.dialogue.nodeId) return 'dialogue';
  if (s.panel.kind) return 'panel';
  if (cinemaActive() || f.cinematic) return 'cinema';
  if (s.riding !== null || f.ride || s.move.mode === 'transit') return 'ride';
  if (f.fishing) return 'fishing';
  if (travelActive() || s.move.mode === 'travel') return 'travel';
  for (const h of lockReport()) if (SELF_EXPLAINED.has(h.source) && !timedOut(h, now)) return h.source;
  return null;
}

/** DEV / QA read-out (`__opusBay.lock.watchdog`). */
export const watchdogStats = { releases: 0, timeouts: 0, last: null as null | { x: number; z: number; source: string; reset: boolean } };

let unexplained = 0;
let resetSeen = input.resetCount;

/** One frame; returns true when it freed the player this frame. */
export function stepLockWatchdog(dt: number, now = nowMs()): boolean {
  const reset = input.resetCount !== resetSeen;
  resetSeen = input.resetCount;
  const p = runtime.player;
  if (!p.locked || lockExplanation(now)) { unexplained = 0; return false; }
  unexplained += dt;
  if (unexplained <= WATCHDOG_S && !reset) return false;
  unexplained = 0;
  const holds = lockReport();
  const late = holds.filter(h => timedOut(h, now));
  const source = holds.length ? holds.map(h => `${h.key ? `${h.source}:${h.key}` : h.source}${timedOut(h, now) ? ` (held ${Math.round((now - h.since) / 1000)} s)` : ''}`).join(',') : 'unknown';
  if (late.length) watchdogStats.timeouts += late.length;
  // nothing explains the lock (no state, no self-explained hold): every hold left is a forgotten one
  if (!dropHolds(() => true)) deriveLock();
  watchdogStats.releases++;
  watchdogStats.last = { x: p.x, z: p.z, source, reset };
  emit({ type: 'stuck', x: p.x, z: p.z, what: 'watchdog', source });
  if (import.meta.env?.DEV) console.warn(`[opus-bay] lock watchdog freed the player at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}: ${late.length ? `a hold past ${HOLD_TIMEOUT_S} s` : 'nothing explained the lock'} (holds: ${source}${reset ? '; R pressed' : ''})`);
  return true;
}
