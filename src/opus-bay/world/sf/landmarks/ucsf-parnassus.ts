import type * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { GLOW, box, cbox, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, bollard, craneJib, craneMast, craneSwing, gfill, hoarding, lamp, plazaOf, siteGround } from './siteKit';

/**
 * UCSF Parnassus Heights (wave 4, P1 · map T2, the owner's request): UCSF's flagship health-science campus on the
 * slope of Mt Sutro, here since 1898 on land given by Mayor Adolph Sutro. The campus towers themselves (Moffitt-Long,
 * Medical Sciences, the Health Sciences pair, 13–15 storeys) are already city buildings (10.2 u boxes against the
 * forest); this site adds what the skyline shows in 2026: the new hospital going up beside Long Hospital — a steel
 * frame, clad on its lower floors, behind blue site hoarding — and its tower crane, whose jib turns slowly over
 * Parnassus Ave (the Helen Diller Hospital, 15 storeys, completion expected 2029 and patients in 2030; UCSF Real
 * Estate monthly updates: steel erection through 2026, tower crane six days a week).
 *
 * Frame: origin (−50.9, 919.0) in the lot, yaw 4.5° (the Medical Center's edges: local +x ≈ east along it, +z toward
 * it). The lot is
 * OSM way 1386883405 (landuse=construction) inset off Parnassus Ave (west) and Medical Center Way (east), stopping
 * 0.5 u short of the Medical Center (3830592, z ≥ 4.6). Steel to 8.4 u (the frame's first ≈ 9 of 15 floors), the
 * crane mast to 15.5 u. No company names, logos or signs on the hoarding or the crane.
 */

const ID = 'ucsf-parnassus';
const X0 = -50.89, Z0 = 918.98, YAW = (4.5 * Math.PI) / 180;
const g = siteGround(ID, 25.6);

const STEEL = '#8c6f5a', STEEL_DARK = '#6d574a', DECK = '#b9b2a6', CLAD = '#9fc0c8', CLAD_FRAME = '#e6e2d8';

/** the frame's footprint (local, a 3 × 3-bay box inside the lot) and floor heights */
const F = { x0: -1.5, x1: 3.7, z0: 0.2, z1: 3.4 }, LEVEL = 0.93, LEVELS = 9, CLAD_LEVELS = 4;
const MAST = { x: 0.9, z: -2.3 }, MAST_H = 15.5, JIB = 11, COUNTER = 4.2;
/** site hoarding (blue plywood fence) around the lot, gates on Parnassus */
const HOARDING: Vec2[] = [{ x: 0.9, z: -4.3 }, { x: 3.9, z: 0.1 }, { x: 5.1, z: 2.5 }, { x: 5.4, z: 3.8 }, { x: -3.9, z: 3.8 }, { x: -2.4, z: 1.1 }, { x: 0.9, z: -4.3 }];
const LAMPS: Vec2[] = [{ x: -3.3, z: 0.0 }];
/** the Parnassus Ave sidewalk between the hoarding and the kerb (crowd spots, two benches) */
const WALK: Vec2[] = [{ x: -6.9, z: 3.8 }, { x: -3.9, z: 3.8 }, { x: -2.4, z: 1.1 }, { x: 0.9, z: -4.3 }, { x: -0.3, z: -6.6 }, { x: -1.5, z: -6.6 }];
const SEATS: [number, number, number][] = [[-4.8, 2.9, 1.04], [-2.1, -1.8, 1.04]];

const base = () => g.at((F.x0 + F.x1) / 2, (F.z0 + F.z1) / 2);

