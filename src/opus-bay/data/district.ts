import type {
  BackdropDef, BuildingLot, BuildingStyle, District, HillDef, LandmarkDef, PierDef, Polygon, PropDef, PropKind, Ramp, RoadDef,
  SurfaceKind, Vec2, WalkArea,
} from '../core/types';

/**
 * Opus Bay district: the San Francisco Embarcadero, Ferry Building → Pier 39, plus Telegraph Hill.
 *
 * Geography is real (OpenStreetMap geometry, © OpenStreetMap contributors, ODbL, sampled 2026-09-25):
 * the F-line median polyline, pier stations and angles, the street grid, Filbert Steps and Coit Tower
 * were measured offline and are stored here as compact numbers. Everything else is generated
 * deterministically at module load (seeded RNG), so the data stays small and reproducible.
 *
 * Coordinate contract (DESIGN.md §5): x = east-ish, z = south-ish, y up. The real map is rotated 46°
 * counter-clockwise (on a north-up map) so the Embarcadero runs along the x axis:
 * Ferry Building at +x (east end), Pier 39 at −x (west end), the Bay to −z, city + Telegraph Hill to +z.
 * Land features use `project()` exactly (0.14 u per real meter). The waterfront strip is "inflated" for
 * toy-scale walking: the promenade centreline sits SHIFT units seaward of the scaled real F-line median,
 * and piers hang off the promenade edge with their real stations, widths and angles.
 *
 * Polygons are counter-clockwise when viewed from above (signed area of (x, −z) > 0), i.e. they can be fed
 * to THREE.Shape as (x, −z) and rotated −90° about X.
 * Headings / rotationY follow three.js: an object with rotation.y = r faces (sin r, cos r).
 *
 * Notes for other modules
 * - walk[] is ground-level paving on LAND; walkable pier decks live only in piers[] (walkable: true) so decks
 *   are drawn once. `crosswalk-*` walk areas overlap the roadway (draw the zebra from roads[] kind 'crosswalk').
 * - Heights: always use core/terrain heightAt() (hills + ramp corridors + flat plazas); decks are at 0,
 *   waterLevel −0.6, the Coit summit plaza at SUMMIT_HEIGHT. Lots on the hill carry baseY (lowest corner).
 * - Pier sheds: shed.footprint is the blocking volume, shed.facade the painted "PIER n" front facing the
 *   promenade. The 'exploratorium' and 'pier33' landmarks dress the Pier 15 / Pier 33 sheds (not extra buildings).
 * - Backdrop positions are compressed real bearings; the Bay Bridge runs from its 'bay-bridge' position
 *   (SF end, on the slab edge) to the 'yerba-buena' position.
 * - LAND (below) is the land mass inside the slab; everything else inside the slab is water or deck.
 */

// ---------------------------------------------------------------------------
// 1. Projection (real lat/lng → world)
// ---------------------------------------------------------------------------

const RAD = Math.PI / 180;
/** world units per real meter */
const K = 0.14;
const ROT = 46 * RAD;
const LAT0 = 37.802338;
const LNG0 = -122.40001;
const MX = 111320 * Math.cos(LAT0 * RAD);
const MZ = 110540;
const COS = Math.cos(ROT), SIN = Math.sin(ROT);

const r2 = (v: number) => Math.round(v * 100) / 100;
const v2 = (x: number, z: number): Vec2 => ({ x: r2(x), z: r2(z) });

/** Real lat/lng → world (x, z). Exact for land features (city, hill, landmarks behind the roadway). */
export function project(lat: number, lng: number): Vec2 {
  const e = (lng - LNG0) * MX, n = (lat - LAT0) * MZ;
  return v2(K * (e * COS - n * SIN), K * (-e * SIN - n * COS));
}

/** World (x, z) → approximate real lat/lng (inverse of project; waterfront features are shifted, see SHIFT). */
export function unproject(p: Vec2): { lat: number; lng: number } {
  const X = p.x / K, Z = p.z / K;
  const e = X * COS - Z * SIN, n = -X * SIN - Z * COS;
  return { lat: LAT0 + n / MZ, lng: LNG0 + e / MX };
}

// ---------------------------------------------------------------------------
// 2. Waterfront spine (station `st` along the real F-line median, 0 = east end past Pier 14)
// ---------------------------------------------------------------------------

/** F-line median of The Embarcadero, OSM railway=tram, smoothed, projected; east → west. */
const MEDIAN_XZ = [
  195.0, 30.5, 191.4, 29.1, 187.9, 27.9, 184.3, 27.1, 180.3, 26.7, 176.1, 26.5, 171.8, 26.5, 167.5, 26.8, 163.5, 27.4, 159.4, 28.0,
  155.1, 28.4, 150.7, 28.3, 146.2, 27.5, 141.4, 26.3, 136.3, 25.0, 131.1, 24.0, 126.2, 23.2, 121.8, 22.6, 118.0, 22.2, 114.5, 21.8,
  111.0, 21.4, 107.5, 20.9, 104.0, 20.4, 100.4, 19.9, 96.9, 19.3, 93.3, 18.8, 89.3, 18.2, 84.9, 17.6, 80.2, 16.9, 75.2, 16.1,
  70.5, 15.4, 66.1, 14.7, 62.1, 14.0, 58.4, 13.5, 54.7, 12.8, 50.5, 12.1, 45.4, 11.3, 39.6, 10.4, 33.7, 9.5, 28.3, 8.6,
  23.5, 7.9, 18.5, 7.0, 12.1, 5.9, 4.2, 4.6, -4.4, 3.3, -12.2, 2.1, -18.8, 1.2, -24.5, 0.4, -29.9, -0.3, -35.0, -0.8,
  -39.8, -1.1, -44.3, -1.1, -48.8, -1.0, -53.2, -0.7, -57.8, -0.5, -63.1, -0.1, -69.1, 0.4, -75.4, 1.1, -81.5, 1.9, -86.8, 2.7,
  -91.4, 3.6, -95.4, 4.4, -99.0, 5.3, -102.5, 6.2, -106.1, 7.1, -109.6, 8.0, -113.1, 8.9, -116.6, 9.8, -120.1, 10.6, -123.6, 11.4,
  -127.1, 12.4, -130.6, 13.5, -134.1, 15.0, -137.6, 17.0, -141.1, 20.2, -144.6, 24.7, -148.1, 30.3,
];

/** promenade centre = scaled real median + SHIFT toward the Bay */
const SHIFT = 18.4;

/**
 * The raw median has the F-line's S-bend at the Ferry Building loop; the waterfront strip hangs up to ~50 u
 * off this line there, so it is straightened with a station-dependent Gaussian (σ 24 u around the Ferry
 * Building, 6 u elsewhere so the real Pier 33 → Pier 39 bend is kept).
 */
const MED: Vec2[] = (() => {
  const raw: Vec2[] = [];
  for (let i = 0; i < MEDIAN_XZ.length; i += 2) raw.push({ x: MEDIAN_XZ[i], z: MEDIAN_XZ[i + 1] });
  const cum = [0];
  for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].z - raw[i - 1].z));
  const total = cum[cum.length - 1];
  const sample = (st: number): Vec2 => {
    let i = 1;
    while (i < raw.length - 1 && cum[i] < st) i++;
    const t = (st - cum[i - 1]) / (cum[i] - cum[i - 1]);
    return { x: raw[i - 1].x + (raw[i].x - raw[i - 1].x) * t, z: raw[i - 1].z + (raw[i].z - raw[i - 1].z) * t };
  };
  const pts: Vec2[] = [];
  for (let st = 0; st <= total; st += 1) pts.push(sample(st));
  const n = pts.length;
  const get = (j: number): Vec2 => (j < 0 ? { x: 2 * pts[0].x - pts[-j].x, z: 2 * pts[0].z - pts[-j].z } : j >= n ? { x: 2 * pts[n - 1].x - pts[2 * n - 2 - j].x, z: 2 * pts[n - 1].z - pts[2 * n - 2 - j].z } : pts[j]);
  const sigmaAt = (st: number) => (st <= 100 ? 24 : st >= 135 ? 6 : 24 - ((st - 100) / 35) * 18);
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const sg = sigmaAt(i), K = Math.ceil(sg * 2.5);
    let sx = 0, sz = 0, sw = 0;
    for (let k = -K; k <= K; k++) { const w = Math.exp(-0.5 * (k / sg) ** 2), q = get(i + k); sx += q.x * w; sz += q.z * w; sw += w; }
    out.push({ x: sx / sw, z: sz / sw });
  }
  return out;
})();
const MED_CUM: number[] = [0];
for (let i = 1; i < MED.length; i++) MED_CUM.push(MED_CUM[i - 1] + Math.hypot(MED[i].x - MED[i - 1].x, MED[i].z - MED[i - 1].z));
/** total median length (stations run 0 … MEDIAN_LENGTH; values outside extrapolate straight) */
export const MEDIAN_LENGTH = MED_CUM[MED_CUM.length - 1];

function medianPoint(st: number): Vec2 {
  const n = MED.length;
  if (st <= 0) {
    const dx = MED[1].x - MED[0].x, dz = MED[1].z - MED[0].z, L = Math.hypot(dx, dz);
    return { x: MED[0].x + (dx / L) * st, z: MED[0].z + (dz / L) * st };
  }
  if (st >= MEDIAN_LENGTH) {
    const dx = MED[n - 1].x - MED[n - 2].x, dz = MED[n - 1].z - MED[n - 2].z, L = Math.hypot(dx, dz);
    const e = st - MEDIAN_LENGTH;
    return { x: MED[n - 1].x + (dx / L) * e, z: MED[n - 1].z + (dz / L) * e };
  }
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (MED_CUM[mid] <= st) lo = mid; else hi = mid; }
  const t = (st - MED_CUM[lo]) / (MED_CUM[hi] - MED_CUM[lo]);
  return { x: MED[lo].x + (MED[hi].x - MED[lo].x) * t, z: MED[lo].z + (MED[hi].z - MED[lo].z) * t };
}

export interface SpineFrame {
  /** promenade centreline point */
  x: number; z: number;
  /** unit tangent toward increasing station (toward Pier 39) */
  tx: number; tz: number;
  /** unit normal toward the Bay */
  nx: number; nz: number;
}

/** Frame on the promenade centreline at station st. */
export function frameAt(st: number): SpineFrame {
  const a = medianPoint(st - 2), b = medianPoint(st + 2), m = medianPoint(st);
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
  const tx = dx / L, tz = dz / L, nx = -tz, nz = tx;
  return { x: m.x + nx * SHIFT, z: m.z + nz * SHIFT, tx, tz, nx, nz };
}

