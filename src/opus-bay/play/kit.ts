import { createElement, lazy, Suspense } from 'react';
import { audioNow, playSound } from '../audio/hooks';
import { emit, onEvent, REWARD_SOURCE } from '../core/events';
import { runtime } from '../core/runtime';
import type { Bilingual } from '../core/types';
import { readSave } from '../data/save';
import { holdLock } from '../game/playerLock';
import { registerFrameSystem } from '../game/systemsRegistry';
import { closeOverlay, openOverlay, registerOverlay, type OverlayProps } from '../ui/slots';

/**
 * Wave 5 · lane A · PlayKit (W5-A1, plan sf-w5-plan.md §3.2): the small core every activity stands on.
 *
 *   startActivity(spec, opts)   one activity at a time (a new start cancels the old one, free); `lock` holds the feet
 *                               through game/playerLock holdLock('activity') until it ends, whichever way it ends;
 *                               `cancelOnMove` cancels at no cost when the player pushes the stick / WASD (after a
 *                               0.35 s grace, so the press that started it does not end it)
 *   run.end({ tier, score … })  the medal tier 0..3: pays `medal:<id>:<tier>` (5 / 10 / 15 coins) the first time per
 *                               tier (lane E's ledger pays each source once; the kit asks for every tier up to the
 *                               one reached), remembers the best (`play.b`, through lane E), shows the result card
 *   run.cancel()                nothing paid, the card never shows
 *   RhythmJudge                 taps judged on audio/hooks audioNow() (AudioContext time on iOS) in ±150 ms windows,
 *                               the player's own offset learned from the first four taps
 *
 * Every exit releases the lock (end, cancel, a new start, teardown). Events: `play` start / end (with the tier) /
 * cancel. The result card is the overlay 'play-result' (ResultCard.tsx, its own chunk).
 */

export type Tier = 1 | 2 | 3;
export const TIERS: readonly Tier[] = [1, 2, 3];
/** The medal words (shape + text on the card: colour-blind safe). */
export const TIER_WORDS: Record<0 | Tier, Bilingual> = {
  0: { zh: '再试试', en: 'Try again' },
  1: { zh: '好', en: 'Good' },
  2: { zh: '很好', en: 'Great' },
  3: { zh: '太棒了', en: 'Brilliant' },
};
/** Coins per medal tier, paid once per tier (plan §3.4: activity medal 5 / 10 / 15). */
export const MEDAL_COINS: Record<Tier, number> = { 1: 5, 2: 10, 3: 15 };
/** The window a tap may miss its beat by (s) and the offset learning (plan §3.2). */
export const JUDGE_WINDOW = 0.15;
export const LEARN_TAPS = 4;
export const MAX_OFFSET = 0.25;
/** Stick / WASD magnitude that counts as moving away, and the grace after a start (s). */
export const MOVE_CANCEL = 0.35;
export const CANCEL_GRACE = 0.35;
export const ACTIVITY_ID = /^[a-z0-9][a-z0-9-]{0,30}$/;

export interface ActivitySpec {
  /** `[a-z0-9-]`, the medal source's middle part and the best's key */
  id: string;
  name: Bilingual;
  /** how a best compares (seconds: lower; rings, rounds: higher) */
  better?: 'lower' | 'higher';
}
export interface ActivityOpts {
  lock?: boolean;
  cancelOnMove?: boolean;
  /** called once when the run stops (end or cancel), after the lock is released */
  onStop?: (how: 'end' | 'cancel') => void;
}
export interface ActivityResult {
  tier: 0 | Tier;
  /** the number the best compares (seconds, rings…) */
  score?: number;
  /** a line under the medal (穿过 7 / 8 个圈) */
  detail?: Bilingual;
  /** how to say a best (上次你 18 秒！): the kit adds 新纪录！ when this run beat it */
  bestText?: (best: number) => Bilingual;
  /** 再来一次 on the card */
  again?: () => void;
  /** false: no card (the caller shows its own moment) */
  card?: boolean;
}
export interface ActivityRun {
  readonly spec: ActivitySpec;
  readonly startedAt: number;
  readonly active: boolean;
  end(result: ActivityResult): void;
  cancel(): void;
}

// --- the rhythm judge -----------------------------------------------------------------------------------------------

export type Judgement = { kind: 'hit' | 'early' | 'late'; delta: number };

/**
 * Judges taps against expected beat times on one clock (default audio/hooks audioNow: AudioContext.currentTime once
 * audio runs; an activity starts from a gesture, so its beats and taps are read in the same state). The first
 * LEARN_TAPS plausible taps (within 0.35 s of their beat) teach the player's own offset (Bluetooth / iOS output
 * latency, a late thumb): their median, clamped to ±MAX_OFFSET; later taps are judged against beat + offset.
 */
