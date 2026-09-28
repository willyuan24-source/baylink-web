import * as THREE from 'three';
import { projectCity } from '../core/geo';
import type { WorldMode } from '../core/store';
import type { BackdropDef, Polygon } from '../core/types';
import { DISTRICT } from '../data/district';
import { BOX, Batch, C, CONE, CYL, Frame, ICO, type Info, hash2, mixColor, rng, shade, v3 } from './builder';
import { slabEdge, slabSkirt } from './ground';
import type { HaloSpec } from './props';
import { PAL } from './palette';
import { waterGrid } from './water';

/**
 * Backdrop: the Bay Bridge west span (from Rincon Point out to the slab edge, where the model is "cut"
 * like the slab itself) and small satellite diorama boards floating on the same table for Alcatraz,
 * Yerba Buena Island, Angel Island, the Marin and East Bay hills and the downtown skyline.
 *
 * City mode (the whole streamed San Francisco around the hero, plan §5.1): Alcatraz, Yerba Buena Island and Treasure
 * Island are real land of the streamed data (at their real places and sizes), so only the Alcatraz lighthouse (beam at
 * night) is added here; Angel Island (Marin County, not in the data) moves to its real position at its real size; the
 * Bay Bridge runs its whole west crossing (two suspension spans through the centre anchorage) from the hero anchorage
 * into the Yerba Buena tunnel; the skyline board goes (the real city replaces it); Marin and the East Bay wait for their
 * satellite boards.
 */

/** Real positions (city frame) of the backdrop pieces in city mode (telescopes / camera subjects can aim here). */
export const CITY_BACKDROP = {
  alcatraz: projectCity(37.8267, -122.423),
  'alcatraz-lighthouse': projectCity(37.82652, -122.42219),
  'yerba-buena': projectCity(37.8105, -122.3637),
  'treasure-island': projectCity(37.8235, -122.3707),
  'angel-island': projectCity(37.8609, -122.4326),
  /** west portal of the Yerba Buena tunnel (the Bay Bridge's island end) */
  'ybi-tunnel': { x: 215.1, z: -360.7 },
  /** the west crossing's real piers (OSM building parts W2 … W6, centre anchorage; research sf-data) */
  'bay-bridge-piers': { w2: { x: 250.4, z: -1.1 }, w3: { x: 240.7, z: -99.0 }, ca: { x: 235.7, z: -151.6 }, w5: { x: 230.5, z: -204.2 }, w6: { x: 221.0, z: -302.0 } },
} as const;
/** Angel Island at its real size: about 2 km across, Mount Livermore 240 m = 44 u on the terrain curve. */
export const ANGEL_ISLAND = { rx: 150, rz: 122, rot: 0.3, H: 44 } as const;

const WATER = DISTRICT.waterLevel;

// ---------------------------------------------------------------------------
// Bay Bridge
// ---------------------------------------------------------------------------

