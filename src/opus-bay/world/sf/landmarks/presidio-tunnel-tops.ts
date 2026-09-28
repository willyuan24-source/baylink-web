import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CBOX, ICO, M } from '../../builder';
import { NONE, box, lathe, pyramid, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, gfill, siteGround } from './siteKit';

/**
 * Presidio Tunnel Tops (wave 4, P3 · map T2, the presidio site): fourteen acres of free parkland built over the Presidio
 * Parkway tunnels and opened in July 2022, between the Main Post and Crissy Field, with big Golden Gate views, the
 * Field Station and the Presidio Visitor Center beside it (presidio.gov; Parks Conservancy; SFGate). This site is the
 * Outpost, its nature playground "inspired by nature and history" (OSM way 1079120005): a timber lookout fort with a
 * slide, a woven-branch nest, a log climber and boulders on a sandy play floor, with picnic tables at its edge.
 * The Campfire Circle and the lawns are the city's park ground (their exact places are not mapped).
 *
 * Frame: origin (−499.87, 488.93) at the Outpost, yaw 0 (local = world offsets). The city's terrain is flat here
 * (≈ 0.0; the tunnel lid is not modelled), Mason St passes diagonally west of the play area (its centreline through
 * (−9.6, 6.6) heading (0.57, −0.821)); the Field Station is 12 u east.
 */

const ID = 'presidio-tunnel-tops';
const X0 = -499.87, Z0 = 488.93, YAW = 0;
const g = siteGround(ID, 0);

const WOOD = '#9a7454', WOOD_DARK = '#6f5540', ROOF = '#5f6663', TWIG = '#8a6446';
const FORT = { x: 2.6, z: 2.6, w: 2.2, deck: 1.6 };
const NEST = { x: 3.6, z: -3.4, r: 1.35 };
const PLAY: Vec2[] = [{ x: -2.4, z: 5.4 }, { x: 5.9, z: 5.4 }, { x: 5.9, z: -6.6 }, { x: 3.9, z: -7.2 }, { x: 0.4, z: -2.2 }, { x: -2.4, z: 1.9 }];

function fort(b: BatchLike, lod: 0 | 2) {
  const y = g.at(FORT.x, FORT.z), h = FORT.w / 2;
  if (lod === 2) { box(b, FORT.x, y, FORT.z, FORT.w, FORT.deck + 1.6, FORT.w, WOOD); return; }
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(b, FORT.x + sx * (h - 0.1), y - 0.2, FORT.z + sz * (h - 0.1), 0.2, FORT.deck + 1.8, 0.2, WOOD_DARK);
  box(b, FORT.x, y + FORT.deck - 0.15, FORT.z, FORT.w, 0.15, FORT.w, WOOD);
  // the low plank walls on three sides of the deck, open toward the slide
  box(b, FORT.x, y + FORT.deck, FORT.z - h + 0.05, FORT.w, 0.6, 0.1, WOOD);
  box(b, FORT.x - h + 0.05, y + FORT.deck, FORT.z, 0.1, 0.6, FORT.w, WOOD);
  box(b, FORT.x, y + FORT.deck, FORT.z + h - 0.05, FORT.w, 0.6, 0.1, WOOD);
  pyramid(b, FORT.x, y + FORT.deck + 1.6, FORT.z, FORT.w + 0.4, FORT.w + 0.4, 1.0, ROOF);
  // the slide down the open side, the ladder up the back
  b.add(CBOX(), M(FORT.x + h + 0.9, y + FORT.deck / 2, FORT.z, Math.PI / 2, 0.7, 0.1, 2.3, -0.72), '#e0b04e');
  for (let k = 0; k < 4; k++) b.add(BOX(), M(FORT.x - h - 0.2, y + 0.3 + k * 0.4, FORT.z, 0, 0.08, 0.06, 0.7), WOOD_DARK);
}

function build(b: BatchLike, lod: 0 | 2) {
  fort(b, lod);
  if (lod === 2) return;
  // the woven-branch nest
  lathe(b, [[NEST.r, 0], [NEST.r * 0.95, 0.55], [NEST.r * 0.6, 1.15], [0.35, 1.3]], NEST.x, g.at(NEST.x, NEST.z) - 0.1, NEST.z, TWIG, NONE, 10);
  // a log climber (logs on their sides, zig-zagging) and boulders
  const logs: [number, number, number][] = [[-0.6, 0.9, 0.5], [0.4, 2.4, -0.7], [-0.2, 3.9, 0.9], [1.6, -1.2, -0.2]];
  for (const [x, z, ry] of logs) b.add(CBOX(), M(x, g.at(x, z) + 0.28, z, ry, 0.5, 0.5, 2.1), '#7a5a3e');
  for (const [k, [x, z, s]] of ([[5.0, -1.2, 0.7], [-1.4, 4.6, 0.55], [3.0, -5.9, 0.8]] as const).entries()) b.add(ICO(0), M(x, g.at(x, z) + s * 0.35, z, k, s, s * 0.7, s * 0.9), '#b7ae9e');
  // picnic tables at the edge of the play area (top, two benches)
  for (const [x, z, ry] of [[5.0, 4.4, 0.3], [-1.4, 3.0, -0.4]] as const) {
    const y = g.at(x, z);
    b.add(BOX(), M(x, y - 0.1, z, ry, 1.6, 0.85, 0.7), WOOD);
    for (const s of [-0.62, 0.62]) b.add(BOX(), M(x + Math.sin(ry) * s, y - 0.1, z + Math.cos(ry) * s, ry, 1.6, 0.5, 0.28), WOOD_DARK);
  }
}

function ground(): SiteGroundPoly[] { return gfill(PLAY, GC.sand, PAT.none, g, 4, 0.06); }

/** exclusion: the play area east of Mason St (≥ 1.85 u from its ribbon) */
const EXCLUDE: Vec2[] = [{ x: -3.0, z: 6.0 }, { x: 6.5, z: 6.0 }, { x: 6.5, z: -8.0 }, { x: 4.0, z: -8.0 }, { x: 0.0, z: -2.2 }, { x: -3.0, z: 2.2 }];

export const presidioTunnelTops: W4Site = {
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
    blockers: [
      { poly: [{ x: FORT.x - FORT.w / 2, z: FORT.z - FORT.w / 2 }, { x: FORT.x + FORT.w / 2, z: FORT.z - FORT.w / 2 }, { x: FORT.x + FORT.w / 2, z: FORT.z + FORT.w / 2 }, { x: FORT.x - FORT.w / 2, z: FORT.z + FORT.w / 2 }] },
      { x: NEST.x, z: NEST.z, r: NEST.r },
    ],
  },
  ground: ground(),
  plaza: [{ poly: PLAY, surface: 'sand' }],
  w4: {
    placeId: 'osm-w91114607',
    attractions: ['presidio-tunnel-tops'],
    arrival: { x: 1.2, z: -0.4, heading: 0.4 },
    photo: { target: [2.5, 1.5, 1], distance: 16, elevation: 0.4, bearing: 0.9 },
    flag: { x: 1.0, z: 0.6, h: 30 },
    height: { realM: 6, u: 3.6, top: 4.2, rule: 'overlook' },
    osm: ['way/1079120005', 'way/91114607'],
    terrain: [-4, -9, 8, 7],
    notes: 'The city\'s terrain is flat here (the tunnel lid is not modelled): the Golden Gate views are the card\'s. Facility hours are seasonal (lane C).',
  },
};
