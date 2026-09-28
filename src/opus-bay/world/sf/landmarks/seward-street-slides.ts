import type { Vec2 } from '../../../core/types';
import { type BatchLike, CBOX, ICO, M } from '../../builder';
import { worldPoly } from './kit';
import { FC, type W4Site, bin, lamp } from './siteKit';
import { box3, site3Ground } from './siteKit3';

/**
 * Seward Street Slides (wave 4, P4 · map T3, above the Castro): Seward Mini Park, 30 Seward Street, built in 1973 on
 * land first meant for houses, with two steep concrete slides designed by Kim Clark, a 14-year-old who won a design
 * contest run by the sculptor Ruth Asawa, a community garden and native plants. The slides are open 10 am–5 pm Tuesday
 * to Sunday; bring a piece of cardboard, adults must come with a child, and the park closes at sunset (sfrecpark.org
 * "Seward Mini Park", facility sewardminipark-203, re-checked 2026-09-28; the page says nothing about wet weather, so
 * the card no longer claims it). Visitors start at the foot on Seward Street and take the stairs up to the top.
 *
 * W5-L3 (for lane A's slide activity): the top deck is walkable and open to the path behind it, the chute heads can be
 * stood at from the deck (the chutes' blocker ends at their lip), and data/sf/sewardSlides.ts gives A the deck, the two
 * chute lines and the run-out in WORLD coordinates (pasted; tests/opus-bay-w5-landmarks.test.ts pins them to this
 * record). The arrival is on the deck behind the chute heads, looking down both chutes (from the foot the city's trees
 * hide them); the foot on the Seward Street sidewalk is the table's `foot`.
 *
 * Toy: the two concrete chutes side by side down the slope (a bed and two low walls each), the small top deck and a
 * stack of flattened cardboard, native shrubs beside them, a lamp and a bin. The riding itself (the player and BAYBAY on
 * cardboard) is lane A's activity: `SEWARD_SLIDES` gives the two chute lines (local).
 *
 * Frame: origin (154.7, 832.4) in the park, yaw 0: local +z runs uphill (south) from Seward Street (centreline z ≈ −4.4,
 * ground 20.5) to Corwin Street (z ≈ 8.9, ground 23.9); the park is a narrow strip between houses (x < −0.75 and
 * x > 3), the city's Acme Alley steps and lane climb beside the slides at x ≈ 1…2.6.
 */

const ID = 'seward-street-slides';
const X0 = 154.7, Z0 = 832.4, YAW = 0;
const g = site3Ground(ID, 20.5);

const CONCRETE = '#cfc9bd', WALLC = '#b9b2a4', CARD = '#b08a5a';
/** the two chutes: centre x, from the bottom z0 to the top z1 (0.44 u wide inside, low side walls) */
const CHUTES: { x: number; z0: number; z1: number }[] = [{ x: -0.36, z0: -1.9, z1: 5.7 }, { x: 0.14, z0: -1.9, z1: 5.7 }];
const W = 0.44, TOP = { z0: 5.7, z1: 6.7, x0: -0.7, x1: 0.44, h: 0.35 };

/** the chute lines (LOCAL, bottom → top, y over the site base) for a slide interaction (lanes G / C) */
export const SEWARD_SLIDES: readonly { from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number } }[] = CHUTES.map(c => ({
  from: { x: c.x, y: +(g.at(c.x, c.z0) + 0.12).toFixed(3), z: c.z0 },
  to: { x: c.x, y: +(g.at(c.x, c.z1) + TOP.h).toFixed(3), z: c.z1 },
}));

function chute(b: BatchLike, x: number, z0: number, z1: number, lod: 0 | 2) {
  const y0 = g.at(x, z0) + 0.06, y1 = g.at(x, z1) + TOP.h;
  const L = Math.hypot(z1 - z0, y1 - y0), pitch = Math.atan2(y1 - y0, z1 - z0);
  const mz = (z0 + z1) / 2, my = (y0 + y1) / 2;
  // the bed (tilted about x: its top face follows the line bottom → top), then the two side walls
  b.add(CBOX(), M(x, my - 0.05, mz, 0, W, 0.1, L, -pitch), CONCRETE);
  if (lod === 2) return;
  for (const s of [-1, 1]) b.add(CBOX(), M(x + s * (W / 2 + 0.04), my + 0.08, mz, 0, 0.08, 0.3, L, -pitch), WALLC);
}

