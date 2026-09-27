import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, M } from '../../builder';
import { LIT, box, rect, worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, bench, conifer, fence, gfill, gstrip, lamp, plazaOf, siteGround } from './siteKit';

/**
 * Lands End (wave 4, P2 · map T2, the Lands End site with Sutro Baths and the Cliff House): the Lands End Lookout
 * visitor center on Point Lobos Ave (OSM way 250216260, 680 Point Lobos Ave, one storey) with its forecourt, the
 * trailhead of the Coastal Trail, and the walk out to the Lands End Overlook on the cliff (OSM node 13825881781) with a
 * railed deck, a telescope and a bench — the cliff-top trail with Golden Gate views, shipwreck remains at low tide
 * below and the USS San Francisco memorial further along (nps.gov). The labyrinth is never promised.
 *
 * Frame: origin (−703.2, 1231.2) at the Lookout, yaw 79.3°: local +z faces Point Lobos Ave (centreline z 5.3,
 * 5.6 wide), +x runs north along it; the overlook is at (2.8, −13.0) toward the ocean. The Merrie Way parking lot's
 * service lanes north of the Lookout stay the city's. The Lookout: 6 m → 3.6 u under a wide flat roof.
 */

const ID = 'lands-end';
const X0 = -703.2, Z0 = 1231.2, YAW = (79.3 * Math.PI) / 180;
const g = siteGround(ID, 9.5);

const WOOD = '#9a7454', WOOD_DARK = '#7a5a40', GLASS = '#8fb3bb', ROOF = '#5f6663', STONE = '#cfc6b4';
const LOOKOUT = { x: 0, z: 0.25, w: 3.2, d: 4.2 };
const COURT: Vec2[] = [{ x: -2.2, z: 2.65 }, { x: 3.4, z: 2.65 }, { x: 3.4, z: -1.2 }, { x: 1.9, z: -1.2 }, { x: 1.9, z: 2.3 }, { x: -2.2, z: 2.3 }];
/** the trail corridor from the Lookout to the overlook (crowd spots) */
const TRAIL_BAND: Vec2[] = [{ x: -2.0, z: -2.4 }, { x: -0.4, z: -2.8 }, { x: 3.2, z: -11.6 }, { x: 1.6, z: -11.6 }];
const TRAIL: Vec2[] = [{ x: -1.2, z: -1.6 }, { x: 0.4, z: -6.0 }, { x: 2.2, z: -10.2 }, { x: 2.8, z: -11.6 }];
const DECK: Vec2[] = [{ x: 0.8, z: -11.6 }, { x: 4.8, z: -11.6 }, { x: 5.2, z: -14.4 }, { x: 0.4, z: -14.4 }];
const RAIL: Vec2[] = [{ x: 0.5, z: -14.3 }, { x: 2.8, z: -14.9 }, { x: 5.1, z: -14.3 }];

function lookout(b: BatchLike, lod: 0 | 2) {
  const { x, z, w, d } = LOOKOUT, y0 = g.at(x, z);
  box(b, x, -1.2, z, w, y0 + 3.2 + 1.2, d, WOOD, lod === 0 ? [6, y0, -2.7, 0.2] : LIT(y0));
  box(b, x, y0 + 3.2, z, w + 1.6, 0.3, d + 1.4, ROOF);
  if (lod === 2) return;
  // glass on the street front, the entrance, vertical wood fins, a stone plinth
  box(b, x, y0 - 0.05, z + d / 2 + 0.03, w - 0.4, 2.6, 0.06, GLASS, LIT(y0));
  for (let k = 0; k < 5; k++) box(b, x - w / 2 + 0.3 + k * ((w - 0.6) / 4), y0, z + d / 2 + 0.08, 0.1, 3.0, 0.1, WOOD_DARK);
  box(b, x, -1.2, z, w + 0.2, y0 + 1.4, d + 0.2, STONE);
  // the trailhead: a map board on two posts (no text)
  const tx = -2.6, tz = -2.0, ty = g.at(tx, tz);
  for (const s of [-0.6, 0.6]) box(b, tx + s, ty - 0.1, tz, 0.1, 1.9, 0.1, WOOD_DARK);
  b.add(BOX(), M(tx, ty + 1.0, tz, 0.4, 1.4, 0.9, 0.08), '#e8dfc8');
}

