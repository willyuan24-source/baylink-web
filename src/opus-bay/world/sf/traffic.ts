import * as THREE from 'three';
import type { Obstacle } from '../../actors/controller';
import type { Quality } from '../../core/store';
import { BOX, Batch, CYL, M } from '../builder';
import { TOY_INST_TINT } from '../materials';
import { EK, type RoadVehicle, type StreetEdge, type StreetNet, lifeRng } from './streetNet';
import { obstaclePool, setVehicle, vehiclePool } from './recordPool';

/**
 * Toy traffic (lane F, checkpoint F12): up to 24 little instanced cars on the streets around the player, city mode only
 * (hosted by world/sf/cityLife.ts inside the lazy transit chunk).
 *
 * - **Lanes.** Cars drive on the right, on the walking graph's street edges (world/sf/streetNet.ts), in the middle of
 *   the right half of the roadway the terrain measures (0.62 … 1.6 u off the centre line). Streets narrower than
 *   1.8 u of roadway, raised decks, hero-slab streets and the streets the cable cars and the F-line run along are left
 *   to them (Market St is car-free anyway). 5–9 u/s, ≤ 3.4 u/s through a real turn.
 * - **Queues.** A car keeps 4 u centre to centre behind the car ahead (anything in its corridor within 14 u), and stops
 *   short (1.3 u) of a person, the player (on foot or driving) and any other road vehicle (cable cars, the F-line,
 *   buses: streetNet `registerRoadVehicles`).
 * - **Junctions.** A junction takes one car at a time. A car waits at its stop line while another car is in the box, a
 *   walker is crossing there, a transit vehicle or the player is in the box or will be within 2 s, or its exit lane has
 *   no room. The turn is a smooth curve from its lane to the next; straight on is likelier than a turn; a dead end is a
 *   U-turn.
 * - **Never in a bus's way** (W5-T2, plan MF2: the loop bus stood 38 s behind a toy car at a stop line on Mason St and on
 *   Lincoln Blvd, each waiting for the other): a car at its stop line never waits for a road vehicle queued behind it in
 *   its own lane (that one waits for the car), never turns into a lane a transit vehicle's body stands in, drives at the
 *   bus's pace with one close behind it (TRAFFIC.hurry), and a car that still holds a transit vehicle up behind it for
 *   TRAFFIC.giveWay s — or finds itself inside one's body — shrinks away (a toy pop, recycled) — even in view.
 * - **Around the player only.** Cars live within 220 u of the focus (TRAFFIC.radius); a car left behind, lost with its
 *   ground, or stuck for 14 s out of view (40 s in view) is recycled to a spot out of view or far away, and fades in.
 * - **Drawn** as two InstancedMeshes on TOY_INST_TINT (the paint is the instance colour): the near car (≈ 300 triangles,
 *   with shadow) within 55 u of the camera, a ≈ 50-triangle box car beyond. With the transit layer this stays inside
 *   the checkpoint's ≤ 8 calls / 20k triangles for vehicles and transit in ordinary views.
 */

export const TRAFFIC = {
  count: { high: 24, mid: 16, low: 8 } as Record<Quality, number>,
  radius: 220,
  /** recycled cars come back at least this far away (u; out of view), and this far when the spot is in view */
  spawnMin: 45,
  spawnInView: 165,
  /** an unseen car farther than this is brought back nearer, one a second (u) */
  thinBeyond: 130,
  speed: [5, 9] as const,
  turnSpeed: 3.4,
  accel: 2.6,
  brake: 5.5,
  /** centre-to-centre gap in a queue (u) */
  gap: 4,
  /** stop this far short of a person or another vehicle's body (u) */
  clear: 1.3,
  length: 2.1,
  width: 1.08,
  /** the narrowest half roadway a car takes (u) */
  minHalf: 0.9,
  /** near cars within this of the camera (u) */
  nearLod: 55,
  /** stuck this long out of view → recycled (s); in view 40 s */
  stuck: 14,
  /** night keeps this share */
  night: 0.7,
  /** (W5-T2) a stopped car holding a transit vehicle up right behind it for this long (s) shrinks away */
  giveWay: 5,
  /** (W5-T2) with a transit vehicle close behind (≤ 12 u), a car drives at up to this speed (the bus's pace, u/s) */
  hurry: 11.5,
} as const;

const TAU = Math.PI * 2;
const HALF_L = TRAFFIC.length / 2;
const HALF_W = TRAFFIC.width / 2;
/** a turn sharper than this (rad) is taken at TRAFFIC.turnSpeed */
const SHARP = 0.45;
const JUMP = 90;
/** a transit vehicle in the junction box now or at these times ahead (s) keeps a car at its stop line */
const LOOK_AHEAD = [0, 0.7, 1.4, 2] as const;
/** junction nodes closer than this (u) along an edge are one junction box */
const BOX_JOIN = 6;

