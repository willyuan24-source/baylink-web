import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CYL, ICO, M } from '../../builder';
import { GLOW, box, rect, worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, gfill, plazaOf, siteGround } from './siteKit';

/**
 * Yerba Buena Gardens (wave 4, P2 · map T2, downtown diet ≤ 0.4k triangles, lod-0 ring 200 u): the Esplanade lawn in
 * SoMa between the YBCA galleries and the Moscone Center roof, with its main-stage canopy and, on the east side, the
 * Martin Luther King Jr. Memorial waterfall (restored in 2026) — here a plain granite wall and falling water, never
 * its quotations (yerbabuenagardens.org). The carousel and the Children's Creativity Museum are card-only.
 *
 * Frame: origin (176.9, 210.8), yaw 0 (world grid): the park (OSM) is x −13.1…10.3, z −7.9…8.1; the waterfall wall
 * replaces OSM way 109141774 (x 6.6…9.5, z −6.2…3.7), the pedestrian walk along the YBCA side (z −7.8) and Howard
 * St (x 11.9) stay the city's. The wall 4.2 u: the waterfall is 20 ft (6.1 m) high and 50 ft wide, over the walkway
 * behind it (yerbabuena.org).
 */

const ID = 'yerba-buena-gardens';
const X0 = 176.9, Z0 = 210.8, YAW = 0;
const g = siteGround(ID, 1.5);

const GRANITE = '#b9b2a6', WATER = '#bfe0e6';
const LAWN: Vec2[] = [{ x: -12.0, z: -6.4 }, { x: 5.8, z: -6.4 }, { x: 5.8, z: 5.2 }, { x: -3.0, z: 6.6 }, { x: -9.8, z: 6.6 }, { x: -12.0, z: 4.8 }];
const WALK: Vec2[] = [{ x: -12.1, z: -6.7 }, { x: 6.4, z: -6.7 }, { x: 6.4, z: 5.6 }, { x: 5.8, z: 5.6 }, { x: 5.8, z: -6.4 }, { x: -12.1, z: -6.4 }];
const TREES: [number, number][] = [[-10.8, -5.2], [-10.9, 3.6], [-1.6, 4.4], [4.6, 4.2]];
const WALL = { x0: 6.6, x1: 9.5, z0: -6.2, z1: 3.7 }, WALL_H = 4.2;

/** a lollipop tree (≈ 28 triangles) for the diet */
function lolly(b: BatchLike, x: number, y: number, z: number, k: number) {
  b.add(CYL(4), M(x, y - 0.2, z, 0, 0.16, 2.0, 0.16), FC.trunk);
  b.add(ICO(0), M(x, y + 2.5, z, k, 1.25, 1.1, 1.25), k % 2 ? FC.tree : FC.treeDark, [0, 0, 0.3, 0]);
}

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(8, -1);
  // the memorial waterfall: a granite wall with a sheet of water on its west face (it glows softly at night)
  box(b, (WALL.x0 + WALL.x1) / 2 + 0.4, -1.2, (WALL.z0 + WALL.z1) / 2, WALL.x1 - WALL.x0 - 0.8, y0 + WALL_H + 1.2, WALL.z1 - WALL.z0, GRANITE, GLOW(0.1));
  box(b, WALL.x0 + 0.2, y0 - 0.2, (WALL.z0 + WALL.z1) / 2, 0.12, WALL_H + 0.1, WALL.z1 - WALL.z0 - 1.2, WATER, GLOW(0.45));
  if (lod === 2) return;
  box(b, WALL.x0 - 0.5, y0 - 0.25, (WALL.z0 + WALL.z1) / 2, 1.0, 0.4, WALL.z1 - WALL.z0, '#8fbcc6', GLOW(0.2));   // the pool
  // the Esplanade main stage: a white shade canopy on four posts
  const sx = -4.0, sz = -3.2, sy = g.at(sx, sz);
  for (const [ox, oz] of [[-1.6, -1.1], [1.6, -1.1], [-1.6, 1.1], [1.6, 1.1]]) b.add(BOX(), M(sx + ox, sy, sz + oz, 0, 0.12, 2.8, 0.12), '#e8e6e0');
  b.add(BOX(), M(sx, sy + 2.8, sz, 0, 3.8, 0.12, 2.8), '#f4f1ea', [0, 0, 0, 0.3]);
  b.add(BOX(), M(sx, sy - 0.2, sz, 0, 3.6, 0.45, 2.6), '#cfc7b8');
  for (const [k, [x, z]] of TREES.entries()) lolly(b, x, g.at(x, z), z, k);
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(WALK, GC.plaza, PAT.stone, g, 3),
    ...gfill(LAWN, GC.lawn, PAT.grass, g, 3),
  ];
}

const EXCLUDE: Vec2[] = [{ x: -12.2, z: -6.75 }, { x: 9.7, z: -6.75 }, { x: 9.7, z: 5.7 }, { x: -12.2, z: 5.7 }];

export const yerbaBuenaGardens: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: {
    blockers: [{ poly: rect((WALL.x0 + WALL.x1) / 2 - 0.1, (WALL.z0 + WALL.z1) / 2, WALL.x1 - WALL.x0 + 0.8, WALL.z1 - WALL.z0) }, ...TREES.map(([x, z]) => ({ x, z, r: 0.3 }))],
    surfaces: [{ poly: LAWN, y: 'terrain', surface: 'grass' }],
  },
  ground: ground(),
  lights: [{ x: 5.8, y: g.at(6, -1) + 1.5, z: -1.2, size: 2.6, color: '#d8f0ff' }],
  plaza: [plazaOf(LAWN, 'grass')],
  w4: {
    placeId: 'yerba-buena-gardens',
    attractions: ['yerba-buena-gardens'],
    lod0R: 200,
    budget: 400,
    arrival: { x: 0.0, z: 0.0, heading: Math.PI / 2 },
    photo: { target: [2, 2, 0], distance: 28, elevation: 0.45, bearing: -1.6 },
    flag: { x: -4.0, z: -3.2, h: 30 },
    height: { realM: 6.1, u: 4.3, top: 4.3, rule: 'overlook' },
    osm: ['park way of Yerba Buena Gardens', 'way/109141774'],
    terrain: [-14, -9, 11, 8],
    notes: 'Downtown diet (plan §2.2): ≤ 0.4k, lod0R 200. The MLK Memorial quotations are never reproduced; the carousel, MoAD and Moscone are cards.',
  },
};
