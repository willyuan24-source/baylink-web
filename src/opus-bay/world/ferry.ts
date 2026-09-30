import { definePlatform, platformStop, setPlatformPose } from '../actors/platform';
import { emitAt } from '../audio/cityHooks';
import { emit } from '../core/events';
import { currentRide } from '../game/ride';
import { runtime } from '../core/runtime';
import { DISTRICT } from '../data/district';
import { FERRY, FERRY_ROUTES, GATE_E_HEADING, type FerryLine, buildFerryLine, ferryPoint } from '../data/ferry';
import { activeFerrySystem, pendingFerry, setActiveFerrySystem, setPendingFerry } from '../data/transit';
import type { CarPose, RideStatus, RiderRequest } from './transitLine';
import { spawnFx } from './fx';

/**
 * The rideable ferry (lane F, checkpoint F8), city mode. After the arrival cinematic the arrival ferry (world/life.ts
 * ferry 0, now with an open sun deck in city mode) is handed to this system at Gate E and runs the route table's
 * running route (data/ferry.ts: Ferry Building ⇄ Pier 41) round its loop: 9 u/s cruising, slow ahead into a berth,
 * curves at ≤ 1.6 u/s² sideways, 14 s at each terminal (4 s when a rider waits at the other one), a gentle roll.
 * `FerrySystem` is pure (node tests drive it); `FerryLayer` publishes the platform 'ferry' (spot 'deck': the open sun
 * deck) and the events, and life.ts draws the boat from `activeFerrySystem().cars[0].pose`.
 */

export const FERRY_ID = 'ferry';
/** The boat's origin height (world/life.ts draws its ferries at the water level + 0.55). */
export const FERRY_Y = DISTRICT.waterLevel + 0.55;

export interface FerryBoat {
  index: number;
  u: number;
  v: number;
  mode: 'run' | 'dwell';
  timer: number;
  /** stop index while docked, else −1 */
  at: number;
  rider: boolean;
  pickup: number;
  dropoff: number;
  odometer: number;
  arrivals: number;
  pose: CarPose;
}

export type FerryEventWhat = 'arrive' | 'depart' | 'board';
export interface FerryEvent { what: FerryEventWhat; station: string | null }

export class FerrySystem {
  readonly line: FerryLine;
  readonly cars: FerryBoat[];
  readonly events: FerryEvent[] = [];
  private status: RideStatus | null = null;
  private heading = 0;
  time = 0;