export interface Car {
  id: number;
  on: boolean;
  mode: 'lane' | 'turn';
  e: number;
  s: number;
  v: number;
  vmax: number;
  color: number;
  /** the chosen next edge (−1 = not yet) */
  next: number;
  /** junction node held while in the box (−1 none) */
  node: number;
  /** turn curve P0 → C → P1 (quadratic), its length and the distance travelled on it */
  p0x: number; p0z: number; cx: number; cz: number; p1x: number; p1z: number;
  tl: number; tt: number;
  x: number; y: number; z: number;
  heading: number;
  pitch: number;
  /** seconds without moving */
  still: number;
  grow: number;
  /** for the pass-by sound: last distance to the listener and whether it was closing */
  lastD: number;
  closing: boolean;
  /** (W5-T2) seconds this car has stood with a transit vehicle queued right behind it; leaving: shrinking away */
  holdUp: number;
  leaving: boolean;
  /** (W5-T2) a transit vehicle is close behind it in its lane (last frame): it drives at the bus's pace */
  hurry: boolean;
}

export interface TrafficEnv {
  focus(): { x: number; z: number };
  visible(x: number, z: number): boolean;
  /** other road vehicles (transit, the player's bike / car, buses): never the traffic itself */
  vehicles(): readonly RoadVehicle[];
  /** people on the roadway the cars must not touch: the player on foot, BAYBAY, walkers crossing */
  people(out: { x: number; z: number; r: number }[]): void;
  /** does the street under this edge carry a transit line (cars keep off it) */
  transitStreet?(x: number, z: number, dx: number, dz: number): boolean;
  night?(): number;
}

/** A car that passed close by the listener this frame (the host turns it into a pass-by sound). */
export interface CarPass { x: number; z: number; heading: number; v: number; d: number }

const newCar = (id: number): Car => ({
  id, on: false, mode: 'lane', e: -1, s: 0, v: 0, vmax: 7, color: 0, next: -1, node: -1,
  p0x: 0, p0z: 0, cx: 0, cz: 0, p1x: 0, p1z: 0, tl: 0, tt: 0, x: 0, y: 0, z: 0, heading: 0, pitch: 0, still: 0, grow: 1, lastD: Infinity, closing: false,
  holdUp: 0, leaving: false, hurry: false,
});

const _p = { x: 0, z: 0 };
const _people: { x: number; z: number; r: number }[] = [];

export class TrafficSim {
  readonly net: StreetNet;
  readonly env: TrafficEnv;
  readonly cars: Car[] = [];
  target: number;
  radius: number = TRAFFIC.radius;
  /** cars that passed the listener since the host last drained them */
  readonly passes: CarPass[] = [];
  readonly stats = { spawned: 0, recycled: 0, stuck: 0, turns: 0, waits: 0, overlaps: 0, gaveWay: 0 };
  private rng: () => number;
  private held = new Map<number, number>();
  private boxes = new Map<number, number>();
  private fx = NaN;
  private fz = NaN;
  private filling = true;
  /** frames the refill burst may last */
  private fillLeft = 20;
  private frame = 0;
  private okCache = new Map<number, boolean>();

  constructor(net: StreetNet, env: TrafficEnv, o: { max?: number; target?: number; seed?: number } = {}) {
    this.net = net;
    this.env = env;
    const max = o.max ?? TRAFFIC.count.high;
    for (let i = 0; i < max; i++) this.cars.push(newCar(i));
    this.target = Math.min(max, o.target ?? max);
    this.rng = lifeRng(o.seed ?? 0xcab);
  }

  get active(): number { let n = 0; for (const c of this.cars) if (c.on) n++; return n; }

  reset() {
    for (const c of this.cars) this.off(c);
    this.filling = true;
    this.fillLeft = 20;
  }

  private off(c: Car) {
    if (c.node >= 0 && this.held.get(c.node) === c.id) this.held.delete(c.node);
    c.node = -1;
    c.on = false;
  }

  // --- the network for cars ------------------------------------------------------------------------------------------

  /** A street edge cars may drive (right-hand lane measurable, not raised, not hero, no transit line along it). */
  usable(e: number): StreetEdge | null {
    const net = this.net;
    if (net.kind(e) !== EK.street) return null;
    const s = net.edge(e);
    if (!s || !s.road || s.raised || net.isHero(s.u) || net.isHero(s.v)) return null;
    if (s.curbL < TRAFFIC.minHalf || s.curbR < TRAFFIC.minHalf) return null;
    let ok = this.okCache.get(e);
    if (ok === undefined) {
      const mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2;
      ok = !this.env.transitStreet?.(mx, mz, s.dx, s.dz);
      if (this.okCache.size > 20_000) this.okCache.clear();
      this.okCache.set(e, ok);
    }
    return ok ? s : null;
  }

  /** Lateral offset of the right-hand lane (to the right of travel). */
  lane(s: StreetEdge): number { return Math.min(1.6, Math.max(0.62, s.curbR * 0.5)); }

