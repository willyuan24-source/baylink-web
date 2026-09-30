import type { Bilingual } from '../core/types';
import { HALLOWEEN_POSTCARDS, type HalloweenPostcard, type HalloweenPostcardId } from '../data/sf/halloweenPostcards';
import { HUNT_XZ } from './huntSpots';
import { MUERTOS_SPOTS } from './muertosSpots';
import { halloweenSource } from './rewards';
import { doorsKnocked, nightSource } from './treat';
import { TREAT_DOORS } from './treatDoors';

/**
 * Wave 7 · lane G (W7-G1) · the four Halloween postcards (lane X's paintings, data/sf/halloweenPostcards.ts), earned at
 * their moments. Pure (no three.js, no DOM): each card's gate reads the ledger (`paid` = economy/ledger isPaid), so a card
 * earned before this wiring shipped still shows, a Settings reset takes it away, and nothing new is saved.
 *
 *   halloween-pumpkin-hunt     the hunt's end: `halloween:hunt:all` (every one of the 40 jack-o'-lanterns, lane H)
 *   halloween-trick-or-treat   the first trick-or-treat: any `halloween:door:<n>` (lane G's doors)
 *   halloween-big-night        the first treat on 31 October: any `halloween:night:<n>`
 *   muertos-mission            every Día de los Muertos spot seen: `halloween:muertos:12` (lane H, 1–2 November)
 *
 * These are not among the city's 24 collectable postcards (game/flow.ts collectPostcard): they never count toward 0/24.
 */

export type Paid = (source: string) => boolean;

export interface HalloweenCardGate {
  id: HalloweenPostcardId;
  /** earned (read from the ledger) */
  earned(paid: Paid): boolean;
  /** how to earn it (shown on a locked card) */
  how: Bilingual;
}

const HUNT_ALL = halloweenSource('hunt:all');
const MUERTOS_ALL = halloweenSource('muertos:12');
const liveDoors = TREAT_DOORS.filter(d => !d.gone);

export const HALLOWEEN_CARD_GATES: readonly HalloweenCardGate[] = [
  {
    id: 'halloween-trick-or-treat', earned: paid => doorsKnocked(paid) >= 1,
    how: { zh: '去讨糖街敲开第一户人家的门', en: 'Trick-or-treat at your first door' },
  },
  {
    id: 'halloween-pumpkin-hunt', earned: paid => paid(HUNT_ALL),
    how: { zh: `找齐全城 ${HUNT_XZ.length} 个南瓜灯`, en: `Find all ${HUNT_XZ.length} jack-o’-lanterns in the city` },
  },
  {
    id: 'halloween-big-night', earned: paid => liveDoors.some(d => paid(nightSource(d.n))),
    how: { zh: '10 月 31 日万圣节夜去讨糖', en: 'Trick-or-treat on Halloween, 31 October' },
  },
  {
    id: 'muertos-mission', earned: paid => paid(MUERTOS_ALL),
    how: { zh: `亡灵节（11 月 1–2 日）看遍教会区的 ${MUERTOS_SPOTS.length} 处`, en: `See all ${MUERTOS_SPOTS.length} Día de los Muertos spots in the Mission (1–2 November)` },
  },
];

const CARD_BY_ID = new Map(HALLOWEEN_POSTCARDS.map(c => [c.id, c]));

/** The cards in the notebook's order (the season's order: the first door, the hunt, the big night, the Mission). */
export const HALLOWEEN_CARD_ORDER: readonly HalloweenPostcard[] = HALLOWEEN_CARD_GATES.map(g => CARD_BY_ID.get(g.id)!);

/** The ids earned in this save. */
export const earnedHalloweenCards = (paid: Paid): HalloweenPostcardId[] => HALLOWEEN_CARD_GATES.filter(g => g.earned(paid)).map(g => g.id);

/** How many of the four are earned. */
export const halloweenCardCount = (paid: Paid): number => earnedHalloweenCards(paid).length;

/** The gate of a card (its hint). */
export const halloweenCardGate = (id: string): HalloweenCardGate | null => HALLOWEEN_CARD_GATES.find(g => g.id === id) ?? null;

/** The cards this ledger change earned (in `after`, not in `before`), in the season's order. */
export const newlyEarned = (before: readonly string[], after: readonly string[]): HalloweenPostcardId[] =>
  HALLOWEEN_CARD_GATES.map(g => g.id).filter(id => after.includes(id) && !before.includes(id));

/**
 * Whether the notebook shows the Halloween postcards block: always once one is earned (it stays after 2 November, when
 * the 万圣节 journal tab goes away), and in the season (so the player sees what there is to earn).
 */
export const showCardsBlock = (paid: Paid, inSeason: boolean): boolean => inSeason || halloweenCardCount(paid) > 0;
