// Step 4 + 5 (plan §4.4, §4.5): OSM footprints → heights → lot merging along block faces → street carving →
// ≤ 12-vertex toy footprints with style / roof / palette → hero-seam ownership.
import fs from 'node:fs';
import path from 'node:path';
import { buildingH } from '../../../src/opus-bay/core/geo';
import { COIT_POS, DISTRICT, project } from '../../../src/opus-bay/data/district';
import { BUILDING_FLAG, ROOFS, STYLES, type SfRoof, type SfStyle } from '../../../src/opus-bay/world/sf/format';
import { type Areas, onPier } from './areas';
import {
  type Ring, SpatialHash, area2, bbox, ccw, centroid, cleanRing, clipHalf, convexHull, distToRing, pointInRing, ringArea, segDist2, simplifyRing, simplifyToMax,
} from './geom';
import { RAW, SF_DATA, elements, joinRings } from './io';
import { Grid, fillRings, traceContours } from './raster';
import { type Land } from './land';
import { type Blocks, type SegIndex, blockAt, nearestSeg } from './roads';
import { PALETTES, type UseClass, WARM_Z, pickPalette, roofFor, styleFor } from './styles';
import { type Terrain, minGround } from './terrain';
import { type Zones, zoneIndexAt } from './zones';
import { inDomain, inSlab, projGeom } from './world';

const M2 = 0.14 * 0.14; // u² per m²
const SKIP_BUILDING = new Set(['no', 'roof', 'shed', 'garage', 'garages', 'carport', 'construction', 'hut', 'container', 'tent', 'static_caravan', 'houseboat', 'ruins', 'collapsed', 'bunker', 'proposed', 'demolished', 'razed']);
const COMMERCIAL = new Set(['commercial', 'retail', 'office', 'industrial', 'warehouse', 'hotel', 'supermarket', 'manufacture', 'hangar', 'train_station', 'transportation', 'parking', 'service', 'storage_tank', 'fire_station', 'kiosk', 'data_center', 'factory']);
const CIVIC = new Set(['school', 'church', 'cathedral', 'chapel', 'mosque', 'synagogue', 'temple', 'hospital', 'university', 'college', 'public', 'civic', 'government', 'museum', 'library', 'stadium', 'kindergarten', 'religious', 'grandstand', 'shrine', 'pavilion']);
const RESIDENTIAL = new Set(['apartments', 'residential', 'house', 'detached', 'semidetached_house', 'terrace', 'dormitory', 'bungalow']);

export interface Bld {
  osmId: number;
  relation: boolean;
  /** CCW from above (area2 < 0) */
  ring: Ring;
  area: number;
  cx: number; cz: number;
  heightM: number;
  hSrc: number;
  use: UseClass;
  residentialTag: boolean;
  church: boolean;
  roofTag: string;
  onPier: boolean;
  landmark: boolean;
  block: number;
  members: number;
  carved: boolean;
  name: string;
  /** mean area of the merged OSM lots (u²) — style follows the lot, not the merged row */
  lotArea: number;
}

function parseHeight(v?: string): number {
  if (!v) return Number.NaN;
  const s = v.trim().toLowerCase();
  const num = Number.parseFloat(s.replace(',', '.'));
  if (!Number.isFinite(num)) return Number.NaN;
  return /ft|'|feet/.test(s) ? num * 0.3048 : num;
}

export interface LandmarkIds { all: Set<string>; hero: Set<string>; structures: Set<string> }
export function landmarkOsmIds(): LandmarkIds {
  const doc = JSON.parse(fs.readFileSync(path.join(SF_DATA, 'landmarks.json'), 'utf8')) as { landmarks: { id: string; category: string; inCurrentDistrict: boolean; osm: { type: string; id: number } | null }[] };
  const all = new Set<string>(), hero = new Set<string>(), structures = new Set<string>();
  for (const l of doc.landmarks) {
    if (!l.osm) continue;
    const k = `${l.osm.type}/${l.osm.id}`;
    all.add(k);
    if (l.inCurrentDistrict) hero.add(k);
    // lattice towers and bridges are built procedurally by the landmarks lane; a footprint prism would be wrong
    if (l.category === 'tower' || l.category === 'bridge') structures.add(k);
  }
  return { all, hero, structures };
}

