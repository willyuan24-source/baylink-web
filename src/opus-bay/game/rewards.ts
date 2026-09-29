import { emit, onEvent, REWARD_SOURCE, type GameEvent } from '../core/events';
import { game } from '../core/store';
import { onSaveCleared } from '../data/save';

/**
 * Wave 5 · lane C · W5-C4 (plan sf-w5-plan.md §3.4 "rewards", §4.6): lane C's content asks lane E's ledger to pay.
 *
 * Every source follows the frozen grammar (core/events REWARD_SOURCE, `<prefix>:<id>`); the ledger pays each source ONCE
 * per save and may clamp `coins` to its own table. Lane C emits on the live, first-time event only (a goal already done
 * in an old save is never paid again on load):
 *
 *   arrive:<attraction id>   the first arrival moment at an attraction (game/cityMoments.ts): T1 10 · T2 5 · T3 3 coins,
 *                            stamp = the source (the notebook's 印章 page)
 *   postcard:<postcard id>   a postcard collected (game/flow.ts collectPostcard): 10
 *   favour:<resident key>    a neighbour's favour done (game/residentTasks.ts): 25
 *   goal:<goal id>           a city explorer goal done (flow completeGoal / markGoalsDone, FREE_GOALS ids only): 20;
 *                            `goal:pelican` (the glide unlock, W5-C2) and `goal:golden-gate` carry a stamp too
 *
 * City mode only (the economy is a city feature: district mode never emits). Dependency-light: flow.ts (main graph)
 * imports it.
 */

export const REWARD_COINS = {
  arrive: { 1: 10, 2: 5, 3: 3 } as Readonly<Record<1 | 2 | 3, number>>,
  postcard: 10,
  favour: 25,
  goal: 20,
} as const;

/** Goals whose completion is also a notebook stamp (plan §3.5 印章: the pelican, the bridge crossing). */
export const STAMP_GOALS: ReadonlySet<string> = new Set(['pelican', 'golden-gate']);

/** Emit one `reward` (city mode, a well-formed source, coins ≥ 0); false when nothing was emitted. */
export function emitReward(source: string, coins: number, stamp?: string): boolean {
  if (game.get().worldMode !== 'city' || !REWARD_SOURCE.test(source) || !Number.isFinite(coins) || coins < 0) return false;
  emit(stamp ? { type: 'reward', source, coins: Math.round(coins), stamp } : { type: 'reward', source, coins: Math.round(coins) });
  return true;
}

export const rewardArrival = (attraction: string, tier: 1 | 2 | 3) => emitReward(`arrive:${attraction}`, REWARD_COINS.arrive[tier] ?? 0, `arrive:${attraction}`);
export const rewardPostcard = (id: string) => emitReward(`postcard:${id}`, REWARD_COINS.postcard);
export const rewardFavour = (key: string) => emitReward(`favour:${key}`, REWARD_COINS.favour);
export const rewardGoal = (id: string) => emitReward(`goal:${id}`, REWARD_COINS.goal, STAMP_GOALS.has(id) ? `goal:${id}` : undefined);

// --- W6-K2 · rewards that come before the ledger is live ---------------------------------------------------------

/**
 * W6-K2 (lane E's review, sf-w5-summary NEXT #8): a `reward` emitted while no ledger listens was lost — the economy is a
 * lazy chunk, and a city moment in the first second of a resumed session (lane C's arrival, a goal, an egg) can come
 * before `economy/index` has run `initLedger`; lane C pays only on the live first-time event, so that source was never
 * paid. Every reward emitted in the city while the ledger is not live waits here (the ≤ PENDING_MAX newest), and
 * `initLedger` pays them the moment it starts (the ledger pays each source once, so a replay can never pay twice).
 * This module is in the main graph (flow.ts imports it), so the queue listens from the page's first frame.
 */
export const PENDING_MAX = 64;
type RewardEvent = Extract<GameEvent, { type: 'reward' }>;
const pending: RewardEvent[] = [];
let ledgerLive = false;
onEvent(e => {
  if (e.type !== 'reward' || ledgerLive || game.get().worldMode !== 'city') return;
  pending.push(e);
  if (pending.length > PENDING_MAX) pending.splice(0, pending.length - PENDING_MAX);
});

/** economy/ledger.ts initLedger: the ledger is live (returns the rewards that waited, oldest first) or gone (null). */
export function ledgerListening(live: boolean): readonly RewardEvent[] {
  ledgerLive = live;
  return live ? pending.splice(0) : [];
}

/** Tests / QA: the rewards waiting for a ledger. */
export const pendingRewards = (): readonly RewardEvent[] => pending;

/** A new save (Settings → reset) or a test: nothing waits any more. */
export function dropPendingRewards(): void { pending.length = 0; }
onSaveCleared(dropPendingRewards);
