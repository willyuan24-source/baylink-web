import type { TransitKind } from '../../core/events';
import type { SurfaceKind } from '../../core/types';
import type { WalkGraphIndex } from '../../core/walkGraph';

/**
 * The street network the city crowd and the toy traffic run on (lane F, wave 3 part b: F11 / F12). Pure: no three.js,
 * no DOM; the ground comes in through a `StreetProbe` (core/terrain in the browser, the disk terrain in node tests).
 *
 * - **Edges** are the walking graph's directed edges (core/walkGraph, graph.obc): street centrelines, footways, paths,
 *   steps. `edge(e)` measures one lazily from the ground under it: the asphalt half width to the kerb on each side (the
 *   city's terrain answers 'road' inside the kerb, 'pavement' beyond it), whether it is raised off the ground (a viaduct
 *   or a bridge deck), and caches it until the ground data under it changes (`probe.epoch`, e.g. a chunk dropped).
 *   Unresolved ground (no chunk resident there) answers null, so nothing ever walks or drives where the ground is unknown.
 * - **Setbacks** at junctions: a walker's sidewalk ends at the corner (the crossing street's half width), a car's lane at
 *   its stop line.
 * - **Road vehicles** other lanes run (cable cars, the F-line, the bus loop, the player's bike / car) are published through
 *   `registerRoadVehicles`, so walkers hop out of their way and the toy traffic waits for them.
 */

/** GRAPH_EDGE codes (world/sf/format): 0 street, 1 steps, 2 path, 3 pedestrian, 4 service. */
export const EK = { street: 0, steps: 1, path: 2, pedestrian: 3, service: 4 } as const;

export interface StreetProbe {
  /** walkable surface at (x, z); null = not walkable, or no ground data there */
  surface(x: number, z: number): SurfaceKind | null;
  /** a disc of radius r fits at (x, z) (walkable, no blocker) */
  stand(x: number, z: number, r: number): boolean;
  height(x: number, z: number): number;
  /** changes whenever the ground data under (x, z) changes; cached edges are measured again then */
  epoch?(x: number, z: number): number;
}

export interface StreetEdge {
  e: number;
  u: number;
  v: number;
  kind: number;
  /** the reverse edge (v → u), −1 if the graph has none */
  twin: number;
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  len: number;
  /** unit direction u → v */
  dx: number; dz: number;
  /** left normal (dz, −dx): side +1 is on the left of travel, side −1 on the right */
  nx: number; nz: number;
  /** asphalt half width to the kerb on the left (+n) / right (−n); 0 = no roadway here (footway, plaza way) */
  curbL: number;
  curbR: number;
  /** the centre line is roadway */
  road: boolean;
  /**
   * no kerb within reach on a side: a short piece inside a junction box or a plaza of asphalt (its curbs are then the
   * other side's, or a typical 1.6 u); junction setbacks ignore it
   */
  box: boolean;
  /** the centre line runs well above the ground under it (a viaduct / bridge deck): nobody walks or drives it here */
  raised: boolean;
  /** probe epoch the measurement belongs to */
  epoch: number;
}

/** kerb search: step and reach (u) */
const CURB_STEP = 0.25;
const CURB_REACH = 7;
/** an edge more than this above the ground under it is raised (u) */
const RAISED = 1.2;
/** kerb assumed on an edge measured inside a junction box (u) */
const BOX_CURB = 1.6;
/** a junction's setback never exceeds this (u) */
const MAX_SETBACK = 4.5;
/** measured edges kept before the cache starts over */
const MAX_CACHED = 12_000;

export class StreetNet {
  readonly ix: WalkGraphIndex;
  readonly probe: StreetProbe;
  private cache = new Map<number, StreetEdge | null>();
  private cacheEpoch = new Map<number, number>();

  constructor(ix: WalkGraphIndex, probe: StreetProbe) {
    this.ix = ix;
    this.probe = probe;
  }

  get graph() { return this.ix.graph; }

