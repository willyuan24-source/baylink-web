import * as THREE from 'three';
import { HALO, U } from '../world/materials';

/**
 * Wave 6 · lane H (W6-H1) · the season's night glow: ONE instanced mesh of camera-facing halos on the shared HALO
 * material (world/materials.ts: additive, night-only, a gentle per-halo flicker in its vertex shader — the candles; no
 * new program) for every Halloween light: the carved faces and porch lanterns of the stoops, the hidden
 * jack-o'-lanterns, Día de los Muertos' candles. Each owner `set()`s its list; the pool re-uploads only what changed and
 * is hidden by day (uNight ≤ NIGHT_MIN): one draw call at night, none by day.
 */

export interface HaloSpot { x: number; y: number; z: number; size: number; color: THREE.Color }

export const HALO_CAP = 768;
export const NIGHT_MIN = 0.06;

export interface HaloPool {
  mesh: THREE.InstancedMesh;
  /** `priority`: higher owners fill the pool first (the hunt's lanterns before the stoops' far glow) */
  set(owner: string, list: readonly HaloSpot[], priority?: number): void;
  /** per frame (cheap): shows the pool at night only */
  step(): void;
  count(): number;
  dispose(): void;
}

export function createHaloPool(cap = HALO_CAP): HaloPool {
  const geo = new THREE.PlaneGeometry(1, 1);
  const data = new Float32Array(cap * 3);
  for (let i = 0; i < cap; i++) { data[i * 3] = 1; data[i * 3 + 1] = (i * 0.618) % 1; data[i * 3 + 2] = 0; }
  const attr = new THREE.InstancedBufferAttribute(data, 3);
  geo.setAttribute('aHalo', attr);
  const mesh = new THREE.InstancedMesh(geo, HALO, cap);
  mesh.name = 'halloween-halos';
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  mesh.setColorAt(0, new THREE.Color(0, 0, 0));
  const owners = new Map<string, { list: readonly HaloSpot[]; priority: number }>();
  let dirty = false;
  const m = new THREE.Matrix4();
  const upload = () => {
    dirty = false;
    let i = 0;
    for (const { list } of [...owners.values()].sort((a, b) => b.priority - a.priority)) for (const h of list) {
      if (i >= cap) break;
      mesh.setMatrixAt(i, m.makeTranslation(h.x, h.y, h.z));
      mesh.setColorAt(i, h.color);
      data[i * 3] = h.size;
      i++;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    attr.needsUpdate = true;
  };
  return {
    mesh,
    set: (owner, list, priority = 0) => {
      const prev = owners.get(owner)?.list;
      if (prev === list || (!list.length && !prev?.length)) return;
      if (list.length) owners.set(owner, { list, priority }); else owners.delete(owner);
      dirty = true;
    },
    step: () => {
      const on = U.uNight.value > NIGHT_MIN;
      if (on && dirty) upload();
      mesh.visible = on && mesh.count > 0;
    },
    count: () => { if (dirty) upload(); return mesh.count; },
    // the InstancedMesh's own dispose too: the renderer frees instanceMatrix / instanceColor (W6-H review: they leaked)
    dispose: () => { geo.dispose(); mesh.dispose(); owners.clear(); },
  };
}