function segmentExit(ax: number, az: number, dx: number, dz: number, poly: Polygon): number {
  // distance along the ray from (a) inside the polygon to its boundary
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const ex = q.x - p.x, ez = q.z - p.z;
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((p.x - ax) * ez - (p.z - az) * ex) / den;
    const u = ((p.x - ax) * dz - (p.z - az) * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  return best;
}

/** A vertical suspender strand of the west span (city mode, W5-V10): foot (x, z), deck to cable (y0 → y1), t along the crossing, the cable plane. */
export interface BayStrand { x: number; z: number; y0: number; y1: number; t: number; side: number }
/** `strands` / `right` (city mode): the suspender strands of both cable planes and the frame's side +1 direction (the light field's Bay Lights). */
export interface BridgeInfo { towers: THREE.Vector3[]; start: THREE.Vector3; end: THREE.Vector3; strands?: BayStrand[]; right?: { x: number; z: number } }

function bayBridge(b: Batch, halos: HaloSpec[], def: BackdropDef, city = false): BridgeInfo {
  const ybi = city ? CITY_BACKDROP['ybi-tunnel'] : DISTRICT.backdrop.find(x => x.kind === 'yerba-buena')?.position ?? { x: def.position.x, z: def.position.z - 270 };
  const dx0 = ybi.x - def.position.x, dz0 = ybi.z - def.position.z, full = Math.hypot(dx0, dz0);
  const dx = dx0 / full, dz = dz0 / full;
  // the span is cut where the diorama ends: the bay-side water skirt's outer edge (city mode: the whole crossing)
  const L = city ? full : Math.min(full, segmentExit(def.position.x, def.position.z, dx, dz, slabSkirt().outer) - 0.05);
  const ry = Math.atan2(dx, dz);
  const f = new Frame(def.position.x, 0, def.position.z, ry);
  const steel = PAL.bridge, dark = PAL.bridgeDark;
  // floodlit faces at night (anchorage, towers)
  const lit: Info = [0, 0, 0, 0.09];
  const DECK = 10, TOP = 30, HALF = 3.4;
  // real proportions of the west span compressed onto the full length: W1, W2, centre anchorage (city mode: the real
  // piers' stations along the crossing — the hero anchorage sits 18 u west of the real one, so the straight toy
  // bridge passes 4–18 u west of the piers themselves)
  const P = CITY_BACKDROP['bay-bridge-piers'], along = (q: { x: number; z: number }) => (q.x - def.position.x) * dx + (q.z - def.position.z) * dz;
  const sW1 = city ? along(P.w2) : full * 0.125, sW2 = city ? along(P.w3) : full * 0.375, sCA = city ? along(P.ca) : Math.min(full * 0.5, L - 4);
  // SF anchorage: stepped art-deco concrete with vertical fins, the cables dive into its saddle housing
  const conc = '#ddd7cb', concDark = '#c8c1b4';
  b.add(BOX(), f.at(0, -0.6, 2, 0, 12, 4.2, 14), concDark);
  b.add(BOX(), f.at(0, 3.6, 2.4, 0, 10.4, DECK - 3.2, 12.2), conc, lit);
  b.add(BOX(), f.at(0, DECK + 0.4, 3.2, 0, 9.2, 2.2, 9.6), conc, lit);
  b.add(BOX(), f.at(0, DECK + 2.6, 3.2, 0, 9.8, 0.4, 10.2), '#ebe6dc');
  for (let i = -3; i <= 3; i++) {
    for (const side of [-1, 1]) b.add(BOX(), f.at(side * 5.25, 3.6, 2.4 + i * 1.6, 0, 0.3, DECK - 3.6, 0.5), '#e9e3d8');
    b.add(BOX(), f.at(i * 1.35, 3.6, -3.75, 0, 0.5, DECK - 3.6, 0.3), '#e9e3d8');
  }
  b.add(BOX(), f.at(0, 4.2, -3.9, 0, 3.4, 4.2, 0.1), '#5f6b69');
  // deck + truss band
  b.add(BOX(), f.at(0, DECK - 1.3, L / 2, 0, HALF * 2 - 0.4, 1.3, L), dark);
  b.add(BOX(), f.at(0, DECK, L / 2, 0, HALF * 2, 0.45, L), steel);
  for (let s = 4; s < L - 1; s += 4) for (const side of [-1, 1]) b.beam(v3(0, 0, 0).copy(f.point(side * (HALF - 0.25), DECK - 1.3, s - 2)), f.point(side * (HALF - 0.25), DECK - 0.05, s), 0.12, 0.12, dark);
  // towers (city mode: the second suspension span, centre anchorage to W5, W6 and Yerba Buena, mirrors the first)
  const towers: THREE.Vector3[] = [];
  const sW5 = city ? along(P.w5) : full * 0.625, sW6 = city ? along(P.w6) : full * 0.875;
  for (const s of city ? [sW1, sW2, sW5, sW6] : [sW1, sW2]) {
    towers.push(f.point(0, TOP, s));
    b.add(BOX(), f.at(0, WATER - 0.4, s, 0, 9, 1.6, 4), '#c9c2b5');
    for (const side of [-1, 1]) {
      b.add(BOX(), f.at(side * HALF, WATER + 1, s, 0, 1.25, TOP - WATER - 1, 1.5), steel, lit);
      b.add(BOX(), f.at(side * HALF, TOP, s, 0, 1.45, 0.6, 1.7), dark);
      // aircraft warning lights: slow blink
      halos.push({ ...xyz(f.point(side * HALF, TOP + 0.9, s)), size: 1.2, color: new THREE.Color(1.3, 0.22, 0.16), day: 0, blink: true });
    }
    for (const y of [DECK - 1.8, 17.5, 23.5, TOP - 0.8]) b.add(BOX(), f.at(0, y, s, 0, HALF * 2, 0.7, 1.1), steel);
    for (const [y0, y1] of [[DECK + 0.5, 17.5], [18.2, 23.5], [24.2, TOP - 0.8]]) {
      b.beam(f.point(-HALF, y0, s), f.point(HALF, y1, s), 0.3, 0.3, steel);
      b.beam(f.point(HALF, y0, s), f.point(-HALF, y1, s), 0.3, 0.3, steel);
    }
  }
  // centre anchorage at the cut
  b.add(BOX(), f.at(0, WATER - 0.4, sCA, 0, 9.5, 17 - WATER, 7), '#cfc9bd', lit);
  b.add(BOX(), f.at(0, 16.4, sCA, 0, 10, 0.6, 7.4), '#e0dbd0');
  // main cables: anchorage → W1 → sag → W2 → sag → centre anchorage
  const cableY0 = (s: number) => {
    if (s <= sW1) { const t = s / sW1; return DECK + 0.8 + (TOP - DECK - 0.8) * t * t * 0.4 + (TOP - DECK - 0.8) * 0.6 * t; }
    if (s <= sW2) { const t = (s - sW1) / (sW2 - sW1); return TOP - (TOP - DECK - 2.5) * 4 * t * (1 - t); }
    const t = (s - sW2) / (sCA - sW2); return TOP + (16.8 - TOP) * t - 5 * t * (1 - t);
  };
  // city mode: the second span mirrors the first's shape (centre anchorage → W5, sag, W6 → the Yerba Buena end)
  const cableY = (s: number) => {
    if (!city || s <= sCA) return cableY0(s);
    if (s <= sW5) { const t = (sW5 - s) / (sW5 - sCA); return TOP + (16.8 - TOP) * t - 5 * t * (1 - t); }
    if (s <= sW6) { const t = (s - sW5) / (sW6 - sW5); return TOP - (TOP - DECK - 2.5) * 4 * t * (1 - t); }
    const t = Math.max(0, full - s) / (full - sW6);
    return DECK + 0.8 + (TOP - DECK - 0.8) * t * t * 0.4 + (TOP - DECK - 0.8) * 0.6 * t;
  };
  const cableEnd = city ? full : sCA;
  if (city) {
    // Yerba Buena anchorage and tunnel portal at the island end
    b.add(BOX(), f.at(0, WATER - 0.4, full - 3, 0, 11, DECK + 0.4 - WATER, 8), '#d6d0c4', lit);
    b.add(BOX(), f.at(0, DECK + 0.4, full - 3, 0, 11.4, 3.6, 7), '#ddd7cb', lit);
    b.add(arch(5.2, 3.6), f.at(0, DECK + 0.45, full - 7.02, Math.PI), '#34383a');
  }
  for (const side of [-1, 1]) {
    let prev = f.point(side * HALF, cableY(0), 0);
    for (let s = 2; s <= cableEnd + 0.01; s += 2) {
      if (city && Math.abs(s - sCA) < 1.01) { prev = f.point(side * HALF, cableY(s), s); continue; }
      const p = f.point(side * HALF, cableY(s), s);
      b.beam(prev, p, 0.3, 0.3, steel);
      if (s % 6 === 0 && cableY(s) > DECK + 1.2) b.beam(f.point(side * HALF, DECK + 0.2, s), p, 0.07, 0.07, dark);
      prev = p;
    }
    // necklace lights along the main cable + sodium lamps along the deck edge
    for (let s = 1.25; s <= cableEnd - 1; s += 2.5) if (!city || Math.abs(s - sCA) > 3) halos.push({ ...xyz(f.point(side * HALF, cableY(s) + 0.25, s)), size: 0.9, color: new THREE.Color(1.0, 0.94, 0.84) });
    for (let s = 3; s < L - 1; s += 6) halos.push({ ...xyz(f.point(side * (HALF + 0.2), DECK + 1.1, s)), size: 1.4, color: new THREE.Color(1.0, 0.71, 0.42) });
  }
  // the road continues past the cut: deck ends flush with the slab edge (cut face darker)
  if (!city) b.add(BOX(), f.at(0, DECK - 1.3, L - 0.05, 0, HALF * 2, 1.75, 0.1), '#6f6a62');
  const out: BridgeInfo = { towers, start: f.point(0, DECK, 0), end: f.point(0, DECK, L) };
  if (city) {
    // W5-V10: the suspender strands every 3 u (the light field strings its Bay Lights on the north plane's)
    const o = f.point(0, 0, 0), ox = o.x, oz = o.z, r = f.point(1, 0, 0);
    out.right = { x: r.x - ox, z: r.z - oz };
    out.strands = [];
    for (const side of [-1, 1]) for (let s = 3; s < cableEnd - 2; s += 3) {
      const y1 = cableY(s) - 0.2;
      if (Math.abs(s - sCA) < 4 || y1 < DECK + 2) continue;
      const p = f.point(side * HALF, 0, s);
      out.strands.push({ x: p.x, z: p.z, y0: DECK + 0.7, y1, t: s / full, side });
    }
  }
  return out;
}

const xyz = (v: THREE.Vector3) => ({ x: v.x, y: v.y, z: v.z });
function arch(w: number, h: number) {
  const sh = new THREE.Shape();
  const r = w / 2;
  sh.moveTo(-r, 0); sh.lineTo(-r, h - r); sh.absarc(0, h - r, r, Math.PI, 0, true); sh.lineTo(r, 0); sh.lineTo(-r, 0);
  return new THREE.ShapeGeometry(sh, 8);
}

// ---------------------------------------------------------------------------
// Satellite tiles
// ---------------------------------------------------------------------------

interface Tile {
  poly: Polygon;
  height: (x: number, z: number) => number;
  color: (x: number, z: number, h: number) => THREE.Color;
  dist: (x: number, z: number) => number;
  spacing: number;
}

function blob(cx: number, cz: number, rx: number, rz: number, rot: number, seed: number, n = 28): Polygon {
  const out: Polygon = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (hash2(seed, i) - 0.5) * 0.1 + Math.sin(a * 3 + seed) * 0.04;
    const lx = Math.cos(a) * rx * k, lz = Math.sin(a) * rz * k;
    out.push({ x: cx + lx * c - lz * s, z: cz + lx * s + lz * c });
  }
  return out;
}