export function loadBuildings(land: Land, areas: Areas, blocks: Blocks, lm: LandmarkIds, log: (s: string) => void): Bld[] {
  const joinDoc = JSON.parse(fs.readFileSync(path.join(RAW, 'osm-datasf-height-join.json'), 'utf8')) as { join: Record<string, [number, number]> };
  const lidar = joinDoc.join;
  const out: Bld[] = [];
  const stat = { total: 0, skipTag: 0, tiny: 0, water: 0, outside: 0, heroLandmark: 0, src: [0, 0, 0, 0] };
  for (const e of elements('buildings')) {
    const t = e.tags ?? {};
    const b = t.building;
    if (!b) continue; // building:part only
    stat.total++;
    if (SKIP_BUILDING.has(b) || t.location === 'underground' || (Number.parseInt(t.layer ?? '0', 10) || 0) < 0) { stat.skipTag++; continue; }
    let geom = e.geometry;
    if (e.type === 'relation') {
      const outers = joinRings((e.members ?? []).filter(m => m.type === 'way' && m.role === 'outer' && m.geometry).map(m => m.geometry!));
      if (!outers.length) continue;
      let best = 0, bestA = -1;
      outers.forEach((o, i) => { const a = ringArea(projGeom(o)); if (a > bestA) { bestA = a; best = i; } });
      geom = outers[best];
    } else if (geom && geom.length >= 4) geom = geom.slice(0, -1);
    if (!geom || geom.length < 3) continue;
    const key = `${e.type}/${e.id}`;
    if (lm.hero.has(key) || lm.structures.has(key)) { stat.heroLandmark++; continue; }
    if (t['bridge:support'] || t.man_made === 'bridge' || b === 'bridge' || t.man_made === 'mast' || t.man_made === 'tower') { stat.skipTag++; continue; }
    const ring = ccw(cleanRing(projGeom(geom), 0.005));
    if (ring.length < 6) continue;
    const area = ringArea(ring);
    if (area < 0.4) { stat.tiny++; continue; }
    const [cx, cz] = centroid(ring);
    if (!inDomain(cx, cz)) { stat.outside++; continue; }
    const pier = land.grid.at(cx, cz) !== 1 && onPier(areas, cx, cz);
    if (pier && parseHeight(t.height) > 30) { stat.water++; continue; } // bridge towers / piers over water, not pier sheds
    if (land.grid.at(cx, cz) !== 1 && !pier) {
      // tolerate footprints straddling the shore: keep when most vertices are on land
      let on = 0;
      for (let k = 0; k < ring.length; k += 2) if (land.grid.at(ring[k], ring[k + 1]) === 1) on++;
      if (on < ring.length / 4 || land.inside.at(cx, cz) !== 1) { stat.water++; continue; }
    }
    // height: OSM height → DataSF LiDAR median (not for post-2010 sites) → levels × 3.2 → 6.6 m
    let heightM = parseHeight(t.height), hSrc = 0;
    const levels = Number.parseFloat(t['building:levels'] ?? '');
    if (!(heightM > 1.5)) {
      const lid = e.type === 'way' ? lidar[String(e.id)] : undefined;
      const since = Number.parseInt((t.start_date ?? t.construction_date ?? '').slice(0, 4), 10);
      const levelsM = Number.isFinite(levels) ? levels * 3.2 : 0;
      if (lid && lid[1] > 2.5 && !(since >= 2010) && !(levelsM > lid[1] * 1.6)) { heightM = lid[1]; hSrc = 1; }
      else if (levelsM > 0) { heightM = levelsM; hSrc = 2; }
      else { heightM = 6.6; hSrc = 3; }
    }
    stat.src[hSrc]++;
    const use: UseClass = COMMERCIAL.has(b) || t.shop || t.office || (t.amenity && ['restaurant', 'cafe', 'bank', 'fuel', 'fast_food', 'pharmacy', 'bar'].includes(t.amenity)) ? 'commercial'
      : CIVIC.has(b) || (t.amenity && ['school', 'place_of_worship', 'hospital', 'library', 'college', 'university', 'townhall', 'community_centre', 'fire_station', 'police'].includes(t.amenity)) ? 'civic'
      : heightM >= 13 || b === 'apartments' ? 'flat' : 'house';
    out.push({
      osmId: e.id, relation: e.type === 'relation', ring, area, cx, cz, heightM: Math.min(heightM, 400), hSrc, use,
      residentialTag: RESIDENTIAL.has(b), church: b === 'church' || b === 'cathedral' || b === 'chapel' || t.amenity === 'place_of_worship',
      roofTag: t['roof:shape'] ?? '', onPier: pier, landmark: lm.all.has(key), block: blockAt(blocks, cx, cz), members: 1, carved: false, name: t.name ?? '', lotArea: area,
    });
  }
  log(`buildings: ${stat.total} OSM, kept ${out.length} (skipped by tag ${stat.skipTag}, < 20 m² ${stat.tiny}, water / other county ${stat.water}, outside ${stat.outside}, hero / structure landmarks ${stat.heroLandmark}); height from OSM ${stat.src[0]}, LiDAR ${stat.src[1]}, levels ${stat.src[2]}, default ${stat.src[3]}`);
  return out;
}

