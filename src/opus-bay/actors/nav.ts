import { CHUNK } from '../core/geo';
import { buildNavGrid, canStand, cityChunkEpoch, cityTerrain, fillCityNavGrid, nearestWalkable, type CityTerrain, type NavGrid } from '../core/terrain';
import type { Vec2 } from '../core/types';
import { LEG_MAX, polylineLength, splitLegs } from '../core/polyline';
// the walking graph and world/sf/format load with the graph itself (walkGraph(), HC-1): types only here
import type { AsyncRouteOptions, WalkGraphIndex } from '../core/walkGraph';

/**
 * A* on the district nav grid (terrain.buildNavGrid, 0.75 u cells, a STAND_RADIUS disc fits in every open
 * cell), 8-neighbour without corner cutting, slope-aware step cost, then string-pulled with grid
 * line-of-sight so paths are a handful of straight legs. Allocation-free search (typed arrays + generation
 * stamps); the grid is ~190k cells of which ~11k are open, so even Ferry → Pier 39 expands only a few
 * thousand nodes.
 *
 * City mode (a city terrain is registered, plan §5.7): the same A* runs on a 384 u window (512² cells) of the city
 * + hero rasters (terrain.fillCityNavGrid), rebuilt around the query when a path leaves it, when the walker is more
 * than 96 u off its centre, or when a chunk under it attached / detached (≈ 5–10 ms). findPath keeps its signature;
 * a goal beyond the window is clamped to where the straight line leaves it (snapped), and a goal cut off from the start
 * (a sealed backyard, a courtyard) moves to the nearest cell the start can reach (connected areas are labelled once
 * per window). `arrivalSpot` places teleports / fast travel on a large open area, never in a pocket. Long routes use
 * the city walking graph (core/walkGraph): `routeTo` snaps both ends onto one connected network and returns legs of
 * ≤ 60 u that the walker refines with findPath as it reaches them (`RouteWalker`).
 */

export const NAV_CELL = 0.75;
const MAX_EXPANSIONS = 90_000;
const SQRT2 = Math.SQRT2;

let NAV: NavGrid | null = null;
/** The grid A* runs on: the district grid, or in city mode the current window (built around the last query). */
export function navGrid(): NavGrid {
  if (cityTerrain()) return cityWindow(WIN_FOCUS);
  return (NAV ??= buildNavGrid(NAV_CELL));
}

// --- city window ---------------------------------------------------------------------------------------------------

/** window edge (u) and the off-centre distance that re-centres it */
export const NAV_WINDOW = 384;
export const NAV_RECENTRE = 96;
const WIN_N = Math.round(NAV_WINDOW / NAV_CELL);
/** window origins snap to this lattice (a multiple of both the 0.5 u rasters and the 0.75 u nav cells) */
const WIN_SNAP = 1.5;
let WIN: NavGrid | null = null;
let WIN_CITY: CityTerrain | null = null;
let WIN_BUILT = 0;
let WIN_FOCUS: Vec2 = { x: 0, z: 0 };
/** window rebuilds so far and the last rebuild time (ms), for QA */
export const navWindowStats = { builds: 0, lastMs: 0 };

function winCentre(g: NavGrid): Vec2 { return { x: g.minX + (g.cols * g.cell) / 2, z: g.minZ + (g.rows * g.cell) / 2 }; }
function winInside(g: NavGrid, p: Vec2, margin: number): boolean {
  return p.x >= g.minX + margin && p.z >= g.minZ + margin && p.x <= g.minX + g.cols * g.cell - margin && p.z <= g.minZ + g.rows * g.cell - margin;
}
/** newest chunk-change epoch under the window */
function windowEpoch(g: NavGrid): number {
  let e = 0;
  const cx0 = Math.floor(g.minX / CHUNK), cx1 = Math.floor((g.minX + g.cols * g.cell) / CHUNK);
  const cz0 = Math.floor(g.minZ / CHUNK), cz1 = Math.floor((g.minZ + g.rows * g.cell) / CHUNK);
  for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) e = Math.max(e, cityChunkEpoch(cx, cz));
  return e;
}
const winStale = (g: NavGrid) => WIN_CITY !== cityTerrain() || windowEpoch(g) > WIN_BUILT;