  /** `heading`: the boat's heading at the start (life's ferry 0 lies at Gate E at GATE_E_HEADING when handed over) */
  constructor(line: FerryLine, heading?: number) {
    this.line = line;
    const home = line.stops.findIndex(s => s.terminal === 'ferry-building');
    const at = home >= 0 ? home : 0;
    this.cars = [{ index: 0, u: line.stops[at]?.u ?? 0, v: 0, mode: 'dwell', timer: FERRY.dwell, at, rider: false, pickup: -1, dropoff: -1, odometer: 0, arrivals: 0, pose: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 } }];
    this.heading = heading ?? ferryPoint(line, this.cars[0].u + 1).heading;
    this.updatePose(this.cars[0], 0);
    this.heading = heading ?? this.heading;
    this.cars[0].pose.heading = this.heading;
  }

  get boat(): FerryBoat { return this.cars[0]; }

  private ahead(from: number, to: number) { const L = this.line.length; return (((to - from) % L) + L) % L; }

  /** Rough seconds until the boat stands at stop index `target`. */
  eta(target: number): number {
    const b = this.boat, st = this.line.stops[target];
    if (b.mode === 'dwell' && b.at === target) return 0;
    const d = this.ahead(b.u, st.u);
    const others = this.line.stops.filter((s, i) => i !== target && this.ahead(b.u, s.u) > 0.5 && this.ahead(b.u, s.u) < d).length;
    return (b.mode === 'dwell' ? Math.max(0, b.timer) : 0) + d / (FERRY.speed * 0.8) + others * (FERRY.dwellRider + 8) + 6;
  }

  request(req: RiderRequest): RideStatus | null {
    this.cancel();
    const pickup = this.line.stops.findIndex(s => s.terminal === req.station), dropoff = this.line.stops.findIndex(s => s.terminal === req.to);
    if (pickup < 0 || dropoff < 0 || pickup === dropoff) return null;
    const b = this.boat;
    b.pickup = pickup; b.dropoff = dropoff;
    this.status = { line: FERRY_ID, car: 0, phase: 'coming', eta: this.eta(pickup), station: null, arrivals: 0, lastStation: null, odometer: 0, turning: false, braking: false };
    // docked elsewhere: cast off soon; docked here: board now
    if (b.mode === 'dwell' && b.at !== pickup) b.timer = Math.min(b.timer, FERRY.dwellRider);
    if (b.mode === 'dwell' && b.at === pickup) this.markHere();
    return this.status;
  }

  private markHere() {
    if (!this.status) return;
    this.status.phase = 'here';
    this.status.station = this.line.stops[this.boat.at]?.terminal ?? null;
    this.boat.timer = Math.max(this.boat.timer, 5);
  }

  board() {
    const b = this.boat;
    if (!this.status) return;
    b.rider = true; b.pickup = -1; b.odometer = 0; b.arrivals = 0;
    // the rider walks the gangway and climbs to the sun deck before the boat casts off
    b.timer = Math.max(b.timer, 4);
    this.status.phase = 'riding';
    this.events.push({ what: 'board', station: this.line.stops[b.at]?.terminal ?? null });
  }

  cancel() {
    const b = this.boat;
    b.rider = false; b.pickup = -1; b.dropoff = -1;
    this.status = null;
  }

  rideStatus(): RideStatus | null { return this.status; }
  riderCarOf(line: string): FerryBoat | null { return line === FERRY_ID && this.status ? this.boat : null; }

  step(dt: number) {
    if (dt <= 0) return;
    this.time += dt;
    const b = this.boat, L = this.line;
    if (b.mode === 'dwell') {
      b.v = 0;
      b.timer -= dt;
      const holding = (this.status?.phase === 'here') || (b.rider && platformStop(FERRY_ID) !== null);
      if (b.timer <= 0 && !holding) {
        b.mode = 'run'; b.at = -1;
        b.u = (b.u + 0.05) % L.length;
        this.events.push({ what: 'depart', station: null });
      } else if (b.timer <= 0) b.timer = 0.3;
    } else {
      // next stop and the speed profile ahead (curves, slow ahead into berths)
      let next = -1, dNext = Infinity;
      L.stops.forEach((s, i) => { const d = this.ahead(b.u, s.u); if (d > 0.02 && d < dNext) { dNext = d; next = i; } });
      let limit = Math.sqrt(2 * FERRY.dec * Math.max(0, dNext));
      const reach = (b.v * b.v) / (2 * FERRY.dec) + 6, n = L.vlim.length;
      const i0 = ferryPoint(L, b.u).i;
      limit = Math.min(limit, L.vlim[i0], L.vlim[(i0 + 1) % n]);
      for (let k = 0, i = i0; k < 80; k++, i = (i + 1) % n) {
        const d = this.ahead(b.u, L.cum[i]);
        if (k > 0 && d > reach) break;
        limit = Math.min(limit, Math.sqrt(L.vlim[i] * L.vlim[i] + 2 * FERRY.dec * Math.max(0, d - FERRY.length / 2)));
      }
      b.v = b.v < limit ? Math.min(limit, b.v + FERRY.acc * dt) : Math.max(limit, b.v - FERRY.dec * 1.5 * dt);
      let step = b.v * dt;
      if (step >= dNext) step = dNext;
      b.u = (b.u + step) % L.length;
      if (b.rider) b.odometer += step;
      if (dNext - step < 0.03) this.arrive(next);
    }
    this.updatePose(b, dt);
    const st = this.status;
    if (st) {
      st.odometer = b.odometer;
      st.station = b.mode === 'dwell' ? L.stops[b.at]?.terminal ?? null : null;
      if (st.phase === 'coming' && b.pickup >= 0) st.eta = this.eta(b.pickup);
    }
  }

  private arrive(index: number) {
    const b = this.boat, st = this.line.stops[index];
    b.u = st.u; b.v = 0; b.mode = 'dwell'; b.at = index;
    // a rider waiting at the other terminal: turn round quickly
    const waiting = this.status?.phase === 'coming' && b.pickup >= 0 && b.pickup !== index;
    b.timer = waiting ? FERRY.dwellRider : FERRY.dwell;
    if (b.rider) b.arrivals++;
    this.events.push({ what: 'arrive', station: st.terminal });
    const status = this.status;
    if (!status) return;
    if (!b.rider && b.pickup === index) this.markHere();
    if (b.rider) {
      status.lastStation = st.terminal;
      status.arrivals = b.arrivals;
      if (b.dropoff === index) { status.phase = 'arrived'; b.timer = Math.max(b.timer, 4); }
    }
  }

  /** Pose: on the loop, the heading eased (a boat does not snap round), a gentle roll and bob. */
  private updatePose(b: FerryBoat, dt: number) {
    const p = ferryPoint(this.line, b.u), q = ferryPoint(this.line, b.u + 2.5);
    const want = Math.atan2(q.x - p.x, q.z - p.z);
    const dh = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
    this.heading = dt > 0 ? this.heading + dh * (1 - Math.exp(-dt * 3)) : want;
    const pose = b.pose, t = this.time;
    pose.x = p.x; pose.z = p.z;
    pose.y = FERRY_Y + Math.sin(t * 1.1) * FERRY.bob;
    pose.heading = this.heading;
    pose.pitch = Math.sin(t * 0.9) * 0.008;
    pose.roll = Math.sin(t * FERRY.rollRate) * FERRY.roll + Math.max(-0.03, Math.min(0.03, -dh * 0.4));
  }
}

