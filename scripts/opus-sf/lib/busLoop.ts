// Wave 4 · lane T (W4-T2): bake the sightseeing loop `sf-loop` (plan §3.2) for transit.json.
//
// Ported from the measured scouting tool (opus-qa/w4/plan/loop-final.mts, 16 stops, 6,522 u):
// - graph: the raw OSM highways (ODbL), car-legal only: access / motor_vehicle / motorcar / oneway respected, no
//   motorways, no parking aisles / driveways / alleys, plus the forced exclusions of plan R8 (JFK Promenade, the Upper
//   Great Highway south of Lincoln Way = Sunset Dunes, Twin Peaks Blvd north of the summit lot = the north gate);
//   Dijkstra preferring primary / secondary streets (cost factor per class);
// - stops: the 16 kerb points snapped to candidate nodes on the named street (both carriageways of a boulevard); the
//   candidate per stop is chosen by a small cycle DP over the leg costs, so no leg needs a jog through an alley (the
//   Chula Lane U-turn of the scouting route);
// - lanes: the bus keeps right: two-way streets are offset to the right lane (¼ of the right-of-way, ≤ 1.4 u), dual
//   carriageways and one-way streets keep their centreline; out-and-back reversals (the Twin Peaks summit spur) turn in
//   a flared teardrop; corners are filleted (R 4.5 u, limited by the segment lengths);
// - hero: inside the frozen hero slab the path follows the hand-made Embarcadero (DISTRICT, not OSM): from Washington
//   St the bus takes the landward south lanes (d −19.35), U-turns across the median at station 44, runs the bayside
//   north lanes (d −7.2) past the F-line platforms to the Ferry Building (st 64) and PIER 39 (st 344) stops, then blends
//   into Jefferson St at the slab edge;
// - heights: the terrain smoothed ±3 u along the path (inside the slab = the hero ground); speeds per span (12 u/s on
//   trunk / primary / secondary, 11 on tertiary, 9 on residential / unclassified / service or grades > 0.12);
// - the path starts and ends at the Ferry Building stop (a loop: `at` wraps, the path closes on itself).
import fs from 'node:fs';
import path from 'node:path';
import { projectCity } from '../../../src/opus-bay/core/geo';
import { SECTION, at as heroAt, stationOf } from '../../../src/opus-bay/data/district';
import { LOOP_STOPS, STOP_ATTRACTIONS, W4_LINES } from '../../../src/opus-bay/data/sf/stationNames';
import type { TransitLine } from '../../../src/opus-bay/world/sf/format';
import { RAW } from './io';
import { type P2, cumulative, projectOnto, round, simplifyIdx, surfaceHeights } from './lineGeom';
import type { Terrain } from './terrain';
import { inSlab } from './world';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** The 16 stops (plan §3.2) as measured: OSM kerb lat / lng and the street the bus stops on. */
export const LOOP_STOP_SPECS: readonly { id: string; lat: number; lng: number; street: RegExp }[] = [
  { id: 'loop-ferry-building', lat: 37.79476, lng: -122.39425, street: /Embarcadero/ },
  { id: 'loop-pier-39', lat: 37.808, lng: -122.4104, street: /Embarcadero/ },
  { id: 'loop-wharf-hyde', lat: 37.80628, lng: -122.4207, street: /Beach Street|Hyde Street/ },
  { id: 'loop-palace-of-fine-arts', lat: 37.80385, lng: -122.4459, street: /Baker|Bay Street|Marina/ },
  { id: 'loop-golden-gate-bridge', lat: 37.8065, lng: -122.4746, street: /Lincoln|Merchant|Bridge|Plaza/ },
  { id: 'loop-legion-of-honor', lat: 37.7849, lng: -122.4997, street: /Legion of Honor|El Camino del Mar|34th/ },
  { id: 'loop-lands-end-sutro', lat: 37.7795, lng: -122.5113, street: /Point Lobos|Great Highway|Merrie/ },
  { id: 'loop-ocean-beach-windmill', lat: 37.76985, lng: -122.51085, street: /Great Highway/ },
  { id: 'loop-golden-gate-park', lat: 37.7716, lng: -122.4666, street: /Music Concourse|Hagiwara|Nancy Pelosi|Martin Luther King|Tenth|10th/ },
  { id: 'loop-haight-ashbury', lat: 37.76995, lng: -122.4469, street: /Haight|Masonic|Ashbury/ },
  { id: 'loop-painted-ladies', lat: 37.7762, lng: -122.4327, street: /Steiner/ },
  { id: 'loop-castro', lat: 37.7625, lng: -122.4351, street: /Castro|Market/ },
  { id: 'loop-twin-peaks', lat: 37.7527, lng: -122.4474, street: /Twin Peaks/ },
  { id: 'loop-mission-dolores', lat: 37.7644, lng: -122.4266, street: /Dolores|16th/ },
  { id: 'loop-civic-center', lat: 37.7795, lng: -122.4183, street: /Polk|McAllister|Grove|Van Ness/ },
  { id: 'loop-chinatown', lat: 37.79075, lng: -122.4047, street: /Bush|Kearny|Grant/ },
];

