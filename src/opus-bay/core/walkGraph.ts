import type { Vec2 } from './types';
import { GRAPH_NODE_FLAG, decodeGraphFile, loadManifest, type WalkGraph } from '../world/sf/format';

/**
 * City-wide walking graph (plan §5.7, global level): nearest-node lookup in 32 u buckets (never a linear scan), A*
 * that can be time-sliced (≤ 2 ms per frame by default; the idea of GTA_SZ src/city-autopilot.ts, which slices its
 * A* every 2 ms — code here is our own), and leg splitting for the walker. Pure: no three.js, no DOM (timers only in
 * `findRouteAsync`'s default scheduler).
 *
 * The graph (world/sf/format WalkGraph, graph.obc) holds street centrelines, steps and park paths in CSR form, edges
 * stored both ways, costs = length × grade and stairs penalties. Nodes flagged GRAPH_NODE_FLAG.hero are real OSM
 * streets inside the hand-made hero slab; callers pass an `accept` filter so routes use only those the hero lets you
 * walk (actors/nav routeTo does).
 */

/** nearest-node bucket edge (u) */
export const NODE_BUCKET = 32;
/** longest leg a route is split into (u); each leg is refined by the local grid A* as the walker reaches it */
export const LEG_MAX = 60;
/** default time slice per frame (ms) */
export const SLICE_MS = 2;
/**
 * expansions between two clock checks in RouteSearch.step: few enough that a slice overruns its budget by little even
 * while lazy node costs are first evaluated (hero streets: 12–20 µs per expansion measured in the cloud container, so
 * the former 64 overran by up to 1.25 ms), many enough that reading the clock costs nothing
 */
export const SLICE_CHECK = 16;

export class WalkGraphIndex {
  readonly graph: WalkGraph;
  private readonly x0: number;
  private readonly z0: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly start: Uint32Array;
  private readonly items: Uint32Array;

