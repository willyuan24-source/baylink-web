import { emit, REWARD_SOURCE } from '../core/events';
import { game } from '../core/store';

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
