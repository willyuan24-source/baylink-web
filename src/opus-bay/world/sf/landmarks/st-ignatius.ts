import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { GLOW, LIT, NONE, SF, arch, box, cbox, disc, gable, lathe, pyramid, rect, worldPoly } from './kit';
import type { LandmarkSwap } from './index';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, gstrip, lamp, plazaOf, siteGround, tree } from './siteKit';

/**
 * Saint Ignatius Church (wave 4, P1 · map T2, part of the USF site): the Jesuit church of 1914 by Charles Devlin at
 * Fulton St and Parker Ave, whose twin towers (210 ft, the city's highest points when they were finished in 1914)
 * flank the columned front on its south side, with the dome behind them over the crossing (USF, "9 facts about
 * St. Ignatius Church"; SF Chronicle). An active parish: a quiet card, no gameplay objects, and the saint's statue in
 * the front niche is a plain figure.
 *
 * Frame: origin (−150.4, 753.2), yaw 55.1° — local +z faces south onto Fulton St (z 7.3), Parker Ave runs along
 * x −5.4 (west), the campus lawn with its walks lies east (x 4…13, OSM footways, Kalmanovitz Hall at x ≥ 13.7).
 * Footprint (OSM way 225193440) x −3.3…4.0, z −5.8…5.1. Heights: the towers 210 ft (64 m) → 13.1 u by the rule,
 * drawn 12.9 u to the crosses; the nave 20 m → 5.6 u walls, the dome over the crossing to 10.4 u.
 *
 * The procedural church is the always-shippable fallback; lane V's AI mesh (`w4.aiSlot`) swaps in through the
 * SoloView gate in the integration phase with the same footprint and walk data.
 */

const ID = 'st-ignatius-church';
const X0 = -150.4, Z0 = 753.2, YAW = (55.1 * Math.PI) / 180;
const g = siteGround(ID, 22.4);

const BUFF = '#e6d3ae', BUFF_SHADE = '#d4bf97', TRIM = '#f3ead6', ROOF = '#8a7a6a', DARK = '#4f4a44';
/**
 * Wave 8 · lane W2 (sf-w7-R-realism.md #45): the towers' cupolas and the crossing dome are dark lead-grey metal on the
 * real church, not cream — a photo from the de Young's Hamon tower shows both domed cupolas, their spirelets and the
 * big dome dark grey over the cream stone (https://commons.wikimedia.org/wiki/File:Saint_Ignatius_Church_from_Hamon_Observation_Tower_01_(cropped).jpg ,
 * viewed 2026-09-30). A mid-dark grey (a near-black read too dark in the game: W7-R-review's City Hall note).
 */
const LEAD = '#7b8186', LEAD_DARK = '#686e73';
const DOME = LEAD, DOME_DARK = LEAD_DARK;

const NAVE = { x0: -2.3, x1: 3.0, z0: -5.6, z1: 3.0 };
const CROSS_Z = -2.7, CX = 0.35;
const TOWERS = [-1.75, 2.45];
const TOWER_W = 1.9, TOWER_Z = 4.05;