const CAR = new Set(['trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service', 'busway']);
const COST: Record<string, number> = { trunk: 1.05, trunk_link: 1.2, primary: 1, primary_link: 1.2, secondary: 1.02, secondary_link: 1.2, tertiary: 1.12, tertiary_link: 1.2, unclassified: 1.35, residential: 1.6, living_street: 3, service: 2.6, busway: 1.2 };
/** right-of-way (u) per class, core/geo STREET_ROW (links as their class) */
const ROW: Record<string, number> = { trunk: 5.6, primary: 5.6, secondary: 4.4, tertiary: 4.4, unclassified: 3.6, residential: 3.6, living_street: 3.6, service: 2, busway: 3.6 };
/** cruise speed (u/s) per class: plan §3.2 (12 on primary / secondary, 9 on residential) */
const SPEED: Record<string, number> = { trunk: 12, primary: 12, secondary: 12, tertiary: 11, unclassified: 9, residential: 9, living_street: 9, service: 9, busway: 11 };
const NO = (v?: string) => v === 'no' || v === 'private' || v === 'agricultural' || v === 'forestry' || v === 'delivery';
const baseCls = (c: string) => c.replace(/_link$/, '');

/** Hero Embarcadero lanes (DISTRICT roads 'embarcadero-north-lanes' / '-south-lanes'). */
export const HERO_LANE_N = -7.2;
export const HERO_LANE_S = -19.35;
/** where the bus U-turns across the median (station, before the Ferry platform at 58.5) */
export const HERO_UTURN_ST = 44;
export const HERO_FERRY_ST = 64;
export const HERO_PIER39_ST = 344;
/** bus-stop pole on the promenade kerb (the promenade is d −5 … 5) */
export const HERO_POLE_D = -4.3;
/** pole distance from the lane centre elsewhere (half a bus + the kerb) */
export const POLE_OFFSET = 2.9;
const FILLET_R = 4.5;
const MAX_LANE = 1.4;
const SLOW_GRADE = 0.12;

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

interface Edge { to: number; len: number; cost: number; way: number; name: string; cls: string; oneway: boolean; bridge: boolean }
interface Graph { NX: number[]; NZ: number[]; adj: Edge[][]; excluded: Record<string, number> }

function loadGraph(log: (s: string) => void): Graph {
  const text = fs.readFileSync(path.join(RAW, 'osm-highways.json'), 'utf8');
  const nodeId = new Map<string, number>();
  const NX: number[] = [], NZ: number[] = [];
  const adj: Edge[][] = [];
  const node = (lat: number, lon: number) => {
    const k = `${lat.toFixed(7)},${lon.toFixed(7)}`;
    let i = nodeId.get(k);
    if (i === undefined) { i = NX.length; nodeId.set(k, i); const p = projectCity(lat, lon); NX.push(p.x); NZ.push(p.z); adj.push([]); }
    return i;
  };
  interface W { id: number; t: Record<string, string>; g: { lat: number; lon: number }[] }
  const ways: W[] = [];
  for (const l of text.split('\n')) {
    if (!l.startsWith('{"type":"way"')) continue;
    const e = JSON.parse(l.trimEnd().replace(/,$/, '')) as { id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] };
    const t = e.tags ?? {};
    if (!CAR.has(t.highway)) continue;
    if (NO(t.access) && !(t.bus === 'yes' || t.psv === 'yes')) continue;
    if (NO(t.motor_vehicle) || NO(t.motorcar)) continue;
    if (t.highway === 'service' && ['parking_aisle', 'driveway', 'alley', 'drive-through'].includes(t.service ?? '')) continue;
    if (t.area === 'yes' || !e.geometry || e.geometry.length < 2) continue;
    ways.push({ id: e.id, t, g: e.geometry });
  }
  // forced exclusions (plan R8), by latitude (OSM 2026-09-26 still tags these as open roads):
  // - JFK Promenade (car-free) — the whole drive, the loop never needs it;
  // - the Upper Great Highway south of Lincoln Way (Sunset Dunes park since 12 Apr 2025): Lincoln Way meets the coast at
  //   lat 37.7640, so every Great Highway way reaching south of 37.7638 goes;
  // - Twin Peaks Blvd north of the summit lot (the car-free north gate): ways lying wholly north of lat 37.7535.
  const excluded: Record<string, number> = { jfk: 0, upperGreatHighway: 0, twinPeaksNorth: 0 };
  const keep = ways.filter(w => {
    const name = w.t.name ?? '';
    const lats = w.g.map(g => g.lat);
    if (/John F\.? Kennedy|JFK Promenade/i.test(name)) { excluded.jfk++; return false; }
    if (/Great Highway/.test(name) && Math.min(...lats) < 37.7638) { excluded.upperGreatHighway++; return false; }
    if (/Twin Peaks Boulevard/.test(name) && Math.min(...lats) > 37.7535) { excluded.twinPeaksNorth++; return false; }
    return true;
  });
  log(`loop graph: ${keep.length} car-legal ways; excluded ${JSON.stringify(excluded)}`);
  for (const w of keep) {
    const t = w.t;
    const ow = t.oneway === 'yes' || t.oneway === '1' || t.oneway === 'true' ? 1 : t.oneway === '-1' ? -1 : t.junction === 'roundabout' ? 1 : 0;
    const f = COST[t.highway] ?? 2;
    for (let i = 1; i < w.g.length; i++) {
      const a = node(w.g[i - 1].lat, w.g[i - 1].lon), b = node(w.g[i].lat, w.g[i].lon);
      const len = Math.hypot(NX[b] - NX[a], NZ[b] - NZ[a]);
      const ed = { len, cost: len * f, way: w.id, name: t.name ?? t.ref ?? `(${t.highway})`, cls: t.highway, oneway: ow !== 0, bridge: !!t.bridge && t.bridge !== 'no' };
      if (ow >= 0) adj[a].push({ to: b, ...ed });
      if (ow <= 0) adj[b].push({ to: a, ...ed });
    }
  }
  log(`loop graph: ${NX.length} nodes`);
  return { NX, NZ, adj, excluded };
}