  constructor(graph: WalkGraph) {
    this.graph = graph;
    const { xyz, nodeCount } = graph;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < nodeCount; i++) {
      const x = xyz[3 * i], z = xyz[3 * i + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    if (!nodeCount) { x0 = z0 = x1 = z1 = 0; }
    this.x0 = Math.floor(x0 / NODE_BUCKET) * NODE_BUCKET; this.z0 = Math.floor(z0 / NODE_BUCKET) * NODE_BUCKET;
    this.cols = Math.floor((x1 - this.x0) / NODE_BUCKET) + 1; this.rows = Math.floor((z1 - this.z0) / NODE_BUCKET) + 1;
    const counts = new Uint32Array(this.cols * this.rows + 1);
    const bucket = (i: number) => Math.floor((xyz[3 * i + 2] - this.z0) / NODE_BUCKET) * this.cols + Math.floor((xyz[3 * i] - this.x0) / NODE_BUCKET);
    for (let i = 0; i < nodeCount; i++) counts[bucket(i) + 1]++;
    for (let k = 1; k < counts.length; k++) counts[k] += counts[k - 1];
    this.start = counts;
    this.items = new Uint32Array(nodeCount);
    const fill = counts.slice(0, -1);
    for (let i = 0; i < nodeCount; i++) this.items[fill[bucket(i)]++] = i;
  }

  get nodeCount() { return this.graph.nodeCount; }
  x(i: number) { return this.graph.xyz[3 * i]; }
  y(i: number) { return this.graph.xyz[3 * i + 1]; }
  z(i: number) { return this.graph.xyz[3 * i + 2]; }
  pos(i: number): Vec2 { return { x: this.graph.xyz[3 * i], z: this.graph.xyz[3 * i + 2] }; }
  isHero(i: number) { return (this.graph.nodeFlags[i] & GRAPH_NODE_FLAG.hero) !== 0; }

  /** Calls fn(node, distance²) for every node within r of (x, z). */
  forNodesNear(x: number, z: number, r: number, fn: (i: number, d2: number) => void) {
    const c0 = Math.max(0, Math.floor((x - r - this.x0) / NODE_BUCKET)), c1 = Math.min(this.cols - 1, Math.floor((x + r - this.x0) / NODE_BUCKET));
    const r0 = Math.max(0, Math.floor((z - r - this.z0) / NODE_BUCKET)), r1 = Math.min(this.rows - 1, Math.floor((z + r - this.z0) / NODE_BUCKET));
    const xyz = this.graph.xyz, R2 = r * r;
    for (let br = r0; br <= r1; br++) {
      for (let bc = c0; bc <= c1; bc++) {
        const b = br * this.cols + bc;
        for (let k = this.start[b]; k < this.start[b + 1]; k++) {
          const i = this.items[k], dx = xyz[3 * i] - x, dz = xyz[3 * i + 2] - z, d2 = dx * dx + dz * dz;
          if (d2 <= R2) fn(i, d2);
        }
      }
    }
  }

  private comp: Int32Array | null = null;
  private compSize: number[] = [];
  private labelComponents(): Int32Array {
    if (this.comp) return this.comp;
    const n = this.graph.nodeCount, comp = new Int32Array(n).fill(-1), { offsets, targets } = this.graph, stack = new Int32Array(n);
    for (let s = 0; s < n; s++) {
      if (comp[s] >= 0) continue;
      const id = this.compSize.length;
      let top = 0, size = 0;
      stack[top++] = s; comp[s] = id;
      while (top) {
        const u = stack[--top];
        size++;
        for (let e = offsets[u]; e < offsets[u + 1]; e++) { const v = targets[e]; if (comp[v] < 0) { comp[v] = id; stack[top++] = v; } }
      }
      this.compSize.push(size);
    }
    return (this.comp = comp);
  }
  /** Connected component of a node (labelled on first use, ≈ 2 ms; the published graph has 8, the largest 31,658 nodes). */
  component(i: number): number { return this.labelComponents()[i]; }
  componentSize(c: number): number { this.labelComponents(); return this.compSize[c] ?? 0; }
  /** the largest component (the street network; the others are isolated park / trail networks) */
  mainComponent(): number {
    this.labelComponents();
    let best = 0;
    for (let c = 1; c < this.compSize.length; c++) if (this.compSize[c] > this.compSize[best]) best = c;
    return best;
  }

  /** Nearest node within maxDist that passes `accept` (−1 if none). Searches bucket rings outward. */
  nearestNode(x: number, z: number, maxDist = 60, accept?: (i: number) => boolean): number {
    let best = -1, bestD = Infinity;
    for (let r = Math.min(NODE_BUCKET, maxDist); ; r = Math.min(maxDist, r * 2)) {
      this.forNodesNear(x, z, r, (i, d2) => { if (d2 < bestD && (!accept || accept(i))) { bestD = d2; best = i; } });
      if (best >= 0 || r >= maxDist) return best;
    }
  }
}

export interface RouteSearchOptions {
  /** node filter; the start and goal nodes are always allowed */
  accept?: (node: number) => boolean;
  /** cost multiplier (≥ 1) for edges entering a node, e.g. streets the walker can only pass beside */
  nodeCost?: (node: number) => number;
  /** give up after this many expanded nodes (default: the whole graph) */
  maxExpansions?: number;
  /** clock (ms) the time slices are measured with (default performance.now; tests inject a work clock) */
  now?: () => number;
}

/**
 * Resumable A* between two graph nodes. `step(ms)` expands until the budget is used (the clock is read every SLICE_CHECK
 * expansions) and returns true once finished; then `nodes` holds the node path (null when unreachable).
 */
export class RouteSearch {
  readonly from: number;
  readonly to: number;
  done = false;
  nodes: number[] | null = null;
  cost = Infinity;
  expanded = 0;
  slices = 0;
  /** longest single step() call so far (ms) */
  maxSliceMs = 0;
  private readonly ix: WalkGraphIndex;
  private readonly accept?: (node: number) => boolean;
  private readonly nodeCost?: (node: number) => number;
  private readonly maxExp: number;
  private readonly now: () => number;
  private readonly gScore: Float64Array;
  private readonly parent: Int32Array;
  private readonly state: Uint8Array;
  private heapI = new Int32Array(1024);
  private heapF = new Float64Array(1024);
  private heapN = 0;

