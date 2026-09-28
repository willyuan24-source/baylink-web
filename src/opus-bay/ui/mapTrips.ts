import type { Bilingual } from '../core/types';
import type { Attraction } from '../data/sf/attractionTypes';
import { tripDestination } from '../data/sf/attractions';
import type { CityPlace } from '../data/sf/places';
import { transitData } from '../data/transit';
import type { PlaceTripDest } from '../game/placeTrips';
import { type TripLineInfo, type TripLineStop, modelRideSeconds, stopsBetween } from '../game/tripPlan';
import { cableTripLines, transitTripLine } from '../game/tripProviders';
import type { TransitLine } from '../world/sf/format';
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
      line: lineId, to: { stop: alight.id, name: nameOf(alight) }, seconds: Math.round(modelRideSeconds(L, board, alight, dir)), stops: stopsBetween(L, board, alight, dir).length + 1,
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