/** One-to-all Dijkstra (binary heap). */
function dijkstraAll(G: Graph, src: number): { dist: Float64Array; prev: Int32Array; pe: Int32Array } {
  const n = G.NX.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), pe = new Int32Array(n).fill(-1);
  const hd: number[] = [], hv: number[] = [];
  const push = (d: number, v: number) => {
    hd.push(d); hv.push(v);
    let i = hd.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (hd[p] <= hd[i]) break; [hd[p], hd[i]] = [hd[i], hd[p]]; [hv[p], hv[i]] = [hv[i], hv[p]]; i = p; }
  };
  const pop = () => {
    const d = hd[0], v = hv[0];
    const ld = hd.pop()!, lv = hv.pop()!;
    if (hd.length) {
      hd[0] = ld; hv[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < hd.length && hd[l] < hd[m]) m = l;
        if (r < hd.length && hd[r] < hd[m]) m = r;
        if (m === i) break;
        [hd[m], hd[i]] = [hd[i], hd[m]]; [hv[m], hv[i]] = [hv[i], hv[m]]; i = m;
      }
    }
    return [d, v] as const;
  };
  dist[src] = 0; push(0, src);
  while (hd.length) {
    const [d, v] = pop();
    if (d > dist[v]) continue;
    const es = G.adj[v];
    for (let k = 0; k < es.length; k++) {
      const e = es[k], nd = d + e.cost;
      if (nd < dist[e.to]) { dist[e.to] = nd; prev[e.to] = v; pe[e.to] = k; push(nd, e.to); }
    }
  }
  return { dist, prev, pe };
}

// ---------------------------------------------------------------------------
// Bake
// ---------------------------------------------------------------------------

/** A path vertex with the attributes of the segment that ENDS at it (segment i = vertex i−1 → i). */
interface V { x: number; z: number; name: string; cls: string; oneway: boolean; bridge: boolean; stop?: string; hero?: boolean }

export interface LoopBake {
  line: TransitLine;
  /** [fromAt, toAt, speed u/s] runs covering the whole lap */
  speeds: [number, number, number][];
  /** bus-stop pole positions (the kerb beside the stopped bus) and the bus heading there */
  poles: { stop: string; x: number; z: number; heading: number }[];
  report: string[];
}

