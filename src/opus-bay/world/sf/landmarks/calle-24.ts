import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
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
  plaza: WALKS.map(p => standSpot(p)),
  w4: {
    placeId: 'calle-24',
    attractions: ['calle-24'],
    arrival: { x: -0.8, z: 1.1, heading: Math.PI / 2 },
    photo: { target: [1.6, 2.4, 0], distance: 12, elevation: 0.15, bearing: 2.4 },
    flag: { x: 1.6, z: 0, h: 30 },
    height: { realM: 0, u: 3.7, top: 3.8, rule: 'overlook' },
    osm: [],
    terrain: [-4, -2, 7, 2],
    ringMin: 0.65,
    notes: 'Generic cut-paper colours only (no words or figures), blank shop signs; the Calle 24 murals and Balmy Alley\'s are never copied. The crowd spots are points on both sidewalks of the block (never the carriageway); the row houses on both sides close the walk-around ring to 67 %.',
  },
};
