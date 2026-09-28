import type { Vec2 } from '../../../core/types';
import { type BatchLike, CBOX, M } from '../../builder';
import { NONE, cyl, worldPoly } from './kit';
import { LIFT_STRIPE, type SiteGroundPoly, type W4Site, gpoly, siteGround } from './siteKit';

/**
 * Harvey Milk Plaza and the Castro's rainbow crosswalks (wave 4, P3 · map T2, the castro site): the plaza over the
 * Castro Muni station at Castro and Market, named for Harvey Milk, with the giant rainbow flag (20 × 30 ft) flying from
 * its tall pole since 1997 — the Gilbert Baker Memorial Rainbow Flag, a city landmark (SF Chronicle; OSM node
 * 12863137601, the flagpole 7166033408, 25 m); and the rainbow crosswalks painted on all four sides of Castro and 18th
 * Streets in September 2014 (SF Public Works; hoodline). Toy version: the pole and a big six-stripe rainbow flag (the
 * generic pride flag, no text), and the four rainbow crosswalks at 18th Street. No memorial texts copied; the Rainbow
 * Honor Walk plaques are a card.
 *
 * Frame: origin (142.72, 743.77) at the toy pole, yaw 0 (local = world offsets): the OSM flag is 2.4 u north-west at
 * (−1.45, 1.9), under Market St's two carriageway ribbons (they pass 2.5–2.8 u west and cover most of the plaza), so
 * the pole stands at the plaza's south corner by Castro St, where the ribbons leave room. Castro & 18th is at
 * (18.28, 11.03): Castro runs (0.773, 0.635), 18th (−0.637, 0.772), both 4.4 wide.
 */

const ID = 'harvey-milk-plaza';
const X0 = 142.72, Z0 = 743.77, YAW = 0;
const g = siteGround(ID, 10.0);

const POLE = { x: 0, z: 0, h: 7.1 };
/** the six stripes, top to bottom */
const RAINBOW = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'];
/** the flag streams over the corner house's roof (the only side where the plaza's ribbons leave the site room) */
const FLY = Math.atan2(0.55, 0.83);
const FLAG_W = 1.9, FLAG_H = 1.27;

function build(b: BatchLike, lod: 0 | 2) {
  const y = g.at(POLE.x, POLE.z);
  // the flag: six stripes hanging from the top, swinging with the wind (sway info)
  const sx = Math.sin(FLY), sz = Math.cos(FLY), n = 6, sh = FLAG_H / n;
  // lod 2: the flag alone (the far silhouette the map points at)
  if (lod === 2) { b.add(CBOX(), M(POLE.x + sx * (FLAG_W / 2), y + POLE.h - 0.15 - FLAG_H / 2, POLE.z + sz * (FLAG_W / 2), FLY - Math.PI / 2, FLAG_W, FLAG_H, 0.05), RAINBOW[2]); return; }
  cyl(b, POLE.x, y - 0.2, POLE.z, 0.12, POLE.h + 0.2, '#dcd8cf', NONE, 6, 0.6);
  for (let k = 0; k < n; k++) {
    const cy = y + POLE.h - 0.15 - sh * (k + 0.5), off = FLAG_W / 2 + 0.1;
    b.add(CBOX(), M(POLE.x + sx * off, cy, POLE.z + sz * off, FLY - Math.PI / 2, FLAG_W, sh, 0.04), RAINBOW[k], [0, 0, 0.5, 0]);
  }
  cyl(b, POLE.x, y - 0.1, POLE.z, 0.45, 0.4, '#c9c1b2', NONE, 8);
}

/** a rainbow crosswalk: six bands side by side (each kerb to kerb, across the street), `w` along the street */
function rainbowCrossing(cx: number, cz: number, along: Vec2, across: Vec2, len: number, w: number): SiteGroundPoly[] {
  const out: SiteGroundPoly[] = [], bw = w / 6;
  for (let k = 0; k < 6; k++) {
    const s0 = -w / 2 + k * bw, s1 = s0 + bw;
    const P = (s: number, t: number): Vec2 => ({ x: +(cx + along.x * s + across.x * t).toFixed(3), z: +(cz + along.z * s + across.z * t).toFixed(3) });
    out.push(gpoly([P(s0, -len / 2), P(s1, -len / 2), P(s1, len / 2), P(s0, len / 2)], RAINBOW[k], 0, g, LIFT_STRIPE));
  }
  return out;
}

const I18 = { x: 18.28, z: 11.03 }, CASTRO = { x: 0.773, z: 0.635 }, EIGHTEENTH = { x: -0.637, z: 0.772 };
function ground(): SiteGroundPoly[] {
  const out: SiteGroundPoly[] = [];
  for (const s of [-1, 1]) {
    // across Castro St, on either side of 18th; across 18th St, on either side of Castro
    out.push(...rainbowCrossing(I18.x + CASTRO.x * s * 3.3, I18.z + CASTRO.z * s * 3.3, CASTRO, EIGHTEENTH, 4.2, 1.6));
    out.push(...rainbowCrossing(I18.x + EIGHTEENTH.x * s * 3.3, I18.z + EIGHTEENTH.z * s * 3.3, EIGHTEENTH, CASTRO, 4.2, 1.6));
  }
  return out;
}

export const harveyMilkPlaza: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  // the pole's corner of the plaza only: Market St's ribbons (1.8–2.7 u west) and the corner house (east) stay
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -0.05, z: -0.3 }, { x: 0.9, z: -0.3 }, { x: 1.5, z: 1.2 }, { x: 0.9, z: 1.9 }, { x: -0.05, z: 0.9 }]) },
  build,
  walk: { blockers: [{ x: POLE.x, z: POLE.z, r: 0.45 }] },
  ground: ground(),
  plaza: [
    { poly: [{ x: -1.25, z: -2.4 }, { x: 1.85, z: -0.7 }, { x: 0.35, z: 0 }, { x: -0.55, z: 2.1 }, { x: -1.55, z: -1.5 }], surface: 'plaza' },
    // the four corners of Castro & 18th, where people photograph the crossings
    ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, c]) => ({ poly: [0, 1, 2, 3].map(k => { const u = a * (3.3 + (k === 1 || k === 2 ? 2.6 : 0)), v = c * (3.3 + (k >= 2 ? 2.6 : 0)); return { x: I18.x + CASTRO.x * u + EIGHTEENTH.x * v, z: I18.z + CASTRO.z * u + EIGHTEENTH.z * v }; }), surface: 'pavement' as const })),
  ],
  w4: {
    placeId: 'osm-w225526801',
    attractions: ['harvey-milk-plaza'],
    arrival: { x: -0.85, z: -1.5, heading: 0.9 },
    photo: { target: [0, 5.5, 0], distance: 18, elevation: 0.35, bearing: -2.4 },
    flag: { x: POLE.x, z: POLE.z, h: 30 },
    height: { realM: 25, u: 7.1, top: 7.6, rule: 'H = 3.2 + 0.155·h' },
    osm: ['node/12863137601', 'node/7166033408', 'way/225526801'],
    terrain: [-5, -4, 24, 17],
    notes: 'A memorial plaza (Harvey Milk): quiet tone, no memorial texts copied. The Rainbow Honor Walk plaques and the Muni station are cards / lane T. The rainbow crosswalks at Castro & 18th are ground only.',
  },
};
