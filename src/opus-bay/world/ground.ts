import * as THREE from 'three';
import type { PierDef, Polygon, Ramp, RoadDef, Vec2 } from '../core/types';
import { heightAt, isLand, pointInPolygon, surfaceAt } from '../core/terrain';
import { COIT_POS, DISTRICT, LAND, at, centroid, frameAt, stationOf } from '../data/district';
import { Batch, C, CYL, type Info, M, hash2, longestEdge, mixColor, resample, shade, signedArea, v3 } from './builder';
import { GROUND_PATTERN } from './materials';
import { PAL } from './palette';
import { shoreDistance } from './water';

/**
 * Ground layer: land, Telegraph Hill, paving, roads + F-line rails, ramps and steps, pier decks with
 * pilings and railings, seawalls and the diorama slab's cut edge (earth strata / glassy water).
 * Writes into two batches: `g` (GROUND material, patterns) and `t` (TOY material: rails, railings, poles).
 */

export const SLAB_BOTTOM = -7;
const WATER = DISTRICT.waterLevel;

// Pattern ids (materials.ts GROUND)
const P = GROUND_PATTERN;
const info = (pattern: number, angle = 0): Info => [pattern, angle, 0, 0];
/** railings / handrails never dither-fade (aInfo.w = −1, see materials.ts) */
const KEEP: Info = [0, 0, 0, -1];

/** Direction-agnostic angle of the waterfront at a point (for paver orientation). */
function spineAngle(x: number, z: number) {
  const s = stationOf({ x, z });
  const f = frameAt(s.st);
  return Math.atan2(-f.tz, -f.tx);
}

/**
 * The promenade as a ribbon in (station, offset) space: every vertex carries its arc length along the
 * waterfront and its offset from the centreline (aInfo.y / aInfo.z), so the paver joints follow the curve
 * exactly — no per-vertex angles that wrap and swirl. A herringbone brick band runs along the seawall side
 * and a granite curb along the road side.
 */
function promenadeRibbon(g: Batch, poly: Polygon, y: number) {
  let st0 = Infinity, st1 = -Infinity, d0 = Infinity, d1 = -Infinity;
  for (const p of poly) { const s = stationOf(p); st0 = Math.min(st0, s.st); st1 = Math.max(st1, s.st); d0 = Math.min(d0, s.d); d1 = Math.max(d1, s.d); }
  const BAND = 1.2;
  const brickD = d1 - BAND;
  const n = Math.max(2, Math.ceil(st1 - st0));
  // arc length along the centreline (pattern u)
  const sts: number[] = [], arc: number[] = [0];
  for (let i = 0; i <= n; i++) sts.push(st0 + ((st1 - st0) * i) / n);
  for (let i = 1; i <= n; i++) { const pa = at(sts[i - 1], 0), pb = at(sts[i], 0); arc.push(arc[i - 1] + Math.hypot(pb.x - pa.x, pb.z - pa.z)); }
  const strip = (dA: number, dB: number, color: THREE.Color, pattern: number, yy: number) => {
    const base = g.vertexCount;
    for (let i = 0; i <= n; i++) {
      for (const d of [dA, dB]) { const q = at(sts[i], d); g.vert(q.x, yy, q.z, 0, 1, 0, color, [pattern, arc[i], d, 0]); }
    }
    for (let i = 0; i < n; i++) {
      const a0 = base + i * 2, a1 = a0 + 1, b0 = a0 + 2, b1 = a0 + 3;
      const A = at(sts[i], dA), B = at(sts[i + 1], dA), Cc = at(sts[i], dB);
      const cy = (B.z - A.z) * (Cc.x - A.x) - (B.x - A.x) * (Cc.z - A.z);
      if (cy > 0) g.idx.push(a0, b0, a1, a1, b0, b1); else g.idx.push(a0, a1, b0, a1, b1, b0);
    }
  };
  strip(d0, brickD, C(PAL.pavers), P.pavers, y + 0.003);
  strip(brickD, d1, C('#c79f86'), P.brick, y + 0.003);
  // granite curb on the road side
  strip(d0 - 0.18, d0 + 0.2, C('#c9c3b8'), P.none, y + 0.03);
}

/** One constant pattern angle for a whole polygon (at its centroid): straight joints, no swirl. */
function polygonAngle(poly: Polygon) {
  const c = centroid(poly);
  return spineAngle(c.x, c.z);
}

function segDist(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}
function polyEdgeDist(p: Vec2, poly: Polygon) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, segDist(p, poly[i], poly[(i + 1) % poly.length]));
  return d;
}

// ---------------------------------------------------------------------------
// Land + hill
// ---------------------------------------------------------------------------

