import type { Bilingual } from '../core/types';
import type { HalloweenPhase } from './season';
import { halloweenSource } from './rewards';
import { TREAT_DOORS, type TreatDoor } from './treatDoors';

/**
 * Wave 6 · lane G (W6-G2) · trick-or-treat, the rules (pure: no three.js, no DOM; tests/opus-bay-w6-g-treat.test.ts).
 *
 *   season (1–30 Oct)  a door answers on most days: a fixed daily roll per door (4 in 5 in the treat hours 16–22, 2 in 3
 *                      before); an answering door gives one candy and pays `halloween:door:<n>` DOOR_COINS once per save
 *   night (31 Oct)     every door answers, double treats: two candies, `halloween:night:<n>` NIGHT_COINS (and the door's
 *                      own `door:<n>` when it was never knocked before)
 *   muertos · off      no trick-or-treat (the doors are not dressed)
 *
 * The candy bag is what the ledger paid (persistent, never counted twice): one candy per `door:<n>`, two per `night:<n>`.
 */

export const DOOR_COINS = 5;
export const NIGHT_COINS = 5;

export interface Candy { id: string; name: Bilingual; color: string; wrap: string }
export const CANDIES: readonly Candy[] = [
  { id: 'toffee', name: { zh: '太妃糖', en: 'toffee' }, color: '#c98a4b', wrap: '#f3e6c8' },
  { id: 'lollipop', name: { zh: '棒棒糖', en: 'lollipop' }, color: '#e8566b', wrap: '#f7eedb' },
  { id: 'chocolate', name: { zh: '巧克力', en: 'chocolate bar' }, color: '#6b4226', wrap: '#e0a94a' },
  { id: 'gummy', name: { zh: '小熊软糖', en: 'gummy bears' }, color: '#7fc45a', wrap: '#f2a93b' },
  { id: 'candy-corn', name: { zh: '玉米糖', en: 'candy corn' }, color: '#f2a93b', wrap: '#fff4dc' },
  { id: 'caramel-apple', name: { zh: '焦糖苹果', en: 'caramel apple' }, color: '#d9534f', wrap: '#c98a4b' },
];

/** A small stable hash (door number × Bay date): the day's roll, the candy. */
export function roll(n: number, dateKey: string, salt = 0): number {
  let h = 2166136261 ^ (n * 374761393 + salt * 668265263);
  for (let i = 0; i < dateKey.length; i++) h = Math.imul(h ^ dateKey.charCodeAt(i), 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** The doors on offer now: the season and the big night dress them. */
export const doorsDressed = (phase: HalloweenPhase): boolean => phase === 'season' || phase === 'night';

/** Whether door `n` answers today (every door on the big night; a daily roll in the season). */
export function doorAnswers(n: number, phase: HalloweenPhase, dateKey: string, treatHour: boolean): boolean {
  if (phase === 'night') return true;
  if (phase !== 'season') return false;
  return roll(n, dateKey) < (treatHour ? 0.8 : 2 / 3);
}

export const candyOf = (n: number, dateKey: string): Candy => CANDIES[Math.floor(roll(n, dateKey, 7) * CANDIES.length) % CANDIES.length];

export const doorSource = (n: number): string => halloweenSource(`door:${n}`);
export const nightSource = (n: number): string => halloweenSource(`night:${n}`);

export type Knock =
  | { kind: 'treat'; candy: Candy; pieces: number; pays: readonly { source: string; coins: number }[] }
  | { kind: 'again' }
  | { kind: 'nobody' }
  | { kind: 'closed' };

/** What a knock on door `n` gives now (`paid`: the ledger's isPaid). */
export function knockResult(n: number, phase: HalloweenPhase, dateKey: string, treatHour: boolean, paid: (source: string) => boolean): Knock {
  if (!doorsDressed(phase)) return { kind: 'closed' };
  const door = paid(doorSource(n));
  if (phase === 'night') {
    if (paid(nightSource(n))) return { kind: 'again' };
    const pays = [{ source: nightSource(n), coins: NIGHT_COINS }];
    if (!door) pays.unshift({ source: doorSource(n), coins: DOOR_COINS });
    return { kind: 'treat', candy: candyOf(n, dateKey), pieces: 2, pays };
  }
  if (door) return { kind: 'again' };
  if (!doorAnswers(n, phase, dateKey, treatHour)) return { kind: 'nobody' };
  return { kind: 'treat', candy: candyOf(n, dateKey), pieces: 1, pays: [{ source: doorSource(n), coins: DOOR_COINS }] };
}

const live = (doors: readonly TreatDoor[]) => doors.filter(d => !d.gone);

/** Doors knocked (a first treat paid) this save. */
export const doorsKnocked = (paid: (source: string) => boolean, doors: readonly TreatDoor[] = TREAT_DOORS): number => live(doors).filter(d => paid(doorSource(d.n))).length;

/** The candy bag: one per door treat, two per big-night treat. */
export const candyCount = (paid: (source: string) => boolean, doors: readonly TreatDoor[] = TREAT_DOORS): number =>
  live(doors).reduce((s, d) => s + (paid(doorSource(d.n)) ? 1 : 0) + (paid(nightSource(d.n)) ? 2 : 0), 0);

/** Every door of the season has given its first treat. */
export const allDoorsKnocked = (paid: (source: string) => boolean, doors: readonly TreatDoor[] = TREAT_DOORS): boolean => doorsKnocked(paid, doors) >= live(doors).length;

/** What the bag and the doors stood at (before / after a treat). */
export interface BagState { doors: number; bag: number; all: boolean }
export type TreatMilestone = 'w6g-goal-done' | 'w6g-all-doors' | 'w6g-not-too-much' | 'w6g-bag-heavy';

/**
 * W6-G-review: BAYBAY's line after a treat — the milestone THIS treat crossed (the goal's fifth door first, then every
 * door, the bag's tenth candy, its fifth), else null. Counting crossings (not "once a session") keeps a big-night knock on
 * a door knocked in the season, or the first treat of a resumed save, from repeating a milestone already reached.
 */
export function treatMilestone(before: BagState, after: BagState, goalDoors: number): TreatMilestone | null {
  if (before.doors < goalDoors && after.doors >= goalDoors) return 'w6g-goal-done';
  if (!before.all && after.all) return 'w6g-all-doors';
  if (before.bag < 10 && after.bag >= 10) return 'w6g-not-too-much';
  if (before.bag < 5 && after.bag >= 5) return 'w6g-bag-heavy';
  return null;
}

/** W6-G-review: the 万圣节 page offers 带我去 to a street only while its doors are dressed and some are left to knock. */
export const streetGoOffered = (phase: HalloweenPhase, knocked: number, total: number): boolean => doorsDressed(phase) && knocked < total;

/** W6-G-review: the reward a street's progress counts on the page — tonight's treats on the big night, else the first ones. */
export const pageSourceOf = (phase: HalloweenPhase, n: number): string => (phase === 'night' ? nightSource(n) : doorSource(n));
