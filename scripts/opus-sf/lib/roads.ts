// Step 3 (plan §4.3): OSM highways + surface rails → classified ways (city frame), merged chains with per-vertex
// centreline heights (smoothed along the line; decks for bridges and freeway viaducts), and a street-block raster.
import { STREET_ROW, type StreetClass } from '../../../src/opus-bay/core/geo';
import { ROAD_CLASSES, ROAD_FLAG, STREET_CLASS_CODE } from '../../../src/opus-bay/world/sf/format';
import { densify, polylineLength, segDist2, SpatialHash } from './geom';
import { elements, type OsmGeomPoint } from './io';
import { type Land } from './land';
import { Grid, labelComponents, paintCorridor } from './raster';
import { type Terrain, heightAt } from './terrain';
import { DOMAIN, inDomain, inSlab, projGeom } from './world';

export const TRAM_CODE = ROAD_CLASSES.indexOf('tram');
export const RAIL_CODE = ROAD_CLASSES.indexOf('rail');

export interface Way {
  id: number;
  /** ROAD_CLASSES code */
  code: number;
  cls: StreetClass | 'tram' | 'rail';
  width: number;
  name: string;
  flags: number;
  /** walkable (graph + corridor) */
  walk: boolean;
  /** freeway / trunk viaduct level (deckOnly) */
  layer: number;
  xz: number[];
  /** "lat,lon" keys of the vertices (shared vertex ⇔ junction) */
  keys: string[];
  /** 'sidewalk' | 'crossing' | '' — footway subtype (graph ignores sidewalks) */
  footway: string;
  service: string;
}

const LINK_W: Record<string, number> = { motorway_link: 3.2, trunk_link: 3.6, primary_link: 3.6, secondary_link: 3.6, tertiary_link: 3.6 };
const HW_CLASS: Record<string, StreetClass> = {
  motorway: 'motorway', motorway_link: 'motorway', trunk: 'trunk', trunk_link: 'trunk', primary: 'primary', primary_link: 'primary',
  secondary: 'secondary', secondary_link: 'secondary', tertiary: 'tertiary', tertiary_link: 'tertiary',
  residential: 'residential', residential_link: 'residential', unclassified: 'residential', living_street: 'residential',
  service: 'service', pedestrian: 'pedestrian', footway: 'footway', path: 'path', bridleway: 'path', cycleway: 'cycleway',
  steps: 'steps', track: 'track',
};
const DROP_SERVICE = new Set(['driveway', 'parking_aisle', 'drive-through', 'emergency_access']);

export interface PlazaArea { id: number; xz: number[] }

