import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { GLOW, LIT, NONE, SF, arch, box, cbox, disc, gable, lathe, pyramid, rect, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, gstrip, lamp, plazaOf, siteGround, tree } from './siteKit';

/**
 * Saint Ignatius Church (wave 4, P1 · map T2, part of the USF site): the Jesuit church of 1914 by Charles Devlin at
 * Fulton St and Parker Ave, whose two 200-ft towers flank the columned front on its south side, with the dome behind
 * them over the crossing (USF, "9 facts about St. Ignatius Church"; SF Chronicle). An active parish: a quiet card, no
 * gameplay objects, and the saint's statue in the front niche is a plain figure.
 *
 * Frame: origin (−150.4, 753.2), yaw 55.1° — local +z faces south onto Fulton St (z 7.3), Parker Ave runs along
 * x −5.4 (west), the campus lawn with its walks lies east (x 4…13, OSM footways, Kalmanovitz Hall at x ≥ 13.7).
 * Footprint (OSM way 225193440) x −3.3…4.0, z −5.8…5.1. Heights: towers 61 m → 12.65 u to the lantern tops, the
 * nave 20 m → 5.6 u walls, the dome over the crossing to 10.4 u.
 *
 * The procedural church is the always-shippable fallback; lane V's AI mesh (`w4.aiSlot`) swaps in through the
 * SoloView gate in the integration phase with the same footprint and walk data.
 */

const ID = 'st-ignatius-church';
const X0 = -150.4, Z0 = 753.2, YAW = (55.1 * Math.PI) / 180;
const g = siteGround(ID, 22.4);

const BUFF = '#e6d3ae', BUFF_SHADE = '#d4bf97', TRIM = '#f3ead6', ROOF = '#8a7a6a', DOME = '#9aa39a', DOME_DARK = '#7f8a82', DARK = '#4f4a44';

const NAVE = { x0: -2.3, x1: 3.0, z0: -5.6, z1: 3.0 };
const CROSS_Z = -2.7, CX = 0.35;
const TOWERS = [-1.75, 2.45];
const TOWER_W = 1.9, TOWER_Z = 4.05;