  /** The drivable stretch of an edge (car centres): the nose stops at the line, 0.4 u short of the crossing sidewalk. */
  span(s: StreetEdge): [number, number] {
    const a = this.net.degree(s.u) >= 3 ? this.net.setback(s.u, s.dx, s.dz) + 0.4 + HALF_L : 0;
    const b = this.net.degree(s.v) >= 3 ? this.net.setback(s.v, s.dx, s.dz) + 0.4 + HALF_L : 0;
    if (a + b >= s.len - 0.2) { const m = s.len / 2; return [m, m]; }
    return [a, s.len - b];
  }

  lanePoint(s: StreetEdge, along: number, out: { x: number; z: number }) { return this.net.at(s, along, -this.lane(s), out); }

  // --- stepping -------------------------------------------------------------------------------------------------------

  step(dt: number) {
    this.frame++;
    const f = this.env.focus();
    if (!Number.isFinite(this.fx) || Math.hypot(f.x - this.fx, f.z - this.fz) > JUMP) this.reset();
    this.fx = f.x; this.fz = f.z;
    const night = this.env.night?.() ?? 0;
    const want = Math.round(this.target * (1 - (1 - TRAFFIC.night) * night));
    let on = 0;
    let thin: Car | null = null;
    if (this.frame % 30 === 0) {
      let bd: number = TRAFFIC.thinBeyond;
      for (const c of this.cars) {
        if (!c.on || c.node >= 0) continue;
        const d = Math.hypot(c.x - f.x, c.z - f.z);
        if (d > bd && !this.env.visible(c.x, c.z)) { bd = d; thin = c; }
      }
    }
    for (const c of this.cars) {
      if (!c.on) continue;
      if (c === thin) { this.off(c); this.stats.recycled++; continue; }
      const far = Math.hypot(c.x - f.x, c.z - f.z) > this.radius + 20;
      const lost = !this.net.edge(c.e) || (c.mode === 'turn' && c.next >= 0 && !this.net.edge(c.next));
      const seen = this.env.visible(c.x, c.z);
      const stuck = c.still > (seen ? 40 : TRAFFIC.stuck);
      const extra = on >= want && !seen;
      // (W5-T2) shrunk away after holding a bus up
      const gone = c.leaving && c.grow <= 0;
      if (far || lost || stuck || extra || gone) { if (stuck) this.stats.stuck++; this.off(c); this.stats.recycled++; continue; }
      on++;
    }
    let budget = this.filling ? 8 : 2;
    for (const c of this.cars) {
      if (on >= want || budget <= 0) break;
      if (c.on) continue;
      budget--;
      if (this.spawn(c, this.filling)) on++;
    }
    if (on >= want || --this.fillLeft <= 0) this.filling = false;

    _people.length = 0;
    this.env.people(_people);
    const vehicles = this.env.vehicles();
    for (const c of this.cars) if (c.on) { this.drive(c, dt, vehicles); this.watchHoldUp(c, dt, vehicles); }
    for (const c of this.cars) if (c.on) this.pose(c, dt, f);
  }

  private spawn(c: Car, anywhere: boolean): boolean {
    const r = this.rng, R = this.radius, net = this.net;
    for (let tries = 0; tries < 8; tries++) {
      const a = r() * TAU;
      // more of them near the player (half within ~75 u)
      const d = anywhere ? 18 + (R - 18) * Math.pow(r(), 1.6) : TRAFFIC.spawnMin + (R - TRAFFIC.spawnMin) * Math.pow(r(), 1.4);
      const node = net.ix.nearestNode(this.fx + Math.cos(a) * d, this.fz + Math.sin(a) * d, 30, n => !net.ix.isHero(n));
      if (node < 0) continue;
      const deg = net.degree(node);
      if (!deg) continue;
      const e = net.outStart(node) + Math.floor(r() * deg);
      const s = this.usable(e);
      if (!s) continue;
      const [a0, a1] = this.span(s);
      if (a1 - a0 < 1) continue;
      const along = a0 + r() * (a1 - a0);
      this.lanePoint(s, along, _p);
      const dd = Math.hypot(_p.x - this.fx, _p.z - this.fz);
      if (dd > R) continue;
      const seen = this.env.visible(_p.x, _p.z);
      if (!anywhere && seen && dd < TRAFFIC.spawnInView) continue;
      if (this.cars.some(o => o.on && Math.hypot(o.x - _p.x, o.z - _p.z) < 7)) continue;
      c.on = true; c.mode = 'lane'; c.e = e; c.s = along; c.next = -1; c.node = -1;
      c.vmax = TRAFFIC.speed[0] + r() * (TRAFFIC.speed[1] - TRAFFIC.speed[0]);
      c.v = c.vmax * 0.6;
      c.color = Math.floor(r() * 1e6);
      c.x = _p.x; c.z = _p.z; c.heading = Math.atan2(s.dx, s.dz);
      c.y = net.probe.height(c.x, c.z); c.pitch = 0;
      c.still = 0; c.grow = seen && !anywhere ? 0 : 1; c.lastD = Infinity; c.closing = false;
      c.holdUp = 0; c.leaving = false; c.hurry = false;
      this.stats.spawned++;
      return true;
    }
    return false;
  }

