import * as THREE from 'three';
import type { Vec2 } from '../../core/types';
import { CONE, CYL, type BatchLike, type ColorLike, M } from '../builder';
import { TOY } from '../materials';
import { TypedBatch } from '../typedBatch';
import type { WorldSystem } from '../world';
import { GLOW, NONE, cbox, cyl, tube } from './landmarks/kit';

/**
 * The Wharf's museum ships, city mode only (one TOY mesh in a THREE.LOD; no collision: both lie in the water):
 *
 * USS Pampanito (wave 7, W7-W13; sf-w7-lead §3 row W1 (4)) alongside Pier 45, on OSM's hull (way 165601339,
 * "building=ship", ref SS-383), which straddles the hero slab's edge (the district is frozen) — so a city WorldSystem
 * draws it, like the corners. The pier45 perf spot at the Musée Mécanique door looks straight at it.
 *
 *   the hull     a long dark-grey cylinder low in the water (the Balao class: 311 ft 9 in ≈ 95 m → OSM's 13.1 u), the
 *                tapered bow and stern, the flat casing deck on top
 *   the sail     the conning tower with its bridge, two periscope masts, the deck gun forward of it
 *
 * SS Jeremiah O'Brien (wave 8, W8-W12; sf-w8-lead §3 row W1 (2)) at the north end of Pier 35: OSM's hull (way
 * 1280748838) lies on the district's promenade (the hand-made seawall is further out than OSM's), so the toy ship lies
 * in the water along the toy Pier 35's west face (data/district.ts PIER_SPECS pier35: the deck's root corner
 * (−120.16, −13.17), its west face running (−0.811, −0.585) out into the Bay), 0.4 u off it, the stern at the seawall
 * end, the bow out toward the Bay (OSM's hull also lies along the pier, by its shore end):
 *
 *   the hull     a Liberty ship (EC2-S-C1: 441 ft 6 in × 57 ft ≈ 134.6 × 17.4 m → 18.8 × 2.4 u), haze grey with a dark-red
 *                boot topping at the waterline, the raised forecastle and poop, five hatches
 *   the house    the midship house (two decks and the bridge, its windows lit at night), the funnel with a black top
 *   the masts    three (fore, main, mizzen) with crosstrees and a cargo boom each
 *   no guns, no lettering, no flags
 *
 * Cost: ONE TOY mesh in a THREE.LOD centred between the two ships, drawn within SHIP_CULL u of that centre, built the
 * first time the camera comes within SHIP_BUILD u; no shadows cast.
 *
 * Facts (checked on the web): USS Pampanito — https://www.nps.gov/places/uss-pampanito.htm ,
 * https://en.wikipedia.org/wiki/USS_Pampanito , https://maritime.org/visit-us/ (2026-09-29). SS Jeremiah O'Brien:
 * "Located on the North end of Pier 35, near the intersection of Kearny St, North Point St and The Embarcadero", open
 * daily 10–16 — https://ssjeremiahobrien.org/visit-us/ (2026-09-30); a Liberty ship (EC2-S-C1) launched 19 June 1943 at
 * South Portland, Maine, ≈ 441 ft × 57 ft, back at Normandy in 1994 for D-Day's 50th anniversary —
 * https://en.wikipedia.org/wiki/SS_Jeremiah_O%27Brien , https://www.nps.gov/parkhistory/online_books/butowsky1/jeremiahobrien.htm
 * (2026-09-30).
 */

/** OSM way 165601339's centreline: the stern (east) and the bow (west), world x, z */
export const PAMPANITO = { stern: { x: -218.6, z: 62.66 } as Vec2, bow: { x: -231.5, z: 64.12 } as Vec2, beam: 1.15 } as const;
/**
 * The O'Brien's centreline, world x, z: along the toy Pier 35's west face (root corner R (−120.16, −13.17), direction
 * d (−0.811, −0.585), outward normal n (−0.585, 0.811)), stern = R + 3.5 d + 1.6 n, bow = R + 22.3 d + 1.6 n.
 */
export const OBRIEN = { stern: { x: -123.93, z: -13.92 } as Vec2, bow: { x: -139.18, z: -24.92 } as Vec2, beam: 2.4 } as const;
/** the toy Pier 35's deck (data/district.ts pier35) the O'Brien lies along: root corner and the west face's direction */
export const PIER35_WEST = { root: { x: -120.16, z: -13.17 } as Vec2, dir: { x: -0.811, z: -0.585 } as Vec2 } as const;
/** the city's water surface (world/sf/water.ts WATER_Y, data/district.ts waterLevel) */
const WATER = -0.6;
export const SHIP_CULL = 245;
export const SHIP_BUILD = 310;
export const SHIP_BUDGET = { calls: 1, triangles: 1500 } as const;

const HULL = '#5d646c', CASING = '#80858a', SAIL = '#6b7179', DARK = '#3a3f44';
const LIB = { hull: '#6f777d', boot: '#7d3a2e', deck: '#8e877b', house: '#a9afb2', houseTop: '#b9bdbe', funnel: '#8b9195', black: '#2c2f31', mast: '#a59f93', hatch: '#4f524f', glass: '#2f3a42' } as const;