/** Point at station st, offset d from the promenade centreline (d > 0 toward the Bay, d < 0 toward the city). */
export function at(st: number, d = 0): Vec2 {
  const f = frameAt(st);
  return v2(f.x + f.nx * d, f.z + f.nz * d);
}

/** Heading (three.js rotation.y) that faces from a toward b. */
export function headingTo(a: Vec2, b: Vec2): number {
  return r2(Math.atan2(b.x - a.x, b.z - a.z));
}
const faceDir = (dx: number, dz: number) => r2(Math.atan2(dx, dz));

// Cross-section of the waterfront (d from the promenade centreline).
export const SECTION = {
  promenade: [-5, 5],
  seawall: 5,
  laneNorth: [-5, -9.4],
  platform: [-9.4, -11.5],
  trackA: -12.9,
  trackB: -15.7,
  laneSouth: [-17.1, -21.6],
  sidewalk: [-21.6, -24.4],
  buildingLine: -24.8,
} as const;

// Stations of real features (game units along the median, measured from OSM).
const ST = {
  east: 12,
  pier14: 21.7,
  ferrySouth: 27,
  ferryA: 50,
  ferryClock: 66,
  ferryB: 82,
  ferryNorth: 89,
  pier1: 95,
  pier1half: 101.4,
  pier3: 109.4,
  pier5: 118,
  pier7: 129.6,
  pier9: 155,
  pier15: 171.1,
  fogBridge: 177.8,
  pier17: 183.3,
  pier19: 199.5,
  pier23: 212.5,
  pier27: 236,
  pier29: 267,
  pier31: 278,
  pier33: 290,
  pier35: 307,
  pier39: 349,
  west: 364,
  stopFerry: 64,
  stopGreen: 169,
  stopBay: 294,
  stopPier39: 344,
} as const;
export const STATIONS = ST;

// ---------------------------------------------------------------------------
// 3. Small geometry helpers
// ---------------------------------------------------------------------------

function area2(p: Polygon) {
  let s = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j].x * p[i].z - p[i].x * p[j].z;
  return s;
}
/** Normalise to counter-clockwise-from-above (see header). */
export function ccw(p: Polygon): Polygon {
  return area2(p) > 0 ? p.slice().reverse() : p;
}
export function polygonArea(p: Polygon) { return Math.abs(area2(p)) / 2; }
export function centroid(p: Polygon): Vec2 {
  let x = 0, z = 0;
  for (const q of p) { x += q.x; z += q.z; }
  return { x: x / p.length, z: z / p.length };
}
function inPoly(p: Vec2, poly: Polygon) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
function segDist(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}
function polyDist(p: Vec2, poly: Polygon) {
  if (inPoly(p, poly)) return 0;
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, segDist(p, poly[j], poly[i]));
  return d;
}
function polylineDist(p: Vec2, pts: Vec2[]) {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(p, pts[i - 1], pts[i]));
  return d;
}
/** Clip polygon to the half-plane (p − o)·n ≤ 0. */
function clipHalf(poly: Polygon, o: Vec2, n: Vec2): Polygon {
  const out: Polygon = [];
  const side = (p: Vec2) => (p.x - o.x) * n.x + (p.z - o.z) * n.z;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b);
    if (sa <= 0) out.push(a);
    if ((sa <= 0) !== (sb <= 0)) { const t = sa / (sa - sb); out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }); }
  }
  return out;
}
function clipConvex(poly: Polygon, clip: Polygon): Polygon {
  const c = ccw(clip);
  let out = poly;
  for (let i = 0; i < c.length && out.length; i++) {
    const a = c[i], b = c[(i + 1) % c.length];
    // for CCW-from-above polygons, the interior is to the right of a→b in (x, z)
    const n = { x: -(b.z - a.z), z: b.x - a.x };
    out = clipHalf(out, a, n);
  }
  return out;
}
const roundPoly = (p: Polygon): Polygon => ccw(p.map(q => v2(q.x, q.z)));
/** Convex hull (monotone chain). */
function hull(pts: Vec2[]): Polygon {
  const p = pts.slice().sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower: Vec2[] = [], upper: Vec2[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return roundPoly([...lower.slice(0, -1), ...upper.slice(0, -1)]);
}

/** Curved strip following the spine: stations st0→st1, offsets d0→d1. */
function strip(st0: number, st1: number, d0: number, d1: number, step = 2): Polygon {
  const n = Math.max(1, Math.ceil(Math.abs(st1 - st0) / step));
  const a: Vec2[] = [], b: Vec2[] = [];
  for (let i = 0; i <= n; i++) { const s = st0 + ((st1 - st0) * i) / n; a.push(at(s, d0)); b.push(at(s, d1)); }
  return roundPoly([...a, ...b.reverse()]);
}
function circle(c: Vec2, r: number, seg = 24): Polygon {
  const out: Polygon = [];
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; out.push({ x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r }); }
  return roundPoly(out);
}
/** Oriented rectangle centred at c, half sizes hx along direction (dx,dz) and hz across. */
function orect(c: Vec2, dx: number, dz: number, hx: number, hz: number): Polygon {
  const L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, px = -uz, pz = ux;
  return roundPoly([
    { x: c.x - ux * hx - px * hz, z: c.z - uz * hx - pz * hz },
    { x: c.x + ux * hx - px * hz, z: c.z + uz * hx - pz * hz },
    { x: c.x + ux * hx + px * hz, z: c.z + uz * hx + pz * hz },
    { x: c.x - ux * hx + px * hz, z: c.z - uz * hx + pz * hz },
  ]);
}

/** Station + offset of an arbitrary world point relative to the promenade (coarse→fine search). */
const COARSE_ST: number[] = [];
const COARSE_XZ: number[] = [];
for (let s = -60; s <= 440; s += 3) { const m = medianPoint(s); COARSE_ST.push(s); COARSE_XZ.push(m.x, m.z); }
export function stationOf(p: Vec2): { st: number; d: number } {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < COARSE_ST.length; i++) {
    const dx = p.x - COARSE_XZ[2 * i], dz = p.z - COARSE_XZ[2 * i + 1], d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = COARSE_ST[i]; }
  }
  for (let step = 1.5; step > 0.05; step /= 2) {
    for (const s of [best - step, best + step]) {
      const m = medianPoint(s), d = (p.x - m.x) ** 2 + (p.z - m.z) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
  }
  const f = frameAt(best);
  return { st: best, d: (p.x - f.x) * f.nx + (p.z - f.z) * f.nz };
}

// Seeded RNG (mulberry32) — layout must be deterministic.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 4. Hills (Telegraph Hill) — profile shared with core/terrain.ts
// ---------------------------------------------------------------------------

const COIT = project(37.80238, -122.40583);
export const COIT_POS = COIT;
export const SUMMIT_HEIGHT = 20;

const HILLS: HillDef[] = [
  // broad hill mass: summit ~ Pioneer Park, quarried steep east face above Sansome/Levi's, long west slope to North Beach
  { id: 'telegraph-hill', center: v2(COIT.x - 9.75, COIT.z + 6.9), radiusX: 50, radiusZ: 46, height: 16.5 },
  // Pioneer Park summit knob that Coit Tower stands on (flat top r ≈ 8.3)
  { id: 'pioneer-park', center: COIT, radiusX: 15, radiusZ: 15, height: SUMMIT_HEIGHT },
];
/** Fraction of each hill's radius that is flat on top. */
export const HILL_PLATEAU: Record<string, number> = { 'telegraph-hill': 0.12, 'pioneer-park': 0.55 };

/** Analytic hill height (no ramps / decks). Smooth-max blend of the hill profiles. */
export function hillHeight(x: number, z: number, hills: HillDef[] = HILLS): number {
  let h = 0;
  for (const hill of hills) {
    const dx = (x - hill.center.x) / hill.radiusX, dz = (z - hill.center.z) / hill.radiusZ;
    const r = Math.sqrt(dx * dx + dz * dz);
    if (r >= 1) continue;
    const a = HILL_PLATEAU[hill.id] ?? 0.12;
    const t = r <= a ? 0 : (r - a) / (1 - a);
    const hh = hill.height * 0.5 * (1 + Math.cos(Math.PI * t));
    // polynomial smooth max (k = 3), faded out where either height is ~0 so flat land stays at 0
    const k = 3, g = Math.max(0, Math.min(1, 0.5 + (0.5 * (hh - h)) / k));
    h = h + (hh - h) * g + k * g * (1 - g) * Math.min(1, Math.min(h, hh) / k);
  }
  return h;
}

// ---------------------------------------------------------------------------
// 5. Street grid (north of Market: rotated "50-vara" grid; south of Market: SoMa grid)
// ---------------------------------------------------------------------------

const NS_N: Vec2 = { x: -Math.sin(35 * RAD), z: Math.cos(35 * RAD) };
const EW_N: Vec2 = { x: Math.sin(55 * RAD), z: Math.cos(55 * RAD) };
/** Offsets of real streets along their family normal (OSM centrelines, projected). */
const NS_STREETS: [string, number][] = [
  ['Drumm', -22.63], ['Davis', -7.48], ['Front', 7.03], ['Battery', 21.63], ['Sansome', 36.46], ['Montgomery', 56.91],
  ['Kearny', 76.93], ['Grant', 96.44], ['Stockton', 116.4], ['Powell', 136.92], ['Mason', 157.4], ['Taylor', 177.91],
];
const EW_STREETS: [string, number][] = [
  ['Beach', -105.71], ['North Point', -91.19], ['Bay', -76.48], ['Francisco', -61.72], ['Chestnut', -47.09], ['Lombard', -32.73],
  ['Greenwich', -17.94], ['Filbert', -3.38], ['Union', 11.22], ['Green', 25.64], ['Vallejo', 40.44], ['Broadway', 55.14],
  ['Pacific', 69.82], ['Jackson', 83.55], ['Washington', 97.23], ['Clay', 111.06], ['Sacramento', 124.97], ['California', 139.49],
];
const nsOff = (name: string) => NS_STREETS.find(s => s[0] === name)![1];
const ewOff = (name: string) => EW_STREETS.find(s => s[0] === name)![1];
/** Intersection of an NS-family line (offset a) and an EW-family line (offset b). */
function grid(a: number, b: number): Vec2 { return v2(a * NS_N.x + b * EW_N.x, a * NS_N.z + b * EW_N.z); }
const MARKET_X = 132.72;
/** SoMa streets (axis aligned in this projection). */
const SOMA_Z: [string, number][] = [['Steuart', 37.56], ['Spear', 52.51], ['Main', 67.51], ['Beale', 82.91], ['Fremont', 98.3], ['First', 113.7]];
const SOMA_X: [string, number][] = [['Market', MARKET_X], ['Mission', 160.26], ['Howard', 187.29], ['Folsom', 213.71], ['Harrison', 240.7]];

