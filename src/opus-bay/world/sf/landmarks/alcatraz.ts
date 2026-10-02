import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import { type BatchLike, CONE, ICO, M, mixColor, rng } from '../../builder';
import { ALCA_PATHS, ALCA_X, ALCA_Z, alcaGround, alcaGroundSpan } from './alcatrazGround';
import { NONE, WIN, box, cyl, gable, pyramid, rect, tube, worldPoly } from './kit';
import type { SfLandmark, WalkBlocker } from './index';
import { ALCA_STAIR, ALCA_WALK_BLOCKERS, ALCA_WALK_SURFACES } from '../alcatrazWalk';

/**
 * Alcatraz (W7-W2, T1: fame 95, seen from Coit Tower, the first flight's rings, PIER 39, the bridge deck, Aquatic
 * Park): the island's buildings as they stand today, on the published city ground (alcatrazGround.ts), replacing the
 * OSM boxes the city streamed there (the exclusion is the island's coastline, OSM way 295140461, 1.5 u out).
 *
 * Local frame = the island's centre projectCity(37.8267, −122.423), yaw 0 (local = world − origin), base 0 (world y):
 * every part stands on its own measured ground. Footprints are the OSM ways (raw snapshot 2026-09-26, projected with
 * core/geo projectCity, oriented boxes): the Main Prison / cellhouse 128245373 with the Administration Block 128245367
 * and the Dining Hall 24433437, the Water Tower 660870452, Building 64 24617219, the Guard Tower 1056707180, the Sally
 * Port 27996759, the Former Military Chapel 769605624, the Warden's House ruin 27996789, the Post Exchange & Officers'
 * Club ruin 27996732, the Quartermaster 27996723, the Powerhouse 27996721 and its chimney 1056707165, the New
 * Industries Building 24433395 with its guard gallery 985656043, the Model Industries Building 24433389, the Electric
 * Shop, the Morgue, the restrooms and the ferry float (Alcatraz Ferry Terminal 27999864, the pier 27609572).
 *
 * Facts (nps.gov, read 2026-09-29): the cellhouse, built 1910–1912, is "a three-story cellhouse with four cellblocks"
 * (https://www.nps.gov/places/000/alcatraz-cellhouse.htm); the water tower, 1940, 94 ft, one foot short of the
 * lighthouse (https://www.nps.gov/places/000/alcatraz-water-tower.htm); the lighthouse, 95 ft, 1909, over the Warden's
 * House (https://www.nps.gov/places/000/alcatraz-lighthouse.htm; drawn by world/backdrop.ts with its night beam);
 * Building 64 above the dock (https://www.nps.gov/places/000/alcatraz-building-64.htm); the Guard Tower at the dock
 * (https://www.nps.gov/places/000/alcatraz-guard-tower.htm); the Officers' Club / Social Hall, a ruin since the 1970
 * fire (https://www.nps.gov/places/5-officers-club.htm); the inmate-terraced gardens
 * (https://www.nps.gov/places/25-west-side-gardens.htm).
 *
 * Toy heights (plan §2.2, H = 3.2 + 0.155·h): the cellhouse ≈ 14 m to its parapet → 5.4 u over its low corner; the
 * water tower 94 ft = 28.7 m → 7.6 u; Building 64 three storeys → 4.6 u. No lettering anywhere (the painted words on the
 * water tower and Building 64 are left out). Budget T1: lod 0 ≤ 6k triangles, lod 2 ≤ 10 % (the test measures both).
 */

export const ALCATRAZ = { x: ALCA_X, z: ALCA_Z } as const;

const DEG = Math.PI / 180;
const CONC = '#eeeae0', CONC_SH = '#d3cdc0', ROOF = '#b9b6ae', DARK = '#373e3e', BAR = '#d6d0c4';
const STUCCO = '#e6d6b0', STUCCO_SH = '#c9b58e', BRICK = '#b0836a', RUIN = '#cdb896', SOOT = '#7d7266', WHITE = '#f0ede4';
const TANK = '#e7e1d4', RUST = '#b27a5b', STEEL = '#7b7771', TILE = '#b8664a', DECK = '#9b8f7e', PILE = '#5d554c';

