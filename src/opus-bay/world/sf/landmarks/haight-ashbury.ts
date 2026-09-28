import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { type CornerDef, type CornerSign, blade, cornerMount, guitarist } from './cornerKit';
import { GLOW, LIT, NONE, box, cbox, disc, gable, pyramid, rect, worldPoly } from './kit';
import { type W4Site, siteGround } from './siteKit';
import { standSpot } from './siteKit3';

/**
 * Haight & Ashbury (wave 4, P2 · map T2): the corner that gave its name to the 1967 Summer of Love. Toy version of
 * the east corner (where the Counterculture Museum is, OSM node 4359145394): a painted Victorian corner building with
 * its corner turret, bay windows and shopfronts in loud colour blocks (never a copy of a real mural or sign), the
 * row along Ashbury, the corner's famous street-sign pole (blank green blades: no text) and a corner clock whose hands
 * are stuck at 4:20. The sightseeing loop stops here (lane T's stop pole).
 *
 * Frame: origin (−41.72, 763.28) at the crossing, yaw −34.8°: Haight St runs along local z (x = 0, 4.4 wide),
 * Ashbury St along local x (z = 0, 3.6 wide); the corner quadrant is x > 0, z < 0. The buildings replace OSM ways
 * 264356958, 264356960 and 264356943 (city boxes of 4.6–5.1 u) on the same footprints, 5.2 u with the turret to 7.0.
 */

const ID = 'haight-ashbury';
const X0 = -41.72, Z0 = 763.28, YAW = (-34.8 * Math.PI) / 180;
const g = siteGround(ID, 18.5);

const PAINT = ['#7a4fa0', '#2f8f88', '#e0a94a', '#d8744a', '#c94f7c', '#4f7fbf'];
const TRIM = '#f6efe0', GREEN_SIGN = '#2f6f4a';
const CORNER = { x0: 2.3, x1: 5.6, z0: -9.0, z1: -1.9 };
const ROW = [{ x0: 5.6, x1: 8.7 }, { x0: 8.7, x1: 11.8 }];
const ROW_Z = { z0: -4.7, z1: -1.9 };

/** a painted Victorian front on a face: shop window + two floors of bay windows, colour bands, cornice */
function facade(b: BatchLike, x: number, z: number, w: number, ry: number, y0: number, h: number, k: number) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (u: number, v: number) => ({ x: x + u * c + v * s, z: z - u * s + v * c });
  const f = at(0, 0.06);
  box(b, f.x, y0 - 0.1, f.z, w - 0.2, 1.6, 0.1, '#51605d', LIT(y0), ry);                       // shopfront glass
  box(b, f.x, y0 + 1.5, f.z, w, 0.35, 0.14, PAINT[(k + 2) % 6], NONE, ry);                    // signboard band (blank)
  for (const fl of [0, 1]) {
    const bay = at(0, 0.35);
    box(b, bay.x, y0 + 1.95 + fl * 1.5, bay.z, w * 0.55, 1.2, 0.6, PAINT[(k + fl * 3) % 6], [5, y0 + 1.95, -k - 1, 0], ry);
  }
  box(b, f.x, y0 + h - 0.35, f.z, w + 0.1, 0.35, 0.25, TRIM, NONE, ry);                        // cornice
}

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(3.5, -3.5);
  const top = y0 + 5.2;
  const cx = (CORNER.x0 + CORNER.x1) / 2, cz = (CORNER.z0 + CORNER.z1) / 2;
  box(b, cx, -1.2, cz, CORNER.x1 - CORNER.x0, top + 1.2, CORNER.z1 - CORNER.z0, PAINT[0], GLOW(0.05));
  for (const [k, r] of ROW.entries()) {
    const ry0 = g.at((r.x0 + r.x1) / 2, -3);
    box(b, (r.x0 + r.x1) / 2, -1.2, (ROW_Z.z0 + ROW_Z.z1) / 2, r.x1 - r.x0, ry0 + 4.7 + 1.2, ROW_Z.z1 - ROW_Z.z0, PAINT[(k + 1) * 2 % 6], GLOW(0.05));
    if (lod === 0) gable(b, (r.x0 + r.x1) / 2, ry0 + 4.7, (ROW_Z.z0 + ROW_Z.z1) / 2 - 0.3, r.x1 - r.x0, ROW_Z.z1 - ROW_Z.z0 - 0.6, 0.9, '#6f5f55', PAINT[(k + 1) * 2 % 6], Math.PI / 2, 0.1);
  }
  // the corner turret: a round tower with a candle-snuffer roof
  pyramid(b, CORNER.x0 + 0.9, top, CORNER.z1 - 0.9, 1.9, 1.9, 1.8, '#5a4e6e');
  if (lod === 2) return;
  box(b, CORNER.x0 + 0.9, y0 + 1.8, CORNER.z1 - 0.9, 1.8, top - y0 - 1.8, 1.8, PAINT[4], [5, y0 + 1.8, -3, 0]);
  // fronts: two on Haight (x = CORNER.x0 face, facing −x), one on Ashbury (z = CORNER.z1 face, facing +z)
  facade(b, CORNER.x0, -6.9, 3.4, -Math.PI / 2, y0, 5.2, 0);
  facade(b, CORNER.x0, -3.9, 2.4, -Math.PI / 2, y0, 5.2, 3);
  facade(b, 4.3, CORNER.z1, 2.2, 0, y0, 5.2, 1);
  for (const [k, r] of ROW.entries()) facade(b, (r.x0 + r.x1) / 2, ROW_Z.z1, r.x1 - r.x0 - 0.2, 0, g.at((r.x0 + r.x1) / 2, -2), 4.7, k + 4);
  box(b, cx, top, cz, CORNER.x1 - CORNER.x0 + 0.2, 0.3, CORNER.z1 - CORNER.z0 + 0.2, TRIM);
  // the corner clock (hands at 4:20), on the turret over the crossing
  const cy = y0 + 2.9;
  disc(b, CORNER.x0 - 0.05, cy, CORNER.z1 - 0.9, 0.55, 0.08, -Math.PI / 2, '#f4efe2', GLOW(0.6), 14);
  cbox(b, CORNER.x0 - 0.12, cy + 0.11, CORNER.z1 - 0.9 - 0.14, 0.03, 0.3, 0.05, '#2f2f33', NONE, 0, 0.75);        // 4 o'clock hour hand
  cbox(b, CORNER.x0 - 0.12, cy - 0.14, CORNER.z1 - 0.9 - 0.08, 0.03, 0.42, 0.04, '#2f2f33', NONE, 0, -0.5);      // 20 past
  // the street-sign pole on the corner: two blank green blades at right angles
  const px = 2.05, pz = -1.65, py = g.at(px, pz);
  box(b, px, py - 0.2, pz, 0.08, 3.5, 0.08, '#56605c');
  box(b, px, py + 3.05, pz - 0.55, 0.05, 0.22, 1.1, GREEN_SIGN);
  box(b, px + 0.55, py + 3.3, pz, 1.1, 0.22, 0.05, GREEN_SIGN);
}

