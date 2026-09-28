import { CITY_GOAL } from '../data/sf/goals';
import { DISTRICT } from '../data/district';
import { LANDMARK_ARRIVALS } from '../data/sf/arrivals';
import { cityPoiId } from '../data/sf/cityPois';
import type { GoalTarget } from './cityContent';

/**
 * City goal waypoints (lane G2, plan G2-5; lane C from wave 4). The goals themselves are data/sf/goals.ts; `postcards`,
 * `cable-car` (lane F calls completeGoal after a counted ride) and `viewpoint` (Coit's sweep) complete through
 * game/flow. The detectors (pure state machines) moved to game/cityDetectors.ts in wave 4: game/cityLive.ts (its own
 * chunk, with the landmark library: P7) imports them and feeds them from the runtime at 5 Hz. This module stays in the
 * main graph (the waypoints), so it imports no world/sf code.
 */

/** Soft waypoints for unfinished city goals (game/cityContent goalTargets): the landmark card of each place goal. */
export function cityGoalTargets(): GoalTarget[] {
  const out: GoalTarget[] = [];
  // wave 5 (W5-C2): goal #1, the pelican at Coit Tower (the district's viewpoint card: 带我去 walks up to the summit)
  const coit = DISTRICT.anchors?.['coit-view'];
  if (coit) out.push({ id: 'coit-tower', goal: CITY_GOAL.pelican, x: coit.x, z: coit.z, name: { zh: '找鹈鹕朋友 · 科伊特塔', en: 'Meet the pelican · Coit Tower' }, radius: 10 });
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
