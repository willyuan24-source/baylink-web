import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { LIT, box, worldPoly } from './kit';
import type { W4Site } from './siteKit';
import { box3, colourPanel, site3Ground, standSpot } from './siteKit3';

/**
 * The Women's Building (wave 4, P4 · map T3, the Mission): 3543 18th Street at Lapidge Street, a 1910 hall that is
 * home to the nonprofit Women's Building, covered on its 18th Street and Lapidge Street sides by MaestraPeace (1994),
 * a five-storey mural by seven women artists — Juana Alicia, Miranda Bergman, Edythe Boone, Susan Kelk Cervantes, Meera
 * Desai, Yvonne Littleton and Irene Perez, with Olivia Quevedo and about 100 volunteers — honouring women's
 * contributions around the world; the muralists cleaned and restored it in 2012 (womensbuilding.org "The Mural";
 * Wikipedia "The Women's Building (San Francisco)").
 *
 * The mural is copyrighted: the toy never copies it. Toy: the building on its OSM footprint (way 260194175) with both
 * street faces washed in ABSTRACT colour fields (tall bands in warm and cool colours, no figures, no text), a cornice,
 * a row of windows between the fields and the entrance on 18th Street.
 *
 * Frame: origin (261.6, 640.96) at the building's centre, yaw −129.7°: local +z faces 18th Street (centreline z 3.47,
 * 4.4 u wide), −x faces Lapidge Street (x −3.64), Linda Street runs at x 3.0; the neighbour behind (z < −1.94) is the
 * city's. Height: 17 m (the footprint's OSM tag) → 5.84 u, as the city drew it; the mural covers all five storeys.
 */

const ID = 'womens-building';
const X0 = 261.6, Z0 = 640.96, YAW = (-129.7 * Math.PI) / 180;
const g = site3Ground(ID, 2.45);

const B = { x0: -1.84, x1: 1.0, z0: -1.94, z1: 1.28 }, H = 5.6;
/** abstract fields, bottom → top (no imagery): the 18th Street face left → right, then the Lapidge face */
const FIELDS = ['#d9534f', '#f0ad4e', '#2f8f88', '#7a4fa0', '#e8d44d', '#4f7fbf', '#c94f7c', '#8cc152'];
const GLASS = '#3b4750', CORNICE = '#efe6d2';

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(0, 0);
  const cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, w = B.x1 - B.x0, d = B.z1 - B.z0;
  box(b, cx, y0 - 1.0, cz, w, H + 1.0, d, '#e9dcc4', lod === 0 ? [5, y0, -2, 0] : LIT(y0));
  if (lod === 2) return;
  box(b, cx, y0 + H - 0.05, cz, w + 0.14, 0.28, d + 0.14, CORNICE);
  // the 18th Street face (+z): four tall two-tone fields, the entrance in the middle
  const fz = B.z1 + 0.04;
  for (let k = 0; k < 4; k++) {
    const x = B.x0 + (w * (k + 0.5)) / 4;
    colourPanel(b, x, y0 + (k === 1 ? 1.5 : 0.2), fz, 0, w / 4 - 0.02, H - (k === 1 ? 1.75 : 0.45), FIELDS[k], FIELDS[(k + 3) % 8], 0.45 + (k % 2) * 0.2, 0.06);
  }
  box(b, B.x0 + (w * 1.5) / 4, y0, fz + 0.02, 0.6, 1.3, 0.04, '#5e3f2f', [0, 0, 0, 0]);
  box(b, B.x0 + (w * 1.5) / 4, y0 + 1.3, fz + 0.2, 1.0, 0.1, 0.4, CORNICE);
  // the Lapidge Street face (−x): five fields along it
  const fx = B.x0 - 0.04;
  for (let k = 0; k < 5; k++) {
    const z = B.z0 + (d * (k + 0.5)) / 5;
    colourPanel(b, fx, y0 + 0.2, z, -Math.PI / 2, d / 5 - 0.02, H - 0.45, FIELDS[(k + 4) % 8], FIELDS[(k + 6) % 8], 0.35 + (k % 3) * 0.15, 0.06);
  }
  // a band of windows under the cornice on both faces (lit at night)
  for (let k = 0; k < 4; k++) box(b, B.x0 + (w * (k + 0.5)) / 4, y0 + H - 0.85, fz + 0.05, 0.4, 0.5, 0.03, GLASS, LIT(y0));
  for (let k = 0; k < 5; k++) box(b, fx - 0.05, y0 + H - 0.85, B.z0 + (d * (k + 0.5)) / 5, 0.03, 0.5, 0.36, GLASS, LIT(y0));
  // the Linda Street side stays plain; a blank sign blade over the entrance (no text)
  box3(b, B.x1 + 0.03, y0 + 2.2, 0.6, 0.05, 1.4, 0.3, CORNICE);
}

/**
 * the crowd's stand spots on the sidewalks along the painted faces: 18th Street's (≈ 0.6 u at z 1.4…2.0, carriageway
 * from 2.1) and Lapidge Street's (≈ 0.45 u at x ≈ −2.2, driveway cuts): the early record's strips put every spot in
 * the near lanes of both streets (W4-L3-review)
 */
const WALKS: Vec2[] = [{ x: 0.6, z: 1.8 }, { x: -2.2, z: -1.5 }, { x: -2.2, z: -4.2 }, { x: -2.2, z: -5.5 }];

export const womensBuilding: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: B.x0 - 0.05, z: B.z0 + 0.02 }, { x: B.x1 + 0.05, z: B.z0 + 0.02 }, { x: B.x1 + 0.05, z: B.z1 + 0.05 }, { x: B.x0 - 0.05, z: B.z1 + 0.05 }]) },
  build,
  walk: { blockers: [{ poly: [{ x: B.x0, z: B.z0 }, { x: B.x1, z: B.z0 }, { x: B.x1, z: B.z1 }, { x: B.x0, z: B.z1 }] }] },
  lights: [{ x: B.x0 + 1.07, y: g.at(-1.1, 1.6) + 1.4, z: 1.6, size: 1.2, color: '#ffe0b0' }],
  plaza: WALKS.map(p => standSpot(p)),
  w4: {
    placeId: 'womens-building',
    attractions: ['womens-building'],
    // W5-L1: across Lapidge St at the 18th Street corner, both painted faces in view (the old spot stood in 18th Street's
    // lane, where the toy traffic stops for the player)
    arrival: { x: -4.9, z: 1.5, heading: 1.87 },
    photo: { target: [-0.4, 2.8, 0], distance: 13, elevation: 0.15, bearing: -0.75 },
    flag: { x: -0.4, z: -0.3, h: 30 },
    height: { realM: 17, u: 5.84, top: 5.9, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/260194175'],
    terrain: [-3, -3, 2, 3],
    terrainStep: 1,
    ringMin: 0.7,
    notes: 'MaestraPeace is never copied: the painted faces are abstract colour fields. The crowd spots are points on the 18th and Lapidge Street sidewalks (never the carriageway); the attached neighbour behind closes the walk-around ring to 72 %.',
  },
};