function buildWindow(centre: Vec2): NavGrid {
  const t0 = performance.now();
  const half = (WIN_N * NAV_CELL) / 2;
  const minX = Math.floor((centre.x - half) / WIN_SNAP) * WIN_SNAP, minZ = Math.floor((centre.z - half) / WIN_SNAP) * WIN_SNAP;
  const walkable = WIN?.walkable ?? new Uint8Array(WIN_N * WIN_N), heights = WIN?.heights ?? new Float32Array(WIN_N * WIN_N);
  const g: NavGrid = { cell: NAV_CELL, minX, minZ, cols: WIN_N, rows: WIN_N, walkable, heights };
  fillCityNavGrid(g);
  WIN = g; WIN_CITY = cityTerrain(); WIN_BUILT = windowEpoch(g);
  navWindowStats.builds++; navWindowStats.lastMs = performance.now() - t0;
  return g;
}

/** The city window covering a (and b when given), rebuilt when needed. */
function cityWindow(a: Vec2, b?: Vec2): NavGrid {
  WIN_FOCUS = { x: a.x, z: a.z };
  const g = WIN;
  if (g && !winStale(g) && winInside(g, a, 4)) {
    if (!b) return g;
    const c = winCentre(g);
    if (winInside(g, b, 4) && Math.hypot(a.x - c.x, a.z - c.z) <= NAV_RECENTRE) return g;
  }
  let c = a;
  if (b) {
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), reach = NAV_WINDOW / 2 - 16;
    c = L <= 2 * reach ? { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 } : { x: a.x + (dx / L) * reach, z: a.z + (dz / L) * reach };
  }
  return buildWindow(c);
}

/** Optional hint (city mode): the next lineOfSight / navOpen / navGrid call builds its window around this point. */
export function setNavFocus(p: Vec2): void { WIN_FOCUS = { x: p.x, z: p.z }; }

/**
 * The grid a search from a (toward b) runs on: the district grid, or in city mode the window covering a (and b when it
 * fits), rebuilt when needed — the same window findPath(a, b) would use (actors/vehicles/driveRoute's drive grid).
 */
export function navWindowFor(a: Vec2, b?: Vec2): NavGrid {
  return cityTerrain() ? cityWindow(a, b) : navGrid();
}
/** True when p lies inside grid g with `margin` u to spare. */
export function navInside(g: NavGrid, p: Vec2, margin = 1): boolean { return winInside(g, p, margin); }

const col = (g: NavGrid, x: number) => Math.floor((x - g.minX) / g.cell);
const row = (g: NavGrid, z: number) => Math.floor((z - g.minZ) / g.cell);
const cx = (g: NavGrid, c: number) => g.minX + (c + 0.5) * g.cell;
const cz = (g: NavGrid, r: number) => g.minZ + (r + 0.5) * g.cell;

function open(g: NavGrid, c: number, r: number): boolean {
  return c >= 0 && r >= 0 && c < g.cols && r < g.rows && g.walkable[r * g.cols + c] === 1;
}

/** True if (x, z) lies in an open nav cell. */
export function navOpen(x: number, z: number): boolean {
  const g = navGrid();
  return open(g, col(g, x), row(g, z));
}

/** Nearest open cell index to p within `maxCells` rings (−1 if none). */
function nearestOpenCell(g: NavGrid, p: Vec2, maxCells: number): number {
  const c0 = col(g, p.x), r0 = row(g, p.z);
  if (open(g, c0, r0)) return r0 * g.cols + c0;
  let best = -1, bestD = Infinity;
  for (let k = 1; k <= maxCells; k++) {
    for (let dr = -k; dr <= k; dr++) {
      for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== k) continue;
        const c = c0 + dc, r = r0 + dr;
        if (!open(g, c, r)) continue;
        const d = (cx(g, c) - p.x) ** 2 + (cz(g, r) - p.z) ** 2;
        if (d < bestD) { bestD = d; best = r * g.cols + c; }
      }
    }
    if (best >= 0 && (k + 1) * g.cell > Math.sqrt(bestD)) break;
  }
  return best;
}

// --- connected areas of the city window (labelled lazily, once per window build) ------------------------------------

