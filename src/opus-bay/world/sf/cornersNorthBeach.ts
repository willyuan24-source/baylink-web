import * as THREE from 'three';
import type { Obstacle } from '../../actors/controller';
import { registerObstacleSource } from '../../actors/view';
import { heightAt } from '../../core/terrain';
import type { Vec2 } from '../../core/types';
import { DISTRICT } from '../../data/district';
import { CONE, CYL, type BatchLike, ICO, M } from '../builder';
import { TOY } from '../materials';
import { TypedBatch } from '../typedBatch';
import type { WorldSystem } from '../world';
import { CK, cafeTable, sitter } from './landmarks/cornerKit';
import { GLOW, NONE, arch, cbox, cyl, disc } from './landmarks/kit';
import { NB_CHURCH_SETBACK, NB_FRONT, NB_SQUARE } from './cornersNB';
import { SEAM_FILL } from './cornersSeamData';
import { SignBatch, signsMaterial } from './signsAtlas';

/**
 * Wave 6 · lane W · the North Beach corner (W6-W2; plan sf-w6-lead §3 row W, NEXT #15's second half), on the seam the
 * W6-W1 fill closed (world/sf/cornersSeamData.ts): what a walker sees round Washington Square, city mode only.
 *
 *   the square   Washington Square's lawn (the 1958 Halprin / Baylis design: an open lawn in the middle, trees and
 *                benches round the edge), Benjamin Franklin's statue in the middle of the lawn with its six Lombardy
 *                poplars
 *   the church   Saints Peter and Paul's white twin towers (191 ft ≈ 58 m → the city's height rule 12.2 u) and front on
 *                Filbert St facing the square: the rose window, the gold mosaic band over the doors, three doors, the
 *                steps; the nave is the fill's own building (set back NB_CHURCH_SETBACK, its collision included)
 *   Columbus     café tables with umbrellas (green, white, red) in front of the fill's buildings on Columbus Ave, people
 *                at them, painted plaques (Café, Bakery, Books: trade words only), light poles in the Italian flag's
 *                colours, and strings of bulbs over the tables that glow at night
 *
 * Cost: ONE mesh of TOY (no new program) and ONE of the signs atlas ('v-signs'), in a THREE.LOD drawn within NB_CULL u
 * of the camera, built the first time the camera comes within NB_BUILD u; no shadows cast. Soft obstacles
 * (actors/view registerObstacleSource) for the statue, the poplars, the trees' trunks, the tables and the poles.
 *
 * Facts (checked on the web 2026-09-29):
 *   - the church's twin spires are 191 ft; 666 Filbert St, facing Washington Square; completed 1924 —
 *     https://www.gpsmycity.com/attractions/saints-peter-and-paul-church-6824.html ; the parish's own history
 *     https://www.salesiansspp.org/our-history (the attraction's source); a mosaic line from Dante's Paradiso on the
 *     front — https://www.oreilly.com/library/view/photographing-san-francisco/9780470586846/ch23.html
 *   - Washington Square: one of the city's first parks (1849), 2.8 acres; the 1958 Halprin / Baylis design opened the
 *     middle as lawn with curving paths lined with trees and benches round the edge; Franklin's statue (Cogswell's
 *     temperance fountain, here since 1904) in the middle of the lawn with six Lombardy poplars —
 *     https://www.tclf.org/landscapes/washington-square-ca , https://en.wikipedia.org/wiki/Washington_Square_(San_Francisco)
 *   - light poles painted in the Italian flag's colours (the 1990s "Little Italy of the West" campaign) —
 *     https://www.kqed.org/news/12074121/ciao-bella-do-italians-still-live-in-san-franciscos-north-beach
 *   - Columbus Ave's sidewalk café tables and string lights in the evening —
 *     https://lucky-tuk-tuk.com/attractions/little-italy-and-north-beach/ , https://www.thebolditalic.com/my-favorite-places-to-eat-outside-in-san-franciscos-north-beach-and-nearby/
 */