export function bakeLoop(t: Terrain, log: (s: string) => void): LoopBake {
  const report: string[] = [];
  const G = loadGraph(log);
  const indeg = new Int32Array(G.NX.length);
  for (const es of G.adj) for (const e of es) indeg[e.to]++;

  // --- candidates per stop
  const cands = LOOP_STOP_SPECS.map(s => {
    const p = projectCity(s.lat, s.lng);
    const near: { i: number; d: number }[] = [];
    for (let i = 0; i < G.NX.length; i++) {
      if (!G.adj[i].length || !indeg[i]) continue;
      const d = Math.hypot(G.NX[i] - p.x, G.NZ[i] - p.z);
      if (d > 40) continue;
      if (!G.adj[i].some(e => s.street.test(e.name))) continue;
      near.push({ i, d });
    }
    near.sort((a, b) => a.d - b.d);
    if (!near.length) throw new Error(`loop: no node on ${s.street} near ${s.id}`);
    // the hero stops are rebuilt on the hand-made Embarcadero: one candidate keeps the measured route
    const hero = inSlab(p.x, p.z);
    const pick = hero ? near.slice(0, 1) : near.filter(c => c.d <= Math.max(25, near[0].d + 4)).slice(0, 6);
    return pick.map(c => c.i);
  });
  // --- one-to-all Dijkstra from every candidate, then the cycle DP (first stop's candidate fixed per run)
  const runs = new Map<number, ReturnType<typeof dijkstraAll>>();
  for (const cs of cands) for (const c of cs) if (!runs.has(c)) runs.set(c, dijkstraAll(G, c));
  log(`loop: ${runs.size} Dijkstra runs for ${cands.flat().length} stop candidates`);
  const n = cands.length;
  let best = { cost: Infinity, choice: [] as number[] };
  for (const c0 of cands[0]) {
    // cost[k][j]: best cost reaching stop k at candidate j
    let prevCost = new Map<number, { cost: number; path: number[] }>([[c0, { cost: 0, path: [c0] }]]);
    for (let k = 1; k <= n; k++) {
      const next = new Map<number, { cost: number; path: number[] }>();
      const targets = k === n ? [c0] : cands[k];
      for (const [from, st] of prevCost) {
        const r = runs.get(from)!;
        for (const to of targets) {
          const c = st.cost + r.dist[to];
          if (!Number.isFinite(c)) continue;
          const cur = next.get(to);
          if (!cur || c < cur.cost) next.set(to, { cost: c, path: [...st.path, to] });
        }
      }
      prevCost = next;
    }
    const end = prevCost.get(c0);
    if (end && end.cost < best.cost) best = { cost: end.cost, choice: end.path.slice(0, n) };
  }
  if (!Number.isFinite(best.cost)) throw new Error('loop: no closed route through the 16 stops');

  // --- assemble the closed centreline with per-segment attributes
  const verts: V[] = [];
  const legs: { from: string; to: string; len: number; hero: number; streets: string[] }[] = [];
  for (let k = 0; k < n; k++) {
    const a = best.choice[k], b = best.choice[(k + 1) % n];
    const r = runs.get(a)!;
    const nodes: number[] = [], edges: Edge[] = [];
    for (let v = b; v !== a; v = r.prev[v]) { nodes.push(v); edges.push(G.adj[r.prev[v]][r.pe[v]]); }
    nodes.reverse(); edges.reverse();
    if (k === 0) verts.push({ x: G.NX[a], z: G.NZ[a], name: edges[0].name, cls: edges[0].cls, oneway: edges[0].oneway, bridge: false, stop: LOOP_STOP_SPECS[0].id });
    let len = 0, hero = 0;
    const streets: string[] = [];
    nodes.forEach((v, i) => {
      const e = edges[i];
      len += e.len;
      if (inSlab(G.NX[v], G.NZ[v])) hero += e.len;
      if (streets[streets.length - 1] !== e.name) streets.push(e.name);
      verts.push({ x: G.NX[v], z: G.NZ[v], name: e.name, cls: e.cls, oneway: e.oneway, bridge: e.bridge, ...(i === nodes.length - 1 && k < n - 1 ? { stop: LOOP_STOP_SPECS[k + 1].id } : {}) });
    });
    legs.push({ from: LOOP_STOP_SPECS[k].id, to: LOOP_STOP_SPECS[(k + 1) % n].id, len: round(len, 10), hero: round(hero, 10), streets });
  }
  for (const l of legs) report.push(`leg ${l.from} → ${l.to}: ${l.len} u (hero ${l.hero}) ${l.streets.join(' > ')}`);
  const osmTotal = legs.reduce((s, l) => s + l.len, 0);
  report.push(`OSM route ${round(osmTotal, 10)} u (scouting 6,523 u)`);
  // drop consecutive duplicates (stop nodes where a leg ends and the next begins)
  const clean: V[] = [];
  for (const v of verts) {
    const last = clean[clean.length - 1];
    if (last && Math.hypot(v.x - last.x, v.z - last.z) < 0.05) { if (v.stop) last.stop = v.stop; continue; }
    clean.push(v);
  }

  // --- lanes (keep right on two-way streets), U-turn teardrops, fillets
  // collinear OSM vertices out first (DP 0.25 u; stops and street changes kept) so corners are single vertices
  const keepC = new Set<number>();
  clean.forEach((v, i) => { if (v.stop || (i > 0 && (clean[i - 1].name !== v.name || clean[i - 1].oneway !== v.oneway))) keepC.add(i); });
  const centre = simplifyIdx(clean.map(v => [v.x, v.z] as P2), 0.25, keepC).map(i => clean[i]);
  let lane = laneOffset(centre);
  lane = fillet(lane, FILLET_R);

  // --- the hero Embarcadero (replaces the OSM run from Washington St to the slab edge on Jefferson St)
  // start at the Ferry stop (a straight bit) and round the splice's own junctions (Washington St, Jefferson St)
  const spliced = fillet(rotateAtStop(heroSplice(lane, report), LOOP_STOPS[0].id), FILLET_R);

  // --- densify, heights, speeds, stops
  const dense = nearSideStops(densifyV(spliced, 3), report);
  const pts: P2[] = dense.map(v => [v.x, v.z]);
  const cum = cumulative(pts);
  const ys = surfaceHeights(t, pts, cum);
  // (inside the slab the terrain lattice is the hero ground)
  const stopIdx = new Map<string, number>();
  dense.forEach((v, i) => { if (v.stop && !stopIdx.has(v.stop)) stopIdx.set(v.stop, i); });
  for (const s of LOOP_STOPS) if (!stopIdx.has(s.id)) throw new Error(`loop: stop ${s.id} lost in the bake`);
  // speeds per segment: class cruise, 9 on grades > 0.12 (over ≥ 6 u windows)
  const segSpeed: number[] = [0];
  for (let i = 1; i < dense.length; i++) {
    let v = SPEED[baseCls(dense[i].cls)] ?? 9;
    if (dense[i].hero) v = 11;
    let j = i;
    while (j < dense.length - 1 && cum[j] - cum[i - 1] < 6) j++;
    const ds = cum[j] - cum[i - 1];
    if (ds > 3 && Math.abs(ys[j] - ys[i - 1]) / ds > SLOW_GRADE) v = Math.min(v, 9);
    segSpeed.push(v);
  }
  // --- simplify (keep the stops), then measure the final polyline
  const keep = new Set<number>([...stopIdx.values()]);
  // keep speed-change vertices so the spans map exactly
  for (let i = 2; i < segSpeed.length; i++) if (segSpeed[i] !== segSpeed[i - 1]) keep.add(i - 1);
  const idx = simplifyIdx(pts, 0.06, keep, ys, 0.05);
  const fp = idx.map(i => pts[i]), fy = idx.map(i => ys[i]);
  const fcum = cumulative(fp);
  const L = fcum[fcum.length - 1];
  const at = (i: number) => fcum[idx.indexOf(i)];
  const speeds: [number, number, number][] = [];
  for (let k = 1; k < idx.length; k++) {
    const v = segSpeed[idx[k]];
    const last = speeds[speeds.length - 1];
    if (last && last[2] === v) last[1] = round(fcum[k]); else speeds.push([round(fcum[k - 1]), round(fcum[k]), v]);
  }
  // the path starts and ends at the Ferry Building stop: rotate the closed polyline there
  const s0 = at(stopIdx.get(LOOP_STOPS[0].id)!);
  const rot = rotateClosed(fp, fy, s0);
  const flat: number[] = [];
  rot.pts.forEach(([x, z], i) => flat.push(round(x), round(rot.ys[i], 1000), round(z)));
  const shift = (s: number) => { const v = s - s0; return v < 0 ? v + L : v; };
  const speedsRot = rotateSpans(speeds, s0, L);

  // stops + poles
  const poles: LoopBake['poles'] = [];
  const stops: TransitLine['stops'] = LOOP_STOPS.map(def => {
    const i = stopIdx.get(def.id)!;
    const s = def.id === LOOP_STOPS[0].id ? 0 : shift(at(i));
    const v = dense[i];
    const a = dense[Math.max(0, i - 1)], b = dense[Math.min(dense.length - 1, i + 1)];
    const h = Math.atan2(b.x - a.x, b.z - a.z);
    let pole: P2;
    if (v.hero) {
      const st = stationOf({ x: v.x, z: v.z }).st;
      const p = heroAt(st, HERO_POLE_D);
      pole = [p.x, p.z];
    } else {
      // right of the heading: (−cos h, sin h)
      pole = [v.x - Math.cos(h) * POLE_OFFSET, v.z + Math.sin(h) * POLE_OFFSET];
    }
    poles.push({ stop: def.id, x: round(pole[0]), z: round(pole[1]), heading: round(h, 1000) });
    return { id: def.id, name: { ...def.name }, at: round(s), x: round(pole[0]), z: round(pole[1]), osmId: null, major: true, ...(STOP_ATTRACTIONS[def.id]?.length ? { attractions: [...STOP_ATTRACTIONS[def.id]] } : {}) };
  });
  stops.sort((p, q) => p.at - q.at);
  const heroSpans: [number, number][] = [];
  {
    let hs = -1;
    const rc = cumulative(rot.pts);
    rot.pts.forEach(([x, z], i) => {
      const ins = inSlab(x, z);
      if (ins && hs < 0) hs = rc[i];
      if ((!ins || i === rot.pts.length - 1) && hs >= 0) { heroSpans.push([round(hs), round(rc[i])]); hs = -1; }
    });
  }
  const meta = W4_LINES['sf-loop'];
  const line: TransitLine = {
    id: meta.id, kind: 'bus', name: { ...meta.name }, short: meta.short, loop: true,
    osmRelation: 0, sourceUrl: meta.sourceUrl, color: meta.color,
    path: flat, length: round(L), stops, turntables: [], doubleEnded: false, heroSpans,
  };
  const slow = speedsRot.filter(s => s[2] <= 9).reduce((a, s) => a + s[1] - s[0], 0);
  report.push(`baked loop ${round(L, 10)} u (${dense.length} → ${fp.length} vertices), residential / steep at 9 u/s: ${round(slow, 10)} u, hero spans ${JSON.stringify(heroSpans)}`);
  log(`loop: ${round(L, 10)} u, ${stops.length} stops`);
  return { line, speeds: speedsRot, poles, report };
}

