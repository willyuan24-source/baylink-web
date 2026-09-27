import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CBOX, ICO, M } from '../../builder';
import { GLOW, LIT, NONE, SF, box, cbox, gable, pyramid, rect, worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, conifer, gfill, plazaOf, siteGround } from './siteKit';

/**
 * Japanese Tea Garden (wave 4, P2 · map T2, the Music Concourse site): the oldest public Japanese garden in the US
 * (1894, Golden Gate Park), west of Hagiwara Tea Garden Drive — its wooden entrance gate, the high arched drum bridge
 * over the pond, the five-tiered pagoda, the tea house, stone lanterns, pines and maples inside a bamboo fence
 * (gggp.org). Toy version from the kit; the plan's conditional AI pagoda set only if this reads weak at the gate.
 *
 * Frame: origin (−243, 965), yaw 0 (local = world offsets): the grounds (OSM grass way around the garden) are
 * x −7.6…8.8, z −9.9…10.5; the gate faces east onto Hagiwara Tea Garden Drive (x ≈ 8.4). Heights: pagoda ≈ 15 m
 * → 5.9 u with its finial, the gate 3.0 u, the drum bridge's crown 1.6 u over the water.
 */

const ID = 'japanese-tea-garden';
const X0 = -243, Z0 = 965, YAW = 0;
const g = siteGround(ID, 16.7);

const RED = '#b8432f', RED_DARK = '#8f3324', ROOF = '#3f4a46', WOOD = '#8a6446', WOOD_DARK = '#6b4c35', BAMBOO = '#b9a56e', WATER = '#6fa3a8', MAPLE = '#c4553a';

const GROUNDS: Vec2[] = [{ x: 5.3, z: -9.3 }, { x: 7.9, z: 4.4 }, { x: 3.7, z: 9.6 }, { x: -3.2, z: 9.9 }, { x: -5.0, z: 8.8 }, { x: -7.0, z: 5.3 }, { x: -6.0, z: -9.1 }];
const POND: Vec2[] = [{ x: -4.2, z: -3.6 }, { x: -1.2, z: -4.4 }, { x: 2.4, z: -3.2 }, { x: 3.4, z: 0.2 }, { x: 1.6, z: 3.2 }, { x: -1.4, z: 3.6 }, { x: -3.8, z: 2.4 }, { x: -4.8, z: -0.6 }];
const PAGODA = { x: -3.6, z: 6.6 }, GATE = { x: 6.3, z: -3.0 }, TEA = { x: 2.6, z: 6.4 };
const BRIDGE = { x: -0.6, z: -0.4, len: 4.2, rise: 1.6 };

/** the drum bridge: an arched deck of 10 planks over the pond, red rails (local frame of the bridge: along x) */
function drumBridge(b: BatchLike) {
  const y0 = g.at(BRIDGE.x, BRIDGE.z) - 0.05, n = 10, L = BRIDGE.len, R = BRIDGE.rise;
  const P = (t: number) => { const a = Math.PI * t; return { x: BRIDGE.x - L / 2 + L * t, y: y0 + Math.sin(a) * R }; };
  for (let k = 0; k < n; k++) {
    const a = P(k / n), c = P((k + 1) / n);
    const mid = new THREE.Vector3((a.x + c.x) / 2, (a.y + c.y) / 2, BRIDGE.z);
    const ang = Math.atan2(c.y - a.y, c.x - a.x), len = Math.hypot(c.x - a.x, c.y - a.y);
    b.add(CBOX(), new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, ang)), new THREE.Vector3(len + 0.05, 0.14, 1.1)), WOOD);
    for (const s of [-1, 1]) b.add(CBOX(), new THREE.Matrix4().compose(mid.clone().add(new THREE.Vector3(0, 0.55, s * 0.55)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, ang)), new THREE.Vector3(len + 0.05, 0.07, 0.07)), RED);
    if (k % 2 === 0) for (const s of [-1, 1]) box(b, a.x, a.y, BRIDGE.z + s * 0.55, 0.07, 0.6, 0.07, RED_DARK);
  }
}

