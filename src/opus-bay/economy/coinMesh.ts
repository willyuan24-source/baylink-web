import * as THREE from 'three';
import { patchToyShader } from '../world/materials';
import { instancedWarmup, type WarmupSet } from '../world/warmup';
import { CACHE_STACK, type CoinItem } from './coins';

/**
 * Wave 5 · lane E · W5-E3: the coins on screen — ONE InstancedMesh (≤ 32 instances × 48 triangles = 1.5k, one draw call
 * while any coin is near, none otherwise), mounted through game/systemsRegistry registerSceneSystem('e-coins').
 *
 * - The disc: 12 segments, a bright centre fading to the gold rim (#e0a94a) and a darker edge; slightly self-lit
 *   (aInfo.w 1.25) so it reads by day and glints at night.
 * - Material: our own instance of the TOY_INST program (same onBeforeCompile and cache key as world/materials
 *   TOY_INST, the chevrons' recipe): no new program; receiveShadow on / castShadow off like the warmed prop dummies.
 *   Registered with the warm-up all the same ('e-coins') so the instance is compiled off the frame.
 * - Motion on the CPU at ≤ 30 Hz (no shader change): ground coins turn and bob 0.8 u up; ring coins turn in place,
 *   1.6 × larger; a cache is a small stack of four with one coin turning over it; a picked coin pops up and shrinks
 *   in 0.35 s.
 */

const R = 0.42, H = 0.09, SEG = 12;
const GOLD = new THREE.Color('#e0a94a'), LIGHT = new THREE.Color('#f7d78a'), EDGE = new THREE.Color('#b07a2a');

/** The coin disc: faces along ±z (a coin standing up, facing +z), 12 segments, 48 triangles. */
export function coinGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], nrm: number[] = [], col: number[] = [], idx: number[] = [];
  const v = (x: number, y: number, z: number, nx: number, ny: number, nz: number, c: THREE.Color) => { pos.push(x, y, z); nrm.push(nx, ny, nz); col.push(c.r, c.g, c.b); return pos.length / 3 - 1; };
  for (const side of [1, -1]) {
    const c0 = v(0, 0, (side * H) / 2, 0, 0, side, LIGHT);
    const rim: number[] = [];
    for (let i = 0; i < SEG; i++) { const a = (i / SEG) * Math.PI * 2; rim.push(v(Math.cos(a) * R, Math.sin(a) * R, (side * H) / 2, 0, 0, side, GOLD)); }
    for (let i = 0; i < SEG; i++) { const a = rim[i], b = rim[(i + 1) % SEG]; if (side > 0) idx.push(c0, a, b); else idx.push(c0, b, a); }
  }
  const ring: [number, number][] = [];
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2, x = Math.cos(a), y = Math.sin(a);
    ring.push([v(x * R, y * R, H / 2, x, y, 0, EDGE), v(x * R, y * R, -H / 2, x, y, 0, EDGE)]);
  }
  for (let i = 0; i < SEG; i++) { const [a, b] = ring[i], [c, d] = ring[(i + 1) % SEG]; idx.push(a, b, c, c, b, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aInfo', new THREE.Float32BufferAttribute(pos.flatMap((_, i) => (i % 3 === 0 ? [0, 0, 0, 1.25] : [])), 4));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Our own instance of the TOY_INST program (world/materials makeToy 'ob-toy-inst'): warmed at boot, no new program. */
export function coinMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  m.name = 'ob-coins';
  m.onBeforeCompile = shader => { patchToyShader(shader, { sway: false }); };
  m.customProgramCacheKey = () => 'ob-toy-inst';
  return m;
}

export function makeMesh(geo: THREE.BufferGeometry, mat: THREE.Material, n: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.name = 'ob-coins';
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

/**
 * The ONE material instance and geometry of the coin mesh (world/warmup.ts recipe, W5-V6: one instance per object kind,
 * the warm-up object built from the same instance): made on first use, kept for the page (small; never disposed).
 */
let MAT: THREE.MeshStandardMaterial | null = null, GEO: THREE.BufferGeometry | null = null;
export const coinMat = (): THREE.MeshStandardMaterial => (MAT ??= coinMaterial());
export const coinGeo = (): THREE.BufferGeometry => (GEO ??= coinGeometry());

/** The warm-up set (registered by coins.ts initCoins): one InstancedMesh like the real one — no instance colour, no cast shadow. */
export const coinWarmup = (): WarmupSet => instancedWarmup(coinMat(), { geometry: coinGeo(), receiveShadow: true });

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
const phaseOf = (c: CoinItem) => (c.x * 0.37 + c.z * 0.61) % (Math.PI * 2);

/** Write coin `c`'s instance(s) from `k` on; returns the next free index. `pop` 0..1 while it is being picked up. */
export function writeCoin(mesh: THREE.InstancedMesh, k: number, c: CoinItem, t: number, pop = -1): number {
  const ph = phaseOf(c);
  const spin = t * 2.4 + ph;
  if (pop >= 0) {
    const s = (1 - pop) * (c.kind === 'ring' ? 1.6 : 1.1) + 0.05;
    P.set(c.x, c.y + (c.air ? 0 : 0.8) + pop * 1.4, c.z);
    Q.setFromEuler(E.set(0, spin * 3, 0));
    mesh.setMatrixAt(k, M.compose(P, Q, S.setScalar(s)));
    return k + 1;
  }
  if (c.kind === 'cache') {
    const base = c.air ? c.y - 0.6 : c.y;
    for (let i = 0; i < CACHE_STACK - 1; i++) {
      P.set(c.x + Math.sin(ph + i * 2.1) * 0.08, base + 0.05 + i * 0.095, c.z + Math.cos(ph + i * 2.1) * 0.08);
      Q.setFromEuler(E.set(Math.PI / 2, 0, ph + i * 0.7));
      mesh.setMatrixAt(k++, M.compose(P, Q, S.setScalar(1.1)));
    }
    P.set(c.x, base + 1.15 + Math.sin(t * 2 + ph) * 0.1, c.z);
    Q.setFromEuler(E.set(0, spin, 0));
    mesh.setMatrixAt(k++, M.compose(P, Q, S.setScalar(1.25)));
    return k;
  }
  if (c.kind === 'ring') {
    P.set(c.x, c.y, c.z);
    Q.setFromEuler(E.set(0, c.yaw + Math.sin(t * 1.6 + ph) * 0.6, 0));
    mesh.setMatrixAt(k, M.compose(P, Q, S.setScalar(1.6)));
    return k + 1;
  }
  P.set(c.x, c.y + 0.8 + Math.sin(t * 2.2 + ph) * 0.08, c.z);
  Q.setFromEuler(E.set(0, spin, 0));
  mesh.setMatrixAt(k, M.compose(P, Q, S.setScalar(1)));
  return k + 1;
}

