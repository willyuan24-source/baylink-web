import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { GLOW, LIT, NONE, SF, box, cbox, gable, rect, worldPoly } from './kit';
import {
  FC, GC, PAT, type SiteGroundPoly, type W4Site, bench, bin, bollard, crosswalk, gfill, lamp, planter, plazaOf, siteGround, tree,
} from './siteKit';

/**
 * Stonestown Galleria (wave 4, P1 · map T1, the owner's request): the long two-storey mall between 20th Ave and
 * Buckingham Way that opened on 16 July 1952 as Stonestown Shopping Center and was enclosed as the Galleria in 1987.
 * Toy version: the cream concourse under one long gabled glass skylight with shop fronts and a covered walk, the north
 * wings, the glass east entrance atrium (OSM 1155126441 / 1155126445: a gabled glass roof at 23–26 m) with its canopy,
 * the second entrance pavilion (OSM 147001452), brick pilasters on the long back wall, and the paved 20th Ave forecourt
 * with trees, benches, lamps and a crosswalk to the parking fields and the M stop at 19th Ave & Winston (lane T builds
 * the platform). No store names, logos or sign text: the fascia bands are blank.
 *
 * The south anchor (OSM 147001451, 700445640) and the connector over Winston Dr (1154679769, min_height 4.2 m) stay
 * city buildings: Winston Dr's two carriageways run between them and the concourse from 20th Ave to the underpass,
 * and one exclusion polygon cannot leave that corridor open on both sides, so the site stops at the concourse's
 * south wall (x −11.4) and the street stays the city's.
 *
 * Frame: origin at the main block's centre (OSM way 1154799336), local +x runs north along the mall, local +z faces
 * east to 20th Ave (yaw 132.8° from the block's long edge). Footprints are the OSM ways in this frame. The ground rises
 * ≈ 2 u from the south-west corner (the base) to the main block, so every block stands on its own ground: OSM 21 m →
 * H 6.45 u over it (the concourse 5.6 u + the skylight ridge 1.4 u, the atrium's glass gable to 7.6 u).
 */

const ID = 'stonestown';
const X0 = 170.5, Z0 = 1484, YAW = (132.8 * Math.PI) / 180;
const g = siteGround(ID, 9.31);

const CREAM = '#efe3cf', CREAM_SHADE = '#e2d3b9', TRIM = '#f7f0e2', FASCIA = '#7d8a86', GLASS = '#b9d3d8', GLASS_DARK = '#8fb2b9';
const BRICK_LIGHT = SF.brickLight, ROOF = '#c9c2b4', DOOR = '#5d6b69';

interface Block { cx: number; cz: number; w: number; d: number; h: number }
/** local rectangles from the OSM ways; h = wall height over the block's own ground */
const MAIN: Block = { cx: 3.75, cz: -1.24, w: 26.3, d: 16.9, h: 5.6 };        // 1154799336 concourse (its south 2 u overhang Winston Dr's underpass: cut)
const NORTH_A: Block = { cx: 22.65, cz: 2.55, w: 11.5, d: 14.0, h: 5.0 };     // 35156778 (front pulled 0.6 u off 20th Ave's kerb)
const NORTH_B: Block = { cx: 30.75, cz: 6.4, w: 5.1, d: 6.4, h: 5.6 };        // 147000933 (pulled 0.7 u off Buckingham Way's and 20th Ave's kerbs)
const ATRIUM: Block = { cx: 1.4, cz: 8.2, w: 7.4, d: 3.2, h: 6.0 };           // 1155126441 glass entrance
const PAVILION: Block = { cx: -6.1, cz: 9.2, w: 6.6, d: 4.2, h: 4.4 };        // 147001452 entrance pavilion

/** ground under a block's centre (local y) */
const gy = (k: Block) => g.at(k.cx, k.cz);

