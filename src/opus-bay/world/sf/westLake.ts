import * as THREE from 'three';
import { baybayLine } from '../../game/cityContent';
import type { WorldSystem } from '../world';
import { LAKE_SPOTS } from './westLines';
import { LAKE_CAPACITY, LAKE_CENTRE, paintLake, poseLake } from './westLakePose';
import { westPlayer } from './westSea';
import { attachWestInstanced, registerWestWarmup, westBall, westToyMaterial } from './westToy';

/**
 * Wave 8 · lane W2 · Blue Heron Lake's boats (world/sf/westLakePose.ts has the data, the facts and the poses), city mode
 * only: ONE InstancedMesh of the smooth toy ball on the instanced toy program (no new program) — +1 draw call, ≈ 6k
 * triangles, drawn only while the camera is within LAKE_RANGE of the lake. Nine boats potter round the lake's wide
 * basins by day, three are moored at the boathouse's landing, three ducks paddle, a great blue heron stands on the
 * island's shore. Scenery only: no rental ride (sf-w8-W2.md part b, Decisions).
 */

export const LAKE_KIND = 'west-lake';
/** the camera's distance (u) to the lake's centre within which the mesh draws (the lake is ≈ 70 u across) */
export const LAKE_RANGE = 200;

registerWestWarmup(LAKE_KIND);

export function lakeDist2(x: number, z: number): number {
  return (x - LAKE_CENTRE.x) ** 2 + (z - LAKE_CENTRE.z) ** 2;
}

/** The mesh (count 0 until the first frame), every instance painted. */
export function buildLake(): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(westBall(0), westToyMaterial(LAKE_KIND), LAKE_CAPACITY);
  mesh.name = 'sf:west-lake';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.count = 0;
  paintLake(mesh);
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** City mode: the lake's boats as a world system (world/sf/cityWorld.ts adds it). */
export function attachWestLake(): WorldSystem {
  return attachWestInstanced({
    name: 'west-lake',
    build: buildLake,
    dist2: lakeDist2,
    range: LAKE_RANGE,
    pose: (mesh, t, night) => poseLake(mesh, t, night),
    spots: LAKE_SPOTS,
  }, (text, hooks) => baybayLine(text, { ttl: 25, ...hooks }), westPlayer);
}
