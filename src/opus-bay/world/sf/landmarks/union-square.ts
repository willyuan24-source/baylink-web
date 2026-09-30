import type { Vec2 } from '../../../core/types';
import { type BatchLike, CBOX, CONE, CYL, ICO, M, SPHERE } from '../../builder';
import { GLOW, NONE, WIN, box, cyl, lathe, worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, lamp, planter, plazaOf, siteGround } from './siteKit';

/**
 * Union Square (wave 4, P2 · map T1, lod-0 ring 200 u; W7-W2: T2 ≤ 2.5k triangles, was the 0.6k downtown diet): the granite plaza between
 * Post, Stockton, Geary and Powell Streets, with the 1903 Dewey Monument in the middle — a Corinthian column carrying
 * a bronze Victory — and palms at its corners; the Powell St cable cars pass along its west side (Wikipedia; the
 * shops and theatres around it are city buildings, no names or signs anywhere).
 *
 * Frame: origin (96.1, 221.35) at the monument (OSM place osm-w616479962), yaw 55°: local −z faces Post St (map
 * north, centreline z −7.2), +z Geary St (z 7.2), −x Powell St with the cable-car tracks (x −10.4), +x Stockton St
 * (x 10.4). The plaza (OSM park way) is x −6.7…6.6, z −5.4…5.5. The column: 97 ft (29.6 m) → 7.8 u to Victory's
 * head (H = 3.2 + 0.155·h).
 *
 * W7-W2 (checked on the web 2026-09-29): the 2002 redesign (April Philips Design Works with MD Fotheringham) — a large
 * central plaza, terraces and steps down to Geary St, four corner plazas with the signature palms, a café with open-air
 * seating, a stage — https://www.unionsquarepark.us/HistoryPage.html , https://apdw.com/portfolio/urban/union-square/ ;
 * four Hearts in San Francisco sculptures stand in the square, the newest (SŌL) at Powell & Geary —
 * https://sfghf.org/news/new-union-square-heart-brightens-up-downtown/ . Painted toy hearts, no lettering.
 */

const ID = 'union-square';
const X0 = 96.1, Z0 = 221.35, YAW = (55 * Math.PI) / 180;
const g = siteGround(ID, 4.5);

const GRANITE = '#e2dccf', GRANITE_DARK = '#c9c1b1', BRONZE = '#8a7a52';
const PLAZA: Vec2[] = [{ x: -6.7, z: -4.6 }, { x: -3.2, z: -4.6 }, { x: -2.0, z: -5.15 }, { x: 6.6, z: -5.15 }, { x: 6.6, z: 5.1 }, { x: -6.7, z: 5.1 }];
const PALMS: Vec2[] = [{ x: -5.6, z: -4.2 }, { x: 5.5, z: -4.2 }, { x: -5.6, z: 4.2 }, { x: 5.5, z: 4.2 }];

/** a lean palm for the diet: tapering four-sided trunk + five fronds (76 triangles) */
function palm5(b: BatchLike, x: number, y: number, z: number, H: number, seed: number) {
  b.add(CYL(4, 0.75), M(x, y - 0.2, z, 0, 0.26, H + 0.2, 0.26), FC.palmTrunk);
  for (let i = 0; i < 5; i++) {
    const yaw = seed + (i / 5) * Math.PI * 2, pitch = i % 2 ? 0.5 : 0.25, seg = 1.4;
    const dx = Math.sin(yaw) * Math.cos(pitch) * seg, dy = -Math.sin(pitch) * seg, dz = Math.cos(yaw) * Math.cos(pitch) * seg;
    b.add(CBOX(), M(x + dx / 2, y + H + dy / 2, z + dz / 2, yaw, 0.45, 0.05, seg * 1.05, pitch), FC.frond, [0, 0, 0.3, 0]);
  }
}

/** the Dewey Monument: granite base, the column and its capital, Victory with her trident and wreath */
function dewey(b: BatchLike, lod: 0 | 2) {
  const y = g.at(0, 0);
  box(b, 0, y - 0.3, 0, 1.5, 0.75, 1.5, GRANITE_DARK);
  box(b, 0, y + 0.45, 0, 1.0, 0.9, 1.0, GRANITE, GLOW(0.2));
  lathe(b, [[0.3, 0], [0.26, 5.0], [0.24, 5.2]], 0, y + 1.35, 0, GRANITE, GLOW(0.2), lod === 0 ? 8 : 5);
  if (lod === 2) return;
  box(b, 0, y + 6.55, 0, 0.62, 0.35, 0.62, GRANITE);
  // Victory (a plain toy figure: body, head, the raised trident and wreath), gilt bronze
  box(b, 0, y + 6.9, 0, 0.22, 0.62, 0.18, BRONZE, GLOW(0.35));
  b.add(ICO(0), M(0, y + 7.62, 0, 0, 0.1, 0.1, 0.1), BRONZE, GLOW(0.35));
  box(b, 0.16, y + 7.1, 0, 0.04, 0.95, 0.04, BRONZE, GLOW(0.35));
  b.add(CBOX(), M(-0.2, y + 7.55, 0, 0, 0.2, 0.2, 0.04), BRONZE, GLOW(0.35));
}

