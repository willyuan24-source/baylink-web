import type { BatchLike } from '../../builder';
import { type CornerDef, type CornerSign, bladeSign, cornerMount } from './cornerKit';
import { worldPoly } from './kit';
import { type ShopBlock, shopBlockers, shopBoard, shopExclude, shopFronts, shopGapX, shopGround, shopLights } from './shopStreet';
import { type W4Site, siteGround } from './siteKit';

/**
 * Irving Street, the Sunset (wave 4, P3 · map T3, the irving strip): the Sunset's main street, with a long run of
 * Chinese bakeries, roast-meat shops, grocers and Vietnamese and Thai cafés serving one of the city's largest
 * Chinese-American neighbourhoods (SF Chronicle, "The Middle Sunset's vibrant food scene"; the scouting). Toy version
 * of the block between 21st and 22nd Avenues, the N Judah one block south on Judah St (its stop at 23rd Ave ≈ 34 u
 * away; W4-L-review: it said two blocks): the carriageway and sidewalks rebuilt,
 * zebra crossings at both corners, awnings, blank signboards (no names), produce stands with market crates, the
 * block's street tree and two palms, a lamp.
 *
 * Frame: origin (−249.91, 1125.02) on Irving's centreline mid-block, yaw −130.7°: local +x runs west toward 22nd
 * Avenue (its centreline at x 6.5), 21st Avenue at x −6.6; the ribbon (3.6 wide, with its sidewalks) meets the
 * facades at z ±1.8. The shops stay the city's buildings.
 */

const ID = 'irving-street';
const X0 = -249.91, Z0 = 1125.02, YAW = (-130.7 * Math.PI) / 180;
const g = siteGround(ID, 15.0);

const BLOCK: ShopBlock = {
  x0: -4.8, x1: 4.7, half: 1.8, road: 1.2, bays: 4,
  // (W5-L4: the north stand moved from bay 1 to bay 0: the bakery's morning queue stands along bays 1–2)
  stands: [[1, 0], [-1, 2], [1, 3]],
  kerb: [[-2.0, 1, 'tree'], [0.4, -1, 'palm'], [3.6, 1, 'palm'], [-3.2, -1, 'lamp']],
  awnings: ['#d8744a', '#2f8f88', '#c9473a', '#e0a94a', '#f1e6cf'],
  signs: ['#f4efe2', '#c9473a', '#e0b04e', '#2f6f4a', '#4f7fbf'],
};

/**
 * the crowd's spots on the two sidewalks (plaza pieces 1 u long by the kerb, clear of the stands, trees and lamps: a
 * whole-sidewalk strip put its spots against the facades and the kerb items, where no walker fits; W4-L-review)
 */
const SIDEWALK_SPOTS: [number, -1 | 1][] = [[-4.2, -1], [-2.0, -1], [3.3, -1], [-1.0, 1], [1.2, 1]];

function build(b: BatchLike, lod: 0 | 2) { shopFronts(b, BLOCK, g, lod); }

// ---------------------------------------------------------------------------
// W5-L4 · signature corner 1 (plan §3.6): bakery and dim-sum windows, an early-morning queue
// ---------------------------------------------------------------------------

/** the painted plaques on the blank boards: [side, bay, sign] (generic trade words of lane V's atlas, never a name) */
const BOARDS: [-1 | 1, number, string][] = [
  [1, 0, 'produce'], [1, 1, 'tea'], [1, 2, 'bakery'], [1, 3, 'grocery'],
  [-1, 0, 'noodles'], [-1, 1, 'dim-sum'], [-1, 2, 'produce'], [-1, 3, 'coffee'],
];
/** blade signs over the sidewalk (read along the street): [side, gap between bays, sign] */
const BLADES: [-1 | 1, number, string][] = [[1, 3, 'bakery'], [1, 2, 'tea'], [-1, 2, 'dim-sum'], [-1, 1, 'noodles']];
const BLADE_W = 0.72;
/**
 * the bakery's queue along the north sidewalk, head at its door (bay 2): the walked strip there is the kerb half of the
 * sidewalk (z 1.2–1.4: the shopfronts' footprints reach past the facade line), clear of the stand (bay 0) and the tree
 */
