import type { Vec2 } from '../../../core/types';
import { type BatchLike, CBOX, M } from '../../builder';
import { NONE, cyl, worldPoly } from './kit';
import { LIFT_STRIPE, type SiteGroundPoly, type W4Site, gpoly, siteGround } from './siteKit';

/**
 * Harvey Milk Plaza and the Castro's rainbow crosswalks (wave 4, P3 · map T2, the castro site): the plaza over the
 * Castro Muni station at Castro and Market, named for Harvey Milk, with the giant rainbow flag (20 × 30 ft) flying from
 * its 70 ft pole since 8 November 1997 — Gilbert Baker's Rainbow Flag, a city landmark since September 2024 (SF
 * Chronicle; OSM node 12863137601, the flagpole 7166033408 tagged 25 m); and the rainbow crosswalks painted on all
 * four sides of Castro and 18th Streets in September 2014 (SF Public Works; hoodline). Toy version: the pole and a big
 * six-stripe rainbow flag (the generic pride flag, no text), and the four rainbow crosswalks at 18th Street, kerb to
 * kerb. No memorial texts copied; the Rainbow Honor Walk plaques are a card.
 *
 * Frame: origin (142.72, 743.77), yaw 0 (local = world offsets): the OSM flag is 2.4 u north-west at (−1.45, 1.9),
 * under Market St's carriageways (the nearer one's centreline runs (−4.3, 6.5) → (−1.4, −6.6), 5.6 wide), so the toy
 * pole stands at the plaza's south corner on Market's sidewalk, between Castro St (its centreline (0.9, −3.1) →
 * (2.5, −1.8), 4.4 wide) and the corner house (OSM building, x −0.4…4.3, z −0.4…4.6), over whose roof the flag flies.
 * W4-L-review: the site's exclusion held the house's centroid, so the city dropped the whole house (a 12 u² hole on the
 * corner); the exclusion now stops short of it and the pole stands 0.45 u off its wall. Castro & 18th is at
 * (19.18, 11.88), where the two published centrelines cross (W4-L-review: it was (18.28, 11.03), on Castro but 1.26 u
 * off 18th St's centreline, so the crossings over 18th St lay half on its sidewalk and one crossing over Castro sat
 * inside the junction): Castro runs (0.773, 0.635), 18th (−0.637, 0.772), both 4.4 wide (asphalt 3.2, sidewalks 0.6
 * up to the corner buildings).
 */

const ID = 'harvey-milk-plaza';
const X0 = 142.72, Z0 = 743.77, YAW = 0;
const g = siteGround(ID, 10.0);

const POLE = { x: -0.2, z: -0.25, h: 7.1 };
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
  cyl(b, POLE.x, y - 0.1, POLE.z, 0.3, 0.4, '#c9c1b2', NONE, 8);
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

const I18 = { x: 19.18, z: 11.88 }, CASTRO = { x: 0.773, z: 0.635 }, EIGHTEENTH = { x: -0.637, z: 0.772 };
/** the two streets' asphalt half width and ribbon half width at 18th (4.4 wide: asphalt 3.2 between 0.6 sidewalks) */
const ASPHALT = 1.6, RIBBON = 2.2;
function ground(): SiteGroundPoly[] {
  const out: SiteGroundPoly[] = [];
  for (const s of [-1, 1]) {
    // across Castro St, on either side of 18th; across 18th St, on either side of Castro (kerb to kerb)
    out.push(...rainbowCrossing(I18.x + CASTRO.x * s * 3.3, I18.z + CASTRO.z * s * 3.3, CASTRO, EIGHTEENTH, 2 * ASPHALT, 1.6));
    out.push(...rainbowCrossing(I18.x + EIGHTEENTH.x * s * 3.3, I18.z + EIGHTEENTH.z * s * 3.3, EIGHTEENTH, CASTRO, 2 * ASPHALT, 1.6));
  }
  return out;
}

/** a point `u` along Castro and `v` along 18th from the crossing's centre (local) */
const at18 = (u: number, v: number): Vec2 => ({ x: +(I18.x + CASTRO.x * u + EIGHTEENTH.x * v).toFixed(3), z: +(I18.z + CASTRO.z * u + EIGHTEENTH.z * v).toFixed(3) });
/**
 * the corner sidewalks of Castro & 18th, where people photograph the crossings: in each quadrant the Castro St sidewalk
 * beside its crossing and the 18th St sidewalk beside its own (between the asphalt and the corner buildings, which
 * stand at the ribbons' edges: W4-L-review, the spots had been 3.3–5.9 u out, inside those buildings)
 */
const CORNERS: { poly: Vec2[]; surface: 'pavement' }[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]].flatMap(([a, c]) => {
  const w0 = ASPHALT + 0.05, w1 = RIBBON - 0.05, far = 4.4;
  const rect = (u0: number, u1: number, v0: number, v1: number) => ({ poly: [at18(a * u0, c * v0), at18(a * u1, c * v0), at18(a * u1, c * v1), at18(a * u0, c * v1)], surface: 'pavement' as const });
  return [rect(w0, far, w0, w1), rect(w0, w1, w1, far)];
});

export const harveyMilkPlaza: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  // the pole's corner only: Market St's ribbons (west; the edge stays ≥ 2.45 u off the nearer centreline) and the
  // corner house (east: its vertex-mean centroid (1.3, 1.5) stays OUTSIDE, or the city drops the house) stay the city's
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -0.15, z: -0.45 }, { x: 0.55, z: -0.45 }, { x: 0.75, z: 0.6 }, { x: 0.6, z: 1.1 }, { x: -0.1, z: 0.8 }]) },
  build,
  walk: { blockers: [{ x: POLE.x, z: POLE.z, r: 0.35 }] },
  ground: ground(),
  plaza: [
    // the Castro St sidewalk at the pole's corner (Market's asphalt west of it, Castro's south, the house north)
    { poly: [{ x: 0.06, z: -1.66 }, { x: 1.61, z: -0.39 }, { x: 1.3, z: -0.01 }, { x: -0.26, z: -1.27 }], surface: 'pavement' },
    ...CORNERS,
  ],
  w4: {
    placeId: 'osm-w225526801',
    attractions: ['harvey-milk-plaza'],
    // on the Castro St sidewalk below the flag (W4-L-review: it was on Market St's asphalt)
    arrival: { x: 0.55, z: -0.95, heading: -0.1 },
    photo: { target: [0, 5.5, 0], distance: 18, elevation: 0.35, bearing: -2.4 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 25, u: 7.1, top: 7.4, rule: 'H = 3.2 + 0.155·h' },
    osm: ['node/12863137601', 'node/7166033408', 'way/225526801'],
    terrain: [-5, -4, 24, 17],
    plazaMin: 10,
    notes: 'The crowd plaza is sidewalk only (the Castro St corner below the flag and the eight corner sidewalks of Castro & 18th, ≈ 13 u²): Market St, Castro St and the corner house take the rest. A memorial plaza (Harvey Milk): quiet tone, no memorial texts copied. The Rainbow Honor Walk plaques and the Muni station are cards / lane T. The rainbow crosswalks at Castro & 18th are ground only.',
  },
};
