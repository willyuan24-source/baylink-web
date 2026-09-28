import { driveTo, isRiding } from '../actors/moveApi';
import { game } from '../core/store';
import type { Bilingual } from '../core/types';
import type { CityPlace } from '../data/sf/places';
import type { TripOption } from './tripTypes';
import { closePanel, navigateTo, say, startTrip } from './flow';
import { startTravel } from './fastTravel';
import { interactables } from './interactables';
import { requestHopOff } from './transit';
import { rideableNear } from './travel';

/**
 * The map's actions for a city place (lane G1, G1-6): 飞过去 (fast travel), 带我去 (walk over the graph via
 * navigateTo('place:<id>')), 骑车去 / 开车去 (moveApi.driveTo while riding, else walk to the rideable within 60 u and
 * drive on once mounted).
 */

export function flyTo(p: CityPlace) {
  // off a cable car first (F's immediate hop-off); bikes, the car and the pelican park when move.mode turns 'travel'
  if (game.get().move.mode === 'transit' || game.get().riding) requestHopOff();
  closePanel();
  startTravel({ id: p.id, name: p.name, x: p.arrival.x, z: p.arrival.z, heading: p.arrival.heading });
}

export function takeMeTo(p: CityPlace) { navigateTo(`place:${p.id}`); }

/** Where a map trip goes: lane G's TripDestination + the attraction (lane C's TripDest). */
export interface PlaceTripDest { placeId: string; x: number; z: number; name?: Bilingual; attraction?: string }

/**
 * Start a trip the map picked (跟 BAYBAY 去, a TripOptions row, a station's ride): lane C's trip runner (`flow.startTrip`,
 * the city chunk) takes every mode — BAYBAY leads on foot, rides in the basket, boards the loop / Metro through lane T's
 * pre-filled boarding, or the pelican flies — and sets `flow.trip` (the map's target pin, route and trip strip).
 */
export function startPlaceTrip(o: TripOption, dest: PlaceTripDest) {
  startTrip(o, { placeId: dest.placeId, ...(dest.attraction ? { attraction: dest.attraction } : {}), ...(dest.name ? { name: dest.name } : {}), x: dest.x, z: dest.z }, 'map');
}

/** What 骑车去 / 开车去 can do right now: drive (riding), walk to a rideable nearby, or nothing. */
export function driveOption(): { kind: 'drive' | 'fetch'; vehicle: 'bike' | 'car'; id?: string } | null {
  const mode = game.get().move.mode;
  if ((mode === 'bike' || mode === 'car') && isRiding()) return { kind: 'drive', vehicle: mode };
  const p = game.get().playerPos;
  const near = rideableNear(p, interactables());
  if (!near) return null;
  return { kind: 'fetch', vehicle: /car/.test(near.id) ? 'car' : 'bike', id: near.id };
}

let pending: CityPlace | null = null;
let unsub: (() => void) | null = null;

export function driveThere(p: CityPlace) {
  const opt = driveOption();
  if (!opt) return;
  if (opt.kind === 'drive') {
    closePanel();
    if (!driveTo({ x: p.arrival.x, z: p.arrival.z })) say('这里开不过去，换个地方试试？', "Can't drive there — try another spot?", 'info', 2600);
    return;
  }
  // walk to the rideable; once the player is on it, the autopilot takes over
  pending = p;
  unsub?.();
  unsub = game.subscribe(() => {
    const m = game.get().move.mode;
    if (!pending || (m !== 'bike' && m !== 'car')) return;
    const target = pending;
    pending = null;
    unsub?.(); unsub = null;
    setTimeout(() => { driveTo({ x: target.arrival.x, z: target.arrival.z }); }, 400);
  });
  navigateTo(opt.id!);
  say(opt.vehicle === 'car' ? '先去坐上小车，然后自动开过去～' : '先去骑上单车，然后自动骑过去～', opt.vehicle === 'car' ? 'Hop in the toy car, then it drives you there' : 'Get on the bike, then it rides you there', 'info', 3200);
}