// ---------------------------------------------------------------------------
// 6. Slab (diorama extent)
// ---------------------------------------------------------------------------

const SLAB: Polygon = roundPoly([
  { x: -226, z: -104 }, { x: 224, z: -104 }, { x: 244, z: -84 }, { x: 244, z: 100 }, { x: 230, z: 114 },
  { x: -150, z: 114 }, { x: -246, z: 44 }, { x: -246, z: -84 },
]);
/** Inside the slab with at least `margin` clearance (negative margin allows that much outside). */
function inSlab(p: Vec2, margin = 0) {
  const inside = inPoly(p, SLAB);
  return margin >= 0 ? inside && slabEdgeDist(p) >= margin : inside || slabEdgeDist(p) <= -margin;
}
function slabEdgeDist(p: Vec2) {
  let d = Infinity;
  for (let i = 0, j = SLAB.length - 1; i < SLAB.length; j = i++) d = Math.min(d, segDist(p, SLAB[j], SLAB[i]));
  return d;
}

// ---------------------------------------------------------------------------
// 7. Piers
// ---------------------------------------------------------------------------

interface PierFrame { o: Vec2; u: Vec2; v: Vec2; st: number; lean: number; baseD: number }
/** Local pier frame: u = outward axis (lean° toward increasing station), v = across (toward increasing station). */
function pierFrame(st: number, leanDeg: number, baseD: number = SECTION.seawall): PierFrame {
  const f = frameAt(st), a = leanDeg * RAD;
  const u = { x: f.nx * Math.cos(a) + f.tx * Math.sin(a), z: f.nz * Math.cos(a) + f.tz * Math.sin(a) };
  const v = { x: f.tx * Math.cos(a) - f.nx * Math.sin(a), z: f.tz * Math.cos(a) - f.nz * Math.sin(a) };
  return { o: at(st, baseD), u, v, st, lean: leanDeg, baseD };
}
function loc(fr: PierFrame, u: number, v: number): Vec2 {
  return { x: fr.o.x + fr.u.x * u + fr.v.x * v, z: fr.o.z + fr.u.z * u + fr.v.z * v };
}
/** Move a local point along u so that it sits exactly at offset `d` from the promenade (snaps pier bases to the seawall). */
function snapToD(fr: PierFrame, p: Vec2, d: number): Vec2 {
  const s = stationOf(p);
  const f = frameAt(s.st);
  const cosA = fr.u.x * f.nx + fr.u.z * f.nz || 1;
  const k = (d - s.d) / cosA;
  return { x: p.x + fr.u.x * k, z: p.z + fr.u.z * k };
}
/** Local rectangle with its base edge snapped to the seawall. */
function pierRect(fr: PierFrame, u0: number, u1: number, v0: number, v1: number, snapBase: number | null): Polygon {
  let a = loc(fr, u0, v0), b = loc(fr, u0, v1);
  if (snapBase !== null) { a = snapToD(fr, a, snapBase); b = snapToD(fr, b, snapBase); }
  return roundPoly([a, b, loc(fr, u1, v1), loc(fr, u1, v0)]);
}
function localPoly(fr: PierFrame, pts: [number, number][]): Polygon {
  return roundPoly(pts.map(([u, v]) => loc(fr, u, v)));
}

interface PierSpec { id: string; label: string; st: number; lean: number; len: number; w: number; shedH?: number; baseD?: number; walkable?: boolean; shedInset?: number }
const PIER_SPECS: PierSpec[] = [
  { id: 'pier1', label: 'PIER 1', st: ST.pier1, lean: 0, len: 32, w: 8.6, shedH: 8.5 },
  { id: 'pier1-half', label: 'PIER 1½', st: ST.pier1half, lean: 0, len: 24, w: 4.2, shedH: 6.5 },
  { id: 'pier3', label: 'PIER 3', st: ST.pier3, lean: 0, len: 30, w: 7.4, shedH: 8 },
  { id: 'pier5', label: 'PIER 5', st: ST.pier5, lean: 0, len: 15, w: 6, shedH: 6.5 },
  { id: 'pier9', label: 'PIER 9', st: ST.pier9, lean: 0, len: 34, w: 7.6, shedH: 8.5 },
  { id: 'pier15', label: 'PIER 15', st: ST.pier15, lean: 0, len: 35, w: 9, shedH: 9.5, baseD: 9.6 },
  { id: 'pier17', label: 'PIER 17', st: ST.pier17, lean: 0, len: 33, w: 7, shedH: 9, baseD: 9.6 },
  { id: 'pier19', label: 'PIER 19', st: ST.pier19, lean: -6, len: 34, w: 7.6, shedH: 9 },
  { id: 'pier23', label: 'PIER 23', st: ST.pier23, lean: -6, len: 30, w: 6.6, shedH: 7.5 },
  { id: 'pier29', label: 'PIER 29', st: ST.pier29, lean: 0, len: 34, w: 9, shedH: 9 },
  { id: 'pier31', label: 'PIER 31', st: ST.pier31, lean: 0, len: 34, w: 8.4, shedH: 8.5 },
  { id: 'pier33', label: 'PIER 33', st: ST.pier33, lean: 18, len: 36, w: 9, shedH: 8.5, baseD: 9.2 },
  { id: 'pier35', label: 'PIER 35', st: ST.pier35, lean: 40, len: 40, w: 9, shedH: 8.5 },
];

const piers: PierDef[] = [];
const pierFrames: Record<string, PierFrame> = {};
for (const p of PIER_SPECS) {
  const baseD = p.baseD ?? SECTION.seawall;
  const fr = pierFrame(p.st, p.lean, baseD);
  pierFrames[p.id] = fr;
  const hw = p.w / 2;
  const deck = pierRect(fr, 0, p.len, -hw, hw, baseD - 0.3);
  const inset = p.shedInset ?? 0.7;
  const shedFoot = pierRect(fr, 0, p.len - 1.6, -hw + inset, hw - inset, baseD + 0.25);
  const facadeAt = loc(fr, 0.4, 0);
  piers.push({
    id: p.id, label: p.label, deck, deckHeight: 0, walkable: false,
    shed: p.shedH ? { footprint: shedFoot, height: p.shedH, facade: { x: r2(facadeAt.x), z: r2(facadeAt.z), rotationY: faceDir(-fr.u.x, -fr.u.z), width: r2(p.w - 2 * inset) } } : undefined,
  });
}

// Walkable piers ---------------------------------------------------------------
const P14 = pierFrame(ST.pier14, -10);
const P7 = pierFrame(ST.pier7, 0);
const P39 = pierFrame(ST.pier39, 2);
const P27 = pierFrame(ST.pier27, 36);
const PFOG = pierFrame(ST.fogBridge, 0, 9.6);

piers.push({
  id: 'pier14', label: 'PIER 14', deckHeight: 0, walkable: true,
  deck: (() => {
    const a = snapToD(P14, loc(P14, 0, -2), 4.6), b = snapToD(P14, loc(P14, 0, 2), 4.6);
    return roundPoly([a, b, loc(P14, 26, 2), loc(P14, 26, 3.6), loc(P14, 31.5, 3.6), loc(P14, 31.5, -3.6), loc(P14, 26, -3.6), loc(P14, 26, -2)]);
  })(),
});
piers.push({
  id: 'pier7', label: 'PIER 7', deckHeight: 0, walkable: true,
  deck: (() => {
    const a = snapToD(P7, loc(P7, 0, -2.1), 4.6), b = snapToD(P7, loc(P7, 0, 2.1), 4.6);
    return roundPoly([a, b, loc(P7, 32, 2.1), loc(P7, 32, 6.6), loc(P7, 36.5, 6.6), loc(P7, 36.5, -6.6), loc(P7, 32, -6.6), loc(P7, 32, -2.1)]);
  })(),
});
piers.push({
  id: 'fog-bridge', label: 'FOG BRIDGE', deckHeight: 0, walkable: true,
  deck: pierRect(PFOG, 0, 22, -1.5, 1.5, 9.2),
});
// Pier 27: James R. Herman Cruise Terminal (diagonal pier, deck not walkable)
piers.push({ id: 'pier27', label: 'PIER 27', deckHeight: 0, walkable: false, deck: pierRect(P27, 0, 33, -6.5, 6.5, 4.7) });

// Pier 39 (local frame: u out along the pier, +v = west side facing the sea-lion K-Dock & Pier 41)
const PIER39_DECK: [number, number][] = [[-0.5, -9.5], [34, -9.5], [34, -12], [48, -12], [48, 13.2], [23, 13.2], [23, 9.5], [-0.5, 9.5]];
piers.push({
  id: 'pier39', label: 'PIER 39', deckHeight: 0, walkable: true,
  deck: (() => {
    const pts = PIER39_DECK.map(([u, v]) => loc(P39, u, v));
    pts[0] = snapToD(P39, pts[0], 4.4);
    pts[pts.length - 1] = snapToD(P39, pts[pts.length - 1], 4.4);
    return roundPoly(pts);
  })(),
});
// Pier 39 marina docks (visual) hanging off Pier 39's east side toward Pier 35
const MARINA_U = [7, 13, 19, 25, 31];
MARINA_U.forEach((u, i) => {
  const len = 13 - i * 0.8;
  piers.push({ id: `pier39-dock-${'ABCDE'[i]}`, label: `${'ABCDE'[i]} DOCK`, deckHeight: -0.35, walkable: false, deck: localPoly(P39, [[u - 0.6, -9.3], [u + 0.6, -9.3], [u + 0.6, -9.5 - len], [u - 0.6, -9.5 - len]]) });
});
// Ferry gates (floating gangway where the arriving ferry ties up)
piers.push({ id: 'ferry-gates', label: 'GATE E', deckHeight: 0, walkable: true, deck: strip(38.5, 46.5, 30.6, 34.6, 2) });

// ---------------------------------------------------------------------------
// 8. Walkable areas (ground level)
// ---------------------------------------------------------------------------

const walk: WalkArea[] = [];
const addWalk = (id: string, polygon: Polygon, surface: SurfaceKind, height?: number) => {
  walk.push(height === undefined ? { id, polygon, surface } : { id, polygon, surface, height });
};