function landColor(x: number, z: number, h: number, slope: number): THREE.Color {
  const dc = Math.hypot(x - COIT_POS.x, z - COIT_POS.z);
  let c = C(PAL.land);
  // Telegraph Hill: gardens and park towards the top, earthy on the steep quarried face
  const green = Math.min(1, Math.max(0, (h - 1.2) / 7)) * 0.75 + (dc < 17 ? 0.35 : 0);
  if (green > 0) c = mixColor(c, hash2(Math.floor(x / 5), Math.floor(z / 5)) > 0.5 ? PAL.grass : PAL.grassDark, Math.min(0.92, green));
  if (slope > 0.9) c = mixColor(c, '#c2a98a', Math.min(0.7, (slope - 0.9) * 0.8));
  return c;
}

function buildLand(g: Batch) {
  // flat land base
  g.polygon(LAND, 0, (x, z) => landColor(x, z, 0, 0), info(P.earth));
  // Telegraph Hill height field (1 u grid) where the ground rises
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const h of DISTRICT.hills) {
    minX = Math.min(minX, h.center.x - h.radiusX); maxX = Math.max(maxX, h.center.x + h.radiusX);
    minZ = Math.min(minZ, h.center.z - h.radiusZ); maxZ = Math.max(maxZ, h.center.z + h.radiusZ);
  }
  const step = 1;
  const cols = Math.ceil((maxX - minX) / step) + 1, rows = Math.ceil((maxZ - minZ) / step) + 1;
  const H = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) H[r * cols + c] = heightAt(minX + c * step, minZ + r * step);
  const idx = new Int32Array(cols * rows).fill(-1);
  const at = (c: number, r: number) => H[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))];
  const vertex = (c: number, r: number) => {
    const k = r * cols + c;
    if (idx[k] >= 0) return idx[k];
    const x = minX + c * step, z = minZ + r * step, h = H[k];
    const dx = (at(c + 1, r) - at(c - 1, r)) / (2 * step), dz = (at(c, r + 1) - at(c, r - 1)) / (2 * step);
    const n = new THREE.Vector3(-dx, 1, -dz).normalize();
    const slope = Math.hypot(dx, dz);
    const onLand = isLand(x, z);
    const col = onLand ? landColor(x, z, h, slope) : C(PAL.land);
    idx[k] = g.vert(x, h + 0.025, z, n.x, n.y, n.z, col, info(P.earth));
    return idx[k];
  };
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const h00 = H[r * cols + c], h10 = H[r * cols + c + 1], h01 = H[(r + 1) * cols + c], h11 = H[(r + 1) * cols + c + 1];
      if (Math.max(h00, h10, h01, h11) < 0.02) continue;
      const x = minX + (c + 0.5) * step, z = minZ + (r + 0.5) * step;
      if (!isLand(x, z)) continue;
      const a = vertex(c, r), b = vertex(c + 1, r), d = vertex(c, r + 1), e = vertex(c + 1, r + 1);
      // winding: +y up with x right, z down the rows → (a, d, b) is counter-clockwise from above
      g.idx.push(a, d, b, b, d, e);
    }
  }
}

// ---------------------------------------------------------------------------
// Walk areas
// ---------------------------------------------------------------------------

const LEVIS_ANGLE = Math.atan2(Math.sin(-55 * Math.PI / 180), Math.cos(-55 * Math.PI / 180));

function buildWalk(g: Batch) {
  for (const w of DISTRICT.walk) {
    if (w.id.startsWith('crosswalk-')) continue; // zebra comes from roads[]
    const y = (w.height ?? 0) + (w.id.startsWith('platform-') ? 0.06 : 0.035);
    if (w.surface === 'grass') {
      g.polygon(w.polygon, y - 0.005, (x, z) => mixColor(PAL.grass, PAL.grassDark, hash2(Math.floor(x / 3), Math.floor(z / 3)) * 0.35), info(P.grass));
      continue;
    }
    if (w.id === 'promenade') { promenadeRibbon(g, w.polygon, y); continue; }
    if (w.id.startsWith('platform-')) {
      g.polygon(w.polygon, y, C('#d6cdbb'), info(P.stone, polygonAngle(w.polygon)));
      g.walls(w.polygon, 0, y, shade('#d6cdbb', 0.85));
      continue;
    }
    if (w.id === 'coit-summit') { g.polygon(w.polygon, y, C('#e6dcc8'), info(P.stone, 0.3)); continue; }
    if (w.id.startsWith('levis')) { g.polygon(w.polygon, y, C('#ddd2bf'), info(P.stone, LEVIS_ANGLE)); continue; }
    g.polygon(w.polygon, y, C(PAL.plaza), info(P.stone, polygonAngle(w.polygon)));
  }
}

// ---------------------------------------------------------------------------
// Roads, rails, overhead wires
// ---------------------------------------------------------------------------

const roadY = (x: number, z: number) => { const h = heightAt(x, z); return h > 0.05 ? h + 0.1 : 0.045; };

