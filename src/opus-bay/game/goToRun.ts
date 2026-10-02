import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { canStand, nearestWalkable } from '../core/terrain';
import type { Bilingual, Vec2 } from '../core/types';
import { ATTRACTION_INDEX, tripDestination } from '../data/sf/attractions';
import type { Attraction } from '../data/sf/attractionTypes';
import { type CityPlace, loadPlaces, placeById } from '../data/sf/places';
import { travelActive } from './fastTravel';
import { W8K_LINES } from './fixedLines';
import { bubble, closePanel, say, startTrip } from './flow';
import type { GoToOptions, GoToResult, GoToTarget } from './goTo';
import { BAYBAY_ID, interactableById } from './interactables';
import { GOAL_SLACK, HERE_R, optionPending, planTrips } from './tripPlan';
import { tripProviders, tripRouteCache } from './tripProviders';
import { initTripRun } from './tripRun';
import type { TripOption, TripSource } from './tripTypes';

/**
 * Wave 5 · lane N · W5-N1: the work behind game/goTo.ts (city chunk, loaded on the first `goTo`). Pure parts
 * (`resolveGoToTarget`, `chooseGoToOption`, `goToSource`) are exported for tests/opus-bay-w5-nav.test.ts.
 */

/** Where a goTo ends: the trip runner's TripDest with every field known. */
export interface GoToDest { placeId: string; x: number; z: number; name: Bilingual; attraction?: string }

/** The lookups resolveGoToTarget needs (the game's, or fakes in tests). */
export interface GoToLookups {
  /** an attraction by its id or an SF landmark id (data/sf/attractions ATTRACTION_INDEX.resolve) */
  attraction(id: string): Pick<Attraction, 'id' | 'name' | 'placeId' | 'x' | 'z' | 'arrival' | 'short'> | undefined;
  /** the attraction that speaks for a place-index row (ATTRACTION_INDEX.primary) */
  primary?(placeId: string): Pick<Attraction, 'id' | 'name' | 'placeId' | 'x' | 'z' | 'arrival' | 'short'> | undefined;
  /** a place-index row (data/sf/places placeById) */
  place(id: string): Pick<CityPlace, 'id' | 'name' | 'arrival'> | undefined;
  /** an interactable (a district POI, a station `transit-…`, `place:<id>`) */
  interactable(id: string): { id: string; x: number; z: number; name: Bilingual } | undefined;
  /** snap a bare point onto walkable ground (null: leave it) */
  snap?(p: Vec2): Vec2 | null;
}

/** A bare point's name when the caller gives none (the pill's 下一站 目的地, BAYBAY's 到啦！这里就是目的地). */
export const POINT_NAME: Bilingual = { zh: '目的地', en: 'the spot' };

/** The synthetic place id of a bare point (TripState.placeId): `pt:<x>,<z>` rounded to 1 u. */
export const pointPlaceId = (p: Vec2) => `pt:${Math.round(p.x)},${Math.round(p.z)}`;

const fromAttraction = (a: NonNullable<ReturnType<GoToLookups['attraction']>>, name?: Bilingual): GoToDest => {
  // an island's trip ends at its pier (lane P's tripDestination: 恶魔岛 → 33 号码头)
  const d = tripDestination(a);
  return { placeId: d.placeId, x: d.x, z: d.z, name: name ?? d.name, attraction: a.id };
};

/**
 * Resolve a goTo target (pure over `lk`): an id first — an attraction (or SF landmark) id, a place-index row (through
 * the attraction that speaks for it, so the arrival moment and the flag agree with the map), the same without a
 * `place:` / `sf:` / `lm-` prefix, an interactable — then the point, snapped to walkable ground. Null: nothing found.
 */
export function resolveGoToTarget(target: GoToTarget, lk: GoToLookups): GoToDest | null {
  const id = target.placeId?.trim();
  if (id) {
    const ids = [id, id.replace(/^(?:place:|sf:)/, ''), id.replace(/^(?:place:|sf:)?lm-/, '')];
    for (const k of [...new Set(ids)]) {
      const a = lk.attraction(k);
      if (a) return fromAttraction(a, target.name);
      const p = lk.place(k);
      if (p) {
        const pa = lk.primary?.(p.id);
        if (pa) return fromAttraction(pa, target.name);
        return { placeId: p.id, x: p.arrival.x, z: p.arrival.z, name: target.name ?? p.name };
      }
    }
    const it = lk.interactable(id);
    if (it && Number.isFinite(it.x) && Number.isFinite(it.z)) {
      return { placeId: it.id.startsWith('place:') ? it.id.slice(6) : it.id, x: it.x, z: it.z, name: target.name ?? it.name };
    }
  }
  const pt = target.point;
  if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.z)) {
    const s = lk.snap?.(pt) ?? pt;
    return { placeId: pointPlaceId(pt), x: s.x, z: s.z, name: target.name ?? POINT_NAME };
  }
  return null;
}