function church(b: BatchLike, lod: 0 | 2) {
  const fy = g.at(CX, 5.4);
  // nave + transept + apse
  const nw = NAVE.x1 - NAVE.x0, nd = NAVE.z1 - NAVE.z0, ncz = (NAVE.z0 + NAVE.z1) / 2;
  box(b, CX, -1.2, ncz, nw, fy + 5.6 + 1.2, nd, BUFF, lod === 0 ? [4, fy, -3.1, 0.12] : GLOW(0.12));
  gable(b, CX, fy + 5.6, ncz, nd, nw, 1.5, ROOF, BUFF, Math.PI / 2, 0.15);
  box(b, CX, -1.2, CROSS_Z, 7.2, fy + 5.0 + 1.2, 2.4, BUFF, GLOW(0.12));
  gable(b, CX, fy + 5.0, CROSS_Z, 7.2, 2.4, 1.2, ROOF, BUFF, 0, 0.15);
  // the two front towers: square shafts, an open belfry stage, an octagonal lantern, a small cupola
  for (const tx of TOWERS) {
    box(b, tx, -1.2, TOWER_Z, TOWER_W, fy + 7.6 + 1.2, TOWER_W, BUFF, GLOW(0.15));
    // lod 2: the belfry stage, then the lead cupola on it (W8-W2-review C4: no lead cap balanced on a buff spike)
    if (lod === 2) { box(b, tx, fy + 7.6, TOWER_Z, 1.55, 2.05, 1.55, BUFF_SHADE); pyramid(b, tx, fy + 9.65, TOWER_Z, 1.4, 1.4, 3.0, LEAD); continue; }
    box(b, tx, fy + 7.6, TOWER_Z, TOWER_W + 0.2, 0.25, TOWER_W + 0.2, TRIM);
    box(b, tx, fy + 7.85, TOWER_Z, 1.55, 1.6, 1.55, BUFF_SHADE, GLOW(0.15));
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2;
      arch(b, tx + Math.sin(a) * 0.79, fy + 8.0, TOWER_Z + Math.cos(a) * 0.79, 0.6, 1.2, a, DARK, LIT(fy + 8));
    }
    box(b, tx, fy + 9.45, TOWER_Z, 1.75, 0.2, 1.75, TRIM);
    lathe(b, [[0.62, 0], [0.62, 1.2], [0.7, 1.3], [0.45, 1.75], [0.18, 2.2], [0.05, 2.9]], tx, fy + 9.65, TOWER_Z, (ly: number) => new THREE.Color(ly < 1.25 ? BUFF : LEAD), GLOW(0.2), 8);
    cbox(b, tx, fy + 12.7, TOWER_Z, 0.06, 0.4, 0.06, SF.gold);
  }
  // the dome over the crossing: an octagonal drum, the dome, a lantern
  if (lod === 2) { lathe(b, [[1.6, 0], [1.6, 1.6], [0.2, 4.2]], CX, fy + 5.9, CROSS_Z, DOME, NONE, 5); return; }
  lathe(b, [[1.55, 0], [1.55, 1.6]], CX, fy + 5.9, CROSS_Z, BUFF_SHADE, GLOW(0.12), 8);
  lathe(b, [[1.62, 0], [1.5, 0.75], [1.15, 1.45], [0.6, 1.95], [0.25, 2.1]], CX, fy + 7.5, CROSS_Z, (ly: number) => new THREE.Color(ly < 0.8 ? DOME_DARK : DOME), NONE, 12);
  lathe(b, [[0.3, 0], [0.3, 0.55], [0.08, 0.95]], CX, fy + 9.55, CROSS_Z, LEAD_DARK, GLOW(0.3), 6);
  // the front: steps, four columns and their entablature, the pediment, the saint's niche, three doors
  const zf = 5.12;
  for (let k = 0; k < 2; k++) box(b, CX + 0.35, fy - 0.3 + k * 0.15, zf + 0.05 - k * 0.12, 2.3 - k * 0.3, 0.3, 0.45, '#d8ccb6');
  for (const x of [-0.55, 0.15, 0.85, 1.55]) box(b, x, fy, zf - 0.05, 0.26, 4.3, 0.26, TRIM);
  box(b, CX + 0.15, fy + 4.3, zf - 0.1, 2.9, 0.45, 0.4, TRIM);
  gable(b, CX + 0.15, fy + 4.75, zf - 0.2, 2.9, 0.3, 0.8, TRIM, BUFF, 0, 0.05);
  arch(b, CX + 0.15, fy + 2.7, zf - 0.28, 0.55, 1.1, 0, '#6a6258');
  box(b, CX + 0.15, fy + 2.75, zf - 0.25, 0.22, 0.75, 0.16, '#efe7d6');                   // the statue (a plain figure)
  cbox(b, CX + 0.15, fy + 3.62, zf - 0.25, 0.16, 0.16, 0.16, '#efe7d6');
  for (const [x, w] of [[CX + 0.15, 0.8], [TOWERS[0], 0.55], [TOWERS[1], 0.55]]) arch(b, x, fy, zf + (Math.abs(x - CX) > 1 ? 0.0 : -0.27), w, 1.5, 0, DARK, LIT(fy));
  disc(b, CX + 0.15, fy + 5.25, zf - 0.18, 0.28, 0.05, 0, '#e8c98a', GLOW(0.8), 10);
  // clerestory lights along the nave
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) arch(b, CX + sx * (nw / 2 + 0.02), fy + 2.6, NAVE.z0 + 1.2 + k * 1.1, 0.45, 1.3, sx * Math.PI / 2, '#5d6f86', GLOW(0.7));
}

/** the campus lawn east of the church (USF's green between the church, Kalmanovitz Hall and Gleeson Library) */
const LAWN: Vec2[] = [{ x: 4.6, z: -6.2 }, { x: 13.0, z: -6.2 }, { x: 13.0, z: 5.0 }, { x: 4.6, z: 5.0 }];
const WALK_A: Vec2[] = [{ x: 4.4, z: -0.8 }, { x: 12.8, z: -4.9 }];
const WALK_B: Vec2[] = [{ x: 4.4, z: 2.7 }, { x: 12.8, z: 2.7 }];
const TREES: [number, number][] = [[6.2, -4.6], [11.6, -1.2], [6.4, 4.1], [11.8, 4.3]];
const LAMPS: Vec2[] = [{ x: 4.9, z: 1.1 }, { x: 12.6, z: -5.8 }];
const BENCHES: [number, number, number][] = [[8.4, 1.9, 0], [10.2, -3.4, 2.7]];