/** the island's coastline (OSM way 295140461, simplified 0.7 u, local) */
export const ALCA_COAST: readonly Vec2[] = [
  [3.24, -14.48], [-5.84, -11.3], [-16.51, -11.7], [-20.36, -10.15], [-22.54, -7.97], [-28.54, -7.4], [-30.07, -4.75], [-36.69, 0.44],
  [-39.02, 4.22], [-38.74, 7.28], [-35.09, 9.96], [-30.63, 7.91], [-20.38, 11.8], [-17.11, 12.1], [-14.53, 11.05], [-12.98, 14.25],
  [-10.29, 13.93], [-9.42, 12.32], [-6.38, 11.35], [-5.33, 9.34], [-2.97, 9.63], [0.79, 12.83], [12.72, 8.63], [16.14, 10.12],
  [18.6, 8.58], [28.88, 6.06], [33.59, 1.21], [35.79, -4.33], [35.17, -8.06], [33.15, -12.77], [28.06, -16.08], [17.01, -16.69],
  [16.72, -18.64], [9.86, -17.85], [10.16, -16.24], [5.49, -15.24], [5.7, -14.1],
].map(([x, z]) => ({ x, z }));

/** the convex hull of a ring (monotone chain), counter-clockwise in (x, z) */
function hull(pts: readonly Vec2[]): Vec2[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.z - b.z), cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lo: Vec2[] = [], up: Vec2[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
/** the exclusion: the coastline's convex hull pushed 1.5 u out from the island's middle (the ferry float and the pier inside) */
const EXCLUDE: Vec2[] = hull(ALCA_COAST).map(p => { const d = Math.hypot(p.x, p.z) || 1; return { x: +(p.x * (1 + 1.5 / d)).toFixed(2), z: +(p.z * (1 + 1.5 / d)).toFixed(2) }; });

// ---------------------------------------------------------------------------
// footprints (OSM oriented boxes, local): centre, length along the angle, width across, angle (deg, maths: +x → +z)
// ---------------------------------------------------------------------------

interface Foot { x: number; z: number; L: number; W: number; a: number }
const F = (x: number, z: number, L: number, W: number, a: number): Foot => ({ x, z, L, W, a });
/** the cellhouse block (the Main Prison way without its dining-hall end), the admin block, the dining hall */
const CELL = F(0.4, 0, 10.4, 6.2, 0);
const ADMIN = F(6.75, -0.85, 2.3, 4.9, 0);
const HALL = F(-7.6, 0.3, 5.6, 2.8, 0);
const YARD = { x0: -11.3, x1: -4.8, z0: 1.9, z1: 6.1 };
const TOWER = { x: -17.68, z: -1.13 };
const B64 = F(11.16, -11.26, 4.14, 11.93, 80);
const GUARD = { x: 6.06, z: -14.73 };
const SALLY = F(-0.2, -11.73, 2.08, 3.32, 78);
const CHAPEL = F(-2.38, -11.16, 1.23, 2.28, 169);
const ELECTRIC = F(-4.94, -9.46, 0.95, 2.74, 77);
const WARDEN = F(13.57, -5.47, 2.57, 1.8, 5);
const CLUB = F(-13.12, -9.19, 1.65, 4.36, 73);
const QM = F(-24.61, -4.89, 4.65, 1.71, 172);
const POWER = F(-30.54, -2.03, 3.51, 6.16, 42);
const CHIMNEY = { x: -29.48, z: -4.26 };
const NEWIND = F(-22.83, 6.25, 13, 2.87, 15);
const MODEL = F(-34.14, 7.13, 5.88, 3.96, 171);
const MORGUE = F(-11.2, -1.06, 0.83, 0.6, 99);
const SMALL = [F(9.19, -4.33, 0.59, 1.72, 98), F(9.44, -1.26, 1.54, 2.69, 0), F(11.52, -16.98, 1.6, 1.15, 167), F(12.48, -1.24, 0.63, 0.9, 94)];
const FLOAT = F(18.98, -18.12, 3.37, 1.71, 174);

const ry = (f: Foot) => -f.a * DEG;
const span = (f: Foot) => alcaGroundSpan(f.x, f.z, f.L / 2, f.W / 2, ry(f));
/** a plain block on its lowest ground (walls sink 1 u), `h` over that ground */
function block(b: BatchLike, f: Foot, h: number, wall: string, info: 'res' | 'office' | 'brick' | 'none' = 'none', lo = span(f).lo) {
  const style = info === 'res' ? 1 : info === 'office' ? 2 : info === 'brick' ? 4 : 0;
  box(b, f.x, lo - 1, f.z, f.L, h + 1, f.W, wall, style ? WIN(style, lo) : [0, lo, 0, 0], ry(f));
  return lo + h;
}
/** a flat roof slab with a parapet lip */
function roofSlab(b: BatchLike, f: Foot, y: number, color = ROOF) {
  box(b, f.x, y, f.z, f.L + 0.12, 0.14, f.W + 0.12, CONC_SH, NONE, ry(f));
  box(b, f.x, y + 0.14, f.z, f.L - 0.1, 0.02, f.W - 0.1, color, NONE, ry(f));
}

/** A flat panel on a wall plane: centre (x, z), outward normal (nx, nz), width w along the wall, y0 → y1, `off` proud. */
function panel(b: BatchLike, x: number, z: number, nx: number, nz: number, w: number, y0: number, y1: number, color: string, off = 0.02) {
  const tx = nz, tz = -nx, px = x + nx * off, pz = z + nz * off, h = w / 2;
  b.quad(new THREE.Vector3(px - tx * h, y0, pz - tz * h), new THREE.Vector3(px + tx * h, y0, pz + tz * h), new THREE.Vector3(px + tx * h, y1, pz + tz * h), new THREE.Vector3(px - tx * h, y1, pz - tz * h), new THREE.Vector3(nx, 0, nz), color, NONE);
}

/** a barred window: a dark opening with two light bars in front */
function barred(b: BatchLike, x: number, z: number, nx: number, nz: number, w: number, y0: number, y1: number) {
  panel(b, x, z, nx, nz, w, y0, y1, DARK, 0.02);
  const tx = nz, tz = -nx;
  for (const k of [-0.25, 0.25]) panel(b, x + tx * w * k, z + tz * w * k, nx, nz, 0.045, y0, y1, BAR, 0.035);
}

// ---------------------------------------------------------------------------
// the cellhouse
// ---------------------------------------------------------------------------

const CELL_LO = () => alcaGroundSpan(CELL.x, CELL.z, CELL.L / 2, CELL.W / 2).lo;
/** the cellhouse's parapet height over its low corner (≈ 14 m, three tall storeys) */
const CELL_H = 5.4;

function cellhouse(b: BatchLike, lod: 0 | 2) {
  const lo = CELL_LO(), top = lo + CELL_H;
  box(b, CELL.x, lo - 1.2, CELL.z, CELL.L, CELL_H + 1.2, CELL.W, CONC, [0, lo, 0, 0]);
  // the roof: a grey deck inside a parapet, and the long clerestory (the skylight monitor over the cellblocks)
  box(b, CELL.x, top, CELL.z, CELL.L - 0.2, 0.03, CELL.W - 0.2, ROOF);
  box(b, CELL.x, top, CELL.z, CELL.L - 1.4, 0.95, 2.3, CONC_SH);
  box(b, CELL.x, top + 0.95, CELL.z, CELL.L - 1.2, 0.12, 2.6, ROOF);
  // the admin block (east end, two storeys, the main door and its office windows) and the dining hall (west end)
  const aLo = span(ADMIN).lo, hLo = span(HALL).lo;
  const aTop = block(b, ADMIN, Math.min(4.1, top - 1.2 - aLo), CONC, lod === 2 ? 'none' : 'office', aLo);
  const hTop = block(b, HALL, 3.9, CONC, lod === 2 ? 'none' : 'office', hLo);
  if (lod === 2) return;
  roofSlab(b, ADMIN, aTop);
  roofSlab(b, HALL, hTop);
  box(b, CELL.x, top - 0.28, CELL.z, CELL.L + 0.14, 0.28, CELL.W + 0.14, CONC_SH);
  // the clerestory's glazing, barred, both long sides
  const mz = 1.15, mx0 = CELL.x - (CELL.L - 1.4) / 2;
  for (const s of [-1, 1]) {
    panel(b, CELL.x, CELL.z + s * mz, 0, s, CELL.L - 1.6, top + 0.25, top + 0.78, DARK);
    for (let x = mx0 + 0.5; x < mx0 + CELL.L - 1.4 - 0.3; x += 0.55) panel(b, x, CELL.z + s * mz, 0, s, 0.06, top + 0.25, top + 0.78, BAR, 0.035);
  }
  // the long walls: tall barred window bays in two tiers (the cellblocks' three storeys behind), pilasters between
  const n = 13, x0 = CELL.x - CELL.L / 2, bay = CELL.L / n;
  for (const s of [-1, 1]) {
    const zf = CELL.z + s * CELL.W / 2;
    for (let i = 0; i < n; i++) {
      const x = x0 + bay * (i + 0.5), g = alcaGround(x, zf + s * 0.4);
      for (const [y0, y1] of [[lo + 1.0, lo + 2.55], [lo + 2.9, lo + 4.55]]) {
        if (y0 < g + 0.25) continue;
        barred(b, x, zf, 0, s, bay * 0.52, y0, y1);
      }
    }
    // a darker plinth band where the wall meets the hill
    panel(b, CELL.x, zf, 0, s, CELL.L, lo - 0.2, lo + 0.55, CONC_SH, 0.01);
  }
  // the west end over the dining hall and the east end over the admin block: a row of barred windows high up
  for (const s of [-1, 1]) {
    const xf = CELL.x + s * CELL.L / 2;
    const y0 = s > 0 ? Math.max(top - 1.35, aTop + 0.15) : top - 1.35;
    for (let k = -2; k <= 2; k++) barred(b, xf, CELL.z + k * 1.15, s, 0, 0.55, y0, top - 0.45);
  }
  // the main door on the admin block's south face (a dark arch-less opening) and the steps up to it
  panel(b, ADMIN.x, ADMIN.z - ADMIN.W / 2, 0, -1, 0.8, aLo + 0.02, aLo + 1.2, DARK, 0.02);
  // the recreation yard: tall concrete walls, the floor and the stepped bleachers against the dining hall
  yard(b, hLo);
}

function yard(b: BatchLike, floorY: number) {
  const { x0, x1, z0, z1 } = YARD, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  const low = alcaGroundSpan(cx, cz, w / 2, d / 2).lo, t = 0.25, top = floorY + 1.7;
  box(b, cx, low - 0.8, cz, w - 0.1, floorY - low + 0.8, d - 0.1, CONC_SH);
  box(b, cx, floorY, cz, w - 2 * t, 0.02, d - 2 * t, '#b9b4aa');
  for (const [x, z, ww, dd] of [[cx, z1 - t / 2, w, t], [x0 + t / 2, cz, t, d], [x1 - t / 2, cz, t, d]] as const) box(b, x, low - 0.8, z, ww, top - low + 0.8, dd, CONC, [0, low, 0, 0]);
  for (let k = 0; k < 3; k++) box(b, cx, floorY, z0 + 0.35 + k * 0.32, w - 2 * t, 0.22 * (3 - k), 0.32, k % 2 ? CONC : CONC_SH);
  // the guard catwalk boxes on two corners
  for (const [x, z] of [[x0 + 0.4, z1 - 0.4], [x1 - 0.4, z1 - 0.4]] as const) { box(b, x, top, z, 0.7, 0.55, 0.7, WHITE, WIN(6, top)); pyramid(b, x, top + 0.55, z, 0.9, 0.9, 0.3, STEEL); }
}

// ---------------------------------------------------------------------------
// the water tower (1940, 94 ft), on its braced steel legs by the parade of the old industries
// ---------------------------------------------------------------------------

const TANK_R = 1.0, TANK_H = 1.75, TOWER_H = 7.6;
const towerLo = () => alcaGroundSpan(TOWER.x, TOWER.z, 1, 1).lo;

function waterTower(b: BatchLike, lod: 0 | 2) {
  const lo = towerLo(), t0 = lo + TOWER_H - TANK_H - 0.45, { x, z } = TOWER;
  if (lod === 2) {
    box(b, x, lo - 0.5, z, 1.3, t0 - lo + 0.5, 1.3, STEEL);
    cyl(b, x, t0, z, TANK_R, TANK_H + 0.45, TANK, NONE, 6);
    return;
  }
  const legs: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const foot = 0.95, head = 0.72;
  const P = (k: number, y: number, s: number) => new THREE.Vector3(x + legs[k][0] * s, y, z + legs[k][1] * s);
  for (let k = 0; k < 4; k++) tube(b, P(k, lo - 0.5, foot), P(k, t0, head), 0.07, STEEL, NONE, 4);
  // two tiers of cross bracing
  for (const [ya, yb] of [[lo + 0.4, (lo + t0) / 2], [(lo + t0) / 2, t0 - 0.2]]) {
    const sa = foot + (head - foot) * ((ya - lo) / (t0 - lo)), sb = foot + (head - foot) * ((yb - lo) / (t0 - lo));
    for (let k = 0; k < 4; k++) { const j = (k + 1) % 4; tube(b, P(k, ya, sa), P(j, yb, sb), 0.03, STEEL, NONE, 3); tube(b, P(j, ya, sa), P(k, yb, sb), 0.03, STEEL, NONE, 3); }
    for (let k = 0; k < 4; k++) tube(b, P(k, yb, sb), P((k + 1) % 4, yb, sb), 0.04, STEEL, NONE, 3);
  }
  // the tank, a rust-streaked band, the balcony ring and the conical cap
  cyl(b, x, t0, z, TANK_R * 0.9, 0.45, STEEL, NONE, 10);
  cyl(b, x, t0 + 0.45, z, TANK_R, TANK_H, TANK, NONE, 14);
  cyl(b, x, t0 + 0.45 + TANK_H * 0.62, z, TANK_R + 0.01, 0.2, RUST, NONE, 14);
  cyl(b, x, t0 + 0.4, z, TANK_R + 0.16, 0.06, STEEL, NONE, 14);
  b.add(CONE(14), M(x, t0 + 0.45 + TANK_H, z, 0, TANK_R + 0.05, 0.42, TANK_R + 0.05), mixColor(TANK, STEEL, 0.35), NONE);
}

// ---------------------------------------------------------------------------
// the dock: Building 64, the guard tower, the pier and the ferry float
// ---------------------------------------------------------------------------

function dock(b: BatchLike, lod: 0 | 2) {
  const lo64 = span(B64).lo;
  const top64 = block(b, B64, 4.6, STUCCO, lod === 2 ? 'none' : 'res', lo64);
  if (lod === 2) return;
  roofSlab(b, B64, top64, '#9d978b');
  // a darker base course (the old bombproof casemate storey on the waterfront)
  const r = ry(B64), c = Math.cos(r), s = Math.sin(r);
  box(b, B64.x - s * 0.02, lo64 - 0.2, B64.z - c * 0.02, B64.L + 0.04, 1.2, B64.W + 0.04, STUCCO_SH, NONE, r);
  // the dock apron along the shore and the pier (OSM 27609572), pilings on the water side
  const apron = rect(9.5, -16.4, 9.8, 2.2, 0.14);
  b.prism(apron, -0.8, 0.32, PILE, DECK);
  box(b, 7.75, -0.8, -17.3, 4.6, 1.12, 1.1, PILE, NONE, 0.14);
  box(b, 7.75, 0.32, -17.3, 4.6, 0.02, 1.1, DECK, NONE, 0.14);
  for (let k = 0; k < 7; k++) cyl(b, 5.2 + k * 1.55, -0.8, -17.75 + k * 0.215 - 0.35, 0.09, 1.3, PILE, NONE, 5);
  // the ferry float and its little shelter
  const fr = ry(FLOAT);
  box(b, FLOAT.x, -0.35, FLOAT.z, FLOAT.L, 0.6, FLOAT.W, '#a9a293', NONE, fr);
  for (const [u, v] of [[-1.3, -0.6], [1.3, -0.6], [-1.3, 0.6], [1.3, 0.6]]) {
    const p = { x: FLOAT.x + u * Math.cos(fr) + v * Math.sin(fr), z: FLOAT.z - u * Math.sin(fr) + v * Math.cos(fr) };
    cyl(b, p.x, 0.25, p.z, 0.05, 1.0, STEEL, NONE, 4);
  }
  box(b, FLOAT.x, 1.25, FLOAT.z, FLOAT.L * 0.9, 0.08, FLOAT.W * 0.9, '#4e6a6e', NONE, fr);
  // the guard tower on its stilts (repainted 2013): a white cab with windows all round, a pyramid cap
  const g = alcaGround(GUARD.x, GUARD.z), cab = g + 2.4;
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) tube(b, new THREE.Vector3(GUARD.x + u * 0.42, g - 0.4, GUARD.z + v * 0.42), new THREE.Vector3(GUARD.x + u * 0.32, cab, GUARD.z + v * 0.32), 0.05, '#8d877e', NONE, 4);
  box(b, GUARD.x, cab, GUARD.z, 0.95, 0.85, 0.95, WHITE, WIN(6, cab));
  box(b, GUARD.x, cab - 0.06, GUARD.z, 1.25, 0.08, 1.25, STEEL);
  pyramid(b, GUARD.x, cab + 0.85, GUARD.z, 1.2, 1.2, 0.45, '#5f6664');
}

