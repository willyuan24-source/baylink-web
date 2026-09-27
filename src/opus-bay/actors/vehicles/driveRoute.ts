import { canStand, cityTerrain, groundPending, surfaceAt, type NavGrid } from '../../core/terrain';
import type { Vec2 } from '../../core/types';
import { polylineLength } from '../../core/polyline';
import type { AsyncRouteOptions, WalkGraphIndex } from '../../core/walkGraph';
import { GRAPH_SNAP, graphNodeFilter, navInside, navWindowFor, walkGraph } from '../nav';
import { BIKE_SPEC } from './bike';
import type { SurfaceRule } from './collide';
import { CAR_SPEC } from './toyCar';

/**
 * Where a bike or the toy car can drive, and the way there (plan §6.4 "tap-to-drive", checkpoint E2-3). Pure apart
 * from core/terrain and the city walking graph; the autopilot (vehicles/autopilot.ts) follows the points.
 *
 * - **Drive mask.** A spot is drivable for a vehicle when its surface rule allows the ground under the centre and under a
 *   ring of the hull clearance (car 0.55 u, bike 0.35 u) and no blocker touches that disc (so steps, water, piers for
 *   the car and building walls are out). Evaluated lazily per nav cell (0.75 u) the first time a search touches it.
 * - **Grid routes** (district mode; short hops and connectors in the city): A* on the nav grid (the district grid or
 *   the city window, nav.navWindowFor) over walk-standable cells the drive mask accepts, cost ÷ the surface factor
 *   (grass / sand are slow), string-pulled with a drive line of sight.
 * - **Graph routes** (city mode, farther than GRID_ROUTE): the walking graph with an edge filter — the car keeps to
 *   street + service edges, the bike adds pedestrian ways and paths, neither ever takes steps. Both ends snap to the
 *   nearest usable edge of one connected drive network (the projection on the edge, so a car mid-block never drives
 *   back to the corner behind it), A* runs time-sliced (core/walkGraph edgeAccept), and the stretches from the vehicle
 *   to the street and from the street to the goal are straight when drivable, else grid routes.
 */

export type DriveKind = 'car' | 'bike';

/** GRAPH_EDGE codes (world/sf/format) each vehicle may use: 0 street, 1 steps, 2 path, 3 pedestrian, 4 service. */
export const DRIVE_EDGES: Record<DriveKind, readonly number[]> = { car: [0, 4], bike: [0, 2, 3, 4] };
/** hull clearance of the drive mask (u) */
export const DRIVE_CLEARANCE: Record<DriveKind, number> = { car: 0.55, bike: 0.35 };
/** city mode: a goal closer than this is a grid route, farther ones use the graph (u) */
export const GRID_ROUTE = 40;
/** a tapped goal that is not drivable moves to the nearest drivable spot within this (u) */
export const GOAL_SNAP = 10;
const RULES: Record<DriveKind, SurfaceRule> = { car: CAR_SPEC.surfaces, bike: BIKE_SPEC.surfaces };
const MAX_EXPANSIONS = 60_000;
const SQRT2 = Math.SQRT2;

const factorAt = (rule: SurfaceRule, x: number, z: number) => { const s = surfaceAt(x, z); return s ? rule[s] ?? 0 : 0; };

/** The hull disc of `kind` fits at (x, z): allowed surfaces under the centre and a ring, no blocker. */
export function drivableAt(x: number, z: number, kind: DriveKind): boolean {
  const rule = RULES[kind], r = DRIVE_CLEARANCE[kind], o = r * 0.7071;
  if (factorAt(rule, x, z) <= 0) return false;
  if (factorAt(rule, x + r, z) <= 0 || factorAt(rule, x - r, z) <= 0 || factorAt(rule, x, z + r) <= 0 || factorAt(rule, x, z - r) <= 0
    || factorAt(rule, x + o, z + o) <= 0 || factorAt(rule, x - o, z + o) <= 0 || factorAt(rule, x + o, z - o) <= 0 || factorAt(rule, x - o, z - o) <= 0) return false;
  return canStand(x, z, r);
}