function buildRoads(g: Batch, t: Batch) {
  for (const r of DISTRICT.roads) {
    if (r.kind === 'crosswalk') { zebra(g, r); continue; }
    if (r.kind === 'track') { rails(g, r); continue; }
    const median = r.id === 'embarcadero-median';
    const color = median ? C(PAL.median) : r.kind === 'path' ? C(PAL.asphaltLight) : C(PAL.asphalt);
    const pat = median ? P.cobble : P.asphalt;
    g.ribbon(r.points, r.width, roadY, color, info(pat, spineAngle(r.points[0].x, r.points[0].z)), 1.5);
    if (r.id === 'embarcadero-north-lanes' || r.id === 'embarcadero-south-lanes') laneDashes(g, r);
    if (r.kind === 'roadway' && !median && r.width < 4) curbs(g, r);
  }
  overheadWires(t);
}

function laneDashes(g: Batch, r: RoadDef) {
  const pts = resample(r.points, 0.5);
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    s += Math.hypot(b.x - a.x, b.z - a.z);
    if (s % 4 < 2) g.ribbon([a, b], 0.14, () => 0.055, C('#f3efe4'), info(P.none));
  }
}

function curbs(g: Batch, r: RoadDef) {
  // a lighter sidewalk lip on both sides makes the streets read as streets
  for (const side of [-1, 1]) {
    const off: Vec2[] = [];
    for (let i = 0; i < r.points.length; i++) {
      const a = r.points[Math.max(0, i - 1)], b = r.points[Math.min(r.points.length - 1, i + 1)];
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
      off.push({ x: r.points[i].x + (-dz / L) * side * (r.width / 2 + 0.25), z: r.points[i].z + (dx / L) * side * (r.width / 2 + 0.25) });
    }
    g.ribbon(off, 0.5, (x, z) => roadY(x, z) + 0.01, C('#efe7d6'), info(P.none), 2);
  }
}

function zebra(g: Batch, r: RoadDef) {
  const a = r.points[0], b = r.points[r.points.length - 1];
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
  const px = -dz / L, pz = dx / L;
  const n = Math.floor(r.width / 0.7);
  for (let i = 0; i < n; i++) {
    const o = -r.width / 2 + 0.35 + i * 0.7;
    g.ribbon([{ x: a.x + px * o, z: a.z + pz * o }, { x: b.x + px * o, z: b.z + pz * o }], 0.38, () => 0.06, C('#f4f0e6'), info(P.none));
  }
}

function rails(g: Batch, r: RoadDef) {
  g.ribbon(r.points, r.width, () => 0.05, C('#a69a88'), info(P.cobble, spineAngle(r.points[0].x, r.points[0].z)), 1.5);
  for (const o of [-0.6, 0.6]) {
    const off: Vec2[] = r.points.map((p, i) => {
      const a = r.points[Math.max(0, i - 1)], b = r.points[Math.min(r.points.length - 1, i + 1)];
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
      return { x: p.x + (-dz / L) * o, z: p.z + (dx / L) * o };
    });
    g.ribbon(off, 0.2, () => 0.058, C('#6d665e'), info(P.none), 1.5);
    g.ribbon(off, 0.09, () => 0.066, C('#c9ccce'), info(P.none), 1.5);
  }
}

/** F-line catenary: poles in the median every ~20 u with arms over both tracks, wires at 5 u. */
function overheadWires(t: Batch) {
  const tracks = DISTRICT.roads.filter(r => r.kind === 'track');
  const median = DISTRICT.roads.find(r => r.id === 'embarcadero-median');
  const WIRE_Y = 5.1;
  for (const tr of tracks) {
    const pts = resample(tr.points, 3);
    for (let i = 1; i < pts.length; i++) t.beam(v3(pts[i - 1].x, WIRE_Y, pts[i - 1].z), v3(pts[i].x, WIRE_Y, pts[i].z), 0.04, 0.04, '#3b3f42');
  }
  if (!median) return;
  const mp = resample(median.points, 1);
  let acc = 0;
  for (let i = 1; i < mp.length; i++) {
    acc += Math.hypot(mp[i].x - mp[i - 1].x, mp[i].z - mp[i - 1].z);
    if (acc < 21) continue;
    acc = 0;
    const p = mp[i];
    const st = stationOf(p);
    if (st.st < 30 || st.st > 368) continue;
    const f = frameAt(st.st);
    t.add(CYL(6), M(p.x, 0, p.z, 0, 0.09, WIRE_Y + 0.5, 0.09), PAL.lampPost);
    // arm across both tracks (normal direction)
    t.beam(v3(p.x + f.nx * 1.9, WIRE_Y + 0.3, p.z + f.nz * 1.9), v3(p.x - f.nx * 1.9, WIRE_Y + 0.3, p.z - f.nz * 1.9), 0.07, 0.07, PAL.lampPost);
  }
}

