import type { Bilingual, Vec2 } from '../core/types';
import type { Attraction } from '../data/sf/attractionTypes';
import { ATTRACTION_INDEX, tripDestination } from '../data/sf/attractions';
import type { CityPlace } from '../data/sf/places';
import { transitData } from '../data/transit';
import type { PlaceTripDest } from '../game/placeTrips';
import {
  ALIGHT_S, LEG_MIN, LINE_MODELS, STREET_FACTOR, TRIP_SPEED, type TripLineInfo, type TripLineStop, arcSpan, lineDisplayName, linePathSlice, modelRideSeconds,
  stopsBetween, tripRemainingSeconds, tunnelLength, zhJoin,
} from '../game/tripPlan';
import { cableTripLines, transitTripLine } from '../game/tripProviders';
import { timeLabel } from '../game/tripText';
import { TRIP_MODE_NAMES, type TripLeg, type TripLineLeg, type TripOption, type TripPoint, type TripState } from '../game/tripTypes';
import type { TransitLine } from '../world/sf/format';
import type { MapSel, MapTarget } from './cityMapModel';
import type { MapLine, MapStation } from './mapLines';
import type { StationRide } from './StationActions';

/**
 * Wave 4 · where the map's trips go and what a station offers (lane P, integration): pure helpers shared by
 * PlaceActions (跟 BAYBAY 去 / 其他方式), StationPanel (the rides from a tapped station) and the tests.
 */

/** Where a trip to the selection ends (plan §4.2; the islands end at their piers: attractions.ts tripDestination). */
export function placeTripDest(place: CityPlace, a?: Attraction | null): PlaceTripDest {
  if (a) { const d = tripDestination(a); return { placeId: d.placeId, x: d.x, z: d.z, name: d.name, attraction: a.id }; }
  return { placeId: place.id, x: place.arrival.x, z: place.arrival.z, name: place.name };
}

const nameOf = (s: TripLineStop): Bilingual => s.name ?? { zh: s.id, en: s.id };

/** The planner's view of every line the map draws (the cable cars from the transit data, the wave-4 lines as published). */
export function tripLineInfos(lines: readonly MapLine[]): Map<string, TripLineInfo> {
  const out = new Map<string, TripLineInfo>();
  for (const l of cableTripLines(transitData())) out.set(l.id, l);
  for (const l of lines) if ((l.kind === 'bus' || l.kind === 'light-rail') && (l as Partial<TransitLine>).length) out.set(l.id, transitTripLine(l as unknown as TransitLine));
  return out;
}

/** The rides offered at a station (pure): see the header. Lines the planner does not know (the F-line) offer none. */
export function stationRides(st: Pick<MapStation, 'ids' | 'lines'>, infos: ReadonlyMap<string, TripLineInfo>): StationRide[] {
  const out: StationRide[] = [];
  for (const lineId of st.lines) {
    const L = infos.get(lineId);
    if (!L) continue;
    const i = L.stops.findIndex(s => st.ids.includes(s.id));
    if (i < 0) continue;
    const board = L.stops[i];
    const ride = (alight: TripLineStop, dir: 1 | -1): StationRide => ({
      line: lineId, to: { stop: alight.id, name: nameOf(alight) }, seconds: Math.round(modelRideSeconds(L, board, alight, dir)), stops: stopsBetween(L, board, alight, dir).length + 1, dir,
    });
    if (L.loop) {
      const n = L.stops.length, prev = L.stops[(i - 1 + n) % n];
      out.push({ line: lineId, to: { stop: board.id, name: nameOf(board) }, lap: true, seconds: Math.round(modelRideSeconds(L, board, prev, 1) + modelRideSeconds(L, prev, board, 1)) });
      let added = 0;
      for (let k = 1; k < n && added < 2; k++) { const s = L.stops[(i + k) % n]; if (s.major) { out.push(ride(s, 1)); added++; } }
      continue;
    }
    for (const dir of [1, -1] as const) {
      const ahead = dir > 0 ? L.stops.slice(i + 1) : L.stops.slice(0, i).reverse();
      if (!ahead.length) continue;
      const end = ahead[ahead.length - 1];
      const major = ahead.find(s => s.major && s.id !== end.id);
      if (major && (major.at !== end.at)) out.push(ride(major, dir));
      out.push(ride(end, dir));
    }
  }
  return out;
}

/**
 * The trip for one ride of the station card (integration review): walk to the tapped stop, then that ride. The card
 * asks lane G's planner first; the planner drops a ride that saves nothing over walking straight to where it goes, keeps
 * four rows and boards only within 150 u — then the row the player tapped ("坐 观光巴士 → 渔人码头") only walked them to
 * the stop and forgot the ride. This keeps it: lane C's runner leads to the stop and opens the pre-filled boarding
 * there. The walk is the straight × 1.25 estimate (BAYBAY leads it on the walking graph); `wait` = the system's ETA when
 * it gives one; `rideSeconds` = lane T's own ride time when known. Null for a stop the line does not have, a ride in a
 * direction the line does not run, or a lap. Pure.
 */