  /**
   * The junction box a node belongs to: OSM draws a wide intersection as a small cluster of junction nodes joined by
   * short edges; the whole cluster is one box (keyed by its lowest node id), so two cars never turn across it at once.
   */
  boxOf(node: number): number {
    const hit = this.boxes.get(node);
    if (hit !== undefined) return hit;
    const net = this.net, members = [node], seen = new Set([node]);
    for (let i = 0; i < members.length && members.length < 12; i++) {
      const u = members[i];
      for (let f = net.outStart(u); f < net.outEnd(u); f++) {
        const v = net.target(f);
        if (seen.has(v) || net.degree(v) < 3) continue;
        if (Math.hypot(net.ix.x(v) - net.ix.x(u), net.ix.z(v) - net.ix.z(u)) > BOX_JOIN) continue;
        seen.add(v); members.push(v);
      }
    }
    const key = Math.min(...members);
    if (this.boxes.size > 20_000) this.boxes.clear();
    for (const m of members) this.boxes.set(m, key);
    return key;
  }

  /** Choose where to go at the end of this edge: straight on is likelier; a dead end turns round. */
  private chooseNext(s: StreetEdge): number {
    const net = this.net, r = this.rng;
    let best = -1, bestW = 0;
    for (let f = net.outStart(s.v); f < net.outEnd(s.v); f++) {
      if (f === s.twin) continue;
      const g = this.usable(f);
      if (!g) continue;
      const straight = g.dx * s.dx + g.dz * s.dz;
      const w = (straight > 0.85 ? 3 : straight > -0.2 ? 1.1 : 0.4) * (0.6 + r());
      if (w > bestW) { bestW = w; best = f; }
    }
    if (best < 0 && s.twin >= 0 && this.usable(s.twin)) best = s.twin;
    return best;
  }

  /** Clear to enter the junction at `node` toward `next`? */
  private canEnter(c: Car, node: number, next: StreetEdge, vehicles: readonly RoadVehicle[]): boolean {
    const net = this.net;
    if (net.degree(node) >= 3) {
      const h = this.held.get(this.boxOf(node));
      if (h !== undefined && h !== c.id) return false;
      const nx = net.ix.x(node), nz = net.ix.z(node), R = net.setback(node) + 1.6;
      for (const p of _people) if (Math.hypot(p.x - nx, p.z - nz) < R + p.r) return false;
      for (const q of vehicles) {
        // (W5-T2) one queued behind this car in its lane waits for it: waiting for it in turn locked both for good
        if (queuedBehind(c, q)) continue;
        const fx = Math.sin(q.heading), fz = Math.cos(q.heading);
        // in the box now, or within 2 s
        for (let i = 0; i < LOOK_AHEAD.length; i++) {
          const t = LOOK_AHEAD[i], qx = q.x + fx * q.v * t, qz = q.z + fz * q.v * t;
          if (Math.hypot(qx - nx, qz - nz) < R + q.halfL) return false;
        }
      }
    }
    // room on the exit lane
    const [a0] = this.span(next);
    for (const o of this.cars) {
      if (!o.on || o === c) continue;
      if (o.e === next.e && o.mode === 'lane' && o.s < a0 + TRAFFIC.gap) return false;
      if (o.mode === 'turn' && o.next === next.e) return false;
    }
    // (W5-T2) nor a transit vehicle's body over the exit lane's first few units (a car turned into a bus standing at its
    // stop, right inside it, and the bus waited for the car inside it)
    for (let k = 0; k < 3; k++) {
      this.lanePoint(next, a0 + k * 2, _p);
      for (const q of vehicles) if (q.kind !== 'traffic' && bodyDistance(q, _p.x, _p.z) < q.halfW + HALF_W + 0.4) return false;
    }
    return true;
  }