/** the forecourt between the mall front (z 7.2) and 20th Ave's west kerb (z ≈ 15.8 near the atrium, 11.6 south) */
const COURT: Vec2[] = [{ x: -2.3, z: 7.3 }, { x: 16.9, z: 7.3 }, { x: 17.6, z: 9.6 }, { x: 17.6, z: 11.5 }, { x: 14.6, z: 15.4 }, { x: 1.2, z: 15.4 }, { x: -1.3, z: 13.4 }, { x: -2.5, z: 11.3 }];
const TREES: Vec2[] = [{ x: 11.0, z: 12.6 }, { x: 15.6, z: 10.4 }, { x: 0.9, z: 12.9 }, { x: 6.8, z: 14.2 }];
const LAMPS: Vec2[] = [{ x: -1.0, z: 11.4 }, { x: 4.6, z: 14.7 }, { x: 15.2, z: 12.9 }];
const BENCHES: [number, number, number][] = [[8.8, 10.9, Math.PI], [13.2, 10.9, Math.PI]];

/** a mall block: blank walls (malls turn their backs to the parking), a darker plinth band; returns its top (local y) */
function block(b: BatchLike, k: Block, wall: string, lod: 0 | 2) {
  const y0 = gy(k);
  box(b, k.cx, -1.2, k.cz, k.w, y0 + k.h + 1.2, k.d, wall, NONE);
  if (lod === 0) box(b, k.cx, -1.2, k.cz, k.w + 0.12, y0 + 1.8, k.d + 0.12, CREAM_SHADE, NONE);
  return y0 + k.h;
}

/** shop-front strip on a block's +z face: glazing with the TOY shop windows (lit at night), `h` tall from the ground */
function shopFront(b: BatchLike, k: Block, x0: number, x1: number, h: number, seed: number) {
  const y0 = g.at((x0 + x1) / 2, k.cz + k.d / 2 + 1);
  box(b, (x0 + x1) / 2, -1.2, k.cz + k.d / 2 + 0.06, x1 - x0, y0 + h + 1.2, 0.14, GLASS_DARK, [3, y0, -seed, 0]);
}

/** covered walk along a block's front: a flat roof on slim columns every ~3.2 u (Stonestown's 1952 open-air arcades) */
function arcade(b: BatchLike, k: Block, x0: number, x1: number, depth: number) {
  const zf = k.cz + k.d / 2, n = Math.max(2, Math.round((x1 - x0) / 3.2));
  const yr = gy(k) + 3.1;
  box(b, (x0 + x1) / 2, yr, zf + depth / 2, x1 - x0, 0.3, depth, TRIM);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = g.at(x, zf + depth - 0.2);
    box(b, x, y - 0.2, zf + depth - 0.25, 0.26, yr - y + 0.2, 0.26, TRIM);
  }
}

function concourse(b: BatchLike, lod: 0 | 2) {
  const top = block(b, MAIN, CREAM, lod);
  // the long skylight: a glass gable along the concourse on the roof deck
  gable(b, MAIN.cx, top, MAIN.cz, MAIN.w - 3, 5.2, 1.4, GLASS, GLASS_DARK, 0, 0.1, GLOW(0.25));
  if (lod === 2) return;
  box(b, MAIN.cx, top, MAIN.cz, MAIN.w + 0.3, 0.22, MAIN.d + 0.3, ROOF);
  box(b, MAIN.cx, top - 0.2, MAIN.cz, MAIN.w + 0.5, 0.2, MAIN.d + 0.5, TRIM);
  box(b, MAIN.cx - 7, top - 0.95, MAIN.cz + MAIN.d / 2 + 0.05, 12, 0.65, 0.12, FASCIA);        // blank fascia band (no sign text)
  // the front: shop glazing on both floors between the entrances, the covered walk in front of the ground floor
  shopFront(b, MAIN, 5.4, 16.6, 4.4, 4.2);
  arcade(b, MAIN, 5.6, 16.4, 2.0);
  // brick pilasters on the long back wall (Buckingham Way side)
  for (let i = 0; i < 7; i++) { const x = MAIN.cx - 12 + i * 4, y = g.at(x, MAIN.cz - MAIN.d / 2 - 1); box(b, x, -1.2, MAIN.cz - MAIN.d / 2 - 0.1, 0.8, y + 5.2 + 1.2 - 0.6, 0.3, BRICK_LIGHT); }
  // rooftop plant boxes either side of the skylight
  for (const x of [-9, -1.5, 6.5, 12.5]) for (const sz of [-1, 1]) box(b, MAIN.cx + x, top + 0.22, MAIN.cz + sz * 5.6, 1.6, 0.7, 1.4, '#cfc8bb');
}