// ---------------------------------------------------------------------------
// Geometry passes
// ---------------------------------------------------------------------------

const segDir = (a: V, b: V) => { const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1; return { x: dx / L, z: dz / L, L }; };
/** right of a direction (three.js frame): (−dz, dx) */
const rightOf = (d: { x: number; z: number }) => ({ x: -d.z, z: d.x });
const laneOf = (v: V) => (v.oneway || v.hero ? 0 : Math.min(MAX_LANE, (ROW[baseCls(v.cls)] ?? 3.6) / 4));

/** Offset each segment to the right by its lane offset (miter joins), with a flared teardrop at reversals. */
function laneOffset(vs: V[]): V[] {
  const out: V[] = [];
  const nSeg = vs.length - 1;
  const segOff = (i: number) => laneOf(vs[i]); // segment i = vs[i−1] → vs[i]
  for (let i = 0; i < vs.length; i++) {
    const v = vs[i];
    const inSeg = i > 0 ? i : null, outSeg = i < nSeg ? i + 1 : null;
    const dIn = inSeg !== null ? segDir(vs[i - 1], v) : null, dOut = outSeg !== null ? segDir(v, vs[i + 1]) : null;
    const oIn = inSeg !== null ? segOff(inSeg) : 0, oOut = outSeg !== null ? segOff(outSeg) : 0;
    if (!dIn || !dOut) {
      const d = (dIn ?? dOut)!, o = dIn ? oIn : oOut, r = rightOf(d);
      out.push({ ...v, x: v.x + r.x * o, z: v.z + r.z * o });
      continue;
    }
    const cos = dIn.x * dOut.x + dIn.z * dOut.z;
    const rIn = rightOf(dIn), rOut = rightOf(dOut);
    if (cos < -0.85) {
      // reversal (out-and-back spur): flared teardrop turning left, from the incoming lane to the outgoing lane
      const A = { x: v.x + rIn.x * oIn, z: v.z + rIn.z * oIn }, B = { x: v.x + rOut.x * oOut, z: v.z + rOut.z * oOut };
      const left = { x: -rIn.x, z: -rIn.z };
      const k = 9, w = 6;
      const P1 = { x: A.x + dIn.x * k - left.x * w, z: A.z + dIn.z * k - left.z * w };
      const P2 = { x: B.x + dIn.x * k + left.x * w, z: B.z + dIn.z * k + left.z * w };
      for (let s = 0; s <= 24; s++) {
        const u = s / 24, a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3;
        const p = { x: a * A.x + b * P1.x + c * P2.x + d * B.x, z: a * A.z + b * P1.z + c * P2.z + d * B.z };
        // first half: the incoming segment's street, second half: the outgoing one's; the stop sits at the apex
        out.push({ ...(s <= 12 ? v : vs[i + 1]), stop: s === 12 ? v.stop : undefined, x: p.x, z: p.z });
      }
      continue;
    }
    // miter: intersect the two offset lines
    const pa = { x: v.x + rIn.x * oIn, z: v.z + rIn.z * oIn }, pb = { x: v.x + rOut.x * oOut, z: v.z + rOut.z * oOut };
    const den = dIn.x * dOut.z - dIn.z * dOut.x;
    if (Math.abs(den) < 1e-6) { out.push({ ...v, x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2 }); continue; }
    const tt = ((pb.x - pa.x) * dOut.z - (pb.z - pa.z) * dOut.x) / den;
    let m = { x: pa.x + dIn.x * tt, z: pa.z + dIn.z * tt };
    const lim = 3 * Math.max(oIn, oOut, 0.3);
    if (Math.hypot(m.x - v.x, m.z - v.z) > lim) m = { x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2 };
    out.push({ ...v, x: m.x, z: m.z });
  }
  return out;
}