// ---------------------------------------------------------------------------
// Lot merging (§2.3 D4)
// ---------------------------------------------------------------------------

/**
 * Union of footprints by rasterising at 0.08 u and closing (dilate + erode, square element) over `close` u, so
 * party walls with hairline gaps or small overlaps and narrow side passages all fuse. Largest outer contour, holes
 * (light wells, courtyards) dropped.
 */
export function rasterUnion(rings: Ring[], close: number): Ring | null {
  const cell = 0.08, rc = Math.max(1, Math.ceil(close / cell));
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const r of rings) { const [a, b, c, d] = bbox(r); x0 = Math.min(x0, a); z0 = Math.min(z0, b); x1 = Math.max(x1, c); z1 = Math.max(z1, d); }
  const pad = (rc + 2) * cell;
  x0 -= pad; z0 -= pad; x1 += pad; z1 += pad;
  const w = Math.ceil((x1 - x0) / cell), h = Math.ceil((z1 - z0) / cell);
  if (w * h > 4e6) return null;
  const g = Grid.u8(x0, z0, cell, w, h);
  for (const r of rings) fillRings(g, [r], i => { g.data[i] = 1; });
  const run = (src: Uint8Array, dilate: boolean) => {
    const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let v = dilate ? 0 : 1;
      for (let k = Math.max(0, i - rc); k <= Math.min(w - 1, i + rc); k++) { const s2 = src[j * w + k]; if (dilate ? s2 > v : s2 < v) v = s2; }
      tmp[j * w + i] = v;
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let v = dilate ? 0 : 1;
      for (let k = Math.max(0, j - rc); k <= Math.min(h - 1, j + rc); k++) { const s2 = tmp[k * w + i]; if (dilate ? s2 > v : s2 < v) v = s2; }
      out[j * w + i] = v;
    }
    return out;
  };
  const closed = run(run(g.data, true), false);
  for (let i = 0; i < closed.length; i++) if (g.data[i]) closed[i] = 1;
  const contours = traceContours(closed, w, h, g.cx(0), g.cz(0), cell);
  let best: Ring | null = null, bestA = 0;
  for (const c of contours) { if (area2(c) <= 0) continue; const a = ringArea(c); if (a > bestA) { bestA = a; best = c; } }
  if (!best) return null;
  const r = ccw(cleanRing(simplifyRing(best, 0.05), 0.01));
  return r.length >= 6 ? r : null;
}

