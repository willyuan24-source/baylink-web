import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CBOX, M } from '../../builder';
import { worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, gstrip, lamp, plazaOf } from './siteKit';
import { box3, site3Ground } from './siteKit3';

/**
 * Crane Cove Park (wave 4, P4 · map T3, Dogpatch): a 7-acre Port of San Francisco park opened in 2020 on the Pier 70
 * shipyard where Union Iron Works and then Bethlehem Steel built ships for a century (Wikipedia "Crane Cove Park";
 * sfport.com). It has a small sand beach for kayaks and paddle boards (no swimming), a lawn to the water and the
 * great concrete slipway, on which outlines show ships launched here and a segment of the BART Transbay Tube, built
 * and launched here in 1965–69. Two restored cranes frame the slipway "like goalposts": Cranes 14 and 30, nicknamed
 * Nick and Nora after the Thin Man films; Crane 14 is a 50-ton American Hoist & Derrick "whirley" crane put up in
 * 1941 on Slip 4 (its historical marker, hmdb.org 159381), and both lost their booms on purpose in the rehabilitation
 * (Dogpatch Paddle, "The Cranes of Crane Cove").
 *
 * Toy: the two boom-less whirley cranes on their OSM spots (way 288656668, way 853565321): a four-legged portal, the
 * turntable, the machinery house and the A-frame; the slipway's concrete with a painted hull outline and the tube
 * segment's outline, benches facing the bay, a lamp and a kayak rack at the beach (the beach itself is the city's sand).
 *
 * Frame: origin (556.2, 310.5) on the slipway (OSM leisure=slipway way 678950944, "Keel Park"), yaw 133.3°: local +z
 * runs down the slipway into the bay (north-east), +x toward Nick-or-Nora B (local (8.59, −0.34); the other at
 * (−8.35, −0.3), 17 u apart). The shoreline bends from z ≈ 2 (x −8) to z ≈ 10 (x 10); 19th Street passes x ≈ −12…−16;
 * a small shed on the ramp (way 288656685, z 4.0…6.3) and the park building (way 853564377) stay the city's.
 */

const ID = 'crane-cove-park';
const X0 = 556.2, Z0 = 310.5, YAW = (133.3 * Math.PI) / 180;
const g = site3Ground(ID, 0);

const STEEL = '#5a6664', HOUSE = '#9a4b3a', ROOFC = '#3f4644';
/** the two cranes (local centre, portal yaw) */
const CRANES: [number, number, number][] = [[-8.35, -0.3, 0.33], [8.59, -0.34, 0.33]];
/** toy scale of the cranes (about 1.35 × the kit's street size, so the pair reads as the park's landmark from the
 *  streets around; about 8 u to the A-frame, the height policy's ≈ 25 m without the booms) */
const S = 1.35;
const LEG = 0.62 * S, PORTAL_H = 2.9 * S;

/** a boom-less whirley crane: portal legs and girders, the turntable, the machinery house and the A-frame */
function crane(b: BatchLike, cx: number, cz: number, ry: number, lod: 0 | 2) {
  const y0 = g.at(cx, cz), c = Math.cos(ry), s = Math.sin(ry);
  const P = (u: number, v: number) => ({ x: cx + u * S * c + v * S * s, z: cz - u * S * s + v * S * c });
  if (lod === 2) {
    box3(b, cx, y0 - 0.1, cz, 1.4 * S, PORTAL_H + 2.4 * S, 1.4 * S, STEEL, ry);
    return;
  }
  for (const [u, v] of [[-0.62, -0.62], [0.62, -0.62], [0.62, 0.62], [-0.62, 0.62]]) {
    const p = P(u, v);
    box3(b, p.x, y0 - 0.2, p.z, 0.26 * S, PORTAL_H + 0.2, 0.26 * S, STEEL, ry);
  }
  // portal girders and the cross bracing of the two open sides
  for (const v of [-0.62, 0.62]) { const p = P(0, v); box3(b, p.x, y0 + PORTAL_H - 0.35 * S, p.z, LEG * 2 + 0.26 * S, 0.35 * S, 0.22 * S, STEEL, ry); }
  for (const u of [-0.62, 0.62]) { const p = P(u, 0); b.add(CBOX(), M(p.x, y0 + PORTAL_H * 0.55, p.z, ry, 0.12 * S, 0.12 * S, Math.hypot(LEG * 2, PORTAL_H * 0.8), Math.atan2(LEG * 2, PORTAL_H * 0.8) - Math.PI / 2), STEEL); }
  // turntable, machinery house facing the bay (+z), its roof and the counterweight at the back
  const top = y0 + PORTAL_H;
  box3(b, cx, top, cz, 1.7 * S, 0.22 * S, 1.7 * S, STEEL, ry);
  const h = P(0, -0.1);
  box3(b, h.x, top + 0.22 * S, h.z, 1.25 * S, 1.15 * S, 1.8 * S, HOUSE, ry);
  box3(b, h.x, top + 1.37 * S, h.z, 1.4 * S, 0.14 * S, 1.95 * S, ROOFC, ry);
  const cw = P(0, -1.05);
  box3(b, cw.x, top + 0.3 * S, cw.z, 1.1 * S, 0.75 * S, 0.35 * S, ROOFC, ry);
  // the A-frame over the house (the boom that hung from it was removed in the rehabilitation)
  for (const u of [-0.45, 0.45]) {
    const a = P(u, 0.35);
    b.add(CBOX(), M(a.x, top + 2.25 * S, a.z, ry, 0.14 * S, 1.9 * S, 0.14 * S, -0.3), STEEL);
  }
  const apex = P(0, 0.65);
  box3(b, apex.x, top + 3.05 * S, apex.z, 1.1 * S, 0.16 * S, 0.18 * S, STEEL, ry);
}

