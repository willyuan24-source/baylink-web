import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CYL, M } from '../../builder';
import { ngon, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, gfill } from './siteKit';
import { box3, site3Ground } from './siteKit3';

/**
 * Ingleside Terraces Sundial (wave 4, P4 · map T3, west of Twin Peaks): dedicated on 10 October 1913 by the Urban
 * Realty Improvement Company (Joseph A. Leonard) as the centrepiece of its new Ingleside Terraces tract and touted as
 * the world's biggest sundial: a 28-ft gnomon of marble and concrete on a concrete dial of about 34 ft with Roman
 * numerals, with paths out to four big concrete columns and urns (the seasons, the ages of man). It stands in Entrada
 * Court inside the oval of the old Ingleside Race Track (1895–1905), which Urbano Drive still follows
 * (outsidelands.org "Ingleside Terraces Sundial"; Ingleside Light on its proposed landmark designation).
 *
 * The court is residential (plan §2.4 #80): no crowd spots, no props beyond the monument. Toy: the round dial on its
 * plinth with plain hour marks (no numerals), the triangular gnomon whose sloping edge points north (toy proportions:
 * the fin is steeper than the true 37.7° style angle so it reads from the street), and the four columns with urns at the
 * island's rim.
 *
 * Frame: origin (276.27, 1443.65) at the dial's centre, the centre of Entrada Court's circle (centreline r ≈ 3.75, 3.6 u
 * wide, so the island is r ≈ 1.95), yaw −134° so local +z points to true north (the city frame turns 46°) and +x west;
 * the court's two arms leave the circle to the west.
 */

const ID = 'ingleside-terraces-sundial';
const X0 = 276.27, Z0 = 1443.65, YAW = (-134 * Math.PI) / 180;
const g = site3Ground(ID, 13.7);

const CONCRETE = '#d9d3c6', MARBLE = '#ece8df', MARK = '#8d8577', URN = '#c9c0ae';
const DIAL_R = 1.5, PLINTH = 0.16;
/** the gnomon: a fin in the north–south plane, its root on the dial's south half, the tall end to the north */
const FIN = { z0: -0.95, z1: 1.2, h: 3.4, t: 0.16 };
const COLUMNS: Vec2[] = [45, 135, 225, 315].map(a => ({ x: Math.sin((a * Math.PI) / 180) * 1.72, z: Math.cos((a * Math.PI) / 180) * 1.72 }));

function gnomon(b: BatchLike, y: number) {
  const { z0, z1, h, t } = FIN;
  const V = (x: number, yy: number, z: number) => new THREE.Vector3(x, yy, z);
  const style = new THREE.Vector3(0, z1 - z0, -h).normalize();
  for (const s of [-1, 1]) {
    b.tri(V((s * t) / 2, y, z0), V((s * t) / 2, y, z1), V((s * t) / 2, y + h, z1), MARBLE, [0, 0, 0, 0], new THREE.Vector3(s, 0, 0));
  }
  // the sloping style and the north face
  b.quad(V(-t / 2, y, z0), V(t / 2, y, z0), V(t / 2, y + h, z1), V(-t / 2, y + h, z1), style, MARBLE);
  b.quad(V(t / 2, y, z1), V(-t / 2, y, z1), V(-t / 2, y + h, z1), V(t / 2, y + h, z1), new THREE.Vector3(0, 0, 1), CONCRETE);
}

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(0, 0);
  b.add(CYL(lod === 0 ? 16 : 5), M(0, y0 - 0.25, 0, 0, DIAL_R, PLINTH + 0.25, DIAL_R), CONCRETE);
  gnomon(b, y0 + PLINTH);
  if (lod === 2) return;
  // hour marks fanning out on the dial's north half (6 a.m. … 6 p.m., plain bars, no numerals)
  for (let k = 0; k <= 12; k += 2) {
    const a = ((k - 6) / 6) * (Math.PI / 2);
    const x = Math.sin(a) * 1.2, z = Math.cos(a) * 1.2 - 0.2;
    b.add(BOX(), M(x, y0 + PLINTH, z, a, 0.08, 0.02, 0.42), MARK);
  }
  // the four columns with their urns at the island's rim
  for (const c of COLUMNS) {
    const y = g.at(c.x, c.z);
    box3(b, c.x, y - 0.2, c.z, 0.34, 1.45, 0.34, CONCRETE);
    b.add(CYL(6, 0.7), M(c.x, y + 1.25, c.z, 0, 0.2, 0.35, 0.2), URN);
  }
}

function ground(): SiteGroundPoly[] {
  return gfill(ngon(0, 0, 1.92, 16), GC.pavers, PAT.stone, g, 5, 0.06);
}

export const inglesideTerracesSundial: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, ngon(0, 0, 1.97, 16)) },
  build,
  walk: {
    blockers: [{ poly: [{ x: -0.12, z: FIN.z0 }, { x: 0.12, z: FIN.z0 }, { x: 0.12, z: FIN.z1 }, { x: -0.12, z: FIN.z1 }] }, ...COLUMNS.map(c => ({ x: c.x, z: c.z, r: 0.2 }))],
    surfaces: [{ poly: ngon(0, 0, DIAL_R, 16), y: +(g.at(0, 0) + PLINTH).toFixed(3), surface: 'plaza' }],
  },
  tall: [{ x: 0, z: 0.9, r: 0.4 }],
  ground: ground(),
  w4: {
    placeId: 'ingleside-terraces-sundial',
    attractions: ['ingleside-terraces-sundial'],
    arrival: { x: 0.4, z: -2.6, heading: 0 },
    photo: { target: [0, 1.4, 0.2], distance: 11, elevation: 0.3, bearing: 2.6 },
    flag: { x: 0, z: 0.4, h: 30 },
    height: { realM: 8.5, u: 3.4, top: 3.63, rule: 'H = 3.2 + 0.155·h' },
    // W4-L3-review: the dial is OSM node 6691138540 (amenity=clock, "Ingleside Sundial"); node 11903199250 — the scouting
    // JSON's lat / lng, and lane P's map point 10 u north-east of the dial — is the Ingleside Terraces neighbourhood label
    osm: ['node/6691138540'],
    terrain: [-3, -3, 3, 3],
    terrainStep: 1,
    notes: 'A residential court: no crowd spots (plan caution), only the monument. The gnomon is steeper than the true style angle (toy proportions); its shadow is the renderer\'s (tier-3 sites cast none today). A toy height: the gnomon is drawn 3.4 u, under the policy\'s 4.5 u for its 28 ft, so the court\'s houses still frame it.',
  },
};
