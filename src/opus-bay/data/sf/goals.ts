import type { Bilingual, FreeGoal } from '../../core/types';

/**
 * City-mode explorer goals (lane G2, plan G2-5; lane C from wave 4). data/script.ts resolves FREE_GOALS to this list in
 * city mode.
 *
 * Ids are goalsDone ids. `postcards`, `cable-car` and `viewpoint` are game/flow GoalKeys (completeGoal('postcards')
 * when the 20th card is found, lane F's completeGoal('cable-car') after a counted ride, Coit's viewpoint sweep). The
 * other ids avoid every GOAL_WORDS word (ride, view, hill, card, photo, market, …) so no other key completes them
 * (`goalKeyOf(id) === null`, tested); game/cityGoals.ts detects them, and the wave-4 ones game/cityMoments.ts (lazy,
 * with its rules in data/sf/goalMarks.ts: this file is in the main graph, so it keeps only the list and the counts).
 */

const bi = (zh: string, en: string): Bilingual => ({ zh, en });

export const CITY_GOAL = {
  postcards: 'postcards',
  cableCar: 'cable-car',
  twinPeaks: 'twin-peaks',
  goldenGate: 'golden-gate',
  paintedLadies: 'painted-ladies',
  neighbourhoods: 'neighbourhoods',
  viewpoint: 'viewpoint',
  // wave 4 (lane C, W4-C8; plan §3.6)
  sightseeing: 'sightseeing',
  metro: 'metro',
  campuses: 'campuses',
} as const;

/** How many different city neighbourhoods (far.zones, the 41 DataSF areas) count for the goal. */
export const NEIGHBOURHOOD_TARGET = 8;
/** goalsDone prefix of a visited neighbourhood (`hood:<far zone id>`), kept in the save like every goalsDone id. */
export const HOOD_PREFIX = 'hood:';

/**
 * Wave 4 · the sightseeing goal: loop stops reached on real rides of the sightseeing bus (a `loop:<stop id>` mark per
 * stop, whichever ride reached it; 直接到站 counts, fast travel never rides). = data/sf/tours.ts SIGHTSEEING_STOPS.
 */
export const SIGHTSEEING_STOPS = 8;
export const LOOP_PREFIX = 'loop:';
/** Wave 4 · the campuses goal: arrival moments at CAMPUS_TARGET of the campuses (data/sf/goalMarks.ts CAMPUS_IDS). */
export const CAMPUS_TARGET = 3;
export const CAMPUS_PREFIX = 'campus:';

export const CITY_FREE_GOALS: FreeGoal[] = [
  { id: CITY_GOAL.postcards, label: bi('找齐 24 张旧金山明信片', 'Find all 24 San Francisco postcards'), hint: bi('留意发金光的小卡片，旅行本里有线索', 'Look for little golden glints — your journal has clues') },
  { id: CITY_GOAL.cableCar, label: bi('坐一段真的叮当车', 'Ride a real cable car'), hint: bi('去 Powell & Market 转车台上车，多坐几站', 'Board at the Powell & Market turntable and ride a few stops') },
  { id: CITY_GOAL.twinPeaks, label: bi('自己爬上双峰', 'Climb Twin Peaks yourself'), hint: bi('走路、骑车或开小车上山都算，飞过去不算', 'On foot, by bike or in the toy car — flying there doesn’t count') },
  { id: CITY_GOAL.goldenGate, label: bi('走过金门大桥', 'Cross the Golden Gate Bridge'), hint: bi('在桥面上从一座桥塔走到另一座', 'On the deck, from one tower to the other') },
  { id: CITY_GOAL.paintedLadies, label: bi('给彩绘女士拍张照', 'Photograph the Painted Ladies'), hint: bi('去阿拉莫广场，对着那排彩色老房子拍一张', 'Head to Alamo Square and snap the row of colourful houses') },
  { id: CITY_GOAL.neighbourhoods, label: bi(`逛 ${NEIGHBOURHOOD_TARGET} 个街区`, `Wander ${NEIGHBOURHOOD_TARGET} neighbourhoods`), hint: bi('走进新街区时，屏幕上会亮出它的名字', 'Each new neighbourhood shows its name as you walk in') },
  { id: CITY_GOAL.viewpoint, label: bi('登上 Coit Tower 观景点', 'Reach Coit Tower’s viewpoint'), hint: bi("从 Levi's Plaza 旁的 Filbert Steps 往上爬", "Climb the Filbert Steps by Levi's Plaza") },
  // wave 4 (lane C, W4-C8)
  { id: CITY_GOAL.sightseeing, label: bi(`坐观光巴士逛 ${SIGHTSEEING_STOPS} 站`, `Ride the sightseeing bus past ${SIGHTSEEING_STOPS} stops`), hint: bi('在有「观光」牌子的车站上车，BAYBAY 一路讲解；飞过去不算', 'Board at a stop with the coral sightseeing sign — BAYBAY tells you about the sights; flying doesn’t count') },
  { id: CITY_GOAL.metro, label: bi('坐地铁去海边或州立大学', 'Take the Metro to the sea or to SF State'), hint: bi('N 线坐到海洋海滩终点，或 M 线坐到石镇 / 州立大学', 'The N to the end at Ocean Beach, or the M to Stonestown / SF State') },
  { id: CITY_GOAL.campuses, label: bi(`大学巡礼：走到 ${CAMPUS_TARGET} 所大学`, `Campus tour: reach ${CAMPUS_TARGET} universities`), hint: bi('州立大学、旧金山大学、UCSF 两个校区、城市学院，走到校园门口就算', 'SF State, USF, UCSF’s two campuses, City College — walking up to the campus counts') },
];

/** Neighbourhoods visited so far (distinct `hood:` ids in goalsDone). */
export const neighbourhoodsVisited = (goalsDone: readonly string[]) => goalsDone.filter(id => id.startsWith(HOOD_PREFIX)).length;
/** Loop stops reached on the sightseeing bus so far (distinct `loop:` marks). */
export const loopStopsReached = (goalsDone: readonly string[]) => goalsDone.filter(id => id.startsWith(LOOP_PREFIX)).length;
/** Campuses arrived at so far (distinct `campus:` marks). */
export const campusesVisited = (goalsDone: readonly string[]) => goalsDone.filter(id => id.startsWith(CAMPUS_PREFIX)).length;

/** Progress text for goals that count up ("3/8"), or null; used by the goals card and the journal. */
export function goalProgress(goalId: string, goalsDone: readonly string[]): string | null {
  if (goalsDone.includes(goalId)) return null;
  const count = goalId === CITY_GOAL.neighbourhoods ? [neighbourhoodsVisited(goalsDone), NEIGHBOURHOOD_TARGET]
    : goalId === CITY_GOAL.sightseeing ? [loopStopsReached(goalsDone), SIGHTSEEING_STOPS]
      : goalId === CITY_GOAL.campuses ? [campusesVisited(goalsDone), CAMPUS_TARGET] : null;
  return count ? `${Math.min(count[1], count[0])}/${count[1]}` : null;
}
