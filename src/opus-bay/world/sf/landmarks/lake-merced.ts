import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CBOX, M } from '../../builder';
import { worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, bin, gstrip, siteGround } from './siteKit';

/**
 * Lake Merced (wave 4, P3 · map T2, the lake-merced site): the city's largest lake, a freshwater reservoir in the
 * south-west corner ringed by a walking and running loop and by golf courses, of which TPC Harding Park is public
 * (Wikipedia; the scouting). The lake and its shores are the city's; this site is the spot on the Harding Road shore
 * where lane P ends the trips: a short path down from the loop to a timber fishing pier over the water (pilings, rails,
 * a bench at the end), two benches and a bin on the shore, a blank notice board, a rowboat moored by the pier (bobbing:
 * the animate part) and a grey heron fishing at the water's edge.
 *
 * Frame: origin (88.9, 1706.0) at the waterline (the lake at 0.5, the shore rising inland from z −1), yaw 24.2°: local
 * +z points out over the lake, x runs along the shore; the loop path passes ≈ 10.5 u inland (the site's path strip joins it). The pier deck stands 0.7 u
 * over the water.
 */

const ID = 'lake-merced';
const X0 = 88.9, Z0 = 1706.0, YAW = (24.2 * Math.PI) / 180;
const g = siteGround(ID, 0.5);

const WOOD = '#9a7454', WOOD_DARK = '#6f5540', WATER_Y = 0.5;
/** the pier: from the shore (z0) out over the lake (z1), its end platform */
const PIER = { x: 0, w: 1.4, z0: -1.6, z1: 5.4, end: { w: 3.0, d: 2.0 } };
const deckY = () => WATER_Y + 0.7 - g.base;
const DECK_POLY: Vec2[] = [
  { x: -PIER.w / 2, z: PIER.z0 }, { x: PIER.w / 2, z: PIER.z0 }, { x: PIER.w / 2, z: PIER.z1 }, { x: PIER.end.w / 2, z: PIER.z1 },
  { x: PIER.end.w / 2, z: PIER.z1 + PIER.end.d }, { x: -PIER.end.w / 2, z: PIER.z1 + PIER.end.d }, { x: -PIER.end.w / 2, z: PIER.z1 }, { x: -PIER.w / 2, z: PIER.z1 },
];
const BOAT = { x: 1.9, z: 3.2 };

function pier(b: BatchLike, lod: 0 | 2) {
  const y = deckY(), len = PIER.z1 - PIER.z0;
  b.add(BOX(), M(PIER.x, y - 0.14, (PIER.z0 + PIER.z1) / 2, 0, PIER.w, 0.14, len), WOOD);
  b.add(BOX(), M(PIER.x, y - 0.14, PIER.z1 + PIER.end.d / 2, 0, PIER.end.w, 0.14, PIER.end.d), WOOD);
  if (lod === 2) return;
  // pilings down into the lake, rails along both sides and round the end
  for (let z = PIER.z0 + 1.2; z <= PIER.z1 + 0.01; z += 2.0) for (const s of [-1, 1]) b.add(BOX(), M(s * (PIER.w / 2 - 0.08), -0.8, z, 0, 0.16, y + 0.66, 0.16), WOOD_DARK);
  for (const s of [-1, 1]) {
    b.beam(new THREE.Vector3(s * (PIER.w / 2 - 0.05), y + 0.85, PIER.z0 + 1.0), new THREE.Vector3(s * (PIER.w / 2 - 0.05), y + 0.85, PIER.z1), 0.06, 0.08, WOOD_DARK);
    b.add(BOX(), M(s * (PIER.end.w / 2 - 0.05), y - 0.1, PIER.z1 + PIER.end.d / 2, 0, 0.08, 0.95, PIER.end.d), WOOD_DARK);
  }
  b.add(BOX(), M(0, y - 0.1, PIER.z1 + PIER.end.d - 0.05, 0, PIER.end.w, 0.95, 0.08), WOOD_DARK);
  bench(b, 0, y, PIER.z1 + PIER.end.d - 0.55, Math.PI);
}