/** Island bump: smooth dome with noisy coast. Returns land height (below WATER = sea). */
function islandFn(cx: number, cz: number, rx: number, rz: number, rot: number, H: number, seed: number, peak = 0.9) {
  const c = Math.cos(-rot), s = Math.sin(-rot);
  return (x: number, z: number) => {
    const lx = (x - cx) * c - (z - cz) * s, lz = (x - cx) * s + (z - cz) * c;
    const a = Math.atan2(lz, lx);
    const wob = 1 + Math.sin(a * 3 + seed) * 0.08 + Math.sin(a * 7 + seed * 2) * 0.04;
    const r = Math.hypot(lx / rx, lz / rz) / wob;
    if (r >= 1) return WATER - 0.4 - (r - 1) * 3;
    return WATER - 0.4 + (H + 0.4 - WATER) * Math.pow(1 - r * r, peak);
  };
}

function islandDist(fn: (x: number, z: number) => number, rMin: number) {
  return (x: number, z: number) => {
    const h = fn(x, z);
    if (h > WATER) return 0;
    return Math.min(24, (WATER - 0.4 - h) / 3 * rMin + 0.05);
  };
}

function naturalColor(x: number, z: number, h: number, green: string, dry: string, rock = '#b8a58a'): THREE.Color {
  if (h < WATER + 0.35) return C('#d9c7a0');
  const n = hash2(Math.floor(x / 4), Math.floor(z / 4));
  let c = mixColor(green, dry, 0.3 + n * 0.4);
  if (h > 6 && n > 0.7) c = mixColor(c, rock, 0.35);
  return c;
}