// ---------------------------------------------------------------------------
// Ramps (Filbert Steps, Pioneer Park path, Coit stairs)
// ---------------------------------------------------------------------------

function rampHeight(ramp: Ramp, s: number, cum: number[]) {
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const t = Math.max(0, Math.min(1, (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)));
  return ramp.heights[i - 1] + (ramp.heights[i] - ramp.heights[i - 1]) * t;
}

function buildRamps(g: Batch, t: Batch) {
  for (const ramp of DISTRICT.ramps) {
    const cum = [0];
    for (let i = 1; i < ramp.points.length; i++) cum.push(cum[i - 1] + Math.hypot(ramp.points[i].x - ramp.points[i - 1].x, ramp.points[i].z - ramp.points[i - 1].z));
    const total = cum[cum.length - 1];
    if (ramp.surface !== 'stairs') {
      // paved path following its heights
      const pts = resample(ramp.points, 1);
      let s = 0;
      const ys: number[] = [];
      for (let i = 0; i < pts.length; i++) { if (i) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); ys.push(rampHeight(ramp, s, cum)); }
      let k = 0;
      g.ribbon(pts, ramp.width, () => ys[Math.min(ys.length - 1, Math.floor(k++ / 2))] + 0.06, C('#d9ceb9'), info(P.stone, 0.4));
      continue;
    }
    // stairs: treads + risers; wooden on the Filbert Steps, stone on the Coit stairs
    const wood = ramp.id === 'filbert-steps';
    const tread = wood ? C('#b88d62') : C('#d8cdb8');
    const riser = wood ? C('#8c6644') : C('#b6aa94');
    const rise = 0.24;
    let s = 0;
    while (s < total - 0.05) {
      const h0 = rampHeight(ramp, s, cum);
      // find where the ramp gains one riser height (min 0.35 u run, max 1.6 u)
      let s1 = s + 0.35;
      while (s1 < total && rampHeight(ramp, s1, cum) - h0 < rise && s1 - s < 1.6) s1 += 0.05;
      s1 = Math.min(total, s1);
      const h1 = rampHeight(ramp, s1, cum);
      const pa = along(ramp.points, cum, s), pb = along(ramp.points, cum, s1);
      const dx = pb.x - pa.x, dz = pb.z - pa.z, L = Math.hypot(dx, dz) || 1;
      const px = (-dz / L) * ramp.width / 2, pz = (dx / L) * ramp.width / 2;
      const yT = h1 + 0.02;
      const n = v3(0, 1, 0);
      g.quad(v3(pa.x + px, yT, pa.z + pz), v3(pa.x - px, yT, pa.z - pz), v3(pb.x - px, yT, pb.z - pz), v3(pb.x + px, yT, pb.z + pz), n, tread, info(wood ? P.planks : P.stone, Math.atan2(dz, dx)));
      // riser (facing down-slope) + side skirts down to the ground
      const back = v3(-dx / L, 0, -dz / L);
      g.quad(v3(pa.x + px, h0 - 0.2, pa.z + pz), v3(pa.x - px, h0 - 0.2, pa.z - pz), v3(pa.x - px, yT, pa.z - pz), v3(pa.x + px, yT, pa.z + pz), back, riser, info(P.none));
      for (const sd of [1, -1]) {
        const nx = (sd * -dz) / L, nz = (sd * dx) / L;
        g.quad(v3(pa.x + px * sd, h0 - 0.35, pa.z + pz * sd), v3(pb.x + px * sd, h1 - 0.35, pb.z + pz * sd), v3(pb.x + px * sd, yT, pb.z + pz * sd), v3(pa.x + px * sd, yT, pa.z + pz * sd), v3(nx, 0, nz), riser, info(P.none));
      }
      s = s1;
    }
    // handrails (Filbert: wooden; Coit: iron)
    const railCol = wood ? '#7a5a3c' : '#4f5a57';
    for (const side of [-1, 1]) {
      let prev: THREE.Vector3 | null = null;
      for (let sd = 0; sd <= total + 0.01; sd += 1.6) {
        const p = along(ramp.points, cum, Math.min(total, sd));
        const q = along(ramp.points, cum, Math.min(total, sd + 0.3));
        const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1;
        const x = p.x + (-dz / L) * side * (ramp.width / 2 - 0.1), z = p.z + (dx / L) * side * (ramp.width / 2 - 0.1);
        const y = rampHeight(ramp, Math.min(total, sd), cum);
        t.add(CYL(5), M(x, y, z, 0, 0.05, 0.95, 0.05), railCol, [0, y, 0, -1]);
        const top = v3(x, y + 0.95, z);
        if (prev) t.beam(prev, top, 0.07, 0.07, railCol, KEEP);
        prev = top;
      }
    }
  }
}