const mid = (s: { stern: Vec2; bow: Vec2 }): Vec2 => ({ x: (s.stern.x + s.bow.x) / 2, z: (s.stern.z + s.bow.z) / 2 });
/** the middle of each hull */
export const PAMPANITO_MID: Vec2 = mid(PAMPANITO);
export const OBRIEN_MID: Vec2 = mid(OBRIEN);
/** the LOD's centre: halfway between the two ships */
export const SHIPS_MID: Vec2 = { x: (PAMPANITO_MID.x + OBRIEN_MID.x) / 2, z: (PAMPANITO_MID.z + OBRIEN_MID.z) / 2 };

function pampanito(b: BatchLike) {
  const { stern, bow, beam } = PAMPANITO;
  const L = Math.hypot(bow.x - stern.x, bow.z - stern.z), ux = (bow.x - stern.x) / L, uz = (bow.z - stern.z) / L;
  const ry = Math.atan2(ux, uz), r = beam / 2;
  const at = (s: number) => ({ x: stern.x + ux * s, z: stern.z + uz * s });
  const cy = WATER + 0.1; // the hull's axis: a little above the water (a low, long back)
  // the pressure hull from 1.2 u to L − 1.6 u, the tapered stern and bow
  const s0 = 1.2, s1 = L - 1.6, a = at(s0);
  b.add(CYL(10), M(a.x, cy, a.z, ry, r, s1 - s0, r * 0.85, Math.PI / 2), HULL);
  const bw = at(s1);
  b.add(CONE(10), M(bw.x, cy, bw.z, ry, r, 1.6, r * 0.85, Math.PI / 2), HULL);
  const st = at(s0);
  b.add(CONE(10), M(st.x, cy, st.z, ry + Math.PI, r, 1.2, r * 0.85, Math.PI / 2), HULL);
  // the casing deck along the top
  const dm = at(L * 0.5);
  cbox(b, dm.x, cy + r * 0.85 + 0.02, dm.z, 0.62, 0.08, L * 0.82, CASING, NONE, ry);
  // the sail (conning tower) 40 % from the bow, its bridge and the periscope masts
  const sl = at(L * 0.6), top = cy + r * 0.85 + 0.06;
  cbox(b, sl.x, top + 0.42, sl.z, 0.5, 0.84, 1.7, SAIL, NONE, ry);
  const br = at(L * 0.6 + 0.35);
  cbox(b, br.x, top + 0.9, br.z, 0.46, 0.14, 0.8, DARK, NONE, ry);
  for (const [ds, h] of [[-0.15, 1.35], [-0.45, 1.15]] as const) { const p = at(L * 0.6 + ds); cyl(b, p.x, top + 0.84, p.z, 0.035, h, DARK, NONE, 5); }
  // the deck gun forward of the sail: a pedestal, the barrel pointing at the bow
  const g = at(L * 0.6 + 1.6);
  cyl(b, g.x, top, g.z, 0.1, 0.22, SAIL, NONE, 6);
  b.add(CYL(6), M(g.x, top + 0.24, g.z, ry, 0.045, 0.7, 0.045, Math.PI / 2), DARK);
}

/** the O'Brien's deck heights (world y): the main deck, the forecastle and poop decks */
export const OBRIEN_DECK = { main: 0.45, raised: 0.85 } as const;

