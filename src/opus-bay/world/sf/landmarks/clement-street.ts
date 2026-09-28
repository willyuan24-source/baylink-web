import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { type CornerDef, type CornerSign, bladeSign, cornerMount } from './cornerKit';
import { worldPoly } from './kit';
import { type ShopBlock, shopBlockers, shopBoard, shopExclude, shopFronts, shopGround, shopLights } from './shopStreet';
import { type W4Site, siteGround } from './siteKit';

/**
 * Clement Street, Inner Richmond (wave 4, P3 · map T3, the clement strip): one of the Richmond's main streets, lined
 * with dim sum restaurants, bakeries, Cantonese delis, Chinese grocers and produce markets — the city's "New
 * Chinatown", grown from the 1970s when families moved west for space and cheaper houses (SF Examiner, "How the
 * Richmond became 'New Chinatown'"; Richmond Review 2021). Toy version of the block between 5th and 6th Avenues: the
 * carriageway and sidewalks rebuilt, zebra crossings at both corners, awnings over every shopfront, blank signboards
 * (no shop names, no characters), produce stands with crates on the sidewalk, street trees and lamps.
 *
 * Frame: origin (−331.05, 774.13) on Clement's centreline mid-block, yaw −130.7°: local +x runs west along Clement
 * toward 6th Avenue (its centreline at x 6.6), 5th Avenue at x −6.6; the published ribbon (3.6 wide, with its
 * sidewalks) meets the shop facades at z ±1.8. The shops themselves stay the city's buildings.
 */

const ID = 'clement-street';
const X0 = -331.05, Z0 = 774.13, YAW = (-130.7 * Math.PI) / 180;
const g = siteGround(ID, 12.4);

const BLOCK: ShopBlock = {
  x0: -4.8, x1: 4.8, half: 1.8, road: 1.2, bays: 5,
  stands: [[-1, 1], [1, 3], [1, 0]],
  kerb: [[-3.6, -1, 'tree'], [3.4, 1, 'tree'], [0.4, 1, 'lamp'], [-0.6, -1, 'lamp']],
  awnings: ['#b8322a', '#2f6f4a', '#e0b04e', '#f1e6cf', '#4f7fbf'],
  signs: ['#c9473a', '#e0b04e', '#2f6f4a', '#f4efe2', '#7a4fa0'],
};

/**
 * the crowd's spots on the two sidewalks (plaza pieces 1 u long by the kerb, clear of the stands, trees and lamps: a
 * whole-sidewalk strip put its spots against the facades and the kerb items, where no walker fits; W4-L-review)
 */
const SIDEWALK_SPOTS: [number, -1 | 1][] = [[-4.2, -1], [0.3, -1], [3.0, -1], [-1.4, 1], [4.2, 1]];

function build(b: BatchLike, lod: 0 | 2) { shopFronts(b, BLOCK, g, lod); }

// ---------------------------------------------------------------------------
// W5-L4 · signature corner 2 (plan §3.6): bookshop and dim-sum windows, shoppers at the produce stands
// ---------------------------------------------------------------------------

/** the painted plaques on the blank boards: [side, bay, sign] (generic trade words of lane V's atlas, never a name) */
const BOARDS: [-1 | 1, number, string][] = [
  [1, 0, 'produce'], [1, 1, 'books'], [1, 2, 'bakery'], [1, 3, 'grocery'], [1, 4, 'tea'],
  [-1, 0, 'hardware'], [-1, 1, 'produce'], [-1, 2, 'noodles'], [-1, 3, 'dim-sum'], [-1, 4, 'flowers'],
];
/** blade signs over the sidewalk (read along the street), clear of the two street trees' crowns and of the city's bay
 *  windows: [side, local x, sign] */
const BLADES: [-1 | 1, number, string][] = [[1, -0.1, 'books'], [1, 1.0, 'bakery'], [-1, 0.9, 'noodles'], [-1, 4.5, 'dim-sum']];
const BLADE_W = 0.7;
/**
 * The city's ground-floor bay windows on the shopfronts (world/recipes/city.ts bay(), measured on the published city's
 * L0): [x from, x to] and the |z| of their fronts. The plaques of the boards they cover hang on the bays' faces.
 */