/** the painted outlines on the slipway: a launched hull (pointed ends) and a Transbay Tube segment */
const HULL: Vec2[] = [{ x: -2.0, z: -3.2 }, { x: -3.05, z: -1.8 }, { x: -3.25, z: 0.2 }, { x: -2.9, z: 2.0 }, { x: -2.0, z: 3.2 }, { x: -1.1, z: 2.0 }, { x: -0.75, z: 0.2 }, { x: -0.95, z: -1.8 }, { x: -2.0, z: -3.2 }];
const TUBE: Vec2[] = [{ x: 1.2, z: -2.6 }, { x: 4.2, z: -2.6 }, { x: 4.2, z: 2.4 }, { x: 1.2, z: 2.4 }, { x: 1.2, z: -2.6 }];
const RAMP: Vec2[] = [{ x: -6.0, z: -3.8 }, { x: 6.8, z: -3.8 }, { x: 6.8, z: 3.1 }, { x: -6.0, z: 3.1 }];
const BENCHES: [number, number][] = [[-4.6, -4.4], [4.4, -4.4]];

function build(b: BatchLike, lod: 0 | 2) {
  for (const [x, z, ry] of CRANES) crane(b, x, z, ry, lod);
  if (lod === 2) return;
  for (const [x, z] of BENCHES) bench(b, x, g.at(x, z), z, 0);
  lamp(b, 0.2, g.at(0.2, -4.6), -4.6);
  // kayak rack on the beach's edge: two posts, a bar and two kayaks
  const kx = 10.6, kz = -3.8, ky = g.at(kx, kz);
  for (const d of [-0.8, 0.8]) box3(b, kx, ky - 0.1, kz + d, 0.12, 1.1, 0.12, FC.wood);
  box3(b, kx, ky + 0.85, kz, 0.14, 0.1, 1.8, FC.wood);
  b.add(BOX(), M(kx - 0.18, ky + 0.95, kz, 0, 0.4, 0.22, 2.6), '#e8753a');
  b.add(BOX(), M(kx + 0.22, ky + 0.95, kz, 0, 0.4, 0.22, 2.6), '#3a8fc2');
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(RAMP, '#d6d0c4', PAT.stone, g, 3.5, 0.06),
    ...gstrip(HULL, 0.14, GC.stripe, PAT.none, g, 5, 0.09),
    ...gstrip(TUBE, 0.14, '#e9c46a', PAT.none, g, 6, 0.09),
  ];
}

const BLOCKERS = CRANES.flatMap(([cx, cz, ry]) => {
  const c = Math.cos(ry), s = Math.sin(ry);
  return [[-LEG, -LEG], [LEG, -LEG], [LEG, LEG], [-LEG, LEG]].map(([u, v]) => ({ x: cx + u * c + v * s, z: cz - u * s + v * c, r: 0.26 }));
});

/** exclusion: the slipway between the cranes and the cranes' pads (19th Street, the shed on the ramp and the park
 *  building stay the city's) */
const EXCLUDE: Vec2[] = [{ x: -9.9, z: -4.9 }, { x: 11.6, z: -4.9 }, { x: 11.6, z: -2.6 }, { x: 10.0, z: 1.6 }, { x: 7.0, z: 3.4 }, { x: -9.9, z: 3.4 }];

export const craneCovePark: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: BLOCKERS },
  tall: CRANES.map(([x, z]) => ({ x, z, r: 1.6 })),
  ground: ground(),
  lights: [{ x: 0.2, y: g.at(0.2, -4.6) + 3.8, z: -4.6, size: 1, color: '#ffd9a0' }],
  plaza: [plazaOf(RAMP)],
  w4: {
    placeId: 'osm-w853562207',
    attractions: ['crane-cove-park'],
    arrival: { x: 0.2, z: -3.6, heading: 0 },
    photo: { target: [0, 3, 0.5], distance: 22, elevation: 0.22, bearing: Math.PI },
    flag: { x: 0.2, z: -1.0, h: 30 },
    height: { realM: 25, u: 7.1, top: 8.42, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/288656668', 'way/853565321', 'way/678950944'],
    terrain: [-11, -6, 13, 5],
    notes: 'The cranes stand without their booms, as restored. The beach is the city\'s sand (kayaks and paddle boards; no swimming, so no swim prompts).',
  },
};