addWalk('promenade', strip(ST.east, 342, -5, 5, 2), 'pavement');
// Rincon Park: the lawn south of Pier 14 looking at the Bay Bridge (east end of the walkable waterfront)
addWalk('rincon-park', strip(-6, ST.east + 0.5, -5, 4.6, 2), 'grass');
addWalk('ferry-front-plaza', strip(46, 86, 4.6, 13.3, 2), 'plaza');
addWalk('ferry-south-plaza', strip(ST.ferrySouth, 50.3, 4.6, 31, 2), 'plaza');
addWalk('ferry-north-walk', strip(81.7, ST.ferryNorth, 4.6, 31, 2), 'plaza');
addWalk('ferry-back-plaza', strip(49.7, 82.3, 21.7, 31, 2), 'plaza');
addWalk('exploratorium-front', strip(161, 189.5, 4.6, 9.8, 2), 'plaza');
addWalk('pier33-front', strip(282.5, 299.5, 4.6, 9.4, 2), 'plaza');
addWalk('pier39-plaza', strip(338, 362, -5, 4.8, 2), 'plaza');

// Streetcar platforms (median islands) + crosswalks from the promenade
const STOPS = [
  { id: 'ferry', st: ST.stopFerry, name: { zh: '渡轮大厦站', en: 'Ferry Building' } },
  { id: 'green', st: ST.stopGreen, name: { zh: '格林街站 · 探索馆', en: 'Green St · Exploratorium' } },
  { id: 'bay', st: ST.stopBay, name: { zh: '湾街站 · 33 号码头', en: 'Bay St · Pier 33' } },
  { id: 'pier39', st: ST.stopPier39, name: { zh: 'PIER 39 站', en: 'Pier 39' } },
];
for (const s of STOPS) {
  addWalk(`platform-${s.id}`, strip(s.st - 5.5, s.st + 5.5, SECTION.platform[0] + 0.1, SECTION.platform[1], 2), 'pavement');
  addWalk(`crosswalk-${s.id}`, strip(s.st - 1.6, s.st + 1.6, -4.4, SECTION.platform[0] - 0.2, 1), 'pavement');
}

// Levi's Plaza: between the Embarcadero building line and Sansome St, Union St → Greenwich St
function stationOnStreetLine(ewOffset: number, d: number, lo = 150, hi = 300) {
  const f = (s: number) => { const p = at(s, d); return p.x * EW_N.x + p.z * EW_N.z - ewOffset; };
  let a = lo, b = hi, fa = f(a);
  for (let i = 0; i < 50; i++) { const m = (a + b) / 2, fm = f(m); if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m; }
  return (a + b) / 2;
}
const LEVIS_BACK = nsOff('Sansome') + 0.8;
const LEVIS_SOUTH = ewOff('Union') - 1.6;
const LEVIS_NORTH = ewOff('Greenwich') + 1.6;
const ST_LEVIS_A = stationOnStreetLine(LEVIS_SOUTH, -23.9);
const ST_LEVIS_B = stationOnStreetLine(LEVIS_NORTH, -23.9);
const LEVIS: Polygon = (() => {
  const front: Vec2[] = [];
  for (let i = 0; i <= 8; i++) front.push(at(ST_LEVIS_A + ((ST_LEVIS_B - ST_LEVIS_A) * i) / 8, -21.9));
  return roundPoly([...front, grid(LEVIS_BACK, LEVIS_NORTH), grid(LEVIS_BACK, LEVIS_SOUTH)]);
})();
addWalk('levis-plaza', LEVIS, 'plaza', 0);
const LEVIS_C = centroid(LEVIS);
addWalk('levis-lawn', roundPoly([
  at(ST_LEVIS_A + 3, -24.6), at(ST_LEVIS_B - 3, -24.6), grid(nsOff('Battery') - 1, LEVIS_NORTH + 1.5), grid(nsOff('Battery') - 1, LEVIS_SOUTH - 1.5),
]), 'grass', 0);
const ST_CROSS_A = ST_LEVIS_A + 4.5, ST_CROSS_B = ST_LEVIS_B - 4.5;
addWalk('crosswalk-levis-south', strip(ST_CROSS_A - 1.6, ST_CROSS_A + 1.6, -4.4, -22.3, 1), 'pavement');
addWalk('crosswalk-levis-north', strip(ST_CROSS_B - 1.6, ST_CROSS_B + 1.6, -4.4, -22.3, 1), 'pavement');

// Coit Tower summit (Pioneer Park) — flat at SUMMIT_HEIGHT
const SUMMIT_R = 8.6;
addWalk('coit-summit', circle(COIT, SUMMIT_R, 28), 'plaza', SUMMIT_HEIGHT);

// ---------------------------------------------------------------------------
// 9. Ramps: Filbert Steps → Pioneer Park path → Coit stairs
// ---------------------------------------------------------------------------

const FILBERT = ewOff('Filbert');
const RING_R = 12.5;
function ringPoint(deg: number): Vec2 { return v2(COIT.x + Math.cos(deg * RAD) * RING_R, COIT.z + Math.sin(deg * RAD) * RING_R); }
// where the Filbert line meets the ring around the summit
const RING_NS = (() => {
  const c = { a: COIT.x * NS_N.x + COIT.z * NS_N.z, b: COIT.x * EW_N.x + COIT.z * EW_N.z };
  return c.a - Math.sqrt(RING_R * RING_R - (FILBERT - c.b) ** 2);
})();
const RING_START = grid(RING_NS, FILBERT);
const RING_A0 = Math.atan2(RING_START.z - COIT.z, RING_START.x - COIT.x) / RAD;
const RING_A1 = 112;
/** angle where the Coit stairs reach the summit plaza (they climb diagonally from the ring) */
const STAIRS_A = 146;
const polar = (deg: number, r: number) => v2(COIT.x + Math.cos(deg * RAD) * r, COIT.z + Math.sin(deg * RAD) * r);

/** Monotone heights that follow the hill surface, pinned at both ends. */
function followHeights(pts: Vec2[], h0: number, h1: number, minStep = 0.05): number[] {
  const raw = pts.map((p, i) => (i === 0 ? h0 : i === pts.length - 1 ? h1 : Math.max(h0, Math.min(h1, hillHeight(p.x, p.z)))));
  const out = raw.slice();
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + minStep);
  for (let i = out.length - 2; i >= 0; i--) out[i] = Math.min(out[i], out[i + 1] - minStep);
  out[0] = h0; out[out.length - 1] = h1;
  return out.map(r2);
}

const stepsPts: Vec2[] = [grid(LEVIS_BACK - 1.6, FILBERT)];
for (const a of [nsOff('Sansome') + 1.2, 42, 47, 52, nsOff('Montgomery'), RING_NS]) stepsPts.push(grid(a, FILBERT));
const stepsTop = hillHeight(RING_START.x, RING_START.z);
const filbertSteps: Ramp = { id: 'filbert-steps', points: stepsPts, width: 3.2, surface: 'stairs', heights: followHeights(stepsPts, 0, r2(stepsTop)) };

const pathPts: Vec2[] = [];
for (let i = 0; i <= 10; i++) pathPts.push(ringPoint(RING_A0 + ((RING_A1 - RING_A0) * i) / 10));
const pathTop = r2(hillHeight(pathPts[pathPts.length - 1].x, pathPts[pathPts.length - 1].z));
const pioneerPath: Ramp = { id: 'pioneer-park-path', points: pathPts, width: 3.4, surface: 'pavement', heights: followHeights(pathPts, r2(stepsTop), pathTop) };

const coitStairsPts: Vec2[] = [ringPoint(RING_A1), polar((RING_A1 + STAIRS_A) / 2 - 2, 10.2), polar(STAIRS_A, SUMMIT_R - 0.9)];
const coitStairs: Ramp = { id: 'coit-stairs', points: coitStairsPts, width: 3, surface: 'stairs', heights: [pathTop, r2(pathTop + (SUMMIT_HEIGHT - pathTop) * 0.5), SUMMIT_HEIGHT] };

const ramps: Ramp[] = [filbertSteps, pioneerPath, coitStairs];

// ---------------------------------------------------------------------------
// 10. Roads (visual; only crosswalks are walkable, via walk areas)
// ---------------------------------------------------------------------------

function spineLine(st0: number, st1: number, d: number, step = 4, clip = false): Vec2[] {
  const n = Math.max(1, Math.ceil(Math.abs(st1 - st0) / step)), out: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const p = at(st0 + ((st1 - st0) * i) / n, d);
    if (!clip || inSlab(p, 0.5)) out.push(p);
  }
  return out;
}
const ROAD_ST0 = -40, ROAD_ST1 = 420;
const roads: RoadDef[] = [
  { id: 'embarcadero-north-lanes', kind: 'roadway', points: spineLine(ROAD_ST0, ROAD_ST1, -7.2, 3, true), width: 4.4 },
  { id: 'embarcadero-median', kind: 'roadway', points: spineLine(ROAD_ST0, ROAD_ST1, -14.3, 3, true), width: 5.6 },
  { id: 'embarcadero-south-lanes', kind: 'roadway', points: spineLine(ROAD_ST0, ROAD_ST1, -19.35, 3, true), width: 4.5 },
  { id: 'f-line-inbound', kind: 'track', points: spineLine(ROAD_ST0, ROAD_ST1, SECTION.trackA, 3, true), width: 1.6 },
  { id: 'f-line-outbound', kind: 'track', points: spineLine(ROAD_ST0, ROAD_ST1, SECTION.trackB, 3, true), width: 1.6 },
];
for (const s of STOPS) roads.push({ id: `crosswalk-${s.id}`, kind: 'crosswalk', points: [at(s.st, -5), at(s.st, SECTION.platform[0])], width: 3 });
roads.push({ id: 'crosswalk-levis-south', kind: 'crosswalk', points: [at(ST_CROSS_A, -5), at(ST_CROSS_A, SECTION.sidewalk[0])], width: 3.2 });
roads.push({ id: 'crosswalk-levis-north', kind: 'crosswalk', points: [at(ST_CROSS_B, -5), at(ST_CROSS_B, SECTION.sidewalk[0])], width: 3.2 });

