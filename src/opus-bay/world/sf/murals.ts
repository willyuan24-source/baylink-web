import * as THREE from 'three';
import { cityTerrain } from '../../core/terrain';
import { MURAL_ATLAS, MURAL_PANEL, MURAL_RANGE, MURAL_SITES, MURALS, type MuralDef } from '../../data/murals';
import { makeModelMaterial, type ModelMaterial } from '../modelMaterial';
import { registerWarmup } from '../warmup';
import type { WorldSystem } from '../world';
import type { CityStreamer } from './stream';

/**
 * Mission mural panels in the streamed city (lane H2b owns this file from wave 2; plan H2b-10). world/world.ts
 * enableCity calls attachMurals(streamer) once and adds the returned system; disableCity removes it.
 *
 * The eight boards of data/murals.ts are ONE mesh (one draw call, 96 triangles, + its shadow) on D2's model material
 * (the TOY look on a texture — contact AO, the occlusion dither, Karl the Fog, the night level — with no mask, so no
 * tint and no windows; muralMaterial), a faint night glow so the paint still reads under the street lamps. Nothing is fetched or
 * built until the camera comes within MURAL_RANGE of an alley: then the atlas (≈ 250 KB) loads, and the mesh is built
 * once the terrain under every board is streamed in (the boards stand on the ground, sunk MURAL_PANEL.sink). The group
 * hides again beyond the range; the texture and mesh stay for the session (a second visit costs nothing).
 * Warm-up: 'ob-murals' compiles the same program (model material, non-hero, plain Mesh: one program of its own) on a
 * board built exactly like the real one.
 */

/** night glow of the paint (TOY glow code, (0, 1] = at night only): a hint of lamplight, so the boards read at night
 * without standing out bright against the dark walls (0.12 looked like daylight) */
export const MURAL_GLOW = 0.015;
const CHECK_EVERY = 0.5;

/**
 * The boards as one geometry (pure: node tests). `ys[i]` = the ground height under board i. Each board is a box
 * (24 vertices, 12 triangles): the painted face shows the mural's atlas rect upright, the back the same mural (a
 * double-sided board; it faces the wall), the four edges a thin strip of the art's border.
 */