/**
 * Wave 8 (lane A): the stairway up from the dock road to the cellhouse front (world/sf/alcatrazWalk.ts ALCA_STAIR, the
 * walk's 'stairs' strip): concrete steps on the hill's own slope, a kerb each side and a pipe rail on the downhill posts.
 */
function stair(b: BatchLike) {
  const { x, z0, z1, width, steps } = ALCA_STAIR, d = (z1 - z0) / steps;
  for (let i = 0; i < steps; i++) {
    const z = z0 + (i + 0.5) * d, y = alcaGround(x, z);
    box(b, x, y - 0.9, z, width - 0.2, 0.92, Math.abs(d) + 0.02, i % 2 ? CONC : CONC_SH);
  }
  for (const s of [-1, 1]) {
    const ex = x + s * (width / 2 - 0.05);
    const a = new THREE.Vector3(ex, alcaGround(x, z0) + 0.12, z0), c = new THREE.Vector3(ex, alcaGround(x, z1) + 0.12, z1);
    tube(b, a, c, 0.1, CONC_SH, NONE, 4);
    tube(b, new THREE.Vector3(ex, a.y + 0.75, z0), new THREE.Vector3(ex, c.y + 0.75, z1), 0.035, STEEL, NONE, 4);
    for (let k = 0; k <= 4; k++) {
      const zz = z0 + ((z1 - z0) * k) / 4, yy = alcaGround(x, zz);
      cyl(b, ex, yy, zz, 0.035, 0.85, STEEL, NONE, 4);
    }
  }
}