/** The ferry's deck plan: the open sun deck on the main cabin roof (world/life.ts ferryGeometry(…, true)). */
export const FERRY_PLATFORM = {
  floor: FERRY.deckY,
  deck: { minX: -1.55, maxX: 1.55, minZ: -4.2, maxZ: 0.6 },
  rail: { x: 0, z: 0.35, heading: 0 },
  seatLeft: { x: 1.1, z: -2.2, heading: Math.PI / 2 },
  seatRight: { x: -1.1, z: -2.2, heading: -Math.PI / 2 },
  seatY: 0.45,
  kind: 'ferry' as const,
  decks: [{ minX: -1.55, maxX: 1.55, minZ: -4.2, maxZ: 0.6 }],
};

const HEAR = 90;
/** the wake's foam: a hand above the boat's own waterline (its pose y; the bay's surface there is ≈ 0, not the district's
 * −0.6 datum, under which the foam hid) and how near the player must be (u) */
const WAKE_LIFT = 0.06, WAKE_NEAR = 160;

/** City mode: the ferry system, its platform and events (life.ts draws the boat from the system's pose). */
export class FerryLayer {
  readonly sys: FerrySystem;
  private handedOver = false;
  /** wave 7 (lane V, W7-V2): seconds to the next foam puff of the wake */
  private wakeIn = 0;

  constructor() {
    const def = FERRY_ROUTES.find(r => r.running)!;
    this.sys = new FerrySystem(buildFerryLine(def), GATE_E_HEADING);
    definePlatform(FERRY_ID, FERRY_PLATFORM);
    setPendingFerry(this);
  }

  /** life.ts hands ferry 0 over once it lies at Gate E after the arrival (the ride system then runs it). */
  takeOver() {
    if (this.handedOver) return;
    this.handedOver = true;
    if (pendingFerry() === this) setPendingFerry(null);
    setActiveFerrySystem(this.sys);
  }

  get live(): boolean { return this.handedOver; }

  update(dt: number) {
    if (!this.handedOver) return;
    const sys = this.sys;
    // a ride the game ended some other way (a trip, a reset): the boat forgets its rider
    if (sys.rideStatus() && currentRide()?.line !== FERRY_ID) sys.cancel();
    sys.step(dt);
    const b = sys.boat, p = runtime.player;
    setPlatformPose(FERRY_ID, b.pose, dt);
    const d = Math.hypot(b.pose.x - p.x, b.pose.z - p.z), mine = b.rider;
    // wave 7 (lane V, W7-V2): foam in the wake and a little spray at the bow while the boat makes way (the shared fx
    // pool: no draw of its own; only while the player is near enough to see it)
    if (b.v > 1.2 && d < WAKE_NEAR && (this.wakeIn -= dt) <= 0) {
      this.wakeIn = 0.14;
      const fx = Math.sin(b.pose.heading), fz = Math.cos(b.pose.heading), half = FERRY.length / 2;
      const wy = b.pose.y + WAKE_LIFT;
      spawnFx('wake', b.pose.x - fx * half, wy, b.pose.z - fz * half, { scale: Math.min(1.2, 0.5 + b.v * 0.08) });
      if (Math.random() < 0.3) spawnFx('splash', b.pose.x + fx * (half - 0.6), wy, b.pose.z + fz * (half - 0.6), { scale: 0.45, count: 3 });
    }
    for (const e of sys.events) {
      const base = { type: 'transit' as const, line: FERRY_ID, kind: 'ferry' as const };
      // the horn on leaving (the ferry's own: audio F10), from out on the water when you are not aboard
      if (e.what === 'depart' && (mine || d < HEAR)) {
        const horn = { ...base, what: 'horn' as const, strength: mine ? 1 : Math.max(0.3, 1 - d / HEAR) };
        if (mine) emit(horn); else emitAt(horn, b.pose.x, b.pose.z);
      }
      if (e.what === 'depart' && mine) emit({ ...base, what: 'depart' });
      if (e.what === 'arrive' && mine) emit({ ...base, what: 'arrive' });
      if (e.what === 'board') emit({ ...base, what: 'board' });
    }
    sys.events.length = 0;
  }

  dispose() {
    if (activeFerrySystem() === this.sys) setActiveFerrySystem(null);
    if (pendingFerry() === this) setPendingFerry(null);
  }
}