let LABELS: { of: NavGrid | null; label: Int32Array; size: number[] } = { of: null, label: new Int32Array(0), size: [0] };
/**
 * 4-connected components of the open cells (the A* moves diagonally only between two open orthogonal cells, so this is
 * exactly what it can reach). label 0 = blocked; size[label] = cells. ≈ 3–6 ms for the 512² window.
 */
function windowLabels(g: NavGrid): { label: Int32Array; size: number[] } {
  if (LABELS.of === g) return LABELS;
  const n = g.cols * g.rows, label = LABELS.label.length === n ? LABELS.label.fill(0) : new Int32Array(n), size = [0];
  const stack = new Int32Array(n), w = g.walkable, cols = g.cols;
  for (let s = 0; s < n; s++) {
    if (label[s] || w[s] !== 1) continue;
    const id = size.length;
    let top = 0, count = 0;
    stack[top++] = s; label[s] = id;
    while (top) {
      const u = stack[--top], c = u % cols;
      count++;
      if (c > 0 && !label[u - 1] && w[u - 1] === 1) { label[u - 1] = id; stack[top++] = u - 1; }
      if (c < cols - 1 && !label[u + 1] && w[u + 1] === 1) { label[u + 1] = id; stack[top++] = u + 1; }
      if (u >= cols && !label[u - cols] && w[u - cols] === 1) { label[u - cols] = id; stack[top++] = u - cols; }
      if (u + cols < n && !label[u + cols] && w[u + cols] === 1) { label[u + cols] = id; stack[top++] = u + cols; }
    }
    size.push(count);
  }
  LABELS = { of: g, label, size };
  return LABELS;
}

/** Nearest cell to p (within maxCells rings) whose label passes `ok` (−1 if none). */
function nearestLabelled(g: NavGrid, label: Int32Array, p: Vec2, maxCells: number, ok: (l: number) => boolean): number {
  const c0 = col(g, p.x), r0 = row(g, p.z);
  let best = -1, bestD = Infinity;
  for (let k = 0; k <= maxCells; k++) {
    for (let dr = -k; dr <= k; dr++) {
      for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== k) continue;
        const c = c0 + dc, r = r0 + dr;
        if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) continue;
        const l = label[r * g.cols + c];
        if (!l || !ok(l)) continue;
        const d = (cx(g, c) - p.x) ** 2 + (cz(g, r) - p.z) ** 2;
        if (d < bestD) { bestD = d; best = r * g.cols + c; }
      }
    }
    if (best >= 0 && (k + 1) * g.cell > Math.sqrt(bestD)) break;
  }
  return best;
}
const nearestInComponent = (g: NavGrid, label: Int32Array, p: Vec2, id: number, maxCells: number) => nearestLabelled(g, label, p, maxCells, l => l === id);

/** open areas smaller than this (cells of 0.75 u, ≈ 630 u²) are pockets — backyards, courtyards — not arrival spots */
export const MIN_OPEN_AREA = 1120;

/**
 * Where to put a walker that arrives at p (teleport, fast travel, a place's arrival point): the nearest standable spot
 * within maxDist that belongs to a large open area, never a sealed backyard pocket. District mode: nearestWalkable.
 */
export function arrivalSpot(p: Vec2, maxDist = 30): Vec2 | null {
  if (!cityTerrain()) return nearestWalkable(p, maxDist);
  const g = cityWindow(p), { label, size } = windowLabels(g);
  const i = nearestLabelled(g, label, p, Math.ceil(maxDist / g.cell), l => size[l] >= MIN_OPEN_AREA);
  return i < 0 ? null : { x: cx(g, i % g.cols), z: cz(g, (i / g.cols) | 0) };
}

/**
 * Grid line of sight: every sample along a→b (step ≈ 0.3 cell) must be an open cell, with no diagonal
 * squeeze between two blocked cells. Cheap enough to call a few hundred times per path.
 */
export function lineOfSight(a: Vec2, b: Vec2): boolean {
  const g = navGrid();
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(L / (g.cell * 0.3)));
  let pc = col(g, a.x), pr = row(g, a.z);
  if (!open(g, pc, pr)) return false;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const c = col(g, a.x + dx * t), r = row(g, a.z + dz * t);
    if (c === pc && r === pr) continue;
    if (!open(g, c, r)) return false;
    if (c !== pc && r !== pr && (!open(g, c, pr) || !open(g, pc, r))) return false;
    pc = c; pr = r;
  }
  return true;
}