function frame(b: BatchLike, lod: 0 | 2) {
  const y0 = base(), top = y0 + LEVEL * LEVELS;
  if (lod === 2) {
    box(b, (F.x0 + F.x1) / 2, -1.2, (F.z0 + F.z1) / 2, F.x1 - F.x0, top + 1.2, F.z1 - F.z0, STEEL);
    return;
  }
  // columns on a 3 × 2 bay grid, floor decks, the lower floors clad in glass panels (curtain wall going up)
  for (let i = 0; i <= 3; i++) for (let k = 0; k <= 2; k++) {
    const x = F.x0 + ((F.x1 - F.x0) * i) / 3, z = F.z0 + ((F.z1 - F.z0) * k) / 2;
    box(b, x, -1.2, z, 0.22, top + 1.2 - (i === 3 && k === 0 ? LEVEL * 2 : 0), 0.22, STEEL_DARK);
  }
  for (let l = 1; l <= LEVELS; l++) {
    const y = y0 + l * LEVEL, w = F.x1 - F.x0, d = F.z1 - F.z0, cx = (F.x0 + F.x1) / 2, cz = (F.z0 + F.z1) / 2;
    if (l <= LEVELS - 2) box(b, cx, y - 0.12, cz, w + 0.1, 0.12, d + 0.1, DECK);
    else for (const s of [-1, 1]) { box(b, cx, y - 0.2, cz + (s * d) / 2, w, 0.2, 0.14, STEEL); box(b, cx + (s * w) / 2, y - 0.2, cz, 0.14, 0.2, d, STEEL); }
  }
  // curtain wall on the Parnassus and Medical Center Way faces, lower floors (lit a little at night: work lights)
  const ch = LEVEL * CLAD_LEVELS;
  box(b, (F.x0 + F.x1) / 2, y0 - 0.2, F.z0 - 0.08, F.x1 - F.x0 + 0.2, ch + 0.2, 0.08, CLAD, [6, y0, -4.4, 0.2]);
  box(b, F.x0 - 0.08, y0 - 0.2, (F.z0 + F.z1) / 2, 0.08, ch + 0.2, F.z1 - F.z0 + 0.2, CLAD, [6, y0, -1.7, 0.2]);
  for (let l = 1; l <= CLAD_LEVELS; l++) box(b, (F.x0 + F.x1) / 2, y0 + l * LEVEL - 0.05, F.z0 - 0.12, F.x1 - F.x0 + 0.3, 0.08, 0.06, CLAD_FRAME);
  // a site hoist on the east face, warning beacons on top
  box(b, F.x1 + 0.35, y0 - 0.2, 1.8, 0.5, top - y0 + 0.2, 0.5, '#d8c8a0');
  cbox(b, F.x1, top + 0.1, F.z1, 0.14, 0.14, 0.14, '#ff5a44', GLOW(1));
}

function build(b: BatchLike, lod: 0 | 2) {
  frame(b, lod);
  craneMast(b, MAST.x, g.at(MAST.x, MAST.z), MAST.z, MAST_H, lod, JIB, COUNTER);
  if (lod === 2) return;
  hoarding(b, HOARDING, g.at);
  for (const l of LAMPS) lamp(b, l.x, g.at(l.x, l.z), l.z);
  for (const [x, z] of [[-3.6, 1.5], [-1.2, -3.0]]) bollard(b, x, g.at(x, z), z);
  for (const [x, z, ry] of SEATS) bench(b, x, g.at(x, z), z, ry);
}

/** the lot: packed earth inside the hoarding */
const LOT: Vec2[] = HOARDING.slice(0, -1);

function ground(): SiteGroundPoly[] {
  return gfill(LOT, GC.earth, PAT.earth, g, 4);
}

/** exclusion: OSM way 1386883405 inset 2.4 u off Parnassus Ave's and Medical Center Way's centrelines */
const EXCLUDE: Vec2[] = [{ x: -0.3, z: -6.6 }, { x: 0.85, z: -4.5 }, { x: 4.1, z: 0.2 }, { x: 5.4, z: 2.7 }, { x: 5.8, z: 4.1 }, { x: -6.2, z: 4.1 }];

export const ucsfParnassus: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  animate: {
    build: (b: BatchLike) => craneJib(b, JIB, COUNTER),
    update(obj: THREE.Object3D, t: number) {
      obj.position.set(MAST.x, MAST_H, MAST.z);
      // a slow working swing (≈ 70° back and forth over the lot and the street), never a full turn
      obj.rotation.set(0, craneSwing(t, 0.6), 0);
    },
  },
  walk: { blockers: [{ poly: LOT }] },
  ground: ground(),
  lights: LAMPS.map(l => ({ x: l.x, y: g.at(l.x, l.z) + 3.8, z: l.z, size: 1, color: '#ffd9a0' })),
  plaza: [plazaOf(WALK, 'pavement')],
  w4: {
    placeId: 'ucsf-parnassus',
    attractions: ['ucsf-parnassus'],
    lod0R: 190,
    arrival: { x: -4.6, z: 1.2, heading: 2.0 },
    ringMin: 0.7,
    photo: { target: [0.9, 7, 0], distance: 40, elevation: 0.3, bearing: -2.3 },
    flag: { x: 1.1, z: 1.8, h: 30 },
    height: { realM: 70, u: 15.5, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/1386883405', 'relation/3830592'],
    terrain: [-9, -8, 8, 6],
    notes: "The campus towers stay city buildings; the site is the new-hospital lot (steel frame + turning tower crane). Walk-around ring 70 %: the Medical Center closes the lot's south side. The Mt Sutro forest is the city's own forest area.",
  },
};