function extentAlongAll(rings: Ring[], dx: number, dz: number) {
  let lo = Infinity, hi = -Infinity;
  for (const r of rings) for (let k = 0; k < r.length; k += 2) { const t = r[k] * dx + r[k + 1] * dz; if (t < lo) lo = t; if (t > hi) hi = t; }
  return hi - lo;
}

/**
 * Merge while a group's frontage is under MERGE_FRONTAGE (4.6 u = the hero's toy lot, district.ts:894), never beyond MERGE_CAP;
 * toy heights within ×1.35.
 * Besides true shared walls, side gaps up to MERGE_GAP (3.2 m real) between facing walls also merge, because much of
 * the housing stock stands with narrow side passages rather than party walls; a second pass lets stranded small
 * groups (< 2.5 u) join across gaps up to MERGE_GAP2.
 */
export const MERGE_FRONTAGE = 4.6, MERGE_CAP = 7, MERGE_H_RATIO = 1.35, MERGE_GAP = 0.45, MERGE_GAP2 = 0.8;
/** single footprints under this (m²) standing > 4 u behind the street edge are dropped (back cottages, garages) */
export const ACCESSORY_M2 = 90;

export function mergeLots(list: Bld[], streets: SegIndex, log: (s: string) => void): Bld[] {
  // facing walls: anti-parallel edges ≤ MERGE_GAP2 apart; touching (≤ 0.035 u) needs ≥ 0.07 u overlap, gaps ≥ 0.3 u
  const edgeOwner: number[] = [], edgeXZ: number[] = [];
  const hash = new SpatialHash(2);
  list.forEach((b, i) => {
    const n = b.ring.length / 2;
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n;
      const e = edgeOwner.length;
      edgeOwner.push(i); edgeXZ.push(b.ring[k * 2], b.ring[k * 2 + 1], b.ring[j * 2], b.ring[j * 2 + 1]);
      const m = MERGE_GAP2 + 0.05;
      hash.insert(e, Math.min(b.ring[k * 2], b.ring[j * 2]) - m, Math.min(b.ring[k * 2 + 1], b.ring[j * 2 + 1]) - m, Math.max(b.ring[k * 2], b.ring[j * 2]) + m, Math.max(b.ring[k * 2 + 1], b.ring[j * 2 + 1]) + m);
    }
  });
  const pairs = new Map<number, { a: number; b: number; len: number; dx: number; dz: number; gapD: number }>();
  const q = new Set<number>();
  for (let e = 0; e < edgeOwner.length; e++) {
    const A = edgeOwner[e];
    const ax = edgeXZ[e * 4], az = edgeXZ[e * 4 + 1], bx = edgeXZ[e * 4 + 2], bz = edgeXZ[e * 4 + 3];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 0.07) continue;
    const dx = (bx - ax) / L, dz = (bz - az) / L;
    q.clear();
    hash.query(Math.min(ax, bx) - 0.05, Math.min(az, bz) - 0.05, Math.max(ax, bx) + 0.05, Math.max(az, bz) + 0.05, q);
    for (const f of q) {
      const B = edgeOwner[f];
      if (B <= A) continue;
      const cx = edgeXZ[f * 4], cz = edgeXZ[f * 4 + 1], ex = edgeXZ[f * 4 + 2], ez = edgeXZ[f * 4 + 3];
      const M = Math.hypot(ex - cx, ez - cz);
      if (M < 0.07) continue;
      if (((ex - cx) * dx + (ez - cz) * dz) / M > -0.97) continue;
      const d0 = Math.abs((cx - ax) * dz - (cz - az) * dx), d1 = Math.abs((ex - ax) * dz - (ez - az) * dx);
      if (d0 > MERGE_GAP2 || d1 > MERGE_GAP2) continue;
      const touching = d0 <= 0.035 && d1 <= 0.035;
      const t0 = (cx - ax) * dx + (cz - az) * dz, t1 = (ex - ax) * dx + (ez - az) * dz;
      const ov = Math.min(L, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1));
      if (ov < (touching ? 0.07 : 0.3)) continue;
      const k = A * 262144 + B, gd = Math.max(d0, d1);
      const p = pairs.get(k);
      if (p) { p.len += ov; if (gd < p.gapD) { p.gapD = gd; p.dx = dx; p.dz = dz; } } else pairs.set(k, { a: A, b: B, len: ov, dx, dz, gapD: gd });
    }
  }
  const parent = list.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const mem = list.map((_, i) => [i]);
  const hA = list.map(b => b.heightM * b.area), area = list.map(b => b.area), best = list.map((_, i) => i), gap = list.map(() => 0);
  const street = list.map(b => nearestSeg(streets, b.cx, b.cz, 30));
  // touching walls first, then narrow gaps; longer shared walls first
  const sorted = [...pairs.values()].sort((p, s) => (p.gapD > 0.035 ? 1 : 0) - (s.gapD > 0.035 ? 1 : 0) || s.len - p.len);
  const mclass = (b: Bld) => (b.use === 'commercial' ? 'c' : b.use === 'civic' ? 'x' : 'r');
  let merged = 0;
  const why: Record<string, number> = {};
  const no = (k: string) => { why[k] = (why[k] ?? 0) + 1; };
  for (const pass of [1, 2]) for (const p of sorted) {
    if (pass === 1 ? p.gapD > MERGE_GAP : p.gapD <= MERGE_GAP) continue;
    const ga = find(p.a), gb = find(p.b);
    if (ga === gb) continue;
    const A = list[p.a], B = list[p.b];
    if (mclass(A) !== mclass(B) || A.use === 'civic' || A.onPier || B.onPier || A.landmark || B.landmark) { no('class'); continue; }
    if (!A.block || A.block !== B.block) { no('block'); continue; }
    const s = street[ga] ?? street[gb];
    if (s && Math.abs(p.dx * s.dx + p.dz * s.dz) > 0.5) { no('backToBack'); continue; } // back-to-back lots share a wall parallel to the street
    const ha = buildingH(hA[ga] / area[ga]), hb = buildingH(hA[gb] / area[gb]);
    if (Math.max(ha, hb) / Math.min(ha, hb) > MERGE_H_RATIO) { no('height'); continue; }
    const fx = s ? s.dx : 1, fz = s ? s.dz : 0;
    const ra = mem[ga].map(i => list[i].ring), rb = mem[gb].map(i => list[i].ring);
    const fa = extentAlongAll(ra, fx, fz), fb = extentAlongAll(rb, fx, fz);
    // a finished group still takes a small leftover lot (< 2.2 u), so rows do not end in stranded slivers
    if ((fa >= MERGE_FRONTAGE || fb >= MERGE_FRONTAGE) && Math.min(fa, fb) >= 2.2) { no('frontage'); continue; }
    if (pass === 2 && Math.min(fa, fb) >= 2.5) { no('frontage2'); continue; }
    if (extentAlongAll([...ra, ...rb], fx, fz) > MERGE_CAP) { no('cap'); continue; }
    // no bloat: the pair's convex hull must stay close to their summed areas (offset / L-shaped neighbours stay apart)
    const hull = convexHull([...A.ring, ...B.ring]);
    if (ringArea(hull) > (A.area + B.area) * (pass === 1 ? 1.3 : 1.4)) { no('geometry'); continue; }
    parent[gb] = ga;
    mem[ga] = mem[ga].concat(mem[gb]); hA[ga] += hA[gb]; area[ga] += area[gb]; gap[ga] = Math.max(gap[ga], gap[gb], p.gapD);
    if (list[best[gb]].area > list[best[ga]].area) best[ga] = best[gb];
    if (!street[ga]) street[ga] = street[gb];
    merged++;
  }
  log(`merge rejections ${JSON.stringify(why)}`);
  const out: Bld[] = [];
  let accessory = 0, fallback = 0;
  list.forEach((_, i) => {
    if (find(i) !== i) return;
    const lead = list[best[i]];
    // rear-yard accessory structures (cottages, garages tagged building=yes): small, single, deep inside the block
    const st = street[i];
    if (mem[i].length === 1 && area[i] < ACCESSORY_M2 * M2 && lead.use !== 'civic' && !lead.landmark && (!st || st.d - streets.width[st.i] / 2 > 4)) { accessory++; return; }
    let r = lead.ring;
    if (mem[i].length > 1) {
      const rings = mem[i].map(k => list[k].ring);
      const u = rasterUnion(rings, Math.max(0.12, gap[i] * 0.6));
      if (u && ringArea(u) >= area[i] * 0.9) r = u;
      else { r = convexHull(rings.flat()); fallback++; }
    }
    const [cx, cz] = centroid(r);
    out.push({ ...lead, ring: r, area: ringArea(r), cx, cz, heightM: hA[i] / area[i], members: mem[i].length, lotArea: area[i] / mem[i].length });
  });
  log(`merge: ${pairs.size} wall pairs, ${merged} merges (${fallback} hull fallbacks), ${accessory} rear-yard accessory structures dropped → ${out.length} toy buildings from ${list.length}`);
  return out;
}