const BLOCKERS = [
  { poly: rect((CORNER.x0 + CORNER.x1) / 2, (CORNER.z0 + CORNER.z1) / 2, CORNER.x1 - CORNER.x0, CORNER.z1 - CORNER.z0) },
  ...ROW.map(r => ({ poly: rect((r.x0 + r.x1) / 2, (ROW_Z.z0 + ROW_Z.z1) / 2, r.x1 - r.x0, ROW_Z.z1 - ROW_Z.z0) })),
  { x: 2.05, z: -1.65, r: 0.15 },
];

// ---------------------------------------------------------------------------
// W5-L5 · signature corner 5 (plan §3.6): colourful shopfronts with their painted plaques, a busker's spot on Haight St
// ---------------------------------------------------------------------------

/**
 * Haight Street's shops are independents, many of them vintage clothing and record stores (sanfranciscovintage.com
 * "Haight-Ashbury"; onetripwonder.com "Haight Street"): the corner's own painted fronts get generic plaques of lane V's
 * atlas on their blank sign bands (never a real shop's name or sign), a blade sign between the two Haight St fronts,
 * and a street guitarist plays on the Haight St sidewalk in the afternoon, listeners on both sidewalks.
 */
const Y_CORNER = () => g.at(3.5, -3.5);
/** [x, z, facing yaw, plaque, the front's ground]: on the sign bands facade() draws (0.13 u proud of the wall) */
const HAIGHT_BOARDS: [number, number, number, string, () => number][] = [
  [CORNER.x0 - 0.15, -6.9, -Math.PI / 2, 'vintage', Y_CORNER],
  [CORNER.x0 - 0.15, -3.9, -Math.PI / 2, 'records', Y_CORNER],
  [4.3, CORNER.z1 + 0.15, 0, 'cafe', Y_CORNER],
  [(ROW[0].x0 + ROW[0].x1) / 2, ROW_Z.z1 + 0.15, 0, 'books-en', () => g.at((ROW[0].x0 + ROW[0].x1) / 2, -2)],
  [(ROW[1].x0 + ROW[1].x1) / 2, ROW_Z.z1 + 0.15, 0, 'barber', () => g.at((ROW[1].x0 + ROW[1].x1) / 2, -2)],
];
const BUSKER_H = { x: 1.85, z: -7.4 };
const LISTENERS_H: Vec2[] = [{ x: -1.7, z: -8.0 }, { x: -1.7, z: -7.0 }, { x: 1.85, z: -6.3 }];
/** the blade between the two Haight St fronts (in the gap between their bay windows) */
function haightBlade(b: BatchLike | null): CornerSign[] {
  const sink = b ?? { add() { return this; } } as unknown as BatchLike;
  return blade(sink, 'records', CORNER.x0, -5.15, Y_CORNER() + 2.72, -Math.PI / 2, 0.6);
}