/** the corner's meshes are drawn within this many u of the camera (from the square's middle) */
export const NB_CULL = 190;
/** built the first time the camera comes this close */
export const NB_BUILD = 260;
/**
 * the corner's budget (the 9 corners of wave 5 keep 2 calls / 2.5k; this one carries the church's towers and the lawn;
 * W7-W1: 9k, the fill's buildings on the Sentinel's block give Columbus Ave one more café front)
 */
export const NB_BUDGET = { calls: 2, triangles: 9000 } as const;

/**
 * Columbus Ave's centreline through the slab (OSM ways 148874364, 148874363, 254756518, 48211487, 87376669,
 * 30030101, 416878315, 254971056 — both carriageways averaged where it splits), west → east, world x, z.
 */
export const NB_COLUMBUS: readonly Vec2[] = [
  { x: -108.6, z: 115.9 }, { x: -90.9, z: 113.9 }, { x: -78, z: 112.8 }, { x: -64.3, z: 111.6 }, { x: -47.1, z: 110.9 },
  { x: -39.1, z: 110.0 }, { x: -26.9, z: 108.9 }, { x: -13.6, z: 107.8 }, { x: -7.0, z: 106.7 }, { x: 0.9, z: 106.5 },
  { x: 11.3, z: 105.6 }, { x: 29.3, z: 104.0 },
];

const LAWN = '#86b35f', LAWN2 = '#7aa857', TRUNK = '#6b5140', LEAF = '#5f8f4e', POPLAR = '#4f7d42', WHITE = '#f4f1ea', STONE = '#d9d3c6';
const BRONZE = '#5f6d5f', GOLD = '#d9b24c', ROSE = '#2d4f7a', DOOR = '#3b2f2a';
const ITALY = ['#2f8f4e', '#f4f1ea', '#c9473a'] as const;
const BULB = '#ffe7a8';

function inRing(x: number, z: number, p: readonly Vec2[]) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c; }
  return c;
}
function segD(x: number, z: number, a: Vec2, b: Vec2) {
  const dx = b.x - a.x, dz = b.z - a.z, l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l)) : 0;
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}
function ringDist(x: number, z: number, p: readonly Vec2[]) {
  let d = Infinity;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) d = Math.min(d, segD(x, z, p[j], p[i]));
  return d;
}
const RINGS = SEAM_FILL.map(r => { const o: Vec2[] = []; for (let k = 0; k < r[7].length; k += 2) o.push({ x: r[7][k], z: r[7][k + 1] }); return o; });
/** inside one of the fill's buildings */
export function inFill(x: number, z: number, pad = 0): boolean {
  return RINGS.some(r => inRing(x, z, r) || (pad > 0 && ringDist(x, z, r) < pad));
}

/** the square's middle (the statue) */
export const NB_CENTER: Vec2 = (() => {
  let x = 0, z = 0;
  for (const p of NB_SQUARE) { x += p.x / NB_SQUARE.length; z += p.z / NB_SQUARE.length; }
  return { x: x + 0.4, z: z + 0.3 };
})();

/** One café cluster on Columbus: its middle on the sidewalk, the wall behind it, facing the street (yaw). */
export interface NbCafe { x: number; z: number; ry: number; face: Vec2; sign: 'cafe' | 'bakery' | 'books-en' }

/**
 * The café clusters: every 7 u along Columbus (both sides), a fill building's front found 1.9–3.6 u from the
 * centreline (the city carves its footprints 2.2 u off a secondary street's centreline); the tables stand 0.75 u in
 * front of it, never inside the square. Deterministic (the tests read it).
 */
