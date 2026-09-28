import { game, type Quality } from '../core/store';
import { readProgress, setSessionSettings } from '../data/wishlist';
import { readQa } from '../game/qa';

/**
 * Quality policy (wave 3, P4 / CS-7). On the owner's machine the phone profile ran 30–45 fps on `high` and never stepped
 * down (drei's PerformanceMonitor only declined when 7 of 8 windows were under 40 fps), while `mid` held 60 at both
 * phone spots. So:
 *
 *   start      ?quality= wins (QA links); then the player's own pick in Settings (remembered here, see
 *              initQualityPolicy); a saved `mid` / `low` (only a pick can save them: automatic steps are session-only);
 *              a touch-first (coarse pointer) or high-density (devicePixelRatio ≥ 2) device starts at `mid`; else the
 *              saved value or `high`. The default `high` is saved on every visit too, so a saved `high` proves nothing.
 *   step down  the adaptive monitor declines when most 500 ms windows run under MONITOR.declineBelow (≈ 50 fps from
 *              `high`; from `mid` only under 30: `low` buys little over `mid`), and never steps back up in a visit.
 *
 * Every automatic level is session-only (setSessionSettings): the Settings panel shows the real level, and a pick there
 * is saved as usual (keepSetting) and remembered as a choice from then on.
 */

export type QualityReason = 'url' | 'choice' | 'saved' | 'device' | 'default';

export interface StartQualityInput {
  /** ?quality= */
  url?: Quality | null;
  /** the player's explicit pick in Settings (QUALITY_CHOICE_KEY) */
  choice?: Quality | null;
  /** the quality in the saved progress */
  saved?: Quality | null;
  /** touch-first device: (pointer: coarse) and no fine pointer */
  coarse: boolean;
  /** window.devicePixelRatio */
  dpr: number;
}

/** The quality a visit starts at, and why (pure). */
export function startQuality(i: StartQualityInput): { quality: Quality; reason: QualityReason } {
  if (i.url) return { quality: i.url, reason: 'url' };
  if (i.choice) return { quality: i.choice, reason: 'choice' };
  if (i.saved && i.saved !== 'high') return { quality: i.saved, reason: 'saved' };
  if (i.coarse || i.dpr >= 2) return { quality: 'mid', reason: 'device' };
  return { quality: i.saved ?? 'high', reason: 'default' };
}

/** The adaptive monitor (drei PerformanceMonitor): 500 ms windows, judged every 8, a decline when > 75 % are under the bound. */
export const MONITOR = {
  ms: 500,
  iterations: 8,
  threshold: 0.75,
  /** fps under which a window counts as slow, per current level (0: never steps down from it) */
  declineBelow: { high: 50, mid: 30, low: 0 } as Record<Quality, number>,
  /** at most this many steps down per visit (high → mid → low) */
  flipflops: 2,
} as const;

const LOWER: Record<Quality, Quality> = { high: 'mid', mid: 'low', low: 'low' };

/** The monitor's bounds for the current level: [slow under, never "fast"] (the upper bound never triggers an incline). */
export function monitorBounds(q: Quality): [number, number] {
  return [MONITOR.declineBelow[q], Infinity];
}

/** The level one step down from q, or null when the monitor must not step down from it (pure). */
export function declineFrom(q: Quality): Quality | null {
  return MONITOR.declineBelow[q] > 0 && LOWER[q] !== q ? LOWER[q] : null;
}

/** localStorage key of the player's explicit quality pick (written when the Settings panel changes the level). */
export const QUALITY_CHOICE_KEY = 'opus-bay:quality-choice:v1';

const isQuality = (v: unknown): v is Quality => v === 'high' || v === 'mid' || v === 'low';

function readChoice(): Quality | null {
  try { const v = typeof window !== 'undefined' ? window.localStorage?.getItem(QUALITY_CHOICE_KEY) : null; return isQuality(v) ? v : null; } catch { return null; }
}
function writeChoice(q: Quality) {
  try { window.localStorage?.setItem(QUALITY_CHOICE_KEY, q); } catch { /* blocked storage: the pick lasts this visit */ }
}

function deviceInfo(): { coarse: boolean; dpr: number } {
  try {
    const mm = (m: string) => !!window.matchMedia?.(m).matches;
    return { coarse: mm('(pointer: coarse)') && !mm('(any-pointer: fine)'), dpr: window.devicePixelRatio || 1 };
  } catch { return { coarse: false, dpr: 1 }; }
}

/**
 * True while this module writes the level itself (the start policy or the monitor): the store notifies its listeners
 * synchronously, so any change seen while this is false is the player's pick (verify-code F3: comparing values missed a
 * pick back to the automatic level: phone starts mid, the player picks high, then mid again, and high stayed saved).
 */
let applying = false;
let started = false;
let decided: { quality: Quality; reason: QualityReason } | null = null;

function applyLevel(q: Quality) {
  applying = true;
  try { setSessionSettings({ quality: q }); } finally { applying = false; }
}

/** Why the visit started at its level (debug overlay / QA). */
export function qualityDecision() { return decided; }

/**
 * Apply the start level once per page (GameRoot, before the canvas mounts) and remember later picks from the Settings
 * panel as the player's choice. Safe to call again (no-op).
 */
export function initQualityPolicy(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const url = readQa().quality ?? null;
  const d = deviceInfo();
  decided = startQuality({ url, choice: readChoice(), saved: readProgress()?.settings.quality ?? null, coarse: d.coarse, dpr: d.dpr });
  // ?quality= is applied by the page (locked, session-only); the rest here, for this visit only
  if (decided.reason !== 'url' && game.get().settings.quality !== decided.quality) applyLevel(decided.quality);
  if (url) return; // a QA link never records a choice
  let last = game.get().settings.quality;
  game.subscribe(() => {
    const q = game.get().settings.quality;
    if (q === last) return;
    last = q;
    if (!applying) writeChoice(q);
  });
}

/**
 * The render state of the level the monitor would step down to, for the warm-up (world/warmup.ts `next`): null when it
 * never steps (low, or a ?quality= link: the monitor is off). The next level never has the post path (high only).
 */
export function nextWarmState(q: Quality): { shadows: boolean } | null {
  const next = decided?.reason === 'url' ? null : declineFrom(q);
  return next && { shadows: next !== 'low' };
}

/** The monitor saw a slow stretch: one step down for this visit (never saved, never back up). Returns the new level. */
export function declineQuality(): Quality | null {
  const q = game.get().settings.quality;
  const next = declineFrom(q);
  if (!next) return null;
  applyLevel(next);
  return next;
}
