import * as THREE from 'three';
import { CBOX, CONE, ICO, M, Batch, type Info } from '../world/builder';
import { TOY_DYN } from '../world/materials';
import type { HaloSpot } from './worldHalos';

/**
 * Wave 6 · lane H (W6-H4) · the haunted glow: over the Sutro Baths ruins at Lands End (the city's favourite spooky
 * ruin; the hunt's lantern 20 sits on its edge) three friendly sheet ghosts float and bob, glowing faintly (always) and
 * with a pale green halo each at night. Only in 'season' / 'night', only within HAUNT_NEAR: one small mesh (≈ 600
 * triangles, TOY_DYN) whose one matrix bobs — no per-vertex work.
 */

/** the ruins' basin (hunt spot 20's ground, places.json sutro-baths) */
export const HAUNT_AT = { x: -724, y: 0.84, z: 1244 } as const;
export const HAUNT_NEAR = 300;
const GHOST = '#eef6f0', EYE = '#26222b';
/** a faint glow always ((1, 2] in the toy shader), brighter at night */
const SPECTRAL: Info = [0, 0, 0, 1.25];
const HALO = new THREE.Color(0.55, 1.0, 0.75);

/** The three ghosts around the origin (local), their halos in world space. */
export function buildHaunt(halos: HaloSpot[]): THREE.BufferGeometry {
  const b = new Batch();
  const ghosts = [{ x: -3.5, z: 1.5, y: 3.2, f: 0.6, s: 1 }, { x: 2.8, z: -2.2, y: 4.1, f: -1.2, s: 0.8 }, { x: 0.6, z: 3.8, y: 2.6, f: 2.4, s: 0.9 }];
  for (const g of ghosts) {
    const s = g.s;
    const fx = Math.sin(g.f), fz = Math.cos(g.f), sx = Math.cos(g.f), sz = -Math.sin(g.f);
    const at = (side: number, up: number, fwd: number): [number, number, number] => [g.x + sx * side * s + fx * fwd * s, g.y + up * s, g.z + sz * side * s + fz * fwd * s];
    const h = at(0, 0.4, 0);
    b.add(ICO(1), M(h[0], h[1], h[2], g.f, 0.36 * s, 0.38 * s, 0.36 * s), GHOST, SPECTRAL);
    const k = at(0, -0.75, 0);
    b.add(CONE(10), M(k[0], k[1], k[2], g.f, 0.46 * s, 1.1 * s, 0.46 * s), GHOST, SPECTRAL);
    for (const sd of [-1, 1]) { const a = at(sd * 0.42, 0.05, 0.08); b.add(ICO(0), M(a[0], a[1], a[2], g.f, 0.13 * s, 0.1 * s, 0.13 * s), GHOST, SPECTRAL); }
    for (const sd of [-0.13, 0.13]) { const e = at(sd, 0.5, 0.33); b.add(CBOX(), M(e[0], e[1], e[2], g.f, 0.08 * s, 0.12 * s, 0.04 * s), EYE, [0, 0, 0, 0]); }
    const m = at(0, 0.3, 0.34);
    b.add(CBOX(), M(m[0], m[1], m[2], g.f, 0.1 * s, 0.1 * s, 0.04 * s), EYE, [0, 0, 0, 0]);
    halos.push({ x: HAUNT_AT.x + g.x, y: HAUNT_AT.y + g.y + 0.2, z: HAUNT_AT.z + g.z, size: 2.6 * s, color: HALO });
  }
  return b.build();
}

export interface Haunt { group: THREE.Group; step(dt: number, t: number, px: number, pz: number, on: boolean): void; halos(): readonly HaloSpot[]; shown(): boolean; dispose(): void }

export function createHaunt(): Haunt {
  const group = new THREE.Group();
  group.name = 'halloween-haunt';
  let mesh: THREE.Mesh | null = null;
  let halos: HaloSpot[] = [];
  const drop = () => { if (!mesh) return; group.remove(mesh); mesh.geometry.dispose(); mesh = null; halos = []; };
  return {
    group,
    step: (_dt, t, px, pz, on) => {
      const want = on && Math.hypot(px - HAUNT_AT.x, pz - HAUNT_AT.z) < HAUNT_NEAR;
      if (!want) { drop(); return; }
      if (!mesh) {
        const hl: HaloSpot[] = [];
        mesh = new THREE.Mesh(buildHaunt(hl), TOY_DYN);
        mesh.name = 'halloween-haunt-ghosts';
        mesh.matrixAutoUpdate = false;
        group.add(mesh);
        halos = hl;
      }
      // a slow bob: one matrix a frame (the halos stay put: the bob is small)
      mesh.position.set(HAUNT_AT.x, HAUNT_AT.y + Math.sin(t * 0.9) * 0.3, HAUNT_AT.z);
      mesh.updateMatrix();
    },
    halos: () => halos,
    shown: () => !!mesh,
    dispose: drop,
  };
}