  constructor(index: WalkGraphIndex, from: number, to: number, opts: RouteSearchOptions = {}) {
    this.ix = index; this.from = from; this.to = to;
    this.accept = opts.accept;
    this.nodeCost = opts.nodeCost;
    this.maxExp = opts.maxExpansions ?? index.nodeCount;
    this.now = opts.now ?? (() => performance.now());
    const n = index.nodeCount;
    this.gScore = new Float64Array(n).fill(Infinity);
    this.parent = new Int32Array(n).fill(-1);
    this.state = new Uint8Array(n);
    if (from < 0 || to < 0 || from >= n || to >= n) { this.done = true; return; }
    this.gScore[from] = 0;
    this.push(from, this.h(from));
    this.state[from] = 1;
  }

  private h(i: number) {
    const xyz = this.ix.graph.xyz, dx = xyz[3 * i] - xyz[3 * this.to], dz = xyz[3 * i + 2] - xyz[3 * this.to + 2];
    return Math.sqrt(dx * dx + dz * dz) * 0.999;
  }
  private push(i: number, f: number) {
    if (this.heapN === this.heapI.length) {
      const ni = new Int32Array(this.heapI.length * 2); ni.set(this.heapI); this.heapI = ni;
      const nf = new Float64Array(this.heapF.length * 2); nf.set(this.heapF); this.heapF = nf;
    }
    let k = this.heapN++;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (this.heapF[p] <= f) break;
      this.heapI[k] = this.heapI[p]; this.heapF[k] = this.heapF[p]; k = p;
    }
    this.heapI[k] = i; this.heapF[k] = f;
  }
  private pop(): number {
    const top = this.heapI[0], lastI = this.heapI[--this.heapN], lastF = this.heapF[this.heapN];
    let k = 0;
    for (;;) {
      let c = 2 * k + 1;
      if (c >= this.heapN) break;
      if (c + 1 < this.heapN && this.heapF[c + 1] < this.heapF[c]) c++;
      if (this.heapF[c] >= lastF) break;
      this.heapI[k] = this.heapI[c]; this.heapF[k] = this.heapF[c]; k = c;
    }
    this.heapI[k] = lastI; this.heapF[k] = lastF;
    return top;
  }

  /** Expand for up to `budgetMs` (Infinity = run to the end). Returns true when the search is finished. */
  step(budgetMs = SLICE_MS): boolean {
    if (this.done) return true;
    const t0 = this.now();
    this.slices++;
    const { offsets, targets, cost } = this.ix.graph;
    let n = 0;
    while (this.heapN > 0) {
      const cur = this.pop();
      if (this.state[cur] === 2) continue;
      this.state[cur] = 2;
      if (cur === this.to) { this.finish(true); break; }
      if (++this.expanded > this.maxExp) { this.finish(false); break; }
      const g0 = this.gScore[cur];
      for (let e = offsets[cur]; e < offsets[cur + 1]; e++) {
        const nb = targets[e];
        if (this.state[nb] === 2) continue;
        if (this.accept && nb !== this.to && !this.accept(nb)) { this.state[nb] = 2; continue; }
        const ng = g0 + (this.nodeCost ? cost[e] * this.nodeCost(nb) : cost[e]);
        if (ng >= this.gScore[nb]) continue;
        this.gScore[nb] = ng; this.parent[nb] = cur; this.state[nb] = 1;
        this.push(nb, ng + this.h(nb));
      }
      if (++n % SLICE_CHECK === 0 && this.now() - t0 >= budgetMs) break;
    }
    if (!this.done && this.heapN === 0) this.finish(false);
    this.maxSliceMs = Math.max(this.maxSliceMs, this.now() - t0);
    return this.done;
  }