/** Is p landward of the Embarcadero building line (i.e. city land)? */
function behindBuildingLine(p: Vec2, extra = 0) {
  const s = stationOf(p);
  return s.d < SECTION.buildingLine - extra;
}
// City streets: clipped to land behind the building line, inside the slab, away from the summit park.
function streetRuns(a: Vec2, dir: Vec2, name: string, width: number, t0: number, t1: number, region: (p: Vec2) => boolean) {
  let run: Vec2[] = [];
  let idx = 0;
  const flush = () => { if (run.length >= 2) roads.push({ id: `street-${name.toLowerCase().replace(/\s+/g, '-')}-${idx++}`, kind: 'roadway', points: run, width }); run = []; };
  for (let t = t0; t <= t1; t += 3) {
    const p = v2(a.x + dir.x * t, a.z + dir.z * t);
    const ok = region(p) && Math.hypot(p.x - COIT.x, p.z - COIT.z) > 15 && inSlab(p, 1.5) && polyDist(p, LEVIS) > 0.5
      && behindBuildingLine(p, 0.5);
    if (ok) run.push(p); else flush();
  }
  flush();
}
const NS_DIR: Vec2 = { x: Math.cos(35 * RAD), z: Math.sin(35 * RAD) };
const EW_DIR: Vec2 = { x: Math.cos(-55 * RAD), z: Math.sin(-55 * RAD) };
for (const [name, off] of NS_STREETS) {
  const base = { x: NS_N.x * off, z: NS_N.z * off };
  streetRuns(base, NS_DIR, name, 3.2, -260, 260, p => p.x < MARKET_X - 2.5);
}
for (const [name, off] of EW_STREETS) {
  const base = { x: EW_N.x * off, z: EW_N.z * off };
  streetRuns(base, EW_DIR, name, 3.2, -260, 260, p => p.x < MARKET_X - 2.5);
}
for (const [name, z] of SOMA_Z) streetRuns({ x: MARKET_X, z }, { x: 1, z: 0 }, name, 3.2, 0, 120, p => p.x > MARKET_X + 2.5);
for (const [name, x] of SOMA_X) streetRuns({ x, z: 0 }, { x: 0, z: 1 }, name, name === 'Market' ? 5 : 3.2, 0, 120, () => true);
// Telegraph Hill Blvd (visual road winding up from Lombard & Kearny to the Coit parking circle)
const BLVD: Vec2[] = [grid(nsOff('Kearny') + 2, ewOff('Lombard')), grid(nsOff('Kearny') - 3, ewOff('Greenwich') + 2), ringPoint(200), ringPoint(240), ringPoint(270), v2(COIT.x + 2, COIT.z - SUMMIT_R + 0.5)];
roads.push({ id: 'telegraph-hill-blvd', kind: 'path', points: BLVD, width: 2.6 });

// ---------------------------------------------------------------------------
// 11. Landmarks
// ---------------------------------------------------------------------------

const landward = (st: number) => { const f = frameAt(st); return faceDir(-f.nx, -f.nz); };
const seaward = (st: number) => { const f = frameAt(st); return faceDir(f.nx, f.nz); };

/** Ferry Building footprint + the clock tower, whose shaft (pilasters included) stands ~0.8u proud of the body
 *  on the promenade side (world/landmarks.ts: tower at local z 2.9, half-width 2.06) — so nothing walks into its face. */
const FERRY_FOOT = (() => {
  const d0 = 13.3, d1 = 21.7, towerFront = 12.5, towerHalf = 2.1;
  const n = Math.ceil((ST.ferryB - ST.ferryA) / 2);
  const front: Vec2[] = [], back: Vec2[] = [];
  let bumped = false;
  for (let i = 0; i <= n; i++) {
    const st = ST.ferryA + ((ST.ferryB - ST.ferryA) * i) / n;
    back.push(at(st, d1));
    if (Math.abs(st - ST.ferryClock) <= towerHalf) continue;
    if (!bumped && st > ST.ferryClock) {
      bumped = true;
      const s0 = ST.ferryClock - towerHalf, s1 = ST.ferryClock + towerHalf;
      front.push(at(s0, d0), at(s0, towerFront), at(s1, towerFront), at(s1, d0));
    }
    front.push(at(st, d0));
  }
  return roundPoly([...front, ...back.reverse()]);
})();
const TRANSAMERICA = project(37.79517, -122.40279);
const SALESFORCE = project(37.78978, -122.39691);
const CRUISE_TERMINAL = localPoly(P27, [[3, -5.2], [21, -5.2], [21, 5.2], [3, 5.2]]);
const P39_CAROUSEL = loc(P39, 39, 3.5);
const P39_KDOCK = loc(P39, 34, 19.5);
const P7_SCOPE = loc(P7, 36, -4.2);
const P39_SCOPE = loc(P39, 31, 12.6);
const COIT_SCOPE = v2(COIT.x + 1.6, COIT.z - SUMMIT_R + 1.1);
const BOARD = at(58.5, 11.2);
/** The weekly board turns ~20° toward the ferry gate, so visitors arriving along the promenade see its face. */
const BOARD_FACE = (() => { const f = frameAt(58.5), c = Math.cos(0.35), sn = Math.sin(0.35); return v2(-f.nx * c - f.tx * sn, -f.nz * c - f.tz * sn); })();

const landmarks: LandmarkDef[] = [
  { id: 'ferry-building', kind: 'ferry-building', position: at(ST.ferryClock, 17.5), rotationY: landward(ST.ferryClock), scale: 1, collider: { polygon: FERRY_FOOT } },
  { id: 'farmers-market', kind: 'farmers-market', position: at(78, 11.6), rotationY: landward(78), scale: 1 },
  { id: 'weekly-board', kind: 'weekly-board', position: BOARD, rotationY: faceDir(BOARD_FACE.x, BOARD_FACE.z), scale: 1, collider: { polygon: orect(BOARD, -BOARD_FACE.z, BOARD_FACE.x, 1.5, 0.35) } },
  { id: 'pier14', kind: 'pier14', position: loc(P14, 28.8, 0), rotationY: faceDir(P14.u.x, P14.u.z), scale: 1 },
  { id: 'pier7', kind: 'pier7', position: loc(P7, 34.3, 0), rotationY: faceDir(P7.u.x, P7.u.z), scale: 1 },
  { id: 'exploratorium', kind: 'exploratorium', position: loc(pierFrames.pier15, 0.4, 0), rotationY: landward(ST.pier15), scale: 1, collider: { polygon: piers.find(p => p.id === 'pier15')!.shed!.footprint } },
  { id: 'levis-plaza', kind: 'levis-plaza', position: v2(LEVIS_C.x, LEVIS_C.z), rotationY: 0, scale: 1, collider: { radius: 2.2 } },
  { id: 'filbert-steps', kind: 'filbert-steps', position: stepsPts[1], rotationY: faceDir(stepsPts[2].x - stepsPts[1].x, stepsPts[2].z - stepsPts[1].z), scale: 1, baseY: filbertSteps.heights[1] },
  { id: 'coit-tower', kind: 'coit-tower', position: COIT, rotationY: 0, scale: 1, baseY: SUMMIT_HEIGHT, collider: { radius: 2.8 } },
  { id: 'cruise-terminal', kind: 'cruise-terminal', position: centroid(CRUISE_TERMINAL), rotationY: faceDir(P27.u.x, P27.u.z), scale: 1, collider: { polygon: CRUISE_TERMINAL } },
  { id: 'pier33', kind: 'pier33', position: loc(pierFrames.pier33, 0.4, 0), rotationY: landward(ST.pier33), scale: 1 },
  { id: 'pier39', kind: 'pier39', position: loc(P39, 1.2, 0), rotationY: faceDir(-P39.u.x, -P39.u.z), scale: 1 },
  { id: 'pier39-carousel', kind: 'pier39-carousel', position: P39_CAROUSEL, rotationY: 0, scale: 1, collider: { radius: 3 } },
  { id: 'sea-lion-docks', kind: 'sea-lion-docks', position: P39_KDOCK, rotationY: faceDir(P39.u.x, P39.u.z), scale: 1 },
  { id: 'transamerica', kind: 'transamerica', position: TRANSAMERICA, rotationY: faceDir(NS_DIR.x, NS_DIR.z), scale: 1, collider: { polygon: orect(TRANSAMERICA, NS_DIR.x, NS_DIR.z, 4.6, 4.6) } },
  { id: 'salesforce-tower', kind: 'salesforce-tower', position: SALESFORCE, rotationY: 0, scale: 1, collider: { polygon: orect(SALESFORCE, 1, 0, 4.2, 4.2) } },
  { id: 'telescope-pier7', kind: 'telescope', position: P7_SCOPE, rotationY: faceDir(P7.u.x, P7.u.z), scale: 1, collider: { radius: 0.35 } },
  { id: 'telescope-pier39', kind: 'telescope', position: P39_SCOPE, rotationY: faceDir(P39.v.x, P39.v.z), scale: 1, collider: { radius: 0.35 } },
  { id: 'telescope-coit', kind: 'telescope', position: COIT_SCOPE, rotationY: Math.PI, scale: 1, baseY: SUMMIT_HEIGHT, collider: { radius: 0.35 } },
];
for (const s of STOPS) {
  const f = frameAt(s.st + 4.2);
  const c = at(s.st + 4.2, (SECTION.platform[0] + SECTION.platform[1]) / 2);
  landmarks.push({ id: `streetcar-stop-${s.id}`, kind: 'streetcar-stop', position: c, rotationY: seaward(s.st), scale: 1, collider: { polygon: orect(c, f.tx, f.tz, 1.2, 0.55) } });
}

// ---------------------------------------------------------------------------
// 12. Buildings (lots)
// ---------------------------------------------------------------------------

const blocks: BuildingLot[] = [];
const VICTORIAN = ['#f2c9b1', '#cfe0d0', '#f4e2a8', '#c9d6e8', '#e8c6cf'];
const rand = rng(20260925);

// Exclusion shapes for generated lots (open spaces, walk areas, landmarks, corridors).
const EXCLUDE_POLYS: Polygon[] = [LEVIS, FERRY_FOOT];
const EXCLUDE_CIRCLES: { c: Vec2; r: number }[] = [
  { c: COIT, r: 15.5 },
  { c: TRANSAMERICA, r: 8.5 },
  { c: SALESFORCE, r: 7.5 },
  { c: project(37.7949, -122.39465), r: 11 }, // Embarcadero Plaza (open space across from the Ferry Building)
  { c: project(37.79524, -122.40224), r: 4 }, // Transamerica Redwood Park
];
const EXCLUDE_LINES: { pts: Vec2[]; r: number }[] = [...ramps.map(r => ({ pts: r.points, r: r.width / 2 + 3.2 })), { pts: BLVD, r: 2.4 }];