/** Round every corner with an arc of radius ≤ R (tangent length ≤ 45 % of either neighbouring segment). */
function fillet(vs: V[], R: number): V[] {
  const out: V[] = [vs[0]];
  for (let i = 1; i < vs.length - 1; i++) {
    const a = vs[i - 1], v = vs[i], b = vs[i + 1];
    const d1 = segDir(a, v), d2 = segDir(v, b);
    const cos = Math.max(-1, Math.min(1, d1.x * d2.x + d1.z * d2.z));
    const th = Math.acos(cos);
    if (th < 0.14 || th > 2.6) { out.push(v); continue; }
    let tl = R * Math.tan(th / 2);
    tl = Math.min(tl, 0.45 * d1.L, 0.45 * d2.L);
    if (tl < 0.2) { out.push(v); continue; }
    const p0 = { x: v.x - d1.x * tl, z: v.z - d1.z * tl }, p1 = { x: v.x + d2.x * tl, z: v.z + d2.z * tl };
    const steps = Math.max(2, Math.ceil(th / 0.2));
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      // quadratic Bézier through the corner (close to a circular arc for these angles)
      const x = (1 - u) ** 2 * p0.x + 2 * (1 - u) * u * v.x + u * u * p1.x, z = (1 - u) ** 2 * p0.z + 2 * (1 - u) * u * v.z + u * u * p1.z;
      out.push({ ...(s <= steps / 2 ? v : b), stop: s === Math.floor(steps / 2) ? v.stop : undefined, hero: v.hero, x, z });
    }
  }
  out.push(vs[vs.length - 1]);
  return out;
}

/**
 * The hand-made Embarcadero inside the hero slab. Replaces the OSM run from where the route first meets The
 * Embarcadero (off Washington St) to where it leaves the spine westward on Jefferson St, keeping the two hero stops.
 */
