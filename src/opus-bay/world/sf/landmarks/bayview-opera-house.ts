import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { LIT, NONE, box, gable, prismXZ, worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, gfill, lamp, plazaOf, tree } from './siteKit';
import { boulder, box3, site3Ground } from './siteKit3';

/**
 * Bayview Opera House · Ruth Williams Memorial Theatre (wave 4, P4 · map T3, the south-east anchor): built in 1888 at
 * 4705 3rd Street, Newcomb Avenue — the oldest standing theatre in San Francisco, a two-storey wooden hall in which
 * architect Henry Geilfuss blended Italianate, Gothic, Eastlake and Stick elements; a community arts centre and youth
 * dance centre since 1989, named for the producer Ruth Williams (Wikipedia "Bayview Opera House"). The 2014–16
 * renovation ($5.7 M, San Francisco Arts Commission; landscape by Walter Hood) turned two-thirds of its triangular lot
 * into an outdoor plaza with a wooden stage against the rebuilt south wall, permanent seating for about 60 and a rock
 * garden (sfpublicworks.org "Bayview Opera House"; Hoodline, July 2016); it reopened on 17 September 2016.
 *
 * Toy: the hall on its OSM footprint (way 288836717), cream walls with slate trim under a gabled roof hidden behind a
 * tall false front on 3rd Street (plain: no name board text), the entrance stairs; south of it the plaza: the stage on
 * the south wall, two rows of seats facing it, the rock garden at the 3rd Street corner, a street tree and a lamp.
 *
 * Frame: origin (832.4, 635.3) at the hall's centre, yaw 10.66° = the street grid here: local +x runs east along
 * Newcomb Avenue (centreline z −4.0, 3.6 u), +z south to Oakdale Avenue (z 7.95; its north kerb z 6.15); 3rd Street
 * cuts the grid diagonally on the west (its east kerb from (−2.19, −1.82) to (0.09, 4.17), then (0.75, 6.0)), and the
 * hall's west wall stands on that kerb. The block east of x 4.4 (a sliver building and the recreation hall) stays the
 * city's. 12 m → 5.06 u (H = 3.2 + 0.155·h): walls 3.2 u, the false front to 4.6 u, the ridge to 4.3 u.
 */

const ID = 'bayview-opera-house';
const X0 = 832.4, Z0 = 635.3, YAW = (10.66 * Math.PI) / 180;
const g = site3Ground(ID, 4.1);

const BODY = '#ece2c8', TRIM = '#5f7187', ROOF = '#76675b', GLASS = '#3f4a52', WOOD = '#9a7050', SEAT = '#d7553f';
/** the hall's footprint (OSM way 288836717, squared on the grid): the 3rd Street wall is the diagonal */
const HALL: [number, number][] = [[-0.85, -2.15], [1.45, -2.15], [1.45, 3.05], [-0.3, 3.05], [-1.6, -0.35], [-1.6, -1.6], [-0.85, -1.7]];
const FRONT_A = { x: -1.62, z: -0.4 }, FRONT_B = { x: -0.28, z: 3.05 };
const WALL_H = 3.2, FRONT_H = 4.6;
/** the plaza: the lot south and east of the hall, from 3rd Street's kerb to Oakdale's */
const LOT: Vec2[] = [{ x: 1.45, z: -2.0 }, { x: 4.2, z: -2.0 }, { x: 4.2, z: 3.0 }, { x: 6.0, z: 3.0 }, { x: 6.0, z: 5.9 }, { x: 0.7, z: 5.9 }, { x: -0.2, z: 3.15 }, { x: 1.45, z: 3.15 }];
const STAGE = { x0: -0.05, x1: 1.45, z0: 3.05, z1: 4.05, h: 0.45 };
const SEATS: [number, number][] = [[0.75, 4.85], [1.2, 4.85], [1.65, 4.85], [2.1, 4.85], [2.55, 4.85], [1.2, 5.45], [1.65, 5.45], [2.1, 5.45], [2.55, 5.45], [3.0, 5.45]];
const ROCKS: [number, number, number][] = [[4.1, 4.0, 0.55], [5.0, 4.6, 0.45], [4.3, 5.3, 0.35], [5.5, 3.5, 0.4]];

