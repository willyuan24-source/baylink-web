import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { GLOW, LIT, box, rect, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, gstrip, lamp, plazaOf, siteGround, tree } from './siteKit';

/**
 * City College of San Francisco · Ocean Campus (wave 4, P1 · map T2, the owner's request): the city's community
 * college (1935), whose Science Hall — Timothy Pflueger's 489-ft, 90-ft-high classical hall of 1940, placed on the
 * crest of the campus hill and made 89 ft longer than City Hall — crowns the Ocean Campus above Ocean Ave and I-280
 * (The Guardsman, "Ocean Campus Science Hall stands the test of time"). Its end walls carry Herman Volz's mosaic murals:
 * never copied here, plain colour panels only. Diego Rivera's Pan American Unity mural is NOT on show: it waits for the
 * Diego Rivera Performing Arts Center on Frida Kahlo Way (ground broken 22 January 2026, construction into fall 2028;
 * CCSF news) — the construction lot is the sibling record ccsf-drpac.
 *
 * Frame: origin (416, 1277) on the hall, yaw −43.4°: local +z is the front (the entrance and its steps face the
 * lawn falling toward the STEAM building), the hall (OSM relation 16916462) is x −10.7…10.0, z −0.9…1.5 with four
 * short rear wings to z −3.3. Heights: 27 m → 7.4 u walls, the centre pavilion 8.0 u.
 */

const ID = 'ccsf-ocean';
const X0 = 416, Z0 = 1277, YAW = (-43.4 * Math.PI) / 180;
const g = siteGround(ID, 23.2);

const STONE = '#e9e1cf', STONE_SHADE = '#d6ccb6', TRIM = '#f6f1e5', GLASS = '#6f8d99';
const HALL = { x0: -10.7, x1: 10.0, z0: -0.9, z1: 1.5 }, H = 7.4;
const WINGS = [[-8.1, -5.8], [-3.7, -1.3], [0.7, 3.1], [5.2, 7.5]] as const;
const MURALS = ['#3f6d9a', '#e0a94a', '#c9473a', '#4f8f6a', '#e8d9b8'];

const TERRACE: Vec2[] = [{ x: -10.7, z: 1.6 }, { x: 10.0, z: 1.6 }, { x: 10.0, z: 4.9 }, { x: -10.7, z: 4.9 }];
const LAWN: Vec2[] = [{ x: -10.7, z: 4.9 }, { x: 10.0, z: 4.9 }, { x: 10.0, z: 11.6 }, { x: -10.7, z: 11.6 }];
const WALKS: Vec2[][] = [[{ x: -0.35, z: 4.9 }, { x: -0.35, z: 11.6 }], [{ x: -0.35, z: 8.0 }, { x: -9.6, z: 11.4 }], [{ x: -0.35, z: 8.0 }, { x: 8.9, z: 11.4 }]];
const TREES: [number, number][] = [[-8.8, 6.6], [-5.0, 10.2], [4.4, 10.2], [8.4, 6.6], [-9.6, 10.6], [9.2, 10.6]];
const LAMPS: Vec2[] = [{ x: -2.4, z: 4.5 }, { x: 1.7, z: 4.5 }, { x: -6.2, z: 8.9 }, { x: 5.6, z: 8.9 }];
const BENCHES: [number, number, number][] = [[-5.8, 3.9, Math.PI], [5.2, 3.9, Math.PI], [-3.2, 9.4, 0.35], [2.6, 9.4, -0.35]];