function heroSplice(vs: V[], report: string[]): V[] {
  const isEmb = (v: V) => /Embarcadero/.test(v.name) || (v.cls.endsWith('_link') && inSlab(v.x, v.z));
  // the run: first Embarcadero vertex after the Chinatown stop … the last slab vertex before the Wharf stop
  const iChina = vs.findIndex(v => v.stop === 'loop-chinatown');
  const iWharf = vs.findIndex(v => v.stop === 'loop-wharf-hyde');
  const i0 = vs.findIndex((v, i) => i > iChina && isEmb(v));
  if (iChina < 0 || iWharf < 0 || i0 < 0) throw new Error('hero splice: markers not found');
  // the exit: the first vertex after PIER 39 that is ≥ 395 st along the spine or outside the slab
  const iPier = vs.findIndex(v => v.stop === 'loop-pier-39');
  let i1 = -1;
  for (let i = iPier; i < iWharf; i++) { const s = stationOf(vs[i]); if (s.st >= 395 || !inSlab(vs[i].x, vs[i].z)) { i1 = i; break; } }
  if (i1 < 0) throw new Error('hero splice: exit not found');
  // entry: turn from Washington St into the south lanes on a quadratic curve (≈ 7 u each side of the corner)
  let ia = i0 - 1;
  for (let acc = 0; ia > iChina + 1 && acc < 7; ia--) acc += Math.hypot(vs[ia].x - vs[ia - 1].x, vs[ia].z - vs[ia - 1].z);
  const entry = stationOf(vs[i0 - 1] ?? vs[i0]);
  const exit = stationOf(vs[i1]);
  const hero: V = { x: 0, z: 0, name: 'The Embarcadero', cls: 'primary', oneway: true, bridge: false, hero: true };
  const pts: { st: number; d: number; stop?: string }[] = [];
  const A = vs[ia], C = heroAt(entry.st, HERO_LANE_S), E = heroAt(entry.st - 7, HERO_LANE_S);
  const curve: V[] = [];
  for (let k = 1; k <= 8; k++) {
    const u = k / 8, a = (1 - u) ** 2, b = 2 * (1 - u) * u, c = u * u;
    curve.push({ ...hero, x: a * A.x + b * C.x + c * E.x, z: a * A.z + b * C.z + c * E.z });
  }
  // 1. southbound on the landward lanes to the U-turn
  for (let st = entry.st - 10; st > HERO_UTURN_ST; st -= 3) pts.push({ st, d: HERO_LANE_S });
  // 2. the U-turn across the median (turning left, toward the bay), bulging south
  const mid = (HERO_LANE_S + HERO_LANE_N) / 2, r = (HERO_LANE_N - HERO_LANE_S) / 2;
  for (let k = 0; k <= 12; k++) { const f = (k / 12) * Math.PI; pts.push({ st: HERO_UTURN_ST - r * Math.sin(f), d: mid - r * Math.cos(f) }); }
  // 3. northbound on the bayside lanes: the Ferry Building and PIER 39 stops
  const blend0 = 356;
  for (let st = HERO_UTURN_ST + 3; st < blend0; st += 3) {
    pts.push({ st, d: HERO_LANE_N });
    if (st < HERO_FERRY_ST && st + 3 >= HERO_FERRY_ST) pts.push({ st: HERO_FERRY_ST, d: HERO_LANE_N, stop: 'loop-ferry-building' });
    if (st < HERO_PIER39_ST && st + 3 >= HERO_PIER39_ST) pts.push({ st: HERO_PIER39_ST, d: HERO_LANE_N, stop: 'loop-pier-39' });
  }
  // 4. blend into the OSM street at the exit
  for (let k = 0; k <= 10; k++) { const u = k / 10, e = u * u * (3 - 2 * u); pts.push({ st: blend0 + (exit.st - blend0) * u, d: HERO_LANE_N + (exit.d - HERO_LANE_N) * e }); }
  const repl: V[] = [...curve, ...pts.map(p => { const q = heroAt(p.st, p.d); return { ...hero, x: q.x, z: q.z, ...(p.stop ? { stop: p.stop } : {}) }; })];
  repl.pop(); // the exit vertex itself stays (OSM)
  // the run includes the old hero stops: drop their markers there
  // the closed OSM loop starts at the Ferry stop, so the replaced run wraps round the array end: keep vs[i1 … i0−1]
  const kept = vs.slice(i1, ia + 1).map(v => ({ ...v }));
  for (const v of kept) if (v.stop === 'loop-ferry-building' || v.stop === 'loop-pier-39') delete v.stop;
  report.push(`hero splice: OSM vertices ${i0}–${i1} (st ${round(entry.st)} → ${round(exit.st)}) replaced by ${repl.length} hand-made lane points (south lanes d ${HERO_LANE_S}, U-turn at st ${HERO_UTURN_ST}, north lanes d ${HERO_LANE_N}; F-line platforms at d ${SECTION.platform.join(' … ')})`);
  const loop = [...repl, ...kept, { ...repl[0], stop: undefined }];
  // drop duplicate consecutive points (the stop markers win)
  const out: V[] = [];
  for (const v of loop) { const last = out[out.length - 1]; if (last && Math.hypot(v.x - last.x, v.z - last.z) < 0.05) { if (v.stop) last.stop = v.stop; continue; } out.push(v); }
  if (out.length && Math.hypot(out[0].x - out[out.length - 1].x, out[0].z - out[out.length - 1].z) > 1e-6) out.push({ ...out[0], stop: undefined });
  return out;
}