function overlook(b: BatchLike) {
  fence(b, RAIL, g.at, 0.95, '#6d6a62');
  const y = g.at(2.8, -13.2);
  // a coin telescope on a post and a bench facing the sea
  box(b, 3.6, y - 0.1, -13.6, 0.12, 1.1, 0.12, '#5d6662');
  b.add(BOX(), M(3.6, y + 1.05, -13.6, 0.5, 0.2, 0.2, 0.55, -0.3), '#4f5b58');
  bench(b, 1.8, g.at(1.8, -12.4), -12.4, Math.PI);
}

function build(b: BatchLike, lod: 0 | 2) {
  lookout(b, lod);
  if (lod === 2) return;
  overlook(b);
  for (const [x, z] of [[2.7, 0.2]] as const) bench(b, x, g.at(x, z), z, -Math.PI / 2);
  lamp(b, 3.1, g.at(3.1, -1.4), -1.4);
  for (const [k, [x, z]] of ([[-2.8, -6.4], [4.4, -7.6], [-1.6, -10.2]] as const).entries()) conifer(b, x, g.at(x, z), z, 0.9 + k * 0.1);
  for (const k of [-0.45, 0, 0.45]) b.add(BOX(), M(2.7 + k, g.at(2.7, 1.9) - 0.1, 1.9, 0, 0.05, 0.8, 0.5), FC.metal);   // bike rack hoops
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(COURT, GC.plaza, PAT.stone, g, 2),
    ...gstrip(TRAIL, 1.5, GC.path, PAT.earth, g, 2, 0.08),
    ...gfill(DECK, GC.deck, PAT.planks, g, 2, 0.12),
  ];
}

const BLOCKERS = [
  { poly: rect(LOOKOUT.x, LOOKOUT.z, LOOKOUT.w + 0.2, LOOKOUT.d + 0.2) },
  // the cliff edge beyond the overlook rail
  { poly: [{ x: 0.2, z: -14.5 }, { x: 5.4, z: -14.5 }, { x: 5.4, z: -15.4 }, { x: 0.2, z: -15.4 }] },
];

/** exclusion: the Lookout, its forecourt, the trail and the overlook deck (Point Lobos Ave and the parking lanes stay) */
const EXCLUDE: Vec2[] = [{ x: -3.7, z: 2.8 }, { x: 3.6, z: 2.8 }, { x: 3.6, z: -2.9 }, { x: 5.6, z: -10.8 }, { x: 5.6, z: -15.5 }, { x: 0.0, z: -15.5 }, { x: -3.2, z: -8.0 }, { x: -3.7, z: -2.6 }];

export const landsEnd: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: BLOCKERS, surfaces: [{ poly: DECK, y: 'terrain', surface: 'wood' }, { poly: COURT, y: 'terrain', surface: 'plaza' }] },
  ground: ground(),
  lights: [{ x: 3.1, y: g.at(3.1, -1.4) + 3.8, z: -1.4, size: 1, color: '#ffd9a0' }, { x: 0, y: g.at(0, 2.6) + 2.8, z: 2.8, size: 1.6, color: '#ffe3b0' }],
  plaza: [plazaOf(COURT), plazaOf(DECK, 'wood'), plazaOf(TRAIL_BAND, 'dirt')],
  w4: {
    placeId: 'lands-end',
    attractions: ['lands-end'],
    arrival: { x: 0.0, z: 4.2, heading: Math.PI },
    photo: { target: [2, 1.5, -8], distance: 30, elevation: 0.5, bearing: 1.6 },
    flag: { x: 0, z: 0.25, h: 30 },
    height: { realM: 6, u: 3.5, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/250216260', 'node/13825881781'],
    terrain: [-6, -17, 8, 5],
    terrainStep: 1,
    notes: 'The labyrinth at Eagle\'s Point is never promised (it is rebuilt and vandalised in turn); Sutro Baths and the Cliff House are the existing landmarks of this site.',
  },
};