  private drive(c: Car, dt: number, vehicles: readonly RoadVehicle[]) {
    const s = this.net.edge(c.e);
    if (!s) return;
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    // --- what is ahead in the corridor
    let gapCar = Infinity, gapObs = Infinity;
    for (const o of this.cars) {
      if (!o.on || o === c) continue;
      const rx = o.x - c.x, rz = o.z - c.z;
      if (rx * rx + rz * rz > 196) continue;
      const along = rx * fx + rz * fz, lat = Math.abs(rx * fz - rz * fx);
      if (along > 0.3 && lat < TRAFFIC.width + 0.1) gapCar = Math.min(gapCar, along);
      else if (along > -HALF_L && along < TRAFFIC.length && lat < TRAFFIC.width * 0.9) this.stats.overlaps++;
    }
    for (const q of vehicles) {
      const qf = Math.sin(q.heading), qz = Math.cos(q.heading);
      for (let k = -1; k <= 1; k++) {
        const px = q.x + qf * q.halfL * k, pz = q.z + qz * q.halfL * k;
        const rx = px - c.x, rz = pz - c.z;
        if (rx * rx + rz * rz > 256) continue;
        const along = rx * fx + rz * fz, lat = Math.abs(rx * fz - rz * fx);
        if (along > 0 && lat < q.halfW + HALF_W + 0.2) gapObs = Math.min(gapObs, along - HALF_L);
      }
    }
    for (const p of _people) {
      const rx = p.x - c.x, rz = p.z - c.z;
      if (rx * rx + rz * rz > 196) continue;
      const along = rx * fx + rz * fz, lat = Math.abs(rx * fz - rz * fx);
      if (along > 0 && lat < p.r + HALF_W + 0.25) gapObs = Math.min(gapObs, along - HALF_L - p.r);
    }
    const B = TRAFFIC.brake;
    // (W5-T2) a bus close behind: keep its pace (a toy car at 5 u/s held the loop bus to half its speed down Marina Blvd)
    const vmax = c.hurry ? Math.max(c.vmax, TRAFFIC.hurry) : c.vmax;
    let target = Math.min(vmax, Math.sqrt(2 * B * Math.max(0, gapCar - TRAFFIC.gap)), Math.sqrt(2 * B * Math.max(0, gapObs - TRAFFIC.clear)));

    if (c.mode === 'lane') {
      const [, end] = this.span(s);
      const toEnd = end - c.s;
      if (c.next < 0 && toEnd < 18) c.next = this.chooseNext(s);
      const g = c.next >= 0 ? this.usable(c.next) : null;
      if (!g) {
        // nowhere to go (the next street became unusable): stop at the line; recycled when stuck
        if (c.next >= 0 && toEnd < 18) c.next = this.chooseNext(s);
        target = Math.min(target, Math.sqrt(2 * B * Math.max(0, toEnd - 0.05)));
      } else if (toEnd < 12) {
        const open = this.canEnter(c, s.v, g, vehicles);
        if (!open) { target = Math.min(target, Math.sqrt(2 * B * Math.max(0, toEnd - 0.05))); if (toEnd < 1) this.stats.waits++; }
        else if (g.dx * s.dx + g.dz * s.dz < Math.cos(SHARP)) target = Math.min(target, Math.sqrt(TRAFFIC.turnSpeed ** 2 + 2 * B * Math.max(0, toEnd)));
        if (open && toEnd <= 0.05 + c.v * dt) { this.startTurn(c, s, g); return this.accel(c, target, dt); }
      }
      this.accel(c, target, dt);
      c.s = Math.min(end, c.s + c.v * dt);
      return;
    }
    // turning through the junction
    const g = this.net.edge(c.next);
    if (!g) return;
    if (g.dx * s.dx + g.dz * s.dz < Math.cos(SHARP)) target = Math.min(target, TRAFFIC.turnSpeed);
    this.accel(c, target, dt);
    c.tt += c.v * dt;
    if (c.tt >= c.tl) {
      if (c.node >= 0 && this.held.get(c.node) === c.id) this.held.delete(c.node);
      c.node = -1;
      c.mode = 'lane'; c.e = c.next; c.next = -1;
      c.s = this.span(g)[0] + (c.tt - c.tl);
    }
  }

  private accel(c: Car, target: number, dt: number) {
    if (c.v < target) c.v = Math.min(target, c.v + TRAFFIC.accel * dt);
    else c.v = Math.max(target, c.v - TRAFFIC.brake * 1.6 * dt);
    c.still = c.v < 0.15 ? c.still + dt : 0;
  }

  /**
   * (W5-T2) A stopped car with a stopped transit vehicle (a bus, a train, a cable car: not another toy car, not the
   * player's) queued right behind it counts how long it holds that one up; after TRAFFIC.giveWay s it shrinks away.
   */
  private watchHoldUp(c: Car, dt: number, vehicles: readonly RoadVehicle[]) {
    if (c.leaving) return;
    let held = false, hurry = false, inside = false;
    for (const q of vehicles) {
      if (q.kind === 'traffic' || q.kind === 'player') continue;
      if (Math.abs(q.x - c.x) > 20 || Math.abs(q.z - c.z) > 20) continue;
      // inside its body (turned into it, or it came over the car): no car ever stays there
      if (bodyDistance(q, c.x, c.z) < q.halfW + HALF_W * 0.5) { inside = true; break; }
      if (!queuedBehind(c, q)) continue;
      if (Math.hypot(q.x - c.x, q.z - c.z) < 12 + q.halfL) hurry = true;
      if (c.v < 0.15 && Math.abs(q.v) < 0.5) held = true;
    }
    c.hurry = hurry;
    c.holdUp = held ? c.holdUp + dt : 0;
    if (inside || c.holdUp > TRAFFIC.giveWay) { c.leaving = true; this.stats.gaveWay++; }
  }