export function nbCafes(): NbCafe[] {
  const out: NbCafe[] = [];
  const signs = ['cafe', 'cafe', 'bakery', 'cafe', 'books-en'] as const;
  for (let i = 1; i < NB_COLUMBUS.length; i++) {
    const a = NB_COLUMBUS[i - 1], b = NB_COLUMBUS[i], L = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
    for (let s = 3; s < L - 2; s += 7) {
      const cx = a.x + ux * s, cz = a.z + uz * s;
      for (const side of [-1, 1]) {
        const nx = -uz * side, nz = ux * side;
        let hit = -1;
        for (let d = 1.9; d <= 3.6; d += 0.1) if (inFill(cx + nx * d, cz + nz * d)) { hit = d; break; }
        if (hit < 0) continue;
        const d = hit - 0.75, x = cx + nx * d, z = cz + nz * d;
        if (inRing(x, z, NB_SQUARE) || ringDist(x, z, NB_SQUARE) < 1 || inFill(x, z, 0.5)) continue;
        if (out.some(c => Math.hypot(c.x - x, c.z - z) < 5)) continue;
        out.push({ x, z, ry: Math.atan2(-nx, -nz), face: { x: cx + nx * (hit - 0.02), z: cz + nz * (hit - 0.02) }, sign: signs[out.length % signs.length] });
      }
    }
  }
  return out;
}

/** the church frame: u along the front from A (the Columbus / Powell end) to B, d outward toward the square */
const FU = (() => { const dx = NB_FRONT.b.x - NB_FRONT.a.x, dz = NB_FRONT.b.z - NB_FRONT.a.z, L = Math.hypot(dx, dz); return { x: dx / L, z: dz / L, L }; })();
const churchAt = (u: number, d: number): Vec2 => ({ x: NB_FRONT.a.x + FU.x * u + NB_FRONT.n.x * d, z: NB_FRONT.a.z + FU.z * u + NB_FRONT.n.z * d });
/** yaw whose local +z is the front's outward normal (local +x runs along the front, A → B) */
const CHURCH_RY = Math.atan2(NB_FRONT.n.x, NB_FRONT.n.z);
/** toy height of the spires' tips over the ground: core/geo buildingH(58 m) = 3.2 + 0.155 · 58 */
export const NB_SPIRE_TOP = 12.2;
/** the two towers' middles (world) and their half side */
export const NB_TOWERS: readonly Vec2[] = [churchAt(0.62, -NB_CHURCH_SETBACK - 0.45), churchAt(FU.L - 0.62, -NB_CHURCH_SETBACK - 0.45)];
const TOWER_W = 1.2;