/** `insideSf(x, z)`: the county boundary test; ways with no vertex inside it (Daly City, Marin) are dropped. */
export function loadWays(log: (s: string) => void, insideSf: (x: number, z: number) => boolean): { ways: Way[]; plazas: PlazaArea[] } {
  const ways: Way[] = [];
  const plazas: PlazaArea[] = [];
  let dropped = 0;
  const push = (w: Way) => {
    // keep ways that touch the domain
    let any = false;
    for (let k = 0; k < w.xz.length; k += 2) if (inDomain(w.xz[k], w.xz[k + 1], 16) && insideSf(w.xz[k], w.xz[k + 1])) { any = true; break; }
    if (any) ways.push(w); else dropped++;
  };
  const keysOf = (g: OsmGeomPoint[]) => g.map(p => `${p.lat},${p.lon}`);
  for (const e of elements('highways')) {
    const t = e.tags ?? {};
    const hw = t.highway;
    const cls = HW_CLASS[hw];
    if (!cls || !e.geometry || e.geometry.length < 2) continue;
    const layer = Number.parseInt(t.layer ?? '0', 10) || 0;
    if (t.tunnel && t.tunnel !== 'no') continue;
    if (layer < 0 || t.indoor === 'yes' || t.level?.startsWith('-')) continue;
    if (t.access === 'private' || t.access === 'no') { if (cls === 'service' || cls === 'footway' || cls === 'path') continue; }
    if (cls === 'service' && DROP_SERVICE.has(t.service ?? '')) continue;
    if ((hw === 'pedestrian' || hw === 'footway') && t.area === 'yes') {
      const g = e.geometry;
      if (g.length >= 4) plazas.push({ id: e.id, xz: projGeom(g.slice(0, -1)) });
      continue;
    }
    const xz = projGeom(e.geometry);
    if (cls === 'service' && polylineLength(xz) < 4.2) continue; // service ≥ 30 m real
    const bridge = !!t.bridge && t.bridge !== 'no';
    const freeway = cls === 'motorway' || (cls === 'trunk' && (bridge || layer >= 1));
    let flags = 0;
    if (bridge) flags |= ROAD_FLAG.bridge;
    if (cls === 'steps') flags |= ROAD_FLAG.steps;
    if (t.oneway === 'yes' || t.oneway === '-1') flags |= ROAD_FLAG.oneway;
    const elevated = freeway && (bridge || layer >= 1);
    if (elevated) flags |= ROAD_FLAG.deckOnly;
    else if (cls === 'motorway') flags |= ROAD_FLAG.noWalk;
    let width = LINK_W[hw] ?? STREET_ROW[cls];
    if (cls === 'steps') { const wm = Number.parseFloat(t.width ?? ''); width = Math.max(1.4, Number.isFinite(wm) ? wm * 0.14 : 0); }
    push({
      id: e.id, code: STREET_CLASS_CODE[cls], cls, width, name: t.name ?? '', flags,
      walk: !(flags & (ROAD_FLAG.deckOnly | ROAD_FLAG.noWalk)), layer: elevated ? Math.max(1, layer) : 0,
      xz, keys: keysOf(e.geometry), footway: t.footway ?? '', service: t.service ?? '',
    });
  }
  for (const e of elements('railways')) {
    const t = e.tags ?? {};
    if (e.type !== 'way' || !e.geometry || e.geometry.length < 2) continue;
    const rw = t.railway;
    if (rw !== 'tram' && rw !== 'light_rail' && rw !== 'rail') continue;
    if ((t.tunnel && t.tunnel !== 'no') || (Number.parseInt(t.layer ?? '0', 10) || 0) < 0 || t.service === 'yard') continue;
    const cable = t.cable_tram === 'cable' || /cable/i.test(t.name ?? '');
    const isRail = rw === 'rail';
    let flags = ROAD_FLAG.rail;
    if (cable) flags |= ROAD_FLAG.cable;
    if (t.bridge && t.bridge !== 'no') flags |= ROAD_FLAG.bridge;
    push({
      id: e.id, code: isRail ? RAIL_CODE : TRAM_CODE, cls: isRail ? 'rail' : 'tram', width: 1.6, name: t.name ?? '', flags,
      walk: false, layer: 0, xz: projGeom(e.geometry), keys: keysOf(e.geometry), footway: '', service: '',
    });
  }
  log(`roads: ${ways.length} ways (${dropped} outside San Francisco), ${plazas.length} pedestrian areas`);
  return { ways, plazas };
}

// ---------------------------------------------------------------------------
// Heights
// ---------------------------------------------------------------------------

/** Moving average over ±half u of arc length. */
function smoothAlong(xz: number[], y: number[], half: number): number[] {
  const n = y.length;
  const s = new Float64Array(n);
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(xz[i * 2] - xz[i * 2 - 2], xz[i * 2 + 1] - xz[i * 2 - 1]);
  const out = new Array<number>(n);
  let a = 0, b = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    while (b < n && s[b] <= s[i] + half) { sum += y[b]; b++; }
    while (s[a] < s[i] - half) { sum -= y[a]; a++; }
    out[i] = sum / (b - a);
  }
  return out;
}

/** Viaduct clearance above the ground by layer (u): 2× the player height on layer 1. */
export const deckClearance = (layer: number) => 3.4 + 1.8 * (Math.max(1, layer) - 1);