export class RhythmJudge {
  readonly window: number;
  private readonly clock: () => number;
  private learnt: number[] = [];
  offset = 0;
  constructor(opts: { window?: number; clock?: () => number } = {}) {
    this.window = opts.window ?? JUDGE_WINDOW;
    this.clock = opts.clock ?? audioNow;
  }
  now(): number { return this.clock(); }
  /** judge a tap (at `tapAt`, default now) against the beat at `expected` */
  judge(expected: number, tapAt: number = this.clock()): Judgement {
    const raw = tapAt - expected;
    if (this.learnt.length < LEARN_TAPS && Math.abs(raw) <= 0.35) {
      this.learnt.push(raw);
      const sorted = [...this.learnt].sort((a, b) => a - b);
      const mid = sorted.length >> 1;
      const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      this.offset = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, median));
    }
    const delta = raw - this.offset;
    return { kind: Math.abs(delta) <= this.window ? 'hit' : delta < 0 ? 'early' : 'late', delta };
  }
  /** judge a tap against the nearest of several beats (a call-and-response round) */
  judgeNearest(beats: readonly number[], tapAt: number = this.clock()): Judgement & { beat: number } {
    let best = -1, bestD = Infinity;
    beats.forEach((b, i) => { const d = Math.abs(tapAt - this.offset - b); if (d < bestD) { bestD = d; best = i; } });
    if (best < 0) return { kind: 'late', delta: Infinity, beat: -1 };
    return { ...this.judge(beats[best], tapAt), beat: best };
  }
  /** taps the offset was learnt from (tests / QA) */
  get learning(): readonly number[] { return this.learnt; }
}

/** The medal tier for a score and three thresholds (ascending for 'higher', descending for 'lower'). */
export function tierFor(score: number, thresholds: readonly [number, number, number], better: 'lower' | 'higher' = 'higher'): 0 | Tier {
  if (!Number.isFinite(score)) return 0;
  let tier: 0 | Tier = 0;
  for (const t of TIERS) if (better === 'higher' ? score >= thresholds[t - 1] : score <= thresholds[t - 1]) tier = t;
  return tier;
}

// --- bests ------------------------------------------------------------------------------------------------------------

const BEST_KEY = /^[a-z0-9:-]{1,40}$/;
const sessionBests = new Map<string, number>();
/** How bests reach the save: lane E's ledger is the only writer of `play` (it exports recordBest, or the kit keeps the session copy). */
type BestWriter = (key: string, value: number) => void;
let bestWriter: BestWriter | null | undefined;

async function writeBest(key: string, value: number) {
  if (bestWriter === undefined) {
    try {
      const mod = (await import('../economy/index')) as unknown as { recordBest?: BestWriter };
      bestWriter = typeof mod.recordBest === 'function' ? mod.recordBest : null;
    } catch { bestWriter = null; }
  }
  try { bestWriter?.(key, value); } catch (error) { if (import.meta.env?.DEV) console.error('[opus-bay play] best', key, error); }
}

/** tests: replace the writer (null = session only) */
export function __setBestWriter(fn: BestWriter | null | undefined) { bestWriter = fn; }

/** The best for a key: this session's, else the save's `play.b`. */
export function bestOf(key: string): number | undefined {
  const s = sessionBests.get(key);
  if (s !== undefined) return s;
  const saved = readSave()?.play?.b?.[key];
  return typeof saved === 'number' && Number.isFinite(saved) ? saved : undefined;
}

/** Keep a number as it is (a counter: the steps climbed), this session and in `play.b` through lane E. */
export function saveNumber(key: string, value: number): void {
  if (!BEST_KEY.test(key) || !Number.isFinite(value)) return;
  sessionBests.set(key, value);
  void writeBest(key, value);
}

/** Remember a score; true when it beats the best (or is the first). */
export function recordBest(key: string, value: number, better: 'lower' | 'higher' = 'higher'): boolean {
  if (!BEST_KEY.test(key) || !Number.isFinite(value)) return false;
  const old = bestOf(key);
  if (old !== undefined && (better === 'higher' ? value <= old : value >= old)) return false;
  sessionBests.set(key, value);
  void writeBest(key, value);
  return true;
}

// --- activities -------------------------------------------------------------------------------------------------------

let current: (ActivityRun & { stop: (how: 'end' | 'cancel') => void }) | null = null;
const paidThisSession = new Set<string>();

/** The running activity, if any. */
export const currentActivity = (): ActivityRun | null => current;

export const medalSource = (id: string, tier: Tier) => `medal:${id}:${tier}`;

/**
 * Start an activity (a new one cancels the running one at no cost). Returns null for a bad id. Emits `play start`.
 */