function church(b: BatchLike) {
  const y0 = heightAt(churchAt(FU.L / 2, -NB_CHURCH_SETBACK).x, churchAt(FU.L / 2, -NB_CHURCH_SETBACK).z);
  // the twin towers: a shaft, a cornice, the belfry with its arches, an octagonal drum and the spire
  for (const t of NB_TOWERS) {
    cbox(b, t.x, y0 + 4.2, t.z, TOWER_W, 8.4, TOWER_W, WHITE, NONE, CHURCH_RY);
    cbox(b, t.x, y0 + 8.5, t.z, TOWER_W + 0.14, 0.2, TOWER_W + 0.14, STONE, NONE, CHURCH_RY);
    cbox(b, t.x, y0 + 9.3, t.z, TOWER_W - 0.2, 1.4, TOWER_W - 0.2, WHITE, NONE, CHURCH_RY);
    for (let k = 0; k < 4; k++) {
      const ry = CHURCH_RY + (k * Math.PI) / 2, fx = Math.sin(ry), fz = Math.cos(ry), o = (TOWER_W - 0.2) / 2 + 0.01;
      arch(b, t.x + fx * o, y0 + 8.75, t.z + fz * o, 0.42, 1.0, ry, '#4a4a52');
    }
    cbox(b, t.x, y0 + 10.05, t.z, TOWER_W, 0.12, TOWER_W, STONE, NONE, CHURCH_RY);
    cyl(b, t.x, y0 + 10.1, t.z, 0.44, 0.55, WHITE, NONE, 8);
    b.add(CONE(8), M(t.x, y0 + 10.65, t.z, 0, 0.42, NB_SPIRE_TOP - 10.65 - 0.25, 0.42), WHITE);
    cyl(b, t.x, y0 + NB_SPIRE_TOP - 0.28, t.z, 0.03, 0.3, GOLD, NONE, 4);
    cbox(b, t.x, y0 + NB_SPIRE_TOP - 0.12, t.z, 0.2, 0.04, 0.04, GOLD, NONE, CHURCH_RY);
  }
  // the front between the towers: a white wall with a gable, the rose window, the gold mosaic band, three doors
  const mid = churchAt(FU.L / 2, -NB_CHURCH_SETBACK + 0.1), wf = FU.L - 2 * TOWER_W + 0.1;
  cbox(b, mid.x, y0 + 3.4, mid.z, wf, 6.8, 0.2, WHITE, NONE, CHURCH_RY);
  const fx = NB_FRONT.n.x, fz = NB_FRONT.n.z, ux = FU.x, uz = FU.z;
  const P = (u: number, y: number) => new THREE.Vector3(mid.x + ux * u + fx * 0.1, y0 + y, mid.z + uz * u + fz * 0.1);
  b.tri(P(-wf / 2, 6.8), P(wf / 2, 6.8), P(0, 8.0), WHITE, NONE, new THREE.Vector3(fx, 0, fz));
  const f = (u: number, y: number, d = 0.12) => ({ x: mid.x + ux * u + fx * d, y: y0 + y, z: mid.z + uz * u + fz * d });
  const rose = f(0, 5.3);
  disc(b, rose.x, rose.y, rose.z, 0.62, 0.05, CHURCH_RY, GOLD);
  disc(b, rose.x + fx * 0.03, rose.y, rose.z + fz * 0.03, 0.5, 0.05, CHURCH_RY, ROSE, GLOW(0.5));
  const band = f(0, 3.55);
  cbox(b, band.x, band.y, band.z, wf - 0.2, 0.28, 0.04, GOLD, NONE, CHURCH_RY);
  for (const [u, w, h] of [[-0.62, 0.42, 1.25], [0, 0.55, 1.6], [0.62, 0.42, 1.25]] as const) {
    const d = f(u, 0.12, 0.13);
    arch(b, d.x, d.y, d.z, w, h, CHURCH_RY, DOOR);
  }
  // the steps across the front
  for (const [d0, h] of [[-0.5, 0.1], [-0.95, 0.2]] as const) {
    const s = churchAt(FU.L / 2, -NB_CHURCH_SETBACK + 0.2 + d0 + 0.45);
    cbox(b, s.x, y0 + h / 2 - 0.02, s.z, FU.L - 0.3, h, 0.45, STONE, NONE, CHURCH_RY);
  }
}

function lawn(b: BatchLike) {
  const S = 1.0, up = new THREE.Vector3(0, 1, 0);
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of NB_SQUARE) { x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); z1 = Math.max(z1, p.z); }
  const y = (x: number, z: number) => heightAt(x, z) + 0.06;
  for (let z = z0; z < z1; z += S) for (let x = x0; x < x1; x += S) {
    const cx = x + S / 2, cz = z + S / 2;
    if (!inRing(cx, cz, NB_SQUARE) || ringDist(cx, cz, NB_SQUARE) < 1.1) continue;
    const V = (px: number, pz: number) => new THREE.Vector3(px, y(px, pz), pz);
    const tone = ((Math.floor(x / S) + Math.floor(z / S)) & 1) ? LAWN : LAWN2;
    b.quad(V(x, z + S), V(x + S, z + S), V(x + S, z), V(x, z), up, tone);
  }
}

/** points round the square `inset` u inside its edge, every `every` u (the trees, the benches) */
function edgeRing(inset: number, every: number, phase = 0): Vec2[] {
  const out: Vec2[] = [];
  const n = NB_SQUARE.length;
  let carry = phase;
  for (let i = 0; i < n; i++) {
    const a = NB_SQUARE[i], b = NB_SQUARE[(i + 1) % n], L = Math.hypot(b.x - a.x, b.z - a.z);
    for (let s = carry; s < L; s += every) {
      const t = s / L, px = a.x + (b.x - a.x) * t, pz = a.z + (b.z - a.z) * t;
      const dx = NB_CENTER.x - px, dz = NB_CENTER.z - pz, dl = Math.hypot(dx, dz);
      const q = { x: px + (dx / dl) * inset, z: pz + (dz / dl) * inset };
      if (inRing(q.x, q.z, NB_SQUARE) && ringDist(q.x, q.z, NB_SQUARE) > inset * 0.6) out.push(q);
      carry = s + every - L;
    }
    if (carry < 0) carry = 0;
  }
  return out;
}