function along(points: Vec2[], cum: number[], s: number): Vec2 {
  let i = 1;
  while (i < points.length - 1 && cum[i] < s) i++;
  const t = Math.max(0, Math.min(1, (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)));
  return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, z: points[i - 1].z + (points[i].z - points[i - 1].z) * t };
}

// ---------------------------------------------------------------------------
// Piers
// ---------------------------------------------------------------------------

function buildPiers(g: Batch, t: Batch) {
  const piling = CYL(6, 1, true);
  for (const pier of DISTRICT.piers) {
    const top = pier.deckHeight + (pier.walkable ? 0.03 : 0.02);
    const edge = longestEdge(pier.deck);
    const across = Math.atan2(edge.dz, edge.dx) + Math.PI / 2;
    const concrete = !pier.walkable || pier.id === 'pier14';
    const deckCol = concrete ? C(pier.id === 'pier14' ? '#d7cebd' : PAL.concrete) : C(pier.id.startsWith('pier39-dock') ? '#a57b52' : PAL.wood);
    g.polygon(pier.deck, top, deckCol, info(concrete ? P.stone : P.planks, concrete ? across - Math.PI / 2 : across));
    const bottom = pier.deckHeight - 0.28;
    g.walls(pier.deck, bottom, top, shade(deckCol, 0.72), info(P.none), shade(deckCol, 0.5));
    // pilings along the edges (and a row under wide decks)
    const s = signedArea(pier.deck) >= 0 ? 1 : -1;
    for (let i = 0; i < pier.deck.length; i++) {
      const a = pier.deck[i], b = pier.deck[(i + 1) % pier.deck.length];
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      const nx = (s * (b.z - a.z)) / (L || 1), nz = (-s * (b.x - a.x)) / (L || 1);
      const n = Math.max(1, Math.round(L / 2.4));
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n;
        const x = a.x + (b.x - a.x) * u - nx * 0.25, z = a.z + (b.z - a.z) * u - nz * 0.25;
        if (isLand(x + nx * 0.8, z + nz * 0.8)) continue;
        t.add(piling, M(x, WATER - 0.9, z, 0, 0.15, bottom - (WATER - 0.9), 0.15), '#6e5236');
      }
    }
    if (pier.walkable) railings(t, pier);
  }
}

function railings(t: Batch, pier: PierDef) {
  const s = signedArea(pier.deck) >= 0 ? 1 : -1;
  const y0 = pier.deckHeight;
  const post = '#445650', cap = '#9b7a55';
  for (let i = 0; i < pier.deck.length; i++) {
    const a = pier.deck[i], b = pier.deck[(i + 1) % pier.deck.length];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L < 0.8) continue;
    const nx = (s * (b.z - a.z)) / L, nz = (-s * (b.x - a.x)) / L;
    const inset = 0.18;
    // runs of edge that face open water (skip where the deck joins land or another walkable surface)
    const n = Math.max(1, Math.round(L / 1.6));
    let runStart: THREE.Vector3 | null = null;
    let prevTop: THREE.Vector3 | null = null;
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const x = a.x + (b.x - a.x) * u - nx * inset, z = a.z + (b.z - a.z) * u - nz * inset;
      const ox = x + nx * 0.9, oz = z + nz * 0.9;
      const open = !surfaceAt(ox, oz) && !isLand(ox, oz) && !pointInPolygon({ x: ox, z: oz }, pier.deck);
      if (!open) { runStart = null; prevTop = null; continue; }
      t.add(CYL(5), M(x, y0, z, 0, 0.055, 1.0, 0.055), post, [0, y0, 0, -1]);
      const topP = v3(x, y0 + 1.0, z);
      const midP = v3(x, y0 + 0.5, z);
      if (prevTop && runStart) {
        t.beam(prevTop, topP, 0.12, 0.07, cap, KEEP);
        t.beam(v3(prevTop.x, y0 + 0.5, prevTop.z), midP, 0.04, 0.04, post, KEEP);
      }
      prevTop = topP;
      runStart = runStart ?? topP;
    }
  }
}

// ---------------------------------------------------------------------------
// Seawalls + slab cut edge
// ---------------------------------------------------------------------------

/**
 * Seawalls along the land edge, topped by a low granite curb with chain bollards wherever the walk meets open
 * water (pier and deck entrances stay open), so the water's edge reads as an edge, not an invisible wall.
 */
