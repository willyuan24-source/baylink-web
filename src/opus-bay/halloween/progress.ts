import type { Bilingual } from '../core/types';
import { HALLOWEEN_REWARD_IDS, halloweenSource } from './rewards';
import { doorsKnocked } from './treat';

/**
 * Wave 6 · lane G (W6-G4) · the season's goals and counts for the 万圣节 page (pure: `paid` is the ledger's isPaid):
 *
 *   doors      敲开 5 户人家的门 — first treats (`halloween:door:<n>`, lane G)
 *   pumpkins   找到 10 个南瓜灯 — hidden jack-o'-lanterns found (`halloween:pumpkin:<n>`, lane H's hunt; read from the
 *              ledger's frozen ids, so it counts whatever H numbers)
 *   costume    穿上一套万圣节服装 — `halloween:costume:first`
 */

export const GOAL_DOORS = 5;
export const GOAL_PUMPKINS = 10;

export interface HalloweenGoal { id: 'doors' | 'pumpkins' | 'costume'; text: Bilingual; have: number; need: number }

const PUMPKIN_IDS = HALLOWEEN_REWARD_IDS.filter(id => id.startsWith('pumpkin:'));
export const pumpkinsFound = (paid: (source: string) => boolean): number => PUMPKIN_IDS.filter(id => paid(halloweenSource(id))).length;
export const PUMPKINS_TOTAL = PUMPKIN_IDS.length;

export function halloweenGoals(paid: (source: string) => boolean): HalloweenGoal[] {
  return [
    { id: 'doors', text: { zh: `敲开 ${GOAL_DOORS} 户人家的门`, en: `Knock on ${GOAL_DOORS} doors for treats` }, have: Math.min(GOAL_DOORS, doorsKnocked(paid)), need: GOAL_DOORS },
    { id: 'pumpkins', text: { zh: `找到 ${GOAL_PUMPKINS} 个南瓜灯`, en: `Find ${GOAL_PUMPKINS} jack-o'-lanterns` }, have: Math.min(GOAL_PUMPKINS, pumpkinsFound(paid)), need: GOAL_PUMPKINS },
    { id: 'costume', text: { zh: '穿上一套万圣节服装', en: 'Wear a Halloween costume' }, have: paid(halloweenSource('costume:first')) ? 1 : 0, need: 1 },
  ];
}

/** The page tab's count: goals done of three (e.g. "1/3"). */
export const goalsDoneText = (paid: (source: string) => boolean): string => `${halloweenGoals(paid).filter(g => g.have >= g.need).length}/3`;