const BAYS: Record<-1 | 1, { spans: [number, number][]; face: number }> = {
  [1]: { spans: [[-2.0, -0.3], [1.2, 2.6]], face: 1.25 },
  [-1]: { spans: [[-2.9, -0.6], [1.4, 3.7]], face: 1.3 },
};
/** the bay a board's plaque hangs on (its x kept on the bay's face), or null */
const bayOf = (side: -1 | 1, x: number, w: number) => {
  const bay = BAYS[side].spans.find(([a, b]) => x > a - 0.3 && x < b + 0.3);
  return bay ? { z: side * (BAYS[side].face - 0.03), x: Math.min(bay[1] - w / 2, Math.max(bay[0] + w / 2, x)) } : null;
};
/**
 * shoppers beside two produce stands, each group facing its stand, on the walked strip of the sidewalk (the kerb half,
 * z ±1.3–1.5: the shopfronts' footprints reach past the facade line), clear of the trees and lamps
 */
const SHOPPERS: { at: Vec2[]; stand: Vec2 }[] = [
  { at: [{ x: -2.45, z: 1.4 }, { x: -1.6, z: 1.4 }], stand: { x: -3.6, z: 1.5 } },
  { at: [{ x: 0.0, z: -1.4 }], stand: { x: -1.8, z: -1.5 } },
];
/**
 * the crowd's clear lane: the zebra crossing at 5th Avenue (the shoppers stand on both sidewalks, so a lane along the
 * street would push one side's into the shopfronts; T's lanes move every group's standers)
 */
const LANE = { ax: BLOCK.x0 - 0.8, az: -2.2, bx: BLOCK.x0 - 0.8, bz: 2.2 };
const SHOPPER_SPOTS: Vec2[][] = SHOPPERS.flatMap(({ at }) => at.map(p => [{ x: p.x - 0.2, z: p.z - 0.08 }, { x: p.x + 0.2, z: p.z - 0.08 }, { x: p.x + 0.2, z: p.z + 0.08 }, { x: p.x - 0.2, z: p.z + 0.08 }]));

function blades(b: BatchLike | null): CornerSign[] {
  const out: CornerSign[] = [];
  const sink = b ?? { add() { return this; } } as unknown as BatchLike;
  for (const [side, x, id] of BLADES) {
    const zf = side * BLOCK.half, y = g.at(x, zf);
    out.push(...bladeSign(sink, id, x, y + 3.02, zf - side * 0.08, zf - side * (0.08 + BLADE_W), BLADE_W));
  }
  return out;
}

export const CLEMENT_CORNER: CornerDef = {
  id: 'clement',
  order: 2,
  site: ID,
  frame: { x: X0, z: Z0, yaw: YAW },
  name: { zh: '克莱门特街 · 里士满区', en: 'Clement Street, the Richmond' },
  ambient: { zh: '菜摊前挑菜的街坊', en: 'shoppers at the produce stands' },
  box: [-6, -2.2, 6, 2.2],
  windows: { day: { from: 9 * 60, to: 19 * 60 } },
  ground: g,
  signs: () => [
    ...BOARDS.map(([side, bay, id]): CornerSign => {
      const k = shopBoard(BLOCK, side, bay), on = bayOf(side, k.x, 1.0);
      return { id, x: on ? on.x : k.x, y: g.at(k.x, k.zf) + k.dy, z: on ? on.z : k.z, ry: k.ry, w: 1.0 };
    }),
    ...blades(null),
  ],
  build: b => { blades(b); },
  crowds: SHOPPERS.map(({ at, stand }, i) => ({ key: `shoppers-${i}`, when: 'day', spots: at, face: stand, lane: LANE })),
  cache: 'clement-street',
  plaza: SHOPPER_SPOTS,
};

export const clementStreet: W4Site = {
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
    // W5-L4: where the shoppers stand beside the produce stands
    ...SHOPPER_SPOTS.map(poly => ({ poly, surface: 'pavement' as const })),
  ],
  // W5-L4: the corner's plaques, blade signs and shoppers (landmarks/cornerKit.ts)
  mount: cornerMount(CLEMENT_CORNER),
  w4: {
    placeId: 'clement-street',
    attractions: ['clement-street'],
    arrival: { x: 1.6, z: -1.3, heading: -Math.PI / 2 },
    photo: { target: [0, 1.6, 0], distance: 13, elevation: 0.28, bearing: 1.25 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 6, u: 2.9, top: 4.7, rule: 'overlook' },
    osm: [],
    terrain: [-7, -3, 7, 3],
    terrainStep: 1,
    street: { x0: BLOCK.x0, x1: BLOCK.x1, half: BLOCK.half },
    plazaMin: 1.2,
    notes: 'The crowd plaza is five sidewalk spots of the block (the shops close both sides); the arrival is on the south sidewalk. A shopping street: no shop names, signs or characters anywhere (blank boards); the shops are the city\'s buildings.',
  },
};
