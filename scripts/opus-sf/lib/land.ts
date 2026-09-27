// Step 1 (plan §4.1): SF land = OSM coastline ∩ county boundary (relation 111968), rasterised at 0.5 u in the city
// frame; plus the waterfront-warp measurement (§5.1 rule 3) against the hero seawall.
import { WATERFRONT_WARP, projectRaw, unproject, warpOffset, type WarpEnd } from '../../../src/opus-bay/core/geo';
import { at } from '../../../src/opus-bay/data/district';
import { type Ring, ringArea, simplifyRing, area2 } from './geom';
import { type DemHeader, demAt, elements, joinRings, type OsmGeomPoint } from './io';
import { Grid, fillRings, drawSegment, flood, labelComponents, traceContours } from './raster';
import { DOMAIN, SLAB, projGeom, inSlab } from './world';

export const LAND_CELL = 0.5;

export interface Coast { ways: { id: number; geom: OsmGeomPoint[] }[] }

export function loadCoast(): Coast {
  const seen = new Set<number>();
  const ways: Coast['ways'] = [];
  for (const layer of ['landcover', 'backdrop']) for (const e of elements(layer)) {
    if (e.type !== 'way' || e.tags?.natural !== 'coastline' || !e.geometry || seen.has(e.id)) continue;
    seen.add(e.id);
    ways.push({ id: e.id, geom: e.geometry });
  }
  return { ways };
}

export function loadBoundaryRings(): OsmGeomPoint[][] {
  for (const e of elements('boundary')) {
    if (e.type !== 'relation' || e.id !== 111968) continue;
    const outer = (e.members ?? []).filter(m => m.type === 'way' && m.role === 'outer' && m.geometry).map(m => m.geometry!);
    return joinRings(outer);
  }
  throw new Error('boundary relation 111968 not found');
}

// ---------------------------------------------------------------------------
// Warp measurement
// ---------------------------------------------------------------------------

function segIntersect(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): { t: number; u: number } | null {
  const ex = bx - ax, ez = bz - az, fx = dx - cx, fz = dz - cz;
  const den = ex * fz - ez * fx;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((cx - ax) * fz - (cz - az) * fx) / den, u = ((cx - ax) * ez - (cz - az) * ex) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { t, u } : null;
}

export interface WarpMeasure { ends: WarpEnd[]; west: { hero: [number, number]; coast: [number, number]; gap: number } | null; notes: string[] }

