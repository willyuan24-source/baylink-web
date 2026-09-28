import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CBOX, M } from '../../builder';
import { GLOW, LIT, arch, box, gable, pyramid, rect, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, lamp, siteGround } from './siteKit';

/**
 * Fort Mason Center for Arts & Culture (wave 4, P3 · map T3, the fort-mason site): Lower Fort Mason's warehouses and
 * piers, built 1910–14 for the Army's San Francisco Port of Embarkation by Rankin, Kellogg and Crane in the Mission
 * Revival style — white stucco walls, red clay-tile roofs, long loading docks, wide loading doors, corrugated metal
 * awnings (NPS "Fort Mason Historic District"; TCLF) — now an arts campus with theatres, galleries, a museum and night
 * markets (fortmason.org). Toy version: the four landside storehouses on their OSM footprints (ways 398613752,
 * 398613751, 398609305, 288387757) with red gable roofs, rows of arched loading doors and a metal awning each, and the
 * courtyard between the middle two as a market: three stalls under coloured canopies, a lamp and benches. No venue names,
 * no event posters; the pier sheds stay the city's.
 *
 * Frame: origin (−318.0, 230.0) on the middle storehouse, yaw −34.6°: local x runs along the storehouses (x −4.4…4.6),
 * the courtyard is z −6.5…−0.5, the pier shed north of them (z ≥ 8.7) and the service lanes (x −6, x 5.7) stay.
 * Two storeys, ≈ 12 m → 5.1 u to the eaves.
 */

const ID = 'fort-mason-center';
const X0 = -318.0, Z0 = 230.0, YAW = (-34.6 * Math.PI) / 180;
const g = siteGround(ID, 0.3);

const STUCCO = '#f1ebdf', TILE = '#b95c3f', DOOR = '#5d534a', AWNING = '#8d938f';
/** the storehouses: [z0, z1, the side their doors face (−1: −z, 1: +z)] */
const HOUSES: [number, number, -1 | 1][] = [[-13.8, -10.9, 1], [-9.7, -6.5, 1], [-0.5, 2.5, -1], [3.8, 7.0, -1]];
const X_0 = -4.45, X_1 = 4.6, EAVE = 4.4;
const COURT: Vec2[] = [{ x: -4.2, z: -6.2 }, { x: 4.4, z: -6.2 }, { x: 4.4, z: -0.8 }, { x: -4.2, z: -0.8 }];
const STALLS: [number, number, string][] = [[-2.6, -3.5, '#c9473a'], [0.2, -3.6, '#2f8f88'], [3.0, -3.4, '#e0a94a']];

function house(b: BatchLike, [z0, z1, side]: (typeof HOUSES)[number], lod: 0 | 2) {
  const cx = (X_0 + X_1) / 2, cz = (z0 + z1) / 2, w = X_1 - X_0, d = z1 - z0, y = g.at(cx, cz);
  box(b, cx, y - 0.6, cz, w, EAVE + 0.6, d, STUCCO, GLOW(0.05));
  // lod 2: the red roofs of the outer two only (the 10 % far budget)
  if (lod === 2) { if (z0 < -12 || z1 > 6) gable(b, cx, y + EAVE, cz, w, d, 0.9, TILE, STUCCO, 0, 0.25); return; }
  gable(b, cx, y + EAVE, cz, w, d, 0.9, TILE, STUCCO, 0, 0.25);
  // wide arched loading doors along the dock side, and the corrugated metal awning over them
  const fz = side > 0 ? z1 + 0.02 : z0 - 0.02, ry = side > 0 ? 0 : Math.PI;
  for (let k = 0; k < 4; k++) arch(b, X_0 + 1.1 + k * 2.25, y, fz, 1.2, 1.9, ry, DOOR, LIT(y));
  b.add(CBOX(), M(cx, y + 2.25, fz + side * 0.45, 0, w - 0.4, 0.08, 0.9, side * 0.2), AWNING);
}

function stall(b: BatchLike, x: number, z: number, color: string) {
  const y = g.at(x, z);
  for (const [sx, sz] of [[-0.8, -0.55], [0.8, -0.55], [0.8, 0.55], [-0.8, 0.55]]) b.add(BOX(), M(x + sx, y - 0.1, z + sz, 0, 0.08, 2.1, 0.08), '#e8e2d6');
  b.add(BOX(), M(x, y - 0.1, z + 0.45, 0, 1.7, 0.95, 0.35), '#8a6a4a');
  pyramid(b, x, y + 2.0, z, 2.0, 1.5, 0.55, color);
}

function build(b: BatchLike, lod: 0 | 2) {
  for (const h of HOUSES) house(b, h, lod);
  if (lod === 2) return;
  for (const [x, z, c] of STALLS) stall(b, x, z, c);
  lamp(b, 4.0, g.at(4.0, -5.7), -5.7);
  bench(b, -1.2, g.at(-1.2, -5.8), -5.8, 0);
  bench(b, 1.8, g.at(1.8, -1.2), -1.2, Math.PI);
}

function ground(): SiteGroundPoly[] { return gfill(COURT, GC.pavers, PAT.stone, g, 3); }

const LIGHTS = [[4.0, -5.7]].map(([x, z]) => ({ x, y: g.at(x, z) + 3.8, z, size: 1, color: '#ffd9a0' }));

export const fortMasonCenter: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -4.9, z: -14.3 }, { x: 5.0, z: -14.3 }, { x: 5.0, z: 7.4 }, { x: -4.9, z: 7.4 }]) },
  build,
  walk: {
    blockers: [
      ...HOUSES.map(([z0, z1]) => ({ poly: rect((X_0 + X_1) / 2, (z0 + z1) / 2, X_1 - X_0, z1 - z0) })),
      ...STALLS.map(([x, z]) => ({ poly: rect(x, z + 0.45, 1.8, 0.45) })),
      { x: 4.0, z: -5.7, r: 0.15 },
    ],
  },
  ground: ground(),
  lights: LIGHTS,
  plaza: [{ poly: COURT, surface: 'plaza' }],
  w4: {
    placeId: 'fort-mason',
    attractions: ['fort-mason-center'],
    arrival: { x: 0.4, z: -1.9, heading: Math.PI },
    photo: { target: [0, 2.5, -3.5], distance: 20, elevation: 0.45, bearing: 0.4 },
    flag: { x: 0.1, z: -3.4, h: 30 },
    height: { realM: 12, u: 5.1, top: 5.6, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/398613752', 'way/398613751', 'way/398609305', 'way/288387757'],
    terrain: [-6, -15, 6, 9],
    notes: 'No venue names or event posters (the night markets\' dates change: lane C\'s card).',
  },
};
