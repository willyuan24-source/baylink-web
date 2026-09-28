import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { type CornerDef, type CornerSign, awning, cafeTable, cornerMount, sitter, stall } from './cornerKit';
import { worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, lamp, planter, plazaOf, tree } from './siteKit';
import { box3, site3Ground, standSpot } from './siteKit3';

/**
 * Noe Valley Town Square (wave 4, P4 · map T3): a former parking lot on 24th Street between Vicksburg and Sanchez that
 * opened on 27 October 2016 as the neighbourhood's gathering place — a lawn, seating, gardens, a pergola stage and trees
 * — after four years of work by Rec and Park, the Residents for Noe Valley Town Square and the supervisor's office; it
 * hosts the Saturday Noe Valley Farmers' Market (volunteer-run since 2003), music, classes and bingo (sfrecpark.org
 * "Noe Valley Town Square"; CBS News).
 *
 * Toy: the square behind the 24th Street sidewalk — pavers and a lawn, the timber pergola at the back, benches,
 * planters, a tree and a lamp; W5-L5 (the corner below): the Saturday market's stalls, café tables in their place the
 * rest of the week.
 *
 * Frame: origin (319.4, 804.5) at the square's centre, yaw −129.5°: local +z faces 24th Street (centreline z 3.55,
 * 4.4 u wide, so its sidewalk begins at z 1.35), the neighbours stand at x < −2.0 and x > 1.9, the back lot line at
 * z −2.4.
 */

const ID = 'noe-valley-town-square';
const X0 = 319.4, Z0 = 804.5, YAW = (-129.5 * Math.PI) / 180;
const g = site3Ground(ID, 11.0);

const LOT: Vec2[] = [{ x: -1.95, z: -2.35 }, { x: 1.8, z: -2.35 }, { x: 1.8, z: 1.6 }, { x: -1.95, z: 1.6 }];
const LAWN: Vec2[] = [{ x: 0.1, z: -2.0 }, { x: 1.6, z: -2.0 }, { x: 1.6, z: -0.4 }, { x: 0.1, z: -0.4 }];
function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    box3(b, -0.2, g.at(-0.2, -1.9) + 1.6, -1.9, 3.2, 0.2, 0.7, FC.wood);
    return;
  }
  // the pergola at the back: posts and a slatted top
  for (const x of [-1.6, -0.2, 1.2]) box3(b, x, g.at(x, -2.05) - 0.1, -2.05, 0.14, 2.0, 0.14, FC.wood);
  box3(b, -0.2, g.at(-0.2, -2.05) + 1.85, -2.05, 3.1, 0.12, 0.7, FC.wood);
  // benches on the sides, planters, a tree and a lamp (the stalls or café tables are the corner's: NOE_CORNER)
  bench(b, -1.55, g.at(-1.55, -0.9), -0.9, Math.PI / 2);
  bench(b, 1.45, g.at(1.45, 1.1), 1.1, -Math.PI / 2);
  planter(b, -1.5, g.at(-1.5, 1.2), 1.2, 0.6, 0.6);
  tree(b, 0.9, g.at(0.9, -1.2), -1.2, 0.95, 4);
  lamp(b, -1.6, g.at(-1.6, 0.5), 0.5);
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(LOT, GC.pavers, PAT.stone, g, 2, 0.07),
    ...gfill(LAWN, GC.lawn, PAT.grass, g, 2, 0.1),
  ];
}

// ---------------------------------------------------------------------------
// W5-L5 · signature corner 7 (plan §3.6): the benches, a Saturday stall row
// ---------------------------------------------------------------------------

/**
 * The Noe Valley Farmers Market fills the square every Saturday, 8 am to 1 pm, year-round, run mostly by volunteers
 * (noevalleyfarmersmarket.com, checked 2026-09-28): then three stalls stand in a row with their crates and painted
 * plaques and shoppers browse; the rest of the week two café tables stand where the front stalls were (the same
 * footprints: the site's blockers hold for both), and by day a neighbour sits on the east bench. The shops either side
 * on 24th Street get an awning and a plaque (the city's buildings: their fronts at z 1.38).
 */