// --- search buffers (grown to the grid once) --------------------------------------------------------------

let gScore = new Float32Array(0);
let parent = new Int32Array(0);
let seen = new Uint32Array(0);
let closed = new Uint32Array(0);
let generation = 0;
let heapIdx = new Int32Array(1024);
let heapF = new Float32Array(1024);
let heapSize = 0;

function ensureBuffers(n: number) {
  if (gScore.length === n) return;
  gScore = new Float32Array(n);
  parent = new Int32Array(n);
  seen = new Uint32Array(n);
  closed = new Uint32Array(n);
  generation = 0;
}

function heapPush(i: number, f: number) {
  if (heapSize === heapIdx.length) {
    const ni = new Int32Array(heapIdx.length * 2); ni.set(heapIdx); heapIdx = ni;
    const nf = new Float32Array(heapF.length * 2); nf.set(heapF); heapF = nf;
  }
  let k = heapSize++;
  while (k > 0) {
    const p = (k - 1) >> 1;
    if (heapF[p] <= f) break;
    heapIdx[k] = heapIdx[p]; heapF[k] = heapF[p]; k = p;
  }
  heapIdx[k] = i; heapF[k] = f;
}

function heapPop(): number {
  const top = heapIdx[0];
  const lastI = heapIdx[--heapSize], lastF = heapF[heapSize];
  let k = 0;
  for (;;) {
    let c = 2 * k + 1;
    if (c >= heapSize) break;
    if (c + 1 < heapSize && heapF[c + 1] < heapF[c]) c++;
    if (heapF[c] >= lastF) break;
    heapIdx[k] = heapIdx[c]; heapF[k] = heapF[c]; k = c;
  }
  heapIdx[k] = lastI; heapF[k] = lastF;
  return top;
}

const NB_DC = [1, -1, 0, 0, 1, 1, -1, -1];
const NB_DR = [0, 0, 1, -1, 1, -1, 1, -1];

export interface PathResult {
  /** waypoints after the start (the last one is the goal actually reached) */
  points: Vec2[];
  /** true when the goal had to be moved to the nearest reachable spot */
  snapped: boolean;
  expanded: number;
}

/**
 * Shortest walkable path from → to. The goal snaps to the nearest open cell (within `snapRadius` u) when it
 * is inside a blocker / off the walkable area. Returns null when unreachable.
 */