// ---------------------------------------------------------------------------
// W7-W2 · T2: the 2002 square (terraces and steps down to Geary, the café's red umbrellas, planters, lamps) and the
// four Hearts in San Francisco at the corners
// ---------------------------------------------------------------------------

/** the four corner hearts (Hearts in San Francisco: four stand in Union Square, the newest at Powell & Geary); the Powell / Post one
 * stands 1 u in from the corner, clear of lane H's hunt lantern 38 (−6.8, −3.2 local) */
const HEARTS: readonly { x: number; z: number; ry: number; a: string; b: string }[] = [
  { x: -5.9, z: -2.2, ry: 0.5, a: '#d8433a', b: '#f2c14e' },
  { x: 5.85, z: -3.2, ry: -0.5, a: '#e58aa0', b: '#6b8fd6' },
  { x: -5.9, z: 3.1, ry: 2.6, a: '#f08a3c', b: '#f7f4ec' },
  { x: 5.85, z: 3.1, ry: -2.6, a: '#3fae6a', b: '#e8483c' },
];
/** the café's tables (red umbrellas) in the Stockton / Post quarter, and its kiosk */
const CAFE: readonly Vec2[] = [{ x: 2.9, z: -3.3 }, { x: 4.3, z: -2.3 }, { x: 4.3, z: -3.9 }, { x: 2.9, z: -1.8 }];
const KIOSK = { x: 5.95, z: -0.9, w: 0.9, d: 1.5 };
/** raised planters along Powell and Stockton */
const PLANTERS: readonly [number, number, number, number][] = [[-6.05, -0.3, 0.7, 1.3], [-6.05, 1.35, 0.7, 1.3], [6.0, 1.3, 0.7, 1.6]];
/** the steps down to Geary (two granite treads across the Geary edge) */
const STEPS = { x0: -1.2, x1: 3.9, z: [4.35, 4.75] } as const;
const LAMPS: readonly Vec2[] = [{ x: -3.6, z: -4.4 }, { x: 3.4, z: -4.6 }, { x: -3.8, z: 4.4 }];
const UMBRELLA = '#c9362c';

/** a painted toy heart on a low granite plinth (two lobes and a point, ≈ 130 triangles) */
function heart(b: BatchLike, x: number, y: number, z: number, ry: number, a: string, c: string) {
  box(b, x, y - 0.1, z, 0.9, 0.35, 0.55, GRANITE_DARK, NONE, ry);
  const s = Math.sin(ry), k = Math.cos(ry), yy = y + 0.25;
  for (const side of [-1, 1]) b.add(SPHERE(8, 5), M(x + k * side * 0.23, yy + 0.95, z - s * side * 0.23, ry, 0.33, 0.33, 0.2), side < 0 ? a : c);
  b.add(CONE(8), M(x, yy + 0.95, z, ry, 0.52, 0.95, 0.24, Math.PI), a);
}

function t2(b: BatchLike) {
  for (const h of HEARTS) heart(b, h.x, g.at(h.x, h.z), h.z, h.ry, h.a, h.b);
  for (const [i, p] of CAFE.entries()) {
    const y = g.at(p.x, p.z);
    cyl(b, p.x, y, p.z, 0.05, 0.72, FC.metal, NONE, 4);
    cyl(b, p.x, y + 0.7, p.z, 0.36, 0.05, FC.white, NONE, 8);
    for (const a of [0.4 + i, 2.5 + i]) box(b, p.x + Math.sin(a) * 0.6, y, p.z + Math.cos(a) * 0.6, 0.34, 0.45, 0.34, FC.metal, NONE, a);
    cyl(b, p.x, y + 0.72, p.z, 0.035, 1.35, FC.white, NONE, 4);
    b.add(CONE(8), M(p.x, y + 1.85, p.z, 0, 0.95, 0.42, 0.95), UMBRELLA);
  }
  const ky = g.at(KIOSK.x, KIOSK.z);
  box(b, KIOSK.x, ky - 0.2, KIOSK.z, KIOSK.w, 1.85, KIOSK.d, '#e7dcc4', WIN(3, ky));
  box(b, KIOSK.x, ky + 1.65, KIOSK.z, KIOSK.w + 0.4, 0.14, KIOSK.d + 0.4, '#3f6b57');
  for (const [x, z, w, d] of PLANTERS) planter(b, x, g.at(x, z), z, w, d);
  for (const [k, z] of STEPS.z.entries()) {
    const x = (STEPS.x0 + STEPS.x1) / 2, y = g.at(x, z);
    box(b, x, y - 0.3, z, STEPS.x1 - STEPS.x0, 0.42 - k * 0.14, 0.4, k ? GRANITE_DARK : GRANITE);
  }
  for (const p of LAMPS) lamp(b, p.x, g.at(p.x, p.z), p.z);
}

