import * as THREE from 'three';
import type { BatchLike } from '../../builder';
import { CT_BLOCKERS, CT_EXCLUDES, chinatownCluster } from '../cornersChinatown';
import type { SiteHooks } from '../sites';
import { type CornerDef, type CornerSign, NO_BATCH, awning, blade, cornerGroundWorld, cornerMount, dragonLamp, lanternWire } from './cornerKit';
import { GLOW, NONE, SF, box, cbox, pyramid, rect, tube, worldPoly } from './kit';
import type { LandmarkSwap, SfLandmark, WalkBlocker } from './index';
import { settingGround, streetStrips } from './setting';

/**
 * Chinatown Dragon Gate (T2) at Grant Ave & Bush St (OSM node 65328703): three openings — the street in the middle
 * (3.2 × 3.4 u, well over the 2.2 u walk-through minimum) and a sidewalk arch each side — under green-tiled
 * pagoda roofs with upturned eaves, a gold ridge with two dragons (toy blocks) and a blank plaque (no text).
 * Local +z faces south down Grant Ave (yaw 52.4° from the Grant Ave way), walking north (−z) enters Chinatown.
 *
 * Setting (lane D2, D2-09): the toy gate is far wider than Grant Ave's toy right-of-way (3.5 u between the corner
 * buildings), so its side bays stand on Bush St's north sidewalk in front of the corner buildings; the frame sits
 * 0.55 u south of the OSM node (82.37, 175.04 instead of 81.93, 174.7) so their backs clear the facades (they cut
 * 0.4 u into the north-west corner building before). Grant Ave runs on under the central arch (its clipped piece
 * restored at its own height: sink 0), and red lantern strings hang across Grant Ave north of the gate, lit at night.
 */

const X0 = 82.366, Z0 = 175.035, YAW = (52.4 * Math.PI) / 180;
const STONE = '#e3ddd0', STONE_DARK = '#c9c1b2', GREEN = SF.chinaGreen, GREEN_DARK = SF.chinaGreenDark, RED = SF.chinaRed, GOLD = SF.chinaGold;
const INNER = 1.95, OUTER = 3.75, MID = 4.2, SIDE = 3.1, DEPTH = 1.1;

/** pagoda roof: a wide low hip + upturned corner flicks + a ridge beam */
function roof(b: BatchLike, x: number, y: number, w: number, d: number, lod: 0 | 2) {
  if (lod === 2) { pyramid(b, x, y, 0, w + 0.5, d + 0.7, 1.2, GREEN); return; }
  box(b, x, y, 0, w - 0.3, 0.28, d - 0.2, RED, GLOW(0.15));
  pyramid(b, x, y + 0.28, 0, w + 0.5, d + 0.7, 0.95, GREEN);
  box(b, x, y + 0.25, 0, w + 0.45, 0.12, d + 0.65, GREEN_DARK);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cbox(b, x + sx * (w / 2 + 0.2), y + 0.42, sz * (d / 2 + 0.3), 0.55, 0.12, 0.18, GREEN_DARK, NONE, 0, 0, sx * 0.55);
  box(b, x, y + 1.05, 0, w * 0.55, 0.16, 0.2, GOLD);
}