const QUEUE_Z = 1.3;
const QUEUE_X = [1.9, 1.05, 0.25, -0.5];
const QUEUE_STRIP = [{ x: -0.9, z: 1.2 }, { x: 2.2, z: 1.2 }, { x: 2.2, z: 1.42 }, { x: -0.9, z: 1.42 }];
/** the crowd's clear lane: along the south half of the carriageway (the queue keeps the north sidewalk) */
const LANE = { ax: -7, az: -0.3, bx: 7, bz: -0.3 };

function blades(b: BatchLike | null): CornerSign[] {
  const out: CornerSign[] = [];
  const sink = b ?? { add() { return this; }, beam() { return this; } } as unknown as BatchLike;
  for (const [side, gap, id] of BLADES) {
    const x = shopGapX(BLOCK, gap), zf = side * BLOCK.half, y = g.at(x, zf);
    out.push(...bladeSign(sink, id, x, y + 3.02, zf - side * 0.08, zf - side * (0.08 + BLADE_W), BLADE_W));
  }
  return out;
}

export const IRVING_CORNER: CornerDef = {
  id: 'irving',
  order: 1,
  site: ID,
  frame: { x: X0, z: Z0, yaw: YAW },
  name: { zh: '尔文街 · 日落区', en: 'Irving Street, the Sunset' },
  ambient: { zh: '一早在面包店门口排队', en: 'an early-morning queue at the bakery' },
  box: [-6, -2.2, 6, 2.2],
  // bakeries open early; the line is longest before eleven, a couple of people wait on into the afternoon
  windows: { early: { from: 6 * 60 + 30, to: 11 * 60 }, day: { from: 11 * 60, to: 18 * 60 + 30 } },
  ground: g,
  signs: () => [
    ...BOARDS.map(([side, bay, id]): CornerSign => { const k = shopBoard(BLOCK, side, bay); return { id, x: k.x, y: g.at(k.x, k.zf) + k.dy, z: k.z, ry: k.ry, w: 1.1 }; }),
    ...blades(null),
  ],
  build: b => { blades(b); },
  crowds: [
    { key: 'queue', when: 'early', spots: QUEUE_X.map(x => ({ x, z: QUEUE_Z })), face: { x: 2.7, z: 1.6 }, lane: LANE },
    { key: 'queue-day', when: 'day', spots: QUEUE_X.slice(0, 2).map(x => ({ x, z: QUEUE_Z })), face: { x: 2.7, z: 1.6 }, lane: LANE },
  ],
  cache: 'irving-street',
  plaza: [QUEUE_STRIP],
};

export const irvingStreet: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, shopExclude(BLOCK)) },
  build,
  walk: { blockers: shopBlockers(BLOCK) },
  ground: shopGround(BLOCK, g),
  lights: shopLights(BLOCK, g),
  // the two sidewalks (a crowd spot is never on the carriageway: the crowd stands exactly there)
  plaza: [
    ...SIDEWALK_SPOTS.map(([x, side]) => ({ poly: [{ x: x - 0.5, z: side * 1.22 }, { x: x + 0.5, z: side * 1.22 }, { x: x + 0.5, z: side * 1.5 }, { x: x - 0.5, z: side * 1.5 }], surface: 'pavement' as const })),
    // W5-L4: the bakery queue's strip along the north shopfronts
    { poly: QUEUE_STRIP, surface: 'pavement' as const },
  ],
  // W5-L4: the corner's plaques, blade signs and morning queue (landmarks/cornerKit.ts)
  mount: cornerMount(IRVING_CORNER),
  w4: {
    placeId: 'irving-street',
    attractions: ['irving-street'],
    arrival: { x: -1.2, z: -1.35, heading: Math.PI / 2 },
    photo: { target: [0, 1.6, 0], distance: 13, elevation: 0.28, bearing: 1.25 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 6, u: 2.9, top: 4.5, rule: 'overlook' },
    osm: [],
    terrain: [-7, -3, 7, 3],
    terrainStep: 1,
    street: { x0: BLOCK.x0, x1: BLOCK.x1, half: BLOCK.half },
    plazaMin: 1.2,
    notes: 'The crowd plaza is five sidewalk spots of the block (the shops close both sides); the arrival is on the south sidewalk. A shopping street: no shop names, signs or characters anywhere (blank boards); the shops are the city\'s buildings.',
  },
};
