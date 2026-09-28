import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { GLOW, LIT, box, vault, worldPoly } from './kit';
import { GC, LIFT, PAT, type SiteGroundPoly, type W4Site, grect, siteGround } from './siteKit';

/**
 * Japan Center's Webster Street Bridge (wave 4, P3 · map T3, the Japantown extension of the Peace Pagoda): Minoru
 * Yamasaki's 1968 Japan Center — the East and West malls and the Kinokuniya Building around Peace Plaza — joined across
 * Webster Street by the enclosed shopping bridge (OSM way 148481441: a mall on a bridge, 4–10 m up, round roof)
 * (sfjapantown.org; OSM). The malls are the city's buildings; this site is the bridge: a glazed gallery on its deck
 * with a curved roof and warm lanterns inside at night, and the street under it re-laid (the site's exclusion takes the
 * span out of the city's ribbon). No shop names.
 *
 * Frame: origin (−75.7, 462.7) at the bridge's centre, yaw −124.8°: the bridge runs along local x (the West mall's
 * wall at x −2.8), Webster St along local z, Post St at z 4.6, Geary Blvd at z −5.5. Webster St is a DUAL carriageway
 * in the published data: two one-way ribbons 4.4 wide with their centrelines at x −0.6 and 1.1, which the city draws
 * (outside the exclusion) as asphalt x −2.2…−1.1 and −0.5…2.7 either side of a paved median x −1.1…−0.5, between the
 * sidewalks x −2.8…−2.2 and 2.7…3.3. W4-L-review: the site had re-laid only the x 1.1 ribbon and the median, leaving
 * the west carriageway x −2.2…−1.1 bare under the bridge; now it continues all five strips. The crowd spots and the
 * arrival are on the two sidewalks, never on the carriageway.
 */

const ID = 'webster-bridge';
const X0 = -75.7, Z0 = 462.7, YAW = (-124.8 * Math.PI) / 180;
const g = siteGround(ID, 9.2);

const X_0 = -2.7, X_1 = 3.5, W = 2.1, DECK = 2.6, HALL = 1.5;
/** the street under the span as the city draws it: asphalt x0…x1 with the median m0…m1, a sidewalk `walk` wide either side */
const STREET = { x0: -2.2, x1: 2.7, m0: -1.1, m1: -0.5, walk: 0.6 };
/** the deck's ground reference (the east ribbon's centreline, where its height was set) */
const REF_X = 1.08;

function build(b: BatchLike, lod: 0 | 2) {
  const y = g.at(REF_X, 0), cx = (X_0 + X_1) / 2, L = X_1 - X_0;
  if (lod === 2) { box(b, cx, y + DECK - 0.4, 0, L, HALL + 0.4, W, '#8fa9b3'); return; }
  box(b, cx, y + DECK - 0.4, 0, L, 0.4, W, '#d8d1c3');
  // the glazed gallery, its curved roof, the spandrel bands
  box(b, cx, y + DECK, 0, L, HALL, W - 0.1, '#8fa9b3', LIT(y + DECK));
  vault(b, cx, y + DECK + HALL, 0, L + 0.1, W / 2, '#e8e2d6', GLOW(0.1), 6, 0);
  for (const s of [-1, 1]) {
    box(b, cx, y + DECK + HALL - 0.1, s * (W / 2 - 0.02), L + 0.05, 0.2, 0.08, '#c9c1b2');
    // the gallery's mullions
    for (let k = 1; k < 6; k++) box(b, X_0 + (L * k) / 6, y + DECK, s * (W / 2 - 0.02), 0.08, HALL, 0.08, '#c9c1b2');
  }
}

/** Webster St under the span (both carriageways, the median, the sidewalks), 1.6 u beyond the exclusion on both sides */
function ground(): SiteGroundPoly[] {
  const len = 2 * 2.9, { x0, x1, m0, m1, walk } = STREET;
  const strip = (a: number, c: number, color: string, pattern: number, lift: number) => grect((a + c) / 2, 0, c - a, len, 0, color, pattern, g, 3, lift);
  return [
    ...strip(x0, m0, GC.asphalt, PAT.asphalt, LIFT),
    ...strip(m1, x1, GC.asphalt, PAT.asphalt, LIFT),
    ...strip(m0, m1, GC.sidewalk, PAT.stone, LIFT + 0.02),
    ...strip(x0 - walk, x0, GC.sidewalk, PAT.stone, LIFT + 0.02),
    ...strip(x1, x1 + walk, GC.sidewalk, PAT.stone, LIFT + 0.02),
  ];
}

const EXCLUDE: Vec2[] = [{ x: X_0 - 0.1, z: -1.3 }, { x: X_1 + 0.1, z: -1.3 }, { x: X_1 + 0.1, z: 1.3 }, { x: X_0 - 0.1, z: 1.3 }];

export const websterBridge: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: [] },
  ground: ground(),
  lights: [{ x: 0.4, y: g.at(REF_X, 0) + DECK + 0.9, z: 0, size: 1.6, color: '#ffd7a0' }],
  // the two sidewalks under and beside the span (a crowd spot is never on the carriageway: the crowd stands exactly there)
  plaza: [{ poly: [{ x: -2.75, z: -4.0 }, { x: -2.25, z: -4.0 }, { x: -2.25, z: 3.6 }, { x: -2.75, z: 3.6 }], surface: 'pavement' }, { poly: [{ x: 2.75, z: -4.0 }, { x: 3.25, z: -4.0 }, { x: 3.25, z: 3.6 }, { x: 2.75, z: 3.6 }], surface: 'pavement' }],
  w4: {
    placeId: 'osm-w546510348',
    attractions: ['japan-center'],
    arrival: { x: -2.35, z: -2.2, heading: 0 },
    photo: { target: [0.4, 3, 0], distance: 14, elevation: 0.12, bearing: 0.2 },
    flag: { x: 0.4, z: 0, h: 30 },
    height: { realM: 10, u: 4.4, top: 5.2, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/148481441'],
    terrain: [-4, -5, 5, 5],
    terrainStep: 1,
    plazaMin: 7,
    notes: 'The crowd plaza is the two sidewalks of Webster St (7.6 u²: the malls close both sides). The malls are the city buildings (no shop names anywhere). The place row is Peace Plaza (osm-w546510348): the curated japantown-peace-pagoda row stays the Peace Pagoda one.',
  },
};