/** a grey heron at the water's edge (18 triangles): body, neck, head with bill, legs */
function heron(b: BatchLike, x: number, z: number, h: number) {
  const y = g.at(x, z);
  b.add(CBOX(), M(x, y + 0.75, z, h, 0.2, 0.22, 0.5, 0.2), '#8c949a');
  b.add(CBOX(), M(x + Math.sin(h) * 0.22, y + 1.02, z + Math.cos(h) * 0.22, h, 0.07, 0.4, 0.07, 0.35), '#b8bec2');
  b.add(CBOX(), M(x + Math.sin(h) * 0.35, y + 1.22, z + Math.cos(h) * 0.35, h, 0.08, 0.08, 0.3), '#d9a441');
  b.add(BOX(), M(x, y - 0.1, z, h, 0.05, 0.7, 0.05), '#6b6258');
}

function build(b: BatchLike, lod: 0 | 2) {
  pier(b, lod);
  if (lod === 2) return;
  for (const [x, z, ry] of [[-3.4, -2.6, 0.1], [3.6, -2.4, -0.1]] as const) bench(b, x, g.at(x, z), z, ry);
  bin(b, -2.0, g.at(-2.0, -3.0), -3.0);
  // the notice board at the path's foot (blank: no text)
  for (const s of [-0.5, 0.5]) b.add(BOX(), M(1.7 + s, g.at(1.7, -3.4) - 0.1, -3.4, 0, 0.1, 1.8, 0.1), WOOD_DARK);
  b.add(BOX(), M(1.7, g.at(1.7, -3.4) + 1.0, -3.4, 0, 1.3, 0.8, 0.08), '#e8dfc8');
  heron(b, -4.2, -0.2, 0.9);
}

/** the rowboat moored by the pier (the animate part, LOCAL to its mooring): hull, two thwarts, the oars shipped */
function boat(b: BatchLike) {
  b.add(CBOX(), M(0, 0.12, 0, 0, 0.9, 0.3, 2.2), '#f1ece2');
  b.add(CBOX(), M(0, 0.28, 0, 0, 0.8, 0.06, 2.0), '#2f6f8a');
  for (const z of [-0.4, 0.4]) b.add(CBOX(), M(0, 0.32, z, 0, 0.8, 0.06, 0.22), WOOD);
  b.add(CBOX(), M(0.2, 0.4, 0, 0, 0.06, 0.06, 1.9), WOOD_DARK);
}

function ground(): SiteGroundPoly[] { return gstrip([{ x: -1.8, z: -10.6 }, { x: -0.6, z: -7.0 }, { x: 0, z: -4.4 }, { x: 0, z: PIER.z0 }], 1.3, GC.path, PAT.earth, g, 1.2, 0.08); }

/** exclusion: the pier and its end platform, the shore spot with the benches and the path foot */
const EXCLUDE: Vec2[] = [{ x: -5.2, z: -4.2 }, { x: 4.8, z: -4.2 }, { x: 4.8, z: 1.0 }, { x: 2.6, z: 1.6 }, { x: 2.6, z: 7.9 }, { x: -2.2, z: 7.9 }, { x: -2.2, z: 1.2 }, { x: -5.2, z: 1.0 }];

export const lakeMerced: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  animate: {
    build: boat,
    // the moored boat rocks on the lake
    update(obj, t) { obj.position.set(BOAT.x, WATER_Y - g.base + Math.sin(t * 1.3) * 0.04, BOAT.z); obj.rotation.set(Math.sin(t * 0.9) * 0.04, 0.12, Math.sin(t * 1.1) * 0.05); },
  },
  walk: {
    blockers: [{ x: -4.2, z: -0.2, r: 0.3 }],
    surfaces: [{ poly: DECK_POLY, y: +deckY().toFixed(2), surface: 'wood' }],
  },
  ground: ground(),
  plaza: [{ poly: DECK_POLY, surface: 'wood' }, { poly: [{ x: -4.6, z: -3.8 }, { x: 4.4, z: -3.8 }, { x: 4.4, z: -1.4 }, { x: -4.6, z: -1.4 }], surface: 'grass' }],
  w4: {
    placeId: 'lake-merced',
    attractions: ['lake-merced'],
    arrival: { x: 0.4, z: -3.2, heading: 0 },
    photo: { target: [0, 0.8, 3], distance: 16, elevation: 0.3, bearing: Math.PI - 0.6 },
    flag: { x: 0, z: -2.0, h: 30 },
    height: { realM: 2, u: 1.5, top: 2.0, rule: 'overlook' },
    osm: [],
    terrain: [-6, -12, 6, 9],
    terrainStep: 1,
    notes: 'The lake is a reservoir: no swimming, no boat hire promised (the rowboat is moored). The loop and the golf courses (TPC Harding Park is public) are the city\'s.',
  },
};
