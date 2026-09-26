// Step 7 (plan §4.7): walking graph from street centrelines, steps and park paths (sidewalk ways are not used: the
// whole corridor is walkable). Nodes at shared OSM vertices + every ≤ 24 u; CSR both directions; components < 50 dropped.
import { GRAPH_EDGE, GRAPH_NODE_FLAG, ROAD_FLAG, type WalkGraph } from '../../../src/opus-bay/world/sf/format';
import { type Way } from './roads';
import { type Terrain, heightAt } from './terrain';
import { inSlab } from './world';

export const GRAPH_MAX_EDGE = 24;
export const edgeCost = (len: number, dy: number, steps: boolean) => len * (1 + 2 * Math.max(0, Math.abs(dy) / Math.max(len, 1e-6) - 0.25)) * (steps ? 1.3 : 1);

const kindOf = (w: Way) => (w.cls === 'steps' ? 1 : w.cls === 'footway' || w.cls === 'path' || w.cls === 'cycleway' || w.cls === 'track' ? 2 : w.cls === 'pedestrian' ? 3 : w.cls === 'service' ? 4 : 0);

export interface GraphBuild { graph: WalkGraph; components: number; dropped: number; largest: number; compOf: Int32Array }

export function buildGraph(ways: Way[], t: Terrain, log: (s: string) => void): GraphBuild {
  const walk = ways.filter(w => w.walk && !(w.cls === 'footway' && (w.footway === 'sidewalk' || w.footway === 'crossing')));
  const use = new Map<string, number>();
  for (const w of walk) w.keys.forEach((k, i) => use.set(k, (use.get(k) ?? 0) + (i === 0 || i === w.keys.length - 1 ? 1 : 2)));
  const xs: number[] = [], ys: number[] = [], zs: number[] = [];
  const nodeOf = new Map<string, number>();
  const node = (key: string | null, x: number, z: number, y: number) => {
    if (key !== null) { const n = nodeOf.get(key); if (n !== undefined) return n; }
    const id = xs.length;
    xs.push(x); zs.push(z); ys.push(y);
    if (key !== null) nodeOf.set(key, id);
    return id;
  };
  const ea: number[] = [], eb: number[] = [], ec: number[] = [], ek: number[] = [];
  for (const w of walk) {
    const n = w.keys.length;
    const y = new Array<number>(n);
    for (let i = 0; i < n; i++) y[i] = heightAt(t, w.xz[i * 2], w.xz[i * 2 + 1]);
    if (w.flags & ROAD_FLAG.bridge) for (let i = 1; i < n - 1; i++) y[i] = Math.max(y[i], y[0] + ((y[n - 1] - y[0]) * i) / (n - 1));
    const steps = w.cls === 'steps', kind = kindOf(w);
    let prev = node(w.keys[0], w.xz[0], w.xz[1], y[0]);
    let acc = 0;
    for (let i = 1; i < n; i++) {
      const ax = w.xz[i * 2 - 2], az = w.xz[i * 2 - 1], bx = w.xz[i * 2], bz = w.xz[i * 2 + 1];
      const L = Math.hypot(bx - ax, bz - az);
      // long segments: interpolated nodes every ≤ 24 u
      const parts = Math.max(1, Math.ceil(L / GRAPH_MAX_EDGE));
      for (let s = 1; s < parts; s++) {
        const f = s / parts, x = ax + (bx - ax) * f, z = az + (bz - az) * f, yy = y[i - 1] + (y[i] - y[i - 1]) * f;
        const id = node(null, x, z, yy);
        const len = acc + L / parts;
        ea.push(prev); eb.push(id); ec.push(edgeCost(len, yy - ys[prev], steps)); ek.push(kind);
        prev = id; acc = 0;
      }
      acc += L / parts;
      const isNode = i === n - 1 || (use.get(w.keys[i]) ?? 0) > 2 || acc >= GRAPH_MAX_EDGE;
      if (!isNode) continue;
      const id = node((use.get(w.keys[i]) ?? 0) > 2 || i === n - 1 ? w.keys[i] : null, bx, bz, y[i]);
      if (id !== prev) { ea.push(prev); eb.push(id); ec.push(edgeCost(acc, y[i] - ys[prev], steps)); ek.push(kind); }
      prev = id; acc = 0;
    }
  }
  const n0 = xs.length;
  // components
  const adj: number[][] = Array.from({ length: n0 }, () => []);
  for (let e = 0; e < ea.length; e++) { adj[ea[e]].push(e); adj[eb[e]].push(e); }
  const comp = new Int32Array(n0).fill(-1);
  const sizes: number[] = [];
  for (let s = 0; s < n0; s++) {
    if (comp[s] >= 0) continue;
    const c = sizes.length, stack = [s];
    comp[s] = c;
    let size = 0;
    while (stack.length) {
      const v = stack.pop()!;
      size++;
      for (const e of adj[v]) { const u = ea[e] === v ? eb[e] : ea[e]; if (comp[u] < 0) { comp[u] = c; stack.push(u); } }
    }
    sizes.push(size);
  }
  const keepComp = sizes.map(sz => sz >= 50);
  // spatial order (16 u Morton cells) for locality and compression
  const keepIds: number[] = [];
  for (let i = 0; i < n0; i++) if (keepComp[comp[i]]) keepIds.push(i);
  const morton = (x: number, z: number) => {
    let a = Math.max(0, Math.min(65535, Math.floor((x + 2048) / 16))), b = Math.max(0, Math.min(65535, Math.floor((z + 2048) / 16)));
    let m = 0;
    for (let bit = 0; bit < 16; bit++) { m += ((a & 1) + 2 * (b & 1)) * 4 ** bit; a >>= 1; b >>= 1; }
    return m;
  };
  keepIds.sort((p, q) => morton(xs[p], zs[p]) - morton(xs[q], zs[q]) || p - q);
  const remap = new Int32Array(n0).fill(-1);
  keepIds.forEach((old, i) => { remap[old] = i; });
  const N = keepIds.length;
  const outEdges: [number, number, number][][] = Array.from({ length: N }, () => []);
  for (let e = 0; e < ea.length; e++) {
    const a = remap[ea[e]], b = remap[eb[e]];
    if (a < 0 || b < 0 || a === b) continue;
    outEdges[a].push([b, ec[e], ek[e]]); outEdges[b].push([a, ec[e], ek[e]]);
  }
  const offsets = new Uint32Array(N + 1);
  for (let i = 0; i < N; i++) offsets[i + 1] = offsets[i] + outEdges[i].length;
  const M = offsets[N];
  const targets = new Uint32Array(M), cost = new Float32Array(M), kind = new Uint8Array(M);
  for (let i = 0; i < N; i++) outEdges[i].forEach(([b, c, k], j) => { targets[offsets[i] + j] = b; cost[offsets[i] + j] = Math.max(0.01, Math.round(c * 100) / 100); kind[offsets[i] + j] = k; });
  const xyz = new Float32Array(N * 3), nodeFlags = new Uint8Array(N);
  const compOf = new Int32Array(N);
  keepIds.forEach((old, i) => {
    xyz[i * 3] = xs[old]; xyz[i * 3 + 1] = ys[old]; xyz[i * 3 + 2] = zs[old];
    if (inSlab(xs[old], zs[old])) nodeFlags[i] |= GRAPH_NODE_FLAG.hero;
    if (outEdges[i].length >= 3) nodeFlags[i] |= GRAPH_NODE_FLAG.junction;
    compOf[i] = comp[old];
  });
  let largest = -1, ls = 0;
  sizes.forEach((sz, c) => { if (sz > ls) { ls = sz; largest = c; } });
  const kept = sizes.filter(s => s >= 50).length;
  log(`graph: ${N} nodes, ${M} directed edges (${GRAPH_EDGE.join('/')}), ${kept} components ≥ 50 nodes (largest ${ls}), dropped ${n0 - N} nodes in ${sizes.length - kept} small components`);
  return { graph: { nodeCount: N, edgeCount: M, xyz, nodeFlags, offsets, targets, cost, kind }, components: kept, dropped: n0 - N, largest, compOf };
}

/** Nearest node of a given component (bucketed linear scan is fine offline). */
export function nearestNode(g: GraphBuild, x: number, z: number, maxD: number, comp?: number): number {
  let best = -1, bd = maxD * maxD;
  const xyz = g.graph.xyz;
  for (let i = 0; i < g.graph.nodeCount; i++) {
    if (comp !== undefined && g.compOf[i] !== comp) continue;
    const dx = xyz[i * 3] - x, dz = xyz[i * 3 + 2] - z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