  private startTurn(c: Car, s: StreetEdge, g: StreetEdge) {
    const [, end] = this.span(s);
    this.lanePoint(s, end, _p);
    c.p0x = _p.x; c.p0z = _p.z;
    this.lanePoint(g, this.span(g)[0], _p);
    c.p1x = _p.x; c.p1z = _p.z;
    // control point: where the two lane lines meet (a U-turn bulges past the end of the street)
    const den = s.dx * g.dz - s.dz * g.dx;
    if (g.e === s.twin || Math.abs(den) < 0.12) {
      const mx = (c.p0x + c.p1x) / 2, mz = (c.p0z + c.p1z) / 2;
      const bulge = g.e === s.twin ? 2.6 : 0;
      c.cx = mx + s.dx * bulge; c.cz = mz + s.dz * bulge;
    } else {
      const wx = c.p1x - c.p0x, wz = c.p1z - c.p0z;
      const t = (wx * g.dz - wz * g.dx) / den;
      const tc = Math.max(0, Math.min(t, 12));
      c.cx = c.p0x + s.dx * tc; c.cz = c.p0z + s.dz * tc;
    }
    c.tl = bezierLength(c.p0x, c.p0z, c.cx, c.cz, c.p1x, c.p1z);
    c.tt = 0;
    c.mode = 'turn';
    if (this.net.degree(s.v) >= 3) { const box = this.boxOf(s.v); this.held.set(box, c.id); c.node = box; }
    this.stats.turns++;
    if (c.tl < 0.05) { c.mode = 'lane'; c.e = g.e; c.next = -1; c.s = this.span(g)[0]; if (c.node >= 0) this.held.delete(c.node); c.node = -1; }
  }

  private pose(c: Car, dt: number, f: { x: number; z: number }) {
    let x: number, z: number, hd: number;
    if (c.mode === 'turn') {
      const t = c.tl > 0 ? Math.min(1, c.tt / c.tl) : 1, u = 1 - t;
      x = u * u * c.p0x + 2 * u * t * c.cx + t * t * c.p1x;
      z = u * u * c.p0z + 2 * u * t * c.cz + t * t * c.p1z;
      const dx = 2 * u * (c.cx - c.p0x) + 2 * t * (c.p1x - c.cx), dz = 2 * u * (c.cz - c.p0z) + 2 * t * (c.p1z - c.cz);
      hd = Math.hypot(dx, dz) > 1e-4 ? Math.atan2(dx, dz) : c.heading;
    } else {
      const s = this.net.edge(c.e);
      if (!s) return;
      this.lanePoint(s, c.s, _p);
      x = _p.x; z = _p.z; hd = Math.atan2(s.dx, s.dz);
    }
    c.x = x; c.z = z;
    let d = hd - c.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    c.heading += d * (1 - Math.exp(-dt * 12));
    const fx = Math.sin(c.heading) * 0.85, fz = Math.cos(c.heading) * 0.85;
    const pr = this.net.probe;
    const hf = pr.height(x + fx, z + fz), hb = pr.height(x - fx, z - fz);
    c.y = (hf + hb) / 2;
    c.pitch += (Math.atan2(hf - hb, 1.7) - c.pitch) * (1 - Math.exp(-dt * 10));
    if (c.leaving) c.grow = Math.max(0, c.grow - dt * 2.4);
    else if (c.grow < 1) c.grow = Math.min(1, c.grow + dt * 1.2);
    // pass-by: the closest approach to the listener, within 10 u, at speed
    const dd = Math.hypot(x - f.x, z - f.z);
    if (c.closing && dd > c.lastD && c.lastD < 10 && c.v > 3) this.passes.push({ x, z, heading: c.heading, v: c.v, d: c.lastD });
    c.closing = dd < c.lastD;
    c.lastD = dd;
    if (this.passes.length > 16) this.passes.splice(0, this.passes.length - 16);
  }

  /** Two soft obstacle discs per car (actors/view.ts registerObstacleSource; pooled records, F4). */
  obstacles(out: Obstacle[], x: number, z: number, r: number) {
    const pool = this.obstaclePool.begin(out);
    for (const c of this.cars) {
      if (!c.on || c.grow < 0.5) continue;
      if (Math.abs(c.x - x) > r + 2 || Math.abs(c.z - z) > r + 2) continue;
      const fx = Math.sin(c.heading) * 0.5, fz = Math.cos(c.heading) * 0.5;
      for (const k of FRONT_BACK) {
        const o = pool.next();
        o.x = c.x + fx * k; o.z = c.z + fz * k; o.r = 0.6; o.kind = 'traffic';
        out.push(o);
      }
    }
  }
  private readonly obstaclePool = obstaclePool();