function obrien(b: BatchLike) {
  const { stern, bow, beam } = OBRIEN;
  const L = Math.hypot(bow.x - stern.x, bow.z - stern.z), ux = (bow.x - stern.x) / L, uz = (bow.z - stern.z) / L;
  const ry = Math.atan2(ux, uz), r = beam / 2;
  // hull frame: s along from the stern (0 … L), t across (+ = starboard side when looking at the bow)
  const P = (s: number, t: number): Vec2 => ({ x: stern.x + ux * s + uz * t, z: stern.z + uz * s - ux * t });
  const poly = (pts: readonly [number, number][]) => pts.map(([s, t]) => P(s, t));
  const box = (s: number, t: number, y0: number, y1: number, w: number, d: number, color: ColorLike, glow = 0) => { const p = P(s, t); cbox(b, p.x, (y0 + y1) / 2, p.z, w, y1 - y0, d, color, glow ? GLOW(glow) : NONE, ry); };
  const { main, raised } = OBRIEN_DECK;
  // the hull: the outline (a square-ish stern, the parallel body, the bow drawn to a point), the boot topping, the deck
  const outline: [number, number][] = [[0, -0.8 * r], [0.6, -r], [0.7 * L, -r], [0.9 * L, -0.6 * r], [L, 0], [0.9 * L, 0.6 * r], [0.7 * L, r], [0.6, r], [0, 0.8 * r]];
  const hull = poly(outline);
  b.walls(hull, WATER - 0.45, main, LIB.hull);
  const boot = poly(outline.map(([s, t]) => [s, t * 1.01] as [number, number]));
  b.walls(boot, WATER - 0.12, WATER + 0.1, LIB.boot);
  b.polygon(hull, main, LIB.deck);
  // the forecastle (bow) and the poop (stern), raised decks
  const fc = poly([[0.86 * L, -0.66 * r], [0.9 * L, -0.6 * r], [L, 0], [0.9 * L, 0.6 * r], [0.86 * L, 0.66 * r]]);
  b.walls(fc, main - 0.05, raised, LIB.hull);
  b.polygon(fc, raised, LIB.deck);
  box(0.06 * L, 0, main - 0.05, raised, 1.62 * r, 0.12 * L, LIB.hull);
  // five hatches (holds 1–3 forward of the house, 4–5 aft)
  for (const f of [0.83, 0.74, 0.64, 0.33, 0.19]) box(f * L, 0, main, main + 0.18, 1.25, 1.15, LIB.hatch);
  // the midship house: two decks, the bridge deck with its lit windows, the funnel with its black top
  box(0.495 * L, 0, main, main + 0.9, 1.9, 0.17 * L, LIB.house);
  box(0.5 * L, 0, main + 0.9, main + 1.35, 1.55, 0.12 * L, LIB.houseTop);
  box(0.555 * L, 0, main + 1.35, main + 1.68, 1.35, 0.045 * L, LIB.house);
  box(0.5775 * L + 0.012, 0, main + 1.45, main + 1.6, 1.36, 0.02, LIB.glass, 0.6);
  for (const t of [-0.96, 0.96]) box(0.5 * L, t, main + 0.45, main + 0.62, 0.02, 0.15 * L, LIB.glass, 0.5);
  const fn = P(0.475 * L, 0);
  cyl(b, fn.x, main + 1.3, fn.z, 0.3, 1.25, LIB.funnel, NONE, 8);
  cyl(b, fn.x, main + 2.55, fn.z, 0.31, 0.28, LIB.black, NONE, 8);
  // the masts (fore, main, mizzen) with a crosstree and one cargo boom each, lying over the hatch beside it
  const masts: [number, number, number][] = [[0.79 * L, 3.6, 0.83 * L], [0.69 * L, 3.8, 0.64 * L], [0.27 * L, 3.2, 0.33 * L]];
  for (const [s, h, toward] of masts) {
    const p = P(s, 0);
    cyl(b, p.x, main, p.z, 0.07, h, LIB.mast, NONE, 6);
    box(s, 0, main + h * 0.78, main + h * 0.78 + 0.08, 1.0, 0.1, LIB.mast);
    const q = P(toward + Math.sign(toward - s) * 0.4, 0);
    tube(b, new THREE.Vector3(p.x, main + 0.5, p.z), new THREE.Vector3(q.x, main + 1.35, q.z), 0.045, LIB.mast, NONE, 4);
  }
  // a masthead light (night)
  const ml = P(0.69 * L, 0);
  cbox(b, ml.x, main + 3.85, ml.z, 0.1, 0.1, 0.1, '#ffe7b0', GLOW(1.2), ry);
}

/** One ship's batch (its own triangles and bounds: the tests). */
export function buildShipBatch(id: 'pampanito' | 'obrien'): TypedBatch {
  const b = new TypedBatch(2048);
  if (id === 'pampanito') pampanito(b); else obrien(b);
  return b;
}

/** the ships' mesh (world coordinates); triangles for the budget test */
export function buildWharfShips(): { toy: THREE.Mesh; triangles: number } {
  const b = new TypedBatch(4096);
  pampanito(b);
  obrien(b);
  const a = b.toArrays();
  const toy = new THREE.Mesh(TypedBatch.toGeometry(a), TOY);
  toy.name = 'sf:wharf:ships';
  toy.castShadow = false; toy.receiveShadow = true; toy.matrixAutoUpdate = false;
  return { toy, triangles: a.indexCount / 3 };
}

/** City mode: the Wharf's museum ships as a world system (world/sf/cityWorld.ts adds it). */
export function attachWharfShips(): WorldSystem {
  const group = new THREE.Group();
  group.name = 'sf:wharf-ships';
  const lod = new THREE.LOD();
  lod.position.set(SHIPS_MID.x, 0, SHIPS_MID.z);
  const near = new THREE.Group();
  near.position.set(-SHIPS_MID.x, 0, -SHIPS_MID.z);
  lod.addLevel(near, 0);
  lod.addLevel(new THREE.Object3D(), SHIP_CULL);
  group.add(lod);
  let built: ReturnType<typeof buildWharfShips> | null = null;
  return {
    name: 'wharf-ships',
    group,
    update(_dt, _t, camera) {
      if (built) return;
      const c = camera.position;
      if ((c.x - SHIPS_MID.x) ** 2 + (c.z - SHIPS_MID.z) ** 2 > SHIP_BUILD * SHIP_BUILD) return;
      built = buildWharfShips();
      built.toy.updateMatrix();
      near.add(built.toy);
      group.updateMatrixWorld(true);
    },
    dispose() { built?.toy.geometry.dispose(); },
  };
}