function lawn(b: BatchLike) {
  for (const [k, [x, z]] of TREES.entries()) tree(b, x, g.at(x, z), z, 1.1, k + 31);
  for (const l of LAMPS) lamp(b, l.x, g.at(l.x, l.z), l.z);
  for (const [x, z, ry] of BENCHES) bench(b, x, g.at(x, z), z, ry);
}

function build(b: BatchLike, lod: 0 | 2) {
  church(b, lod);
  if (lod === 0) lawn(b);
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(LAWN, GC.lawn, PAT.grass, g, 4),
    ...gstrip(WALK_A, 1.6, GC.pavers, PAT.stone, g, 3, 0.075),
    ...gstrip(WALK_B, 1.6, GC.pavers, PAT.stone, g, 3, 0.075),
    // the church's own forecourt strip along Fulton St and Parker Ave (the city sidewalk stops at the exclusion)
    ...gfill([{ x: -3.5, z: 5.1 }, { x: 4.6, z: 5.1 }, { x: 4.6, z: 5.35 }, { x: -3.5, z: 5.35 }], GC.sidewalk, PAT.stone, g, 4),
  ];
}

const BLOCKERS = [
  { poly: rect(CX, (NAVE.z0 + NAVE.z1) / 2, NAVE.x1 - NAVE.x0, NAVE.z1 - NAVE.z0) },
  { poly: rect(CX, CROSS_Z, 7.2, 2.4) },
  ...TOWERS.map(tx => ({ poly: rect(tx, TOWER_Z, TOWER_W, TOWER_W) })),
  { poly: rect(CX + 0.15, 4.4, 2.9, 1.2) },
  ...TREES.map(([x, z]) => ({ x, z, r: 0.3 })),
];

/** exclusion: the church and the lawn east of it (Fulton St, Parker Ave and the campus halls stay the city's) */
const EXCLUDE: Vec2[] = [{ x: -3.6, z: -6.5 }, { x: 13.2, z: -6.5 }, { x: 13.2, z: 5.4 }, { x: -3.6, z: 5.4 }];

/**
 * Lane V's AI church (W4-L4, `sf-st-ignatius`: twin four-stage towers with domed lanterns and crosses, the columned
 * front and pediment, the tile nave and the dome on its drum; published at this church's bounds, scale 1), placed where
 * the slot planned it (front on Fulton St at the steps' ground). The remainder is the campus lawn and a stone plinth
 * under the church where the slope falls toward Fulton St. Gate: see SWAP.note.
 */
const AI_AT = { x: CX, y: +g.at(CX, 5.4).toFixed(2), z: -0.18 };
/**
 * W8-W2: lead shells over the AI church's cream cupolas and dome (the model's texture is cream there). Measured on
 * the GLB (scripts: opus-qa/w8/w2/ign.mts, glbNode): each tower's domed cupola sits on its open lantern from model
 * y 11.0 (r 0.71 at the cornice) to the cross's foot at 12.2 (centres (−2.39, 4.42) and (2.59, 4.41)); the crossing
 * dome rises from its drum's cornice at 8.75 (r 1.61) to the lantern's foot at 10.5 (r 0.68), the lantern's cap from
 * 11.75 (r 0.72) to 12.3; centre (0, −1.89). Each shell's radius clears the band maximum of the model's vertices above
 * it by ≥ 4 % + 0.03 (a 12-sided lathe's faces sit at cos 15° of its radius), so the cream never shows through; the
 * crosses and the lantern's columns stay the model's. 12 sides each: the swap's remainder stays ≤ 1200 triangles
 * (tests/opus-bay-sf-models W4-IL5).
 */