function hall(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(0, 0), top = y0 + H, cz = (HALL.z0 + HALL.z1) / 2, w = HALL.x1 - HALL.x0, cx = (HALL.x0 + HALL.x1) / 2;
  box(b, cx, -1.2, cz, w, top + 1.2, HALL.z1 - HALL.z0, STONE, lod === 0 ? [2, y0, -3.7, 0.12] : GLOW(0.12));
  for (const [a, c] of WINGS) box(b, (a + c) / 2, -1.2, -2.1, c - a, top - 0.8 + 1.2, 2.4, STONE_SHADE, GLOW(0.1));
  // the centre pavilion over the entrance, a little taller
  box(b, -0.35, -1.2, 1.55, 2.6, top + 0.6 + 1.2, 0.9, STONE, GLOW(0.14));
  if (lod === 2) return;
  box(b, cx, top, cz, w + 0.3, 0.3, HALL.z1 - HALL.z0 + 0.3, TRIM);
  box(b, -0.35, top + 0.6, 1.55, 2.9, 0.3, 1.15, TRIM);
  // pilaster strips between the window bays on the front, the tall recessed entrance (three doors), the steps
  for (let k = 0; k <= 12; k++) {
    const x = HALL.x0 + 0.6 + (k * (w - 1.2)) / 12;
    if (Math.abs(x + 0.35) < 1.5) continue;
    box(b, x, y0 + 0.4, HALL.z1 + 0.05, 0.28, H - 0.9, 0.14, TRIM);
  }
  box(b, -0.35, y0, 2.02, 1.8, 3.6, 0.06, GLASS, LIT(y0));
  for (const x of [-0.95, 0.25]) box(b, x, y0, 2.07, 0.16, 3.7, 0.12, TRIM);
  for (let k = 0; k < 4; k++) box(b, -0.35, y0 - 0.4 - k * 0.22, 2.3 + k * 0.45, 3.6 + k * 0.4, 0.4, 0.5, '#dcd2bf');
  // the end walls: plain colour panels where the mosaics are (never a copy of them)
  for (const [x, s] of [[HALL.x0 - 0.04, -1], [HALL.x1 + 0.04, 1]] as const) {
    for (let k = 0; k < 5; k++) box(b, x, y0 + 1.2 + k * 1.05, cz, 0.06, 0.95, 1.6, MURALS[(k + (s > 0 ? 2 : 0)) % 5]);
  }
  // roof plant
  box(b, -5, top + 0.3, cz - 0.2, 2.4, 0.8, 1.2, '#cbc3b4');
  box(b, 5.4, top + 0.3, cz - 0.2, 1.8, 0.7, 1.0, '#cbc3b4');
}

function grounds(b: BatchLike) {
  for (const [k, [x, z]] of TREES.entries()) tree(b, x, g.at(x, z), z, 1.15, k + 41);
  for (const l of LAMPS) lamp(b, l.x, g.at(l.x, l.z), l.z);
  for (const [x, z, ry] of BENCHES) bench(b, x, g.at(x, z), z, ry);
  // a low stone wall at the terrace edge, open at the steps
  for (const [a, c] of [[-10.6, -2.6], [1.9, 9.9]]) { const x = (a + c) / 2; box(b, x, g.at(x, 4.95) - 0.3, 4.95, c - a, 0.85, 0.3, STONE_SHADE); }
}

function build(b: BatchLike, lod: 0 | 2) {
  hall(b, lod);
  if (lod === 0) grounds(b);
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(TERRACE, GC.plaza, PAT.stone, g, 3),
    ...gfill(LAWN, GC.lawn, PAT.grass, g, 3),
    ...WALKS.flatMap(w => gstrip(w, 1.5, GC.pavers, PAT.stone, g, 3, 0.075)),
  ];
}

const BLOCKERS = [
  { poly: rect((HALL.x0 + HALL.x1) / 2, (HALL.z0 + HALL.z1) / 2 + 0.25, HALL.x1 - HALL.x0, HALL.z1 - HALL.z0 + 0.5) },
  ...WINGS.map(([a, c]) => ({ poly: rect((a + c) / 2, -2.1, c - a, 2.4) })),
  { poly: rect(-6.6, 4.95, 8.0, 0.4) }, { poly: rect(5.9, 4.95, 8.0, 0.4) },
  ...TREES.map(([x, z]) => ({ x, z, r: 0.3 })),
];

/** exclusion: Science Hall, its terrace and the front lawn (Cloud Hall behind, the STEAM building and the loop road stay) */
const EXCLUDE: Vec2[] = [{ x: -11.3, z: -3.7 }, { x: 10.6, z: -3.7 }, { x: 10.6, z: 12.0 }, { x: -11.3, z: 12.0 }];

export const ccsfOcean: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: BLOCKERS, surfaces: [{ poly: TERRACE, y: 'terrain', surface: 'plaza' }, { poly: LAWN, y: 'terrain', surface: 'grass' }] },
  ground: ground(),
  lights: [
    ...LAMPS.map(l => ({ x: l.x, y: g.at(l.x, l.z) + 3.8, z: l.z, size: 1, color: '#ffd9a0' })),
    { x: -0.35, y: g.at(0, 0) + 6, z: 4, size: 2.6, color: '#ffe3b0' },
  ],
  plaza: [plazaOf(TERRACE), plazaOf(LAWN, 'grass')],
  w4: {
    placeId: 'ccsf-ocean-campus',
    attractions: ['ccsf-ocean-campus'],
    arrival: { x: -0.35, z: 9.8, heading: Math.PI },
    photo: { target: [0, 4, 0], distance: 38, elevation: 0.24, bearing: 0.5 },
    flag: { x: -0.35, z: 1.2, h: 30 },
    height: { realM: 27, u: 8.3, rule: 'H = 3.2 + 0.155·h' },
    osm: ['relation/16916462'],
    terrain: [-12, -5, 12, 13],
    notes: 'The Rivera mural is not on show until the Diego Rivera Performing Arts Center opens (~2028); the Volz mosaics are plain colour panels.',
  },
};