// ---------------------------------------------------------------------------
// the rest of the island: the ruins, the chapel, the industries on the north-west shore
// ---------------------------------------------------------------------------

/** a roofless shell: four walls with dark window holes (the Warden's House, burnt 1970; the Officers' Club) */
function shell(b: BatchLike, f: Foot, h: number, rows: number, wall: string) {
  const r = ry(f), c = Math.cos(r), s = Math.sin(r), lo = span(f).lo, t = 0.16;
  const at = (u: number, v: number) => ({ x: f.x + u * c + v * s, z: f.z - u * s + v * c });
  for (const [u, v, w, d, hh] of [[0, f.W / 2 - t / 2, f.L, t, h], [0, -f.W / 2 + t / 2, f.L, t, h * 0.92], [f.L / 2 - t / 2, 0, t, f.W, h * 0.8], [-f.L / 2 + t / 2, 0, t, f.W, h]] as const) {
    const p = at(u, v);
    box(b, p.x, lo - 0.6, p.z, w, hh + 0.6, d, wall, [0, lo, 0, 0], r);
    box(b, p.x, lo + hh - 0.3, p.z, w + 0.01, 0.3, d + 0.01, SOOT, NONE, r);
  }
  for (const sv of [-1, 1]) for (let k = 0; k < rows; k++) {
    const n = Math.max(2, Math.floor(f.L / 0.75));
    for (let i = 0; i < n; i++) {
      const p = at(-f.L / 2 + (i + 0.5) * (f.L / n), sv * (f.W / 2 + 0.005));
      const y0 = lo + 0.45 + k * 1.05;
      if (y0 + 0.7 > lo + h * (sv > 0 ? 1 : 0.92) - 0.2) continue;
      panel(b, p.x, p.z, sv * s, sv * c, 0.34, y0, y0 + 0.7, DARK, 0.005);
    }
  }
}

