import * as THREE from 'three';
import { Batch, M } from '../world/builder';
import { patchToyShader } from '../world/materials';
import { meshWarmup, type WarmupSet } from '../world/warmup';
import { costumeHatGeometry } from '../halloween/costumeMesh';
import type { HatKind } from './items';

/**
 * Wave 5 · lane E · W5-E7: BAYBAY's three hats (毛线帽 · 遮阳帽 · 水手帽), procedural toy geometry worn through
 * `charApi.attach('baybay', 'head', mesh)`.
 *
 * - Authored in the head slot's frame (actors/charImpl.ts SLOTS): origin on the crown between the ears, +y up, +z the way
 *   she faces, character units. Her head is ≈ 0.34 wide each side and its top is ≈ 0.03 above the slot; the ears sit
 *   at x ±0.25, y −0.06, so every hat stays narrow enough (or high enough) for them to show.
 * - One plain Mesh per hat kind, built on first use and kept (≤ 420 triangles each; no shadow cast: the heroes' shadow
 *   proxies stay as they are).
 * - Material: ONE instance of the TOY_DYN program (world/materials makeToy 'ob-toy-dyn', sway off: the same
 *   onBeforeCompile and cache key), used by the hat meshes only, receiveShadow / castShadow off like the warmed TOY_DYN
 *   dummy: no new program. Registered with the warm-up all the same ('e-hats', world/warmup recipe W5-V6).
 */

let MAT: THREE.MeshStandardMaterial | null = null;
/** Our own instance of the TOY_DYN program (plain meshes, no sway). */
export function hatMaterial(): THREE.MeshStandardMaterial {
  if (MAT) return MAT;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  m.name = 'ob-hats';
  m.onBeforeCompile = shader => { patchToyShader(shader, { sway: false }); };
  m.customProgramCacheKey = () => 'ob-toy-dyn';
  return (MAT = m);
}

const cyl = (rt: number, rb: number, h: number, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, false);
const sph = (r: number, ws = 16, hs = 10, thetaLen = Math.PI) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, thetaLen);
const tor = (r: number, tube: number, rs = 8, ts = 24) => new THREE.TorusGeometry(r, tube, rs, ts);
const KNIT_A = new THREE.Color('#b8453f'), KNIT_B = new THREE.Color('#a33c37');

/** The hat's geometry in the head slot's frame (position / normal / colour / aInfo, like every TOY geometry). */
export function hatGeometry(kind: HatKind): THREE.BufferGeometry {
  // W6-G3 (lane G): the Halloween costume hats (witch hat, pumpkin head) are built by halloween/costumeMesh.ts
  if (kind === 'witch' || kind === 'pumpkin') return costumeHatGeometry(kind);
  const b = new Batch();
  if (kind === 'beanie') {
    // a knit cap hugging the crown (ribbed: the columns alternate two reds), a folded cream cuff, a pom-pom on top
    const tilt = -0.12, R = 0.235, SY = 0.92, cy = -0.02, cz = -0.01;
    const rib = (_x: number, _y: number, _z: number, lx: number, _ly: number, lz: number) => (Math.floor(((Math.atan2(lz, lx) / (Math.PI * 2)) + 1) * 14) % 2 ? KNIT_A : KNIT_B);
    b.add(sph(R, 14, 5, Math.PI / 2), M(0, cy, cz, 0, 1, SY, 1, tilt), rib);
    b.add(tor(0.228, 0.05, 5, 16), M(0, cy + 0.005, cz, 0, 1, 1, 1, Math.PI / 2 + tilt), '#f3e6cc');
    b.add(sph(0.075, 7, 5), M(0, cy + R * SY * Math.cos(tilt) + 0.035, cz + R * SY * Math.sin(tilt)), '#f7eedb');
  } else if (kind === 'sun') {
    // a wide straw brim over the ears, a low crown, a teal band
    const tilt = -0.14;
    b.add(cyl(0.4, 0.42, 0.024, 24), M(0, 0.02, -0.02, 0, 1, 1, 1, tilt), '#e8cf8a');
    b.add(cyl(0.17, 0.19, 0.15, 16), M(0, 0.1, -0.03, 0, 1, 1, 1, tilt), '#e3c67d');
    b.add(sph(0.17, 16, 3, Math.PI / 2), M(0, 0.175, -0.04, 0, 1, 0.35, 1, tilt), '#e3c67d');
    b.add(cyl(0.195, 0.197, 0.045, 16), M(0, 0.055, -0.025, 0, 1, 1, 1, tilt), '#1f8f8a');
  } else {
    // a white sailor cap: a round crown, a navy band, a small black peak and a gold button
    const tilt = -0.1;
    b.add(cyl(0.2, 0.18, 0.13, 18), M(0, 0.06, -0.02, 0, 1, 1, 1, tilt), '#f4f1e6');
    b.add(cyl(0.225, 0.2, 0.035, 18), M(0, 0.14, -0.03, 0, 1, 1, 1, tilt), '#f7f5ee');
    b.add(cyl(0.185, 0.185, 0.04, 18), M(0, 0.015, -0.015, 0, 1, 1, 1, tilt), '#26374f');
    b.add(cyl(0.13, 0.13, 0.018, 14), M(0, 0.0, 0.13, 0, 1, 1, 0.7, tilt + 0.22), '#141d2b');
    b.add(sph(0.03, 6, 4), M(0, 0.02, 0.19, 0, 1, 1, 0.5), '#e0a94a');
  }
  return b.build();
}

const MESHES = new Map<HatKind, THREE.Mesh>();
/** The one mesh of a hat kind (built on first use, kept for the page). */
export function hatMesh(kind: HatKind): THREE.Mesh {
  let m = MESHES.get(kind);
  if (!m) {
    m = new THREE.Mesh(hatGeometry(kind), hatMaterial());
    m.name = `ob-hat-${kind}`;
    m.castShadow = false;
    m.receiveShadow = false;
    MESHES.set(kind, m);
  }
  return m;
}

/** The warm-up set (economy/wear.ts registers it): one plain Mesh like the real hats. */
export const hatWarmup = (): WarmupSet => meshWarmup(hatMaterial(), { geometry: hatMesh('beanie').geometry });

/** Triangles of a hat (tests: ≤ 420). */
export const hatTriangles = (kind: HatKind): number => { const g = hatMesh(kind).geometry; return (g.index ? g.index.count : g.getAttribute('position').count) / 3; };
