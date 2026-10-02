import type { Bilingual, FreeGoal, PoiDef, PostcardDef } from '../core/types';
import { game, type WorldMode } from '../core/store';
import { heightAt } from '../core/terrain';
import { byMode, CONTENT_MODE } from '../data/contentMode';
import { CITY_POIS } from '../data/sf/cityPois';
import { CITY_POSTCARDS } from '../data/sf/postcards';
import { CITY_DISTRICT_POIS, DISTRICT_POIS } from '../data/pois';
import { DISTRICT_POSTCARDS } from '../data/postcards';
import { CITY_FREE_GOALS } from '../data/sf/goals';
import { CITY_GUIDE_BARKS, CITY_SCRIPT_HOOKS, CITY_START_NODE, DISTRICT_FREE_GOALS, DISTRICT_GUIDE_BARKS, DISTRICT_SCRIPT_HOOKS, DISTRICT_START_NODE } from '../data/scriptSlot';
import { CITY_DATA } from '../data/sf/cityData';
import { runtime } from '../core/runtime';
import { cityGoalTargets } from './cityGoals';
import { bubble, markGoalsDone } from './flow';
import { flow } from './flowStore';
import { registerInteractables, type Interactable } from './interactables';
import { initW5Features } from './w5Features';
import { importRetry } from './importRetry';

// W6-P3 (lane P, MF9): the six residents come with the city data chunk (data/sf/cityDataChunk.ts); every reader below
// runs in city mode only (initCityContent and goalTargets return early in the district)
type CityData = NonNullable<typeof CITY_DATA>;
const RESIDENTS: CityData['RESIDENTS'] = CITY_DATA?.RESIDENTS ?? [];
const taskState: CityData['taskState'] = (...a) => CITY_DATA!.taskState(...a);
const task2State: CityData['task2State'] = (...a) => CITY_DATA!.task2State(...a);
const taskDoneId: CityData['taskDoneId'] = (...a) => CITY_DATA!.taskDoneId(...a);
const task2DoneId: CityData['task2DoneId'] = (...a) => CITY_DATA!.task2DoneId(...a);
const nextPhotoSpot: CityData['nextPhotoSpot'] = (...a) => CITY_DATA!.nextPhotoSpot(...a);

/**
 * City content entry (lane G2 owns this file from wave 2).
 *
 *   initCityContent()   called once per page by game/flow.ts initFlowListeners (the Overlay's boot), in BOTH world
 *                       modes: returns early in district mode. City mode: the goal detectors and the telescope / photo
 *                       subject resolver for the SF landmarks (game/cityLive.ts, its own chunk: it needs the landmark
 *                       library, which stays out of GameRoot, P7), BAYBAY's event and
 *                       neighbourhood lines (game/baybayLines.ts, its own chunk), the six residents' interactables
 *                       and their favours (game/residentTasks.ts, its own chunk; the bodies are actors/npcs.ts').
 *                       Wave 5: the four feature folders through game/w5Features.ts (economy first; lazy chunks).
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

/** Wave 4 · lane C's lazy city modules once loaded (game/cityMoments.ts): read through the functions below. */
let moments: typeof import('./cityMoments') | null = null;

export function initCityContent(): () => void {
  if (!isCity()) return () => {};
  let offLive: (() => void) | null = null, offLines: (() => void) | null = null, offTasks: (() => void) | null = null, disposed = false;
  let offTrips: (() => void) | null = null, offMoments: (() => void) | null = null, offCards: (() => void) | null = null;
  const fail = (what: string) => (e: unknown) => { if (import.meta.env?.DEV) console.error(`[opus-bay ${what}]`, e); };
  // the goal detectors and the SF landmark subjects (plan G2-5): their own chunk with the landmark library
  void importRetry(() => import('./cityLive')).then(m => { if (!disposed) offLive = m.initCityLive({ done: markGoalsDone, heightAt, say: (text, id) => baybayLine(text, { ttl: 12, id }) }); }, fail('city goals'));
  // BAYBAY's event and neighbourhood lines (plan G2-4): their own chunk, fetched only in city mode
  void importRetry(() => import('./baybayLines')).then(m => { if (!disposed) offLines = m.initBaybayLines(); }, fail('lines'));
  // the six residents (plan G2-6): talkable at once, their favours and words in their own chunk
  const offResidents = registerInteractables('g2-residents', () => residentInteractables(game.get().goalsDone));
  void importRetry(() => import('./residentTasks')).then(m => { if (!disposed) offTasks = m.initResidentTasks(); }, fail('residents'));
  // wave 4 (lane C): trips (flow.trip), arrival moments + BAYBAY's paced lines + the ride goals, the place cards
  void importRetry(() => import('./tripRun')).then(m => { if (!disposed) offTrips = m.initTripRun(); }, fail('trips'));
  void importRetry(() => import('./cityMoments')).then(m => { if (!disposed) { moments = m; offMoments = m.initCityMoments(); } }, fail('moments'));
  void importRetry(() => import('./cityCards')).then(m => { if (!disposed) offCards = m.initCityCards(); }, fail('cards'));
  // wave 5 (lane C, W5-C3): the goals step (the overlay, once per player)
  let offStep: (() => void) | null = null;
  void importRetry(() => import('./goalsStep')).then(m => { if (!disposed) offStep = m.initGoalsStep(); }, fail('goals step'));
  // wave 5 (lane C, W5-C7): the album (photos are kept on this device instead of downloaded; More → 相册)
  let offAlbum: (() => void) | null = null;
  void importRetry(() => import('./album')).then(m => { if (!disposed) offAlbum = m.initAlbum(); }, fail('album'));
  // wave 5 (day 0, game/w5Features.ts): the economy (first), play, eggs and real-SF features, each a lazy city chunk
  const w5 = initW5Features();
  return () => { disposed = true; offLive?.(); offLines?.(); offResidents(); offTasks?.(); offTrips?.(); offMoments?.(); offCards?.(); offStep?.(); offAlbum?.(); w5.off(); moments = null; };
}