function island(b: BatchLike) {
  // the Sally Port (1857) and the Former Military Chapel (mission revival, a red tile roof)
  const sTop = block(b, SALLY, 2.2, BRICK, 'brick');
  box(b, SALLY.x, sTop, SALLY.z, SALLY.L + 0.1, 0.14, SALLY.W + 0.1, '#8f6a55', NONE, ry(SALLY));
  const cTop = block(b, CHAPEL, 2.3, STUCCO, 'res');
  gable(b, CHAPEL.x, cTop, CHAPEL.z, CHAPEL.L, CHAPEL.W, 0.55, TILE, STUCCO, ry(CHAPEL), 0.1);
  block(b, ELECTRIC, 1.5, CONC_SH, 'office');
  // the Warden's House (17 rooms, burnt 1970: a roofless three-storey shell by the lighthouse) and the Officers' Club ruin
  shell(b, WARDEN, 3.2, 3, RUIN);
  shell(b, CLUB, 1.5, 1, '#c7b89f');
  // the Quartermaster (white, gabled), the Powerhouse with its tall chimney, the Morgue, the restrooms and kiosks
  const qTop = block(b, QM, 2.1, WHITE, 'res');
  gable(b, QM.x, qTop, QM.z, QM.L, QM.W, 0.6, '#8a8d8a', WHITE, ry(QM), 0.1);
  const pTop = block(b, POWER, 2.8, '#cbbfa9', 'brick');
  roofSlab(b, POWER, pTop, '#8f8a80');
  const chLo = alcaGround(CHIMNEY.x, CHIMNEY.z);
  cyl(b, CHIMNEY.x, chLo - 0.5, CHIMNEY.z, 0.34, 6.2, '#b9a58c', NONE, 8, 0.72);
  cyl(b, CHIMNEY.x, chLo + 5.5, CHIMNEY.z, 0.27, 0.22, SOOT, NONE, 8);
  block(b, MORGUE, 0.9, CONC_SH);
  for (const f of SMALL) block(b, f, 1.0, '#d9d2c3');
  // the New Industries Building (1939) with the guard gallery along its roof, the Model Industries Building (1921)
  const nTop = block(b, NEWIND, 3.1, '#ddd6c7', 'office');
  roofSlab(b, NEWIND, nTop);
  const nr = ry(NEWIND), nc = Math.cos(nr), ns = Math.sin(nr);
  box(b, NEWIND.x + ns * 0.9, nTop + 0.16, NEWIND.z + nc * 0.9, NEWIND.L - 0.6, 0.55, 0.34, STEEL, WIN(6, nTop + 0.16), nr);
  const mTop = block(b, MODEL, 3.7, '#e1d8c5', 'office');
  roofSlab(b, MODEL, mTop);
}