export function findPath(from: Vec2, to: Vec2, snapRadius = 8): PathResult | null {
  const city = cityTerrain() !== null;
  const g = city ? cityWindow(from, to) : navGrid();
  let clamped = false;
  if (city && !winInside(g, to, 1)) {
    // goal beyond the window: aim for the point where the straight line leaves it
    const m = 2, x0 = g.minX + m, z0 = g.minZ + m, x1 = g.minX + g.cols * g.cell - m, z1 = g.minZ + g.rows * g.cell - m;
    const dx = to.x - from.x, dz = to.z - from.z;
    let t = 1;
    if (dx > 0) t = Math.min(t, (x1 - from.x) / dx); else if (dx < 0) t = Math.min(t, (x0 - from.x) / dx);
    if (dz > 0) t = Math.min(t, (z1 - from.z) / dz); else if (dz < 0) t = Math.min(t, (z0 - from.z) / dz);
    to = { x: from.x + dx * Math.max(0, t), z: from.z + dz * Math.max(0, t) };
    clamped = true;
  }
  const n = g.cols * g.rows;
  ensureBuffers(n);
  const start = nearestOpenCell(g, from, 6);
  let goal = nearestOpenCell(g, to, Math.ceil(snapRadius / g.cell));
  if (goal < 0) {
    const alt = nearestWalkable(to, snapRadius + (clamped ? 24 : 0));
    if (alt) goal = nearestOpenCell(g, alt, 3);
  }
  // city mode: a goal cut off from the start (a backyard pocket, a courtyard, across a fenced freeway) moves to the
  // nearest cell the start can reach, within the snap radius — instead of exhausting the search
  if (city && start >= 0 && goal >= 0) {
    const lab = windowLabels(g).label;
    if (lab[goal] !== lab[start]) goal = nearestInComponent(g, lab, to, lab[start], Math.ceil((snapRadius + (clamped ? 24 : 0)) / g.cell));
    if (goal < 0 && !clamped) return null;
  }
  // city mode, goal clamped to the window but nothing open near it (not resident yet / off the walkable area):
  // search toward it and stop at the closest reachable cell
  const partial = clamped && start >= 0 && goal < 0;
  if (partial) goal = Math.min(g.rows - 1, Math.max(0, row(g, to.z))) * g.cols + Math.min(g.cols - 1, Math.max(0, col(g, to.x)));
  if (start < 0 || goal < 0) return null;
  const goalC = goal % g.cols, goalR = (goal / g.cols) | 0;
  const goalOnTarget = !partial && Math.abs(cx(g, goalC) - to.x) <= g.cell && Math.abs(cz(g, goalR) - to.z) <= g.cell;
  if (start === goal) return { points: [goalOnTarget ? { x: to.x, z: to.z } : { x: cx(g, goalC), z: cz(g, goalR) }], snapped: clamped || !goalOnTarget, expanded: 0 };

  generation = (generation + 1) >>> 0;
  if (generation === 0) { seen.fill(0); closed.fill(0); generation = 1; }
  const gen = generation;
  heapSize = 0;
  const h = (c: number, r: number) => {
    const dc = Math.abs(c - goalC), dr = Math.abs(r - goalR);
    return (dc + dr + (SQRT2 - 2) * Math.min(dc, dr)) * g.cell;
  };
  const sc = start % g.cols, sr = (start / g.cols) | 0;
  gScore[start] = 0; parent[start] = -1; seen[start] = gen;
  heapPush(start, h(sc, sr));
  let expanded = 0;
  let found = false;
  let best = -1, bestH = Infinity;
  const heights = g.heights;
  while (heapSize > 0) {
    const cur = heapPop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
    if (cur === goal) { found = true; break; }
    if (++expanded > MAX_EXPANSIONS) break;
    const c = cur % g.cols, r = (cur / g.cols) | 0;
    if (partial) { const hc = h(c, r); if (hc < bestH) { bestH = hc; best = cur; } }
    const g0 = gScore[cur], h0 = heights[cur];
    for (let k = 0; k < 8; k++) {
      const nc = c + NB_DC[k], nr = r + NB_DR[k];
      if (!open(g, nc, nr)) continue;
      if (k >= 4 && (!open(g, nc, r) || !open(g, c, nr))) continue; // no corner cutting
      const ni = nr * g.cols + nc;
      if (closed[ni] === gen) continue;
      const dh = Math.abs(heights[ni] - h0);
      const step = (k >= 4 ? SQRT2 : 1) * g.cell + dh * 1.5;
      const ng = g0 + step;
      if (seen[ni] === gen && ng >= gScore[ni]) continue;
      seen[ni] = gen; gScore[ni] = ng; parent[ni] = cur;
      heapPush(ni, ng + h(nc, nr));
    }
  }
  if (!found) {
    if (!partial || best < 0 || best === start) return null;
    goal = best;
  }

  // cells goal → start
  const cells: Vec2[] = [];
  for (let i = goal; i >= 0; i = parent[i]) cells.push({ x: cx(g, i % g.cols), z: cz(g, (i / g.cols) | 0) });
  cells.reverse();
  if (goalOnTarget && lineOfSight(cells[cells.length - 1], to)) cells[cells.length - 1] = { x: to.x, z: to.z };
  return { points: stringPull(from, cells), snapped: clamped || !goalOnTarget, expanded };
}

/** Greedy string pulling: keep a corner only where the straight line from the last kept point is blocked. */
export function stringPull(from: Vec2, cells: Vec2[]): Vec2[] {
  if (cells.length === 0) return [];
  const out: Vec2[] = [];
  let anchor: Vec2 = navOpen(from.x, from.z) ? from : cells[0];
  for (let i = 1; i < cells.length; i++) {
    if (!lineOfSight(anchor, cells[i])) {
      const corner = cells[i - 1];
      if (corner !== anchor) { out.push(corner); anchor = corner; }
    }
  }
  out.push(cells[cells.length - 1]);
  return out;
}

