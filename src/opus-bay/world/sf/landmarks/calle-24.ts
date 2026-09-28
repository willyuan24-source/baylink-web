import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { type CornerDef, type CornerSign, awning, cornerMount, guitarist, paperString } from './cornerKit';
import { worldPoly } from './kit';
import type { W4Site } from './siteKit';
import { box3, site3Ground, standSpot } from './siteKit3';

/**
 * Calle 24 Latino Cultural District (wave 4, P4 · map T3, the Mission): 24th Street's long-time centre of the city's
 * Latino activism, arts and commerce, established as a cultural district in May 2014 by the Board of Supervisors and
 * Mayor Ed Lee after the Calle 24 merchants' and neighbours' advocacy (calle24sf.org "Our History"; Wikipedia "Calle
 * 24 Latino Cultural District"). Balmy Alley opens off 24th Street one block west, between Treat Avenue and Harrison.
 *
 * Toy: the north side of 24th Street between Harrison and Alabama — a corner marker at Harrison (a plinth with a
 * tiled cap in plain colour fields, no plaque text), three poles with vertical banners and strings of generic cut-paper
 * flags (papel picado colours only: no words, no figures) over the sidewalk. Shop signs stay blank (the city's
 * buildings); the street itself is the city's.
 *
 * Frame: origin (452.79, 634.9) on the north building line of 24th Street, yaw 50.4° (Balmy Alley's): local +z points
 * across 24th Street (centreline z 2.0, 4.4 u wide, so the fronts stand at z ≈ −0.2 and 4.2), +x runs east toward
 * Alabama Street (x 6.9, south side); Harrison Street crosses at x −4.5.
 */

const ID = 'calle-24';
const X0 = 452.79, Z0 = 634.9, YAW = (50.4 * Math.PI) / 180;
const g = site3Ground(ID, 3.0);

const PAPER = ['#e8446a', '#f28c3a', '#e8d44d', '#3fb37f', '#3a8fc2', '#9b59b6', '#f06292'];
const POLE = '#4d5a55';
/** the three poles along the north kerb line of the sidewalk, and the strings between them */
const POLES = [-1.5, 1.6, 4.7];
const ZP = 0.0, POLE_H = 3.7, STRING_Y = 3.25, SAG = 0.35;

function flagString(b: BatchLike, x0: number, x1: number, seed: number) {
  const ya = g.at(x0, ZP) + STRING_Y, yb = g.at(x1, ZP) + STRING_Y;
  const n = 8, pts: THREE.Vector3[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = x0 + (x1 - x0) * t, y = ya + (yb - ya) * t - SAG * 4 * t * (1 - t);
    pts.push(new THREE.Vector3(x, y, ZP));
  }
  for (let k = 0; k < n; k++) {
    const a = pts[k], c = pts[k + 1], L = a.distanceTo(c);
    b.beam(a, c, 0.03, 0.03, '#f4efe2');
    // one cut-paper flag hanging under each stretch of string
    if (L > 0.1) box3(b, (a.x + c.x) / 2, (a.y + c.y) / 2 - 0.42, ZP, 0.34, 0.38, 0.02, PAPER[(k + seed) % PAPER.length], 0, [0, 0, 0.6, 0]);
  }
}

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    box3(b, 1.6, g.at(1.6, 0) + STRING_Y - 0.6, ZP, 6.2, 0.4, 0.05, PAPER[0]);
    return;
  }
  for (const [k, x] of POLES.entries()) {
    const y = g.at(x, ZP);
    box3(b, x, y - 0.1, ZP, 0.1, POLE_H + 0.1, 0.1, POLE);
    // a vertical banner on the pole, facing the street (plain colour, no text)
    box3(b, x + 0.3, y + 2.0, ZP + 0.02, 0.5, 1.1, 0.03, PAPER[(k * 3 + 1) % PAPER.length]);
  }
  for (let i = 0; i + 1 < POLES.length; i++) flagString(b, POLES[i], POLES[i + 1], i * 3);
  // the corner marker at Harrison: a plinth with a tiled cap in colour fields (no plaque text)
  const mx = -2.2, my = g.at(mx, ZP);
  box3(b, mx, my - 0.1, ZP, 0.55, 1.3, 0.3, '#cfc6b4');
  for (const [k, dx] of [-0.18, 0, 0.18].entries()) box3(b, mx + dx, my + 1.2, ZP, 0.19, 0.28, 0.32, PAPER[(k + 2) % PAPER.length]);
}

/**
 * the crowd's stand spots on both sidewalks of the block (each ≈ 0.5 u, with driveway cuts; the carriageway runs z
 * ≈ 0.45…3.7): the early record's 1.4 u strips put 9 of their 10 spots in the traffic lanes (W4-L3-review)
 */
const WALKS: Vec2[] = [{ x: -1.0, z: 0.2 }, { x: 0.5, z: 0.2 }, { x: 3.0, z: 0.2 }, { x: 0.5, z: 3.85 }, { x: 4.2, z: 3.85 }];

// ---------------------------------------------------------------------------
// W5-L4 · signature corner 3 (plan §3.6): papel-picado strings across the street, taquería awnings, a guitarist
// ---------------------------------------------------------------------------

/**
 * the shopfronts dressed (the city's buildings: the north fronts at z −0.2, the south at 4.2): an awning each (plain
 * colour, never a mural or a sign copied) and a painted plaque of lane V's atlas above it (Spanish trade words first,
 * as 24th Street's shops are signed). North, only between the banners and clear of the street tree's crown.
 */
