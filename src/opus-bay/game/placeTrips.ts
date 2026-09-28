import { driveTo, isRiding } from '../actors/moveApi';
import { game } from '../core/store';
import type { Bilingual } from '../core/types';
import type { CityPlace } from '../data/sf/places';
import type { TripOption } from './tripTypes';
import { closePanel, navigateTo, say } from './flow';
import { startTravel } from './fastTravel';
import { interactableById, interactables } from './interactables';
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
 * Start a trip the map picked (跟 BAYBAY 去, a TripOptions row): lane C's trip runner takes every option at the
 * integration (`flow.startTrip`); until it is wired each mode runs through the wave-3 actions — 步行 / 跑过去: 带我去 (the
 * auto-walk eases into a run), 骑车 / 开车: the autopilot, 飞过去: the pelican, 坐车: 带我去 the boarding stop.
 */
export function startPlaceTrip(o: TripOption, dest: PlaceTripDest, place: CityPlace) {
  if (o.mode === 'fly') { flyTo(place); return; }
  if (o.mode === 'bike' || o.mode === 'car') { if (driveOption()) { driveThere(place); return; } }
  if (o.mode === 'line') {
    const st = o.legs.find(l => l.via === 'line')?.from.station;
    const at = st ? interactableById(`place:${st}`) ?? interactableById(`transit-${st}`) : undefined;
    if (at) { navigateTo(at.id); return; }
  }
  navigateTo(`place:${dest.placeId}`);
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