/** Remaining length of a path from p. */
export function pathLength(p: Vec2, points: Vec2[], from = 0): number {
  let L = 0, prev = p;
  for (let i = from; i < points.length; i++) { L += Math.hypot(points[i].x - prev.x, points[i].z - prev.z); prev = points[i]; }
  return L;
}

// ---------------------------------------------------------------------------
// Long routes (city mode): walking graph → legs → local refinement
// ---------------------------------------------------------------------------

/** routes up to this straight-line length try the local grid first (u) */
export const LOCAL_ROUTE = 150;
/** snap radius from a point to the walking graph (u) */
export const GRAPH_SNAP = 60;

export interface Route {
  /** the whole route as a polyline: from, the graph nodes, to (local routes: from + grid waypoints) */
  points: Vec2[];
  /** consecutive legs of ≤ LEG_MAX u; walk each with findPath as you reach it (RouteWalker does) */
  legs: Vec2[][];
  length: number;
  via: 'local' | 'graph';
  /** the goal had to move to the nearest reachable spot */
  snapped: boolean;
}

let GRAPH: Promise<WalkGraphIndex> | null = null;
/** Use this walking graph (or a promise of it); null resets to lazy loading of the published graph.obc. */
export function setWalkGraph(g: WalkGraphIndex | Promise<WalkGraphIndex> | null): void {
  GRAPH = g ? Promise.resolve(g) : null;
}
/** The walking graph, loaded on first use (current.json → manifest → graph.obc), with its code (a lazy chunk). */
export function walkGraph(): Promise<WalkGraphIndex> {
  if (!GRAPH) {
    const p = import('../core/walkGraph').then(m => m.loadWalkGraph());
    GRAPH = p;
    p.catch(() => { if (GRAPH === p) GRAPH = null; });
  }
  return GRAPH;
}

/** A* cost multiplier for hero graph nodes the walker cannot stand on (the Embarcadero roadway: walk beside it). */
export const HERO_BARRIER_COST = 4;
const USABLE = new WeakMap<WalkGraphIndex, { city: CityTerrain | null; ok: Int8Array }>();
function usable(ix: WalkGraphIndex): (node: number) => boolean {
  const city = cityTerrain();
  let c = USABLE.get(ix);
  if (!c || c.city !== city) { c = { city, ok: new Int8Array(ix.nodeCount) }; USABLE.set(ix, c); }
  const ok = c.ok;
  return (i: number) => {
    if (!ix.isHero(i)) return true;
    if (!ok[i]) { const p = ix.pos(i); ok[i] = canStand(p.x, p.z, 0.45) || nearestWalkable(p, 1.5) !== null ? 1 : -1; }
    return ok[i] > 0;
  };
}
/**
 * Graph nodes a route may start / end on: every city node, and hero-flagged nodes (real streets inside the hero slab)
 * only where the terrain lets a walker stand within 1.5 u (the Embarcadero roadway is a barrier; the hero's inland
 * streets are walkable in city mode).
 */
export function graphNodeFilter(ix: WalkGraphIndex): (node: number) => boolean { return usable(ix); }
/** Cost multiplier per node for routing: HERO_BARRIER_COST on hero nodes that are not usable, else 1. */
export function graphNodeCost(ix: WalkGraphIndex): (node: number) => number {
  const ok = usable(ix);
  return (i: number) => (ok(i) ? 1 : HERO_BARRIER_COST);
}

function localRoute(from: Vec2, to: Vec2): Route | null {
  const p = findPath(from, to, 12);
  if (!p) return null;
  const points = [{ x: from.x, z: from.z }, ...p.points];
  return { points, legs: splitLegs(points, LEG_MAX), length: polylineLength(points), via: 'local', snapped: p.snapped };
}

/**
 * A walking route from → to for the map ("带我去") and BAYBAY. District mode, or a short hop the local grid can
 * finish → one grid path; otherwise the nearest usable graph nodes (≤ 60 u), time-sliced A* on the walking graph
 * (≤ opts.budgetMs per slice, default 2 ms per frame), then legs of ≤ 60 u. Resolves null when no route exists.
 */