function church(b: BatchLike, lod: 0 | 2) {
  const fy = g.at(CX, 5.4);
  // nave + transept + apse
  const nw = NAVE.x1 - NAVE.x0, nd = NAVE.z1 - NAVE.z0, ncz = (NAVE.z0 + NAVE.z1) / 2;
  box(b, CX, -1.2, ncz, nw, fy + 5.6 + 1.2, nd, BUFF, lod === 0 ? [4, fy, -3.1, 0.12] : GLOW(0.12));
  gable(b, CX, fy + 5.6, ncz, nd, nw, 1.5, ROOF, BUFF, Math.PI / 2, 0.15);
  box(b, CX, -1.2, CROSS_Z, 7.2, fy + 5.0 + 1.2, 2.4, BUFF, GLOW(0.12));
  gable(b, CX, fy + 5.0, CROSS_Z, 7.2, 2.4, 1.2, ROOF, BUFF, 0, 0.15);
  // the two front towers: square shafts, an open belfry stage, an octagonal lantern, a small cupola
  for (const tx of TOWERS) {
    box(b, tx, -1.2, TOWER_Z, TOWER_W, fy + 7.6 + 1.2, TOWER_W, BUFF, GLOW(0.15));
    if (lod === 2) { pyramid(b, tx, fy + 7.6, TOWER_Z, 1.5, 1.5, 5.0, BUFF_SHADE); continue; }
    box(b, tx, fy + 7.6, TOWER_Z, TOWER_W + 0.2, 0.25, TOWER_W + 0.2, TRIM);
    box(b, tx, fy + 7.85, TOWER_Z, 1.55, 1.6, 1.55, BUFF_SHADE, GLOW(0.15));
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2;
      arch(b, tx + Math.sin(a) * 0.79, fy + 8.0, TOWER_Z + Math.cos(a) * 0.79, 0.6, 1.2, a, DARK, LIT(fy + 8));
    }
    box(b, tx, fy + 9.45, TOWER_Z, 1.75, 0.2, 1.75, TRIM);
    lathe(b, [[0.62, 0], [0.62, 1.2], [0.7, 1.3], [0.45, 1.75], [0.18, 2.2], [0.05, 2.9]], tx, fy + 9.65, TOWER_Z, BUFF, GLOW(0.2), 8);
    cbox(b, tx, fy + 12.7, TOWER_Z, 0.06, 0.4, 0.06, SF.gold);
  }
  // the dome over the crossing: an octagonal drum, the dome, a lantern
  if (lod === 2) { lathe(b, [[1.6, 0], [1.6, 1.6], [0.2, 4.2]], CX, fy + 5.9, CROSS_Z, DOME, NONE, 5); return; }
  lathe(b, [[1.55, 0], [1.55, 1.6]], CX, fy + 5.9, CROSS_Z, BUFF_SHADE, GLOW(0.12), 8);
  lathe(b, [[1.62, 0], [1.5, 0.75], [1.15, 1.45], [0.6, 1.95], [0.25, 2.1]], CX, fy + 7.5, CROSS_Z, (ly: number) => new THREE.Color(ly < 0.8 ? DOME_DARK : DOME), NONE, 12);
  lathe(b, [[0.3, 0], [0.3, 0.55], [0.08, 0.95]], CX, fy + 9.55, CROSS_Z, TRIM, GLOW(0.3), 6);
  // the front: steps, four columns and their entablature, the pediment, the saint's niche, three doors
  const zf = 5.12;
  for (let k = 0; k < 2; k++) box(b, CX + 0.35, fy - 0.3 + k * 0.15, zf + 0.05 - k * 0.12, 2.3 - k * 0.3, 0.3, 0.45, '#d8ccb6');
  for (const x of [-0.55, 0.15, 0.85, 1.55]) box(b, x, fy, zf - 0.05, 0.26, 4.3, 0.26, TRIM);
  box(b, CX + 0.15, fy + 4.3, zf - 0.1, 2.9, 0.45, 0.4, TRIM);
  gable(b, CX + 0.15, fy + 4.75, zf - 0.2, 2.9, 0.3, 0.8, TRIM, BUFF, 0, 0.05);
  arch(b, CX + 0.15, fy + 2.7, zf - 0.28, 0.55, 1.1, 0, '#6a6258');
  box(b, CX + 0.15, fy + 2.75, zf - 0.25, 0.22, 0.75, 0.16, '#efe7d6');                   // the statue (a plain figure)
  cbox(b, CX + 0.15, fy + 3.62, zf - 0.25, 0.16, 0.16, 0.16, '#efe7d6');
  for (const [x, w] of [[CX + 0.15, 0.8], [TOWERS[0], 0.55], [TOWERS[1], 0.55]]) arch(b, x, fy, zf + (Math.abs(x - CX) > 1 ? 0.0 : -0.27), w, 1.5, 0, DARK, LIT(fy));
  disc(b, CX + 0.15, fy + 5.25, zf - 0.18, 0.28, 0.05, 0, '#e8c98a', GLOW(0.8), 10);
  // clerestory lights along the nave
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) arch(b, CX + sx * (nw / 2 + 0.02), fy + 2.6, NAVE.z0 + 1.2 + k * 1.1, 0.45, 1.3, sx * Math.PI / 2, '#5d6f86', GLOW(0.7));
}

/** the campus lawn east of the church (USF's green between the church, Kalmanovitz Hall and Gleeson Library) */
const LAWN: Vec2[] = [{ x: 4.6, z: -6.2 }, { x: 13.0, z: -6.2 }, { x: 13.0, z: 5.0 }, { x: 4.6, z: 5.0 }];
const WALK_A: Vec2[] = [{ x: 4.4, z: -0.8 }, { x: 12.8, z: -4.9 }];
const WALK_B: Vec2[] = [{ x: 4.4, z: 2.7 }, { x: 12.8, z: 2.7 }];
const TREES: [number, number][] = [[6.2, -4.6], [11.6, -1.2], [6.4, 4.1], [11.8, 4.3]];
const LAMPS: Vec2[] = [{ x: 4.9, z: 1.1 }, { x: 12.6, z: -5.8 }];
const BENCHES: [number, number, number][] = [[8.4, 1.9, 0], [10.2, -3.4, 2.7]];