function buildTile(g: Batch, t: Tile, seed: number, city = false): THREE.BufferGeometry | null {
  const { poly, height, color, spacing } = t;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of poly) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const cols = Math.ceil((maxX - minX) / spacing) + 1, rows = Math.ceil((maxZ - minZ) / spacing) + 1;
  const inside = (x: number, z: number) => {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) ins = !ins;
    }
    return ins;
  };
  const snap = (x: number, z: number): [number, number] => {
    if (inside(x, z)) return [x, z];
    let best = Infinity, bx = x, bz = z;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
      const tt = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
      const qx = a.x + dx * tt, qz = a.z + dz * tt, d = (x - qx) ** 2 + (z - qz) ** 2;
      if (d < best) { best = d; bx = qx; bz = qz; }
    }
    return [bx, bz];
  };
  const ids = new Int32Array(cols * rows).fill(-1);
  const H = new Float32Array(cols * rows);
  const XZ = new Float32Array(cols * rows * 2);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const [x, z] = snap(minX + ((maxX - minX) * c) / (cols - 1), minZ + ((maxZ - minZ) * r) / (rows - 1));
    const k = r * cols + c;
    XZ[k * 2] = x; XZ[k * 2 + 1] = z; H[k] = height(x, z);
  }
  const vert = (c: number, r: number) => {
    const k = r * cols + c;
    if (ids[k] >= 0) return ids[k];
    const x = XZ[k * 2], z = XZ[k * 2 + 1], h = H[k];
    const e = 0.8;
    const n = new THREE.Vector3(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)).normalize();
    ids[k] = g.vert(x, Math.max(h, WATER - 1.5), z, n.x, n.y, n.z, color(x, z, h), [h > 3 ? 4 : 7, 0, 0, 0]);
    return ids[k];
  };
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const k = r * cols + c;
    if (Math.max(H[k], H[k + 1], H[k + cols], H[k + cols + 1]) <= WATER - 0.05) continue;
    const a = vert(c, r), b = vert(c + 1, r), d = vert(c, r + 1), e = vert(c + 1, r + 1);
    g.idx.push(a, d, b, b, d, e);
  }
  // city mode: the island rises straight out of the city water (no board edge, no water of its own)
  if (city) return null;
  slabEdge(g, poly, (x, z) => Math.max(height(x, z), WATER + 0.001), (x, z) => height(x, z) <= WATER, undefined, seed);
  return waterGrid(poly, Math.max(3, spacing * 1.5), WATER, t.dist);
}

// --- tile contents ------------------------------------------------------------