export function startActivity(spec: ActivitySpec, opts: ActivityOpts = {}): ActivityRun | null {
  if (!ACTIVITY_ID.test(spec.id)) return null;
  current?.cancel();
  const release = opts.lock ? holdLock('activity', spec.id) : () => {};
  const startedAt = runtime.time;
  let active = true;
  let grace = CANCEL_GRACE;
  let offFrame: () => void = () => {};
  const stop = (how: 'end' | 'cancel') => {
    if (!active) return false;
    active = false;
    offFrame();
    release();
    if (current === run) current = null;
    try { opts.onStop?.(how); } catch (error) { if (import.meta.env?.DEV) console.error('[opus-bay play] onStop', spec.id, error); }
    return true;
  };
  const run: ActivityRun & { stop: typeof stop } = {
    spec,
    startedAt,
    get active() { return active; },
    stop,
    cancel() { if (stop('cancel')) emit({ type: 'play', activity: spec.id, what: 'cancel' }); },
    end(result) {
      if (!stop('end')) return;
      finish(spec, result);
    },
  };
  if (opts.cancelOnMove) {
    offFrame = registerFrameSystem(`a-playkit-${spec.id}`, dt => {
      if (grace > 0) { grace -= dt; return; }
      if (Math.hypot(runtime.input.moveX, runtime.input.moveY) > MOVE_CANCEL) run.cancel();
    });
  }
  current = run;
  emit({ type: 'play', activity: spec.id, what: 'start' });
  return run;
}

/** The end of a run: the medals (first time per tier), the best, the event, the card. */
function finish(spec: ActivitySpec, result: ActivityResult) {
  const tier = result.tier;
  // what the ledger actually paid for this run (lane E emits `coins` right after each reward it pays)
  let paid = 0;
  const offCoins = onEvent(e => { if (e.type === 'coins' && e.delta > 0 && e.source.startsWith(`medal:${spec.id}:`)) paid += e.delta; });
  try {
    for (const t of TIERS) {
      if (t > tier) break;
      const source = medalSource(spec.id, t);
      if (paidThisSession.has(source) || !REWARD_SOURCE.test(source)) continue;
      paidThisSession.add(source);
      emit({ type: 'reward', source, coins: MEDAL_COINS[t], stamp: source });
    }
  } finally { offCoins(); }
  // the best: 新纪录！ when this run beat an earlier one, else the earlier best in the activity's words (上次你 18 秒！)
  let best: Bilingual | undefined;
  let fresh = false;
  if (result.score !== undefined && Number.isFinite(result.score)) {
    const old = bestOf(spec.id);
    const beat = recordBest(spec.id, result.score, spec.better ?? 'higher');
    fresh = beat && old !== undefined;
    if (old !== undefined && !beat && result.bestText) best = result.bestText(old);
  }
  emit({ type: 'play', activity: spec.id, what: 'end', ...(tier ? { tier } : {}) });
  if (result.card === false) return;
  playSound('play-medal', { gain: tier / 3 });
  showResult({ activity: spec.id, name: spec.name, tier, detail: result.detail, best, fresh, coins: paid, again: result.again });
}

/** tests: forget the session state */
export function __resetKit() { current?.cancel(); current = null; paidThisSession.clear(); sessionBests.clear(); }

// --- the result card ----------------------------------------------------------------------------------------------------

export interface ResultProps {
  activity: string;
  name: Bilingual;
  tier: 0 | Tier;
  detail?: Bilingual;
  /** the earlier best, when this run did not beat it */
  best?: Bilingual;
  /** this run beat an earlier best */
  fresh?: boolean;
  /** coins the ledger paid for this run's medals */
  coins?: number;
  again?: () => void;
}

export const RESULT_OVERLAY = 'play-result';
const ResultCard = lazy(() => import('./ResultCard'));
const ResultSlot = ({ props, close }: OverlayProps) => createElement(Suspense, { fallback: null }, createElement(ResultCard, { props: props as ResultProps, close }));

let resultOff: (() => void) | null = null;
/** The result card's overlay, registered once (init, or the first flight when lane C starts it first). */
export function ensureResultOverlay(): void {
  resultOff ??= registerOverlay({ id: RESULT_OVERLAY, Component: ResultSlot });
}
/** play/index.ts teardown */
export function unregisterResultOverlay(): void { resultOff?.(); resultOff = null; }

let lastResult: ResultProps | null = null;
/** The last card shown (tests / QA). */
export const lastResultShown = () => lastResult;

export function showResult(p: ResultProps) {
  lastResult = p;
  openOverlay(RESULT_OVERLAY, p);
}
export const closeResult = () => closeOverlay(RESULT_OVERLAY);