/** Nearest drivable point within maxDist (0.5 u rings), or null. */
export function snapDrivable(p: Vec2, kind: DriveKind, maxDist = GOAL_SNAP): Vec2 | null {
  if (drivableAt(p.x, p.z, kind)) return { x: p.x, z: p.z };
  const step = 0.5, K = Math.ceil(maxDist / step);
  let best: Vec2 | null = null, bestD = Infinity;
  for (let k = 1; k <= K; k++) {
    for (let dr = -k; dr <= k; dr++) {
      const edge = dr === -k || dr === k;
      for (let dc = -k; dc <= k; dc += edge ? 1 : 2 * k) {
        const x = p.x + dc * step, z = p.z + dr * step, d = (dc * dc + dr * dr) * step * step;
        if (d < bestD && d <= maxDist * maxDist && drivableAt(x, z, kind)) { bestD = d; best = { x, z }; }
      }
    }
    if (best && (k + 1) * step > Math.sqrt(bestD)) break;
  }
  return best;
}

/** Straight drivable line a → b (samples every 0.5 u; ground still streaming in counts as drivable). */
export function driveLineClear(a: Vec2, b: Vec2, kind: DriveKind): boolean {
  const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 0.5));
  for (let i = 1; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
    if (!drivableAt(x, z, kind) && !groundPending(x, z)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Grid routes (lazy drive mask on the nav grid)
// ---------------------------------------------------------------------------

interface Mask { grid: NavGrid; kind: DriveKind; m: Int8Array }
let MASK: Mask | null = null;
/** mask cells evaluated so far (QA) */
export const driveMaskStats = { evaluated: 0 };

function maskFor(g: NavGrid, kind: DriveKind): Mask {
  if (MASK && MASK.grid === g && MASK.kind === kind) return MASK;
  const n = g.cols * g.rows;
  MASK = { grid: g, kind, m: MASK && MASK.m.length === n ? MASK.m.fill(0) : new Int8Array(n) };
  return MASK;
}
function openCell(M: Mask, c: number, r: number): boolean {
  const g = M.grid;
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return false;
  const i = r * g.cols + c;
  let v = M.m[i];
  if (v === 0) {
    v = g.walkable[i] === 1 && drivableAt(g.minX + (c + 0.5) * g.cell, g.minZ + (r + 0.5) * g.cell, M.kind) ? 1 : -1;
    M.m[i] = v;
    driveMaskStats.evaluated++;
  }
  return v > 0;
}

let gScore = new Float32Array(0), parent = new Int32Array(0), seen = new Uint32Array(0), closed = new Uint32Array(0);
let generation = 0;
let heapI = new Int32Array(1024), heapF = new Float32Array(1024), heapN = 0;
function ensure(n: number) {
  if (gScore.length === n) return;
  gScore = new Float32Array(n); parent = new Int32Array(n); seen = new Uint32Array(n); closed = new Uint32Array(n); generation = 0;
}
function push(i: number, f: number) {
  if (heapN === heapI.length) {
    const ni = new Int32Array(heapI.length * 2); ni.set(heapI); heapI = ni;
    const nf = new Float32Array(heapF.length * 2); nf.set(heapF); heapF = nf;
  }
  let k = heapN++;
  while (k > 0) { const p = (k - 1) >> 1; if (heapF[p] <= f) break; heapI[k] = heapI[p]; heapF[k] = heapF[p]; k = p; }
  heapI[k] = i; heapF[k] = f;
}
function pop(): number {
  const top = heapI[0], lastI = heapI[--heapN], lastF = heapF[heapN];
  let k = 0;
  for (;;) {
    let c = 2 * k + 1;
    if (c >= heapN) break;
    if (c + 1 < heapN && heapF[c + 1] < heapF[c]) c++;
    if (heapF[c] >= lastF) break;
    heapI[k] = heapI[c]; heapF[k] = heapF[c]; k = c;
  }
  heapI[k] = lastI; heapF[k] = lastF;
  return top;
}
const NB_DC = [1, -1, 0, 0, 1, 1, -1, -1];
const NB_DR = [0, 0, 1, -1, 1, -1, 1, -1];

function nearestOpen(M: Mask, p: Vec2, maxCells: number): number {
  const g = M.grid, c0 = Math.floor((p.x - g.minX) / g.cell), r0 = Math.floor((p.z - g.minZ) / g.cell);
  let best = -1, bestD = Infinity;
  for (let k = 0; k <= maxCells; k++) {
    for (let dr = -k; dr <= k; dr++) {
      for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== k) continue;
        const c = c0 + dc, r = r0 + dr;
        if (!openCell(M, c, r)) continue;
        const d = (g.minX + (c + 0.5) * g.cell - p.x) ** 2 + (g.minZ + (r + 0.5) * g.cell - p.z) ** 2;
        if (d < bestD) { bestD = d; best = r * g.cols + c; }
      }
    }
    if (best >= 0 && (k + 1) * g.cell > Math.sqrt(bestD)) break;
  }
  return best;
}

