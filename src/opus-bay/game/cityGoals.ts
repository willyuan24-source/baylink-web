import { CITY_GOAL } from '../data/sf/goals';
import { DISTRICT } from '../data/district';
import { LANDMARK_ARRIVALS } from '../data/sf/arrivals';
import { cityPoiId } from '../data/sf/cityPois';
import type { GoalTarget } from './cityContent';
import { registerPrefixResolver, type Interactable } from './interactables';

/**
 * City goal waypoints (lane G2, plan G2-5; lane C from wave 4). The goals themselves are data/sf/goals.ts; `postcards`,
 * `cable-car` (lane F calls completeGoal after a counted ride) and `viewpoint` (Coit's sweep) complete through
 * game/flow. The detectors (pure state machines) moved to game/cityDetectors.ts in wave 4: game/cityLive.ts (its own
 * chunk, with the landmark library: P7) imports them and feeds them from the runtime at 5 Hz. This module stays in the
 * main graph (the waypoints), so it imports no world/sf code.
 */

/**
 * Wave 5 (W5-C2): goal #1's place — the Coit Tower summit (the district's viewpoint anchor), by the game's zh name
 * (the district card itself is "Coit Tower 观景点" and stays as it is). Resolved like `clue:` ids: the waypoint, the
 * goals step's big button and 带我去 lead there ("跟我来！去科伊特塔"); not in interactables() (no E prompt).
 */
export const PELICAN_TARGET = 'pelican:coit';
const RADIUS = 10;
/**
 * The verb BAYBAY names when the lead arrives (flow.freeLeadArrived: 到啦！试试「…」～) = the prompt the player finds
 * there, the Coit viewpoint's (data/pois.ts `coit-tower`: 眺望海湾). Review: it said 试试「看看海湾」 over a 眺望海湾 prompt.
 */
export const PELICAN_TARGET_VERB = { zh: '眺望海湾', en: 'Take in the view' } as const;
function pelicanTarget(): Interactable | undefined {
  const coit = DISTRICT.anchors?.['coit-view'];
  return coit ? { id: PELICAN_TARGET, source: 'place', action: 'info', verb: { ...PELICAN_TARGET_VERB }, name: { zh: '科伊特塔', en: 'Coit Tower' }, x: coit.x, z: coit.z, radius: RADIUS } : undefined;
}
registerPrefixResolver('pelican:', id => (id === PELICAN_TARGET ? pelicanTarget() : undefined));

/** Soft waypoints for unfinished city goals (game/cityContent goalTargets): the landmark card of each place goal. */
export function cityGoalTargets(): GoalTarget[] {
  const out: GoalTarget[] = [];
  const coit = pelicanTarget();
  if (coit) out.push({ id: PELICAN_TARGET, goal: CITY_GOAL.pelican, x: coit.x, z: coit.z, name: { zh: '找鹈鹕朋友 · 科伊特塔', en: 'Meet the pelican · Coit Tower' }, radius: RADIUS });
  const add = (goal: string, landmark: string, name: GoalTarget['name']) => {
    const at = LANDMARK_ARRIVALS[landmark];
    if (at) out.push({ id: cityPoiId(landmark), goal, x: at.x, z: at.z, name, radius: 4 });
  };
  add(CITY_GOAL.cableCar, 'cable-car-turntable', { zh: '叮当车 · Powell & Market 转车台', en: 'Cable car · Powell & Market turntable' });
  add(CITY_GOAL.twinPeaks, 'twin-peaks', { zh: '爬上双峰', en: 'Climb Twin Peaks' });
  add(CITY_GOAL.goldenGate, 'golden-gate-bridge', { zh: '走过金门大桥', en: 'Cross the Golden Gate Bridge' });
  add(CITY_GOAL.paintedLadies, 'painted-ladies', { zh: '给彩绘女士拍张照', en: 'Photograph the Painted Ladies' });
  return out;
}