function lotBlocked(poly: Polygon) {
  const c = centroid(poly);
  const probes = [c, ...poly];
  for (const e of EXCLUDE_POLYS) for (const p of probes) if (polyDist(p, e) < 0.8) return true;
  for (const e of EXCLUDE_CIRCLES) for (const p of probes) if (Math.hypot(p.x - e.c.x, p.z - e.c.z) < e.r) return true;
  for (const e of EXCLUDE_LINES) for (const p of probes) if (polylineDist(p, e.pts) < e.r) return true;
  for (const p of poly) if (!inSlab(p, 1.2)) return true;
  return false;
}
/** Clip a lot to the land behind the Embarcadero building line (local tangent at its centroid). */
function clipToCity(poly: Polygon): Polygon | null {
  const c = centroid(poly);
  const s = stationOf(c);
  if (s.d > 6) return null;
  const f = frameAt(s.st);
  const o = { x: f.x + f.nx * SECTION.buildingLine, z: f.z + f.nz * SECTION.buildingLine };
  const clipped = clipHalf(poly, o, { x: f.nx, z: f.nz });
  if (clipped.length < 3 || polygonArea(clipped) < polygonArea(poly) * 0.35) return null;
  // second pass with the frame of the clipped centroid (curvature)
  const c2 = centroid(clipped), s2 = stationOf(c2), f2 = frameAt(s2.st);
  const o2 = { x: f2.x + f2.nx * SECTION.buildingLine, z: f2.z + f2.nz * SECTION.buildingLine };
  const again = clipHalf(clipped, o2, { x: f2.nx, z: f2.nz });
  if (again.length < 3 || polygonArea(again) < polygonArea(poly) * 0.3) return null;
  return again;
}