  /** Edge ids out of `node` (CSR range). */
  outStart(node: number) { return this.ix.graph.offsets[node]; }
  outEnd(node: number) { return this.ix.graph.offsets[node + 1]; }
  degree(node: number) { const o = this.ix.graph.offsets; return o[node + 1] - o[node]; }
  target(e: number) { return this.ix.graph.targets[e]; }
  kind(e: number) { return this.ix.graph.kind[e]; }
  isHero(node: number) { return this.ix.isHero(node); }

  /** Source node of a directed edge (binary search over the CSR offsets). */
  source(e: number): number {
    const o = this.ix.graph.offsets;
    let lo = 0, hi = this.ix.graph.nodeCount;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (o[mid] <= e) lo = mid; else hi = mid; }
    return lo;
  }

  twinOf(e: number, u = this.source(e)): number {
    const g = this.ix.graph, v = g.targets[e];
    for (let f = g.offsets[v]; f < g.offsets[v + 1]; f++) if (g.targets[f] === u) return f;
    return -1;
  }

  /** The measured edge, or null while the ground under it is unknown / not walkable. */
  edge(e: number): StreetEdge | null {
    const hit = this.cache.get(e);
    if (hit !== undefined) {
      const ep = this.cacheEpoch.get(e)!;
      if (!this.probe.epoch) return hit;
      const g = this.ix.graph, u = hit ? hit.u : this.source(e), v = g.targets[e];
      const mx = (g.xyz[3 * u] + g.xyz[3 * v]) / 2, mz = (g.xyz[3 * u + 2] + g.xyz[3 * v + 2]) / 2;
      if (this.probe.epoch(mx, mz) === ep) return hit;
    }
    const m = this.measure(e);
    return m;
  }

  private measure(e: number): StreetEdge | null {
    const g = this.ix.graph, p = this.probe;
    const u = this.source(e), v = g.targets[e];
    const ax = g.xyz[3 * u], ay = g.xyz[3 * u + 1], az = g.xyz[3 * u + 2];
    const bx = g.xyz[3 * v], by = g.xyz[3 * v + 1], bz = g.xyz[3 * v + 2];
    const len = Math.hypot(bx - ax, bz - az);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const epoch = p.epoch ? p.epoch(mx, mz) : 0;
    // a long walk across the city measures thousands of edges: start over now and then (re-measuring is cheap)
    if (this.cache.size > MAX_CACHED) this.clear();
    const store = (r: StreetEdge | null) => { this.cache.set(e, r); this.cacheEpoch.set(e, epoch); return r; };
    if (len < 1e-3) return store(null);
    const dx = (bx - ax) / len, dz = (bz - az) / len, nx = dz, nz = -dx;
    const centre = p.surface(mx, mz);
    if (!centre) return store(null);
    const road = centre === 'road';
    // the kerb on each side: where 'road' stops, measured at up to two points along the edge (the smaller wins, so a
    // junction box or a bus bay does not widen the street)
    const ts = len > 4 ? [0.35, 0.65] : [0.5];
    let curbL = road ? Infinity : 0, curbR = road ? Infinity : 0;
    if (road) {
      for (const t of ts) {
        const cx = ax + (bx - ax) * t, cz = az + (bz - az) * t;
        curbL = Math.min(curbL, kerb(p, cx, cz, nx, nz));
        curbR = Math.min(curbR, kerb(p, cx, cz, -nx, -nz));
      }
    }
    const raised = (ay + by) / 2 - p.height(mx, mz) > RAISED;
    const openL = curbL >= CURB_REACH - 0.2, openR = curbR >= CURB_REACH - 0.2, box = road && (openL || openR);
    if (openL && openR) curbL = curbR = BOX_CURB;
    else if (openL) curbL = curbR;
    else if (openR) curbR = curbL;
    return store({ e, u, v, kind: g.kind[e], twin: this.twinOf(e, u), ax, ay, az, bx, by, bz, len, dx, dz, nx, nz, curbL, curbR, road, box, raised, epoch });
  }

  /**
   * How far from `node` a walker's sidewalk (cars: the stop line) along a street heading (dx, dz) ends: the widest half
   * roadway among the node's *crossing* streets. The street's own continuation (roughly parallel), footways, plaza ways
   * and junction-box slivers do not count, so a crosswalk node or a path joining mid-block does not cut the sidewalk.
   * Without a direction: every street at the node. 0 at a bend, a dead end, or where nothing is measured.
   */
  setback(node: number, dx = 0, dz = 0): number {
    if (this.degree(node) < 3) return 0;
    const any = dx === 0 && dz === 0;
    let w = 0;
    for (let f = this.outStart(node); f < this.outEnd(node); f++) {
      const s = this.edge(f);
      if (!s || !s.road || s.box) continue;
      if (!any && Math.abs(s.dx * dx + s.dz * dz) > 0.8) continue;
      w = Math.max(w, s.curbL, s.curbR);
    }
    return Math.min(MAX_SETBACK, w);
  }

  /** Point at arc s along the edge, `off` to its left (negative = right). */
  at(s: StreetEdge, along: number, off: number, out: { x: number; z: number }) {
    out.x = s.ax + s.dx * along + s.nx * off;
    out.z = s.az + s.dz * along + s.nz * off;
    return out;
  }

  /** Drop every cached measurement (tests; a city reload). */
  clear() { this.cache.clear(); this.cacheEpoch.clear(); }
}