/** Hero seawall (district.ts at(st, 5)) and the real coast where they cross the slab edge. */
export function measureWarp(coast: Coast): WarpMeasure {
  const seawall: number[] = [];
  for (let st = -140; st <= 500; st += 0.5) { const p = at(st, 5); seawall.push(p.x, p.z); }
  const coastSegs: number[][] = [];
  for (const w of coast.ways) {
    const pts = w.geom.map(g => projectRaw(g.lat, g.lon));
    for (let i = 1; i < pts.length; i++) coastSegs.push([pts[i - 1].x, pts[i - 1].z, pts[i].x, pts[i].z]);
  }
  const n = SLAB.length / 2;
  const crossings: { x: number; z: number; edge: number }[] = [];
  for (let k = 2; k < seawall.length; k += 2) {
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const r = segIntersect(seawall[k - 2], seawall[k - 1], seawall[k], seawall[k + 1], SLAB[j * 2], SLAB[j * 2 + 1], SLAB[i * 2], SLAB[i * 2 + 1]);
      if (r) crossings.push({ x: seawall[k - 2] + (seawall[k] - seawall[k - 2]) * r.t, z: seawall[k - 1] + (seawall[k + 1] - seawall[k - 1]) * r.t, edge: i });
    }
  }
  crossings.sort((a, b) => b.x - a.x);
  const notes: string[] = [];
  const coastOnEdge = (edge: number, hx: number, hz: number) => {
    const j = (edge + n - 1) % n;
    let best: { x: number; z: number; dir: [number, number]; d: number } | null = null;
    for (const [ax, az, bx, bz] of coastSegs) {
      const r = segIntersect(ax, az, bx, bz, SLAB[j * 2], SLAB[j * 2 + 1], SLAB[edge * 2], SLAB[edge * 2 + 1]);
      if (!r) continue;
      const x = ax + (bx - ax) * r.t, z = az + (bz - az) * r.t, d = Math.hypot(x - hx, z - hz);
      const L = Math.hypot(bx - ax, bz - az);
      if (!best || d < best.d) best = { x, z, d, dir: [(bx - ax) / L, (bz - az) / L] };
    }
    return best;
  };
  const ends: WarpEnd[] = [];
  const east = crossings[0];
  const ec = coastOnEdge(east.edge, east.x, east.z);
  if (!ec) throw new Error('warp: no real coast crossing on the east slab edge');
  // direction along the coast away from the hero: average of real coast points within 40 u of the crossing, outside the slab
  let sx = 0, sz = 0;
  for (const [ax, az] of coastSegs) {
    const d = Math.hypot(ax - ec.x, az - ec.z);
    if (d > 4 && d < 40 && !inSlab(ax, az)) { sx += (ax - ec.x) / d; sz += (az - ec.z) / d; }
  }
  const L = Math.hypot(sx, sz) || 1;
  const tx = sx / L, tz = sz / L;
  // land lies to the right of the OSM coastline direction in the x/z frame (the projection flips orientation)
  const rx = ec.dir[1], rz = -ec.dir[0];
  // m ⟂ t, on the same side as the OSM right normal
  let mx = -tz, mz = tx;
  if (mx * rx + mz * rz < 0) { mx = -mx; mz = -mz; }
  const r3 = (v: number) => Math.round(v * 1000) / 1000, r1 = (v: number) => Math.round(v * 10) / 10;
  ends.push({ id: 'east', ox: r1(ec.x), oz: r1(ec.z), dx: r1(east.x - ec.x), dz: r1(east.z - ec.z), tx: r3(tx), tz: r3(tz), mx: r3(mx), mz: r3(mz) });
  notes.push(`east: hero seawall meets the slab edge at (${east.x.toFixed(1)}, ${east.z.toFixed(1)}), the real coast at (${ec.x.toFixed(1)}, ${ec.z.toFixed(1)})`);
  // west end: measured for the report only (the hero seawall is LANDWARD of the real coast there; no warp, see report)
  const west = crossings[crossings.length - 1];
  const wc = coastOnEdge(west.edge, west.x, west.z);
  const westOut = wc ? { hero: [west.x, west.z] as [number, number], coast: [wc.x, wc.z] as [number, number], gap: Math.hypot(west.x - wc.x, west.z - wc.z) } : null;
  if (westOut) notes.push(`west: hero seawall meets the slab edge at (${west.x.toFixed(1)}, ${west.z.toFixed(1)}), the real coast at (${wc!.x.toFixed(1)}, ${wc!.z.toFixed(1)}) — ${westOut.gap.toFixed(1)} u apart along the edge, no warp`);
  return { ends, west: westOut, notes };
}

/** Compare with core/geo.ts WATERFRONT_WARP; returns a message when they disagree. */
export function checkPinnedWarp(m: WarpMeasure): string | null {
  const a = m.ends, b = WATERFRONT_WARP;
  const same = a.length === b.length && a.every((e, i) => {
    const p = b[i];
    return e.id === p.id && Math.abs(e.ox - p.ox) < 0.051 && Math.abs(e.oz - p.oz) < 0.051 && Math.abs(e.dx - p.dx) < 0.051 && Math.abs(e.dz - p.dz) < 0.051
      && Math.abs(e.tx - p.tx) < 0.0011 && Math.abs(e.tz - p.tz) < 0.0011 && Math.abs(e.mx - p.mx) < 0.0011 && Math.abs(e.mz - p.mz) < 0.0011;
  });
  return same ? null : `WATERFRONT_WARP in core/geo.ts is stale; measured:\n${JSON.stringify(a)}`;
}

