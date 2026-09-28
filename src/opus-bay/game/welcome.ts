import type { Bilingual } from '../core/types';

/**
 * Wave 5 · lane C · W5-C1 (plan sf-w5-plan.md MF6, §4.3): the welcome / resume hook.
 *
 * City mode only. Lane C's flow runs the welcome and tells the listeners once per start:
 *   'new'        a player's first start made the welcome choice (一日游 / 这周 / 自己逛 / 本地人: `info.choice`)
 *   'returning'  a player with progress came back and play began where they were (game/resume.ts → beginPlaying)
 *
 *   onWelcome(fn)  → unregister. `fn(kind, info)` may return ONE short line (zh ≤ 45 characters) for BAYBAY to add to a
 *                  'returning' welcome (lane R's SF Today line: 今天旧金山日落 18:58…); lines returned for 'new' are
 *                  not said (the first minute is the goals step's). Listeners run in registration order; the first
 *                  line returned wins, a throwing listener is skipped.
 *   lastWelcome()  the welcome of this page (null before it): a feature whose chunk loads after it can still react
 *                  (lane E's first 飞行券, lane R's once-a-Bay-day line).
 *
 * Dependency-free (types only): game/flow.ts (main graph) and the lanes' lazy chunks import it.
 */

export type WelcomeKind = 'new' | 'returning';

export interface WelcomeInfo {
  kind: WelcomeKind;
  /** the welcome choice ('new'): tour, week, free or local; 'returning' has none */
  choice?: 'tour' | 'week' | 'free' | 'local';
  /** the area id where play begins (store.area / save v2 lastSafe.zone), null when unknown */
  zone: string | null;
  /** performance.now() ms of the welcome */
  at: number;
}

export type WelcomeListener = (kind: WelcomeKind, info: WelcomeInfo) => Bilingual | null | undefined | void;

const listeners: WelcomeListener[] = [];
let last: WelcomeInfo | null = null;

/** Listen for the welcome (lanes R, E, D, N); returns the unregister. */
export function onWelcome(fn: WelcomeListener): () => void {
  listeners.push(fn);
  return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
}

/** This page's welcome, or null before it. */
export const lastWelcome = (): WelcomeInfo | null => last;

const okLine = (l: unknown): l is Bilingual =>
  !!l && typeof l === 'object' && typeof (l as Bilingual).zh === 'string' && typeof (l as Bilingual).en === 'string' && (l as Bilingual).zh.trim().length > 0;

/**
 * Lane C's flow only: tell the listeners; returns the first line a listener gave (null: none). Runs once per page and
 * kind change (a second call of the same kind is ignored: a restart does not welcome twice).
 */
export function runWelcome(info: WelcomeInfo): Bilingual | null {
  if (last && last.kind === info.kind) return null;
  last = info;
  let line: Bilingual | null = null;
  for (const fn of [...listeners]) {
    try {
      const got = fn(info.kind, info);
      if (!line && okLine(got)) line = got;
    } catch (error) { if (import.meta.env?.DEV) console.warn('[opus-bay welcome] a listener threw', error); }
  }
  return line;
}

/** Tests / Settings → reset: forget this page's welcome. */
export function resetWelcome() { last = null; }
