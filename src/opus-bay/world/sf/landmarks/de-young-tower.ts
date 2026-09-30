import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import { type BatchLike, CYL, ICO, M } from '../../builder';
import type { SiteHooks } from '../sites';
import { GLOW, NONE, box, cbox, loftRings, prismXZ } from './kit';
import type { LandmarkSwap, SfLandmark } from './index';
import { settingGround, streetStrips } from './setting';
import { GC, PAT, bench, gfill, lamp, tree } from './siteKit';

/**
 * de Young museum + Hamon Observation Tower (T1). World-aligned local frame (yaw 0, origin at the tower) so the
 * OSM outlines drop in unchanged: museum relation 1652482, tower parts ways 1418750069…1418972816. The tower twists
 * from a 3.9 × 1.3 u rectangle at the base (aligned with the museum) to a sheared parallelogram at the top (aligned
 * with the street grid) — lofted straight between the two OSM rings. Heights: the OSM parts reach 51 m → H 11.1 u
 * (the published 44 m is the observation floor); museum 13 m at 0.22 u/m → 3.0 u under its deep copper roof.
 *
 * Setting (lane D2, D2-09): a paved forecourt under the tower on the museum's north side (the exclusion reaches 4 u
 * further north to hold it), with benches, lamps, two lawn sculptures and trees; the park walks the exclusion clips
 * run on to it and round the museum. The Music Concourse east of Music Concourse Drive is lane L's wave-4 site.
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
  museum(b);
  tower(b);
  finsAndCanopy(b);
  setting(b);
}

/** the museum body: the copper prism under its deep roof, the light courts, the glazed entry court, the pool */
function museum(b: BatchLike) {
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
}

/** the procedural Hamon tower (lod 0): the twisting copper loft, the glass observation floor, the cap, ribs and ledges */
function tower(b: BatchLike) {
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
}

function finsAndCanopy(b: BatchLike) {
  // museum facade: vertical copper fins along the long sides, the entry canopy
  for (let z = 1.2; z < 19.5; z += 1.3) {
    box(b, -2.72 + (z / 20) * -0.05, -0.2, z, 0.12, MUSEUM_H + 0.2, 0.18, COPPER_DARK);
    box(b, 8.5 - (z > 6 ? (z - 6) * 0.036 : 0), -0.2, z, 0.12, MUSEUM_H + 0.2, 0.18, COPPER_DARK);
  }
  box(b, 4.8, 2.2, -0.9, 3.4, 0.14, 1.6, COPPER_ROOF);
}

// ---------------------------------------------------------------------------
// Wave 7 (lane V, W7-V4): the AI tower. Lane R's realism scorecard (sf-w7-R-realism.md #22) found the twist subtle at
// this size and the copper too light and plain: the real Hamon Observation Tower (Herzog & de Meuron, 2005; 144 ft)
// is clad in dark, dimpled and perforated copper and turns from the museum's axis at its foot to the street grid at
// its top. A SAM 3 mesh of a painted toy concept (ledger w7-V.md, W7-V4) cleaned by the wave-4 pipeline
// (scripts/opus-sf/assets/w7v: 3,920 triangles, 1024² WebP, Draco) replaces the procedural tower; the museum, its fins
// and canopy and the forecourt stay procedural (the remainder). Fitted to the procedural tower's box: 4.3 × 11.15 ×
// 2.6 u (a slab, as the OSM rings), its flat base at local y 0.05 (the ground under the footprint is 0.13–0.57), the top
// at 11.2 like the cap.
// ---------------------------------------------------------------------------

/** the AI tower's place in the site's frame (its base centred on the procedural base ring, nudged onto the museum) */
const AI_TOWER = { x: 0.03, y: 0.05, z: 0.2 } as const;
/** its ground footprint on the decoded mesh (x −2.15…2.05, z −0.77…0.87 below y 1.5), shifted by AI_TOWER */
const AI_FOOT: Vec2[] = [{ x: -2.12, z: -0.57 }, { x: 2.08, z: -0.57 }, { x: 2.08, z: 1.07 }, { x: -2.12, z: 1.07 }];

function aiRemainder(b: BatchLike) {
  museum(b);
  finsAndCanopy(b);
  setting(b);
}

const SWAP: LandmarkSwap = {
  parts: [{ model: 'sf-de-young-tower', x: AI_TOWER.x, y: AI_TOWER.y, z: AI_TOWER.z, scale: [1, 1, 1], castShadow: true, glow: 0.05 }],
  build: aiRemainder,
  ship: true,
  note: 'AI (W7-V4): dark dimpled, perforated copper and the twist vs a plain lofted slab; museum, fins and forecourt procedural',
};
const TOWER_FOOT = (): Vec2[] => (SWAP.ship ? AI_FOOT : ringAt(0, 0, 0.2).map(p => ({ x: p.x, z: p.z })));

