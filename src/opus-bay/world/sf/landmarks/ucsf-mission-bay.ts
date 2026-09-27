import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CYL, ICO, M } from '../../builder';
import { worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, gstrip, lamp, plazaOf, siteGround } from './siteKit';

/**
 * UCSF Mission Bay · Koret Quad (wave 4, P1 · map T2, the owner's request): the green heart of UCSF's 57.9-acre
 * research and hospital campus on the old rail yards (from 1999; the children's, women's and cancer hospitals opened
 * in 2015, next to Chase Center; ucsf.edu/about/locations/mission-bay). The lab towers around it are city buildings;
 * this is the quad itself: the oval lawn and the west lawn, the paved cross walk, rows of trees, benches and lamps.
 *
 * Frame: origin (450.03, 295.25) on Koret Quad (OSM way 84821725), yaw 50.3°: the quad is x −9.65…9.65, z −6.4…6.4,
 * framed by pedestrian ways — Merrimac St (x −10.3), The Feeney Way (z 6.9), Gene Friend Way (z −6.9) — and 4th St
 * (x 11.2), which all stay the city's (the exclusion keeps their full width). Flat reclaimed ground (0.2–0.5 u).
 */

const ID = 'ucsf-mission-bay';
const X0 = 450.03, Z0 = 295.25, YAW = (50.3 * Math.PI) / 180;
const g = siteGround(ID, 0.2);

const QUAD: Vec2[] = [{ x: -9.3, z: -5.95 }, { x: 9.5, z: -5.95 }, { x: 9.5, z: 5.95 }, { x: -9.3, z: 5.95 }];
/** the oval lawn (east) and the west lawn, the paved walks between them */
const OVAL: Vec2[] = Array.from({ length: 16 }, (_, k) => { const a = (k / 16) * Math.PI * 2; return { x: 5.2 + Math.cos(a) * 3.7, z: 0.2 + Math.sin(a) * 4.6 }; });
const WEST: Vec2[] = [{ x: -8.5, z: -4.9 }, { x: -1.0, z: -4.9 }, { x: -1.0, z: 4.9 }, { x: -8.5, z: 4.9 }];
const WALKS: Vec2[][] = [[{ x: 0.2, z: -5.9 }, { x: 0.2, z: 5.9 }], [{ x: -9.2, z: 0.0 }, { x: 0.2, z: 0.0 }]];
const TREES: [number, number][] = [[-8.6, -5.4], [-4.6, -5.4], [-0.6, -5.4], [-8.6, 5.4], [-4.6, 5.4], [-0.6, 5.4]];
const LAMPS: Vec2[] = [{ x: 0.9, z: -3.0 }, { x: 0.9, z: 3.0 }];
const BENCHES: [number, number, number][] = [[-2.8, -0.9, Math.PI], [-6.4, 0.9, 0], [1.6, 1.4, Math.PI / 2]];

/**
 * A clipped street tree of the quad's two rows: trunk and one crown (36 triangles; siteKit.tree's two-blob crown is
 * 60). The T3 cap counts the draped ground and the lawns follow the ground's bumps on small cells (W4-L-review).
 */
function rowTree(b: BatchLike, x: number, y: number, z: number, k: number) {
  b.add(CYL(4), M(x, y - 0.2, z, 0, 0.17, 2.2, 0.17), FC.trunk);
  b.add(ICO(0), M(x, y + 2.6, z, k, 1.3, 1.15, 1.3), k % 2 ? FC.tree : FC.treeDark, [0, 0, 0.3, 0]);
}

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    // far: the two tree rows as green bars (the lawn is ground)
    for (const z of [-5.4, 5.4]) b.add(BOX(), M(-4.6, g.at(-4.6, z) + 1.6, z, 0, 9.0, 1.8, 1.6), FC.tree);
    return;
  }
  for (const [k, [x, z]] of TREES.entries()) rowTree(b, x, g.at(x, z), z, k);
  for (const l of LAMPS) lamp(b, l.x, g.at(l.x, l.z), l.z);
  for (const [x, z, ry] of BENCHES) bench(b, x, g.at(x, z), z, ry);
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(QUAD, GC.plaza, PAT.stone, g, 2.5),
    ...gfill(OVAL, GC.lawn, PAT.grass, g, 2, 0.075),
    ...gfill(WEST, GC.lawnDeep, PAT.grass, g, 4, 0.075),
    ...WALKS.flatMap(w => gstrip(w, 1.6, GC.pavers, PAT.stone, g, 4, 0.09)),
  ];
}

export const ucsfMissionBay: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -9.4, z: -6.05 }, { x: 9.6, z: -6.05 }, { x: 9.6, z: 6.05 }, { x: -9.4, z: 6.05 }]) },
  build,
  walk: {
    blockers: TREES.map(([x, z]) => ({ x, z, r: 0.3 })),
    surfaces: [{ poly: OVAL, y: 'terrain', surface: 'grass' }, { poly: WEST, y: 'terrain', surface: 'grass' }, { poly: QUAD, y: 'terrain', surface: 'plaza' }],
  },
  ground: ground(),
  lights: LAMPS.map(l => ({ x: l.x, y: g.at(l.x, l.z) + 3.8, z: l.z, size: 1, color: '#ffd9a0' })),
  plaza: [plazaOf(QUAD)],
  w4: {
    placeId: 'ucsf-mission-bay',
    attractions: ['ucsf-mission-bay'],
    lod0R: 220,
    ringMin: 0.7,
    arrival: { x: 0.2, z: 4.6, heading: Math.PI },
    photo: { target: [0, 2, 0], distance: 30, elevation: 0.45, bearing: 0.8 },
    flag: { x: 5.2, z: 0.2, h: 30 },
    height: { realM: 0, u: 3.2, rule: 'ground' },
    osm: ['way/84821725'],
    terrain: [-11, -8, 11, 8],
    notes: "The lab towers and hospitals around the quad stay city buildings (their walls close the walk-around ring to 72 %); the card anchor is the Community Center on the south side.",
  },
};