/** the square's trees, benches, the statue and its poplars (world positions; tests and soft obstacles read them) */
export function nbSquareProps(): { trees: Vec2[]; benches: { x: number; z: number; ry: number }[]; poplars: Vec2[]; statue: Vec2 } {
  const trees = edgeRing(1.5, 3.6);
  const benches = edgeRing(1.05, 6.5, 1.8).map(p => ({ ...p, ry: Math.atan2(NB_CENTER.x - p.x, NB_CENTER.z - p.z) }))
    .filter(p => trees.every(t => Math.hypot(t.x - p.x, t.z - p.z) > 0.7));
  const poplars: Vec2[] = [];
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; poplars.push({ x: NB_CENTER.x + Math.cos(a) * 1.6, z: NB_CENTER.z + Math.sin(a) * 1.6 }); }
  return { trees, benches, poplars, statue: NB_CENTER };
}

function square(b: BatchLike) {
  const { trees, benches, poplars, statue } = nbSquareProps();
  for (const t of trees) {
    const y = heightAt(t.x, t.z);
    cyl(b, t.x, y, t.z, 0.09, 1.2, TRUNK, NONE, 5);
    b.add(ICO(0), M(t.x, y + 1.85, t.z, t.x, 0.95, 0.85, 0.95), LEAF, [0, 0, 0.12, 0]);
  }
  for (const p of poplars) {
    const y = heightAt(p.x, p.z);
    cyl(b, p.x, y, p.z, 0.06, 0.5, TRUNK, NONE, 4);
    b.add(CONE(6), M(p.x, y + 0.4, p.z, 0, 0.32, 2.8, 0.32), POPLAR, [0, 0, 0.08, 0]);
  }
  for (const s of benches) {
    const y = heightAt(s.x, s.z), c = Math.cos(s.ry), n = Math.sin(s.ry);
    cbox(b, s.x, y + 0.3, s.z, 1.0, 0.07, 0.34, '#8a6a4a', NONE, s.ry);
    cbox(b, s.x - n * 0.16, y + 0.52, s.z - c * 0.16, 1.0, 0.3, 0.05, '#8a6a4a', NONE, s.ry);
    for (const u of [-0.42, 0.42]) cbox(b, s.x + c * u, y + 0.14, s.z - n * u, 0.05, 0.28, 0.3, CK.iron, NONE, s.ry);
  }
  // Benjamin Franklin on his granite pedestal (Cogswell's temperance fountain)
  const y = heightAt(statue.x, statue.z);
  cbox(b, statue.x, y + 0.12, statue.z, 1.1, 0.24, 1.1, STONE);
  cbox(b, statue.x, y + 0.75, statue.z, 0.62, 1.1, 0.62, '#c9c2b4');
  cyl(b, statue.x, y + 1.3, statue.z, 0.2, 0.62, BRONZE, NONE, 6);
  b.add(ICO(0), M(statue.x, y + 2.05, statue.z, 0, 0.13, 0.15, 0.13), BRONZE);
}

/** a light pole painted green, white and red (bands), a lantern that glows at night */
function flagPole(b: BatchLike, x: number, y: number, z: number) {
  cyl(b, x, y, z, 0.09, 0.35, '#2f3d3a', NONE, 6);
  for (let k = 0; k < 3; k++) cyl(b, x, y + 0.35 + k * 0.62, z, 0.055, 0.62, ITALY[k], NONE, 6);
  cyl(b, x, y + 2.21, z, 0.05, 0.9, '#2f3d3a', NONE, 5);
  b.add(CYL(6, 0.7), M(x, y + 3.1, z, 0, 0.19, 0.42, 0.19), '#fff1c9', GLOW(1.2));
  b.add(CONE(6), M(x, y + 3.5, z, 0, 0.25, 0.25, 0.25), '#2f3d3a');
}