/**
 * Densified centreline with heights. `rampStart` / `rampEnd`: the chain end meets at-grade roads, so a viaduct
 * ramps down to the ground over 24 u there.
 */
export function chainHeights(xz0: number[], flags: number, layer: number, cls: string, t: Terrain, rampStart: boolean, rampEnd: boolean): { xz: number[]; y: number[] } {
  const xz = densify(xz0, 2);
  const n = xz.length / 2;
  const ground = new Array<number>(n);
  for (let i = 0; i < n; i++) ground[i] = heightAt(t, xz[i * 2], xz[i * 2 + 1]);
  let y = smoothAlong(xz, ground, cls === 'steps' ? 1.5 : 3);
  if (flags & ROAD_FLAG.deckOnly) {
    const s = new Float64Array(n);
    for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(xz[i * 2] - xz[i * 2 - 2], xz[i * 2 + 1] - xz[i * 2 - 1]);
    const L = s[n - 1], c = deckClearance(layer);
    const g2 = smoothAlong(xz, ground, 12);
    y = g2.map((g, i) => {
      let k = 1;
      if (rampStart) k = Math.min(k, s[i] / 24);
      if (rampEnd) k = Math.min(k, (L - s[i]) / 24);
      return Math.max(g, g + c * Math.max(0, Math.min(1, k)));
    });
  } else if (flags & ROAD_FLAG.bridge) {
    // walkable bridge: straight deck between its approaches, never below the ground
    const s = new Float64Array(n);
    for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(xz[i * 2] - xz[i * 2 - 2], xz[i * 2 + 1] - xz[i * 2 - 1]);
    const L = s[n - 1] || 1, y0 = y[0], y1 = y[n - 1];
    y = y.map((g, i) => Math.max(g, y0 + ((y1 - y0) * s[i]) / L));
  }
  return { xz, y };
}

/** Douglas–Peucker on (x, y, z) with separate horizontal / vertical tolerances. */
export function simplify3(xz: number[], y: number[], tolH: number, tolV: number): number[] {
  const n = y.length;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = -1, bestE = 1;
    const ax = xz[a * 2], az = xz[a * 2 + 1], bx = xz[b * 2], bz = xz[b * 2 + 1];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const px = xz[i * 2], pz = xz[i * 2 + 1];
      let tt = ((px - ax) * dx + (pz - az) * dz) / L2;
      tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
      const h = Math.sqrt(segDist2(px, pz, ax, az, bx, bz)) / tolH;
      const v = Math.abs(y[i] - (y[a] + (y[b] - y[a]) * tt)) / tolV;
      const e = Math.max(h, v);
      if (e > bestE) { bestE = e; best = i; }
    }
    if (best >= 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(xz[i * 2], y[i], xz[i * 2 + 1]);
  return out;
}

// ---------------------------------------------------------------------------
// Chains (ways merged by class + name + flags)
// ---------------------------------------------------------------------------

export interface Chain {
  code: number;
  width: number;
  name: string;
  flags: number;
  /** x, y, z triples, simplified */
  xyz: number[];
  /** member way ids */
  ways: number[];
}

