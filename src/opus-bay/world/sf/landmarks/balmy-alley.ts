import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, gstrip, lamp, plazaOf } from './siteKit';
import { box3, colourPanel, site3Ground } from './siteKit3';

/**
 * Balmy Alley (wave 4, P4 · map T3, the Mission's mural alley): one block of fences and garage doors painted since
 * 1972–73 (the first, in 1972, by neighbourhood children with Mia Galaviz de Gonzalez of the 24th Street Place arts
 * project — SFMOMA "Mapping Origins" —, then Patricia Rodriguez and Graciela Carrillo in 1973), with a second wave in 1984 when Ray Patlán's PLACA project filled it with
 * murals on Central American cultures and against US intervention there (Wikipedia "Balmy Alley"; Precita Eyes runs
 * mural walks from 24th St). "Since 1973, most fences and garage doors on the street have been decorated with a mural."
 *
 * The murals are copyrighted works by named artists and people live here (plan §2.4 #75): the toy never copies one.
 * Between lane H2b's four original mural boards (wave 3, in the spirit of the alley, copies of nothing), both sides
 * carry garage doors and fence boards in ABSTRACT two-tone colour fields only, with two alley lamps; the houses are the
 * city's.
 *
 * Frame: origin (456.8, 653.4) on the alley's centreline (Balmy Street, OSM residential, 3.6 u in the city data),
 * yaw 50.4°: local +z runs along the alley from 24th Street (centreline z −12.85, 4.4 u wide) to 25th Street
 * (z ≈ 11.9, 3.6 u); the house fronts stand at |x| 1.74–2.9. The exclusion is the alley between the two junctions, its
 * asphalt redrawn by the site (a strip that also covers the city's short stubs into the junctions).
 */

const ID = 'balmy-alley';
const X0 = 456.8, Z0 = 653.4, YAW = (50.4 * Math.PI) / 180;
const g = site3Ground(ID, 3.1);

/** abstract mural colours (no imagery): warm and cool fields */
const PAINT = ['#d9534f', '#f0ad4e', '#5bb8d6', '#7a4fa0', '#2f8f88', '#e0a94a', '#c94f7c', '#4f7fbf', '#8cc152', '#f28c3a', '#3d9970', '#e8d44d'];
const rnd = (k: number) => { const h = Math.sin(k * 12.9898 + 4.1) * 43758.5453; return h - Math.floor(h); };

/** the painted runs: the fence line just inside the house fronts on each side, from the 24th St end to the 25th */
const SIDE_X = 1.64, Z_A = -9.6, Z_B = 9.2;

interface Panel { x: number; z: number; ry: number; w: number; h: number; a: string; b?: string; split: number }
/**
 * Lane H2b's four ORIGINAL mural boards already stand in the alley (data/murals.ts, world/sf/murals.ts: 2.6 u square,
 * local (1.70, 5.16) and (2.28, −2.70) on the +x side, (−2.37, 1.91) and (−1.66, −8.70) on the −x side): the colour
 * fields leave their spans free (± 1.5 u), so the paintings stay the alley's centrepieces.
 */
const H2B_SPANS: Readonly<Record<string, [number, number][]>> = { '1': [[3.66, 6.66], [-4.2, -1.2]], '-1': [[0.4, 3.4], [-10.2, -7.2]] };
function panels(): Panel[] {
  const out: Panel[] = [];
  for (const side of [-1, 1]) {
    let z = Z_A, k = side > 0 ? 50 : 0;
    const spans = H2B_SPANS[String(side)];
    while (z < Z_B - 0.6) {
      const hit = spans.find(([a, c]) => z > a - 0.4 && z < c);
      if (hit) { z = hit[1]; continue; }
      const next = Math.min(Z_B, ...spans.filter(([a]) => a >= z).map(([a]) => a));
      const w = Math.min(next - z, 1.2 + rnd(k) * 1.1), h = 1.05 + rnd(k + 1) * 0.6;
      if (w < 0.6) { z = next; continue; }
      // a garage door (lower, wider) or a fence run; one in three is a two-tone field
      const two = rnd(k + 2) < 0.4;
      out.push({ x: side * SIDE_X, z: z + w / 2, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2, w: w - 0.08, h, a: PAINT[Math.floor(rnd(k + 3) * PAINT.length)], b: two ? PAINT[Math.floor(rnd(k + 4) * PAINT.length)] : undefined, split: 0.3 + rnd(k + 5) * 0.4 });
      z += w + (rnd(k + 6) < 0.25 ? 0.5 : 0);     // an occasional gap: a house entry
      k += 7;
    }
  }
  return out;
}
const PANELS = panels();
const LAMPS: Vec2[] = [{ x: -1.25, z: -4.5 }, { x: 1.25, z: 8.2 }];

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    // far: one colour band per side
    for (const side of [-1, 1]) box3(b, side * SIDE_X, g.at(side * SIDE_X, 0) - 0.1, (Z_A + Z_B) / 2, 0.1, 1.4, Z_B - Z_A, side > 0 ? PAINT[2] : PAINT[0]);
    return;
  }
  for (const p of PANELS) {
    const y = g.at(p.x, p.z) - 0.1;
    colourPanel(b, p.x, y, p.z, p.ry, p.w, p.h + 0.1, p.a, p.b, p.split);
  }
  for (const l of LAMPS) lamp(b, l.x, g.at(l.x, l.z), l.z);
}

/** the alley's asphalt, continued over the city's stubs to the two junctions (the exclusion clips the street) */
const ALLEY: Vec2[] = [{ x: 0.05, z: -11.2 }, { x: 0.05, z: 11.2 }];
function ground(): SiteGroundPoly[] {
  return gstrip(ALLEY, 3.3, GC.asphalt, PAT.asphalt, g, 5, 0.065);
}

const BLOCKERS = [-1, 1].map(side => ({ poly: [{ x: side * 1.56, z: Z_A }, { x: side * 1.74, z: Z_A }, { x: side * 1.74, z: Z_B }, { x: side * 1.56, z: Z_B }] }));
/** exclusion: the alley between the junctions (24th St's ribbon ends at z −10.65, 25th's at ≈ 10.1) */
const EXCLUDE: Vec2[] = [{ x: -1.8, z: -10.2 }, { x: 1.8, z: -10.2 }, { x: 1.8, z: 9.7 }, { x: -1.8, z: 9.7 }];

export const balmyAlley: W4Site = {
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
  ground: ground(),
  lights: LAMPS.map(l => ({ x: l.x, y: g.at(l.x, l.z) + 3.8, z: l.z, size: 1, color: '#ffd9a0' })),
  plaza: [plazaOf([{ x: -1.4, z: -9.4 }, { x: 1.4, z: -9.4 }, { x: 1.4, z: 9.0 }, { x: -1.4, z: 9.0 }], 'pavement')],
  w4: {
    placeId: 'balmy-alley',
    attractions: ['balmy-alley'],
    arrival: { x: 0, z: -8.4, heading: 0 },
    photo: { target: [0, 1, 1], distance: 13, elevation: 0.28, bearing: Math.PI },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 3, u: 1.7, rule: 'ground' },
    osm: ['way/8920344', 'way/1034016020'],
    terrain: [-3, -12, 3, 12],
    notes: 'The murals are never copied (abstract colour fields only) and people live here: no crowd props beyond the alley itself.',
  },
};
