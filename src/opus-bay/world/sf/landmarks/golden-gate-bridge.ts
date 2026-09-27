import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { GLOW, NONE, SF, box, cbox, lathe, rect, sweepX, tube, worldPoly } from './kit';
import type { LandmarkTallPart, SfLandmark, WalkBlocker, WalkSurface } from './index';

/**
 * Golden Gate Bridge (T1, ≤ 12k triangles). Local frame: origin on the deck line half-way between the towers,
 * local +x runs south → north along the span, local +z faces east (the Bay / Crissy Field side). Local y = world y
 * (base 0 = the district water datum; water at −0.6).
 *
 * Stations along x come from opus-qa/sf-data/landmarks.json + OSM: towers at (−796.1, 564.4) / (−935.5, 452.7)
 * (±89.29 u, main span 178.6 u = 1,276 m), south anchorage −160.33, north anchorage +144.37, Fort Point arch
 * pylons S1 −136.8 / S2 −152.6 (OSM "Pylon S1/S2", ±2.17 u off the axis). Heights per plan §2.2 (terrainY):
 * tower top 227 m → 42.2 u, deck 67 m → 15.2 u. The deck stays level from −230 to +192, where the Presidio bluff
 * and the Marin side (DEM, same curve) come back up to ≈ 15 u.
 *
 * Toy liberties: the deck is 5.3 u wide (1.4× real) so the sidewalks are walkable; cables are 0.4 u thick so they
 * read from Twin Peaks; the art-deco portals keep their stepped corners and the legs their stepped setbacks.
 */

const X0 = -865.81, Z0 = 508.555, YAW = 2.4662;
const DECK = 15.2;
const TOWER = 89.29;
const TOP = 42.2;
const ANCH_S = -160.33, ANCH_N = 144.37;
const S1 = -136.8, S2 = -152.6, N1 = 136.8;
const END_S = -230, END_N = 192;
/** cable plane (and tower-leg centre) offset across the deck */
const CZ = 2.55;
const RAIL = 2.65;
const CABLE_MID = DECK + 1.1;
const CABLE_SADDLE = TOP - 0.25;

/** tower leg stack: [y0, y1, size along the span, size across] */
const LEGS: [number, number, number, number][] = [
  [-0.4, DECK - 1.45, 2.4, 1.4],
  [DECK - 1.45, 24.2, 2.2, 1.3],
  [24.2, 31.0, 2.0, 1.2],
  [31.0, 36.2, 1.85, 1.12],
  [36.2, TOP - 1.0, 1.7, 1.05],
];
/** portal struts between the legs: [y0, y1] (the lowest carries the deck) */
const STRUTS: [number, number][] = [[DECK - 2.6, DECK - 1.45], [24.2, 25.6], [31.0, 32.2], [36.2, 37.3], [TOP - 2.3, TOP - 1.0]];