  private finish(found: boolean) {
    this.done = true;
    if (!found) return;
    this.cost = this.gScore[this.to];
    const out: number[] = [];
    for (let i = this.to; i >= 0; i = this.parent[i]) out.push(i);
    this.nodes = out.reverse();
  }
}

export interface GraphPath {
  nodes: number[];
  /** node positions (x, z) */
  points: Vec2[];
  /** walking length along the nodes (u, horizontal) */
  length: number;
  /** A* cost (u, with grade / stairs penalties) */
  cost: number;
  expanded: number;
  slices: number;
  maxSliceMs: number;
}

function toPath(ix: WalkGraphIndex, s: RouteSearch): GraphPath | null {
  if (!s.nodes) return null;
  const points = s.nodes.map(i => ix.pos(i));
  return { nodes: s.nodes, points, length: polylineLength(points), cost: s.cost, expanded: s.expanded, slices: s.slices, maxSliceMs: s.maxSliceMs };
}

/** Synchronous A* between two nodes (tests, tools, short routes). */
export function findGraphPath(ix: WalkGraphIndex, from: number, to: number, opts: RouteSearchOptions = {}): GraphPath | null {
  const s = new RouteSearch(ix, from, to, opts);
  s.step(Infinity);
  return toPath(ix, s);
}

export interface AsyncRouteOptions extends RouteSearchOptions {
  /** per-slice budget (ms), default SLICE_MS */
  budgetMs?: number;
  /** runs the next slice (default requestAnimationFrame, else setTimeout 0) */
  schedule?: (fn: () => void) => void;
  /** abort: resolves null at the next slice */
  signal?: { aborted: boolean };
}

const defaultSchedule = (fn: () => void) => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => fn());
  else setTimeout(fn, 0);
};

/** A* spread over frames: at most `budgetMs` of work per scheduled slice. */
export function findGraphPathAsync(ix: WalkGraphIndex, from: number, to: number, opts: AsyncRouteOptions = {}): Promise<GraphPath | null> {
  const s = new RouteSearch(ix, from, to, opts);
  const budget = opts.budgetMs ?? SLICE_MS, schedule = opts.schedule ?? defaultSchedule;
  return new Promise(resolve => {
    const run = () => {
      if (opts.signal?.aborted) { resolve(null); return; }
      if (s.step(budget)) resolve(toPath(ix, s));
      else schedule(run);
    };
    run();
  });
}

export function polylineLength(pts: readonly Vec2[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return L;
}

/**
 * Split a polyline into consecutive legs of at most `legMax` u (each leg starts where the previous ended; a segment
 * longer than legMax is cut). Every leg keeps the polyline's own vertices.
 */
export function splitLegs(pts: readonly Vec2[], legMax = LEG_MAX): Vec2[][] {
  const legs: Vec2[][] = [];
  if (pts.length < 2) return pts.length ? [[{ ...pts[0] }]] : [];
  let leg: Vec2[] = [{ ...pts[0] }], acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let a = leg[leg.length - 1];
    const b = pts[i];
    let seg = Math.hypot(b.x - a.x, b.z - a.z);
    while (acc + seg > legMax + 1e-9) {
      const t = (legMax - acc) / seg, cut = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      if (legMax - acc > 1e-6) leg.push(cut);
      legs.push(leg);
      leg = [cut]; acc = 0; a = cut; seg = Math.hypot(b.x - a.x, b.z - a.z);
    }
    leg.push({ x: b.x, z: b.z }); acc += seg;
  }
  if (leg.length > 1) legs.push(leg);
  return legs;
}

/** Fetch and index graph.obc of the published city (current.json → manifest → graph file). */
export async function loadWalkGraph(root?: string, fetchImpl: typeof fetch = fetch): Promise<WalkGraphIndex> {
  const { base, manifest } = await loadManifest(root, fetchImpl);
  const res = await fetchImpl(`${base}/${manifest.graph.file}`);
  if (!res.ok) throw new Error(`graph: HTTP ${res.status}`);
  return new WalkGraphIndex(await decodeGraphFile(new Uint8Array(await res.arrayBuffer())));
}