/** Chains are cut where they leave San Francisco (`insideSf`), so no street runs on into Daly City or the water. */
export function buildChains(ways: Way[], t: Terrain, log: (s: string) => void, insideSf: (x: number, z: number) => boolean = () => true): Chain[] {
  // which vertex keys are touched by at-grade roads (viaduct ends ramp down there)
  const atGrade = new Set<string>();
  for (const w of ways) if (!(w.flags & ROAD_FLAG.deckOnly) && w.code !== TRAM_CODE && w.code !== RAIL_CODE) for (const k of w.keys) atGrade.add(k);
  const groups = new Map<string, Way[]>();
  for (const w of ways) {
    if (w.cls === 'footway' && (w.footway === 'sidewalk' || w.footway === 'crossing')) continue; // drawn as curb bands, not geometry
    const key = `${w.code}|${w.name}|${w.flags}|${w.layer}|${w.width}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(w);
  }
  const chains: Chain[] = [];
  for (const list of groups.values()) {
    // line merge: join at endpoints where exactly two ways of the group meet
    const endMap = new Map<string, number[]>();
    list.forEach((w, i) => { for (const k of [w.keys[0], w.keys[w.keys.length - 1]]) (endMap.get(k) ?? endMap.set(k, []).get(k)!).push(i); });
    const used = new Uint8Array(list.length);
    for (let i0 = 0; i0 < list.length; i0++) {
      if (used[i0]) continue;
      used[i0] = 1;
      let xz = list[i0].xz.slice(), keys = list[i0].keys.slice();
      const ids = [list[i0].id];
      for (const dir of [1, -1]) {
        for (let guard = 0; guard < 10000; guard++) {
          const endKey = dir === 1 ? keys[keys.length - 1] : keys[0];
          const cand = (endMap.get(endKey) ?? []).filter(j => !used[j]);
          if ((endMap.get(endKey) ?? []).length !== 2 || cand.length !== 1) break;
          const j = cand[0], w = list[j];
          used[j] = 1; ids.push(w.id);
          const fwd = w.keys[0] === endKey;
          const wxz = fwd ? w.xz : revPairs(w.xz), wk = fwd ? w.keys : w.keys.slice().reverse();
          if (dir === 1) { xz = xz.concat(wxz.slice(2)); keys = keys.concat(wk.slice(1)); }
          else {
            // prepend: the way must END at our start
            const pxz = fwd ? revPairs(w.xz) : w.xz, pk = fwd ? w.keys.slice().reverse() : w.keys;
            xz = pxz.slice(0, -2).concat(xz); keys = pk.slice(0, -1).concat(keys);
          }
        }
      }
      const w0 = list[i0];
      const rampStart = !!(w0.flags & ROAD_FLAG.deckOnly) && atGrade.has(keys[0]);
      const rampEnd = !!(w0.flags & ROAD_FLAG.deckOnly) && atGrade.has(keys[keys.length - 1]);
      const h = chainHeights(xz, w0.flags, w0.layer, w0.cls, t, rampStart, rampEnd);
      // split into runs inside SF (densified vertices are ≤ 2 u apart)
      const n = h.y.length;
      let a = 0;
      while (a < n) {
        while (a < n && !insideSf(h.xz[a * 2], h.xz[a * 2 + 1])) a++;
        let b = a;
        while (b < n && insideSf(h.xz[b * 2], h.xz[b * 2 + 1])) b++;
        if (b - a >= 2) {
          const xyz = simplify3(h.xz.slice(a * 2, b * 2), h.y.slice(a, b), 0.15, 0.06);
          if (xyz.length >= 6) chains.push({ code: w0.code, width: w0.width, name: w0.name, flags: w0.flags, xyz, ways: ids });
        }
        a = b;
      }
    }
  }
  log(`roads: ${chains.length} chains from ${ways.length} ways`);
  return chains;
}

function revPairs(p: number[]): number[] {
  const out: number[] = [];
  for (let i = p.length - 2; i >= 0; i -= 2) out.push(p[i], p[i + 1]);
  return out;
}

// ---------------------------------------------------------------------------
// Street blocks (1 u raster): land cells not covered by a public street corridor, 4-connected
// ---------------------------------------------------------------------------

const BLOCK_CLASSES = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'pedestrian']);

export interface Blocks {
  grid: Grid<Int32Array>;
  sizes: number[];
  /** fraction of each block's cells inside the hero slab */
  slabFrac: Float32Array;
  /** street corridor mask (1 u), any walkable class incl. service/steps/paths — for props and QA */
  corridor: Uint8Array;
}

export function buildBlocks(ways: Way[], land: Land, log: (s: string) => void): Blocks {
  const cols = DOMAIN.x1 - DOMAIN.x0, rows = DOMAIN.z1 - DOMAIN.z0;
  const road = new Uint8Array(cols * rows);
  const corridor = new Uint8Array(cols * rows);
  const g = Grid.i32(DOMAIN.x0, DOMAIN.z0, 1, cols, rows);
  for (const w of ways) {
    if (w.flags & ROAD_FLAG.deckOnly) continue;
    if (BLOCK_CLASSES.has(w.cls)) paintCorridor(g, w.xz, w.width / 2, i => { road[i] = 1; });
    if (w.walk || w.flags & ROAD_FLAG.noWalk) paintCorridor(g, w.xz, w.width / 2, i => { corridor[i] = 1; });
  }
  const landAt = (i: number) => land.grid.at(g.cx(i % cols), g.cz(Math.floor(i / cols))) === 1;
  const { labels, sizes } = labelComponents(cols, rows, i => !road[i] && landAt(i));
  g.data.set(labels);
  const inSl = new Float32Array(sizes.length);
  for (let j = 0; j < rows; j++) {
    const z = g.cz(j);
    if (z < -110 || z > 120) continue;
    for (let i = 0; i < cols; i++) {
      const b = labels[j * cols + i];
      if (b && inSlab(g.cx(i), z)) inSl[b]++;
    }
  }
  for (let b = 1; b < sizes.length; b++) inSl[b] /= sizes[b];
  log(`blocks: ${sizes.length - 1} street blocks`);
  return { grid: g, sizes, slabFrac: inSl, corridor };
}

/** Block id at a point (0 = street / water); searches a small neighbourhood when the point sits on a corridor. */
export function blockAt(b: Blocks, x: number, z: number, r = 3): number {
  const v = b.grid.at(x, z);
  if (v) return v;
  const count = new Map<number, number>();
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const w = b.grid.at(x + dx, z + dz); if (w) count.set(w, (count.get(w) ?? 0) + 1); }
  let best = 0, bn = 0;
  for (const [k, n] of count) if (n > bn) { bn = n; best = k; }
  return best;
}

// ---------------------------------------------------------------------------
// Street segment index (nearest street direction, carving)
// ---------------------------------------------------------------------------

export interface SegIndex { hash: SpatialHash; seg: Float64Array; width: Float32Array; code: Uint8Array; count: number }

export function segIndex(ways: Way[], filter: (w: Way) => boolean): SegIndex {
  const segs: number[] = [], widths: number[] = [], codes: number[] = [];
  for (const w of ways) {
    if (!filter(w)) continue;
    for (let k = 2; k < w.xz.length; k += 2) { segs.push(w.xz[k - 2], w.xz[k - 1], w.xz[k], w.xz[k + 1]); widths.push(w.width); codes.push(w.code); }
  }
  const hash = new SpatialHash(8);
  const n = widths.length;
  for (let i = 0; i < n; i++) {
    const hw = widths[i] / 2;
    hash.insert(i, Math.min(segs[i * 4], segs[i * 4 + 2]) - hw, Math.min(segs[i * 4 + 1], segs[i * 4 + 3]) - hw, Math.max(segs[i * 4], segs[i * 4 + 2]) + hw, Math.max(segs[i * 4 + 1], segs[i * 4 + 3]) + hw);
  }
  return { hash, seg: Float64Array.from(segs), width: Float32Array.from(widths), code: Uint8Array.from(codes), count: n };
}

/** Nearest segment within r: its unit direction and distance. */
export function nearestSeg(ix: SegIndex, x: number, z: number, r: number): { i: number; d: number; dx: number; dz: number } | null {
  let best = -1, bd = r * r;
  for (const i of ix.hash.query(x - r, z - r, x + r, z + r)) {
    const d = segDist2(x, z, ix.seg[i * 4], ix.seg[i * 4 + 1], ix.seg[i * 4 + 2], ix.seg[i * 4 + 3]);
    if (d < bd) { bd = d; best = i; }
  }
  if (best < 0) return null;
  const dx = ix.seg[best * 4 + 2] - ix.seg[best * 4], dz = ix.seg[best * 4 + 3] - ix.seg[best * 4 + 1], L = Math.hypot(dx, dz) || 1;
  return { i: best, d: Math.sqrt(bd), dx: dx / L, dz: dz / L };
}
