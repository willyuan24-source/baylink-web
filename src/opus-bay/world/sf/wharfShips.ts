import * as THREE from 'three';
import type { Vec2 } from '../../core/types';
import { CONE, CYL, type BatchLike, M } from '../builder';
import { TOY } from '../materials';
import { TypedBatch } from '../typedBatch';
import type { WorldSystem } from '../world';
import { NONE, cbox, cyl } from './landmarks/kit';

/**
 * Wave 7 · lane W1 · the Wharf's museum submarine (W7-W13; sf-w7-lead §3 row W1 (4)), city mode only: USS Pampanito
 * alongside Pier 45, on OSM's hull (way 165601339, "building=ship", ref SS-383), which straddles the hero slab's edge
 * (the district is frozen) — so a city WorldSystem draws it, like the corners. The pier45 perf spot at the Musée
 * Mécanique door looks straight at it (it looked at empty water).
 *
 *   the hull     a long dark-grey cylinder low in the water (the Balao class: 311 ft 9 in ≈ 95 m → OSM's 13.1 u), the
 *                tapered bow and stern, the flat casing deck on top
 *   the sail     the conning tower with its bridge, two periscope masts, the deck gun forward of it
 *   no lettering (the hull number is text)
 *
 * Cost: ONE TOY mesh in a THREE.LOD drawn within SHIP_CULL u, built the first time the camera comes within SHIP_BUILD u;
 * no collision (it lies in the water beside the pier).
 *
 * Facts (checked on the web 2026-09-29): USS Pampanito, a WWII Balao-class fleet submarine (1943, Portsmouth Navy
 * Yard), a museum and memorial at Pier 45, Fisherman's Wharf, run by the San Francisco Maritime National Park
 * Association — https://www.nps.gov/places/uss-pampanito.htm , https://en.wikipedia.org/wiki/USS_Pampanito ,
 * https://maritime.org/visit-us/
 * The SS Jeremiah O'Brien (north end of Pier 35 — https://ssjeremiahobrien.org/visit-us/ , 2026-09-29) is not drawn:
 * OSM's hull lies on the district's promenade there (sf-w7-W1.md part c).
 */

/** OSM way 165601339's centreline: the stern (east) and the bow (west), world x, z */
export const PAMPANITO = { stern: { x: -218.6, z: 62.66 } as Vec2, bow: { x: -231.5, z: 64.12 } as Vec2, beam: 1.15 } as const;
/** the city's water surface (world/sf/water.ts WATER_Y, data/district.ts waterLevel) */
const WATER = -0.6;
export const SHIP_CULL = 180;
export const SHIP_BUILD = 250;
export const SHIP_BUDGET = { calls: 1, triangles: 1500 } as const;

const HULL = '#5d646c', CASING = '#80858a', SAIL = '#6b7179', DARK = '#3a3f44';

/** the middle of the hull (the LOD's centre) */
export const PAMPANITO_MID: Vec2 = { x: (PAMPANITO.stern.x + PAMPANITO.bow.x) / 2, z: (PAMPANITO.stern.z + PAMPANITO.bow.z) / 2 };

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

/** the ship's mesh (world coordinates); triangles for the budget test */
export function buildWharfShips(): { toy: THREE.Mesh; triangles: number } {
  const b = new TypedBatch(2048);
  pampanito(b);
  const a = b.toArrays();
  const toy = new THREE.Mesh(TypedBatch.toGeometry(a), TOY);
  toy.name = 'sf:wharf:pampanito';
  toy.castShadow = false; toy.receiveShadow = true; toy.matrixAutoUpdate = false;
  return { toy, triangles: a.indexCount / 3 };
}

/** City mode: the Wharf's submarine as a world system (world/sf/cityWorld.ts adds it). */
export function attachWharfShips(): WorldSystem {
  const group = new THREE.Group();
  group.name = 'sf:wharf-ships';
  const lod = new THREE.LOD();
  lod.position.set(PAMPANITO_MID.x, 0, PAMPANITO_MID.z);
  const near = new THREE.Group();
  near.position.set(-PAMPANITO_MID.x, 0, -PAMPANITO_MID.z);
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
      if ((c.x - PAMPANITO_MID.x) ** 2 + (c.z - PAMPANITO_MID.z) ** 2 > SHIP_BUILD * SHIP_BUILD) return;
      built = buildWharfShips();
      built.toy.updateMatrix();
      near.add(built.toy);
      group.updateMatrixWorld(true);
    },
    dispose() { built?.toy.geometry.dispose(); },
  };
}