function kerb(p: StreetProbe, x: number, z: number, nx: number, nz: number): number {
  for (let d = CURB_STEP; d <= CURB_REACH; d += CURB_STEP) {
    if (p.surface(x + nx * d, z + nz * d) !== 'road') return d - CURB_STEP / 2;
  }
  return CURB_REACH;
}

// ---------------------------------------------------------------------------
// Road vehicles of other systems (for the crowd's hop and the traffic's give-way)
// ---------------------------------------------------------------------------

/**
 * A vehicle on the streets: centre, heading (atan2 of the travel direction), speed along the heading (u/s, ≥ 0 unless
 * reversing), half length / width. `kind` 'traffic' = F's toy traffic, 'player' = the player's bike or car, else the
 * transit kind; `line` = the transit line id ('traffic' / 'player' for the others).
 */
export interface RoadVehicle {
  x: number; z: number;
  heading: number;
  v: number;
  halfL: number;
  halfW: number;
  kind: 'traffic' | 'player' | TransitKind;
  line: string;
}

export type RoadVehicleSource = (out: RoadVehicle[]) => void;
const vehicleSources: RoadVehicleSource[] = [];

/**
 * Publish moving road vehicles (called once a frame by the crowd and the traffic): F's transit layer registers the
 * cable cars and the F-line, the traffic its cars; wave 4's bus loop / light rail can register theirs the same way.
 * Returns the unregister function.
 */
export function registerRoadVehicles(fn: RoadVehicleSource): () => void {
  vehicleSources.push(fn);
  return () => { const i = vehicleSources.indexOf(fn); if (i >= 0) vehicleSources.splice(i, 1); };
}

/** Every registered road vehicle (the out array is cleared first). */
export function collectRoadVehicles(out: RoadVehicle[]): RoadVehicle[] {
  out.length = 0;
  for (const fn of vehicleSources) fn(out);
  return out;
}

/** Distance from (px, pz) to a vehicle's centre line (the segment from its tail to its nose). */
export function centreLineDistance(px: number, pz: number, q: RoadVehicle): number {
  const fx = Math.sin(q.heading), fz = Math.cos(q.heading);
  const rx = px - q.x, rz = pz - q.z;
  const along = Math.max(-q.halfL, Math.min(q.halfL, rx * fx + rz * fz));
  return Math.hypot(rx - fx * along, rz - fz * along);
}

/**
 * Nearest approach of a point moving at (pvx, pvz) to a vehicle's centre line over the next `horizon` seconds, both
 * moving straight on (sampled `steps` + 1 times): the smallest distance and when.
 */
export function predictApproach(px: number, pz: number, pvx: number, pvz: number, q: RoadVehicle, horizon: number, steps = 6): { d: number; t: number } {
  const fx = Math.sin(q.heading), fz = Math.cos(q.heading);
  const vx = fx * q.v, vz = fz * q.v;
  let best = Infinity, bt = 0;
  for (let i = 0; i <= steps; i++) {
    const t = (i / Math.max(1, steps)) * horizon;
    const rx = px + pvx * t - (q.x + vx * t), rz = pz + pvz * t - (q.z + vz * t);
    const along = Math.max(-q.halfL, Math.min(q.halfL, rx * fx + rz * fz));
    const d = Math.hypot(rx - fx * along, rz - fz * along);
    if (d < best) { best = d; bt = t; }
  }
  return { d: best, t: bt };
}

