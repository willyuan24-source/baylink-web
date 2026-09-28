import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, M } from '../../builder';
import { GLOW, LIT, NONE, box, cyl, rect, worldPoly } from './kit';
import { type W4Site, siteGround } from './siteKit';

/**
 * The Aquatic Park Bathhouse, the San Francisco Maritime Museum (wave 4, P3 · map T3, the wharf-west group): the 1939
 * Streamline Moderne bathhouse on the Aquatic Park beach, built like an ocean liner — decks stepping back to a
 * bridge, rounded ends, rails and portholes — now the national park's free Maritime Museum (Wed–Sun 10–4) (nps.gov
 * "Aquatic Park Bathhouse"; Wikipedia). Toy version on its OSM footprint (way 32839686, 900 Beach St): three white decks
 * with rounded bow and stern, dark window bands lit at night, navy rails, a signal mast on the bridge. No lettering.
 * The Hyde Street Pier next door is closed (its card); the USS Pampanito at Pier 45 is not modelled (3.7 u from the
 * hero slab).
 *
 * Frame: origin (−249.59, 167.84) at the building's middle (the attraction's point), yaw −123.7°: local x runs along the
 * building (x −5.35…5.35), +z faces the beach (the promenade at z 1.8–3.3, the sand beyond), the street and the
 * Ghirardelli blocks behind (−z).
 * ≈ 14 m → 5.4 u to the bridge's roof.
 */

const ID = 'aquatic-park-bathhouse';
const X0 = -249.59, Z0 = 167.84, YAW = (-123.7 * Math.PI) / 180;
const g = siteGround(ID, 0.5);

const WHITE = '#f4f1ea', NAVY = '#2f4a6a', BAND = '#3d4a52';
/** the decks: [x0, x1, depth, height of its top over the ground] — each centred on z 0 */
const DECKS: [number, number, number, number][] = [[-4.95, 4.95, 2.2, 2.0], [-3.35, 3.35, 1.7, 3.5], [-1.35, 1.35, 1.2, 4.7]];
const ZC = 0;

function deck(b: BatchLike, [x0, x1, d, top]: (typeof DECKS)[number], y: number, lower: number, lod: 0 | 2) {
  const h = top - lower, r = d / 2, w = x1 - x0 - d;
  box(b, (x0 + x1) / 2, y + lower, ZC, w, h, d, WHITE, GLOW(0.08));
  // the rounded bow and stern
  for (const x of [x0 + r, x1 - r]) cyl(b, x, y + lower, ZC, r, h, WHITE, NONE, lod === 0 ? 8 : 5);
  if (lod === 2) return;
  // a dark window band round the deck (lit at night), the navy rail above it
  b.add(BOX(), M((x0 + x1) / 2, y + lower + h * 0.35, ZC, 0, w + 0.02, h * 0.3, d + 0.04), BAND, LIT(y + lower));
  b.add(BOX(), M((x0 + x1) / 2, y + top, ZC, 0, w + 0.1, 0.12, d + 0.12), NAVY);
}

function build(b: BatchLike, lod: 0 | 2) {
  const y = g.at(0, ZC);
  // lod 2: the hull as one white block
  if (lod === 2) { box(b, 0, y - 0.6, ZC, 9.9, 4.1, 2.2, WHITE); return; }
  let lower = -0.6;
  for (const dk of DECKS) {
    deck(b, dk, y, lower, lod);
    lower = dk[3];
  }
  // the signal mast on the bridge
  box(b, 0, y + DECKS[2][3], ZC, 0.08, 1.6, 0.08, NAVY);
  box(b, 0, y + DECKS[2][3] + 1.2, ZC, 0.9, 0.06, 0.06, NAVY);
}

const EXCLUDE: Vec2[] = [{ x: -5.65, z: -1.15 }, { x: 5.65, z: -1.15 }, { x: 5.65, z: 1.45 }, { x: -5.65, z: 1.45 }];

export const aquaticParkBathhouse: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: [{ poly: rect(0, ZC, 10.0, 2.3) }] },
  lights: [{ x: 0, y: g.at(0, ZC) + 1.0, z: ZC + 1.3, size: 1.4, color: '#ffe3b0' }],
  plaza: [{ poly: [{ x: -5.2, z: 1.65 }, { x: 5.2, z: 1.65 }, { x: 5.2, z: 4.65 }, { x: -5.2, z: 4.65 }], surface: 'pavement' }],
  w4: {
    placeId: 'maritime-museum-bathhouse',
    attractions: ['maritime-museum-bathhouse'],
    arrival: { x: -0.55, z: 2.65, heading: Math.PI },
    photo: { target: [0, 2.5, 0], distance: 20, elevation: 0.18, bearing: 0.5 },
    flag: { x: 0, z: ZC, h: 30 },
    height: { realM: 14, u: 5.4, top: 7.0, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/32839686'],
    terrain: [-7, -3, 7, 6],
    ringMin: 0.6,
    notes: 'Its back is the street and the Ghirardelli blocks (the walk-around ring 70 %). A free museum (Wed–Sun 10–4, the card). No lettering. The Hyde Street Pier is closed; the USS Pampanito is a card (3.7 u from the hero slab).',
  },
};