function cableY(s: number): number {
  if (Math.abs(s) <= TOWER) return CABLE_MID + (CABLE_SADDLE - CABLE_MID) * (s / TOWER) ** 2;
  const anch = s < 0 ? ANCH_S : ANCH_N;
  const t = (Math.abs(s) - TOWER) / (Math.abs(anch) - TOWER);
  return CABLE_SADDLE + (DECK + 0.9 - CABLE_SADDLE) * t - 1.2 * 4 * t * (1 - t);
}
/** the cables splay outward a little past the last suspender, into the anchorage pylons */
function cableZ(s: number): number {
  const end = s < 0 ? S1 : N1, anch = s < 0 ? ANCH_S : ANCH_N;
  if (Math.abs(s) <= Math.abs(end)) return CZ;
  return CZ + 0.65 * ((Math.abs(s) - Math.abs(end)) / (Math.abs(anch) - Math.abs(end)));
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function tower(b: BatchLike, sx: number, lod: 0 | 2, south: boolean) {
  const orange = SF.ggb, light = SF.ggbLight, dark = SF.ggbDark;
  // floodlit at night (the towers are lit from their piers)
  const lit = GLOW(0.3);
  // pier (+ the south tower's elliptic fender ring out in the strait)
  box(b, sx, -2.2, 0, 6.2, 4.0, 8.4, '#cfc7b6');
  box(b, sx, 1.4, 0, 5.4, 0.4, 7.6, '#ddd5c4');
  if (south && lod === 0) lathe(b, [[0.86, -1.4], [1, -1.4], [1, 1.1], [0.86, 1.1]], sx, 0, 0, '#d6cebd', NONE, 18, 7.5, 9.5);
  for (const zs of [-1, 1]) {
    const zc = zs * CZ;
    if (lod === 2) {
      box(b, sx, 1.8, zc, 2.3, TOP - 1.8, 1.25, orange, lit);
      continue;
    }
    for (const [y0, y1, w, d] of LEGS) {
      box(b, sx, Math.max(1.8, y0), zc, w, y1 - Math.max(1.8, y0), d, orange, lit);
      // art-deco pilasters: a raised rib on the span faces and one on the outer face
      box(b, sx, Math.max(1.8, y0), zc, w + 0.14, y1 - Math.max(1.8, y0) - 0.05, d * 0.42, light, lit);
      box(b, sx, Math.max(1.8, y0), zc + zs * 0.04, w * 0.46, y1 - Math.max(1.8, y0) - 0.05, d + 0.1, light, lit);
      // setback ledge
      box(b, sx, y1 - 0.18, zc, w + 0.22, 0.18, d + 0.18, dark);
    }
    // crown cornice, cable saddle housing, aviation light
    box(b, sx, TOP - 1.0, zc, 1.95, 0.4, 1.3, light, lit);
    box(b, sx, TOP - 0.6, zc, 1.3, 0.6, 0.95, orange, lit);
    box(b, sx, TOP, zc, 0.22, 0.22, 0.22, '#ff5a44', GLOW(1));
  }
  for (const [i, [y0, y1]] of STRUTS.entries()) {
    const leg = LEGS.find(l => y0 >= l[0] - 0.01 && y0 < l[1]) ?? LEGS[LEGS.length - 1];
    const w = i === 0 ? 2.1 : leg[2] * 0.8, inner = CZ - leg[3] / 2 + 0.05;
    if (lod === 2) { if (i > 0) box(b, sx, y0, 0, w, y1 - y0, inner * 2, orange, lit); continue; }
    box(b, sx, y0, 0, w, y1 - y0, inner * 2, orange, lit);
    if (i === 0) continue;
    // stepped art-deco corners at the top of each opening below the strut
    for (const zs of [-1, 1]) {
      box(b, sx, y0 - 0.55, zs * (inner - 0.22), w * 0.9, 0.55, 0.44, light, lit);
      box(b, sx, y0 - 0.28, zs * (inner - 0.62), w * 0.9, 0.28, 0.36, light, lit);
    }
  }
  if (lod === 2) return;
  const inner = CZ - LEGS[0][3] / 2;
  // X-bracing below the deck
  for (const [ya, yb] of [[2.0, 7.4], [7.4, DECK - 2.6]] as [number, number][]) {
    tube(b, v(sx, ya, -inner), v(sx, yb, inner), 0.3, dark);
    tube(b, v(sx, ya, inner), v(sx, yb, -inner), 0.3, dark);
  }
  box(b, sx, 7.1, 0, 1.4, 0.6, inner * 2, orange);
  // sidewalk balconies around the outside of the legs
  for (const zs of [-1, 1]) {
    box(b, sx, DECK - 0.35, zs * 3.55, 3.6, 0.35, 1.5, SF.concrete);
    box(b, sx, DECK - 0.02, zs * 4.33, 3.6, 0.7, 0.1, orange);
    for (const xs of [-1, 1]) box(b, sx + xs * 1.8, DECK - 0.02, zs * 3.52, 0.1, 0.7, 1.5, orange);
  }
}

/** Concrete art-deco pylon beside the deck (S1, S2, N1 and the anchorage fronts). */
function pylon(b: BatchLike, sx: number, zs: number, ground: number, top: number) {
  const conc = '#e2dbcd', trim = '#efe9dd';
  const z = zs * 3.35;
  box(b, sx, ground, z, 1.5, top - ground, 1.2, conc, GLOW(0.06));
  box(b, sx, top, z, 1.2, 0.8, 0.95, trim, GLOW(0.06));
  box(b, sx, top + 0.8, z, 0.8, 0.5, 0.65, conc);
  box(b, sx, ground, z + zs * 0.62, 0.5, top - ground - 0.3, 0.06, '#d4ccbd');
}

function build(b: BatchLike, lod: 0 | 2) {
  const orange = SF.ggb, dark = SF.ggbDark, light = SF.ggbLight;
  const flat = () => DECK;
  // ---- deck: one swept section (roadway, barriers, sidewalks, railings, stiffening truss)
  const section: [number, number][] = lod === 0
    ? [[-1.7, 0], [1.7, 0], [1.7, 0.3], [1.85, 0.3], [1.85, 0.02], [2.55, 0.02], [2.55, 0.7], [RAIL, 0.7], [RAIL, -0.3], [2.6, -0.3], [2.6, -1.45],
       [-2.6, -1.45], [-2.6, -0.3], [-RAIL, -0.3], [-RAIL, 0.7], [-2.55, 0.7], [-2.55, 0.02], [-1.85, 0.02], [-1.85, 0.3], [-1.7, 0.3]]
    : [[-RAIL, 0.5], [RAIL, 0.5], [RAIL, -1.45], [-RAIL, -1.45]];
  const edgeCol = (i: number) => {
    if (lod === 2) return i === 0 ? SF.asphalt : i === 2 ? dark : orange;
    if (i === 0) return SF.asphalt;
    if (i === 4 || i === 16) return SF.concrete;
    if (i === 10) return dark;
    return orange;
  };
  sweepX(b, [END_S, END_N], flat, section, edgeCol);
  if (lod === 0) {
    // lane lines + Warren truss faces (alternating lit / shadowed triangles read as the lattice from afar)
    for (const z of [-0.57, 0.57]) box(b, (END_S + END_N) / 2, DECK, z, END_N - END_S, 0.015, 0.06, '#efe9dc');
    const P = 2.2;
    for (const zs of [-1, 1]) {
      const z = zs * 2.62, nrm = v(0, 0, zs);
      for (let s = END_S; s < END_N - P / 2; s += P) {
        const yb = DECK - 1.42, yt = DECK - 0.33;
        b.tri(v(s, yb, z), v(s + P, yb, z), v(s + P / 2, yt, z), light, NONE, nrm);
        b.tri(v(s + P / 2, yt, z), v(s + P, yb, z), v(Math.min(s + 1.5 * P, END_N), yt, z), '#6e2a1d', NONE, nrm);
      }
    }
  }
  // ---- towers
  tower(b, -TOWER, lod, true);
  tower(b, TOWER, lod, false);
  // ---- main cables (open tubes following the catenary-ish profile)
  const stations: number[] = [];
  const span = (a: number, c: number, n: number) => { for (let k = 0; k < n; k++) stations.push(a + ((c - a) * k) / n); };
  span(ANCH_S, -TOWER, lod === 0 ? 10 : 3);
  span(-TOWER, TOWER, lod === 0 ? 40 : 12);
  span(TOWER, ANCH_N, lod === 0 ? 8 : 3);
  stations.push(ANCH_N);
  for (const zs of [-1, 1]) {
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i], c = stations[i + 1];
      tube(b, v(a, cableY(a), zs * cableZ(a)), v(c, cableY(c), zs * cableZ(c)), lod === 0 ? 0.21 : 0.3, SF.ggbCable, NONE, lod === 0 ? 6 : 3);
    }
  }
  // ---- anchorages + art-deco pylons, Fort Point arch, approach piers, abutments
  for (const [anch, dir] of [[ANCH_S, -1], [ANCH_N, 1]] as [number, number][]) {
    const ground = dir < 0 ? 0.5 : 8.5;
    box(b, anch + dir * 1.5, ground - 3, 0, 12, DECK - 1.45 - ground + 3, 9, '#d8d0c1', GLOW(0.05));
    box(b, anch + dir * 1.5, DECK - 1.6, 0, 12.4, 0.3, 9.4, '#e6dfd2');
    for (const zs of [-1, 1]) pylon(b, anch, zs, ground, DECK + 3.2);
  }
  if (lod === 2) return;
  for (const [sx, ground] of [[S1, 1.5], [S2, 2.0], [N1, 9.8]] as [number, number][]) for (const zs of [-1, 1]) pylon(b, sx, zs, ground, DECK + 2.2);
  // Fort Point arch: two steel ribs spring from the pylon feet and meet the deck mid-way
  const mid = (S1 + S2) / 2, half = (S1 - S2) / 2 - 0.9;
  const archY = (s: number) => 1.6 + (DECK - 1.5 - 1.6) * (1 - ((s - mid) / half) ** 2);
  for (const zs of [-1, 1]) {
    const z = zs * 2.2;
    for (let k = 0; k < 8; k++) {
      const a = mid - half + (k * 2 * half) / 8, c = mid - half + ((k + 1) * 2 * half) / 8;
      tube(b, v(a, archY(a), z), v(c, archY(c), z), 0.32, orange, NONE, 4);
    }
    for (const o of [-4.2, -2.1, 2.1, 4.2]) tube(b, v(mid + o, archY(mid + o), z), v(mid + o, DECK - 1.45, z), 0.14, dark, NONE, 4);
  }
  // approach viaduct piers (steel bents) and the two abutments
  for (const s of [-172, -184, -196, -208, -220, 156, 168, 180]) {
    for (const zs of [-1, 1]) box(b, s, -1, zs * 1.9, 0.85, DECK - 1.45 + 1, 0.85, orange);
    box(b, s, DECK - 2.1, 0, 1.0, 0.65, 4.6, dark);
  }
  for (const [s, dir] of [[END_S, 1], [END_N, -1]] as [number, number][]) box(b, s + dir * 1.4, -1.5, 0, 2.8, DECK - 1.45 + 1.5, 6, '#cbbfa8');
  // ---- suspenders (vertical ropes, deck edge → cable)
  for (const [from, to] of [[-TOWER + 2.4, TOWER - 2.4], [S1 + 0.6, -TOWER - 2.4], [TOWER + 2.4, N1 - 0.6]] as [number, number][]) {
    const n = Math.round((to - from) / 3.0);
    for (let k = 0; k <= n; k++) {
      const s = from + ((to - from) * k) / n;
      const yc = cableY(s) - 0.12;
      if (yc - (DECK + 0.7) < 0.25) continue;
      for (const zs of [-1, 1]) tube(b, v(s, DECK + 0.7, zs * CZ), v(s, yc, zs * CZ), 0.045, dark, NONE, 3);
    }
  }
  // ---- deck lamps (sodium glow at night) every 15 u on both railings
  for (let s = END_S + 6; s < END_N - 3; s += 15) {
    if (Math.abs(Math.abs(s) - TOWER) < 3) continue;
    for (const zs of [-1, 1]) {
      tube(b, v(s, DECK + 0.7, zs * 2.6), v(s, DECK + 2.1, zs * 2.6), 0.05, orange, NONE, 3);
      cbox(b, s, DECK + 2.15, zs * 2.45, 0.3, 0.2, 0.5, '#ffcf8a', GLOW(1));
    }
  }
}