const MARKET = { days: [6], from: 8 * 60, to: 13 * 60 } as const;
const FRONT_STALLS: { x: number; z: number; color: string; sign: string; crates: string[] }[] = [
  { x: -0.9, z: 0.2, color: '#e8d44d', sign: 'produce', crates: ['#7fae4f', '#e08a3a', '#c9473a'] },
  { x: 0.9, z: 0.35, color: '#e8446a', sign: 'flowers', crates: ['#e58aa0', '#f2c14e', '#b88ad8'] },
];
/** the third stall, at the back beside the west bench, its front to the lawn (market day only: a soft obstacle) */
const BACK_STALL = { x: -0.62, z: -1.35, color: '#3fb37f', sign: 'bakery', crates: ['#c99a5b', '#e0b27a', '#b5763f'] };
/** (the east shop's dressing hangs on the city's ground-floor bay window, 0.53 u proud of its wall: measured on L0) */
const NOE_FRONTS: { x: number; w: number; sign: string; awn: string; out: number }[] = [
  { x: -2.7, w: 1.1, sign: 'market', awn: '#2f8f88', out: 0 },
  { x: 4.25, w: 1.5, sign: 'cafe', awn: '#d8744a', out: 0.53 },
];
const NOE_WALL = 1.38;
/**
 * W5-L-review: the market's shoppers stand ≥ 2.5 u from the square's arrival (its mouth, local (0, 1.2)), where lane T's
 * crowd places nobody while the player is within 2.5 u: in the mouth an arriving player never saw them. Two browse from
 * the 24th Street sidewalk either side of the mouth, one on the lawn at the back stall.
 */
const SHOPPERS_FRONT: Vec2[] = [{ x: -2.6, z: 1.7 }, { x: 2.6, z: 1.85 }];
const SHOPPER_BACK: Vec2 = { x: 0.45, z: -1.35 };
/** 24th Street's centreline: the crowd's clear lane */
const NOE_LANE = { ax: -6, az: 3.55, bx: 6, bz: 3.55 };

export const NOE_CORNER: CornerDef = {
  id: 'noe-valley',
  order: 7,
  site: ID,
  frame: { x: X0, z: Z0, yaw: YAW },
  name: { zh: '诺伊谷广场', en: 'Noe Valley Town Square' },
  ambient: { zh: '周六早上的农夫市集', en: 'the Saturday morning farmers market' },
  box: [-4, -2.5, 6, 2.0],
  windows: { market: MARKET, day: { from: 9 * 60, to: 19 * 60 } },
  signs: (ground, on) => [
    ...NOE_FRONTS.map((f): CornerSign => ({ id: f.sign, x: f.x, y: ground.at(f.x, NOE_WALL + 0.3) + 2.62, z: NOE_WALL + f.out + 0.03, ry: 0, w: Math.min(1.0, f.w - 0.3) })),
    // market day: a plaque under each stall's canopy front
    ...(on.has('market') ? [...FRONT_STALLS.map((st): CornerSign => ({ id: st.sign, x: st.x, y: ground.at(st.x, st.z) + 1.38, z: st.z + 0.56, ry: 0, w: 0.62 })),
      { id: BACK_STALL.sign, x: BACK_STALL.x + 0.51, y: ground.at(BACK_STALL.x, BACK_STALL.z) + 1.38, z: BACK_STALL.z, ry: Math.PI / 2, w: 0.56 }] : []),
  ],
  build: (b, ground, on) => {
    for (const f of NOE_FRONTS) awning(b, f.x, NOE_WALL + f.out, f.w, 0, ground.at(f.x, NOE_WALL + 0.3) + 2.2, f.out ? 0.35 : 0.4, f.awn);
    if (on.has('market')) {
      for (const st of FRONT_STALLS) stall(b, st.x, ground.at(st.x, st.z), st.z, 0, st.color, st.crates);
      stall(b, BACK_STALL.x, ground.at(BACK_STALL.x, BACK_STALL.z), BACK_STALL.z, Math.PI / 2, BACK_STALL.color, BACK_STALL.crates, 1.1, 0.9);
    } else {
      cafeTable(b, FRONT_STALLS[0].x, ground.at(FRONT_STALLS[0].x, FRONT_STALLS[0].z), FRONT_STALLS[0].z + 0.05, 0, '#2f6f4a');
      cafeTable(b, FRONT_STALLS[1].x, ground.at(FRONT_STALLS[1].x, FRONT_STALLS[1].z), FRONT_STALLS[1].z + 0.05, 0, '#c9473a');
    }
    // a neighbour on the east bench (siteKit bench at (1.45, 1.1), its back to the east: she faces the square)
    if (on.has('day')) sitter(b, 1.5, ground.at(1.45, 1.1), 1.1, -Math.PI / 2, 5, 0.5);
  },
  crowds: [
    { key: 'market', when: 'market', spots: SHOPPERS_FRONT, face: { x: 0, z: 0.2 }, lane: NOE_LANE },
    { key: 'market-back', when: 'market', spots: [SHOPPER_BACK], face: { x: BACK_STALL.x, z: BACK_STALL.z }, lane: NOE_LANE },
  ],
  soft: [{ when: 'market', x: BACK_STALL.x, z: BACK_STALL.z - 0.3, r: 0.45 }, { when: 'market', x: BACK_STALL.x, z: BACK_STALL.z + 0.3, r: 0.45 }],
  cache: 'noe-valley',
  plaza: [...SHOPPERS_FRONT, SHOPPER_BACK].map(p => standSpot(p).poly),
};

