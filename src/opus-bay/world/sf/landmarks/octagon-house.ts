import type { Vec2 } from '../../../core/types';
import { type BatchLike, CONE, CYL, M } from '../../builder';
import { LIT, box, ngon, worldPoly } from './kit';
import type { W4Site } from './siteKit';
import { box3, signBoard, site3Ground, standSpot } from './siteKit3';

/**
 * Octagon House (wave 4, P4 · map T3, Cow Hollow): an eight-sided wooden house of 1861 built for William C. McElroy and
 * Harriet Shober, first on the south-east corner of Union and Gough, now at 2645 Gough Street; the National Society of
 * The Colonial Dames of America in California saved it from demolition in 1952, and it is their small museum of
 * Colonial and Federal period decorative arts, with a garden, open the second and fourth Sundays, noon–3 pm, February to
 * November (nscda-ca.org "Octagon House"; check before going).
 *
 * Toy: the octagonal two-storey body on its OSM footprint (way 243512313, 1.8 u across), a window in every face on
 * both floors, the low eight-sided roof with its cupola, the entrance portico with two columns and a pediment toward
 * Gough Street, the stoop, and a blank museum plaque (no text). Colours are a toy choice.
 *
 * Frame: origin (−184.18, 291.85) at the house's centre, yaw 145.2°: local +z faces Gough Street (centreline z 2.8,
 * 4.4 u wide), Union Street runs along x = 4.9; the neighbours behind (x > −1.2, z < −1.1) and Allyne Park
 * (x < −1.3) stay the city's.
 */

const ID = 'octagon-house';
const X0 = -184.18, Z0 = 291.85, YAW = (145.2 * Math.PI) / 180;
const g = site3Ground(ID, 6.2);

const BODY = '#e8e0cc', TRIM = '#8c9a8a', ROOF = '#5c5f5b', GLASS = '#3b4750';
const R = 0.95, WALL = 3.2;

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(0, 0);
  // the octagon: CYL(8) with a flat face toward +z (a 22.5° turn), the eight-sided roof and the cupola
  const turn = Math.PI / 8;
  if (lod === 2) {
    box3(b, 0, y0 - 1.0, 0, R * 1.9, WALL + 1.0, R * 1.9, BODY, 0, LIT(y0));
    b.add(CONE(4), M(0, y0 + WALL, 0, Math.PI / 4, R * 1.5, 0.9, R * 1.5), ROOF);
    return;
  }
  b.add(CYL(8), M(0, y0 - 1.0, 0, turn, R / Math.cos(Math.PI / 8), WALL + 1.0, R / Math.cos(Math.PI / 8)), BODY, [5, y0, -2, 0]);
  b.add(CONE(8), M(0, y0 + WALL, 0, turn, (R + 0.18) / Math.cos(Math.PI / 8), 0.75, (R + 0.18) / Math.cos(Math.PI / 8)), ROOF);
  b.add(CYL(8), M(0, y0 + WALL + 0.45, 0, turn, 0.36, 0.6, 0.36), BODY, LIT(y0));
  b.add(CONE(8), M(0, y0 + WALL + 1.05, 0, turn, 0.45, 0.4, 0.45), ROOF);
  // a cornice band and a window in each face on both floors (the +z face has the door below)
  b.add(CYL(8), M(0, y0 + WALL - 0.18, 0, turn, (R + 0.05) / Math.cos(Math.PI / 8), 0.18, (R + 0.05) / Math.cos(Math.PI / 8)), TRIM);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, x = Math.sin(a) * (R + 0.01), z = Math.cos(a) * (R + 0.01);
    for (const fy of k === 0 ? [1.85] : [0.55, 1.85]) box(b, x, y0 + fy, z, 0.34, 0.85, 0.04, GLASS, LIT(y0), a);
  }
  // the portico on Gough Street: two columns, the pediment slab, the door, the stoop
  for (const x of [-0.45, 0.45]) box3(b, x, y0 - 0.1, R + 0.28, 0.12, 1.6, 0.12, '#f4f0e6');
  box3(b, 0, y0 + 1.5, R + 0.12, 1.2, 0.18, 0.45, TRIM);
  box(b, 0, y0 + 0.2, R + 0.01, 0.5, 1.1, 0.04, '#5e4a38', [0, 0, 0, 0]);
  box3(b, 0, y0 - 0.25, R + 0.25, 0.9, 0.35, 0.3, '#b9ad98');
  signBoard(b, -0.95, g.at(-0.95, 0.75), 0.75, 0, 0.5, 0.35, 0.5, '#6d5b3f', '#3f3a33');
}

/**
 * the crowd's stand spots on the Gough Street sidewalk (a strip ≈ 0.4 u wide at z ≈ 0.95 along Allyne Park and the
 * house; the carriageway starts at z ≈ 1.1, and the Union Street side has no free sidewalk beside the neighbours): the
 * early record's strips put every spot in the traffic lanes of Gough and Union (W4-L3-review)
 */
const WALKS: Vec2[] = [{ x: -6.0, z: 0.95 }, { x: -4.0, z: 0.95 }, { x: -2.2, z: 0.95 }, { x: 1.2, z: 0.95 }, { x: 2.2, z: 0.95 }];

export const octagonHouse: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -1.05, z: -0.95 }, { x: 1.05, z: -0.95 }, { x: 1.05, z: 0.9 }, { x: -1.05, z: 0.9 }]) },
  build,
  walk: { blockers: [{ poly: ngon(0, 0, R + 0.02, 8, Math.PI / 8) }, { x: -0.95, z: 0.75, r: 0.2 }] },
  tall: [{ x: 0, z: 0, r: 0.5 }],
  lights: [{ x: 0, y: g.at(0, 1.2) + 1.6, z: 1.2, size: 1.2, color: '#ffe0b0' }],
  plaza: WALKS.map(p => standSpot(p)),
  w4: {
    placeId: 'octagon-house',
    attractions: ['octagon-house'],
    // (W4-L-int-review: across Gough St on its far sidewalk; it stood on Gough St's asphalt)
    arrival: { x: 1, z: 4.5, heading: -2.93 },
    photo: { target: [0, 2.0, 0], distance: 12, elevation: 0.2, bearing: 0.6 },
    flag: { x: 0, z: -0.3, h: 30 },
    height: { realM: 8, u: 4.44, top: 4.81, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/243512313'],
    terrain: [-2, -2, 2, 2],
    terrainStep: 1,
    notes: 'A small house museum on a corner: the crowd spots are points on the Gough Street sidewalk (never the carriageway). The height is the footprint\'s OSM tag (8 m, two storeys). Paint colours are a toy choice.',
  },
};