function build(b: BatchLike, lod: 0 | 2) {
  // W8-W1: Chinatown's pagoda cluster up Grant Ave (world/sf/cornersChinatown.ts), in this mesh at both lods
  chinatownCluster(b, lod, G.base);
  // four stone pillars on plinths (far: one block per side)
  if (lod === 2) {
    for (const sx of [-1, 1]) box(b, (sx * (INNER + OUTER)) / 2, -1.2, 0, OUTER - INNER + 0.62, SIDE + 1.2, 0.72, STONE);
    box(b, 0, MID - 0.7, 0, INNER * 2 + 0.62, 0.7, DEPTH * 0.7, STONE);
    roof(b, 0, MID, INNER * 2 + 0.9, DEPTH, lod);
    for (const sx of [-1, 1]) roof(b, sx * ((INNER + OUTER) / 2 + 0.05), SIDE, OUTER - INNER + 0.9, DEPTH * 0.9, lod);
    return;
  }
  for (const sx of [-1, 1]) {
    for (const [px, h] of [[INNER, MID], [OUTER, SIDE]] as [number, number][]) {
      box(b, sx * px, -1.2, 0, 0.62, h + 1.2, 0.72, STONE, GLOW(0.08));
      if (lod === 0) box(b, sx * px, -0.2, 0, 0.8, 0.55, 0.9, STONE_DARK);
    }
  }
  // lintels: the central span and the two side spans
  box(b, 0, MID - 0.7, 0, INNER * 2 + 0.62, 0.7, DEPTH * 0.7, STONE, GLOW(0.08));
  for (const sx of [-1, 1]) box(b, sx * ((INNER + OUTER) / 2), SIDE - 0.55, 0, OUTER - INNER + 0.62, 0.55, DEPTH * 0.65, STONE, GLOW(0.08));
  // roofs (central higher) — the silhouette
  roof(b, 0, MID, INNER * 2 + 0.9, DEPTH, lod);
  for (const sx of [-1, 1]) roof(b, sx * ((INNER + OUTER) / 2 + 0.05), SIDE, OUTER - INNER + 0.9, DEPTH * 0.9, lod);
  // red painted brackets under the eaves, blank plaque, ridge dragons and pearl, lanterns
  for (let k = -3; k <= 3; k++) box(b, k * 0.55, MID - 0.25, 0, 0.18, 0.25, DEPTH * 0.75, k % 2 ? RED : GREEN_DARK);
  cbox(b, 0, MID - 0.35, 0.42, 1.4, 0.5, 0.06, '#27466e', NONE);
  cbox(b, 0, MID - 0.35, 0.45, 1.2, 0.36, 0.02, GOLD, NONE);
  for (const sx of [-1, 1]) {
    cbox(b, sx * 0.85, MID + 1.35, 0, 0.9, 0.22, 0.16, GOLD, NONE, 0, 0, sx * 0.25);
    cbox(b, sx * 1.25, MID + 1.55, 0, 0.18, 0.4, 0.14, GOLD, NONE, 0, 0, sx * -0.4);
    // fish (chiwen) at the side-roof ridge ends
    cbox(b, sx * (OUTER + 0.35), SIDE + 1.15, 0, 0.18, 0.4, 0.14, GOLD, NONE, 0, 0, sx * 0.3);
    // guardian lions on the plinths (street side), red lanterns under the side arches
    box(b, sx * (INNER + 0.05), 0.35, 0.72, 0.42, 0.38, 0.5, '#d6cdbf');
    cbox(b, sx * (INNER + 0.05), 0.9, 0.78, 0.36, 0.32, 0.36, '#d6cdbf');
    cbox(b, sx * ((INNER + OUTER) / 2), SIDE - 0.9, 0, 0.3, 0.38, 0.3, RED, GLOW(0.9));
  }
  cbox(b, 0, MID + 1.4, 0, 0.26, 0.26, 0.26, '#f0c35a', GLOW(0.4));
  if (lod === 0) lanterns(b);
}

// ---------------------------------------------------------------------------
// setting (D2-09)
// ---------------------------------------------------------------------------

const G = settingGround('dragon-gate');
/** the setting's base (the ground at the gate): the corner's night lights are local heights over it */
const Z_BASE = G.base;
/** lantern strings across Grant Ave (local z, north of the gate), the wire this high over the street */
const STRINGS = [-3.4, -6.8, -10.2], WIRE = 3.5, GRANT_HALF = 1.72;

function lanterns(b: BatchLike) {
  for (const z of STRINGS) {
    const y = G.at(0, z) + WIRE;
    const sag = (x: number) => y - 0.35 * (1 - (x / GRANT_HALF) ** 2);
    for (let k = 0; k < 4; k++) {
      const xa = -GRANT_HALF + (k * 2 * GRANT_HALF) / 4, xb = -GRANT_HALF + ((k + 1) * 2 * GRANT_HALF) / 4;
      tube(b, new THREE.Vector3(xa, sag(xa), z), new THREE.Vector3(xb, sag(xb), z), 0.018, '#3a2c22', NONE, 3);
    }
    for (const x of [-1.15, -0.4, 0.4, 1.15]) {
      const yl = sag(x);
      cbox(b, x, yl - 0.32, z, 0.26, 0.3, 0.26, RED, GLOW(0.85));
      box(b, x, yl - 0.18, z, 0.14, 0.06, 0.14, GOLD);
    }
  }
}