export async function routeTo(from: Vec2, to: Vec2, opts: AsyncRouteOptions & { graph?: WalkGraphIndex } = {}): Promise<Route | null> {
  const direct = Math.hypot(to.x - from.x, to.z - from.z);
  if (!cityTerrain()) return localRoute(from, to);
  if (direct <= LOCAL_ROUTE) {
    const r = localRoute(from, to);
    if (r && !r.snapped) return r;
  }
  const ix = opts.graph ?? await walkGraph();
  const accept = graphNodeFilter(ix);
  // both ends on one connected network: the start's own, else the main street network with a wider snap (the stretch
  // from a park-trail network to its nearest street is walked locally, leg by leg)
  let a = ix.nearestNode(from.x, from.z, GRAPH_SNAP, accept), b = -1;
  if (a >= 0) { const ca = ix.component(a); b = ix.nearestNode(to.x, to.z, GRAPH_SNAP, i => accept(i) && ix.component(i) === ca); }
  if (b < 0) {
    const main = ix.mainComponent(), inMain = (i: number) => accept(i) && ix.component(i) === main;
    a = ix.nearestNode(from.x, from.z, GRAPH_SNAP * 3, inMain); b = ix.nearestNode(to.x, to.z, GRAPH_SNAP * 3, inMain);
  }
  if (a < 0 || b < 0) return direct <= LOCAL_ROUTE ? localRoute(from, to) : null;
  const { findGraphPathAsync } = await import('../core/walkGraph');
  const path = await findGraphPathAsync(ix, a, b, { nodeCost: graphNodeCost(ix), ...opts });
  if (!path) return null;
  const points: Vec2[] = [{ x: from.x, z: from.z }];
  for (const p of [...path.points, to]) {
    const q = points[points.length - 1];
    if (Math.hypot(p.x - q.x, p.z - q.z) > 0.3) points.push({ x: p.x, z: p.z });
  }
  const snapped = Math.hypot(ix.x(b) - to.x, ix.z(b) - to.z) > GRAPH_SNAP;
  return { points, legs: splitLegs(points, LEG_MAX), length: polylineLength(points), via: 'graph', snapped };
}

/**
 * Follows a Route leg by leg: `update(pos)` returns local grid waypoints toward the end of the current leg (refined
 * with findPath when a leg starts; the leg's own points if the grid finds nothing), or null once the goal is reached.
 */
export class RouteWalker {
  readonly route: Route;
  leg = 0;
  private path: Vec2[] | null = null;
  private pathLeg = -1;
  constructor(route: Route) { this.route = route; }

  /** end of the current leg (null when done) */
  target(): Vec2 | null {
    const l = this.route.legs[this.leg];
    return l ? l[l.length - 1] : null;
  }

  /**
   * `finalReach` (default = reach) is how close the walker must come to the route's own end before it counts as done
   * (a walker wants its goal within a step, not 3 u short of it).
   */
  update(pos: Vec2, reach = 3, finalReach = reach): Vec2[] | null {
    const legs = this.route.legs;
    while (this.leg < legs.length) {
      const end = legs[this.leg][legs[this.leg].length - 1];
      if (Math.hypot(end.x - pos.x, end.z - pos.z) > (this.leg === legs.length - 1 ? finalReach : reach)) break;
      this.leg++;
    }
    if (this.leg >= legs.length) return null;
    if (this.pathLeg !== this.leg || !this.path) this.refine(pos);
    return this.path;
  }

  /** Re-plan the current leg from pos (the walker stalled on it). */
  replan(pos: Vec2): Vec2[] | null {
    if (this.leg >= this.route.legs.length) return null;
    this.refine(pos);
    return this.path;
  }

  /** the current leg is the route's last one */
  get lastLeg(): boolean { return this.leg >= this.route.legs.length - 1; }

  /** Remaining route length from pos: to the current leg's end, then the later legs (u). */
  remaining(pos: Vec2): number {
    const legs = this.route.legs;
    if (this.leg >= legs.length) return 0;
    const cur = legs[this.leg], end = cur[cur.length - 1];
    let L = Math.hypot(end.x - pos.x, end.z - pos.z);
    for (let i = this.leg + 1; i < legs.length; i++) L += polylineLength(legs[i]);
    return L;
  }

  private refine(pos: Vec2) {
    const leg = this.route.legs[this.leg], end = leg[leg.length - 1];
    this.path = findPath(pos, end, 12)?.points ?? leg.slice(1);
    this.pathLeg = this.leg;
  }
}