function alcatraz(b: Batch, halos: HaloSpec[], def: BackdropDef, beams: BeamSpec[]): Tile {
  const { x, z } = def.position;
  const rot = def.rotationY;
  const hFn = islandFn(x, z, 12, 5.5, rot, 4.6, 3, 0.35);
  const f = new Frame(x, 0, z, rot + Math.PI / 2);
  // cellhouse, lighthouse, water tower, warden's house ruins
  const top = 4.3;
  b.add(BOX(), f.at(0, top - 0.3, 0.5, 0, 3.2, 2.6, 9.5), '#e6e1d5', [1, top, 0, 0]);
  b.add(BOX(), f.at(0, top + 2.3, 0.5, 0, 3.4, 0.4, 9.8), '#cfc9bc');
  b.add(BOX(), f.at(0, top + 2.7, 0.5, 0, 1.4, 0.5, 8.6), '#d9d4c9');
  b.add(BOX(), f.at(1.7, top - 1.5, -5.5, 0.2, 3.0, 2.4, 2.2), '#d8cfbe', [1, top - 1.5, 0, 0]);
  b.add(BOX(), f.at(-2.2, top - 2.2, 6.6, -0.3, 2.4, 2.0, 2.0), '#cdbfa8', [1, top - 2.2, 0, 0]);
  // lighthouse
  b.add(CYL(8, 0.8), f.at(-1.8, top - 0.2, -2.8, 0, 0.55, 4.6, 0.55), '#f6f2e8');
  b.add(CYL(8), f.at(-1.8, top + 4.4, -2.8, 0, 0.62, 0.8, 0.62), '#fff1c4', [0, 0, 0, 1]);
  b.add(CONE(8), f.at(-1.8, top + 5.2, -2.8, 0, 0.7, 0.6, 0.7), '#4a5552');
  const lamp = f.point(-1.8, top + 4.8, -2.8);
  halos.push({ x: lamp.x, y: lamp.y, z: lamp.z, size: 3.2, color: new THREE.Color(1, 0.9, 0.62) });
  beams.push({ x: lamp.x, y: lamp.y, z: lamp.z, length: 60, speed: 0.9 });
  // water tower on stilts
  for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) b.add(CYL(4), f.at(2.2 + sx, top - 1.2, 3.8 + sz, 0, 0.07, 3.2, 0.07), '#8a8f8c');
  b.add(CYL(10), f.at(2.2, top + 2, 3.8, 0, 0.95, 1.3, 0.95), '#e2ddd2');
  b.add(CONE(10), f.at(2.2, top + 3.3, 3.8, 0, 1.0, 0.5, 1.0), '#b8b2a6');
  // scrubby planting on the terraces
  const r = rng(77);
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = 0.5 + r() * 0.45;
    const px = x + Math.cos(a) * 11 * d * Math.cos(rot) - Math.sin(a) * 5 * d * Math.sin(rot), pz = z + Math.cos(a) * 11 * d * Math.sin(rot) + Math.sin(a) * 5 * d * Math.cos(rot);
    const h = hFn(px, pz);
    if (h < WATER + 0.8) continue;
    b.add(ICO(0), M4(px, h + 0.3, pz, 0.7 + r() * 0.5), mixColor(PAL.tree, '#8a9a5a', r()), [0, 0, 0.2, 0]);
  }
  return {
    poly: blob(x, z, 24, 16, rot, 11),
    height: hFn,
    color: (px, pz, h) => naturalColor(px, pz, h, '#9fae78', '#b9a57f', '#a99a86'),
    dist: islandDist(hFn, 5.5),
    spacing: 1.5,
  };
}

/**
 * City mode: Alcatraz itself (land, cellhouse, buildings) streams in with the city; its lighthouse (the beam that
 * sweeps the Bay at night) stands on the island's crest at its real place (ground about 7.6 u = 35 m on the curve).
 */
function alcatrazLighthouse(b: Batch, halos: HaloSpec[], beams: BeamSpec[]) {
  const { x, z } = CITY_BACKDROP['alcatraz-lighthouse'];
  const top = 7.6;
  const f = new Frame(x, 0, z, 0);
  b.add(CYL(8, 0.8), f.at(0, top - 2.5, 0, 0, 0.75, 7.2, 0.75), '#f6f2e8', [0, top, 0, 0]);
  b.add(CYL(8), f.at(0, top + 4.7, 0, 0, 0.85, 1.0, 0.85), '#fff1c4', [0, 0, 0, 1]);
  b.add(CONE(8), f.at(0, top + 5.7, 0, 0, 0.95, 0.8, 0.95), '#4a5552');
  const lamp = f.point(0, top + 5.2, 0);
  halos.push({ x: lamp.x, y: lamp.y, z: lamp.z, size: 4, color: new THREE.Color(1, 0.9, 0.62) });
  beams.push({ x: lamp.x, y: lamp.y, z: lamp.z, length: 90, speed: 0.9 });
}

const M4 = (x: number, y: number, z: number, s: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.8, s));

function forest(b: Batch, hFn: (x: number, z: number) => number, cx: number, cz: number, rx: number, rz: number, n: number, seed: number, minH = 1) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.92;
    const px = cx + Math.cos(a) * rx * d, pz = cz + Math.sin(a) * rz * d;
    const h = hFn(px, pz);
    if (h < minH) continue;
    const s = 1.1 + r() * 1.2;
    if (r() < 0.5) b.add(CONE(6), new THREE.Matrix4().compose(new THREE.Vector3(px, h - 0.2, pz), new THREE.Quaternion(), new THREE.Vector3(s * 0.8, s * 2.2, s * 0.8)), mixColor(PAL.pine, '#3f6340', r()), [0, 0, 0.15, 0]);
    else b.add(ICO(0), M4(px, h + s * 0.5, pz, s), mixColor(PAL.tree, PAL.treeDark, r()), [0, 0, 0.15, 0]);
  }
}