// ---------------------------------------------------------------------------
// Street carving (§2.4): toy right-of-way wider than the real gap cuts the footprint
// ---------------------------------------------------------------------------

export function carve(list: Bld[], carveIx: SegIndex, log: (s: string) => void): Bld[] {
  const out: Bld[] = [];
  let carved = 0, dropped = 0;
  const q = new Set<number>();
  for (const b of list) {
    let r = b.ring;
    const [x0, z0, x1, z1] = bbox(r);
    q.clear();
    carveIx.hash.query(x0 - 3, z0 - 3, x1 + 3, z1 + 3, q);
    let changed = false;
    for (const i of q) {
      const hw = carveIx.width[i] / 2;
      const ax = carveIx.seg[i * 4], az = carveIx.seg[i * 4 + 1], bx = carveIx.seg[i * 4 + 2], bz = carveIx.seg[i * 4 + 3];
      let near = false;
      for (let k = 0; k < r.length && !near; k += 2) if (segDist2(r[k], r[k + 1], ax, az, bx, bz) < hw * hw) near = true;
      if (!near && distToRing(ax, az, r) > 0 && distToRing(bx, bz, r) > 0 && distToRing((ax + bx) / 2, (az + bz) / 2, r) > 0) continue;
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 1e-6) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      const [cx, cz] = centroid(r);
      const t = (cx - ax) * dx + (cz - az) * dz;
      if (t < 0 || t > L) continue;
      const side = (cz - az) * dx - (cx - ax) * dz >= 0 ? 1 : -1;
      // normal toward the building's side of the street
      const nx = -dz * side, nz = dx * side;
      const next = clipHalf(r, ax + nx * hw, az + nz * hw, -nx, -nz);
      if (next.length !== r.length || next.some((v, k) => Math.abs(v - r[k]) > 1e-9)) { r = next; changed = true; }
      if (r.length < 6) break;
    }
    if (changed) {
      if (r.length < 6 || ringArea(r) < 0.4 || ringArea(r) < b.area * 0.3) { dropped++; continue; }
      r = ccw(cleanRing(r, 0.01));
      if (r.length < 6) { dropped++; continue; }
      const [cx, cz] = centroid(r);
      out.push({ ...b, ring: r, area: ringArea(r), cx, cz, carved: true });
      carved++;
    } else out.push(b);
  }
  log(`carve: ${carved} footprints cut by toy street corridors, ${dropped} dropped (< 0.4 u² or < 30 % left)`);
  return out;
}