// ---------------------------------------------------------------------------
// Streets that carry a transit line (the toy traffic keeps off them)
// ---------------------------------------------------------------------------

const TS_BUCKET = 8;
const tsPaths: Float32Array[] = [];
let tsHash: Map<number, number[]> | null = null;
const tsKey = (bx: number, bz: number) => (bx + 4096) * 8192 + (bz + 4096);

function tsBuild(): Map<number, number[]> {
  const h = new Map<number, number[]>();
  for (const p of tsPaths) {
    for (let i = 4; i < p.length; i += 4) {
      const ax = p[i - 4], az = p[i - 3], bx = p[i], bz = p[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 1e-4) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      for (let d = 0; d <= L; d += 2) {
        const x = ax + ux * d, z = az + uz * d, k = tsKey(Math.floor(x / TS_BUCKET), Math.floor(z / TS_BUCKET));
        let list = h.get(k);
        if (!list) h.set(k, (list = []));
        list.push(x, z, ux, uz);
      }
    }
  }
  return h;
}

/**
 * Register a transit line's centre line (x, y, z triples, or x, z pairs with stride 2): the cable cars, the F-line;
 * wave 4's surface light rail can add its tracks. Returns the unregister function.
 */
export function registerTransitStreet(pts: ArrayLike<number>, stride = 3): () => void {
  const n = Math.floor(pts.length / stride);
  const p = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { p[i * 4] = pts[i * stride]; p[i * 4 + 1] = pts[i * stride + stride - 1]; }
  tsPaths.push(p);
  tsHash = null;
  return () => { const i = tsPaths.indexOf(p); if (i >= 0) { tsPaths.splice(i, 1); tsHash = null; } };
}

/** Does a transit line run along the street at (x, z) heading (dx, dz)? (within `within` u, roughly parallel) */
export function onTransitStreet(x: number, z: number, dx: number, dz: number, within = 2.6): boolean {
  if (!tsPaths.length) return false;
  const h = (tsHash ??= tsBuild());
  const b0 = Math.floor((x - within) / TS_BUCKET), b1 = Math.floor((x + within) / TS_BUCKET);
  const c0 = Math.floor((z - within) / TS_BUCKET), c1 = Math.floor((z + within) / TS_BUCKET);
  for (let bx = b0; bx <= b1; bx++) for (let bz = c0; bz <= c1; bz++) {
    const list = h.get(tsKey(bx, bz));
    if (!list) continue;
    for (let i = 0; i < list.length; i += 4) {
      if (Math.hypot(list[i] - x, list[i + 1] - z) > within) continue;
      if (Math.abs(list[i + 2] * dx + list[i + 3] * dz) > 0.7) return true;
    }
  }
  return false;
}

/**
 * (W5-bus) Does a transit line's centre line pass within `within` u of (x, z), any direction? (a junction there is a
 * crossing box for the toy traffic)
 */
export function nearTransitLine(x: number, z: number, within: number): boolean {
  if (!tsPaths.length) return false;
  const h = (tsHash ??= tsBuild());
  const b0 = Math.floor((x - within) / TS_BUCKET), b1 = Math.floor((x + within) / TS_BUCKET);
  const c0 = Math.floor((z - within) / TS_BUCKET), c1 = Math.floor((z + within) / TS_BUCKET);
  for (let bx = b0; bx <= b1; bx++) for (let bz = c0; bz <= c1; bz++) {
    const list = h.get(tsKey(bx, bz));
    if (!list) continue;
    for (let i = 0; i < list.length; i += 4) if (Math.hypot(list[i] - x, list[i + 1] - z) <= within) return true;
  }
  return false;
}

/** Deterministic PRNG (mulberry32) for the simulations (tests seed it). */
export function lifeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