export function muralGeometry(defs: readonly MuralDef[], ys: readonly number[]): THREE.BufferGeometry {
  const { height: H, thick: T, sink } = MURAL_PANEL;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const quad = (p: THREE.Vector3[], n: THREE.Vector3, q: [number, number][]) => {
    const base = pos.length / 3;
    for (let i = 0; i < 4; i++) { pos.push(p[i].x, p[i].y, p[i].z); nor.push(n.x, n.y, n.z); uv.push(q[i][0], q[i][1]); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  defs.forEach((m, i) => {
    const W = m.at.width, { u0, v0, u1, v1 } = m.rect;
    const du = (u1 - u0) * 0.02, dv = (v1 - v0) * 0.02;
    const mat = new THREE.Matrix4().compose(new THREE.Vector3(m.at.x, ys[i] - sink, m.at.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), m.at.yaw), new THREE.Vector3(1, 1, 1));
    const nm = new THREE.Matrix3().getNormalMatrix(mat);
    const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(mat);
    const N = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix3(nm).normalize();
    const x0 = -W / 2, x1 = W / 2, y0 = 0, y1 = H, zf = T / 2, zb = -T / 2;
    // front (+z): counter-clockwise seen from the front, u along +x
    quad([P(x0, y0, zf), P(x1, y0, zf), P(x1, y1, zf), P(x0, y1, zf)], N(0, 0, 1), [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
    // back (−z): seen from behind +x is on the left, so u runs along −x (the mural reads the right way round)
    quad([P(x1, y0, zb), P(x0, y0, zb), P(x0, y1, zb), P(x1, y1, zb)], N(0, 0, -1), [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
    // edges: the art's border strip
    quad([P(x0, y1, zf), P(x1, y1, zf), P(x1, y1, zb), P(x0, y1, zb)], N(0, 1, 0), [[u0, v1 - dv], [u1, v1 - dv], [u1, v1], [u0, v1]]);
    quad([P(x0, y0, zb), P(x1, y0, zb), P(x1, y0, zf), P(x0, y0, zf)], N(0, -1, 0), [[u0, v0], [u1, v0], [u1, v0 + dv], [u0, v0 + dv]]);
    quad([P(x1, y0, zf), P(x1, y0, zb), P(x1, y1, zb), P(x1, y1, zf)], N(1, 0, 0), [[u1 - du, v0], [u1, v0], [u1, v1], [u1 - du, v1]]);
    quad([P(x0, y0, zb), P(x0, y0, zf), P(x0, y1, zf), P(x0, y1, zb)], N(-1, 0, 0), [[u0, v0], [u0 + du, v0], [u0 + du, v1], [u0, v1]]);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** The ground under a board: the lowest of its two ends and its middle, or null while the terrain is not streamed in. */
export function boardGround(m: MuralDef, heightAt: (x: number, z: number) => number | null): number | null {
  const ax = Math.cos(m.at.yaw) * m.at.width * 0.5, az = -Math.sin(m.at.yaw) * m.at.width * 0.5;
  let y = Infinity;
  for (const f of [-1, 0, 1]) {
    const h = heightAt(m.at.x + ax * f, m.at.z + az * f);
    if (h === null || !Number.isFinite(h)) return null;
    y = Math.min(y, h);
  }
  return y;
}

/** Nearest mural site to (x, z), squared distance (u²). */
export function muralSiteDist2(x: number, z: number): number {
  let best = Infinity;
  for (const s of Object.values(MURAL_SITES)) best = Math.min(best, (s.x - x) ** 2 + (s.z - z) ** 2);
  return best;
}

/**
 * D2's model material in its non-hero variant on a plain Mesh (it reads the uObInst uniform there): no OB_HERO, so the
 * TOY per-fragment occlusion dither applies — a board between the camera and the player melts like a wall does (in the
 * narrow alleys the camera often stands behind one). Occupancy 0 (no windows), fade 1, seed 0, glow MURAL_GLOW.
 */
function muralMaterial(map: THREE.Texture, name: string): ModelMaterial {
  return makeModelMaterial({ map, variant: 'ob-model-inst', inst: [0, 1, 0, MURAL_GLOW], name });
}

function boardMesh<M extends THREE.Material>(geo: THREE.BufferGeometry, mat: M) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'ob-murals';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

// warm-up (plan §5.5): a board built like the real ones (plain Mesh, a map, cast + receive shadow); its material stays
// alive for the session so the compiled program is never thrown away (see world/modelMaterial.ts warmMaterials)
let warmMat: ModelMaterial | null = null;
registerWarmup('ob-murals', () => {
  if (!warmMat) {
    const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    warmMat = muralMaterial(map, 'ob-murals:warmup');
  }
  const geo = muralGeometry(MURALS.slice(0, 1), [0]);
  return { objects: [boardMesh(geo, warmMat)], dispose: () => geo.dispose() };
});

export function attachMurals(streamer: CityStreamer): WorldSystem | null {
  const url = MURAL_ATLAS;
  if (!streamer || !url || MURALS.length === 0) return null;
  const group = new THREE.Group();
  group.name = 'ob-murals';
  group.visible = false;
  let texture: THREE.Texture | null = null;
  let loading = false;
  let mesh: THREE.Mesh<THREE.BufferGeometry, ModelMaterial> | null = null;
  let disposed = false;
  let nextCheck = 0;

  const load = () => {
    loading = true;
    new THREE.TextureLoader().load(url, tex => {
      if (disposed) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      texture = tex;
    }, undefined, () => { loading = false; });
  };

  const build = () => {
    const terrain = cityTerrain();
    if (!texture || !terrain) return;
    const ys: number[] = [];
    for (const m of MURALS) {
      // the chunk itself (2 u DEM), not the far 16 u DEM heightAt falls back to while it streams in
      if (terrain.standAt(m.at.x, m.at.z) === -1) return;
      const y = boardGround(m, (x, z) => terrain.heightAt(x, z));
      if (y === null) return;
      ys.push(y);
    }
    const built = boardMesh(muralGeometry(MURALS, ys), muralMaterial(texture, 'ob-murals'));
    group.add(built);
    mesh = built;
  };

  return {
    name: 'murals',
    group,
    update(_dt, t, camera) {
      if (t < nextCheck) return;
      nextCheck = t + CHECK_EVERY;
      const near = muralSiteDist2(camera.position.x, camera.position.z) <= MURAL_RANGE * MURAL_RANGE;
      if (near && !texture && !loading) load();
      if (near && texture && !mesh) build();
      group.visible = near && !!mesh;
    },
    dispose() {
      disposed = true;
      if (mesh) { group.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
      texture?.dispose();
      mesh = null;
      texture = null;
    },
  };
}