function wings(b: BatchLike, lod: 0 | 2) {
  const aTop = block(b, NORTH_A, CREAM_SHADE, lod);
  const bTop = block(b, NORTH_B, CREAM, lod);
  if (lod === 2) return;
  box(b, NORTH_A.cx, aTop, NORTH_A.cz, NORTH_A.w + 0.3, 0.3, NORTH_A.d + 0.3, TRIM);
  box(b, NORTH_A.cx, aTop - 0.85, NORTH_A.cz + NORTH_A.d / 2 + 0.05, NORTH_A.w - 1.5, 0.55, 0.1, FASCIA);
  shopFront(b, NORTH_A, NORTH_A.cx - 5, NORTH_A.cx + 5, 2.6, 6.1);

  box(b, NORTH_B.cx, bTop, NORTH_B.cz, NORTH_B.w + 0.3, 0.3, NORTH_B.d + 0.3, TRIM);
}

function entrances(b: BatchLike, lod: 0 | 2) {
  const ay = g.at(ATRIUM.cx, ATRIUM.cz + 2);
  // glass atrium with a gabled glass roof (the tallest part), standing forward of the concourse front
  const at = gy(MAIN) + ATRIUM.h;
  box(b, ATRIUM.cx, -1.2, ATRIUM.cz - 0.6, ATRIUM.w, at + 1.2, ATRIUM.d + 1.2, GLASS, [6, ay, -3.1, 0.3]);
  gable(b, ATRIUM.cx, at, ATRIUM.cz - 0.6, ATRIUM.d + 1.2, ATRIUM.w, 1.6, GLASS, GLASS_DARK, Math.PI / 2, 0.15, GLOW(0.35));
  if (lod === 2) return;
  for (const sx of [-1, 1]) box(b, ATRIUM.cx + sx * (ATRIUM.w / 2), -1.2, ATRIUM.cz + ATRIUM.d / 2 - 0.15, 0.3, at + 1.6, 0.3, TRIM);
  box(b, ATRIUM.cx, ay - 0.05, ATRIUM.cz + ATRIUM.d / 2 + 0.02, 3.2, 2.4, 0.08, DOOR, LIT(ay));
  // canopy on two posts out over the forecourt
  box(b, ATRIUM.cx, ay + 3.0, ATRIUM.cz + ATRIUM.d / 2 + 1.6, 6.2, 0.22, 3.4, TRIM);
  for (const sx of [-1, 1]) cbox(b, ATRIUM.cx + sx * 2.8, ay + 1.5, ATRIUM.cz + ATRIUM.d / 2 + 3.0, 0.18, 3.0, 0.18, FC.metal);
  // second entrance pavilion: a cream box with a flat canopy and dark glass doors
  const pTop = block(b, PAVILION, CREAM, lod);
  const py = g.at(PAVILION.cx, PAVILION.cz + PAVILION.d / 2 + 1);
  box(b, PAVILION.cx, pTop, PAVILION.cz, PAVILION.w + 0.3, 0.25, PAVILION.d + 0.3, TRIM);
  box(b, PAVILION.cx, py - 0.05, PAVILION.cz + PAVILION.d / 2 + 0.02, 2.2, 2.2, 0.08, DOOR, LIT(py));
  box(b, PAVILION.cx, py + 2.7, PAVILION.cz + PAVILION.d / 2 + 0.05, 4.2, 0.18, 0.2, TRIM);
}