// ---------------------------------------------------------------------------
// walk: deck surfaces, tower-leg blockers and railings (local)
// ---------------------------------------------------------------------------

function walk(): NonNullable<SfLandmark['walk']> {
  const blockers: WalkBlocker[] = [];
  const surfaces: WalkSurface[] = [];
  const mid = (END_S + END_N) / 2, len = END_N - END_S;
  surfaces.push({ poly: rect(mid, 0, len, 3.7), y: DECK, surface: 'road' });
  for (const zs of [-1, 1]) surfaces.push({ poly: rect(mid, zs * 2.2, len, 0.9), y: DECK + 0.02, surface: 'pavement' });
  for (const sx of [-TOWER, TOWER]) {
    for (const zs of [-1, 1]) {
      blockers.push({ poly: rect(sx, zs * CZ, 2.4, 1.4) });
      surfaces.push({ poly: rect(sx, zs * 3.55, 3.6, 1.5), y: DECK, surface: 'pavement' });
      blockers.push({ poly: rect(sx, zs * 4.37, 3.8, 0.16) });
    }
  }
  // railings with gaps where the sidewalk steps out onto the tower balconies
  const cuts = [END_S, -TOWER - 1.8, -TOWER + 1.8, TOWER - 1.8, TOWER + 1.8, END_N];
  for (const zs of [-1, 1]) {
    // (their tops are the balustrade's: the cables above them are the tall parts' business, see tall())
    for (let i = 0; i < cuts.length; i += 2) blockers.push({ poly: rect((cuts[i] + cuts[i + 1]) / 2, zs * (RAIL + 0.05), cuts[i + 1] - cuts[i], 0.16), top: DECK + 0.8 });
  }
  return { blockers, surfaces };
}

