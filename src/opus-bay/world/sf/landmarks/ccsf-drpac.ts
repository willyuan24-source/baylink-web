import type * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { GLOW, box, cbox, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, craneJib, craneMast, craneSwing, gfill, hoarding, lamp, siteGround } from './siteKit';

/**
 * The Diego Rivera Performing Arts Center site on CCSF's Ocean Campus (wave 4, part of the ccsf-ocean site): ground
 * was broken on 22 January 2026 for the three-storey, 77,000 sq ft hall on Frida Kahlo Way whose glass lobby will
 * show Rivera's Pan American Unity mural; construction runs into fall 2028 (CCSF news; SF Chronicle). In 2026 it is
 * a fenced lot with the first steel and a tower crane — the mural is nowhere in the game until it really is on show.
 *
 * Frame: origin (396.4, 1294.4), yaw 46.4°: local +x runs along the lot toward Frida Kahlo Way (its centreline at
 * x ≈ 10.9), the lot is the Frida Kahlo Way end of OSM way 159026646 (landuse=construction), x −8.7…8.7, z −5.2…5.2;
 * the campus service road crossing its west end (x ≈ −7.9) stays the city's.
 */

const ID = 'ccsf-drpac';
const X0 = 396.4, Z0 = 1294.4, YAW = (46.4 * Math.PI) / 180;
const g = siteGround(ID, 21.4);

const MAST = { x: -4.4, z: 3.1 }, MAST_H = 13.2, JIB = 9.5, COUNTER = 3.6;
const LOT: Vec2[] = [{ x: -6.3, z: -4.7 }, { x: 7.9, z: -4.7 }, { x: 7.9, z: 4.7 }, { x: -6.3, z: 4.7 }];
const FRAME = { x0: -2.4, x1: 6.2, z0: -3.2, z1: 2.6 }, LEVEL = 1.25;
const STEEL = '#8c6f5a', DECK = '#b9b2a6';

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at((FRAME.x0 + FRAME.x1) / 2, (FRAME.z0 + FRAME.z1) / 2);
  const cx = (FRAME.x0 + FRAME.x1) / 2, cz = (FRAME.z0 + FRAME.z1) / 2, w = FRAME.x1 - FRAME.x0, d = FRAME.z1 - FRAME.z0;
  // the foundation slab and the first two levels of steel (the third still open)
  if (lod === 2) { box(b, cx, y0, cz, w, LEVEL * 2, d, STEEL); craneMast(b, MAST.x, g.at(MAST.x, MAST.z), MAST.z, MAST_H, 2, JIB, COUNTER); return; }
  box(b, cx, y0 - 0.4, cz, w + 0.6, 0.55, d + 0.6, '#c9c2b4');
  for (let i = 0; i <= 2; i++) for (const k of [0, 1]) {
    const x = FRAME.x0 + (w * i) / 2, z = k ? FRAME.z1 : FRAME.z0;
    box(b, x, y0, z, 0.2, LEVEL * (i === 2 ? 2 : 3), 0.2, STEEL);
  }
  box(b, cx, y0 + LEVEL - 0.1, cz, w, 0.12, d, DECK);
  for (const s of [-1, 1]) box(b, cx, y0 + LEVEL * 2 - 0.2, cz + (s * d) / 2, w, 0.2, 0.14, STEEL);
  cbox(b, FRAME.x1, y0 + LEVEL * 2 + 0.1, FRAME.z1, 0.14, 0.14, 0.14, '#ff5a44', GLOW(1));
  craneMast(b, MAST.x, g.at(MAST.x, MAST.z), MAST.z, MAST_H, lod, JIB, COUNTER);
  hoarding(b, [...LOT, LOT[0]], g.at);
  // site office trailer and stacked materials
  box(b, -5.0, g.at(-5, -3.3) - 0.1, -3.3, 2.2, 1.1, 0.9, '#e8e2d4');
  for (const [x, z] of [[1.0, 3.9], [3.2, 3.9]]) box(b, x, g.at(x, z) - 0.05, z, 1.6, 0.35, 0.5, '#9a7a55');
  lamp(b, -5.8, g.at(-5.8, 0.4), 0.4);
}

function ground(): SiteGroundPoly[] {
  return gfill(LOT, GC.earth, PAT.earth, g, 4);
}

const EXCLUDE: Vec2[] = [{ x: -6.8, z: -5.1 }, { x: 8.3, z: -5.1 }, { x: 8.3, z: 5.1 }, { x: -6.8, z: 5.1 }];

export const ccsfDrpac: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  animate: {
    build: (b: BatchLike) => craneJib(b, JIB, COUNTER),
    update(obj: THREE.Object3D, t: number) {
      obj.position.set(MAST.x, MAST_H, MAST.z);
      obj.rotation.set(0, craneSwing(t + 20, -0.9, 0.7, 0.07), 0);
    },
  },
  walk: { blockers: [{ poly: LOT }] },
  ground: ground(),
  lights: [{ x: -5.8, y: g.at(-5.8, 0.4) + 3.8, z: 0.4, size: 1, color: '#ffd9a0' }],
  // (W4-IL17: the open ground west of the hoarding; the old strip ran into the campus building south of the lot)
  plaza: [{ poly: [{ x: -11.5, z: -4.0 }, { x: -7.5, z: -4.0 }, { x: -7.5, z: 4.0 }, { x: -11.5, z: 4.0 }], surface: 'pavement' }],
  w4: {
    placeId: 'ccsf-ocean-campus',
    attractions: ['ccsf-ocean-campus'],
    lod0R: 260,
    // (W4-IL17: the verge between the hoarding and the street, off the asphalt)
    arrival: { x: 8.9, z: -2.0, heading: -Math.PI / 2 },
    photo: { target: [0, 5, 0], distance: 34, elevation: 0.3, bearing: 1.2 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 64, u: 14.6, top: 13.2, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/159026646'],
    terrain: [-10, -9, 11, 7],
    notes: 'Construction lot of the Diego Rivera Performing Arts Center (opening ~late 2028): no mural, no signs.',
  },
};