function buildSeawalls(g: Batch, t: Batch) {
  const slab = DISTRICT.slab;
  const wall = C('#cbc0ab');
  const curb = '#cfc8bb', post = '#4a4f4f', chain = '#3b3f40';
  let prevPost: THREE.Vector3 | null = null;
  let acc = 0;
  const chainTo = (a: THREE.Vector3, b: THREE.Vector3) => {
    // three-segment catenary between two bollard tops
    const n = 3, sag = 0.14;
    let q = a;
    for (let k = 1; k <= n; k++) {
      const u = k / n;
      const r = new THREE.Vector3().lerpVectors(a, b, u);
      r.y -= sag * 4 * u * (1 - u) + 0.04;
      t.beam(q, r, 0.025, 0.025, chain);
      q = r;
    }
  };
  for (let i = 0; i < LAND.length; i++) {
    const a = LAND[i], b = LAND[(i + 1) % LAND.length];
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    if (polyEdgeDist(mid, slab) < 0.6) { prevPost = null; continue; } // on the slab edge → strata instead
    g.walls([a, b], WATER - 1.2, 0.03, wall, info(P.none), shade(wall, 0.6));
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L < 1e-3) continue;
    let nx = (b.z - a.z) / L, nz = -(b.x - a.x) / L;
    if (isLand(mid.x + nx * 0.8, mid.z + nz * 0.8)) { nx = -nx; nz = -nz; }
    // open where a pier / deck / walk continues past the seawall
    const open = !!surfaceAt(mid.x + nx * 0.8, mid.z + nz * 0.8) || !surfaceAt(mid.x - nx * 0.8, mid.z - nz * 0.8);
    if (open) { g.ribbon([a, b], 0.35, () => 0.05, C('#efe6d4'), info(P.none)); prevPost = null; continue; }
    const ia = v3(a.x - nx * 0.16, 0.1, a.z - nz * 0.16), ib = v3(b.x - nx * 0.16, 0.1, b.z - nz * 0.16);
    t.beam(ia, ib, 0.3, 0.14, curb, [0, 0, 0, 0]);
    // bollards every ~3 u along the curb
    for (let d = 0; d < L; d += 0.5) {
      acc += 0.5;
      if (acc < 3) continue;
      acc = 0;
      const x = a.x + ((b.x - a.x) * d) / L - nx * 0.18, z = a.z + ((b.z - a.z) * d) / L - nz * 0.18;
      t.add(CYL(6), M(x, 0.1, z, 0, 0.07, 0.52, 0.07), post, [0, 0, 0, -1]);
      t.add(CYL(6, 0.4), M(x, 0.62, z, 0, 0.09, 0.08, 0.09), post, [0, 0, 0, -1]);
      const top = v3(x, 0.55, z);
      if (prevPost && prevPost.distanceTo(top) < 4.2) chainTo(prevPost, top);
      prevPost = top;
    }
  }
}

/** One column of a diorama cut face from (x0, z0) to (x1, z1): strata under land, glassy water above the seabed. */
function edgeColumn(g: Batch, x0: number, z0: number, x1: number, z1: number, n: THREE.Vector3, t0: number, t1: number, wet: boolean, bottom: number, seed: number) {
  const bands = PAL.strata;
  const seabed = WATER - 2.6;
  const wob = (x: number, z: number, j: number) => (hash2(Math.round(x * 0.7) + j * 13 + seed, Math.round(z * 0.7) - j * 7) - 0.5) * 0.45;
  const levels = (x: number, z: number, t: number) => wet
    ? [t, seabed, seabed - 0.9 + wob(x, z, 1), -5.0 + wob(x, z, 2), -6.0 + wob(x, z, 3), bottom]
    : [t, t - 0.45, -1.7 + wob(x, z, 1), -3.3 + wob(x, z, 2), -4.9 + wob(x, z, 3), bottom];
  const la = levels(x0, z0, t0), lb = levels(x1, z1, t1);
  for (let j = 0; j < la.length - 1; j++) {
    let top0: THREE.Color, bot0: THREE.Color;
    if (j === 0) {
      if (wet) { top0 = C('#8fd2ca'); bot0 = C('#2f7c85'); } else { top0 = C(PAL.strataTop); bot0 = shade(PAL.strataTop, 0.85); }
    } else if (j === 1 && wet) { top0 = C('#d7c29a'); bot0 = C('#b99f78'); } else {
      const c = C(bands[(j + (wet ? 1 : 0)) % bands.length]);
      top0 = c; bot0 = shade(c, 0.88);
    }
    if (la[j] - la[j + 1] < 0.01 && lb[j] - lb[j + 1] < 0.01) continue;
    g.quad(v3(x0, la[j + 1], z0), v3(x1, lb[j + 1], z1), v3(x1, lb[j], z1), v3(x0, la[j], z0), n, [bot0, bot0, top0, top0], info(P.none));
  }
  if (wet) {
    // meniscus highlight along the glass top edge
    g.quad(v3(x0, WATER - 0.1, z0).addScaledVector(n, 0.01), v3(x1, WATER - 0.1, z1).addScaledVector(n, 0.01), v3(x1, WATER + 0.02, z1).addScaledVector(n, 0.01), v3(x0, WATER + 0.02, z0).addScaledVector(n, 0.01), n, C('#e3f6f1'), info(P.none));
  }
}

