import type { Vec2 } from '../../../core/types';
import { type BatchLike, CBOX, M } from '../../builder';
import { type CornerDef, type CornerSign, awning, cornerMount, lampPost, rainbowBanner } from './cornerKit';
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
  const w0 = ASPHALT + 0.05, w1 = RIBBON - 0.25, far = 4.4;
  const rect = (u0: number, u1: number, v0: number, v1: number) => ({ poly: [at18(a * u0, c * v0), at18(a * u1, c * v0), at18(a * u1, c * v1), at18(a * u0, c * v1)], surface: 'pavement' as const });
  return [rect(w0, far, w0, w1), rect(w0, w1, w1, far)];
});

// ---------------------------------------------------------------------------
// W5-L5 · signature corner 8 (plan §3.6): Castro Street between Market and 18th — rainbow pole banners, shop plaques;
// the rainbow crosswalks are the site's ground (lane D's egg 21), the fair-day crowds lane R's
// ---------------------------------------------------------------------------

/**
 * "In the Castro and Upper Market area, rainbow flags can be seen everywhere: attached to light poles as banners"
 * (castrocbd.org "Things to See", checked 2026-09-28; the banners are paid for by the Castro Street Fair and the
 * merchants). Toy: four street lamps along Castro Street's sidewalks, each with a six-stripe banner (the generic pride
 * flag, no text) hung over the sidewalk (clear of the traffic), and awnings with generic English plaques on five
 * shopfronts (the city's buildings; never a shop's name). By day two friends stand at the south-east corner of Castro &
 * 18th looking at the rainbow crossing. Street frame: `along` from the Castro St centreline point (0.9, −3.1) toward
 * 18th (at along 23.6), `across` to the west; the fronts stand at across +2.15 (west) and −2.25 (east), the sidewalks
 * 1.6–2.2 either side. The city draws most of these Edwardian and Victorian fronts with ground-floor bay windows (0.5 u
 * proud; measured on the published city's L0: west bays at along 1.9–3.2, 4.3–5.6, 6.9–8.6, 11.9–13.6, 16.1–17.2, east
 * 13.5–14.7): the lamps stand in the gaps, the café's and the vintage shop's dressing hangs on their bays' faces (`out`).
 */
const CASTRO_AX = { x: 0.773, z: 0.635 }, CASTRO_ACROSS = { x: -0.635, z: 0.773 };
const S = (along: number, across: number): Vec2 => ({ x: +(0.9 + CASTRO_AX.x * along + CASTRO_ACROSS.x * across).toFixed(3), z: +(-3.1 + CASTRO_AX.z * along + CASTRO_ACROSS.z * across).toFixed(3) });
/** facing yaws: the west fronts face east (−across), the east fronts west (+across) */
const FACE_E = Math.atan2(-CASTRO_ACROSS.x, -CASTRO_ACROSS.z), FACE_W = Math.atan2(CASTRO_ACROSS.x, CASTRO_ACROSS.z);
/** the lamps with banners: [along, across] at the kerb, clear of the street trees and the bays (the banner hangs over the sidewalk) */
const CASTRO_POLES: [number, number][] = [[10.2, 1.65], [15.0, 1.65], [2.0, -1.7], [12.5, -1.7]];
const CASTRO_SHOPS: { along: number; west: boolean; sign: string; awn: string; w: number; out: number }[] = [
  { along: 3.75, west: true, sign: 'books-en', awn: '#2f8f88', w: 1.0, out: 0 },
  { along: 12.75, west: true, sign: 'cafe', awn: '#e0a94a', w: 1.5, out: 0.53 },
  { along: 16.65, west: true, sign: 'vintage', awn: '#7a4fa0', w: 1.0, out: 0.57 },
  { along: 11.0, west: false, sign: 'records', awn: '#c9473a', w: 1.8, out: 0 },
  { along: 19.8, west: false, sign: 'barber', awn: '#4f7fbf', w: 1.8, out: 0 },
];
/** a shop's wall point (moved onto its bay's face when it has one) */
const shopAt = (s: (typeof CASTRO_SHOPS)[number]) => S(s.along, s.west ? 2.15 - s.out : -2.25 + s.out);
const CASTRO_PHOTO: Vec2[] = [{ x: 18.5, z: 8.95 }, { x: 19.0, z: 9.42 }];

export const CASTRO_CORNER: CornerDef = {
  id: 'castro',
  order: 8,
  site: ID,
  frame: { x: X0, z: Z0, yaw: YAW },
  name: { zh: '卡斯特罗街', en: 'Castro Street' },
  ambient: { zh: '彩虹斑马线旁拍照的朋友', en: 'friends photographing the rainbow crossing' },
  box: [-1, -4, 20, 13],
  windows: { day: { from: 10 * 60, to: 20 * 60 } },
  ground: g,
  signs: () => CASTRO_SHOPS.map((s): CornerSign => {
    const w = shopAt(s), ry = s.west ? FACE_E : FACE_W;
    return { id: s.sign, x: w.x + Math.sin(ry) * 0.03, y: g.at(w.x + Math.sin(ry) * 0.3, w.z + Math.cos(ry) * 0.3) + 2.62, z: w.z + Math.cos(ry) * 0.03, ry, w: Math.min(1.0, s.w - 0.1) };
  }),
  build: b => {
    for (const [along, across] of CASTRO_POLES) {
      const p = S(along, across), y = g.at(p.x, p.z);
      lampPost(b, p.x, y, p.z);
      // the banner hangs from a bracket over the sidewalk, toward the fronts (the bracket runs along (cos ry, −sin ry))
      const toWall = across > 0 ? 1 : -1, rx = CASTRO_ACROSS.x * toWall, rz = CASTRO_ACROSS.z * toWall;
      rainbowBanner(b, p.x, y + 3.05, p.z, Math.atan2(-rz, rx), 0.27, 0.4);
    }
    for (const s of CASTRO_SHOPS) {
      const w = shopAt(s), ry = s.west ? FACE_E : FACE_W;
      awning(b, w.x, w.z, s.w, ry, g.at(w.x + Math.sin(ry) * 0.3, w.z + Math.cos(ry) * 0.3) + 2.2, s.out ? 0.35 : 0.4, s.awn);
    }
  },
  crowds: [{ key: 'photo', when: 'day', spots: CASTRO_PHOTO, face: { x: 16.63, z: 9.78 }, lane: { ax: 23.0, az: 7.25, bx: 15.36, bz: 16.51 } }],
  soft: CASTRO_POLES.map(([along, across]) => ({ ...S(along, across), r: 0.12 })),
  // lane E's cache on this corner (economy/coinSpots.ts, appended at lane L's request)
  cache: 'castro',
};

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
  // W5-L5: the Castro St lamps' night lights (the corner draws the lamps: CASTRO_CORNER)
  lights: CASTRO_POLES.map(([along, across]) => { const p = S(along, across); return { x: p.x, y: g.at(p.x, p.z) + 3.8, z: p.z, size: 1, color: '#ffd9a0' }; }),
  // W5-L5: Castro Street's corner (landmarks/cornerKit.ts)
  mount: cornerMount(CASTRO_CORNER),
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
    plazaMin: 7,
    notes: 'The crowd plaza is sidewalk only (the Castro St corner below the flag and the eight corner sidewalks of Castro & 18th, ≈ 7 u²): Market St, Castro St and the corner house take the rest. A memorial plaza (Harvey Milk): quiet tone, no memorial texts copied. The Rainbow Honor Walk plaques and the Muni station are cards / lane T. The rainbow crosswalks at Castro & 18th are ground only.',
  },
};
