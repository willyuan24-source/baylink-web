import * as THREE from 'three';
import type { BatchLike } from '../../builder';
import { GLOW, NONE, box, loftRings, prismXZ } from './kit';
import type { SfLandmark } from './index';

/**
 * de Young museum + Hamon Observation Tower (T1). World-aligned local frame (yaw 0, origin at the tower) so the
 * OSM outlines drop in unchanged: museum relation 1652482, tower parts ways 1418750069…1418972816. The tower twists
 * from a 3.9 × 1.3 u rectangle at the base (aligned with the museum) to a sheared parallelogram at the top (aligned
 * with the street grid) — lofted straight between the two OSM rings. Heights: the OSM parts reach 51 m → H 11.1 u
 * (the published 44 m is the observation floor); museum 13 m at 0.22 u/m → 3.0 u under its deep copper roof.
 */

const COPPER = '#a67a54', COPPER_DARK = '#83603f', COPPER_ROOF = '#6d5642', GLASS = '#a9c7c9';
const MUSEUM_WALL = '#8a6a4d';
const TOWER_TOP = 11.2, DECK_Y = 9.9;
/** tower rings (local x, z): base rectangle and top parallelogram, same corner order */
const BASE: [number, number][] = [[-1.95, 0.87], [1.95, 0.98], [1.99, -0.3], [-1.91, -0.4]];
const TOP: [number, number][] = [[-1.95, -0.76], [1.99, 1.75], [2.03, 0.34], [-1.89, -2.16]];
/** museum outline (OSM, simplified), bottom-left block + long main block */
const MUSEUM: [number, number][] = [[-1.85, -1.72], [0.37, -0.33], [2.91, -0.27], [8.62, -0.08], [8.46, 5.77], [7.95, 20.09], [-2.7, 19.78], [-1.95, 0.87]];
const MUSEUM_H = 2.6;

const ringAt = (t: number, y: number, grow = 0) => BASE.map(([x, z], i) => {
  const [tx, tz] = TOP[i];
  const px = x + (tx - x) * t, pz = z + (tz - z) * t;
  const cx = 0.02, cz = 0.29 + (-0.21 - 0.29) * t;
  return new THREE.Vector3(px + Math.sign(px - cx) * grow, y, pz + Math.sign(pz - cz) * grow);
});

function build(b: BatchLike, lod: 0 | 2) {
  // museum: long low copper body under a deep overhanging roof
  if (lod === 2) {
    box(b, 2.9, -1.2, 9.2, 10.8, MUSEUM_H + 1.45, 21.6, COPPER_ROOF);
    loftRings(b, [ringAt(0, -1.2, 0.2), ringAt(1, TOWER_TOP, 0.3)], (_l, side) => (side % 2 ? COPPER_DARK : COPPER), NONE, COPPER_ROOF);
    return;
  }
  prismXZ(b, MUSEUM, -1.2, MUSEUM_H, MUSEUM_WALL, null);
  const roof = MUSEUM.map(([x, z]) => ({ x: x + (x > 3 ? 0.35 : -0.35), z: z + (z > 9 ? 0.35 : -0.35) }));
  b.polygon(roof, MUSEUM_H + 0.25, COPPER_ROOF, NONE);
  b.walls(roof, MUSEUM_H, MUSEUM_H + 0.25, COPPER_DARK, NONE);
  {
    // light courts / sculpture garden cut into the roof, the glazed entry court, pool
    box(b, 3.2, MUSEUM_H + 0.26, 8.5, 3.4, 0.04, 4.2, '#8fa77a');
    box(b, 3.0, MUSEUM_H + 0.26, 14.8, 2.8, 0.04, 3.2, '#9fbf7a');
    box(b, 5.6, -1.2, 3.0, 3.0, MUSEUM_H + 1.0, 0.14, GLASS, [6, 0, 0, 0]);
    box(b, -3.1, -0.2, 9.5, 0.8, 0.25, 8.0, '#79b6b3', [0, 0, 0, 1.08]);
  }
  // twisting tower: copper faces, a glass observation floor on top
  const levels = 6;
  const rings: THREE.Vector3[][] = [];
  // the lofted body is padded 0.2 u so the slim OSM slab still reads as a tower from its narrow side
  for (let i = 0; i <= levels; i++) { const t = i / levels; rings.push(ringAt(t, -1.2 + (DECK_Y + 1.2) * t, 0.2)); }
  loftRings(b, rings, (_l, side) => (side % 2 ? COPPER_DARK : COPPER), NONE);
  const deck = [ringAt(1, DECK_Y, 0.28), ringAt(1, TOWER_TOP - 0.3, 0.28)];
  loftRings(b, deck, () => GLASS, GLOW(0.9));
  const cap = [ringAt(1, TOWER_TOP - 0.3, 0.42), ringAt(1, TOWER_TOP, 0.42)];
  loftRings(b, cap, () => COPPER_DARK, NONE, COPPER_ROOF);
  // perforated copper reads as ribs: vertical slits on the long faces, a ledge at every floor band
  for (let i = 0; i < levels; i++) {
    const t = (i + 0.5) / levels, y = -1.2 + (DECK_Y + 1.2) * t;
    const r = ringAt(t, y, 0.23);
    for (const [a, c] of [[0, 1], [2, 3]]) {
      const ry = Math.atan2(r[c].x - r[a].x, r[c].z - r[a].z) + Math.PI / 2;
      for (const f of [0.2, 0.4, 0.6, 0.8]) {
        const p = r[a].clone().lerp(r[c], f);
        box(b, p.x, y - 0.75, p.z, 0.16, 1.5, 0.06, COPPER_DARK, NONE, ry);
      }
    }
    if (i > 0) {
      const ty = -1.2 + ((DECK_Y + 1.2) * i) / levels;
      loftRings(b, [ringAt(i / levels, ty, 0.27), ringAt(i / levels, ty + 0.12, 0.27)], () => COPPER_DARK, NONE);
    }
  }
  // museum facade: vertical copper fins along the long sides, the entry canopy
  for (let z = 1.2; z < 19.5; z += 1.3) {
    box(b, -2.72 + (z / 20) * -0.05, -0.2, z, 0.12, MUSEUM_H + 0.2, 0.18, COPPER_DARK);
    box(b, 8.5 - (z > 6 ? (z - 6) * 0.036 : 0), -0.2, z, 0.12, MUSEUM_H + 0.2, 0.18, COPPER_DARK);
  }
  box(b, 4.8, 2.2, -0.9, 3.4, 0.14, 1.6, COPPER_ROOF);
}

export const deYoungTower: SfLandmark = {
  id: 'de-young-tower',
  tier: 1,
  x: -247.1,
  z: 930.6,
  yaw: 0,
  base: 16.9,
  exclude: { poly: [{ x: -250.3, z: 928.4 }, { x: -238.1, z: 928.4 }, { x: -238.8, z: 951.2 }, { x: -250.3, z: 951.2 }] },
  castShadow: true,
  build,
  walk: { blockers: [{ poly: MUSEUM.map(([x, z]) => ({ x, z })) }, { poly: ringAt(0, 0, 0.2).map(p => ({ x: p.x, z: p.z })) }] },
  // D2-10: the twisted Hamon tower (the museum wings are its blockers' top)
  tall: [{ x: 0, z: -0.1, r: 3.6 }],
};