function terrainMinMax(poly: Polygon) {
  let lo = Infinity, hi = -Infinity;
  for (const p of [...poly, centroid(poly)]) { const h = hillHeight(p.x, p.z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  return { lo, hi };
}

let lotId = 0;
/** Max terrain drop across a footprint: steeper lots stay hillside garden instead of becoming towers. */
const MAX_DROP = 3.2;
/** Hillside spots left as gardens (get a tree in the props pass). */
const GARDENS: Vec2[] = [];
function addLot(poly: Polygon, style: BuildingStyle, height: number, roof: BuildingLot['roof'], color?: string): boolean {
  const { lo, hi } = terrainMinMax(poly);
  const drop = hi - lo;
  if (drop > MAX_DROP) return false;
  // on steep ground keep the uphill facade low so the downhill side does not become a tower
  const h = drop > 1.6 ? Math.min(height, 4.2) : height;
  const lot: BuildingLot = { id: `lot-${++lotId}`, footprint: roundPoly(poly), height: r2(h + drop), style, roof };
  if (color) lot.color = color;
  if (hi > 0.05) lot.baseY = r2(lo);
  blocks.push(lot);
  return true;
}

// Named towers near the Ferry Building (Embarcadero Center 1–4, One Market) — real positions, toy heights.
const TOWERS: { name: string; lat: number; lng: number; hx: number; hz: number; h: number; dir: Vec2 }[] = [
  { name: 'ec4', lat: 37.79473, lng: -122.39653, hx: 5.5, hz: 3.4, h: 22, dir: EW_DIR },
  { name: 'ec3', lat: 37.79497, lng: -122.39765, hx: 5.5, hz: 3.4, h: 18, dir: EW_DIR },
  { name: 'ec2', lat: 37.79494, lng: -122.39882, hx: 5.5, hz: 3.4, h: 18, dir: EW_DIR },
  { name: 'ec1', lat: 37.79475, lng: -122.39985, hx: 5.5, hz: 3.4, h: 22, dir: EW_DIR },
  { name: 'one-market', lat: 37.79382, lng: -122.39467, hx: 4, hz: 4, h: 15, dir: { x: 1, z: 0 } },
];
for (const t of TOWERS) {
  const c = project(t.lat, t.lng);
  const poly = clipToCity(orect(c, t.dir.x, t.dir.z, t.hx, t.hz));
  if (poly) { addLot(poly, 'office', t.h, 'flat', '#d9d4c7'); EXCLUDE_CIRCLES.push({ c, r: Math.max(t.hx, t.hz) + 2 }); }
}

// Pier 39 shops (two-storey weathered-wood buildings) on the deck
const P39_SHOPS: [number, number, number, number][] = [
  [3, 9, 3.8, 8.8], [10, 15.5, 3.8, 8.8], [16.5, 21.5, 3.8, 8.8],
  [3, 8.5, -8.8, -3.8], [9.5, 15, -8.8, -3.8], [16, 21.5, -8.8, -3.8], [22.5, 28, -8.8, -3.8], [29, 33, -8.8, -3.8],
  [37, 42, -11.2, -6.4], [43, 47, -11.2, -3.6], [43.5, 47.2, 2.5, 8.5],
];
for (const [u0, u1, v0, v1] of P39_SHOPS) {
  const poly = localPoly(P39, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  addLot(poly, 'shop', 4.2 + rand() * 1.4, 'gable', rand() < 0.5 ? '#b98a5a' : '#a9794d');
}

// Grid blocks north of Market St
function hillFactor(p: Vec2) { return hillHeight(p.x, p.z); }
function blockStyle(c: Vec2): { style: BuildingStyle; h: () => number; roof: BuildingLot['roof']; color?: () => string; small: boolean } {
  const hh = hillFactor(c);
  if (hh > 1.2) {
    return rand() < 0.16
      ? { style: 'deco', h: () => 5.5 + rand() * 2, roof: 'flat', small: true, color: () => (rand() < 0.5 ? '#efe6d6' : '#e6dccb') }
      : { style: 'victorian', h: () => 4.2 + rand() * 2.2, roof: 'gable', small: true, color: () => VICTORIAN[Math.floor(rand() * VICTORIAN.length)] };
  }
  const nsO = c.x * NS_N.x + c.z * NS_N.z, ewO = c.x * EW_N.x + c.z * EW_N.z;
  if (ewO > 45 || c.x > 60) return { style: 'office', h: () => 10 + rand() * 12, roof: 'flat', small: false };
  // Northeast Waterfront historic district: brick warehouses between the Embarcadero and the hill
  if (nsO < 62 && ewO > -84 && ewO < 45) return { style: 'warehouse', h: () => 5.5 + rand() * 3, roof: 'flat', small: false, color: () => (rand() < 0.5 ? '#b56e55' : '#a8644c') };
  if (ewO < -60) return { style: 'residential', h: () => 5 + rand() * 3, roof: 'flat', small: false };
  return rand() < 0.22
    ? { style: 'victorian', h: () => 4.5 + rand() * 2, roof: 'gable', small: true, color: () => VICTORIAN[Math.floor(rand() * VICTORIAN.length)] }
    : { style: 'residential', h: () => 5 + rand() * 3.5, roof: rand() < 0.5 ? 'flat' : 'hip', small: false };
}

const HALF_STREET = 1.8;
const nsSorted = NS_STREETS.map(s => s[1]).sort((a, b) => a - b);
const ewSorted = EW_STREETS.map(s => s[1]).sort((a, b) => a - b);
for (let i = 0; i < nsSorted.length - 1; i++) {
  for (let j = 0; j < ewSorted.length - 1; j++) {
    const a0 = nsSorted[i] + HALF_STREET, a1 = nsSorted[i + 1] - HALF_STREET;
    const b0 = ewSorted[j] + HALF_STREET, b1 = ewSorted[j + 1] - HALF_STREET;
    const c = grid((a0 + a1) / 2, (b0 + b1) / 2);
    if (!inSlab(c, -12)) continue;
    const st = blockStyle(c);
    const la = a1 - a0, lb = b1 - b0;
    const far = c.z > 80; // behind the hill / deep downtown: fewer, bigger volumes
    const na = st.small ? Math.max(2, Math.round(la / (far ? 6 : 4.6))) : Math.max(1, Math.round(la / (far ? 16 : 9.5)));
    const onHill = hillFactor(c) > 1.2;
    const nb = st.small ? (onHill ? 3 : 2) : Math.max(1, Math.round(lb / (far ? 14 : 8)));
    for (let ia = 0; ia < na; ia++) {
      for (let ib = 0; ib < nb; ib++) {
        const garden = st.small && rand() < 0.12; // gardens between houses
        const gap = st.small ? 0.35 : 0.5;
        const pa0 = a0 + (la * ia) / na + gap, pa1 = a0 + (la * (ia + 1)) / na - gap;
        const pb0 = b0 + (lb * ib) / nb + gap, pb1 = b0 + (lb * (ib + 1)) / nb - gap;
        let poly: Polygon | null = [grid(pa0, pb0), grid(pa1, pb0), grid(pa1, pb1), grid(pa0, pb1)];
        // Market St cuts the grid diagonally
        poly = clipHalf(poly, { x: MARKET_X - 2.8, z: 0 }, { x: 1, z: 0 });
        if (poly.length < 3 || polygonArea(poly) < 6) continue;
        poly = clipToCity(poly);
        if (!poly || polygonArea(poly) < 6 || lotBlocked(poly)) continue;
        if (garden || !addLot(poly, st.style, st.h(), st.roof, st.color?.())) { if (onHill) GARDENS.push(centroid(poly)); }
      }
    }
  }
}

// SoMa blocks south-east of Market St (Rincon Hill), leaving the Bay Bridge approach open
const BRIDGE_X = 226;
for (let i = 0; i < SOMA_X.length - 1; i++) {
  for (let j = 0; j < SOMA_Z.length - 1; j++) {
    const x0 = SOMA_X[i][1] + HALF_STREET, x1 = SOMA_X[i + 1][1] - HALF_STREET;
    const z0 = SOMA_Z[j][1] + HALF_STREET, z1 = SOMA_Z[j + 1][1] - HALF_STREET;
    const nx = SOMA_Z[j][1] > 45 ? 1 : 2, nz = 1;
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const px0 = x0 + ((x1 - x0) * ix) / nx + 0.5, px1 = x0 + ((x1 - x0) * (ix + 1)) / nx - 0.5;
        const pz0 = z0 + ((z1 - z0) * iz) / nz + 0.5, pz1 = z0 + ((z1 - z0) * (iz + 1)) / nz - 0.5;
        if (px1 > BRIDGE_X - 8 && px0 < BRIDGE_X + 8) continue;
        const poly = clipToCity([{ x: px0, z: pz0 }, { x: px1, z: pz0 }, { x: px1, z: pz1 }, { x: px0, z: pz1 }]);
        if (!poly || polygonArea(poly) < 8 || lotBlocked(poly)) continue;
        addLot(poly, 'office', 9 + rand() * 13, 'flat');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 13. Props
// ---------------------------------------------------------------------------

const props: PropDef[] = [];
const prop = (kind: PropKind, p: Vec2, extra: Partial<PropDef> = {}) => { props.push({ kind, x: r2(p.x), z: r2(p.z), ...extra }); };
const BLOCKING: Partial<Record<PropKind, number>> = { palm: 0.45, lamp: 0.2, bin: 0.3, bench: 0.55, planter: 0.6, stall: 1.1, kiosk: 1, mailbox: 0.3, 'bike-rack': 0.4, flag: 0.15, bollard: 0.15, board: 0.5, telescope: 0.3, tree: 0.5, sign: 0.2, bell: 0.3, 'umbrella-table': 0.8 };
const blockProp = (kind: PropKind, p: Vec2, extra: Partial<PropDef> = {}) => prop(kind, p, { blockRadius: BLOCKING[kind], ...extra });

// keep-clear stations on the promenade (crosswalks, pier entrances, plazas)
const CLEAR: [number, number][] = [
  ...STOPS.map(s => [s.st - 2.6, s.st + 2.6] as [number, number]),
  [ST_CROSS_A - 2.6, ST_CROSS_A + 2.6], [ST_CROSS_B - 2.6, ST_CROSS_B + 2.6],
  [ST.pier14 - 4, ST.pier14 + 4], [ST.pier7 - 3.5, ST.pier7 + 3.5], [ST.pier39 - 12, ST.pier39 + 14], [ST.fogBridge - 2.5, ST.fogBridge + 2.5],
];
const clearAt = (st: number) => CLEAR.some(([a, b]) => st > a && st < b);

// Palms: landward edge of the promenade every 14 u, and a second row in the median (offset by 7)
for (let st = 18; st <= 338; st += 14) if (!clearAt(st)) blockProp('palm', at(st, -4.2), { scale: 0.95 + ((st * 7) % 5) * 0.03 });
for (let st = 25; st <= 360; st += 14) {
  if (STOPS.some(s => Math.abs(s.st - st) < 7.5) || Math.abs(st - ST_CROSS_A) < 3 || Math.abs(st - ST_CROSS_B) < 3) continue;
  prop('palm', at(st, -10.4), { scale: 1.05 });
}
// Lamps on the seaward edge every 16 u, benches (facing the Bay) between them, bins by some benches
for (let st = 16; st <= 340; st += 16) {
  if (!clearAt(st)) blockProp('lamp', at(st, 4.25));
  const sb = st + 8;
  if (sb < 340 && !clearAt(sb) && !(sb > 44 && sb < 88)) {
    blockProp('bench', at(sb, 3.6), { rotationY: seaward(sb) });
    if (Math.round(sb / 8) % 3 === 0) blockProp('bin', at(sb + 2.2, 3.9));
  }
}
// Bollards at every crosswalk mouth
for (const st of [...STOPS.map(s => s.st), ST_CROSS_A, ST_CROSS_B]) for (const o of [-2.1, 2.1]) blockProp('bollard', at(st + o, -4.6));

// Ferry Building: farmers-market stalls (front plaza, north half + south plaza), weekly board, bell, planters
for (const st of [71.5, 74.8, 78.1, 81.4]) blockProp('stall', at(st, 11.4), { rotationY: landward(st) });
for (const st of [32, 35.5, 39]) blockProp('stall', at(st, 12.2), { rotationY: faceDir(frameAt(st).tx, frameAt(st).tz) });
prop('crate', at(83.4, 11.9), { pushable: true });
prop('crate', at(83.9, 10.7), { pushable: true, rotationY: 0.4 });
prop('crate', at(70, 12), { pushable: true, rotationY: 0.2 });
prop('umbrella-table', at(29.5, 23.5), { blockRadius: 0.8 });
blockProp('bell', at(62.4, 12.2), { rotationY: landward(62.4) });
for (const st of [47.5, 84.8]) blockProp('planter', at(st, 6));
blockProp('bike-rack', at(48, 11.8), { rotationY: landward(48) });
blockProp('mailbox', at(87, 7.6));
blockProp('kiosk', at(44.5, 20.5), { rotationY: landward(44.5) });
for (const st of [55, 61, 67, 73, 79]) blockProp('bench', at(st, 30.2), { rotationY: seaward(st) });
for (const st of [52, 76]) blockProp('umbrella-table', at(st, 25.2));
blockProp('telescope', at(86, 30.3), { rotationY: seaward(86) });
blockProp('lamp', at(50, 30.3));
blockProp('lamp', at(82, 30.3));
blockProp('flag', at(28, 29.5));
blockProp('flag', at(88, 29.5));
// Pier 14: benches along the breakwater, telescope at the end
for (const u of [8, 16, 23]) blockProp('bench', loc(P14, u, 1.55), { rotationY: faceDir(P14.v.x, P14.v.z) });
blockProp('telescope', loc(P14, 31, -3.1), { rotationY: faceDir(P14.u.x, P14.u.z) });
blockProp('lamp', loc(P14, 27, -3.3));
// Pier 7: lamps along both rails, fishing rods, bench at the T
for (let u = 5; u <= 29; u += 6) { blockProp('lamp', loc(P7, u, 2)); blockProp('lamp', loc(P7, u + 3, -2)); }
for (const u of [22, 27, 31]) prop('fishing-rod', loc(P7, u, 2.05), { rotationY: faceDir(P7.v.x, P7.v.z) });
blockProp('bench', loc(P7, 33, 6), { rotationY: faceDir(P7.u.x, P7.u.z) });
// Exploratorium front + fog bridge
blockProp('sign', at(164, 8.9), { rotationY: landward(164) });
blockProp('bike-rack', at(186.5, 8.8), { rotationY: landward(186.5) });
for (const u of [5, 12, 19]) blockProp('lamp', loc(PFOG, u, 1.3));
// Levi's Plaza: trees on the lawn, benches, sign + mailbox near the steps
for (let i = 0; i < 6; i++) {
  const a = ST_LEVIS_A + 5 + i * ((ST_LEVIS_B - ST_LEVIS_A - 10) / 5);
  blockProp('tree', at(a, -27.2 - (i % 2) * 3.2));
}
blockProp('bench', v2(LEVIS_C.x + 4, LEVIS_C.z + 1), { rotationY: 0.6 });
blockProp('bench', v2(LEVIS_C.x - 4, LEVIS_C.z - 1), { rotationY: -2.5 });
blockProp('sign', grid(LEVIS_BACK - 3, FILBERT + 2.4), { rotationY: faceDir(-NS_N.x, -NS_N.z) });
blockProp('mailbox', grid(LEVIS_BACK - 3.5, LEVIS_SOUTH - 2));
// Filbert Steps gardens + Pioneer Park trees
for (let i = 1; i < stepsPts.length - 1; i++) {
  const a = stepsPts[i], b = stepsPts[i + 1];
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
  for (const side of [-1, 1]) prop('bush', v2(a.x + (-dz / L) * 2.6 * side + dx * 0.4, a.z + (dx / L) * 2.6 * side + dz * 0.4), { scale: 0.9 });
}
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * 360 + 15;
  if (a > RING_A1 - 14 && a < STAIRS_A + 14) continue;
  prop('tree', v2(COIT.x + Math.cos(a * RAD) * (i % 2 ? 10.6 : 14.8), COIT.z + Math.sin(a * RAD) * (i % 2 ? 10.6 : 14.8)), { scale: 1.1 });
}
for (let a = 0; a < 360; a += 45) if (angDiff(a, STAIRS_A) > 18) blockProp('bench', v2(COIT.x + Math.cos(a * RAD) * 7.6, COIT.z + Math.sin(a * RAD) * 7.6), { rotationY: faceDir(Math.cos(a * RAD), Math.sin(a * RAD)) });
// Telegraph Hill gardens (steep or empty lots) get trees, like the real wooded slopes
GARDENS.forEach((g, i) => { if (i % 2 === 0 || hillHeight(g.x, g.z) > 6) prop('tree', g, { scale: 0.8 + (i % 3) * 0.15 }); });
// Rincon Park trees + benches facing the Bay Bridge
for (const st of [-3, 3, 9]) blockProp('tree', at(st, -3.4));
for (const st of [0, 6]) blockProp('bench', at(st, 3.5), { rotationY: seaward(st) });
// Embarcadero Plaza trees (open space across from the Ferry Building)
{
  const c = project(37.7949, -122.39465);
  for (let i = 0; i < 7; i++) { const a = i * 0.9; prop('tree', v2(c.x + Math.cos(a) * (4 + (i % 3) * 2.5), c.z + Math.sin(a) * (4 + (i % 3) * 2.5))); }
}
// Pier 33: Alcatraz landing sign, kiosk, queue planters
blockProp('sign', at(286, 8.4), { rotationY: landward(286) });
blockProp('kiosk', at(296.5, 8), { rotationY: landward(296.5) });
for (const st of [284.5, 298]) blockProp('planter', at(st, 7.8));
// Pier 39: entrance flags, directory board, benches, cones near the entrance, telescope + benches on the sea-lion edge
for (const v of [-7, 7]) blockProp('flag', loc(P39, 1.5, v));
blockProp('board', at(356.5, 3.2), { rotationY: landward(356.5) });
blockProp('kiosk', at(341, 3.4), { rotationY: landward(341) });
for (const o of [0, 1.1, 2.2]) prop('cone', at(358.5 + o, 1.2 + (o === 1.1 ? 0.6 : 0)), { pushable: true });
prop('crate', loc(P39, 22, -3.2), { pushable: true });
blockProp('telescope', loc(P39, 40, 12.5), { rotationY: faceDir(P39.v.x, P39.v.z) });
for (const u of [26, 36, 44]) blockProp('bench', loc(P39, u, 10.4), { rotationY: faceDir(P39.v.x, P39.v.z) });
for (const u of [8, 20, 30]) blockProp('lamp', loc(P39, u, (u % 2 ? 1 : -1) * 3.1));
blockProp('umbrella-table', loc(P39, 45, -2));
blockProp('bike-rack', at(339.5, -3.6), { rotationY: seaward(339.5) });
// Buoys + small boats (water; visual)
for (const [st, d] of [[125, 40], [140, 22], [60, 44], [230, 20], [320, 20], [190, 45], [16, 40]] as [number, number][]) prop('buoy', at(st, d), { pushable: true });
MARINA_U.forEach((u, i) => {
  for (let k = 0; k < 3; k++) prop('boat-small', loc(P39, u + (k % 2 ? 1.9 : -1.9), -12 - k * 3.6), { rotationY: faceDir(-P39.v.x, -P39.v.z), scale: 0.85 + ((i + k) % 3) * 0.12 });
});
prop('boat-small', loc(P7, 20, -5), { rotationY: faceDir(P7.u.x, P7.u.z) });
prop('boat-small', loc(pierFrames.pier33, 18, -7.5), { rotationY: faceDir(pierFrames.pier33.u.x, pierFrames.pier33.u.z), scale: 1.6 });
// Streetcar platforms: sign boards + bins
for (const s of STOPS) { blockProp('sign', at(s.st - 4.6, -10.4), { rotationY: landward(s.st) }); }

// ---------------------------------------------------------------------------
// 14. Backdrop (compressed real bearings; outside the slab)
// ---------------------------------------------------------------------------

const BRIDGE_SF = v2(234, 36);
const YBI = v2(214, -236);
const backdrop: BackdropDef[] = [
  // Bay Bridge west span: SF end on the slab's east edge (Rincon Point), running to Yerba Buena Island
  { kind: 'bay-bridge', position: BRIDGE_SF, rotationY: headingTo(BRIDGE_SF, YBI), scale: 1 },
  { kind: 'yerba-buena', position: YBI, rotationY: 0, scale: 1 },
  { kind: 'alcatraz', position: v2(-292, -34), rotationY: 0.4, scale: 1 },
  { kind: 'angel-island', position: v2(-380, -250), rotationY: 0.3, scale: 1 },
  { kind: 'marin-hills', position: v2(-470, -60), rotationY: Math.PI / 2, scale: 1.4 },
  { kind: 'east-bay-hills', position: v2(90, -420), rotationY: 0, scale: 1.3 },
  { kind: 'east-bay-hills', position: v2(380, -300), rotationY: -0.8, scale: 1.2 },
  { kind: 'skyline', position: v2(110, 170), rotationY: Math.PI, scale: 1 },
];

// ---------------------------------------------------------------------------
// 15. Streetcar (F-line along the median, track A)
// ---------------------------------------------------------------------------

const CAR_ST0 = 36, CAR_ST1 = 362;
const carPath = spineLine(CAR_ST0, CAR_ST1, SECTION.trackA, 3);
const carCum: number[] = [0];
for (let i = 1; i < carPath.length; i++) carCum.push(carCum[i - 1] + Math.hypot(carPath[i].x - carPath[i - 1].x, carPath[i].z - carPath[i - 1].z));
const carLen = carCum[carCum.length - 1];
function carT(st: number) {
  const p = at(st, SECTION.trackA);
  let best = 0, bestD = Infinity;
  for (let i = 1; i < carPath.length; i++) {
    const a = carPath[i - 1], b = carPath[i], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2));
    const d = Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
    if (d < bestD) { bestD = d; best = carCum[i - 1] + t * Math.sqrt(L2); }
  }
  return Math.round((best / carLen) * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// 16. Anchors (DESIGN.md §11) — all walkable and outside colliders (tested)
// ---------------------------------------------------------------------------

const FERRY_GATE = at(42.5, 29.2);
const P14_END = loc(P14, 28.6, 0);
const anchors: Record<string, Vec2> = {
  'ferry-gate': FERRY_GATE,
  'ferry-clock': at(ST.ferryClock, 10.6),
  'weekly-board': at(58.5, 8.6),
  'farmers-market': at(76.5, 8.4),
  'ferry-back-plaza': at(70, 26.5),
  'pier14-end': P14_END,
  'pier7-end': loc(P7, 34, 0),
  'exploratorium-front': at(ST.pier15, 7.2),
  'pier33-landing': at(ST.pier33, 7.2),
  'pier39-entrance': at(ST.pier39, 1),
  'pier39-carousel': loc(P39, 39, -2.2),
  'sea-lion-viewpoint': loc(P39, 33.5, 11.6),
  'levis-plaza': v2(LEVIS_C.x - 3.5, LEVIS_C.z + 2.5),
  'filbert-steps-bottom': stepsPts[1],
  'filbert-steps-mid': stepsPts[4],
  'coit-summit': polar(STAIRS_A - 8, 5.2),
  'coit-view': v2(COIT.x, COIT.z - 5.6),
  'streetcar-ferry': at(ST.stopFerry, -10.45),
  'streetcar-green': at(ST.stopGreen, -10.45),
  'streetcar-bay': at(ST.stopBay, -10.45),
  'streetcar-pier39': at(ST.stopPier39, -10.45),
  'npc-vendor': at(75.2, 9.4),
  // on the narrow part, by the rods but short of the tour stop's camera corridor (the T-head two-shot looks back down the pier)
  'npc-fisher': loc(P7, 20.5, 1.2),
  'npc-jogger-a': at(100, -1.5),
  'npc-jogger-b': at(205, -1.5),
  'npc-family': at(352, -2.5),
  'npc-streetcar': at(ST.stopFerry - 3, -10.45),
  'postcard-ferry-building-dawn': at(53, 29.6),
  'postcard-pier7-sunset': loc(P7, 35.6, 5.6),
  'postcard-exploratorium': loc(PFOG, 19.5, 0),
  'postcard-filbert-steps': (() => { const a = stepsPts[3], b = stepsPts[4]; return v2((a.x + b.x) / 2 + NS_DIR.x * 0.55, (a.z + b.z) / 2 + NS_DIR.z * 0.55); })(),
  'postcard-coit-tower': v2(COIT.x + Math.cos(60 * RAD) * 6.2, COIT.z + Math.sin(60 * RAD) * 6.2),
  'postcard-bay-bridge-night': loc(P14, 30.8, 2.6),
  'postcard-sea-lions': loc(P39, 46.5, 11.8),
  'postcard-streetcar': at(ST.stopGreen - 2.6, -10.5),
  // extra spots for content / NPCs
  'embarcadero-mid': at(250, -1),
  'pier7-entrance': at(ST.pier7, 2),
  'levis-crosswalk': at(ST_CROSS_A, -3.8),
};

// ---------------------------------------------------------------------------
// 17. Zones (first match wins; the Embarcadero default last)
// ---------------------------------------------------------------------------

const zones: District['zones'] = [
  { id: 'coit', name: { zh: 'Coit Tower · 电报山', en: 'Coit Tower · Telegraph Hill' }, polygon: circle(COIT, 18.5, 24) },
  { id: 'filbert', name: { zh: 'Filbert Steps 台阶', en: 'Filbert Steps' }, polygon: roundPoly([grid(LEVIS_BACK - 2.5, FILBERT - 5), grid(RING_NS + 2, FILBERT - 5), grid(RING_NS + 2, FILBERT + 5), grid(LEVIS_BACK - 2.5, FILBERT + 5)]) },
  { id: 'levis', name: { zh: "Levi's Plaza", en: "Levi's Plaza" }, polygon: strip(ST_LEVIS_A - 3, ST_LEVIS_B + 3, -8, -48, 3) },
  { id: 'pier14', name: { zh: 'Pier 14 · 14 号码头', en: 'Pier 14' }, polygon: pierRect(P14, -3, 34, -6, 6, null) },
  { id: 'ferry', name: { zh: '渡轮大厦', en: 'Ferry Building' }, polygon: strip(ST.ferrySouth - 1, ST.ferryNorth + 2, -26, 40, 3) },
  { id: 'pier7', name: { zh: 'Pier 7 · 7 号码头', en: 'Pier 7' }, polygon: pierRect(P7, -3, 40, -9, 9, null) },
  { id: 'exploratorium', name: { zh: 'Exploratorium · Pier 15', en: 'Exploratorium · Pier 15' }, polygon: strip(160, 190.5, -26, 44, 3) },
  { id: 'pier33', name: { zh: 'Pier 33', en: 'Pier 33 · Alcatraz Landing' }, polygon: strip(280, 301, -26, 44, 3) },
  { id: 'pier39', name: { zh: 'PIER 39', en: 'Pier 39' }, polygon: hull([at(334, -26), at(372, -26), at(334, 5), at(372, 5), loc(P39, -1, -14), loc(P39, -1, 16), loc(P39, 56, -30), loc(P39, 56, 26)]) },
  { id: 'embarcadero', name: { zh: 'Embarcadero 海滨大道', en: 'The Embarcadero' }, polygon: SLAB },
];

// ---------------------------------------------------------------------------
// 18. Land mass (exported extra for world rendering: everything inside the slab that is not water)
// ---------------------------------------------------------------------------

const BULGES: { a: number; b: number; d: number }[] = [
  { a: ST.ferrySouth, b: ST.ferryNorth, d: 31 },
  { a: 161, b: 189.5, d: 9.8 },
  { a: 282.5, b: 299.5, d: 9.4 },
];
function seawallD(st: number) { for (const b of BULGES) if (st >= b.a && st <= b.b) return b.d; return SECTION.seawall; }
const seawall: Vec2[] = [];
for (let st = -80; st <= 460; st += 2) {
  for (const b of BULGES) if (st > b.a - 2 && st <= b.a) seawall.push(at(b.a - 0.01, SECTION.seawall), at(b.a, b.d));
  seawall.push(at(st, seawallD(st)));
  for (const b of BULGES) if (st >= b.b && st < b.b + 2) seawall.push(at(b.b, b.d), at(b.b + 0.01, SECTION.seawall));
}
/** Land polygon (seawall line + everything landward), clipped to the slab. */
export const LAND: Polygon = roundPoly(clipConvex(ccw([...seawall, { x: -400, z: 400 }, { x: 400, z: 400 }].reverse()), SLAB));

// ---------------------------------------------------------------------------
// 19. The district
// ---------------------------------------------------------------------------

const spawnHeading = headingTo(FERRY_GATE, at(47.5, 9));

export const DISTRICT: District = {
  id: 'embarcadero',
  name: { zh: '内河码头 Embarcadero', en: 'The Embarcadero' },
  projection: { originLat: LAT0, originLng: LNG0, unitsPerMeter: K, rotationDeg: -46 },
  slab: SLAB,
  waterLevel: -0.6,
  walk,
  ramps,
  hills: HILLS,
  piers,
  roads,
  blocks,
  landmarks,
  props,
  backdrop,
  streetcar: {
    path: carPath,
    stops: STOPS.map(s => ({ id: s.id, name: s.name, at: carT(s.st) })),
  },
  spawn: { x: FERRY_GATE.x, z: FERRY_GATE.z, heading: spawnHeading },
  ferryDock: at(42.5, 38.2),
  anchors,
  zones,
};

/** Walk length (world units) along the promenade centreline between two stations. */
export function promenadeLength(st0: number, st1: number, step = 0.5): number {
  let L = 0, prev = at(st0, 0);
  for (let s = st0 + step; s <= st1 + 1e-9; s += step) { const p = at(s, 0); L += Math.hypot(p.x - prev.x, p.z - prev.z); prev = p; }
  return L;
}