/**
 * W8-W1: Columbus Ave's carriageway inside the hero slab. The district has no Columbus (its ground along the band is
 * pavement, sf-w6-W.md Known gaps), so the street the café fronts line read as a plaza: a toy asphalt ribbon on
 * NB_COLUMBUS, draped on the walked ground, with a dashed centre line, only inside the slab (outside it the city draws
 * Columbus Ave itself) and never on Washington Square's lawn. Half-width 1.05 u: the café tables (≥ 1.15 u off the
 * centreline at their nearest edge) and the poles (≥ 1.55 u) stay on the sidewalk. Paint only: walking and driving
 * are unchanged (the district's own streets cross it).
 */
export const NB_ROAD = { half: 1.05, lift: 0.04, step: 1, color: '#a29d96', dash: '#ece6d8', dashEvery: 2.4, dashLen: 0.9 } as const;

/** the hero slab's outline (data/district.ts DISTRICT.slab: the city draws Columbus Ave outside it) */
const SLAB: readonly Vec2[] = DISTRICT.slab;

/** One sample of the ribbon: the centreline point, its left normal (nx, nz) and the half-widths to the left (`l`, +n) and right (`r`). */
export interface NbRoadSample { x: number; z: number; nx: number; nz: number; l: number; r: number }

/**
 * The ribbon's runs (consecutive samples every NB_ROAD.step u) inside the slab; where Columbus cuts Washington Square's
 * corner the side by the lawn narrows (to ≥ 0.45 u) so the asphalt never covers the lawn, and where it runs along the
 * slab's edge the outer side narrows to the edge (the city draws the rest of the street outside the slab).
 */
export function nbColumbusRoad(): NbRoadSample[][] {
  const runs: NbRoadSample[][] = [];
  let run: NbRoadSample[] = [];
  const h = NB_ROAD.half;
  for (let i = 1; i < NB_COLUMBUS.length; i++) {
    const a = NB_COLUMBUS[i - 1], b = NB_COLUMBUS[i], L = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
    const n = Math.max(1, Math.round(L / NB_ROAD.step));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const x = a.x + ux * (L * k / n), z = a.z + uz * (L * k / n), nx = -uz, nz = ux;
      const lawn = (px: number, pz: number) => inRing(px, pz, NB_SQUARE) || ringDist(px, pz, NB_SQUARE) <= 0.1;
      // a side narrows by the lawn (to ≥ 0.45 u) and at the slab's edge (to ≥ 0: where Columbus runs along the edge the
      // city draws its outer half, this ribbon the inner one)
      const out = (px: number, pz: number) => !inRing(px, pz, SLAB);
      const side = (s: number) => {
        let w: number = h;
        while (w > 0 && out(x + nx * w * s, z + nz * w * s)) w = Math.max(0, w - 0.05);
        while (w >= 0.45 && lawn(x + nx * w * s, z + nz * w * s)) w -= 0.05;
        return w;
      };
      const l = side(1), r = side(-1);
      const ok = !out(x, z) && !lawn(x, z) && l + r >= 0.9 && !lawn(x + nx * l, z + nz * l) && !lawn(x - nx * r, z - nz * r);
      if (ok) run.push({ x, z, nx, nz, l, r });
      else if (run.length) { if (run.length > 1) runs.push(run); run = []; }
    }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

function columbusRoad(b: BatchLike) {
  const { lift } = NB_ROAD, up = new THREE.Vector3(0, 1, 0);
  const P = (s: NbRoadSample, off: number, y: number = lift) => { const x = s.x + s.nx * off, z = s.z + s.nz * off; return new THREE.Vector3(x, heightAt(x, z) + y, z); };
  for (const run of nbColumbusRoad()) {
    let along = 0;
    for (let i = 1; i < run.length; i++) {
      const a = run[i - 1], c = run[i], seg = Math.hypot(c.x - a.x, c.z - a.z);
      b.quad(P(a, -a.r), P(c, -c.r), P(c, c.l), P(a, a.l), up, NB_ROAD.color, NONE);
      // the dashed centre line: a dash wherever this segment covers the start of one
      const s0 = along, s1 = along + seg;
      for (let d = Math.ceil(s0 / NB_ROAD.dashEvery) * NB_ROAD.dashEvery; d < s1; d += NB_ROAD.dashEvery) {
        const t0 = (d - s0) / seg, t1 = Math.min(1, (d + NB_ROAD.dashLen - s0) / seg);
        const m0 = { ...a, x: a.x + (c.x - a.x) * t0, z: a.z + (c.z - a.z) * t0 }, m1 = { ...a, x: a.x + (c.x - a.x) * t1, z: a.z + (c.z - a.z) * t1 };
        b.quad(P(m0, -0.05, lift + 0.01), P(m1, -0.05, lift + 0.01), P(m1, 0.05, lift + 0.01), P(m0, 0.05, lift + 0.01), up, NB_ROAD.dash, NONE);
      }
      along = s1;
    }
  }
}

/** the flag poles along Columbus: every 9 u on either side, 0.35 u off a fill front, never at a café */
export function nbPoles(cafes: readonly NbCafe[]): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 1; i < NB_COLUMBUS.length; i++) {
    const a = NB_COLUMBUS[i - 1], b = NB_COLUMBUS[i], L = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
    for (let s = 6.5; s < L - 1; s += 9) {
      for (const side of [-1, 1]) {
        const nx = -uz * side, nz = ux * side, cx = a.x + ux * s, cz = a.z + uz * s;
        let hit = -1;
        for (let d = 1.9; d <= 3.6; d += 0.1) if (inFill(cx + nx * d, cz + nz * d)) { hit = d; break; }
        if (hit < 0) continue;
        const p = { x: cx + nx * (hit - 0.35), z: cz + nz * (hit - 0.35) };
        if (cafes.some(c => Math.hypot(c.x - p.x, c.z - p.z) < 2.6) || out.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 5)) continue;
        out.push(p);
      }
    }
  }
  return out;
}

