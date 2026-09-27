import type { Bilingual } from '../core/types';
import { w4StationName } from '../data/sf/stationNames';
import { rideArc, rideSeconds, targetAt, TOUR_GEO, TOUR_MODEL, type CityTourStop, type XZ } from '../data/sf/tours';
import { walkLeg } from './trips';
import type { TripLeg, TripLineLeg, TripOption } from './tripTypes';

/**
 * Wave 4 · lane C · W4-C1 / W4-C4: a Grand Tour stop as a trip option, so the trip pill, the map route and BAYBAY's
 * lead treat tour legs like any trip. LAZY with the tour data (data/sf/tours pulls in the frozen tour lines, ≈ 23 KB
 * gzip): the city tour engine imports this module on demand; game/trips.ts (main graph) never does.
 *
 * Every point carries a name when one is known (lane G's pill reads `leg.to.name`: without it the pill says
 * "下一站 目的地"): stations from lane T's data/sf/stationNames.ts, targets from `nameOf` (the integration passes the
 * interactable's name: interactableById(target)?.name).
 */

export type TargetNamer = (target: string) => Bilingual | null;

/** The cable stations the tour uses that lane T's wave-4 name table does not list (today's California line). */
const CABLE_NAMES: Readonly<Record<string, Bilingual>> = {
  'powell-california': { zh: '加州街 & 鲍威尔街', en: 'California & Powell' },
  'california-drumm': { zh: '加州街 & Drumm 街', en: 'California & Drumm' },
};

export const tourStationName = (id: string): Bilingual | null => w4StationName(id) ?? CABLE_NAMES[id] ?? null;

/**
 * A tour stop as a trip option: a walk, or walk → wait → ride on the stop's line (TOUR_GEO, the tour's timing model).
 * `prev` = where the previous stop ended. Null when the stop's target is unknown.
 */
export function tourStopOption(stop: CityTourStop, prev: XZ, nameOf: TargetNamer = () => null): TripOption | null {
  const end = targetAt(stop.target);
  if (!end) return null;
  const place = stop.target.startsWith('place:') ? stop.target.slice(6) : stop.target.startsWith('sf:') ? stop.target : undefined;
  if (stop.leg.via === 'walk') {
    const station = stop.target.startsWith('transit-') ? stop.target.slice('transit-'.length) : undefined;
    const name = nameOf(stop.target) ?? (station ? tourStationName(station) : null);
    const leg = walkLeg(prev, { ...end, ...(place ? { place } : {}), ...(station ? { station } : {}), ...(name ? { name } : {}) });
    return { mode: 'walk', legs: [leg], seconds: leg.seconds };
  }
  const { line, from, to } = stop.leg;
  const geo = TOUR_GEO[line];
  const board = geo?.stations[from], alight = geo?.stations[to], r = rideArc(line, from, to);
  if (!geo || !board || !alight || !r) return null;
  const fromName = tourStationName(from), toName = tourStationName(to);
  const legs: TripLeg[] = [];
  if (Math.hypot(board.x - prev.x, board.z - prev.z) > 4) legs.push(walkLeg(prev, { x: board.x, z: board.z, station: from, ...(fromName ? { name: fromName } : {}) }));
  const wait = geo.kind === 'bus' ? TOUR_MODEL.bus.wait : geo.kind === 'cable-car' ? TOUR_MODEL.cable.wait : TOUR_MODEL.rail.wait;
  const underground = (geo.tunnels ?? []).some(([a, b]) => Math.min(r.b, b) > Math.max(r.a, a));
  // stops passed after boarding, the alighting one included (TOUR_GEO lists the major stations; lane T's line data
  // gives the full count at integration)
  const stops = Object.entries(geo.stations).filter(([id, s]) => {
    if (id === from) return false;
    if (geo.loop) { const d = ((s.at - board.at) % geo.length + geo.length) % geo.length; return d > 0 && d <= r.arc; }
    return s.at >= r.a && s.at <= r.b;
  }).length;
  const ride: TripLineLeg = {
    via: 'line', line, board: from, alight: to, wait, stops,
    dir: r.dir, ...(underground ? { underground: true } : {}),
    from: { x: board.x, z: board.z, station: from, ...(fromName ? { name: fromName } : {}) },
    to: { x: alight.x, z: alight.z, station: to, ...(toName ? { name: toName } : {}) },
    seconds: wait + rideSeconds(line, from, to), length: r.arc,
  };
  legs.push(ride);
  const seconds = legs.reduce((s, l) => s + l.seconds, 0);
  return { mode: 'line', legs, seconds };
}