function yerbaBuena(b: Batch, def: BackdropDef, halos: HaloSpec[]): Tile {
  const { x, z } = def.position;
  const hFn0 = islandFn(x, z, 17, 13, 0.2, 9.5, 5, 0.8);
  // Treasure Island: flat rectangle to the north
  const ti = { x: x - 2, z: z - 27 };
  const hFn = (px: number, pz: number) => {
    const a = hFn0(px, pz);
    const lx = Math.abs(px - ti.x) / 13, lz = Math.abs(pz - ti.z) / 9;
    const tiH = Math.max(lx, lz) < 1 ? WATER + 0.9 : WATER - 0.4 - (Math.max(lx, lz) - 1) * 6;
    return Math.max(a, tiH);
  };
  forest(b, hFn0, x, z, 16, 12, 55, 21, 1.2);
  // Treasure Island rows of low buildings + a hangar
  for (let i = 0; i < 6; i++) for (let k = 0; k < 2; k++) b.add(BOX(), new THREE.Matrix4().compose(new THREE.Vector3(ti.x - 9 + i * 3.4, WATER + 0.9, ti.z - 3 + k * 5), new THREE.Quaternion(), new THREE.Vector3(2.4, 1.4 + ((i + k) % 3) * 0.6, 3)), (i + k) % 2 ? '#e8e2d6' : '#d9d2c4', [2, WATER + 0.9, 0, 0]);
  // tunnel portal + bridge stub heading back to San Francisco (cut at the tile edge)
  const bridge = DISTRICT.backdrop.find(d => d.kind === 'bay-bridge');
  const dir = bridge ? Math.atan2(bridge.position.x - x, bridge.position.z - z) : Math.PI;
  const f = new Frame(x, 0, z, dir);
  // tunnel portal in the hillside, and the double-deck span leaving it toward San Francisco (cut at the edge)
  b.add(BOX(), f.at(0, 6.4, 10.6, 0, 8, 4.6, 1.6), '#d6d0c4');
  b.add(arch(5.2, 3.6), f.at(0, 7.0, 11.42), '#34383a');
  b.add(BOX(), f.at(0, 11.0, 10.6, 0, 8.6, 0.4, 1.9), '#e6e1d6');
  const stubLen = 19.5;
  b.add(BOX(), f.at(0, 9.7, 11.4 + stubLen / 2, 0, 6.6, 0.4, stubLen), PAL.bridge);
  b.add(BOX(), f.at(0, 7.4, 11.4 + stubLen / 2, 0, 6.2, 0.4, stubLen), PAL.bridge);
  for (const side of [-1, 1]) for (let k = 0; k < stubLen; k += 3) b.beam(f.point(side * 3.1, 7.4, 11.6 + k), f.point(side * 3.1, 9.7, 13.1 + k), 0.16, 0.16, PAL.bridgeDark);
  for (const side of [-1, 1]) b.add(BOX(), f.at(side * 2.2, WATER, 24, 0, 1.1, 9.8 - WATER, 1.6), '#cfc9bd');
  b.add(BOX(), f.at(0, 6.6, 24, 0, 5.6, 0.8, 1.8), '#cfc9bd');
  b.add(BOX(), f.at(0, 7.2, 11.4 + stubLen - 0.05, 0, 6.8, 2.9, 0.1), '#6f6a62');
  halos.push({ ...xyz(f.point(0, 10.6, 28)), size: 1.4, color: new THREE.Color(1, 0.9, 0.7) });
  // Treasure Island streets and a few houses on Yerba Buena: warm dots across the water at night
  const lr = rng(2718);
  for (let i = 0; i < 12; i++) halos.push({ x: ti.x - 10 + (i % 6) * 4 + (lr() - 0.5) * 1.5, y: WATER + 2.6 + lr() * 0.8, z: ti.z - 4 + Math.floor(i / 6) * 7 + (lr() - 0.5) * 1.5, size: 1.1 + lr() * 0.5, color: new THREE.Color(1.0, 0.72 + lr() * 0.12, 0.42) });
  for (let i = 0; i < 6; i++) {
    const a = lr() * Math.PI * 2, d = 5 + lr() * 8;
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    halos.push({ x: px, y: hFn0(px, pz) + 1.2, z: pz, size: 1.0, color: new THREE.Color(1.0, 0.8, 0.55) });
  }
  return {
    poly: blob(x - 1, z - 4, 30, 36, 0.1, 13),
    height: hFn,
    color: (px, pz, h) => (h < WATER + 1.2 && Math.abs(pz - ti.z) < 10 ? C('#d8d2c2') : naturalColor(px, pz, h, '#86a868', '#a3a878')),
    dist: islandDist(hFn, 8),
    spacing: 2,
  };
}