function hall(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(0, 0);
  prismXZ(b, HALL, y0 - 1.2, y0 + WALL_H, BODY, ROOF, lod === 2 ? LIT(y0) : [6, y0, -3.1, 0.2]);
  gable(b, 0.3, y0 + WALL_H, 0.45, 5.2, 2.3, 1.1, ROOF, BODY, Math.PI / 2, 0.12);
  if (lod === 2) return;
  // the false front on 3rd Street: a tall flat parapet over the wall, a cornice and a pediment block, three bays of tall
  // windows on two floors, the central door with its stairs down to the sidewalk
  const dx = FRONT_B.x - FRONT_A.x, dz = FRONT_B.z - FRONT_A.z, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz) - Math.PI / 2;
  const nx = -dz / L, nz = dx / L;          // outward (toward 3rd Street, −x side)
  const at = (u: number, off: number) => ({ x: FRONT_A.x + (dx * u) / L + nx * off, z: FRONT_A.z + (dz * u) / L + nz * off });
  const m = at(L / 2, 0.08);
  box(b, m.x, y0 - 0.2, m.z, L + 0.2, FRONT_H + 0.2, 0.16, BODY, [6, y0, -3.3, 0.2], ry);
  const c = at(L / 2, 0.2);
  box(b, c.x, y0 + FRONT_H - 0.25, c.z, L + 0.4, 0.25, 0.3, TRIM, NONE, ry);
  box(b, c.x, y0 + WALL_H - 0.1, c.z, L + 0.3, 0.14, 0.24, TRIM, NONE, ry);
  box(b, c.x, y0 + FRONT_H, c.z, 1.3, 0.35, 0.2, TRIM, NONE, ry);
  for (const u of [0.55, 1.3, 2.35, 3.1]) for (const fy of [0.5, 2.0]) {
    const w = at(u * (L / 3.65), 0.17);
    box(b, w.x, y0 + fy, w.z, 0.42, fy < 1 ? 1.15 : 0.95, 0.05, GLASS, LIT(y0), ry);
  }
  const d = at(L / 2, 0.17);
  box(b, d.x, y0 + 0.15, d.z, 0.75, 1.5, 0.05, '#6b4a36', LIT(y0), ry);
  for (let k = 0; k < 2; k++) { const s = at(L / 2, 0.3 + k * 0.25); box(b, s.x, y0 - 0.2, s.z, 1.3, 0.38 - k * 0.16, 0.26, FC.concrete, NONE, ry); }
  // Newcomb side windows and the rebuilt south wall's glass walkway door onto the stage
  for (const x of [0.0, 0.9]) box(b, x, y0 + 1.9, -2.18, 0.45, 0.9, 0.05, GLASS, LIT(y0));
  box(b, 1.0, y0 + 0.4, 3.08, 0.8, 1.6, 0.05, GLASS, LIT(y0));
}

function plaza(b: BatchLike) {
  // the wooden stage against the south wall, its front edge a darker board
  const sx = (STAGE.x0 + STAGE.x1) / 2, sz = (STAGE.z0 + STAGE.z1) / 2, sy = g.at(sx, sz);
  box3(b, sx, sy - 0.2, sz, STAGE.x1 - STAGE.x0, STAGE.h + 0.2, STAGE.z1 - STAGE.z0, WOOD);
  box3(b, sx, sy - 0.2, STAGE.z1 - 0.04, STAGE.x1 - STAGE.x0 + 0.02, STAGE.h + 0.18, 0.08, '#6f5038');
  // the permanent bucket seats facing the stage (−z): one block each
  for (const [x, z] of SEATS) { const y = g.at(x, z); box3(b, x, y - 0.1, z, 0.36, 0.5, 0.36, SEAT); }
  for (const [k, [x, z, s]] of ROCKS.entries()) boulder(b, x, g.at(x, z), z, s * 1.4, k + 3, '#a08f7a');
  tree(b, 5.5, g.at(5.5, 5.3), 5.3, 0.95, 7);
  tree(b, 3.3, g.at(3.3, -1.2), -1.2, 0.9, 2);
  lamp(b, 3.6, g.at(3.6, 2.6), 2.6);
}

function build(b: BatchLike, lod: 0 | 2) {
  hall(b, lod);
  if (lod === 0) plaza(b);
}

function ground(): SiteGroundPoly[] {
  const garden: Vec2[] = [{ x: 3.6, z: 3.4 }, { x: 5.9, z: 3.1 }, { x: 5.9, z: 5.8 }, { x: 3.7, z: 5.8 }];
  return [
    ...gfill(LOT, GC.pavers, PAT.stone, g, 3),
    ...gfill(garden, GC.earth, PAT.earth, g, 3.5, 0.08),
  ];
}

const BLOCKERS = [
  { poly: HALL.map(([x, z]) => ({ x, z })) },
  { poly: [{ x: STAGE.x0, z: STAGE.z0 }, { x: STAGE.x1, z: STAGE.z0 }, { x: STAGE.x1, z: STAGE.z1 }, { x: STAGE.x0, z: STAGE.z1 }] },
  ...ROCKS.map(([x, z, s]) => ({ x, z, r: s * 0.9 })),
];

/** exclusion: the lot (the hall, the plaza to x 6.0 south of z 3.0); its west edge is 3rd Street's east kerb */
const EXCLUDE: Vec2[] = [{ x: -1.72, z: -2.1 }, { x: 4.3, z: -2.1 }, { x: 4.3, z: 2.9 }, { x: 6.1, z: 2.9 }, { x: 6.1, z: 6.0 }, { x: 0.75, z: 6.0 }, { x: -0.3, z: 3.25 }, { x: -1.7, z: -0.35 }];

export const bayviewOperaHouse: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: BLOCKERS },
  ground: ground(),
  lights: [{ x: 3.6, y: g.at(3.6, 2.6) + 3.8, z: 2.6, size: 1, color: '#ffd9a0' }, { x: 0.7, y: g.at(0.7, 3.5) + 2.2, z: 3.6, size: 1.4, color: '#ffe0b0' }],
  plaza: [plazaOf(LOT)],
  w4: {
    placeId: 'osm-w288836717',
    attractions: ['bayview-opera-house'],
    arrival: { x: 3.0, z: 4.6, heading: Math.PI },
    photo: { target: [-0.6, 2.2, 1.2], distance: 17, elevation: 0.18, bearing: -1.22 },
    flag: { x: 0.4, z: 0.4, h: 30 },
    height: { realM: 12, u: 4.6, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/288836717'],
    terrain: [-3, -4, 8, 8],
    notes: 'No name board text on the false front; the stage and seats are the 2016 plaza (Walter Hood), the rock garden a few boulders.',
  },
};