function columbus(b: BatchLike, sb: SignBatch | null, cafes: readonly NbCafe[]) {
  const tops = ['#2f6f4a', '#9a3b32', '#2f6f4a'];
  cafes.forEach((c, i) => {
    const y = heightAt(c.x, c.z), ax = Math.cos(c.ry), az = -Math.sin(c.ry); // along the front
    for (const u of i % 2 === 0 ? [-0.85, 0.85] : [0]) {
      const tx = c.x + ax * u, tz = c.z + az * u;
      cafeTable(b, tx, y, tz, c.ry + Math.PI / 2, tops[(i + (u > 0 ? 1 : 0)) % tops.length]);
      // the umbrella over the table: a pole and a canopy in the flag's colours
      cyl(b, tx, y + 0.6, tz, 0.025, 1.35, CK.pole, NONE, 4);
      b.add(CONE(8), M(tx, y + 1.72, tz, 0.4, 0.78, 0.34, 0.78), ITALY[(i + (u > 0 ? 2 : 0)) % 3], [0, 0, 0.06, 0]);
    }
    // someone at a table
    const su = i % 2 === 0 ? -0.85 : 0;
    sitter(b, c.x + ax * (su - 0.45), y, c.z + az * (su - 0.45), c.ry + Math.PI / 2, i);
    // a string of bulbs along the front over the tables, from the wall at 2.5 u
    const fx = Math.sin(c.ry), fz = Math.cos(c.ry), w0 = { x: c.face.x - fx * 0.05, z: c.face.z - fz * 0.05 };
    const A = new THREE.Vector3(w0.x - ax * 2, y + 2.5, w0.z - az * 2), B = new THREE.Vector3(w0.x + ax * 2, y + 2.5, w0.z + az * 2);
    const n = 7;
    for (let k = 0; k <= n; k++) {
      const t = k / n, sag = 0.35 * 4 * t * (1 - t), out = 0.55 * 4 * t * (1 - t);
      const p = new THREE.Vector3(A.x + (B.x - A.x) * t + fx * out, A.y - sag, A.z + (B.z - A.z) * t + fz * out);
      if (k > 0) {
        const t0 = (k - 1) / n, s0 = 0.35 * 4 * t0 * (1 - t0), o0 = 0.55 * 4 * t0 * (1 - t0);
        b.beam(new THREE.Vector3(A.x + (B.x - A.x) * t0 + fx * o0, A.y - s0, A.z + (B.z - A.z) * t0 + fz * o0), p, 0.02, 0.02, '#3a3431');
      }
      if (k > 0 && k < n) cbox(b, p.x, p.y - 0.07, p.z, 0.08, 0.1, 0.08, BULB, GLOW(1.4));
    }
    // the plaque on the wall over the tables
    sb?.plaque(c.sign, c.face.x - fx * 0.02, y + 1.95, c.face.z - fz * 0.02, c.ry, 1.0);
  });
  for (const p of nbPoles(cafes)) flagPole(b, p.x, heightAt(p.x, p.z), p.z);
}