const FRONTS: { x0: number; x1: number; side: -1 | 1; color: string; sign: string; w: number }[] = [
  { x0: -2.1, x1: -0.8, side: -1, color: '#d8544a', sign: 'panaderia', w: 1.0 },
  { x0: -0.6, x1: 1.0, side: -1, color: '#e0a94a', sign: 'taqueria', w: 1.1 },
  { x0: 1.1, x1: 2.6, side: -1, color: '#2f8f88', sign: 'mercado', w: 1.0 },
  { x0: 0.35, x1: 1.3, side: 1, color: '#f28c3a', sign: 'barber', w: 0.85 },
  { x0: 2.35, x1: 4.35, side: 1, color: '#3fb37f', sign: 'cafe', w: 1.0 },
];
/** the fronts' wall lines (local z) by the way they face */
const WALL = { [1]: -0.2, [-1]: 4.2 } as const;
/** the guitarist on the south sidewalk under the taquería's awning, his case along the wall toward Harrison */
const BUSKER = { x: 1.5, z: 3.9 };
/** his listeners: two on his sidewalk, two across the street on the north one (walked spots, standable at 0.3 u) */
const LISTENERS: Vec2[] = [{ x: -0.3, z: 3.8 }, { x: 2.4, z: 3.8 }, { x: 0.6, z: 0.15 }, { x: 1.2, z: 0.15 }];

export const CALLE_24_CORNER: CornerDef = {
  id: 'calle-24',
  order: 3,
  site: ID,
  frame: { x: X0, z: Z0, yaw: YAW },
  name: { zh: '24 街 · 教会区', en: '24th Street, the Mission' },
  ambient: { zh: '塔可店檐下弹吉他的街头艺人', en: 'a guitarist under a taquería awning' },
  box: [-3, -0.6, 6, 4.6],
  windows: { afternoon: { from: 12 * 60, to: 20 * 60 } },
  signs: ground => FRONTS.map((f): CornerSign => {
    const x = (f.x0 + f.x1) / 2, zf = WALL[f.side];
    return { id: f.sign, x, y: ground.at(x, zf + f.side * 0.3) + 2.62, z: zf + f.side * 0.02, ry: f.side > 0 ? 0 : Math.PI, w: f.w };
  }),
  build: (b, ground, on) => {
    for (const f of FRONTS) { const x = (f.x0 + f.x1) / 2, zf = WALL[f.side]; awning(b, x, zf, f.x1 - f.x0, f.side > 0 ? 0 : Math.PI, ground.at(x, zf + f.side * 0.3) + 2.22, 0.45, f.color); }
    // papel picado across the street, from the banner poles' tops to hooks on the south fronts, and along the south fronts
    const V = (x: number, dy: number, z: number) => new THREE.Vector3(x, ground.at(x, z) + dy, z);
    paperString(b, V(-1.5, 3.62, 0.0), V(-1.1, 3.95, 4.15), PAPER, 0.3, 1);
    paperString(b, V(1.6, 3.62, 0.0), V(2.05, 3.95, 4.15), PAPER, 0.3, 4);
    paperString(b, V(4.7, 3.62, 0.0), V(5.0, 3.95, 4.15), PAPER, 0.3, 2);
    paperString(b, V(-2.1, 3.55, 4.12), V(2.6, 3.55, 4.12), PAPER, 0.22, 5);
    if (on.has('afternoon')) guitarist(b, BUSKER.x, ground.at(BUSKER.x, BUSKER.z), BUSKER.z, Math.PI, 1, 0.75);
  },
  crowds: [{ key: 'listeners', when: 'afternoon', spots: LISTENERS, face: BUSKER, lane: { ax: -6, az: 2.0, bx: 8, bz: 2.0 } }],
  soft: [{ when: 'afternoon', x: BUSKER.x, z: BUSKER.z, r: 0.3, kind: 'person' }, { when: 'afternoon', x: BUSKER.x - 0.75, z: 3.95, r: 0.3 }],
  cache: 'calle-24',
  plaza: LISTENERS.map(p => standSpot(p).poly),
};

export const calle24: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  // a strip along the north building fronts (1.9…2.2 u off 24th Street's centreline: the street keeps its ribbon),
  // ending before Alabama Street's north arm (x 6.9)
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -2.6, z: -0.18 }, { x: 5.4, z: -0.18 }, { x: 5.4, z: 0.1 }, { x: -2.6, z: 0.1 }]) },
  build,
  walk: { blockers: [...POLES.map(x => ({ x, z: ZP, r: 0.1 })), { poly: [{ x: -2.48, z: -0.15 }, { x: -1.92, z: -0.15 }, { x: -1.92, z: 0.15 }, { x: -2.48, z: 0.15 }] }] },
  // (W5-L4: + the guitarist's listeners)
  plaza: [...WALKS, ...LISTENERS].map(p => standSpot(p)),
  // W5-L4: the corner's awnings, plaques, papel picado across the street and the afternoon guitarist (landmarks/cornerKit.ts)
  mount: cornerMount(CALLE_24_CORNER),
  w4: {
    placeId: 'calle-24',
    attractions: ['calle-24'],
    // W5-L1: on the north sidewalk under the flag strings (the old spot stood in 24th Street's lane)
    arrival: { x: -0.8, z: 0.35, heading: Math.PI / 2 },
    photo: { target: [1.6, 2.4, 0], distance: 12, elevation: 0.15, bearing: 2.4 },
    flag: { x: 1.6, z: 0, h: 30 },
    height: { realM: 0, u: 3.7, top: 3.8, rule: 'overlook' },
    osm: [],
    terrain: [-4, -2, 7, 2],
    ringMin: 0.65,
    notes: 'Generic cut-paper colours only (no words or figures), blank shop signs; the Calle 24 murals and Balmy Alley\'s are never copied. The crowd spots are points on both sidewalks of the block (never the carriageway); the row houses on both sides close the walk-around ring to 67 %.',
  },
};