function maskLine(M: Mask, a: Vec2, b: Vec2): boolean {
  const g = M.grid, dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), steps = Math.max(1, Math.ceil(L / (g.cell * 0.3)));
  let pc = Math.floor((a.x - g.minX) / g.cell), pr = Math.floor((a.z - g.minZ) / g.cell);
  if (!openCell(M, pc, pr)) return false;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, c = Math.floor((a.x + dx * t - g.minX) / g.cell), r = Math.floor((a.z + dz * t - g.minZ) / g.cell);
    if (c === pc && r === pr) continue;
    if (!openCell(M, c, r)) return false;
    if (c !== pc && r !== pr && (!openCell(M, c, pr) || !openCell(M, pc, r))) return false;
    pc = c; pr = r;
  }
  return true;
}

export interface DrivePathResult {
  /** waypoints after the start */
  points: Vec2[];
  /** the goal moved (snapped to the drive mask, or the search stopped at the reachable cell closest to it) */
  snapped: boolean;
  expanded: number;
}

/**
 * Grid A* for a vehicle from → to on the nav grid under both (district grid, or the city window when both fit in it;
 * null otherwise). The goal snaps to the nearest open cell within snapRadius; when it cannot be reached the path ends
 * at the reachable cell closest to it (snapped) if that is within 12 u of it, else null.
 */
export function findDrivePath(from: Vec2, to: Vec2, kind: DriveKind, snapRadius = 6): DrivePathResult | null {
  const g = navWindowFor(from, to);
  if (cityTerrain() && (!navInside(g, from, 2) || !navInside(g, to, 2))) return null;
  const M = maskFor(g, kind);
  ensure(g.cols * g.rows);
  const start = nearestOpen(M, from, 4);
  const goal = nearestOpen(M, to, Math.ceil(snapRadius / g.cell));
  if (start < 0 || goal < 0) return null;
  const cx = (i: number) => g.minX + ((i % g.cols) + 0.5) * g.cell, cz = (i: number) => g.minZ + (((i / g.cols) | 0) + 0.5) * g.cell;
  const goalOn = Math.abs(cx(goal) - to.x) <= g.cell && Math.abs(cz(goal) - to.z) <= g.cell;
  if (start === goal) return { points: [goalOn ? { x: to.x, z: to.z } : { x: cx(goal), z: cz(goal) }], snapped: !goalOn, expanded: 0 };
  generation = (generation + 1) >>> 0;
  if (generation === 0) { seen.fill(0); closed.fill(0); generation = 1; }
  const gen = generation, rule = RULES[kind], heights = g.heights;
  const gc = goal % g.cols, gr = (goal / g.cols) | 0;
  const h = (c: number, r: number) => { const dc = Math.abs(c - gc), dr = Math.abs(r - gr); return (dc + dr + (SQRT2 - 2) * Math.min(dc, dr)) * g.cell; };
  heapN = 0;
  gScore[start] = 0; parent[start] = -1; seen[start] = gen;
  push(start, h(start % g.cols, (start / g.cols) | 0));
  let expanded = 0, found = false, best = start, bestH = Infinity;
  while (heapN > 0) {
    const cur = pop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
    if (cur === goal) { found = true; break; }
    if (++expanded > MAX_EXPANSIONS) break;
    const c = cur % g.cols, r = (cur / g.cols) | 0, hc = h(c, r);
    if (hc < bestH) { bestH = hc; best = cur; }
    const g0 = gScore[cur], h0 = heights[cur];
    for (let k = 0; k < 8; k++) {
      const nc = c + NB_DC[k], nr = r + NB_DR[k];
      if (!openCell(M, nc, nr)) continue;
      if (k >= 4 && (!openCell(M, nc, r) || !openCell(M, c, nr))) continue;
      const ni = nr * g.cols + nc;
      if (closed[ni] === gen) continue;
      const f = factorAt(rule, g.minX + (nc + 0.5) * g.cell, g.minZ + (nr + 0.5) * g.cell) || 1;
      const ng = g0 + ((k >= 4 ? SQRT2 : 1) * g.cell) / f + Math.abs(heights[ni] - h0) * 1.5;
      if (seen[ni] === gen && ng >= gScore[ni]) continue;
      seen[ni] = gen; gScore[ni] = ng; parent[ni] = cur;
      push(ni, ng + h(nc, nr));
    }
  }
  let end = goal, partial = false;
  if (!found) {
    if (best === start || bestH > 12) return null;
    end = best; partial = true;
  }
  const cells: Vec2[] = [];
  for (let i = end; i >= 0; i = parent[i]) cells.push({ x: cx(i), z: cz(i) });
  cells.reverse();
  if (!partial && goalOn && maskLine(M, cells[cells.length - 1], to)) cells[cells.length - 1] = { x: to.x, z: to.z };
  // string pulling with the drive line of sight
  const out: Vec2[] = [];
  let anchor: Vec2 = maskLine(M, from, cells[0]) ? from : cells[0];
  for (let i = 1; i < cells.length; i++) {
    if (!maskLine(M, anchor, cells[i])) { const corner = cells[i - 1]; if (corner !== anchor) { out.push(corner); anchor = corner; } }
  }
  out.push(cells[cells.length - 1]);
  return { points: out, snapped: partial || !goalOn, expanded };
}

