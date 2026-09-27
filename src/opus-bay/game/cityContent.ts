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
import { RESIDENTS, taskDoneId, taskState } from '../data/sf/residents';
import { cityGoalTargets, initCityGoals } from './cityGoals';
import { markGoalsDone } from './flow';
import { registerInteractables, registerSubjectResolver, type Interactable } from './interactables';

/**
 * City content entry (lane G2 owns this file from wave 2).
 *
 *   initCityContent()   called once per page by game/flow.ts initFlowListeners (the Overlay's boot), in BOTH world
 *                       modes: returns early in district mode. City mode: the goal detectors (game/cityGoals.ts) and
 *                       the telescope / photo subject resolver for the SF landmarks, and BAYBAY's event and
 *                       neighbourhood lines (game/baybayLines.ts, its own chunk), the six residents' interactables
 *                       and their favours (game/residentTasks.ts, its own chunk; the bodies are actors/npcs.ts').
 *   goalTargets()       soft waypoints for unfinished city goals, read by flow.nextFreeGoal (free roam hint and the
 *                       call menu's "take me to the next goal"). `goal` is the goalsDone id that hides the target once
 *                       done; `id` resolves through interactables.interactableById (the landmark card `sf:<id>`).
 *                       A favour you said yes to adds its target with `first` (it leads until done).
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
  /** an accepted favour: offered before the goals */
  first?: boolean;
}

const RESIDENT_RADIUS = 2.8;

/** The residents as talk interactables (flow → setResidentTalk); the verb follows the favour's state. */
export function residentInteractables(goalsDone: readonly string[]): Interactable[] {
  const loaf = taskState(goalsDone, 'baker') === 'on';
  return RESIDENTS.map(r => ({
    id: r.id, source: 'npc', action: 'talk', name: r.name, x: r.at.x, z: r.at.z, radius: RESIDENT_RADIUS, npc: r.key,
    verb: r.key === 'gripman' && loaf ? { zh: '把面包交给 Ray', en: 'Give Ray the loaf' } : { zh: `和 ${r.short.zh} 聊聊`, en: `Talk to ${r.short.en}` },
  }));
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
  let offLines: (() => void) | null = null, offTasks: (() => void) | null = null, disposed = false;
  const fail = (what: string) => (e: unknown) => { if (import.meta.env?.DEV) console.error(`[opus-bay ${what}]`, e); };
  void import('./baybayLines').then(m => { if (!disposed) offLines = m.initBaybayLines(); }, fail('lines'));
  // the six residents (plan G2-6): talkable at once, their favours and words in their own chunk
  const offResidents = registerInteractables('g2-residents', () => residentInteractables(game.get().goalsDone));
  void import('./residentTasks').then(m => { if (!disposed) offTasks = m.initResidentTasks(); }, fail('residents'));
  return () => { disposed = true; offGoals(); offSubjects(); offLines?.(); offResidents(); offTasks?.(); };
}

let targets: GoalTarget[] | null = null;
export function goalTargets(): GoalTarget[] {
  if (!isCity()) return [];
  targets ??= cityGoalTargets();
  const done = game.get().goalsDone;
  const favours = RESIDENTS.filter(r => taskState(done, r.key) === 'on').map((r): GoalTarget => {
    const t = r.task.target;
    return { id: t.id, goal: taskDoneId(r.key), x: t.x, z: t.z, name: { zh: `小忙 · ${t.name.zh}`, en: `Favour · ${t.name.en}` }, radius: t.r, first: true };
  });
  return favours.length ? [...favours, ...targets] : targets;
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