  /** The cars as road vehicles (for the crowd's hop; pooled records, F4). */
  vehicles(out: RoadVehicle[]) {
    const pool = this.vehiclePool.begin(out);
    // (a car shrinking away out of a bus's way is no longer in anyone's way)
    for (const c of this.cars) if (c.on && !c.leaving) out.push(setVehicle(pool.next(), c.x, c.z, c.heading, c.v, HALF_L, HALF_W, 'traffic', 'traffic'));
  }
  private readonly vehiclePool = vehiclePool();
}

/** a car's two obstacle discs: half a unit ahead of and behind its centre */
const FRONT_BACK = [1, -1] as const;

/** (W5-T2) Distance from (x, z) to road vehicle q's centre segment (its body's long axis, ± halfL − halfW). */
export function bodyDistance(q: Pick<RoadVehicle, 'x' | 'z' | 'heading' | 'halfL' | 'halfW'>, x: number, z: number): number {
  const fx = Math.sin(q.heading), fz = Math.cos(q.heading), h = Math.max(0, q.halfL - q.halfW);
  const t = Math.max(-h, Math.min(h, (x - q.x) * fx + (z - q.z) * fz));
  return Math.hypot(x - q.x - fx * t, z - q.z - fz * t);
}

/**
 * (W5-T2) Is road vehicle `q` queued behind car `c` in its lane — so it waits for the car (the bus's `roadAhead`) and the
 * car must never wait for it at a junction? Either seen from the car (behind it within its body + 14 u, within a lane
 * sideways, going the same way ± 60°) or seen from `q` the way the bus looks ahead (the car within 30 u ahead of it,
 * within 1.7 u of its line, ± 60°: world/sf/lineFleet.ts roadAhead) — on a curve only the second holds (Ocean Beach:
 * the car at its stop line 43° off the bus's heading waited for the bus 40 s).
 */
export function queuedBehind(c: Pick<Car, 'x' | 'z' | 'heading'>, q: Pick<RoadVehicle, 'x' | 'z' | 'heading' | 'halfL' | 'halfW'>): boolean {
  if (Math.cos(q.heading - c.heading) <= 0.5) return false;
  const rx = q.x - c.x, rz = q.z - c.z;
  // seen from the car
  const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
  const along = rx * fx + rz * fz;
  if (along < 0 && along > -(q.halfL + HALF_L + 14) && Math.abs(rx * fz - rz * fx) < q.halfW + 1.2) return true;
  // seen from q (its lane ahead, as the bus looks)
  const qx = Math.sin(q.heading), qz = Math.cos(q.heading);
  const ahead = -(rx * qx + rz * qz);
  return ahead > 0 && ahead < 30 && Math.abs(rx * qz - rz * qx) < 1.7;
}

function bezierLength(ax: number, az: number, cx: number, cz: number, bx: number, bz: number): number {
  let L = 0, px = ax, pz = az;
  for (let i = 1; i <= 8; i++) {
    const t = i / 8, u = 1 - t;
    const x = u * u * ax + 2 * u * t * cx + t * t * bx, z = u * u * az + 2 * u * t * cz + t * t * bz;
    L += Math.hypot(x - px, z - pz);
    px = x; pz = z;
  }
  return L;
}

// ---------------------------------------------------------------------------
// The toy car
// ---------------------------------------------------------------------------

/** SF-pastel paints (the instance colour; the body is white in the geometry) and a taxi now and then. */
export const TRAFFIC_PAINTS = ['#e89a8c', '#9cc7d6', '#f1d38a', '#a9d3b2', '#f4efe6', '#c7b3e0', '#e98b5d', '#7a9cc6', '#d9e3e8', '#f2c230', '#b9504a', '#5f8a74'];

const GLASS = '#2c3a44';
const TYRE = '#26252a';
/** lit at night (aInfo style 7: a warm glow toward the bottom) */
const LAMP: readonly [number, number, number, number] = [7, 0.2, 0, 0];

/** A unit box with 2 segments per side whose corners are pulled in (`soft` 0 … 1): the toy cars' rounded body. */
let SOFT: THREE.BufferGeometry | null = null;
function softUnitBox(): THREE.BufferGeometry {
  if (SOFT) return SOFT;
  const g = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const nx = v.x * 2, ny = v.y * 2, nz = v.z * 2;
    const len = Math.hypot(nx, ny, nz) || 1;
    const k = 0.55 + 0.45 * (Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz)) / len);
    p.setXYZ(i, v.x * k, v.y * k + 0.5 * k, v.z * k);
  }
  g.computeVertexNormals();
  return (SOFT = g);
}

/**
 * The near car (≈ 290 triangles): a rounded toy sedan 2.1 × 1.08 (the player's toy car's shape language: soft boxes),
 * a rounded cabin with a glass band all round, head / tail lamps that glow at night, four wheels.
 */