function build(b: BatchLike, lod: 0 | 2) {
  for (const c of CHUTES) chute(b, c.x, c.z0, c.z1, lod);
  if (lod === 2) return;
  // the top deck, open to the path behind it (W5-L3: the rail across its back had no blocker — the player walked
  // through it — and would have shut the deck off from the path to Corwin Street), and a stack of flattened cardboard
  // leaning on the neighbour's wall beside it (in the wall's own clearance, out of the way in)
  const ty = g.at(-0.1, 6.2);
  box3(b, (TOP.x0 + TOP.x1) / 2, ty - 0.3, (TOP.z0 + TOP.z1) / 2, TOP.x1 - TOP.x0, TOP.h + 0.3, TOP.z1 - TOP.z0, CONCRETE);
  box3(b, -0.84, g.at(-0.84, 6.3) - 0.05, 6.3, 0.16, 0.55, 0.5, CARD);
  // native shrubs beside the chutes, the lamp and a bin
  for (const [k, [x, z]] of ([[0.66, 0.4], [0.7, 2.6], [0.66, 4.6]] as const).entries()) {
    b.add(ICO(0), M(x, g.at(x, z) + 0.3, z, k, 0.4, 0.38, 0.5), k % 2 ? FC.tree : FC.treeDark, [0, 0, 0.3, 0]);
  }
  lamp(b, -0.85, g.at(-0.85, 6.9) - 0.02, 6.85);
  bin(b, 0.66, g.at(0.66, -2.2), -2.2);
}

/** exclusion: the chutes, the top deck and the strip beside them (Seward and Corwin Streets, the Acme Alley steps and
 *  lane stay the city's) */
const EXCLUDE: Vec2[] = [{ x: -0.72, z: -2.6 }, { x: 0.45, z: -2.6 }, { x: 0.45, z: 0.0 }, { x: 0.95, z: 0.0 }, { x: 0.95, z: 6.95 }, { x: -0.95, z: 6.95 }, { x: -0.95, z: 2.2 }, { x: -0.72, z: 2.2 }];

export const sewardStreetSlides: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: {
    blockers: [
      // the chutes, to their lip at the deck (5.7 − 0.15: a rider stands at the chute heads from the deck)
      { poly: [{ x: -0.62, z: -1.9 }, { x: 0.4, z: -1.9 }, { x: 0.4, z: 5.55 }, { x: -0.62, z: 5.55 }] },
      { x: 0.66, z: 2.6, r: 0.35 }, { x: 0.66, z: 4.6, r: 0.35 },
      // W5-L3: the lamp by the neighbour's wall (it had no blocker: the way in from Corwin Street passed through its post)
      { x: -0.85, z: 6.85, r: 0.12 },
    ],
    surfaces: [{ poly: [{ x: TOP.x0, z: TOP.z0 }, { x: TOP.x1, z: TOP.z0 }, { x: TOP.x1, z: TOP.z1 }, { x: TOP.x0, z: TOP.z1 }], y: +(g.at(-0.1, 6.2) + TOP.h).toFixed(3), surface: 'plaza' }],
  },
  lights: [{ x: -0.85, y: g.at(-0.85, 6.9) + 3.8, z: 6.85, size: 1, color: '#ffd9a0' }],
  w4: {
    placeId: 'osm-w1364891448',
    attractions: ['seward-street-slides'],
    // W5-L1 / L3: on the deck behind the chute heads, looking down both chutes and over the Castro (the attraction's own
    // point is inside the chutes; the deck is open to the path behind it now, so trips and fly-ins end within a step)
    arrival: { x: -0.1, z: 6.5, heading: Math.PI },
    photo: { target: [-0.1, 1.8, 2.0], distance: 11, elevation: 0.35, bearing: 2.7 },
    flag: { x: -0.1, z: 3.0, h: 30 },
    height: { realM: 0, u: 1.0, top: 7.48, rule: 'overlook' },
    osm: ['way/1364891448'],
    terrain: [-2, -3, 2, 8],
    terrainStep: 1,
    ringMin: 0.7,
    notes: 'A mini park: no crowd spots (a narrow strip between houses, which close the walk-around ring to 72 %; the slides are for riding, lane A: SEWARD_SLIDES, data/sf/sewardSlides.ts). The slides are open Tue–Sun 10–5, adults only with a child, the park closes at sunset (sfrecpark.org, 2026-09-28): the card says so.',
  },
};