/** five-tiered pagoda: red walls, dark flaring roofs, gold finial */
function pagoda(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(PAGODA.x, PAGODA.z);
  box(b, PAGODA.x, y0 - 0.4, PAGODA.z, 2.3, 0.6, 2.3, '#c9bfae');
  let y = y0 + 0.2;
  for (let k = 0; k < 5; k++) {
    const w = 1.5 - k * 0.18, h = k === 0 ? 1.0 : 0.62;
    box(b, PAGODA.x, y, PAGODA.z, w, h, w, RED, k === 0 ? LIT(y) : GLOW(0.1));
    y += h;
    const rw = w + 0.9;
    pyramid(b, PAGODA.x, y, PAGODA.z, rw, rw, 0.42, ROOF);
    if (lod === 0) for (const sx of [-1, 1]) for (const sz of [-1, 1]) cbox(b, PAGODA.x + sx * rw * 0.47, y + 0.08, PAGODA.z + sz * rw * 0.47, 0.3, 0.07, 0.3, ROOF, NONE, Math.PI / 4, 0, 0);
    y += 0.3;
  }
  box(b, PAGODA.x, y, PAGODA.z, 0.08, 1.0, 0.08, SF.chinaGold);
  if (lod === 0) for (let k = 0; k < 4; k++) box(b, PAGODA.x, y + 0.15 + k * 0.2, PAGODA.z, 0.28, 0.05, 0.28, SF.chinaGold);
}

/** the wooden entrance gate: four posts, a tie beam, a double tiled roof, facing east */
function gate(b: BatchLike) {
  const y0 = g.at(GATE.x, GATE.z);
  for (const s of [-1, 1]) for (const d of [-0.35, 0.35]) box(b, GATE.x + d, y0 - 0.2, GATE.z + s * 1.4, 0.24, 2.6, 0.24, WOOD_DARK);
  box(b, GATE.x, y0 + 2.1, GATE.z, 1.0, 0.22, 3.4, WOOD);
  gable(b, GATE.x, y0 + 2.35, GATE.z, 4.0, 1.4, 0.55, ROOF, WOOD, Math.PI / 2, 0.1);
  gable(b, GATE.x, y0 + 2.95, GATE.z, 2.0, 0.8, 0.4, ROOF, WOOD, Math.PI / 2, 0.08);
}

function teaHouse(b: BatchLike) {
  const y0 = g.at(TEA.x, TEA.z);
  box(b, TEA.x, y0 - 0.2, TEA.z, 2.8, 0.45, 2.0, WOOD);
  box(b, TEA.x, y0 + 0.25, TEA.z, 2.4, 1.3, 1.6, '#efe4cf', LIT(y0 + 0.25));
  pyramid(b, TEA.x, y0 + 1.55, TEA.z, 3.4, 2.6, 0.9, ROOF);
}

function lantern(b: BatchLike, x: number, z: number) {
  const y = g.at(x, z);
  box(b, x, y - 0.1, z, 0.35, 0.25, 0.35, '#a9a499');
  box(b, x, y + 0.15, z, 0.14, 0.45, 0.14, '#a9a499');
  box(b, x, y + 0.6, z, 0.3, 0.26, 0.3, '#e8d9a8', GLOW(1.2));
  pyramid(b, x, y + 0.86, z, 0.5, 0.5, 0.22, '#8f8a80');
}

function maple(b: BatchLike, x: number, z: number, k: number) {
  const y = g.at(x, z);
  b.add(BOX(), M(x, y - 0.2, z, k, 0.16, 1.4, 0.16), FC.trunk);
  b.add(ICO(0), M(x, y + 1.6, z, k, 1.0, 0.7, 1.0), k % 2 ? MAPLE : '#d9804a', [0, 0, 0.3, 0]);
}

/** the bamboo fence around the garden in ≈ 3 u panels, open at the gate: [centre x, z, length, yaw] */
const FENCE: [number, number, number, number][] = (() => {
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < GROUNDS.length; i++) {
    const a = GROUNDS[i], c = GROUNDS[(i + 1) % GROUNDS.length];
    const dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz), n = Math.max(1, Math.round(L / 3));
    for (let k = 0; k < n; k++) {
      const mx = a.x + (dx * (k + 0.5)) / n, mz = a.z + (dz * (k + 0.5)) / n;
      if (Math.hypot(mx - GATE.x, mz - GATE.z) < 1.8) continue;
      out.push([mx, mz, L / n, Math.atan2(dx, dz)]);
    }
  }
  return out;
})();

function fence(b: BatchLike) {
  for (const [x, z, L, ry] of FENCE) box(b, x, g.at(x, z) - 0.3, z, 0.12, 1.3, L, BAMBOO, NONE, ry);
}