// ---------------------------------------------------------------------------
// Hero seam (§5.1 rule 1): block ownership, exclusion shapes, heroDropLots
// ---------------------------------------------------------------------------

export interface HeroExclusions { polys: Ring[]; circles: [number, number, number][]; lines: { pts: number[]; r: number }[] }

/** Reconstructs district.ts EXCLUDE_POLYS / CIRCLES / LINES (§12, lines 778-788) from the exported DISTRICT data. */
export function heroExclusions(): HeroExclusions {
  const walk = (id: string) => DISTRICT.walk.find(w => w.id === id)!.polygon.flatMap(p => [p.x, p.z]);
  const ferry = DISTRICT.landmarks.find(l => l.id === 'ferry-building')!.collider as { polygon: { x: number; z: number }[] };
  const pos = (id: string) => DISTRICT.landmarks.find(l => l.id === id)!.position;
  const epl = project(37.7949, -122.39465), redwood = project(37.79524, -122.40224);
  const blvd = DISTRICT.roads.find(r => r.id === 'telegraph-hill-blvd')!;
  return {
    polys: [walk('levis-plaza'), ferry.polygon.flatMap(p => [p.x, p.z])],
    circles: [[COIT_POS.x, COIT_POS.z, 15.5], [pos('transamerica').x, pos('transamerica').z, 8.5], [pos('salesforce-tower').x, pos('salesforce-tower').z, 7.5], [epl.x, epl.z, 11], [redwood.x, redwood.z, 4]],
    lines: [...DISTRICT.ramps.map(r => ({ pts: r.points.flatMap(p => [p.x, p.z]), r: r.width / 2 + 3.2 })), { pts: blvd.points.flatMap(p => [p.x, p.z]), r: 2.4 }],
  };
}