/**
 * The option goTo takes (pure): `prefer: 'fly'` → the pelican when it is offered; `'ground'` → the best way without it
 * (the fastest non-fly, or a goal way within the planner's slack: the pre-unlock 推荐 rule), the pelican only when
 * nothing else reaches; default → the planner's 推荐. Null for an empty list.
 */
export function chooseGoToOption(options: readonly TripOption[], prefer?: GoToOptions['prefer']): TripOption | null {
  if (!options.length) return null;
  const rec = options.find(o => o.recommended) ?? options[0];
  if (prefer === 'fly') return options.find(o => o.mode === 'fly') ?? rec;
  if (prefer === 'ground') {
    const ground = options.filter(o => o.mode !== 'fly');
    if (!ground.length) return rec;
    const fastest = ground.reduce((a, b) => (b.seconds < a.seconds ? b : a));
    const goal = ground.find(o => o.goal);
    return goal && goal !== fastest && goal.seconds <= fastest.seconds * GOAL_SLACK.k + GOAL_SLACK.s ? goal : fastest;
  }
  return rec;
}

/** The frozen TripSource for a goTo caller: the map's big button 'map', the 问 BAYBAY sheet 'call', every row 'card'. */
export function goToSource(source?: string): TripSource {
  if (source === 'map') return 'map';
  if (source === 'ask' || source === 'call' || source?.startsWith('ask:')) return 'call';
  if (source === 'panorama') return 'panorama';
  return 'card';
}

/** A goTo waits this long at most for the walking routes the planner asked for (then starts on the estimates). */
export const ROUTE_WAIT_MS = 900;
/** Closer than this: "就在这里啦" instead of a trip (u). */
export const HERE_SAY_R = 10;

/** The game's lookups (the place index must be in: runGoTo loads it first). */
export function liveLookups(): GoToLookups {
  return {
    attraction: id => ATTRACTION_INDEX.resolve(id),
    primary: id => ATTRACTION_INDEX.primary(id),
    place: id => placeById(id),
    interactable: id => interactableById(id),
    snap: p => (canStand(p.x, p.z) ? p : nearestWalkable(p, 40)),
  };
}

const sleep = (ms: number) => new Promise<void>(res => { setTimeout(res, ms); });

/** Plan from where the player stands, wait a moment for the walking routes, plan again (see ROUTE_WAIT_MS). */
async function planFor(dest: GoToDest, prefer?: GoToOptions['prefer']): Promise<TripOption | null> {
  const plan = () => planTrips({ x: runtime.player.x, z: runtime.player.z }, dest, tripProviders());
  let options = plan();
  let pick = chooseGoToOption(options, prefer);
  if (pick && pick.mode !== 'fly' && options.some(optionPending)) {
    await Promise.race([tripRouteCache().idle(), sleep(ROUTE_WAIT_MS)]);
    options = plan();
    pick = chooseGoToOption(options, prefer);
  }
  return pick;
}

/** game/goTo.ts goTo(): resolve, plan, close the panel, start (the trip runner leads; W5-N3 carries the player). */
export async function runGoTo(target: GoToTarget, opts: GoToOptions = {}): Promise<GoToResult> {
  const s = game.get();
  if (s.worldMode !== 'city') return { ok: false, why: 'district' };
  if (s.phase !== 'playing' || travelActive()) return { ok: false, why: 'busy' };
  // the place index (a place-index id, an attraction's row): at once after the first load
  if (target.placeId) await loadPlaces();
  const dest = resolveGoToTarget(target, liveLookups());
  if (!dest) return { ok: false, why: 'unknown' };
  if (Math.hypot(dest.x - runtime.player.x, dest.z - runtime.player.z) < Math.max(HERE_R, HERE_SAY_R)) {
    // (W8-K3) a fixed line lane X can voice, the place's name on a toast
    bubble(W8K_LINES.goToHere, 2600, BAYBAY_ID, 'call');
    say(`就在这里 · ${dest.name.zh}`, `Right here · ${dest.name.en}`, 'info', 2600);
    return { ok: false, why: 'here' };
  }
  initTripRun();
  const option = await planFor(dest, opts.prefer);
  // (the player may have started a ride, a flight or a dialogue while the routes were found)
  if (game.get().phase !== 'playing' || travelActive()) return { ok: false, why: 'busy' };
  if (!option) {
    bubble({ zh: '这里暂时过不去，换个地方试试？', en: "Can't get there right now — somewhere else?" }, 2800, BAYBAY_ID, 'call');
    return { ok: false, why: 'no-way' };
  }
  closePanel();
  startTrip(option, { placeId: dest.placeId, x: dest.x, z: dest.z, name: dest.name, ...(dest.attraction ? { attraction: dest.attraction } : {}) }, goToSource(opts.source));
  if (import.meta.env?.DEV) console.debug('[opus-bay goTo]', opts.source ?? '-', dest.placeId, option.mode, Math.round(option.seconds));
  return { ok: true, mode: option.mode, seconds: option.seconds, placeId: dest.placeId, name: dest.name };
}