export const HAIGHT_CORNER: CornerDef = {
  id: 'haight',
  order: 5,
  site: ID,
  frame: { x: X0, z: Z0, yaw: YAW },
  name: { zh: '海特街 · 海特-阿什伯里', en: 'Haight Street at Ashbury' },
  ambient: { zh: '海特街人行道上弹琴的街头艺人', en: 'a busker on the Haight Street sidewalk' },
  box: [-3, -10, 12.5, 0],
  windows: { afternoon: { from: 11 * 60, to: 19 * 60 } },
  ground: g,
  signs: () => [
    ...HAIGHT_BOARDS.map(([x, z, ry, id, y0]): CornerSign => ({ id, x, y: y0() + 1.675, z, ry, w: 0.95 })),
    ...haightBlade(null),
  ],
  build: (b, _ground, on) => {
    haightBlade(b);
    if (on.has('afternoon')) guitarist(b, BUSKER_H.x, g.at(BUSKER_H.x, BUSKER_H.z), BUSKER_H.z, -Math.PI / 2, 3, -0.8);
  },
  crowds: [{ key: 'listeners', when: 'afternoon', spots: LISTENERS_H, face: BUSKER_H, lane: { ax: 0, az: -12, bx: 0, bz: 2 } }],
  soft: [{ when: 'afternoon', x: BUSKER_H.x, z: BUSKER_H.z, r: 0.3, kind: 'person' }, { when: 'afternoon', x: 1.9, z: BUSKER_H.z - 0.8, r: 0.3 }],
  // lane E's cache on this corner (economy/coinSpots.ts, appended at lane L's request)
  cache: 'haight',
  plaza: LISTENERS_H.map(p => standSpot(p).poly),
};

/** exclusion: the corner quadrant's buildings, 1.9 u off Haight's centreline and 1.5 u off Ashbury's */
const EXCLUDE: Vec2[] = [{ x: 1.95, z: -9.3 }, { x: 5.0, z: -9.3 }, { x: 5.0, z: -5.0 }, { x: 12.2, z: -5.0 }, { x: 12.2, z: -1.5 }, { x: 1.95, z: -1.5 }];

export const haightAshbury: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: BLOCKERS },
  lights: [{ x: 1.4, y: g.at(1.4, -1.2) + 3.0, z: -1.2, size: 1.4, color: '#ffcf8a' }],
  // (W4-IL17: two spots on Ashbury's west sidewalk facing the corner; the sidewalks round the crossing are 0.3 u past
  // the asphalt elsewhere, and the old strip was the Haight St carriageway)
  plaza: [{ poly: rect(-1.9, -4.5, 0.3, 0.3), surface: 'pavement' }, { poly: rect(-1.9, -5.0, 0.3, 0.3), surface: 'pavement' }, ...LISTENERS_H.map(p => standSpot(p))],
  // W5-L5: the corner's plaques, blade sign and afternoon busker (landmarks/cornerKit.ts)
  mount: cornerMount(HAIGHT_CORNER),
  w4: {
    placeId: 'haight-ashbury',
    attractions: ['haight-ashbury'],
    lod0R: 260,
    // (W4-IL17: the south-west corner's kerb return, off both carriageways, looking across Ashbury at the corner)
    arrival: { x: -1.9, z: -1.9, heading: 1.859 },
    photo: { target: [3.5, 3, -3.5], distance: 20, elevation: 0.18, bearing: -2.4 },
    flag: { x: 3.3, z: -5.5, h: 30 },
    height: { realM: 24, u: 7.0, top: 7.3, rule: 'H = 3.2 + 0.155·h' },
    osm: ['node/4359145394', 'way/264356958', 'way/264356960', 'way/264356943'],
    terrain: [-3, -11, 14, 3],
    ringMin: 0.6,
    plazaMin: 0.17,
    notes: 'A street corner with its origin at the crossing (outside the corner quadrant it models), not a plaza: the crowd stands on two sidewalk spots on Ashbury facing the corner (the city\'s sidewalks round the crossing are 0.3 u wide past the asphalt) and the walk-around ring is 60 % (row houses on both streets close the block).',
  },
};