function nearExclusion(ex: HeroExclusions, r: Ring, cx: number, cz: number, margin: number): boolean {
  const probes = [cx, cz, ...r];
  for (let k = 0; k < probes.length; k += 2) {
    const x = probes[k], z = probes[k + 1];
    for (const p of ex.polys) if (distToRing(x, z, p) < margin) return true;
    for (const [ox, oz, rr] of ex.circles) if (Math.hypot(x - ox, z - oz) < rr + margin) return true;
    for (const l of ex.lines) for (let i = 2; i < l.pts.length; i += 2) if (Math.sqrt(segDist2(x, z, l.pts[i - 2], l.pts[i - 1], l.pts[i], l.pts[i + 1])) < l.r + margin) return true;
  }
  return false;
}

export const HERO_OWN = 0.6;

export function heroSeam(list: Bld[], blocks: Blocks, log: (s: string) => void): { kept: Bld[]; heroDropLots: number[]; seamBlocks: Set<number> } {
  const ex = heroExclusions();
  const owned = (blk: number) => blk > 0 && blocks.slabFrac[blk] >= HERO_OWN;
  const kept: Bld[] = [];
  const seamBlocks = new Set<number>();
  let dropBlock = 0, dropSlab = 0, dropEx = 0;
  for (const b of list) {
    if (owned(b.block)) { dropBlock++; continue; }
    const inside = inSlab(b.cx, b.cz);
    if (inside && !(b.block > 0 && blocks.slabFrac[b.block] < HERO_OWN)) { dropSlab++; continue; }
    if (b.cx > -270 && b.cx < 270 && b.cz > -130 && b.cz < 140 && nearExclusion(ex, b.ring, b.cx, b.cz, 0.8)) { dropEx++; continue; }
    if (b.block > 0 && blocks.slabFrac[b.block] > 0) seamBlocks.add(b.block);
    kept.push(b);
  }
  const heroDropLots: number[] = [];
  const heroKept: Ring[] = [];
  DISTRICT.blocks.forEach((lot, i) => {
    const r = lot.footprint.flatMap(p => [p.x, p.z]);
    const [cx, cz] = centroid(r);
    const blk = blockAt(blocks, cx, cz, 2);
    if (blk > 0 && blocks.slabFrac[blk] < HERO_OWN) heroDropLots.push(i); else heroKept.push(r);
  });
  // never overlap a hero lot that stays (city-owned blocks can reach into the slab)
  let dropOverlap = 0;
  for (let i = kept.length - 1; i >= 0; i--) {
    const b = kept[i];
    if (b.cx < -300 || b.cx > 300 || b.cz < -150 || b.cz > 160) continue;
    const hit = heroKept.some(h => {
      for (let k = 0; k < b.ring.length; k += 2) if (distToRing(b.ring[k], b.ring[k + 1], h) < 0.5) return true;
      for (let k = 0; k < h.length; k += 2) if (pointInRing(h[k], h[k + 1], b.ring)) return true;
      return distToRing(b.cx, b.cz, h) < 0.5;
    });
    if (hit) { kept.splice(i, 1); dropOverlap++; }
  }
  log(`hero seam: dropped ${dropBlock} in hero-owned blocks, ${dropSlab} inside the slab off city blocks, ${dropEx} near hero exclusions, ${dropOverlap} touching kept hero lots; ${seamBlocks.size} city blocks straddle the slab; heroDropLots ${heroDropLots.length}`);
  return { kept, heroDropLots, seamBlocks };
}