function angelIsland(b: Batch, def: BackdropDef, city = false): Tile {
  if (city) {
    // real place and size (Marin County, not in the streamed data)
    const { x, z } = CITY_BACKDROP['angel-island'], A = ANGEL_ISLAND;
    const hFn = islandFn(x, z, A.rx, A.rz, A.rot, A.H, 8, 1.1);
    forest(b, hFn, x, z, A.rx * 0.88, A.rz * 0.88, 420, 31, 3);
    return { poly: blob(x, z, A.rx * 1.18, A.rz * 1.18, A.rot, 17), height: hFn, color: (px, pz, h) => naturalColor(px, pz, h, '#8fa866', '#b5a87a'), dist: islandDist(hFn, 60), spacing: 5 };
  }
  const { x, z } = def.position;
  const hFn = islandFn(x, z, 34, 26, def.rotationY, 21, 8, 1.1);
  forest(b, hFn, x, z, 30, 23, 120, 31, 2);
  return {
    poly: blob(x, z, 48, 38, def.rotationY, 17),
    height: hFn,
    color: (px, pz, h) => naturalColor(px, pz, h, '#8fa866', '#b5a87a'),
    dist: islandDist(hFn, 20),
    spacing: 3,
  };
}

function ridge(def: BackdropDef, length: number, depth: number, H: number, seed: number, landSide: number) {
  const { x, z } = def.position;
  const s = def.scale;
  const rot = def.rotationY;
  const c = Math.cos(rot), sn = Math.sin(rot);
  // local: u along the ridge (x'), w across (z') — land where w*landSide > shoreline
  const toLocal = (px: number, pz: number) => ({ u: (px - x) * c - (pz - z) * sn, w: (px - x) * sn + (pz - z) * c });
  const L = length * s, D = depth * s;
  const hFn = (px: number, pz: number) => {
    const { u, w } = toLocal(px, pz);
    const ww = w * landSide;
    const shore = -D * 0.15 + Math.sin(u * 0.05 + seed) * 4 + Math.sin(u * 0.13 + seed * 2) * 2;
    if (ww < shore) return WATER - 0.4 - (shore - ww) * 0.4;
    const t = Math.min(1, (ww - shore) / (D * 0.62));
    const crest = H * s * (0.75 + 0.25 * Math.sin(u * 0.03 + seed) + 0.12 * Math.sin(u * 0.11 + seed * 3));
    const endFade = Math.min(1, Math.max(0, (L / 2 - Math.abs(u)) / 30));
    return WATER + 0.3 + (crest * Math.sin(t * Math.PI * 0.5) ** 1.3) * (0.35 + 0.65 * endFade);
  };
  const poly: Polygon = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const lu = Math.cos(a) * L / 2 * (1 + (hash2(seed, i) - 0.5) * 0.06), lw = Math.sin(a) * D / 2 * (1 + (hash2(i, seed) - 0.5) * 0.12);
    poly.push({ x: x + lu * c + lw * sn, z: z - lu * sn + lw * c });
  }
  return { hFn, poly, toLocal, L, D };
}

function marin(b: Batch, def: BackdropDef): Tile {
  const { hFn, poly } = ridge(def, 160, 90, 26, 3, -1);
  forest(b, hFn, def.position.x, def.position.z, 40, 90, 60, 41, 6);
  return { poly, height: hFn, color: (px, pz, h) => naturalColor(px, pz, h, '#a5a570', '#c2ad7c', '#a89880'), dist: (px, pz) => Math.max(0, Math.min(24, (WATER - hFn(px, pz)) * 2.5)), spacing: 4 };
}

function eastBay(b: Batch, def: BackdropDef, seed: number): Tile {
  const { hFn, poly, toLocal } = ridge(def, 200, 80, 24, seed, -1);
  // town at the foot of the hills: rows of small white blocks
  const r = rng(seed * 101);
  for (let i = 0; i < 70; i++) {
    const px = def.position.x + (r() - 0.5) * 170 * def.scale, pz = def.position.z + (r() - 0.5) * 70 * def.scale;
    const h = hFn(px, pz);
    const { w } = toLocal(px, pz);
    if (h < WATER + 0.3 || h > WATER + 5 || w > 10) continue;
    const bh = 1 + r() * (r() < 0.12 ? 7 : 2);
    b.add(BOX(), new THREE.Matrix4().compose(new THREE.Vector3(px, h - 0.3, pz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), def.rotationY), new THREE.Vector3(2 + r() * 2, bh, 2 + r() * 2)), r() < 0.5 ? '#ece6da' : '#ddd5c6', [bh > 3 ? 2 : 1, h - 0.3, 0, 0]);
  }
  forest(b, hFn, def.position.x, def.position.z, 90 * def.scale, 30 * def.scale, 50, seed * 7, 7);
  return { poly, height: hFn, color: (px, pz, h) => (h < WATER + 5 ? mixColor('#ddd4c2', '#b9b39a', hash2(px, pz) * 0.5) : naturalColor(px, pz, h, '#9aa66c', '#bba77a')), dist: (px, pz) => Math.max(0, Math.min(24, (WATER - hFn(px, pz)) * 2.5)), spacing: 4 };
}