function build(b: BatchLike, lod: 0 | 2) {
  dewey(b, lod);
  if (lod === 2) return;
  for (const [k, p] of PALMS.entries()) palm5(b, p.x, g.at(p.x, p.z), p.z, 4.8, k * 1.3);
  for (const [x, z, ry] of [[-2.6, 1.8, 0], [2.6, -1.8, Math.PI]] as const) bench(b, x, g.at(x, z), z, ry);
  t2(b);
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(PLAZA, GC.plaza, PAT.stone, g, 3),
    ...gfill([{ x: -1.3, z: -1.3 }, { x: 1.3, z: -1.3 }, { x: 1.3, z: 1.3 }, { x: -1.3, z: 1.3 }], GRANITE_DARK, PAT.stone, g, 3, 0.09),
    // dark granite squares under the palms (flat ground, not kerb boxes: the diet counts the ground; W4-L-review)
    ...PALMS.flatMap(p => gfill([{ x: p.x - 0.6, z: p.z - 0.6 }, { x: p.x + 0.6, z: p.z - 0.6 }, { x: p.x + 0.6, z: p.z + 0.6 }, { x: p.x - 0.6, z: p.z + 0.6 }], GRANITE_DARK, PAT.stone, g, 3, 0.09)),
  ];
}

/** exclusion: the plaza, kept clear of Post St (and its slip lane by the Powell corner) and Geary St */
const EXCLUDE: Vec2[] = [{ x: -7.0, z: -4.75 }, { x: -3.2, z: -4.75 }, { x: -2.0, z: -5.3 }, { x: 6.9, z: -5.3 }, { x: 6.9, z: 5.2 }, { x: -7.0, z: 5.2 }];

export const unionSquare: W4Site = {
  id: ID,
  tier: 1,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  castShadow: true,
  walk: {
    blockers: [
      { x: 0, z: 0, r: 0.8 }, ...PALMS.map(p => ({ x: p.x, z: p.z, r: 0.65 })),
      // W7-W2: the hearts, the café's tables, its kiosk, the planters
      ...HEARTS.map(h => ({ x: h.x, z: h.z, r: 0.55 })),
      ...CAFE.map(p => ({ x: p.x, z: p.z, r: 0.5 })),
      { poly: [{ x: KIOSK.x - KIOSK.w / 2, z: KIOSK.z - KIOSK.d / 2 }, { x: KIOSK.x + KIOSK.w / 2, z: KIOSK.z - KIOSK.d / 2 }, { x: KIOSK.x + KIOSK.w / 2, z: KIOSK.z + KIOSK.d / 2 }, { x: KIOSK.x - KIOSK.w / 2, z: KIOSK.z + KIOSK.d / 2 }] },
      ...PLANTERS.map(([x, z, w, d]) => ({ poly: [{ x: x - w / 2, z: z - d / 2 }, { x: x + w / 2, z: z - d / 2 }, { x: x + w / 2, z: z + d / 2 }, { x: x - w / 2, z: z + d / 2 }] })),
    ],
    surfaces: [{ poly: PLAZA, y: 'terrain', surface: 'plaza' }],
  },
  ground: ground(),
  lights: [{ x: 0, y: g.at(0, 0) + 1.2, z: 1.2, size: 2.4, color: '#ffe3b0' }, ...LAMPS.map(p => ({ x: p.x, y: g.at(p.x, p.z) + 3.8, z: p.z, size: 1, color: '#ffd9a0' }))],
  plaza: [plazaOf(PLAZA)],
  w4: {
    placeId: 'union-square',
    attractions: ['union-square'],
    lod0R: 200,
    budget: 2500,
    arrival: { x: -3.0, z: 3.0, heading: 2.4 },
    photo: { target: [0, 4, 0], distance: 26, elevation: 0.3, bearing: -0.9 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 29.6, u: 7.8, top: 9.0, rule: 'H = 3.2 + 0.155·h' },
    osm: ['place osm-w616479962 (Dewey Monument)', 'park way of Union Square'],
    terrain: [-9, -8, 9, 8],
    notes: 'W7-W2: T2 (≤ 2.5k triangles, still one TOY mesh, 0 new calls): the 2002 square (the steps down to Geary, the café with red umbrellas in the Stockton / Post quarter — its exact corner not verified —, planters, lamps) and the four Hearts in San Francisco at the corners (sfghf.org, 2026-09-29). The wave-4 downtown diet (600) is no longer needed (sf-w6-final-verify: Chinatown 285k triangles, calls the limit).',
  },
};