// ---------------------------------------------------------------------------
// Final toy buildings
// ---------------------------------------------------------------------------

/** toy footprints keep at most this many vertices (plan: ≤ 12; 8 keeps the densest L0 cells inside 14k triangles) */
export const MAX_VERTS = 8;

export interface ToyBuilding {
  ring: Ring;
  cx: number; cz: number;
  style: number; roof: number; palette: number; flags: number;
  H: number; baseY: number; osmId: number;
  heightM: number;
  zone: string | null;
  /** street block id (Blocks.grid label) */
  block: number;
  /** OSM name of the lead footprint (report only) */
  name: string;
}

export function finishBuildings(list: Bld[], zones: Zones, t: Terrain, seamBlocks: Set<number>, log: (s: string) => void): ToyBuilding[] {
  const out: ToyBuilding[] = [];
  let over12 = 0;
  for (const b of list) {
    const before = b.ring.length / 2;
    let r = simplifyToMax(b.ring, MAX_VERTS, 0.08, 0.8);
    if (before > MAX_VERTS) over12++;
    r = ccw(r);
    if (r.length < 6 || area2(r) >= 0) continue;
    const zi = zoneIndexAt(zones, b.cx, b.cz);
    const zone = zi >= 0 ? zones.list[zi].en : null;
    const style: SfStyle = styleFor({ zone, heightM: b.heightM, areaM2: b.lotArea / M2, use: b.use, onPier: b.onPier, residentialTag: b.residentialTag });
    const roof: SfRoof = roofFor({ style, heightM: b.heightM, use: b.use, zone, roofTag: b.roofTag, seed: b.osmId, church: b.church });
    let flags = b.hSrc & BUILDING_FLAG.heightSourceMask;
    if (b.members > 1) flags |= BUILDING_FLAG.merged;
    if (b.relation) flags |= BUILDING_FLAG.relation;
    if (b.onPier) flags |= BUILDING_FLAG.onPier;
    if (b.landmark) flags |= BUILDING_FLAG.landmark;
    if (b.heightM >= 60) flags |= BUILDING_FLAG.tall;
    if (seamBlocks.has(b.block)) flags |= BUILDING_FLAG.seam;
    if (b.carved) flags |= BUILDING_FLAG.carved;
    const [cx, cz] = centroid(r);
    out.push({
      ring: r, cx, cz, style: STYLES.indexOf(style), roof: ROOFS.indexOf(roof), palette: pickPalette(style, b.osmId, WARM_Z.has(zone ?? '')), flags,
      H: buildingH(b.heightM), baseY: b.onPier ? 0 : minGround(t, r, cx, cz), osmId: b.osmId, heightM: b.heightM, zone, block: b.block, name: b.name,
    });
  }
  log(`buildings: ${out.length} toy buildings (${over12} simplified from > ${MAX_VERTS} vertices); ${PALETTES.length} palette entries`);
  return out;
}