export const IGN_SHELLS = {
  cupola: { at: [[-2.39, 4.42], [2.59, 4.41]] as [number, number][], y0: 10.95, profile: [[0.8, 0], [0.66, 0.3], [0.62, 0.55], [0.52, 0.8], [0.33, 1.05], [0.14, 1.22], [0.05, 1.27]] as [number, number][] },
  dome: { at: [0, -1.89] as [number, number], y0: 8.68, profile: [[1.77, 0], [1.72, 0.32], [1.66, 0.57], [1.58, 0.82], [1.42, 1.07], [1.26, 1.32], [1.08, 1.57], [0.8, 1.82], [0.72, 1.86]] as [number, number][] },
  cap: { at: [0, -1.89] as [number, number], y0: 11.72, profile: [[0.82, 0], [0.64, 0.3], [0.42, 0.52], [0.2, 0.66], [0.06, 0.72]] as [number, number][] },
  /**
   * W8-W2-review (C5): the open lantern between the dome and its cap, cream in the model (r ≤ 0.723 over model y
   * 10.54–11.72, scratch opus-qa/w8/w2-rev/lantern.mts), is the same dark grey metal as the dome on the restored church
   * (https://commons.wikimedia.org/wiki/File:Dome,_Saint_Ignatius_Church_-_San_Francisco,_CA.jpg , taken 14 Jan 2024,
   * viewed 2026-10-01): a lead drum over it (its arched openings read as a band at the distances the church is seen from)
   */
  lantern: { at: [0, -1.89] as [number, number], y0: 10.5, profile: [[0.79, 0], [0.79, 1.24]] as [number, number][] },
} as const;
function leadShells(b: BatchLike) {
  const { cupola, dome, cap, lantern } = IGN_SHELLS;
  for (const [mx, mz] of cupola.at) lathe(b, cupola.profile, AI_AT.x + mx, AI_AT.y + cupola.y0, AI_AT.z + mz, LEAD, NONE, 12);
  lathe(b, dome.profile, AI_AT.x + dome.at[0], AI_AT.y + dome.y0, AI_AT.z + dome.at[1], (ly: number) => new THREE.Color(ly < 0.1 ? LEAD_DARK : LEAD), NONE, 12);
  lathe(b, cap.profile, AI_AT.x + cap.at[0], AI_AT.y + cap.y0, AI_AT.z + cap.at[1], LEAD, NONE, 12);
  lathe(b, lantern.profile, AI_AT.x + lantern.at[0], AI_AT.y + lantern.y0, AI_AT.z + lantern.at[1], LEAD, NONE, 12);
}
const SWAP: LandmarkSwap = {
  parts: [{ model: 'sf-st-ignatius', x: AI_AT.x, y: AI_AT.y, z: AI_AT.z, yaw: 0, scale: [1, 1, 1], glow: 0.12, castShadow: true }],
  build(b) {
    const fy = g.at(CX, 5.4);
    box(b, CX, -1.2, (NAVE.z0 + 4.9) / 2, NAVE.x1 - NAVE.x0, fy + 1.2, 4.9 - NAVE.z0, BUFF_SHADE);
    leadShells(b);
    lawn(b);
  },
  ship: true,
  note: 'AI (SoloView gate, golden: crosses on the towers, the columned front and pediment, red tile roofs, the dome on its drum with a lantern) vs a plainer box church',
};

export const stIgnatius: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  swap: SWAP,
  walk: { blockers: BLOCKERS, surfaces: [{ poly: LAWN, y: 'terrain', surface: 'grass' }] },
  ground: ground(),
  fade: { r: 5, y1: 13, box: [3.8, 5.8] },
  lights: [
    ...LAMPS.map(l => ({ x: l.x, y: g.at(l.x, l.z) + 3.8, z: l.z, size: 1, color: '#ffd9a0' })),
    // floodlit towers and dome (the church is lit at night)
    ...TOWERS.map(tx => ({ x: tx, y: g.at(tx, 6) + 9, z: TOWER_Z + 1.4, size: 2.2, color: '#ffe3b0' })),
  ],
  plaza: [plazaOf(LAWN, 'grass')],
  w4: {
    placeId: 'st-ignatius-church',
    attractions: ['st-ignatius-church'],
    // W4-IL14: on the campus lawn at the front's east corner, facing the towers (the front stands on Fulton St's
    // sidewalk line with no forecourt to stand on: the early spot was the Fulton St kerb)
    arrival: { x: 5.5, z: 4.4, heading: -1.844 },
    photo: { target: [0.4, 6.5, 0], distance: 34, elevation: 0.2, bearing: 0.35 },
    flag: { x: CX, z: CROSS_Z, h: 30 },
    height: { realM: 64, u: 12.9, top: 13.5, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/225193440'],
    terrain: [-5, -8, 15, 8],
    aiSlot: { model: 'w4-st-ignatius', id: 'sf-st-ignatius', at: [CX, +g.at(CX, 5.4).toFixed(2), -0.18], note: 'lane V (data/sf/w4Models.ts, sf-st-ignatius): twin spires + dome (H-1); swap through the SoloView gate, same footprint and blockers' },
    notes: 'Active parish: respectful card, no gameplay objects on the church.',
  },
};