export function stationRideOption(from: Vec2, line: TripLineInfo, boardId: string, alightId: string, o: { dir?: 1 | -1; wait?: number | null; rideSeconds?: number | null } = {}): TripOption | null {
  const board = line.stops.find(s => s.id === boardId), alight = line.stops.find(s => s.id === alightId);
  if (!board || !alight || board.id === alight.id) return null;
  const dir: 1 | -1 = line.loop || line.oneWay ? 1 : o.dir ?? (alight.at > board.at ? 1 : -1);
  if (!line.loop && (dir > 0 ? alight.at <= board.at : alight.at >= board.at)) return null;
  const at = (s: TripLineStop): TripPoint => ({ x: s.x, z: s.z, station: s.id, ...(s.name ? { name: s.name } : {}) });
  const boardPt = at(board), alightPt = at(alight);
  const legs: TripLeg[] = [];
  const straight = Math.hypot(board.x - from.x, board.z - from.z);
  if (straight >= LEG_MIN) {
    const length = straight * STREET_FACTOR;
    legs.push({ via: 'walk', from: { x: from.x, z: from.z }, to: boardPt, seconds: length / TRIP_SPEED.walk, length, estimate: true });
  }
  const wait = o.wait !== null && o.wait !== undefined && Number.isFinite(o.wait) && o.wait >= 0 ? o.wait : LINE_MODELS[line.kind].wait;
  const ride = o.rideSeconds && o.rideSeconds > 0 ? o.rideSeconds : modelRideSeconds(line, board, alight, dir);
  const stops = stopsBetween(line, board, alight, dir).length + 1;
  const leg: TripLineLeg = {
    via: 'line', line: line.id, board: board.id, alight: alight.id, wait, stops, dir, from: boardPt, to: alightPt,
    seconds: wait + ride + ALIGHT_S, length: arcSpan(line, board.at, alight.at, dir),
  };
  if (tunnelLength(line, board.at, alight.at, dir) > 0) leg.underground = true;
  const path = linePathSlice(line, board.at, alight.at, dir);
  if (path) leg.path = path;
  const name = lineDisplayName(line), to = alight.name;
  const rideZh = `坐${zhJoin(name.zh)} ${stops} 站`;
  leg.label = to
    ? { zh: `${rideZh}到${to.zh}`, en: `${name.en} ${stops} stop${stops === 1 ? '' : 's'} to ${to.en}` }
    : { zh: rideZh, en: `${name.en} · ${stops} stop${stops === 1 ? '' : 's'}` };
  legs.push(leg);
  return { mode: 'line', legs, seconds: legs.reduce((s, l) => s + l.seconds, 0) };
}

/** "跑过去 约 2 分钟": a running trip's way and the time left (the map's ETA chip, and the selected card during the trip). */
export function tripEta(trip: Pick<TripState, 'legs' | 'leg' | 'option'>): Bilingual {
  const mode = TRIP_MODE_NAMES[trip.option.mode], time = timeLabel(tripRemainingSeconds(trip));
  return { zh: `${mode.zh} ${time.zh}`, en: `${mode.en} ${time.en}` };
}

/**
 * The walk time on the station card's 带我去车站 (integration review: it vanished as soon as the map found the walking
 * route): the route's own time once known, the straight × 1.25 estimate while it is being found, none when there is no
 * walking way there.
 */
export function stationWalkSeconds(walk: { state: 'pending' | 'ok' | 'none' } | null, routeSeconds: number | null, d: number): number | null {
  if (walk?.state === 'none') return null;
  if (walk?.state === 'ok' && routeSeconds !== null && Number.isFinite(routeSeconds)) return routeSeconds;
  return (d * STREET_FACTOR) / TRIP_SPEED.walk;
}

/** Ids other lanes use for a trip or a map opener that are not place rows: an interactable (a Grand Tour stop at a bus stop) or a card id. */
const NOT_A_PLACE = /^(transit-|sf:)/;

/**
 * The map's target for a trip (placeId, attraction): the attraction's badge becomes the pin; a plain place row stays itself
 * (the island piers: the badge stays). A Grand Tour stop's trip names its interactable (`transit-loop-ferry-building`,
 * `sf:<landmark>`) with the stop's attraction: the attraction's badge (integration review: no pin, nothing selected). Pure.
 */
export function mapTargetOf(placeId: string | null, attraction?: string | null): MapTarget | null {
  if (!placeId && !attraction) return null;
  const a = attraction ? ATTRACTION_INDEX.resolve(attraction) : placeId ? ATTRACTION_INDEX.primary(placeId) : undefined;
  if (a && (!placeId || (a.placeId ?? a.id) === placeId || NOT_A_PLACE.test(placeId))) return { attraction: a.id };
  return placeId ? { place: placeId } : null;
}

/**
 * What the map selects for an opener id that is no place row (integration review; lane C's open item: the trip card's
 * 换个方式 on a Grand Tour stop opened the map on the list with nothing selected): the running trip's own id → its
 * attraction; `transit-<stop>` → the station holding that stop; `sf:<id>` or an attraction / landmark id → its badge. Pure.
 */
export function mapOpenFallback(id: string, stations: readonly Pick<MapStation, 'id' | 'ids'>[], trip?: { placeId: string; attraction?: string } | null): MapSel | null {
  if (trip && id === trip.placeId && trip.attraction) { const a = ATTRACTION_INDEX.resolve(trip.attraction); if (a) return { kind: 'attraction', id: a.id }; }
  if (id.startsWith('transit-')) {
    const stop = id.slice(8);
    const st = stations.find(s => s.id === stop || s.ids.includes(stop));
    if (st) return { kind: 'station', id: st.id };
  }
  const a = ATTRACTION_INDEX.resolve(id.startsWith('sf:') ? id.slice(3) : id);
  return a ? { kind: 'attraction', id: a.id } : null;
}