function skyline(b: Batch, def: BackdropDef, halos: HaloSpec[]): Tile {
  const { x, z } = def.position;
  const poly = blob(x, z, 64, 22, 0, 23, 22);
  const r = rng(515);
  const cols = ['#d9d4c7', '#c9ccca', '#e3ddcf', '#b6c3c6', '#cfc6b6'];
  for (let i = 0; i < 26; i++) {
    const px = x + (r() - 0.5) * 100, pz = z + (r() - 0.5) * 22;
    const h = 8 + r() * r() * 34;
    const w = 3 + r() * 3.5, d = 3 + r() * 3.5;
    const col = cols[Math.floor(r() * cols.length)];
    b.add(BOX(), new THREE.Matrix4().compose(new THREE.Vector3(px, 0, pz), new THREE.Quaternion(), new THREE.Vector3(w, h, d)), col, [r() > 0.5 ? 6 : 2, 0, 0, 0]);
    b.add(BOX(), new THREE.Matrix4().compose(new THREE.Vector3(px, h, pz), new THREE.Quaternion(), new THREE.Vector3(w * 0.7, 0.8 + r() * 1.5, d * 0.7)), shade(col, 1.05));
    if (h > 26) halos.push({ x: px, y: h + 2.4, z: pz, size: 1.2, color: new THREE.Color(1, 0.3, 0.25), day: 0 });
  }
  return { poly, height: () => 0, color: (px, pz) => mixColor(PAL.land, '#d8cdb8', hash2(Math.floor(px / 6), Math.floor(pz / 6)) * 0.6), dist: () => 0, spacing: 6 };
}

// ---------------------------------------------------------------------------

/** A few cotton-wool clouds hung high over the bay (only seen in cinematic / horizon views). */
function clouds(b: Batch) {
  const r = rng(1906);
  const spots: [number, number, number][] = [[-160, -170, 96], [60, -210, 104], [230, -150, 92], [-330, -60, 100], [-40, -300, 112], [300, 40, 98], [-260, 160, 106], [140, 230, 100]];
  for (const [cx, cz, y] of spots) {
    const n = 4 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const s = 7 + r() * 7;
      const x = cx + (i - n / 2) * 7 + (r() - 0.5) * 5, z = cz + (r() - 0.5) * 10;
      b.add(ICO(1), new THREE.Matrix4().compose(new THREE.Vector3(x, y + (r() - 0.3) * 4, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.62, s * 0.9)), (_x, yy) => (yy < y - s * 0.2 ? C('#e9edf0') : C('#fbfaf6')));
    }
  }
}

export interface BeamSpec { x: number; y: number; z: number; length: number; speed: number }

export interface BackdropOut {
  boards: Polygon[];
  water: THREE.BufferGeometry[];
  beams: BeamSpec[];
  bridge: BridgeInfo | null;
}

export function buildBackdrop(g: Batch, b: Batch, halos: HaloSpec[], mode: WorldMode = 'district'): BackdropOut {
  if (mode === 'city') return buildCityBackdrop(g, b, halos);
  const boards: Polygon[] = [slabSkirt().outer];
  const water: THREE.BufferGeometry[] = [];
  const beams: BeamSpec[] = [];
  let bridge: BridgeInfo | null = null;
  let seed = 1;
  let eb = 0;
  for (const def of DISTRICT.backdrop) {
    let tile: Tile | null = null;
    switch (def.kind) {
      case 'bay-bridge': bridge = bayBridge(b, halos, def); break;
      case 'alcatraz': tile = alcatraz(b, halos, def, beams); break;
      case 'yerba-buena': tile = yerbaBuena(b, def, halos); break;
      case 'angel-island': tile = angelIsland(b, def); break;
      case 'marin-hills': tile = marin(b, def); break;
      case 'east-bay-hills': tile = eastBay(b, def, 5 + eb++ * 4); break;
      case 'skyline': tile = skyline(b, def, halos); break;
    }
    if (!tile) continue;
    boards.push(tile.poly);
    const wg = buildTile(g, tile, seed++ * 17)!;
    if (def.kind !== 'skyline') water.push(wg); else wg.dispose();
  }
  clouds(b);
  return { boards, water, beams, bridge };
}

/** City mode (see the file header). Boards and water come from the city (world/sf/water.ts). */
function buildCityBackdrop(g: Batch, b: Batch, halos: HaloSpec[]): BackdropOut {
  const beams: BeamSpec[] = [];
  let bridge: BridgeInfo | null = null;
  for (const def of DISTRICT.backdrop) {
    if (def.kind === 'bay-bridge') bridge = bayBridge(b, halos, def, true);
    else if (def.kind === 'alcatraz') alcatrazLighthouse(b, halos, beams);
    else if (def.kind === 'angel-island') buildTile(g, angelIsland(b, def, true), 3 * 17, true);
  }
  // no hand-hung clouds in city mode (CS-12: from high views they rested on the waterfront): Karl the Fog's cloud
  // bank (world/sf/cloudBank.ts) is the city's
  return { boards: [], water: [], beams, bridge };
}