export function trafficCarGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const L = TRAFFIC.length, W = TRAFFIC.width, soft = softUnitBox();
  // wheels (dark tyres) under the body
  for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) for (const z of [-L * 0.3, L * 0.3]) b.add(CYL(6), M(x, 0.21, z, 0, 0.2, 0.16, 0.2, 0, Math.PI / 2).multiply(M(0, -0.5)), TYRE);
  // body (the paint: white × the instance colour), a rounded tub from 0.12 to 0.58
  b.add(soft, M(0, 0.12, 0, 0, W, 0.46, L), '#ffffff');
  // cabin + the glass band (proud of the cabin on every side, so it reads from any angle)
  b.add(soft, M(0, 0.48, -0.1, 0, W - 0.16, 0.5, L * 0.54), '#ffffff');
  b.add(soft, M(0, 0.6, -0.1, 0, W - 0.12, 0.27, L * 0.54 + 0.06), GLASS);
  // head / tail lamps
  // (tucked inside the rounded corners)
  for (const x of [-W / 2 + 0.27, W / 2 - 0.27]) {
    b.add(BOX(), M(x, 0.3, L / 2 - 0.08, 0, 0.22, 0.13, 0.1), '#fff4d0', LAMP);
    b.add(BOX(), M(x, 0.32, -L / 2 + 0.08, 0, 0.2, 0.11, 0.1), '#f08a6a', LAMP);
  }
  return b.build();
}

/** The far car (≈ 50 triangles): body, cabin with glass, a dark underside. */
export function trafficCarFarGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const L = TRAFFIC.length, W = TRAFFIC.width;
  b.add(BOX(), M(0, 0.02, 0, 0, W - 0.1, 0.2, L - 0.3), TYRE);
  b.add(BOX(), M(0, 0.18, 0, 0, W, 0.4, L - 0.1), '#ffffff');
  b.add(BOX(), M(0, 0.58, -0.08, 0, W - 0.12, 0.3, L * 0.52), GLASS);
  b.add(BOX(), M(0, 0.88, -0.08, 0, W - 0.2, 0.1, L * 0.5), '#ffffff');
  return b.build();
}

const _m = new THREE.Matrix4();
const _qt = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

function carMesh(geo: THREE.BufferGeometry, max: number, name: string, shadow: boolean) {
  const mesh = new THREE.InstancedMesh(geo, TOY_INST_TINT, max);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color('#ffffff'));
  mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.visible = false;
  return mesh;
}

/** This frame's instance count of a car mesh (and its upload flags). */
function commit(mesh: THREE.InstancedMesh, count: number) {
  mesh.count = count;
  mesh.visible = count > 0;
  if (!count) return;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor!.needsUpdate = true;
}

export class TrafficLayer {
  readonly group = new THREE.Group();
  readonly sim: TrafficSim;
  private near: THREE.InstancedMesh;
  private far: THREE.InstancedMesh;
  private paints = TRAFFIC_PAINTS.map(c => new THREE.Color(c));

  constructor(net: StreetNet, env: TrafficEnv, max: number = TRAFFIC.count.high) {
    this.group.name = 'city-traffic';
    this.group.matrixAutoUpdate = false;
    this.sim = new TrafficSim(net, env, { max, seed: 0x7a11 });
    this.near = carMesh(trafficCarGeometry(), max, 'traffic-near', true);
    this.far = carMesh(trafficCarFarGeometry(), max, 'traffic-far', false);
    this.group.add(this.near, this.far);
  }

  update(dt: number, cam: { x: number; y: number; z: number }) {
    this.sim.step(dt);
    this.draw(cam);
  }

  draw(cam: { x: number; y: number; z: number }) {
    let n = 0, nf = 0;
    for (const c of this.sim.cars) {
      if (!c.on) continue;
      const d = Math.hypot(c.x - cam.x, c.z - cam.z);
      if (d > this.sim.radius + 10) continue;
      const k = c.grow < 1 ? 0.2 + 0.8 * c.grow : 1;
      _e.set(-c.pitch, c.heading, 0, 'YXZ');
      _m.compose(_v.set(c.x, c.y + 0.02, c.z), _qt.setFromEuler(_e), _s.set(k, k, k));
      const mesh = d > TRAFFIC.nearLod ? this.far : this.near;
      const i = mesh === this.far ? nf++ : n++;
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, this.paints[c.color % this.paints.length]);
    }
    commit(this.near, n);
    commit(this.far, nf);
  }

  hide() { this.near.visible = false; this.far.visible = false; }

  stats() {
    let moving = 0, turning = 0;
    for (const c of this.sim.cars) if (c.on) { if (c.mode === 'turn') turning++; if (c.v > 0.5) moving++; }
    return { active: this.sim.active, moving, turning, near: this.near.count, far: this.far.count, ...this.sim.stats };
  }

  dispose() {
    this.near.geometry.dispose();
    this.far.geometry.dispose();
    this.near.dispose();
    this.far.dispose();
  }
}