/** The corner's two meshes (world coordinates); triangles for the budget test. */
export function buildNorthBeach(): { toy: THREE.Mesh; signs: THREE.Mesh | null; triangles: number; cafes: NbCafe[] } {
  const b = new TypedBatch(8192), sb = new SignBatch(), cafes = nbCafes();
  lawn(b);
  square(b);
  church(b);
  columbusRoad(b);
  columbus(b, sb, cafes);
  const a = b.toArrays();
  const toy = new THREE.Mesh(TypedBatch.toGeometry(a), TOY);
  toy.name = 'sf:north-beach:corner-toy';
  let signs: THREE.Mesh | null = null;
  if (sb.count) { signs = new THREE.Mesh(sb.build(), signsMaterial()); signs.name = 'sf:north-beach:corner-signs'; }
  for (const m of [toy, signs]) if (m) { m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false; }
  return { toy, signs, triangles: a.indexCount / 3 + sb.count * 2, cafes };
}

/** the corner's soft obstacles (world): the statue, the poplars, the trunks, the café clusters, the poles */
export function nbObstacles(cafes: readonly NbCafe[]): Obstacle[] {
  const { trees, poplars, statue } = nbSquareProps();
  return [
    { x: statue.x, z: statue.z, r: 0.6, kind: 'static' },
    ...poplars.map(p => ({ x: p.x, z: p.z, r: 0.3, kind: 'static' })),
    ...trees.map(p => ({ x: p.x, z: p.z, r: 0.2, kind: 'static' })),
    ...cafes.flatMap((c, i) => (i % 2 === 0 ? [-0.85, 0.85] : [0]).map(u => ({ x: c.x + Math.cos(c.ry) * u, z: c.z - Math.sin(c.ry) * u, r: 0.55, kind: 'static' }))),
    ...nbPoles(cafes).map(p => ({ x: p.x, z: p.z, r: 0.12, kind: 'static' })),
  ];
}

/** City mode: the North Beach corner as a world system (world/sf/cityWorld.ts adds it). */
export function attachNorthBeach(): WorldSystem {
  const group = new THREE.Group();
  group.name = 'sf:north-beach';
  const lod = new THREE.LOD();
  lod.position.set(NB_CENTER.x, 0, NB_CENTER.z);
  const near = new THREE.Group();
  near.position.set(-NB_CENTER.x, 0, -NB_CENTER.z);
  lod.addLevel(near, 0);
  lod.addLevel(new THREE.Object3D(), NB_CULL);
  group.add(lod);
  let built: ReturnType<typeof buildNorthBeach> | null = null;
  let soft: Obstacle[] = [];
  const offSoft = registerObstacleSource((out, x, z, r) => {
    for (const o of soft) { const d = r + o.r; if ((o.x - x) ** 2 + (o.z - z) ** 2 <= d * d) out.push(o); }
  });
  return {
    name: 'north-beach-corner',
    group,
    update(_dt, _t, camera) {
      if (built) return;
      const c = camera.position;
      if ((c.x - NB_CENTER.x) ** 2 + (c.z - NB_CENTER.z) ** 2 > NB_BUILD * NB_BUILD) return;
      built = buildNorthBeach();
      for (const m of [built.toy, built.signs]) if (m) { m.updateMatrix(); near.add(m); }
      soft = nbObstacles(built.cafes);
      group.updateMatrixWorld(true);
    },
    dispose() {
      offSoft();
      built?.toy.geometry.dispose();
      built?.signs?.geometry.dispose();
    },
  };
}