// ---------------------------------------------------------------------------
// setting (D2-09)
// ---------------------------------------------------------------------------

const G = settingGround('de-young-tower');
const FORECOURT: Vec2[] = [{ x: -1.2, z: -0.9 }, { x: 0.3, z: -0.45 }, { x: 8.7, z: -0.3 }, { x: 8.7, z: -5.6 }, { x: -1.2, z: -5.6 }];
const BENCHES: [number, number, number][] = [[2.6, -4.9, 0], [5.0, -4.9, 0], [7.9, -2.6, -Math.PI / 2]];
const LAMPS: Vec2[] = [{ x: -0.8, z: -5.2 }, { x: 3.8, z: -5.3 }, { x: 8.3, z: -5.2 }, { x: 8.3, z: -0.8 }];
const TREES: Vec2[] = [{ x: -3.2, z: -5.4 }, { x: 9.6, z: -6.0 }, { x: -3.4, z: -2.6 }];

/** two lawn sculptures: a rusted tilted slab and a bronze sphere on a plinth */
function sculptures(b: BatchLike) {
  const y1 = G.at(1.4, -3.2), y2 = G.at(6.2, -2.4);
  cbox(b, 1.4, y1 + 0.75, -3.2, 0.14, 1.6, 1.1, '#8a4a2c', NONE, 0.5, 0, 0.18);
  box(b, 6.2, y2 - 0.2, -2.4, 0.7, 0.55, 0.7, '#d8d0c1');
  b.add(ICO(1), M(6.2, y2 + 0.72, -2.4, 0, 0.36, 0.36, 0.36), '#9a7440', GLOW(0.1));
}

function setting(b: BatchLike) {
  for (const [x, z, ry] of BENCHES) bench(b, x, G.at(x, z), z, ry);
  for (const p of LAMPS) lamp(b, p.x, G.at(p.x, p.z), p.z);
  TREES.forEach((p, i) => tree(b, p.x, G.at(p.x, p.z), p.z, 1.3, i + 11));
  sculptures(b);
  b.add(CYL(8), M(4.3, G.at(4.3, -4.0) - 0.1, -4.0, 0, 0.9, 0.35, 0.9), '#cfc7b8');
}

const inMuseum = (x: number, z: number) => {
  let c = false;
  for (let i = 0, j = MUSEUM.length - 1; i < MUSEUM.length; j = i++) {
    const [ax, az] = MUSEUM[i], [bx, bz] = MUSEUM[j];
    if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) c = !c;
  }
  return c;
};
const inForecourt = (x: number, z: number) => x > -1.3 && x < 8.8 && z > -5.7 && z < -0.3;

export const deYoungTower: SfLandmark & SiteHooks = {
  id: 'de-young-tower',
  tier: 1,
  x: -247.1,
  z: 930.6,
  yaw: 0,
  base: 16.9,
  // the museum and its north forecourt under the tower
  exclude: { poly: [{ x: -250.3, z: 924.4 }, { x: -237.9, z: 924.4 }, { x: -238.8, z: 951.2 }, { x: -250.3, z: 951.2 }] },
  castShadow: true,
  build,
  walk: {
    blockers: [
      { poly: MUSEUM.map(([x, z]) => ({ x, z })) }, { poly: TOWER_FOOT() },
      ...BENCHES.map(([x, z]) => ({ x, z, r: 0.45 })), ...TREES.map(p => ({ x: p.x, z: p.z, r: 0.3 })),
      { x: 1.4, z: -3.2, r: 0.6 }, { x: 6.2, z: -2.4, r: 0.5 }, { x: 4.3, z: -4.0, r: 0.95 },
    ],
  },
  ground: [
    ...gfill(FORECOURT, GC.plazaWarm, PAT.stone, G, 2.5, 0.045),
    ...streetStrips('de-young-tower', (x, z) => !inMuseum(x, z) && !inForecourt(x, z)),
  ],
  lights: LAMPS.map(p => ({ x: p.x, y: G.at(p.x, p.z) + 3.8, z: p.z, size: 1, color: '#ffd9a0' })),
  plaza: [{ poly: FORECOURT, surface: 'plaza' }],
  swap: SWAP,
  // D2-10: the twisted Hamon tower (the museum wings are its blockers' top)
  tall: [{ x: 0, z: -0.1, r: 3.6 }],
};