/**
 * Cut edge of a diorama board: strata under land, glassy water above the seabed.
 * `top(x,z)` returns the ground top on land; `water(x,z)` says whether the edge is water there. `column` is the
 * width of one edge column (the city board, ~13 km round, uses wider ones than the district's 1.6 u), or per edge
 * (`column(i)` for the edge from poly[i] to poly[i + 1]).
 */
export function slabEdge(g: Batch, poly: Polygon, top: (x: number, z: number) => number, water: (x: number, z: number) => boolean, bottom = SLAB_BOTTOM, seed = 1, column: number | ((edge: number) => number) = 1.6) {
  const s = signedArea(poly) >= 0 ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L < 1e-3) continue;
    const nx = (s * (b.z - a.z)) / L, nz = (-s * (b.x - a.x)) / L;
    const n = v3(nx, 0, nz);
    const cols = Math.max(1, Math.ceil(L / (typeof column === 'number' ? column : column(i))));
    for (let k = 0; k < cols; k++) {
      const u0 = k / cols, u1 = (k + 1) / cols;
      const x0 = a.x + (b.x - a.x) * u0, z0 = a.z + (b.z - a.z) * u0;
      const x1 = a.x + (b.x - a.x) * u1, z1 = a.z + (b.z - a.z) * u1;
      const wet = water((x0 + x1) / 2 - nx * 0.8, (z0 + z1) / 2 - nz * 0.8);
      const t0 = wet ? WATER : top(x0 - nx * 0.8, z0 - nz * 0.8), t1 = wet ? WATER : top(x1 - nx * 0.8, z1 - nz * 0.8);
      edgeColumn(g, x0, z0, x1, z1, n, t0, t1, wet, bottom, seed);
    }
  }
  // underside
  g.polygon(poly, bottom, C('#6d5f52'), info(P.none), true);
}

// ---------------------------------------------------------------------------
// Bay-side water skirt: the district's water runs on past the slab cut (up to SKIRT_MAX u), so the Bay does
// not end right behind the piers; the glass cut face moves out with it. Land sides keep their strata.
// ---------------------------------------------------------------------------

export const SKIRT_MAX = 25;
interface SkirtCol { a: Vec2; b: Vec2; A: Vec2; B: Vec2; nx: number; nz: number; wet: boolean }
let SKIRT: { cols: SkirtCol[]; outer: Polygon; sign: number } | null = null;

/** Keep the skirt clear of the satellite boards (tile centre, radius), so every board stays a separate piece. */
function skirtClearance(x: number, z: number) {
  const R: Record<string, number> = { alcatraz: 26, 'yerba-buena': 40, 'angel-island': 52 };
  let w = SKIRT_MAX;
  for (const d of DISTRICT.backdrop) {
    const r = R[d.kind];
    if (!r) continue;
    w = Math.min(w, Math.hypot(x - d.position.x, z - d.position.z) - r - 9);
  }
  return Math.max(0, w);
}

/** Slab outline split into 1.6 u columns; wet columns get an outward offset edge (the skirt's outer cut). */
export function slabSkirt() {
  if (SKIRT) return SKIRT;
  const poly = DISTRICT.slab;
  const sign = signedArea(poly) >= 0 ? 1 : -1;
  const pts: Vec2[] = [], wet: boolean[] = [], ns: { x: number; z: number }[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L < 1e-3) continue;
    const nx = (sign * (b.z - a.z)) / L, nz = (-sign * (b.x - a.x)) / L;
    const cols = Math.max(1, Math.ceil(L / 1.6));
    for (let k = 0; k < cols; k++) {
      const u0 = k / cols, u1 = (k + 1) / cols;
      pts.push({ x: a.x + (b.x - a.x) * u0, z: a.z + (b.z - a.z) * u0 });
      const mx = a.x + ((b.x - a.x) * (u0 + u1)) / 2 - nx * 0.8, mz = a.z + ((b.z - a.z) * (u0 + u1)) / 2 - nz * 0.8;
      wet.push(!isLand(mx, mz) && skirtClearance(mx, mz) > 0.5);
      ns.push({ x: nx, z: nz });
    }
  }
  const N = pts.length;
  const outer: Vec2[] = pts.map((p, j) => {
    const jp = (j - 1 + N) % N;
    const w = wet[j] || wet[jp] ? skirtClearance(p.x, p.z) : 0;
    let vx = ns[j].x + ns[jp].x, vz = ns[j].z + ns[jp].z;
    const L = Math.hypot(vx, vz) || 1;
    vx /= L; vz /= L;
    const miter = 1 / Math.max(0.5, vx * ns[j].x + vz * ns[j].z);
    return { x: p.x + vx * w * miter, z: p.z + vz * w * miter };
  });
  const cols: SkirtCol[] = pts.map((a, j) => ({ a, b: pts[(j + 1) % N], A: outer[j], B: outer[(j + 1) % N], nx: ns[j].x, nz: ns[j].z, wet: wet[j] }));
  SKIRT = { cols, outer, sign };
  return SKIRT;
}