export const noeValleyTownSquare: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  // the lot behind the sidewalk (24th Street keeps its ribbon: 1.9 u off its centreline)
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -2.0, z: -2.45 }, { x: 1.85, z: -2.45 }, { x: 1.85, z: 1.65 }, { x: -2.0, z: 1.65 }]) },
  build,
  walk: {
    blockers: [
      { x: -1.6, z: -2.05, r: 0.15 }, { x: -0.2, z: -2.05, r: 0.15 }, { x: 1.2, z: -2.05, r: 0.15 },
      // (W5-L5: the front stalls on market Saturdays, a café table with its chairs the rest of the week: one footprint)
      { poly: [{ x: -1.5, z: -0.05 }, { x: -0.3, z: -0.05 }, { x: -0.3, z: 0.55 }, { x: -1.5, z: 0.55 }], top: 1.75 },
      { poly: [{ x: 0.3, z: 0.1 }, { x: 1.5, z: 0.1 }, { x: 1.5, z: 0.7 }, { x: 0.3, z: 0.7 }], top: 1.75 },
      { x: -1.5, z: 1.2, r: 0.35 }, { x: 0.9, z: -1.2, r: 0.2 },
    ],
  },
  ground: ground(),
  lights: [{ x: -1.6, y: g.at(-1.6, 0.5) + 3.8, z: 0.5, size: 1, color: '#ffd9a0' }],
  // the square, and three spots on the 24th Street sidewalk in front of it (≈ 0.55 u, the carriageway from z ≈ 1.95: the
  // early record's 1.7 u strip put four of its five spots in the traffic lanes; W4-L3-review)
  plaza: [plazaOf(LOT, 'plaza'), ...[{ x: -3.5, z: 1.75 }, { x: 0.5, z: 1.75 }, { x: 4.3, z: 1.75 }].map(p => standSpot(p)), ...[...SHOPPERS_FRONT, SHOPPER_BACK].map(p => standSpot(p))],
  // W5-L5: the Saturday market, the café tables, the shops either side (landmarks/cornerKit.ts)
  mount: cornerMount(NOE_CORNER),
  w4: {
    placeId: 'noe-valley-town-square',
    attractions: ['noe-valley-town-square'],
    // W5-L1: at the square's mouth between the two stalls (the old spot stood in 24th Street's lane)
    arrival: { x: 0.0, z: 1.2, heading: Math.PI },
    photo: { target: [0, 1.0, -0.5], distance: 11, elevation: 0.3, bearing: 0.3 },
    flag: { x: -0.2, z: -0.8, h: 30 },
    height: { realM: 0, u: 2.0, top: 4.71, rule: 'overlook' },
    osm: [],
    terrain: [-3, -3, 3, 3],
    terrainStep: 1,
    ringMin: 0.62,
    notes: 'Market stalls are generic (no stall names). The crowd spots are the square and points on the 24th Street sidewalk in front (never the carriageway); a mid-block lot, so the houses either side and behind close the walk-around ring to 65 %.',
  },
};