// ---------------------------------------------------------------------------
// W5-L6 · the Chinatown corner (plan §3.6): Grant Avenue from California Street to Clay Street
// ---------------------------------------------------------------------------
//
// Grant Avenue's heart between California and Clay: red paper lanterns strung across the street (180 new ones went up in
// August 2023 after the winter storms: sfist.com 2023-08-08; they hang "up and down Grant Avenue": abc7news.com
// 2024-02-01), the dragon lamps (43 designed by D'Arcy Ryan for the 1925 Diamond Jubilee along Grant Ave from Bush St
// to Broadway, red, gold and green, a pagoda lantern with bells under a red roof: SFPUC, "A Look Back in History:
// Chinatown Decorative Streetlights", 2019), shop signs (generic trade words of lane V's atlas, never a shop's name) and
// window shoppers by day. Portsmouth Square, a block east, is closed for its rebuild (June 2026 to 2028: sfrecpark.org),
// so the corner stays on Grant Ave. Facts checked on 2026-09-28. Lane V's measured downtown headroom (sf-w5-V.md: ≈ 50k
// at the Chinatown gate spot after the levers) clears the plan's 20k for this corner (≤ 2 calls, 1.8k triangles).

/**
 * Grant Ave north of the gate, in the gate's frame: its axis turns 2.74° west from the gate's (the fronts of the
 * published city's L0 buildings, measured every 1 u: 3.6 u apart, the west front at x −1.87 at z −2 and −4.74 at z −62).
 * `along` = u north of z −2 on the axis, `across` = u east of the street's middle. California St crosses at along
 * 25…28, Sacramento St at 40…42, Clay St at 53…56; Commercial St opens the east front at along 47…49.
 */
const GA_T = Math.atan(0.0478), GA_HALF = 1.8;
function grant(along: number, across: number): { x: number; z: number } {
  const s = Math.sin(GA_T), c = Math.cos(GA_T);
  return { x: -0.07 - along * s + across * c, z: -2 - along * c - across * s };
}
/** the yaw a front faces: the west front looks east (side −1), the east front west (side 1) */
const frontYaw = (side: -1 | 1) => (side < 0 ? Math.PI / 2 + GA_T : -Math.PI / 2 + GA_T);
/** red lantern strings across Grant Ave (along), the wire this high over the street at the fronts */
const CT_STRINGS = [30.2, 33.4, 36.6, 44.6, 51.2], CT_WIRE = 3.7;
/** dragon lamps at the kerb [along, side] (the 1925 lamps line Grant Ave from Bush St to Broadway) */
const CT_LAMPS: readonly [number, -1 | 1][] = [[31.8, -1], [35.2, 1], [47.8, -1], [51.8, 1]];
const CT_KERB = 1.52;
/** blade signs on the fronts [along, side, plaque] and flat plaques over doors */
const CT_BLADES: readonly [number, -1 | 1, string][] = [
  [30.9, -1, 'dim-sum'], [34.9, -1, 'tea'], [44.2, -1, 'noodles'], [49.6, -1, 'laundry'],
  [37.6, 1, 'grocery'], [45.2, 1, 'flowers'], [50.7, 1, 'books'],
];
const CT_PLAQUES: readonly [number, -1 | 1, string][] = [[33.2, -1, 'grocery'], [46.4, -1, 'tea'], [36.2, 1, 'dim-sum']];
/** shop awnings over the sidewalks [along, side, colour] */
const CT_AWNINGS: readonly [number, -1 | 1, string][] = [[37.3, -1, SF.chinaRed], [38.0, 1, SF.chinaGreen], [51.0, -1, '#d9a441']];
/**
 * window shoppers (10:00–20:00) at the east front's shop windows (along), on its sidewalk strip (the published city's
 * sidewalks along Grant Ave are 0.4–0.5 u wide); the clear lane (3 u, lane T's rule) runs up the street west of them,
 * so the way up Grant Ave stays open
 */
const CT_SHOPPERS: readonly number[] = [35.9, 37.7, 43.6, 45.0, 52.5];
const CT_SHOP_AT = 1.3, CT_LANE_AT = -0.3;

