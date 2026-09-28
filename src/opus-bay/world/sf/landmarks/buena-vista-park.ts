import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { ngon, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, gstrip, plazaOf } from './siteKit';
import { box3, lowWall, markerStone, signBoard, site3Ground } from './siteKit3';

/**
 * Buena Vista Park (wave 4, P4 · map T3, above the Haight): the oldest official park in San Francisco, set aside in 1867
 * as Hill Park and later renamed; 38.3 wooded acres up to a 575-ft summit with a small lawn at the top. In the 1930s
 * WPA crews lined the western paths' gutters with broken Victorian headstones from the cemeteries moved to Colma — a
 * few inscriptions can still be read (Wikipedia "Buena Vista Park"). The views reach the ocean on clear days.
 *
 * Toy: the summit clearing — the small lawn inside the loop walk (redrawn), a ring of low grey stone edging (plain: no
 * inscriptions, never a headstone shape), three benches facing out to the views, a plain summit stone and a blank park
 * board where the north steps arrive. The forest, its pines and the trails below stay the city's.
 *
 * Frame: origin (29.37, 739.57) at the centre of the summit loop (the city's footway ring, r ≈ 2.2, ground 33.7 over
 * the sea in the city data), yaw 0 (the city frame): the steps come up from the north-west (local (0.2, −2.7) and on
 * down along −z).
 */

const ID = 'buena-vista-park';
const X0 = 29.37, Z0 = 739.57, YAW = 0;
const g = site3Ground(ID, 33.6);

const STONE = '#a7a399', RING_R = 2.3;
/** the loop walk (closed), the lawn inside it */
const RING: Vec2[] = Array.from({ length: 17 }, (_, k) => ({ x: Math.sin((k / 16) * Math.PI * 2) * RING_R, z: Math.cos((k / 16) * Math.PI * 2) * RING_R }));
const LAWN: Vec2[] = ngon(0, 0, 1.65, 12);
/** the north steps' top: the entry (they go on down, the city's) */
const ENTRY: Vec2[] = [{ x: 0.3, z: -2.1 }, { x: 0.18, z: -3.5 }];
/** the trail up from the south joins the loop here */
const ENTRY_S: Vec2[] = [{ x: 0.6, z: 2.1 }, { x: 1.0, z: 3.6 }];
const BENCHES: number[] = [1.35, 2.5, 4.4];

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    box3(b, 0, g.at(0, 0) - 0.2, 0, 1.0, 0.5, 0.8, STONE);
    return;
  }
  // the stone edging outside the walk (a low kerb you step over), open where the north steps and the south trail come in
  for (let k = 0; k < 8; k++) {
    if (k === 0 || k === 3) continue;
    const a0 = (k / 8) * Math.PI * 2 + 0.12, a1 = ((k + 1) / 8) * Math.PI * 2 - 0.12, r = RING_R + 0.72;
    const p = { x: Math.sin(a0) * r, z: Math.cos(a0) * r }, q = { x: Math.sin(a1) * r, z: Math.cos(a1) * r };
    lowWall(b, p, q, g.at(p.x, p.z), g.at(q.x, q.z), 0.28, 0.28, STONE);
  }
  // three benches just outside the walk, facing out to the views
  for (const a of BENCHES) {
    const r = RING_R + 0.95, x = Math.sin(a) * r, z = Math.cos(a) * r;
    bench(b, x, g.at(x, z), z, a);
  }
  markerStone(b, 0, g.at(0, 0), 0, Math.PI, 0.9);
  signBoard(b, 1.2, g.at(1.2, -3.0), -3.0, Math.PI, 1.0, 0.6, 0.7, '#e2d8c0', '#5d4a38');
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(LAWN, GC.lawn, PAT.grass, g, 2, 0.08),
    ...gstrip(RING, 1.15, GC.path, PAT.earth, g, 1.5, 0.08),
    ...gstrip(ENTRY, 1.3, GC.path, PAT.earth, g, 2, 0.08),
    ...gstrip(ENTRY_S, 1.2, GC.path, PAT.earth, g, 2, 0.08),
  ];
}

export const buenaVistaPark: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, ngon(0, 0, 3.55, 16)) },
  build,
  walk: {
    blockers: [
      { x: 0, z: 0, r: 0.45 },
      { x: 1.2, z: -3.0, r: 0.2 },
      ...BENCHES.map(a => ({ x: Math.sin(a) * (RING_R + 0.95), z: Math.cos(a) * (RING_R + 0.95), r: 0.4 })),
    ],
  },
  ground: ground(),
  plaza: [plazaOf(ngon(0, 0, 3.2, 16), 'grass')],
  w4: {
    placeId: 'osm-w7459901',
    attractions: ['buena-vista-park'],
    arrival: { x: 0.25, z: -2.95, heading: 0 },
    photo: { target: [0, 1.0, 0], distance: 11, elevation: 0.55, bearing: Math.PI + 0.4 },
    flag: { x: 0, z: 0.4, h: 30 },
    height: { realM: 0, u: 1.0, top: 2.36, rule: 'overlook' },
    osm: ['way/7459901', 'node/358803216'],
    terrain: [-4, -4, 4, 4],
    terrainStep: 1,
    ringMin: 0.7,
    notes: 'The WPA gutters\' headstones are never shown (plain stone edging only). A summit in the forest: the crowd spots are the clearing, and the pines and steep slopes round it close the walk-around ring to 72 %.',
  },
};
