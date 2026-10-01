import * as THREE from 'three';
import { runtime } from '../../core/runtime';
import { game } from '../../core/store';
import { baybayLine } from '../../game/cityContent';
import type { WorldSystem } from '../world';
import { WEST_SPOTS } from './westLines';
import { attachWestInstanced, registerWestWarmup, westBall, westToyMaterial } from './westToy';
import { ROCK_JITTER } from './westBall';
import { OB_SHORE, SEAL_ROCKS_CENTRE, WEST_SEA_CAPACITY, paintWestSea, poseRocks, poseWestSea } from './westSeaPose';

/**
 * Wave 8 · lane W2 · Ocean Beach's surfers and Seal Rocks (world/sf/westSeaPose.ts has the data, the facts and the
 * poses), city mode only: ONE InstancedMesh of the toy ball on the tinted instanced toy program (westToy.ts, 'ob-toy-inst':
 * the city's trees and lamps link it already, no new program) — +1 draw call, ≈ 12k triangles, drawn only while the camera is
 * within WEST_RANGE of the beach or the rocks, built the first time it comes that close. The stacks, the sea lions, the
 * cormorants, the gulls and the break stay at night; the surfers go home at dusk. No collision (all of it is at sea).
 *
 * BAYBAY (westLines.ts): on foot (or cycling, or sitting on a bench) near the surf by day, or above Seal Rocks, she says
 * one of her fixed lines through her pacer (game/cityContent baybayLine: it holds while a panel is open, lane K's
 * W8-K1), once per visit and at most once a session per line.
 */

export const WEST_SEA_KIND = 'west-sea';
/** the camera's distance (u) to the beach or the rocks within which the mesh draws */
export const WEST_RANGE = 420;

registerWestWarmup(WEST_SEA_KIND);

/** squared distance from (x, z) to the nearest waterline vertex or the rocks (a coarse range test, every 0.2 s) */
export function westSeaDist2(x: number, z: number): number {
  let best = (x - SEAL_ROCKS_CENTRE.x) ** 2 + (z - SEAL_ROCKS_CENTRE.z) ** 2;
  for (const p of OB_SHORE) best = Math.min(best, (x - p.x) ** 2 + (z - p.z) ** 2);
  return best;
}

/**
 * The shared shape: the toy unit ball (an 80-face icosphere) with a fixed sideways jitter of each vertex (± 9 % of its
 * distance from the axis) and flat facets — a rock's lumpy faces on the stacks; on the small parts (heads, boards, foam)
 * the jitter is too small to see. The poles stay put, so westSeaPose.rockTop (the true ellipsoid) is where the summits are.
 */
export const rockBall = (): THREE.BufferGeometry => westBall(ROCK_JITTER);

/** The mesh (count 0 until the first frame); the stacks posed and every instance painted. */
export function buildWestSea(): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(rockBall(), westToyMaterial(WEST_SEA_KIND), WEST_SEA_CAPACITY);
  mesh.name = 'sf:west-sea';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.count = 0;
  paintWestSea(mesh);
  poseRocks(mesh);
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** City mode: the west side's sea life as a world system (world/sf/cityWorld.ts adds it). */
export function attachWestSea(): WorldSystem {
  return attachWestInstanced({
    name: 'west-sea',
    build: buildWestSea,
    dist2: westSeaDist2,
    range: WEST_RANGE,
    pose: (mesh, t, night) => poseWestSea(mesh, t, night),
    spots: WEST_SPOTS,
  }, (text, hooks) => baybayLine(text, { ttl: 25, ...hooks }), westPlayer);
}

/** the player for BAYBAY's spot test: where, and out walking (on foot, cycling or sitting on a bench — not on a ride) */
export function westPlayer() {
  const mode = game.get().move.mode;
  return { x: runtime.player.x, z: runtime.player.z, afoot: mode === 'foot' || mode === 'bike' || mode === 'sit' };
}