export const CHINATOWN_CORNER: CornerDef = {
  id: 'chinatown',
  order: 9,
  site: 'dragon-gate',
  frame: { x: X0, z: Z0, yaw: YAW },
  name: { zh: '都板街 · 唐人街', en: 'Grant Avenue, Chinatown' },
  ambient: { zh: '在店铺橱窗前逛街的人', en: 'shoppers at the shop windows' },
  box: [-4.9, -55, 0.9, -30],
  windows: { shops: { from: 10 * 60, to: 20 * 60 } },
  signs: (g) => [
    ...CT_BLADES.flatMap(([along, side, id]) => {
      const p = grant(along, side * GA_HALF);
      return blade(NO_BATCH, id, p.x, p.z, g.at(p.x, p.z) + 2.78, frontYaw(side), 0.56);
    }),
    ...CT_PLAQUES.map(([along, side, id]): CornerSign => {
      const p = grant(along, side * (GA_HALF - 0.03)), ry = frontYaw(side);
      return { id, x: p.x, y: g.at(p.x, p.z) + 2.2, z: p.z, ry, w: 0.96 };
    }),
  ],
  build: (b, g) => {
    for (const along of CT_STRINGS) {
      const a = grant(along, -GA_HALF), c = grant(along, GA_HALF), m = grant(along, 0);
      lanternWire(b, a, c, g.at(m.x, m.z) + CT_WIRE, [0.161, 0.383, 0.617, 0.839], 0.35, SF.chinaRed);
    }
    for (const [along, side] of CT_LAMPS) { const p = grant(along, side * CT_KERB); dragonLamp(b, p.x, g.at(p.x, p.z), p.z, frontYaw(side)); }
    for (const [along, side, id] of CT_BLADES) { const p = grant(along, side * GA_HALF); blade(b, id, p.x, p.z, g.at(p.x, p.z) + 2.78, frontYaw(side), 0.56); }
    for (const [along, side, color] of CT_AWNINGS) { const p = grant(along, side * GA_HALF); awning(b, p.x, p.z, 1.15, frontYaw(side), g.at(p.x, p.z) + 2.0, 0.32, color); }
  },
  crowds: CT_SHOPPERS.map((along, i) => ({
    key: `shoppers-${i + 1}`,
    when: 'shops',
    spots: [grant(along, CT_SHOP_AT)],
    face: grant(along, GA_HALF + 1),
    lane: (() => { const a = grant(28, CT_LANE_AT), c = grant(55, CT_LANE_AT); return { ax: a.x, az: a.z, bx: c.x, bz: c.z }; })(),
  })),
  soft: CT_LAMPS.map(([along, side]) => ({ ...grant(along, side * CT_KERB), r: 0.12 })),
  // (lane E has no coin cache on Grant Ave yet: Requests)
  cache: null,
  plaza: CT_SHOPPERS.map(along => { const p = grant(along, CT_SHOP_AT); return rect(p.x, p.z, 0.3, 0.3); }),
  plazaOwn: true,
};

const LIGHTS: NonNullable<SiteHooks['lights']> = [
  ...STRINGS.map(z => ({ x: 0, y: G.at(0, z) + WIRE - 0.5, z, size: 0.55, color: '#ff8a5c' })),
  // W5-L6: the Chinatown corner's lantern strings and dragon lamps (drawn by CHINATOWN_CORNER), at their baked ground
  ...CT_STRINGS.map(along => { const m = grant(along, 0); return { ...m, y: cornerGroundWorld('chinatown', m.x, m.z) - Z_BASE + CT_WIRE - 0.5, size: 0.55, color: '#ff8a5c' }; }),
  ...CT_LAMPS.map(([along, side]) => { const p = grant(along, side * CT_KERB); return { ...p, y: cornerGroundWorld('chinatown', p.x, p.z) - Z_BASE + 3.0, size: 0.8, color: '#ffc27a' }; }),
];
/**
 * Where people stop for the photo: Grant Ave's west sidewalk south of Bush St, the gate across the street.
 * W4-L-int-review: the old strip under the gate (z 0.5–1.4) lay on Bush St's asphalt 0.1 u from the sightseeing loop's
 * line (the gate stands at Bush St's kerb in the city data): the loop bus and the cars drove through the sightseers.
 */
