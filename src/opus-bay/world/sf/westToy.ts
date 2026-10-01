import * as THREE from 'three';
import type { Bilingual } from '../../core/types';
import { patchToyShader } from '../materials';
import { instancedWarmup, registerWarmup } from '../warmup';
import type { WorldSystem } from '../world';

/**
 * Wave 8 · lane W2 · the instanced toy pieces of the west side (westSea.ts: Ocean Beach / Seal Rocks; westLake.ts: the
 * boats on Blue Heron Lake). Nothing outside play/ may import play/ statically (tests/opus-bay-w5-play-acts W5-A1: play
 * stays out of GameRoot's graph), so this is play/toyMesh's recipe for a world system: ONE material instance per kind
 * on the tinted instanced toy program (customProgramCacheKey 'ob-toy-inst' — the city's trees and lamps link it
 * already: no new program), warmed when the kind's chunk loads; a unit ball painted per instance (instance colours),
 * aInfo.w −1: never dither-faded between the camera and the player.
 */

const materials = new Map<string, THREE.MeshStandardMaterial>();
/** The kind's own material on the instanced toy program. */
export function westToyMaterial(kind: string): THREE.MeshStandardMaterial {
  let m = materials.get(kind);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });
  m.name = `w8-west-${kind}`;
  m.onBeforeCompile = shader => { patchToyShader(shader, { sway: false }); };
  m.customProgramCacheKey = () => 'ob-toy-inst';
  materials.set(kind, m);
  return m;
}

/** The kind's warm-up set (register it as its chunk loads; the returned function unregisters). */
export function registerWestWarmup(kind: string): () => void {
  return registerWarmup(`w8-west-${kind}`, () => instancedWarmup(westToyMaterial(kind), { instanceColor: true }));
}

/**
 * The unit ball (an 80-face icosphere, diameter 1, non-indexed) with white vertex colours and the toy program's aInfo
 * (w −1); `jitter` > 0 moves every vertex sideways by a fixed ± jitter/2 of its distance from the axis (the same for the
 * copies of a vertex: still closed) and flattens the normals into facets — a rock's lumpy faces; the poles stay put.
 */
export function westBall(jitter = 0): THREE.BufferGeometry {
  const base = new THREE.IcosahedronGeometry(0.5, 1);
  const g = base.index ? base.toNonIndexed() : base;
  const pos = g.getAttribute('position') as THREE.BufferAttribute, n = pos.count;
  if (jitter > 0) {
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const h = Math.sin(Math.round(x * 997) * 12.9898 + Math.round(y * 991) * 78.233 + Math.round(z * 983) * 37.719) * 43758.5453;
      const j = 1 + jitter * (h - Math.floor(h) - 0.5);
      pos.setXYZ(i, x * j, y, z * j);
    }
    g.computeVertexNormals();
  }
  const info = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) info[i * 4 + 3] = -1;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  return g;
}

/** What the factory needs of a west-side scene: its mesh, its range, its pose and BAYBAY's spots. */
export interface WestInstancedSpec {
  /** the system's and the mesh's name (sf:<name>) */
  name: string;
  /** builds the mesh (count 0, painted, static parts posed) the first time the camera comes within range */
  build(): THREE.InstancedMesh;
  /** squared distance from the camera's (x, z) to the scene (a coarse test every 0.2 s) */
  dist2(x: number, z: number): number;
  /** the range (u) within which it draws */
  range: number;
  /** one frame: writes the instances, returns the count to draw */
  pose(mesh: THREE.InstancedMesh, t: number, night: number): number;
  /** BAYBAY's line for the player at (x, z), or null (westLines.westLineDue with the scene's spots) */
  line?(x: number, z: number, night: number, inside: Set<string>, said: ReadonlySet<string>, onFoot: boolean): { id: string; text: Bilingual } | null;
}

const CHECK_EVERY = 0.2;

/**
 * A city WorldSystem for one west-side instanced scene: built lazily, drawn only within range, posed every frame while
 * drawn, no shadows, no collision. BAYBAY: on entering one of its spots on foot / cycling / sitting she offers the line
 * through her pacer (game/cityContent baybayLine: it waits for the line she is saying and holds while a panel is open —
 * lane K's W8-K1), each line once a session.
 */
export function attachWestInstanced(spec: WestInstancedSpec, say: (text: Bilingual) => boolean, player: () => { x: number; z: number; afoot: boolean }): WorldSystem {
  const group = new THREE.Group();
  group.name = `sf:${spec.name}`;
  group.visible = false;
  let mesh: THREE.InstancedMesh | null = null;
  let next = 0, near = false;
  const said = new Set<string>(), inside = new Set<string>();
  return {
    name: spec.name,
    group,
    update(_dt, t, camera, night) {
      if (t >= next || t < next - 1) {
        next = t + CHECK_EVERY;
        const c = camera.position;
        near = spec.dist2(c.x, c.z) <= spec.range * spec.range;
        if (near && !mesh) { mesh = spec.build(); group.add(mesh); group.updateMatrixWorld(true); }
        group.visible = near && !!mesh;
        if (near && spec.line) {
          const p = player();
          const due = spec.line(p.x, p.z, night, inside, said, p.afoot);
          if (due && say(due.text)) said.add(due.id);
        }
      }
      if (!near || !mesh) return;
      mesh.count = spec.pose(mesh, t, night);
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { mesh?.geometry.dispose(); mesh?.dispose(); mesh = null; },
  };
}