// ---------------------------------------------------------------------------
// Graph routes (city mode)
// ---------------------------------------------------------------------------

const COMPS = new WeakMap<WalkGraphIndex, Partial<Record<DriveKind, { comp: Int32Array; main: number }>>>();
/** Connected drive networks per vehicle kind (−1 = the node has no edge that vehicle may use). Labelled once. */
export function driveComponents(ix: WalkGraphIndex, kind: DriveKind): { comp: Int32Array; main: number } {
  let per = COMPS.get(ix);
  if (!per) COMPS.set(ix, (per = {}));
  const hit = per[kind];
  if (hit) return hit;
  const { offsets, targets, kind: ek } = ix.graph, n = ix.nodeCount, ok = DRIVE_EDGES[kind];
  const comp = new Int32Array(n).fill(-1), stack = new Int32Array(n), sizes: number[] = [];
  for (let s = 0; s < n; s++) {
    if (comp[s] >= 0) continue;
    let has = false;
    for (let e = offsets[s]; e < offsets[s + 1] && !has; e++) has = ok.includes(ek[e]);
    if (!has) continue;
    const id = sizes.length;
    let top = 0, size = 0;
    stack[top++] = s; comp[s] = id;
    while (top) {
      const u = stack[--top];
      size++;
      for (let e = offsets[u]; e < offsets[u + 1]; e++) {
        if (!ok.includes(ek[e])) continue;
        const v = targets[e];
        if (comp[v] < 0) { comp[v] = id; stack[top++] = v; }
      }
    }
    sizes.push(size);
  }
  let main = 0;
  for (let c = 1; c < sizes.length; c++) if (sizes[c] > sizes[main]) main = c;
  return (per[kind] = { comp, main });
}

/** Edge filter for a vehicle kind (core/walkGraph RouteSearchOptions.edgeAccept). */
export function driveEdgeAccept(ix: WalkGraphIndex, kind: DriveKind): (e: number) => boolean {
  const ek = ix.graph.kind, ok = DRIVE_EDGES[kind];
  return e => ok.includes(ek[e]);
}

export interface EdgeSnap { u: number; v: number; x: number; z: number; d: number }
/** longest graph edge in the published data is 44.6 u; nodes this much farther than maxDist can still own a close edge */
const EDGE_REACH = 48;

/** Nearest drivable edge (both nodes pass nodeOk, in component `comp` when ≥ 0) within maxDist, with the projection. */
export function nearestDriveEdge(ix: WalkGraphIndex, p: Vec2, maxDist: number, kind: DriveKind, nodeOk: (i: number) => boolean, comp: number): EdgeSnap | null {
  const { offsets, targets, kind: ek } = ix.graph, ok = DRIVE_EDGES[kind], comps = driveComponents(ix, kind).comp;
  let best: EdgeSnap | null = null;
  ix.forNodesNear(p.x, p.z, maxDist + EDGE_REACH, u => {
    if (comps[u] < 0 || (comp >= 0 && comps[u] !== comp) || !nodeOk(u)) return;
    const ax = ix.x(u), az = ix.z(u);
    for (let e = offsets[u]; e < offsets[u + 1]; e++) {
      const v = targets[e];
      if (!ok.includes(ek[e]) || !nodeOk(v)) continue;
      const bx = ix.x(v), bz = ix.z(v), dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / L2));
      const x = ax + dx * t, z = az + dz * t, d = Math.hypot(p.x - x, p.z - z);
      if (d <= maxDist && (!best || d < best.d)) best = { u, v, x, z, d };
    }
  });
  return best;
}