const PLAZA = [rect(-1.8, 3.5, 0.3, 0.3), rect(-1.65, 5.5, 0.3, 0.3)];

/**
 * AI gate (lane D2, D2-06): lane H's SAM mesh at scale 1 (9.6 u wide, 5.85 u tall; central passage 2.24 u wide ×
 * 2.57 u clear, measured on the decoded mesh: inner pillars |x| 1.14–2.05, outer 3.21–4.01, depth ±0.48). SAM dropped
 * the concept's lions, so the procedural guardian lions stay (in front of the inner pillars, street side) with the red
 * lanterns under the side arches (their top is ≈ 2.1 u).
 */
const AI_INNER = 1.6, AI_OUTER = 3.61, AI_SIDE_TOP = 2.05;

function aiRemainder(b: BatchLike) {
  lanterns(b);
  chinatownCluster(b, 0, G.base);
  for (const sx of [-1, 1]) {
    // guardian lion on its plinth (street side, +z), facing down Grant Ave
    box(b, sx * AI_INNER, -0.2, 0.86, 0.62, 0.55, 0.6, STONE_DARK);
    box(b, sx * AI_INNER, 0.35, 0.84, 0.42, 0.38, 0.5, '#d6cdbf');
    cbox(b, sx * AI_INNER, 0.9, 0.9, 0.36, 0.32, 0.36, '#d6cdbf');
    // red lantern under the side arch
    box(b, sx * ((AI_INNER + AI_OUTER) / 2), AI_SIDE_TOP - 0.12, 0, 0.04, 0.12, 0.04, '#3a2c22');
    cbox(b, sx * ((AI_INNER + AI_OUTER) / 2), AI_SIDE_TOP - 0.47, 0, 0.3, 0.36, 0.3, RED, GLOW(0.9));
  }
}

const SWAP: LandmarkSwap = {
  parts: [{ model: 'sf-dragon-gate', x: 0, y: 0, z: 0, scale: [1, 1, 1], glow: 0.08 }],
  build: aiRemainder,
  ship: true,
  note: 'scale 1: passage 2.24 u; procedural lions + lanterns',
};

/** the four pillars (AI: measured; procedural: the plinths), the lions' plinths in front of the inner pair */
function blockers(ai: boolean): WalkBlocker[] {
  // W8-W1: then the pagoda cluster's buildings (one blocker each, world/sf/cornersChinatown.ts CT_BLOCKERS)
  if (!ai) return [...[INNER, OUTER].flatMap(px => [-1, 1].map(sx => ({ poly: rect(sx * px, 0, 0.8, 0.9) }))), ...CT_BLOCKERS];
  return [...[-1, 1].flatMap(sx => [
    // inner pillar (z ±0.48) and the lion plinth in front of it (z 0.56…1.16)
    { poly: rect(sx * AI_INNER, 0.31, 0.94, 1.72) },
    { poly: rect(sx * AI_OUTER, 0, 0.84, 1.0) },
  ]), ...CT_BLOCKERS];
}

export const dragonGate: SfLandmark & SiteHooks = {
  id: 'dragon-gate',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 'terrain',
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0, 0, 9.0, 2.2)) },
  // W8-W1: the city boxes on the pagoda cluster's lots (Sing Chong, Sing Fat, Old St. Mary's, the Telephone Exchange)
  excludeMore: CT_EXCLUDES,
  // Grant Ave's piece under the arch is restored at the street's own height (no sunk ground to step down to)
  sink: 0,
  build,
  ground: streetStrips('dragon-gate'),
  lights: LIGHTS,
  plaza: PLAZA.map(poly => ({ poly, surface: 'pavement' as const })),
  // W5-L6: Grant Avenue's corner — lantern strings, dragon lamps, shop signs, window shoppers (landmarks/cornerKit.ts)
  mount: cornerMount(CHINATOWN_CORNER),
  walk: { blockers: blockers(SWAP.ship) },
  swap: SWAP,
  // the AI gate thins as one while the player walks under it (no dither holes in its roofs); W8-W1: the procedural
  // mesh (lanterns, lions and the pagoda cluster up Grant Ave) keeps the city's per-fragment dither, so the cluster's
  // buildings melt only where they stand between the camera and the player, like the city's
  fade: { r: 3.2, y1: 6.2, box: [4.8, 1.3], procedural: false },
};