// ---------------------------------------------------------------------------
// gardens and scrub (the inmate-terraced gardens along the road below the cellhouse and on the west side)
// ---------------------------------------------------------------------------

const GARDEN_BEDS: readonly [number, number, number, number, number][] = [
  // x0, z0, x1, z1, count (local rectangles; the road terraces south of the cellhouse, the west-side terraces)
  [2.5, -7.3, 11.8, -5.6, 12],
  [-3.4, -6.2, 1.8, -4.4, 6],
  [-15.2, -3.4, -11.6, 1.6, 9],
  [-14.4, 2.0, -11.8, 4.6, 5],
];
const BLOOMS = ['#e27a8e', '#f0c24f', '#e4574a', '#b98ad6', '#f5efe0', '#f09a5a'];

function gardens(b: BatchLike) {
  const r = rng(95);
  // the roads and paths (the city's own ribbons are excluded with the island): pale asphalt and gravel on the ground
  for (const w of ALCA_PATHS) {
    const pts: Vec2[] = [];
    for (let i = 1; i + 1 < w.length; i += 2) pts.push({ x: w[i], z: w[i + 1] });
    b.ribbon(pts, w[0], (x, z) => alcaGround(x, z) + 0.07, w[0] > 1 ? '#bcb4a6' : '#d4c8b0', NONE, 1.2);
  }
  for (const [x0, z0, x1, z1, n] of GARDEN_BEDS) {
    for (let i = 0; i < n; i++) {
      const x = x0 + (x1 - x0) * ((i + 0.5 + (r() - 0.5) * 0.6) / n), z = z0 + (z1 - z0) * (0.2 + r() * 0.6), y = alcaGround(x, z), s = 0.32 + r() * 0.22;
      b.add(ICO(0), M(x, y + s * 0.55, z, r() * 3, s, s * 0.75, s), mixColor('#6f9458', '#4f7a47', r()), [0, 0, 0.15, 0]);
      b.add(ICO(0), M(x + (r() - 0.5) * 0.2, y + s * 1.05, z + (r() - 0.5) * 0.2, 0, s * 0.55, s * 0.4, s * 0.55), BLOOMS[Math.floor(r() * BLOOMS.length)], [0, 0, 0.15, 0]);
    }
  }
  // scrub and a few windbent trees on the slopes (the island's south and east faces, the parade ground's edge)
  const SCRUB: readonly [number, number, number][] = [
    [-26, -7, 0.7], [-20, -8.5, 0.8], [-9.5, -9.8, 0.7], [-7.5, 7.5, 0.8], [-1, 8.4, 0.7], [4.5, 6.9, 0.9], [9.5, 6.1, 0.8],
    [15.5, 5.6, 1.0], [19.5, 3.0, 1.1], [24.5, 1.5, 0.9], [28.5, -2.0, 1.0], [30.5, -7.5, 0.9], [26.5, -12, 0.8], [20.5, -12.8, 1.1],
    [16.5, -9.2, 1.2], [14.8, 1.8, 1.0], [-33, 3.5, 0.8], [-27, 9.2, 0.7],
  ];
  for (const [x, z, s] of SCRUB) {
    const y = alcaGround(x, z);
    if (y < 0.4) continue;
    b.add(ICO(0), M(x, y + s * 0.6, z, x, s * 1.1, s * 0.8, s * 1.1), mixColor('#7c8f55', '#5b7446', r()), [0, 0, 0.2, 0]);
  }
  // the parade ground (the officers' housing, razed in 1971): rubble slabs in the dry grass
  for (let i = 0; i < 9; i++) {
    const x = 18 + r() * 10, z = -9 + r() * 9, y = alcaGround(x, z);
    box(b, x, y - 0.1, z, 0.6 + r() * 0.9, 0.18 + r() * 0.2, 0.5 + r() * 0.7, mixColor('#b3aa9b', '#8f877a', r()), NONE, r() * 3);
  }
}