/** Lane P's map: has the player had the arrival moment of this attraction? (false before the city content loads) */
export const arrivalSeen = (attraction: string): boolean => moments?.arrivalSeen(attraction) ?? false;

/**
 * Wave 5 · W5-C1: one of BAYBAY's lines through her pacer (game/cityMoments.ts): it waits for the line she is saying
 * (tour, transit, arrival), is dropped after `ttl` s (default 30) rather than said late, and is not said twice within a
 * few minutes. Before the city chunk lands (or in district mode) it is a plain bubble. zh ≤ 45 characters. Returns
 * false when the pacer refused it (a repeat).
 */
export function baybayLine(text: Bilingual, opts: { ttl?: number; id?: string; valid?: () => boolean; onSay?: () => void } = {}): boolean {
  // (W5-C6: `id` = a frozen line of data/sf/linesW5.ts with the same text: the pacer plays its clip once recorded)
  // (W8-W2-review: `valid` drops a waiting place line once the player has left the place; `onSay` when it is said)
  const hooks = opts.valid || opts.onSay ? { valid: opts.valid, onSay: opts.onSay } : undefined;
  if (moments) return opts.id ? moments.offerLineOr(opts.id, text, opts.ttl ?? 30, undefined, hooks) : moments.offerLine(text, opts.ttl ?? 30, undefined, hooks);
  // (no pacer yet: after the bubble on screen, never over it)
  if (opts.valid && !opts.valid()) return false;
  if (flow.get().bubble) setTimeout(() => bubble(text, 4200), 4600); else bubble(text, 4200);
  opts.onSay?.();
  return true;
}

/**
 * Wave 5 · W5-C2: meet the pelican now (the Coit sweep; game/pelicanFirst.ts, in the city chunk). A no-op before the
 * chunk lands, in district mode or once unlocked (the move system's own unlock stands in). True when it unlocked.
 */
export const unlockPelican = (reason: 'viewpoint' | 'sweep' | 'tour'): boolean => moments?.unlockPelican(reason) ?? false;

/**
 * Wave 5 · W5-C6: a frozen line (data/sf/linesW5.ts id) shown as a plain bubble or a dialogue: its recorded clip plays with
 * it once lane V has recorded it (nothing before the city chunk lands, or without a clip).
 */
export const speakRecorded = (id: string): boolean => moments?.speakRecorded(id) ?? false;

/** Lane N's request: a carried trip's time label (the auto-travel pace), null before the city chunk lands. */
export const carriedTimeLabel = (d: number): Bilingual | null => moments?.carriedTime(d) ?? null;

/** Wave 5 · W5-C3: a resume places the player where they were — that is not an arrival (no reveal, no toast). */
export const settleArrivals = (): number => moments?.settleArrivals() ?? 0;
/** Lane T's subway overlay: BAYBAY's tunnel line for the arc span it goes under ground on (nothing before load). */
export function sayTunnel(line: string, fromAt: number, toAt: number) { moments?.sayTunnel(line, fromAt, toAt); }
/** Lane T's countRide for a sightseeing-bus ride finished with 直接到站: every loop stop of it counts for the goal. */
export function noteLoopRide(from: string, to: string) { moments?.noteLoopRide(from, to); }

/** Wave 4: more goal targets from the lazy city modules (the loop stops, Metro stations and campuses of lane C's goals). */
const extraTargets = new Map<string, () => GoalTarget[]>();
export function registerGoalTargets(key: string, fn: () => GoalTarget[]): () => void {
  extraTargets.set(key, fn);
  return () => { if (extraTargets.get(key) === fn) extraTargets.delete(key); };
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
  // wave 5 (W5-C7): a second favour on leads too (a photo favour: its nearest spot not photographed yet)
  for (const r of RESIDENTS) {
    if (task2State(done, r.key) !== 'on') continue;
    const t = r.task2.target, s = nextPhotoSpot(done, r, runtime.player);
    const at = s ? { x: s.x, z: s.z, name: s.name } : t;
    favours.push({ id: t.id, goal: task2DoneId(r.key), x: at.x, z: at.z, name: { zh: `小忙 · ${at.name.zh}`, en: `Favour · ${at.name.en}` }, radius: t.r, first: true });
  }
  const extra = [...extraTargets.values()].flatMap(fn => fn());
  return favours.length || extra.length ? [...favours, ...targets, ...extra] : targets;
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
    pois: byMode(DISTRICT_POIS, [...CITY_DISTRICT_POIS, ...CITY_POIS], mode),
    postcards: byMode(DISTRICT_POSTCARDS, [...DISTRICT_POSTCARDS, ...CITY_POSTCARDS], mode),
    freeGoals: byMode(DISTRICT_FREE_GOALS, CITY_FREE_GOALS, mode),
    guideBarks: byMode<Record<string, Bilingual[]>>(DISTRICT_GUIDE_BARKS, CITY_GUIDE_BARKS, mode),
    startNode: byMode(DISTRICT_START_NODE, CITY_START_NODE, mode),
    scriptHooks: byMode<ContentTables['scriptHooks']>(DISTRICT_SCRIPT_HOOKS, CITY_SCRIPT_HOOKS, mode),
  };
}
