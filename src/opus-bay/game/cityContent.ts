import type { Bilingual, FreeGoal, PoiDef, PostcardDef } from '../core/types';
import { game, type WorldMode } from '../core/store';
import { heightAt } from '../core/terrain';
import { byMode, CONTENT_MODE } from '../data/contentMode';
import { CITY_POIS } from '../data/sf/cityPois';
import { CITY_POSTCARDS } from '../data/sf/postcards';
import { DISTRICT_POIS } from '../data/pois';
import { DISTRICT_POSTCARDS } from '../data/postcards';
import { CITY_FREE_GOALS } from '../data/sf/goals';
import { CITY_GUIDE_BARKS, CITY_SCRIPT_HOOKS, CITY_START_NODE, DISTRICT_FREE_GOALS, DISTRICT_GUIDE_BARKS, DISTRICT_SCRIPT_HOOKS, DISTRICT_START_NODE } from '../data/script';
import { sfLandmark } from '../world/sf/landmarks/index';
import { sfLandmarkInfo } from '../data/sf/landmarks';
import { cityGoalTargets, initCityGoals } from './cityGoals';
import { markGoalsDone } from './flow';
import { registerSubjectResolver } from './interactables';

/**
 * City content entry (lane G2 owns this file from wave 2).
 *
 *   initCityContent()   called once per page by game/flow.ts initFlowListeners (the Overlay's boot), in BOTH world
 *                       modes: returns early in district mode. City mode: the goal detectors (game/cityGoals.ts) and
 *                       the telescope / photo subject resolver for the SF landmarks, and BAYBAY's event and
 *                       neighbourhood lines (game/baybayLines.ts, its own chunk). (Residents: a later part.)
 *   goalTargets()       soft waypoints for unfinished city goals, read by flow.nextFreeGoal (free roam hint and the
 *                       call menu's "take me to the next goal"). `goal` is the goalsDone id that hides the target once
 *                       done; `id` resolves through interactables.interactableById (the landmark card `sf:<id>`).
 *   contentFor(mode)    the resolved content tables of a world mode (tests: `contentFor('district')` is v1).
 */

export interface GoalTarget {
  /** interactable / place id the waypoint and "take me there" resolve */
  id: string;
  /** goalsDone id: the target disappears once it is done */
  goal: string;
  x: number;
  z: number;
  name: Bilingual;
  /** arrival radius (u); default 3 */
  radius?: number;
}

const isCity = () => game.get().worldMode === 'city';

export function initCityContent(): () => void {
  if (!isCity()) return () => {};
  const offGoals = initCityGoals({ done: markGoalsDone, heightAt });
  // telescope / photo subjects: an SF landmark id resolves to a point about 60 % up its model
  const offSubjects = registerSubjectResolver(subject => {
    const l = sfLandmark(subject), info = sfLandmarkInfo(subject);
    if (!l || !info) return null;
    const base = typeof l.base === 'number' ? l.base : heightAt(l.x, l.z);
    return { x: l.x, y: base + Math.max(2, info.height.u * 0.6), z: l.z };
  });
  // BAYBAY's event and neighbourhood lines (plan G2-4): their own chunk, fetched only in city mode
  let offLines: (() => void) | null = null, disposed = false;
  void import('./baybayLines').then(m => { if (!disposed) offLines = m.initBaybayLines(); }, (e: unknown) => { if (import.meta.env?.DEV) console.error('[opus-bay lines]', e); });
  return () => { disposed = true; offGoals(); offSubjects(); offLines?.(); };
}

let targets: GoalTarget[] | null = null;
export function goalTargets(): GoalTarget[] {
  if (!isCity()) return [];
  return (targets ??= cityGoalTargets());
}

export interface ContentTables {
  pois: PoiDef[];
  postcards: PostcardDef[];
  freeGoals: FreeGoal[];
  guideBarks: Record<string, Bilingual[]>;
  startNode: string;
  scriptHooks: Record<string, string | Readonly<Record<string, string>>>;
}

/** The content tables a world mode resolves to (what data/pois, postcards and script export in that mode). */
export function contentFor(mode: WorldMode = CONTENT_MODE): ContentTables {
  return {
    pois: byMode(DISTRICT_POIS, [...DISTRICT_POIS, ...CITY_POIS], mode),
    postcards: byMode(DISTRICT_POSTCARDS, [...DISTRICT_POSTCARDS, ...CITY_POSTCARDS], mode),
    freeGoals: byMode(DISTRICT_FREE_GOALS, CITY_FREE_GOALS, mode),
    guideBarks: byMode<Record<string, Bilingual[]>>(DISTRICT_GUIDE_BARKS, CITY_GUIDE_BARKS, mode),
    startNode: byMode(DISTRICT_START_NODE, CITY_START_NODE, mode),
    scriptHooks: byMode<ContentTables['scriptHooks']>(DISTRICT_SCRIPT_HOOKS, CITY_SCRIPT_HOOKS, mode),
  };
}
