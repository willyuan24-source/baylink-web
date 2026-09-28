import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CBOX, ICO, M } from '../../builder';
import { worldPoly } from './kit';
import { type W4Site, siteGround } from './siteKit';

/**
 * Baker Beach (wave 4, P3 · map T2, the baker-beach site): the half-mile beach below the Presidio's sea cliffs with the
 * classic low-angle view of the Golden Gate Bridge (Wikipedia; the scouting). The sand, the dunes and Battery Chamberlin
 * (the 1904 gun battery, OSM way 421294976, 27 u up the beach) are the city's; this site is the view spot on the sand
 * where the trips end: driftwood logs to sit on facing the bridge, a few rocks, and a blank post (the surf is
 * dangerous: never a swimming prompt). No people are drawn (part of the beach is clothing-optional).
 *
 * Frame: origin (−614.0, 849.3) at the attraction on the sand, yaw 0 (local = world offsets): the surf line runs at
 * x ≈ −1.5 (the sea west), the sand to x ≈ 6, the parking lot and the Coastal Trail inland (east). The Golden Gate
 * Bridge's south tower lies along (−0.34, −0.94).
 */

const ID = 'baker-beach';
const X0 = -614.0, Z0 = 849.3, YAW = 0;
const g = siteGround(ID, 0);

const DRIFT = '#b9a58f', DRIFT_DARK = '#9a8468';
/** driftwood logs: [x, z, heading, length] — the two by the water face the bridge */
const LOGS: [number, number, number, number][] = [[1.6, 0.4, 2.8, 2.6], [3.0, -1.6, 0.4, 2.2], [2.4, 2.6, -1.2, 1.8], [4.6, 0.8, 1.9, 2.0]];
const TO_BRIDGE = Math.atan2(-0.34, -0.94);

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) { const [x, z, h, L] = LOGS[0]; b.add(CBOX(), M(x, g.at(x, z) + 0.2, z, h, 0.5, 0.45, L), DRIFT); return; }
  for (const [k, [x, z, h, L]] of LOGS.entries()) b.add(CBOX(), M(x, g.at(x, z) + 0.18, z, h, 0.42, 0.38, L, 0, (k % 2 ? 0.08 : -0.06)), k % 2 ? DRIFT_DARK : DRIFT);
  for (const [k, [x, z, s]] of ([[0.2, -3.2, 0.5], [0.8, -3.9, 0.35], [5.4, 3.4, 0.6]] as const).entries()) b.add(ICO(0), M(x, g.at(x, z) + s * 0.3, z, k * 1.7, s, s * 0.7, s * 0.9), '#8f8a82');
  // the blank post (the currents are dangerous; the card says so, the post has no text)
  const px = 5.2, pz = -2.4, py = g.at(px, pz);
  b.add(BOX(), M(px, py - 0.2, pz, TO_BRIDGE, 0.1, 2.2, 0.1), '#6d6a62');
  b.add(BOX(), M(px, py + 1.4, pz, TO_BRIDGE, 0.8, 0.6, 0.06), '#e8b64a');
}

const EXCLUDE: Vec2[] = [{ x: -0.6, z: -4.6 }, { x: 6.2, z: -4.6 }, { x: 6.2, z: 4.4 }, { x: -0.6, z: 4.4 }];

export const bakerBeach: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: [{ x: 5.2, z: -2.4, r: 0.12 }, { x: 5.4, z: 3.4, r: 0.5 }] },
  plaza: [{ poly: [{ x: 0.0, z: -4.2 }, { x: 5.8, z: -4.2 }, { x: 5.8, z: 4.0 }, { x: 0.0, z: 4.0 }], surface: 'sand' }],
  w4: {
    placeId: 'baker-beach',
    attractions: ['baker-beach'],
    arrival: { x: 2.2, z: -0.6, heading: TO_BRIDGE },
    // from behind the logs along the beach to the bridge (camera south-east of the target, looking north-west)
    photo: { target: [-4.1, 2.5, -11.3], distance: 16, elevation: 0.12, bearing: Math.atan2(0.34, 0.94) },
    flag: { x: 2.4, z: 0.2, h: 30 },
    height: { realM: 1, u: 1, top: 3.2, rule: 'overlook' },
    osm: [],
    terrain: [-2, -6, 8, 6],
    notes: 'Never a swimming prompt (dangerous surf). No people drawn: part of Baker Beach is clothing-optional. Battery Chamberlin stays the city\'s building (a card may name it).',
  },
};