/**
 * Glide obstacles (D2-10): the four tower legs, and the main cables as a row of circles on the deck axis every 5 u from
 * anchorage to anchorage, each wide enough for both cable planes (their tops come from the drawn cables: 42.2 u at
 * the saddles, ≈ 16.3 u at mid-span), so the pelican climbs over the cables instead of through them.
 */
function tall(): LandmarkTallPart[] {
  const out: LandmarkTallPart[] = [];
  for (const sx of [-TOWER, TOWER]) for (const zs of [-1, 1]) out.push({ x: sx, z: zs * CZ, r: 1.4 });
  const n = Math.ceil((ANCH_N - ANCH_S) / 5);
  for (let i = 0; i <= n; i++) {
    const s = ANCH_S + ((ANCH_N - ANCH_S) * i) / n;
    out.push({ x: Math.round(s * 100) / 100, z: 0, r: Math.round((cableZ(s) + 0.45) * 100) / 100 });
  }
  return out;
}

const EXCLUDE: Vec2[] = worldPoly(X0, Z0, YAW, [{ x: END_S - 3, z: -5.5 }, { x: END_N + 3, z: -5.5 }, { x: END_N + 3, z: 5.5 }, { x: END_S - 3, z: 5.5 }]);

export const goldenGateBridge: SfLandmark = {
  id: 'golden-gate-bridge',
  tier: 1,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 0,
  exclude: { poly: EXCLUDE },
  castShadow: true,
  build,
  walk: walk(),
  tall: tall(),
};

/** exported for tests / other lanes: deck height, tower stations and the south anchorage (local x) */
export const GGB = { DECK, TOWER, TOP, ANCH_S, ANCH_N, END_S, END_N, cableY };