function forecourt(b: BatchLike) {
  for (const [k, t] of TREES.entries()) {
    const y = g.at(t.x, t.z);
    box(b, t.x, y - 0.2, t.z, 1.4, 0.45, 1.4, FC.planter);
    tree(b, t.x, y + 0.2, t.z, 1.05, k + 3);
  }
  for (const l of LAMPS) lamp(b, l.x, g.at(l.x, l.z), l.z);
  for (const [x, z, ry] of BENCHES) bench(b, x, g.at(x, z), z, ry);
  planter(b, 7.6, g.at(7.6, 12.2), 12.2, 2.6, 1.1);
  for (const x of [-1.6, 17.4]) bin(b, x, g.at(x, 8.6), 8.6);
  for (let k = 0; k < 6; k++) { const x = 1.6 + k * 1.3; if (Math.abs(x - 3.0) > 1.5) bollard(b, x, g.at(x, 15.0), 15.0); }
}

function build(b: BatchLike, lod: 0 | 2) {
  concourse(b, lod);
  wings(b, lod);
  entrances(b, lod);
  if (lod === 0) forecourt(b);
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(COURT, GC.plaza, PAT.stone, g, 4),
    // crosswalk over 20th Ave from the forecourt to the parking fields and the M stop
    ...crosswalk({ x: 3.0, z: 16.6 }, { x: 3.0, z: 19.2 }, g, 2.6, 11.9 - g.base),
  ];
}

const BLOCKERS = [
  ...[MAIN, NORTH_A, NORTH_B, PAVILION].map(k => ({ poly: rect(k.cx, k.cz, k.w, k.d) })),
  { poly: rect(ATRIUM.cx, ATRIUM.cz - 0.6, ATRIUM.w + 0.3, ATRIUM.d + 1.2) },
  ...TREES.map(t => ({ x: t.x, z: t.z, r: 0.8 })),
  { poly: rect(7.6, 12.2, 2.6, 1.1) },
];

/** exclusion: the mall buildings + the forecourt (20th Ave, Winston Dr and Buckingham Way stay city streets) */
const EXCLUDE: Vec2[] = [
  { x: -9.6, z: -10.3 }, { x: 17.3, z: -10.3 }, { x: 17.3, z: -5.4 }, { x: 28.9, z: -5.4 }, { x: 28.9, z: 2.6 }, { x: 33.6, z: 2.6 },
  { x: 33.6, z: 9.8 }, { x: 17.8, z: 9.8 }, { x: 17.8, z: 11.6 }, { x: 14.7, z: 15.6 }, { x: 1.2, z: 15.6 }, { x: -1.2, z: 13.6 }, { x: -2.8, z: 11.9 }, { x: -2.8, z: 11.4 },
  { x: -9.6, z: 11.4 },
];

export const stonestown: W4Site = {
  id: ID,
  tier: 1,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  castShadow: true,
  walk: { blockers: BLOCKERS, surfaces: [{ poly: COURT, y: 'terrain', surface: 'plaza' }] },
  ground: ground(),
  lights: LAMPS.map(l => ({ x: l.x, y: g.at(l.x, l.z) + 3.8, z: l.z, size: 1, color: '#ffd9a0' })),
  plaza: [plazaOf(COURT)],
  w4: {
    placeId: 'stonestown-galleria',
    attractions: ['stonestown-galleria'],
    lod0R: 340,
    arrival: { x: 2.4, z: 13.0, heading: Math.PI },
    photo: { target: [0, 4, 0], distance: 50, elevation: 0.34, bearing: 0.6 },
    flag: { x: 1.4, z: 6.4, h: 30 },
    height: { realM: 26, u: 9.2, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/1154799336', 'way/35156778', 'way/147000933', 'way/1155126441', 'way/1155126445', 'way/147001452'],
    terrain: [-13, -12, 36, 22],
  },
};