/** Rotate a closed V loop (last = first) to start at the vertex carrying `stop`. */
function rotateAtStop(vs: V[], stop: string): V[] {
  const k = vs.findIndex(v => v.stop === stop);
  if (k <= 0) return vs;
  const body = vs.slice(0, vs.length - 1);
  const out = [...body.slice(k), ...body.slice(0, k)];
  out.push({ ...out[0], stop: undefined });
  return out;
}

/**
 * Near-side stops: a stop on a corner (heading turns > 0.5 rad within ±6 u) or on a U-turn moves back along the path
 * to the first straight spot (≤ 0.25 rad within ±6 u), at most 40 u, so the bus dwells straight at the kerb.
 */
function nearSideStops(vs: V[], report: string[]): V[] {
  const pts: P2[] = vs.map(v => [v.x, v.z]);
  const cum = cumulative(pts);
  const head = vs.map((_, i) => { const a = vs[Math.max(0, i - 1)], b = vs[Math.min(vs.length - 1, i + 1)]; return Math.atan2(b.x - a.x, b.z - a.z); });
  const bend = (i: number) => {
    let lo = i, hi = i;
    while (lo > 0 && cum[i] - cum[lo] < 6) lo--;
    while (hi < vs.length - 1 && cum[hi] - cum[i] < 6) hi++;
    let m = 0;
    for (let k = lo; k <= hi; k++) m = Math.max(m, Math.abs(Math.atan2(Math.sin(head[k] - head[i]), Math.cos(head[k] - head[i]))));
    return m;
  };
  const out = vs.map(v => ({ ...v }));
  out.forEach((v, i) => {
    if (!v.stop || v.hero || bend(i) <= 0.5) return;
    let j = i;
    while (j > 0 && cum[i] - cum[j] < 40 && bend(j) > 0.25) j--;
    if (bend(j) > 0.25) return;
    const id = v.stop;
    out[j].stop = id;
    delete out[i].stop;
    report.push(`near-side stop: ${id} moved ${round(cum[i] - cum[j], 10)} u back off a corner`);
  });
  return out;
}

function densifyV(vs: V[], step: number): V[] {
  const out: V[] = [vs[0]];
  for (let i = 1; i < vs.length; i++) {
    const a = vs[i - 1], b = vs[i];
    const L = Math.hypot(b.x - a.x, b.z - a.z), k = Math.max(1, Math.ceil(L / step));
    for (let j = 1; j <= k; j++) out.push({ ...b, stop: j === k ? b.stop : undefined, x: a.x + ((b.x - a.x) * j) / k, z: a.z + ((b.z - a.z) * j) / k });
  }
  return out;
}

/** Rotate a closed polyline (last point = first) so it starts at arc s0. */
function rotateClosed(pts: P2[], ys: number[], s0: number): { pts: P2[]; ys: number[] } {
  const cum = cumulative(pts);
  const L = cum[cum.length - 1];
  if (s0 <= 1e-6 || s0 >= L - 1e-6) return { pts, ys };
  let k = cum.findIndex(c => c >= s0);
  const exact = Math.abs(cum[k] - s0) < 1e-6;
  const t = exact ? 0 : (s0 - cum[k - 1]) / (cum[k] - cum[k - 1]);
  const p: P2 = exact ? pts[k] : [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t];
  const py = exact ? ys[k] : ys[k - 1] + (ys[k] - ys[k - 1]) * t;
  if (exact) k++;
  const body = pts.slice(k, pts.length - 1).concat(pts.slice(0, exact ? k - 1 : k));
  const bodyY = ys.slice(k, ys.length - 1).concat(ys.slice(0, exact ? k - 1 : k));
  return { pts: [p, ...body, p], ys: [py, ...bodyY, py] };
}

function rotateSpans(spans: [number, number, number][], s0: number, L: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const [a, b, v] of spans) {
    let a2 = a - s0, b2 = b - s0;
    if (a2 < 0) { a2 += L; b2 += L; }
    if (b2 <= L + 1e-6) out.push([round(a2), round(Math.min(L, b2)), v]);
    else { out.push([round(a2), round(L), v]); out.push([0, round(b2 - L), v]); }
  }
  out.sort((p, q) => p[0] - q[0]);
  for (let i = out.length - 1; i >= 0; i--) if (out[i][1] - out[i][0] < 0.01) out.splice(i, 1);
  const merged: [number, number, number][] = [];
  for (const s of out) { const last = merged[merged.length - 1]; if (last && last[2] === s[2] && Math.abs(last[1] - s[0]) < 0.02) last[1] = s[1]; else merged.push([...s]); }
  return merged;
}

/** Nearest arc position on the baked loop to (x, z) (QA helper). */
export function loopArcAt(line: TransitLine, x: number, z: number): { at: number; d: number } {
  const pts: P2[] = [];
  for (let i = 0; i + 2 < line.path.length; i += 3) pts.push([line.path[i], line.path[i + 2]]);
  const r = projectOnto(pts, cumulative(pts), x, z);
  return { at: r.at, d: r.d };
}

