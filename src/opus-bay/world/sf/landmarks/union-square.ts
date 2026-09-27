import type { Vec2 } from '../../../core/types';
import { type BatchLike, CBOX, CYL, ICO, M } from '../../builder';
import { GLOW, box, lathe, worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, plazaOf, siteGround } from './siteKit';

/**
 * Union Square (wave 4, P2 · map T1, downtown diet ≤ 0.6k triangles, lod-0 ring 200 u): the granite plaza between
 * Post, Stockton, Geary and Powell Streets, with the 1903 Dewey Monument in the middle — a Corinthian column carrying
 * a bronze Victory — and palms at its corners; the Powell St cable cars pass along its west side (Wikipedia; the
 * shops and theatres around it are city buildings, no names or signs anywhere).
 *
 * Frame: origin (96.1, 221.35) at the monument (OSM place osm-w616479962), yaw 55°: local −z faces Post St (map
 * north, centreline z −7.2), +z Geary St (z 7.2), −x Powell St with the cable-car tracks (x −10.4), +x Stockton St
 * (x 10.4). The plaza (OSM park way) is x −6.7…6.6, z −5.4…5.5. The column: 97 ft (29.6 m) → 7.8 u to Victory's
 * head (H = 3.2 + 0.155·h).
 */

const ID = 'union-square';
const X0 = 96.1, Z0 = 221.35, YAW = (55 * Math.PI) / 180;
const g = siteGround(ID, 4.5);

const GRANITE = '#e2dccf', GRANITE_DARK = '#c9c1b1', BRONZE = '#8a7a52';
const PLAZA: Vec2[] = [{ x: -6.7, z: -4.6 }, { x: -3.2, z: -4.6 }, { x: -2.0, z: -5.15 }, { x: 6.6, z: -5.15 }, { x: 6.6, z: 5.1 }, { x: -6.7, z: 5.1 }];
const PALMS: Vec2[] = [{ x: -5.6, z: -4.2 }, { x: 5.5, z: -4.2 }, { x: -5.6, z: 4.2 }, { x: 5.5, z: 4.2 }];

/** a lean palm for the diet: tapering four-sided trunk + five fronds (76 triangles) */
function palm5(b: BatchLike, x: number, y: number, z: number, H: number, seed: number) {
  b.add(CYL(4, 0.75), M(x, y - 0.2, z, 0, 0.26, H + 0.2, 0.26), FC.palmTrunk);
  for (let i = 0; i < 5; i++) {
    const yaw = seed + (i / 5) * Math.PI * 2, pitch = i % 2 ? 0.5 : 0.25, seg = 1.4;
    const dx = Math.sin(yaw) * Math.cos(pitch) * seg, dy = -Math.sin(pitch) * seg, dz = Math.cos(yaw) * Math.cos(pitch) * seg;
    b.add(CBOX(), M(x + dx / 2, y + H + dy / 2, z + dz / 2, yaw, 0.45, 0.05, seg * 1.05, pitch), FC.frond, [0, 0, 0.3, 0]);
  }
}

/** the Dewey Monument: granite base, the column and its capital, Victory with her trident and wreath */
function dewey(b: BatchLike, lod: 0 | 2) {
  const y = g.at(0, 0);
  box(b, 0, y - 0.3, 0, 1.5, 0.75, 1.5, GRANITE_DARK);
  box(b, 0, y + 0.45, 0, 1.0, 0.9, 1.0, GRANITE, GLOW(0.2));
  lathe(b, [[0.3, 0], [0.26, 5.0], [0.24, 5.2]], 0, y + 1.35, 0, GRANITE, GLOW(0.2), lod === 0 ? 8 : 5);
  if (lod === 2) return;
  box(b, 0, y + 6.55, 0, 0.62, 0.35, 0.62, GRANITE);
  // Victory (a plain toy figure: body, head, the raised trident and wreath), gilt bronze
  box(b, 0, y + 6.9, 0, 0.22, 0.62, 0.18, BRONZE, GLOW(0.35));
  b.add(ICO(0), M(0, y + 7.62, 0, 0, 0.1, 0.1, 0.1), BRONZE, GLOW(0.35));
  box(b, 0.16, y + 7.1, 0, 0.04, 0.95, 0.04, BRONZE, GLOW(0.35));
  b.add(CBOX(), M(-0.2, y + 7.55, 0, 0, 0.2, 0.2, 0.04), BRONZE, GLOW(0.35));
}

function build(b: BatchLike, lod: 0 | 2) {
  dewey(b, lod);
  if (lod === 2) return;
  for (const [k, p] of PALMS.entries()) palm5(b, p.x, g.at(p.x, p.z), p.z, 4.8, k * 1.3);
  for (const [x, z, ry] of [[-2.6, 1.8, 0], [2.6, -1.8, Math.PI]] as const) bench(b, x, g.at(x, z), z, ry);
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(PLAZA, GC.plaza, PAT.stone, g, 3),
    ...gfill([{ x: -1.3, z: -1.3 }, { x: 1.3, z: -1.3 }, { x: 1.3, z: 1.3 }, { x: -1.3, z: 1.3 }], GRANITE_DARK, PAT.stone, g, 3, 0.09),
    // dark granite squares under the palms (flat ground, not kerb boxes: the diet counts the ground; W4-L-review)
    ...PALMS.flatMap(p => gfill([{ x: p.x - 0.6, z: p.z - 0.6 }, { x: p.x + 0.6, z: p.z - 0.6 }, { x: p.x + 0.6, z: p.z + 0.6 }, { x: p.x - 0.6, z: p.z + 0.6 }], GRANITE_DARK, PAT.stone, g, 3, 0.09)),
  ];
}

/** exclusion: the plaza, kept clear of Post St (and its slip lane by the Powell corner) and Geary St */
const EXCLUDE: Vec2[] = [{ x: -7.0, z: -4.75 }, { x: -3.2, z: -4.75 }, { x: -2.0, z: -5.3 }, { x: 6.9, z: -5.3 }, { x: 6.9, z: 5.2 }, { x: -7.0, z: 5.2 }];

export const unionSquare: W4Site = {
  id: ID,
  tier: 1,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  castShadow: true,
  walk: {
    blockers: [{ x: 0, z: 0, r: 0.8 }, ...PALMS.map(p => ({ x: p.x, z: p.z, r: 0.65 }))],
    surfaces: [{ poly: PLAZA, y: 'terrain', surface: 'plaza' }],
  },
  ground: ground(),
  lights: [{ x: 0, y: g.at(0, 0) + 1.2, z: 1.2, size: 2.4, color: '#ffe3b0' }],
  plaza: [plazaOf(PLAZA)],
  w4: {
    placeId: 'union-square',
    attractions: ['union-square'],
    lod0R: 200,
    budget: 600,
    arrival: { x: -3.0, z: 3.0, heading: 2.4 },
    photo: { target: [0, 4, 0], distance: 26, elevation: 0.3, bearing: -0.9 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 29.6, u: 7.8, top: 9.0, rule: 'H = 3.2 + 0.155·h' },
    osm: ['place osm-w616479962 (Dewey Monument)', 'park way of Union Square'],
    terrain: [-9, -8, 9, 8],
    notes: 'Downtown diet (plan §2.2 / §2.6): if lane V measures < 4k headroom at the Chinatown spot, the integration keeps only the ground and the column (lod0R 120).',
  },
};