/** Largest displacement-gradient norm of the pinned warp on a 1 u grid around each end (must stay < 1: no folds). */
export function warpMaxGradient(): number {
  let g = 0;
  for (const e of WATERFRONT_WARP) {
    for (let x = e.ox - 250; x <= e.ox + 250; x += 1) for (let z = e.oz - 250; z <= e.oz + 250; z += 1) {
      const a = warpOffset(x, z), bx = warpOffset(x + 0.5, z), bz = warpOffset(x, z + 0.5);
      const j11 = (bx.x - a.x) / 0.5, j21 = (bx.z - a.z) / 0.5, j12 = (bz.x - a.x) / 0.5, j22 = (bz.z - a.z) / 0.5;
      g = Math.max(g, Math.hypot(j11, j21, j12, j22));
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Land raster
// ---------------------------------------------------------------------------

export interface Land {
  grid: Grid<Uint8Array>;
  /** land area inside the boundary (km², real) */
  areaKm2: number;
  boundary: Ring[];
  /** 1 inside the county boundary (same grid as `grid`), land or water */
  inside: Grid<Uint8Array>;
}

export function buildLand(coast: Coast, boundaryGeom: OsmGeomPoint[][], dem: { hdr: DemHeader; data: Float32Array }, log: (s: string) => void): Land {
  const cols = (DOMAIN.x1 - DOMAIN.x0) / LAND_CELL, rows = (DOMAIN.z1 - DOMAIN.z0) / LAND_CELL;
  const g = Grid.u8(DOMAIN.x0, DOMAIN.z0, LAND_CELL, cols, rows);
  // 1 = coastline wall
  const wall = new Uint8Array(cols * rows);
  let segs = 0;
  for (const w of coast.ways) {
    const p = projGeom(w.geom);
    for (let k = 2; k < p.length; k += 2) {
      if (Math.max(p[k - 2], p[k]) < DOMAIN.x0 - 2 || Math.min(p[k - 2], p[k]) > DOMAIN.x1 + 2 || Math.max(p[k - 1], p[k + 1]) < DOMAIN.z0 - 2 || Math.min(p[k - 1], p[k + 1]) > DOMAIN.z1 + 2) continue;
      drawSegment(g, p[k - 2], p[k - 1], p[k], p[k + 1], i => { wall[i] = 1; });
      segs++;
    }
  }
  log(`coastline: ${coast.ways.length} ways, ${segs} segments in the domain`);
  // water seeds: a few points in open water (Pacific, Golden Gate, north Bay, east Bay). Deep-DEM seeds are unsafe:
  // lake bathymetry (Lake Merced) reads below −10 m and would flood the city.
  const SEEDS: [number, number][] = [[-824, 1904], [-866, 508], [176, -196], [1376, 104], [-600, 250]];
  const seeds: number[] = [];
  for (const [x, z] of SEEDS) {
    const i = g.col(x), j = g.row(z), idx = j * cols + i;
    const ll = unproject({ x, z });
    const h = demAt(dem, ll.lat, ll.lng);
    if (wall[idx] || h > -2) throw new Error(`water seed (${x}, ${z}) is not open water (DEM ${h})`);
    seeds.push(idx);
  }
  const water = new Uint8Array(cols * rows);
  const nWater = flood(cols, rows, seeds, i => !wall[i], water);
  log(`land: ${seeds.length} water seeds flooded ${(nWater * LAND_CELL * LAND_CELL / 1e6).toFixed(2)} M u²`);
  // wall cells take the majority of their classified neighbours (ties → land)
  for (let idx = 0; idx < cols * rows; idx++) {
    if (!wall[idx]) continue;
    const i = idx % cols;
    let w = 0, l = 0;
    for (const n of [i > 0 ? idx - 1 : -1, i < cols - 1 ? idx + 1 : -1, idx - cols, idx + cols]) {
      if (n < 0 || n >= cols * rows || wall[n]) continue;
      if (water[n]) w++; else l++;
    }
    if (w > l) water[idx] = 2;
  }
  // county boundary
  const boundary = boundaryGeom.map(r => projGeom(r));
  const insideG = Grid.u8(DOMAIN.x0, DOMAIN.z0, LAND_CELL, cols, rows);
  const inside = insideG.data;
  fillRings(g, boundary, i => { inside[i] = 1; });
  for (let idx = 0; idx < cols * rows; idx++) {
    if (water[idx] || !inside[idx]) continue;
    g.data[idx] = 1;
  }
  // the county line follows the Marin shore of the Golden Gate: drop Marin cells inside it (as sf-data/tools/landmask.py)
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const idx = j * cols + i;
    if (!g.data[idx]) continue;
    const ll = unproject({ x: g.cx(i), z: g.cz(j) });
    if (ll.lat > 37.815 && ll.lng < -122.44) g.data[idx] = 0;
  }
  // drop specks (bridge piers, rocks) under 150 u², and slivers of other counties' islands cut by the county line
  // (a component keeping < 30 % of its coastline-bounded landmass: parts of Angel Island, the Alameda shore)
  const pre = labelComponents(cols, rows, i => !water[i]);
  const { labels, sizes } = labelComponents(cols, rows, i => g.data[i] === 1);
  const preOf = new Int32Array(sizes.length);
  for (let idx = 0; idx < cols * rows; idx++) if (labels[idx] && !preOf[labels[idx]]) preOf[labels[idx]] = pre.labels[idx];
  let dropped = 0, slivers = 0;
  for (let idx = 0; idx < cols * rows; idx++) {
    const l = labels[idx];
    if (!l) continue;
    if (sizes[l] < 600) { g.data[idx] = 0; dropped++; }
    else if (sizes[l] < pre.sizes[preOf[l]] * 0.3 && sizes[l] < 200000) { g.data[idx] = 0; slivers++; }
  }
  log(`land: ${slivers} cells of county-line slivers dropped`);
  let landCells = 0;
  for (let idx = 0; idx < cols * rows; idx++) if (g.data[idx]) landCells++;
  const areaKm2 = (landCells * LAND_CELL * LAND_CELL) / (0.14 * 0.14) / 1e6;
  log(`land: ${areaKm2.toFixed(2)} km² (${sizes.length - 1} components, ${dropped} speck cells dropped)`);
  return { grid: g, areaKm2, boundary, inside: insideG };
}

/** Land / water rings for a rectangle (paint in order: area descending; land = outer, water = hole). */
export function landRings(land: Land, x0: number, z0: number, x1: number, z1: number, tol: number, pad: number): { rings: Ring[]; isLand: boolean[] } {
  const g = land.grid;
  const i0 = g.col(x0) - pad, j0 = g.row(z0) - pad, i1 = g.col(x1 - 1e-6) + pad, j1 = g.row(z1 - 1e-6) + pad;
  const w = i1 - i0 + 1, h = j1 - j0 + 1;
  const v = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const gi = i0 + i, gj = j0 + j;
    v[j * w + i] = gi >= 0 && gj >= 0 && gi < g.cols && gj < g.rows ? g.data[gj * g.cols + gi] : 0;
  }
  const raw = traceContours(v, w, h, g.cx(i0), g.cz(j0), g.cell);
  const out: { r: Ring; a: number; land: boolean }[] = [];
  for (const r of raw) {
    const s = simplifyRing(r, tol);
    if (s.length < 6) continue;
    const a = ringArea(s);
    if (a < 2) continue;
    out.push({ r: s, a, land: area2(r) > 0 });
  }
  out.sort((a, b) => b.a - a.a);
  return { rings: out.map(o => o.r), isLand: out.map(o => o.land) };
}

export const isLandAt = (land: Land, x: number, z: number) => land.grid.at(x, z) === 1;