function lawn(b: BatchLike) {
  for (const [k, [x, z]] of TREES.entries()) tree(b, x, g.at(x, z), z, 1.1, k + 31);
  for (const l of LAMPS) lamp(b, l.x, g.at(l.x, l.z), l.z);
  for (const [x, z, ry] of BENCHES) bench(b, x, g.at(x, z), z, ry);
}

function build(b: BatchLike, lod: 0 | 2) {
  church(b, lod);
  if (lod === 0) lawn(b);
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(LAWN, GC.lawn, PAT.grass, g, 4),
    ...gstrip(WALK_A, 1.6, GC.pavers, PAT.stone, g, 3, 0.075),
    ...gstrip(WALK_B, 1.6, GC.pavers, PAT.stone, g, 3, 0.075),
    // the church's own forecourt strip along Fulton St and Parker Ave (the city sidewalk stops at the exclusion)
    ...gfill([{ x: -3.5, z: 5.1 }, { x: 4.6, z: 5.1 }, { x: 4.6, z: 5.35 }, { x: -3.5, z: 5.35 }], GC.sidewalk, PAT.stone, g, 4),
  ];
}

const BLOCKERS = [
  { poly: rect(CX, (NAVE.z0 + NAVE.z1) / 2, NAVE.x1 - NAVE.x0, NAVE.z1 - NAVE.z0) },
  { poly: rect(CX, CROSS_Z, 7.2, 2.4) },
  ...TOWERS.map(tx => ({ poly: rect(tx, TOWER_Z, TOWER_W, TOWER_W) })),
  { poly: rect(CX + 0.15, 4.4, 2.9, 1.2) },
  ...TREES.map(([x, z]) => ({ x, z, r: 0.3 })),
];

/** exclusion: the church and the lawn east of it (Fulton St, Parker Ave and the campus halls stay the city's) */
const EXCLUDE: Vec2[] = [{ x: -3.6, z: -6.5 }, { x: 13.2, z: -6.5 }, { x: 13.2, z: 5.4 }, { x: -3.6, z: 5.4 }];

export const stIgnatius: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: BLOCKERS, surfaces: [{ poly: LAWN, y: 'terrain', surface: 'grass' }] },
  ground: ground(),
  fade: { r: 5, y1: 13, box: [3.8, 5.8] },
  lights: [
    ...LAMPS.map(l => ({ x: l.x, y: g.at(l.x, l.z) + 3.8, z: l.z, size: 1, color: '#ffd9a0' })),
    // floodlit towers and dome (the church is lit at night)
    ...TOWERS.map(tx => ({ x: tx, y: g.at(tx, 6) + 9, z: TOWER_Z + 1.4, size: 2.2, color: '#ffe3b0' })),
  ],
  plaza: [plazaOf(LAWN, 'grass')],
  w4: {
    placeId: 'st-ignatius-church',
    attractions: ['st-ignatius-church'],
    arrival: { x: 0.9, z: 6.4, heading: Math.PI },
    photo: { target: [0.4, 6.5, 0], distance: 34, elevation: 0.2, bearing: 0.35 },
    flag: { x: CX, z: CROSS_Z, h: 30 },
    height: { realM: 61, u: 12.9, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/225193440'],
    terrain: [-5, -8, 15, 8],
    aiSlot: { model: 'w4-st-ignatius', note: 'lane V: twin spires + dome (H-1); swap through the SoloView gate, same footprint and blockers' },
    notes: 'Active parish: respectful card, no gameplay objects on the church.',
  },
};