export interface DriveRoute {
  /** from, …, the goal actually driven to */
  points: Vec2[];
  length: number;
  via: 'grid' | 'graph';
  /** graph nodes used, in order (graph routes) */
  nodes: number[];
  /** the goal moved to the nearest drivable / reachable spot */
  snapped: boolean;
}

function dedupe(pts: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(p.x - q.x, p.z - q.z) > 0.3) out.push({ x: p.x, z: p.z }); }
  return out;
}

/** The stretch a → b: straight when drivable, else a grid route (else straight, and the autopilot copes). */
function connector(a: Vec2, b: Vec2, kind: DriveKind): Vec2[] {
  if (driveLineClear(a, b, kind)) return [b];
  const p = findDrivePath(a, b, kind, 3);
  return p && !p.snapped ? p.points : [b];
}

/**
 * A drive route for `kind` from → to (plan §6.4, E2-3). District mode: a grid route. City mode: a grid route for short
 * hops (≤ GRID_ROUTE), else the walking graph with the vehicle's edge filter (time-sliced; `opts.signal` aborts).
 * The goal snaps to the nearest drivable spot within GOAL_SNAP (a goal on ground that is still streaming in is kept).
 * Resolves null when there is no way.
 */
export async function driveRoute(from: Vec2, to: Vec2, kind: DriveKind, opts: AsyncRouteOptions & { graph?: WalkGraphIndex } = {}): Promise<DriveRoute | null> {
  const goal = drivableAt(to.x, to.z, kind) || groundPending(to.x, to.z) ? { x: to.x, z: to.z } : snapDrivable(to, kind);
  if (!goal) return null;
  const snappedGoal = Math.hypot(goal.x - to.x, goal.z - to.z) > 0.5;
  const city = cityTerrain() !== null;
  const direct = Math.hypot(goal.x - from.x, goal.z - from.z);
  if (!city || direct <= GRID_ROUTE) {
    const p = findDrivePath(from, goal, kind);
    if (p && (!city || !p.snapped)) {
      const points = dedupe([from, ...p.points]);
      return { points, length: polylineLength(points), via: 'grid', nodes: [], snapped: snappedGoal || p.snapped };
    }
    if (!city) return null;
  }
  const ix = opts.graph ?? await walkGraph();
  if (opts.signal?.aborted) return null;
  const nodeOk = graphNodeFilter(ix), { comp, main } = driveComponents(ix, kind);
  let a = nearestDriveEdge(ix, from, GRAPH_SNAP, kind, nodeOk, -1);
  let b = a ? nearestDriveEdge(ix, goal, GRAPH_SNAP, kind, nodeOk, comp[a.u]) : null;
  if (!a || !b) {
    a = nearestDriveEdge(ix, from, GRAPH_SNAP * 3, kind, nodeOk, main);
    b = a ? nearestDriveEdge(ix, goal, GRAPH_SNAP * 3, kind, nodeOk, main) : null;
  }
  if (!a || !b) return null;
  let nodes: number[] = [];
  const sameEdge = (a.u === b.u && a.v === b.v) || (a.u === b.v && a.v === b.u);
  if (!sameEdge) {
    const { findGraphPathAsync } = await import('../../core/walkGraph');
    const path = await findGraphPathAsync(ix, a.u, b.u, { ...opts, accept: nodeOk, edgeAccept: driveEdgeAccept(ix, kind) });
    if (!path) return null;
    nodes = path.nodes.slice();
    // the projections lie on their edges: never drive to the far corner and back
    if (nodes.length >= 2 && nodes[1] === a.v) nodes.shift();
    if (nodes.length >= 2 && nodes[nodes.length - 2] === b.v) nodes.pop();
  }
  const A = { x: a.x, z: a.z }, B = { x: b.x, z: b.z };
  const mid = nodes.map(i => ix.pos(i));
  const points = dedupe([from, ...connector(from, A, kind), ...mid, B, ...connector(B, goal, kind)]);
  return { points, length: polylineLength(points), via: 'graph', nodes, snapped: snappedGoal || b.d > GRAPH_SNAP };
}
