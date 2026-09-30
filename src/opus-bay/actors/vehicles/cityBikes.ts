import { groundPending } from '../../core/terrain';
import { CITY_BENCHES, CITY_BIKE_SPOTS, type CityBikeSpot } from '../../data/sf/rideSpots';
import type { SeatSpot, VehicleSpot } from '../../data/vehicles';
import { invalidateInteractables, registerInteractables, type Interactable } from '../../game/interactables';
import { setTransitAside } from '../guide';
import type { Fleet, Ride } from './fleet';
import { clearTransitPaths, guideAside } from './transitClear';

/**
 * City bike racks and benches (lane E2, wave 3, E2-12). Loaded by actors/moveSystem.ts with a dynamic import in city
 * mode only (the generated spot table stays out of GameRoot).
 *
 * - Bikes: the city has a toy bike beside every rack of data/sf/rideSpots.ts (generated and pose-checked offline by
 *   scripts/opus-sf/ride-spots.ts), but only POOL_SIZE bikes exist: the pool parks them at the racks nearest the player
 *   (within PARK_R) and recycles a bike to a new rack once both it and its rack are beyond RECYCLE_R and it is out of
 *   view (never one being ridden or called). A pooled bike takes its rack's id (`city-bike-<n>`), so the interactables,
 *   the rideables list (keyed by id) and save v2 name the rack.
 * - Benches: every drawn city bench is a seat (`seat:city-bench-<n>`), merged into the movement system's seats.
 * Both are offered through one interactables source ('e2-city-rides'), rebuilt when the pool moves a bike.
 */

export const POOL_SIZE = 4;
export const PARK_R = 120;
export const RECYCLE_R = 160;

const NAME = { zh: '小单车', en: 'Toy bike' };

export function bikeSpot(s: CityBikeSpot): VehicleSpot {
  return { id: s.id, kind: 'bike', x: s.x, z: s.z, heading: s.heading, rack: true, livery: s.livery, name: NAME };
}

/** The city benches as seats (seat top 0.46 u, facing the bench's rotation). */
export function cityBenchSeats(): SeatSpot[] {
  return CITY_BENCHES.map(b => ({ id: b.id, x: b.x, z: b.z, heading: b.heading, y: b.y, kind: 'bench' as const }));
}

export class CityBikePool {
  /** the pooled rides (built on first need, at most POOL_SIZE) */
  readonly rides: Ride[] = [];
  private readonly fleet: Fleet;
  private readonly spots = CITY_BIKE_SPOTS.map(bikeSpot);
  private checkIn = 0;
  private unregister: (() => void) | null = null;
  /** reassignments so far (QA / tests) */
  moves = 0;

  constructor(fleet: Fleet) { this.fleet = fleet; }

  /** Offer the benches and the pooled bikes as interactables (the same shapes game/interactables.ts builds). */
  register() {
    this.unregister ??= registerInteractables('e2-city-rides', () => this.interactables());
    // (W7-K2) city mode: BAYBAY steps off the rails for the transit (actors/guide.ts). W7-K-review: set here, not at the
    // module's import — dispose() clears it, and a second pool (the game left and entered again in one page) found the
    // module cached: BAYBAY never stepped aside again
    setTransitAside(guideAside);
  }

  interactables(): Interactable[] {
    const out: Interactable[] = [];
    for (const r of this.rides) {
      out.push({ id: `ride:${r.id}`, source: 'vehicle', action: 'info', name: NAME, x: r.sim.x, z: r.sim.z, radius: 2.2, verb: { zh: '骑上单车', en: 'Ride the bike' } });
    }
    for (const s of CITY_BENCHES) {
      out.push({ id: s.id, source: 'seat', action: 'info', name: { zh: '长椅', en: 'Bench' }, verb: { zh: '坐一会儿', en: 'Sit for a while' }, x: s.x + Math.sin(s.heading) * 0.9, z: s.z + Math.cos(s.heading) * 0.9, radius: 1.5 });
    }
    return out;
  }

  /**
   * Park / recycle (every 0.5 s). `seen(r)`: the ride is in view. Returns true when a bike moved to another rack (its
   * id changed: the caller republishes the rideables).
   */
  update(dt: number, player: { x: number; z: number }, seen: (r: Ride) => boolean): boolean {
    // (W7-K2) the transit never drives through a parked, empty ride: it is towed to the kerb (actors/vehicles/transitClear)
    const towed = clearTransitPaths(this.fleet, dt);
    if (towed) invalidateInteractables();
    this.checkIn -= dt;
    if (this.checkIn > 0) return towed;
    this.checkIn = 0.5;
    const d = (a: { x: number; z: number }) => Math.hypot(a.x - player.x, a.z - player.z);
    const want = this.spots.filter(s => d(s) < PARK_R).sort((a, b) => d(a) - d(b)).slice(0, POOL_SIZE);
    // (a rack whose ground is still streaming in waits: the bike would stand on the far DEM's rough height)
    const missing = want.filter(s => !this.rides.some(r => r.id === s.id) && !groundPending(s.x, s.z, 1.5));
    if (!missing.length) return towed;
    let moved = false;
    for (const spot of missing) {
      const free = this.rides.find(r => !r.occupied && !r.call && !want.some(w => w.id === r.id) && d(r.spot) > RECYCLE_R && d(r.sim) > RECYCLE_R && !seen(r));
      if (free) { this.fleet.reassign(free, spot); this.moves++; moved = true; }
      else if (this.rides.length < POOL_SIZE) { this.rides.push(this.fleet.add(spot)); moved = true; }
    }
    if (moved) invalidateInteractables();
    return moved || towed;
  }

  /** Save v2: put a pooled bike at the rack a save names (so the restore can move it on). Null: no such rack / none free. */
  claim(id: string, seen: (r: Ride) => boolean, player: { x: number; z: number }): Ride | null {
    const spot = this.spots.find(s => s.id === id);
    if (!spot) return null;
    const have = this.rides.find(r => r.id === id);
    if (have) return have;
    const free = this.rides.find(r => !r.occupied && !r.call && !seen(r) && Math.hypot(r.sim.x - player.x, r.sim.z - player.z) > 20);
    const ride = free ?? (this.rides.length < POOL_SIZE ? this.fleet.add(spot) : null);
    if (!ride) return null;
    if (free) this.fleet.reassign(free, spot); else this.rides.push(ride);
    invalidateInteractables();
    return ride;
  }

  dispose() { this.unregister?.(); this.unregister = null; setTransitAside(null); }
}