// ---------------------------------------------------------------------------

function build(b: BatchLike, lod: 0 | 2) {
  cellhouse(b, lod);
  waterTower(b, lod);
  dock(b, lod);
  if (lod === 2) {
    block(b, NEWIND, 3.1, '#ddd6c7');
    block(b, POWER, 2.8, '#cbbfa9');
    return;
  }
  island(b);
  gardens(b);
  stair(b);
}

const poly = (f: Foot): Vec2[] => rect(f.x, f.z, f.L, f.W, ry(f));
const BLOCKERS: WalkBlocker[] = [
  { poly: poly(CELL) }, { poly: poly(ADMIN) }, { poly: poly(HALL) },
  { x: TOWER.x, z: TOWER.z, r: 1.25 },
  { poly: poly(B64) }, { poly: poly(NEWIND) }, { poly: poly(POWER) }, { poly: poly(MODEL) },
  // wave 8 (lane A): the plateau's lighthouse, small buildings and the Warden's House (the island is walkable now)
  ...ALCA_WALK_BLOCKERS,
];

export const alcatraz: SfLandmark = {
  id: 'alcatraz',
  tier: 1,
  x: ALCA_X,
  z: ALCA_Z,
  yaw: 0,
  base: 0,
  sink: 0,
  exclude: { poly: worldPoly(ALCA_X, ALCA_Z, 0, EXCLUDE) },
  build,
  // wave 8 (lane A): the dock, the dock road, the stair and the cellhouse front are walkable (world/sf/alcatrazWalk.ts)
  walk: { blockers: BLOCKERS, surfaces: ALCA_WALK_SURFACES.map(s => ({ poly: s.poly, y: s.y, surface: s.surface })) },
  tall: [{ x: TOWER.x, z: TOWER.z, r: 1.3 }],
};

/** QA / tests: the parts' measured grounds (world y) */
export const ALCA_PARTS = {
  cellLo: CELL_LO,
  cellTop: () => CELL_LO() + CELL_H,
  towerTop: () => towerLo() + TOWER_H,
  b64Lo: () => span(B64).lo,
} as const;