function build(b: BatchLike, lod: 0 | 2) {
  pagoda(b, lod);
  if (lod === 2) return;
  gate(b);
  drumBridge(b);
  teaHouse(b);
  fence(b);
  for (const [x, z] of [[-4.9, -4.4], [3.0, -4.0], [-0.2, 4.6]]) lantern(b, x, z);
  for (const [k, [x, z, s]] of ([[-5.6, -6.8, 0.8], [3.9, -7.6, 0.75], [-6.0, 2.4, 0.85], [4.9, 1.8, 0.7], [0.4, 8.4, 0.8]] as const).entries()) conifer(b, x, g.at(x, z), z, s + (k % 2) * 0.1);
  for (const [k, [x, z]] of ([[-1.8, -6.8], [1.2, -7.4], [5.2, 6.0], [-5.6, 6.2]] as const).entries()) maple(b, x, z, k);
  // clipped azalea / box shrubs along the pond and the walks
  for (const [k, [x, z]] of ([[-5.2, -2.0], [-3.2, 3.9], [2.2, 3.5], [3.8, -1.6], [0.6, -5.0], [-2.6, -5.2], [5.6, 3.4], [-6.2, 0.2], [4.6, -6.4]] as const).entries()) {
    b.add(ICO(0), M(x, g.at(x, z) + 0.3, z, k, 0.65, 0.42, 0.65), k % 3 ? FC.hedge : '#b86a8c', [0, 0, 0.15, 0]);
  }
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(GROUNDS, GC.lawnDeep, PAT.grass, g, 2, 0.18),
    ...gfill(POND, WATER, PAT.none, g, 2, 0.23),
    // raked-gravel walk from the gate past the pond to the pagoda and the tea house
    ...gfill([{ x: 6.2, z: -4.2 }, { x: 6.2, z: -1.8 }, { x: 3.6, z: -1.4 }, { x: 3.6, z: -3.6 }], GC.path, PAT.earth, g, 2, 0.25),
    ...gfill([{ x: -6.0, z: 4.6 }, { x: 4.2, z: 4.6 }, { x: 4.2, z: 5.6 }, { x: -6.0, z: 5.6 }], GC.path, PAT.earth, g, 2, 0.25),
  ];
}

const BLOCKERS = [
  { x: PAGODA.x, z: PAGODA.z, r: 1.3 }, { poly: [{ x: TEA.x - 1.4, z: TEA.z - 1.0 }, { x: TEA.x + 1.4, z: TEA.z - 1.0 }, { x: TEA.x + 1.4, z: TEA.z + 1.0 }, { x: TEA.x - 1.4, z: TEA.z + 1.0 }] },
  // the pond (walk around it; the drum bridge is to look at) and the fence panels (in through the gate)
  { poly: POND.map(p => ({ x: p.x * 0.92, z: p.z * 0.92 })) },
  ...FENCE.map(([x, z, L, ry]) => ({ poly: rect(x, z, 0.3, L, ry) })),
];

const EXCLUDE: Vec2[] = [{ x: 5.7, z: -9.8 }, { x: 8.4, z: 4.6 }, { x: 3.9, z: 10.2 }, { x: -3.3, z: 10.5 }, { x: -5.4, z: 9.2 }, { x: -7.6, z: 5.4 }, { x: -6.5, z: -9.7 }];

export const japaneseTeaGarden: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: {
    blockers: BLOCKERS,
    surfaces: [{ poly: [{ x: BRIDGE.x - BRIDGE.len / 2 - 0.3, z: BRIDGE.z - 0.5 }, { x: BRIDGE.x + BRIDGE.len / 2 + 0.3, z: BRIDGE.z - 0.5 }, { x: BRIDGE.x + BRIDGE.len / 2 + 0.3, z: BRIDGE.z + 0.5 }, { x: BRIDGE.x - BRIDGE.len / 2 - 0.3, z: BRIDGE.z + 0.5 }], y: 'terrain', surface: 'wood' }, { poly: GROUNDS, y: 'terrain', surface: 'grass' }],
  },
  ground: ground(),
  lights: [[-4.9, -4.4], [3.0, -4.0], [-0.2, 4.6]].map(([x, z]) => ({ x, y: g.at(x, z) + 0.8, z, size: 0.6, color: '#ffd9a0' })),
  plaza: [plazaOf(GROUNDS, 'grass')],
  w4: {
    placeId: 'japanese-tea-garden',
    attractions: ['japanese-tea-garden'],
    arrival: { x: 8.0, z: -3.0, heading: -Math.PI / 2 },
    photo: { target: [-1, 2, 1], distance: 26, elevation: 0.5, bearing: 1.2 },
    flag: { x: PAGODA.x, z: PAGODA.z, h: 30 },
    height: { realM: 15, u: 7.4, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way (grass) around place japanese-tea-garden'],
    terrain: [-9, -11, 10, 12],
  },
};