function buildSlab(g: Batch) {
  const { cols, sign } = slabSkirt();
  const N = cols.length;
  for (let j = 0; j < N; j++) {
    const c = cols[j];
    if (!c.wet) {
      // land (or skirt-less water) cut face at the slab edge
      const wetHere = !isLand((c.a.x + c.b.x) / 2 - c.nx * 0.8, (c.a.z + c.b.z) / 2 - c.nz * 0.8);
      const t0 = wetHere ? WATER : heightAt(c.a.x - c.nx * 0.8, c.a.z - c.nz * 0.8), t1 = wetHere ? WATER : heightAt(c.b.x - c.nx * 0.8, c.b.z - c.nz * 0.8);
      edgeColumn(g, c.a.x, c.a.z, c.b.x, c.b.z, v3(c.nx, 0, c.nz), t0, t1, wetHere, SLAB_BOTTOM, 1);
      continue;
    }
    // skirt: the glass face moves out to the outer edge; underside; end caps where it meets a land edge
    const ox = c.B.x - c.A.x, oz = c.B.z - c.A.z, OL = Math.hypot(ox, oz) || 1;
    edgeColumn(g, c.A.x, c.A.z, c.B.x, c.B.z, v3((sign * oz) / OL, 0, (-sign * ox) / OL), WATER, WATER, true, SLAB_BOTTOM, 1);
    g.quad(v3(c.a.x, SLAB_BOTTOM, c.a.z), v3(c.b.x, SLAB_BOTTOM, c.b.z), v3(c.B.x, SLAB_BOTTOM, c.B.z), v3(c.A.x, SLAB_BOTTOM, c.A.z), v3(0, -1, 0), C('#6d5f52'), info(P.none));
    const prev = cols[(j - 1 + N) % N], next = cols[(j + 1) % N];
    const ex = c.b.x - c.a.x, ez = c.b.z - c.a.z, EL = Math.hypot(ex, ez) || 1;
    if (!prev.wet) edgeColumn(g, c.A.x, c.A.z, c.a.x, c.a.z, v3(-ex / EL, 0, -ez / EL), WATER, WATER, true, SLAB_BOTTOM, 1);
    if (!next.wet) edgeColumn(g, c.b.x, c.b.z, c.B.x, c.B.z, v3(ex / EL, 0, ez / EL), WATER, WATER, true, SLAB_BOTTOM, 1);
  }
  g.polygon(DISTRICT.slab, SLAB_BOTTOM, C('#6d5f52'), info(P.none), true);
}

/**
 * Water surface of the bay-side skirt (merged into the water mesh; call after the distance texture exists).
 * Flat (aEdge 0); the distance to shore keeps growing outward from the slab edge.
 */
export function buildSkirtWater(): THREE.BufferGeometry {
  const { cols } = slabSkirt();
  const pos: number[] = [], edge: number[] = [], dist: number[] = [], idx: number[] = [];
  const y = WATER - 0.004;
  for (const c of cols) {
    if (!c.wet) continue;
    // overlap the district water by a hair so no crack shows at the seam
    const ia = { x: c.a.x - c.nx * 0.15, z: c.a.z - c.nz * 0.15 }, ib = { x: c.b.x - c.nx * 0.15, z: c.b.z - c.nz * 0.15 };
    const base = pos.length / 3;
    for (const p of [ia, ib, c.B, c.A]) {
      pos.push(p.x, y, p.z);
      edge.push(0);
      dist.push(Math.max(0, shoreDistance(p.x, p.z)));
    }
    const cy = (ib.z - ia.z) * (c.B.x - ia.x) - (ib.x - ia.x) * (c.B.z - ia.z);
    if (cy > 0) idx.push(base, base + 1, base + 2, base, base + 2, base + 3); else idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  geo.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

// ---------------------------------------------------------------------------

/** The hero district's ground. City mode (opts.slab false) skips the slab's cut edges and underside: the streamed city
 *  continues the land past the slab and the city board has its own edge (world/sf/water.ts). */
export function buildGround(g: Batch, t: Batch, opts: { slab?: boolean } = {}) {
  buildLand(g);
  buildWalk(g);
  buildRoads(g, t);
  buildRamps(g, t);
  buildPiers(g, t);
  buildSeawalls(g, t);
  if (opts.slab !== false) buildSlab(g);
}
