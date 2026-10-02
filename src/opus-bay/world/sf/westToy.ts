import * as THREE from 'three';
import type { Bilingual } from '../../core/types';
import { patchToyShader } from '../materials';
import { instancedWarmup, registerWarmup } from '../warmup';
import type { WorldSystem } from '../world';
import { atSpot, westVisits, type WestLine, type WestSpot, type WestVisits } from './westLines';

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

/** (W8-W2-review: the unit ball lives in westBall.ts, so westSeaPose can measure the drawn rock without an import cycle) */
export { westBall } from './westBall';

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
  /** BAYBAY's spots round the scene (westLines.ts) */
  spots?: readonly WestSpot[];
}

/** What BAYBAY's pacer gets with a place line (game/cityContent baybayLine's `valid` / `onSay`). */
export interface WestSayHooks { valid: () => boolean; onSay: () => void }

const CHECK_EVERY = 0.2;

/**
 * A city WorldSystem for one west-side instanced scene: built lazily, drawn only within range, posed every frame while
 * drawn, no shadows, no collision. BAYBAY: on entering one of its spots on foot / cycling / sitting the visit gets the
 * spot's next line (westLines.westVisits); it is offered through her pacer (game/cityContent baybayLine: it waits for
 * the line she is saying and holds while a panel is open, lane K's W8-K1) and offered again at every check while the
 * visit lasts (the pacer keeps one copy and extends its ttl), so a line held behind a long card is said when the card
 * closes. W8-W2-review: the pacer drops it the moment the player is no longer at the spot (`valid`, P1: never said over
 * another place after a fast travel), and it counts as said only when BAYBAY says it (`onSay`, P3: a dropped line comes
 * again on the next visit). Each line once a session.
 */
export function attachWestInstanced(spec: WestInstancedSpec, say: (text: Bilingual, hooks: WestSayHooks) => boolean, player: () => { x: number; z: number; afoot: boolean }): WorldSystem {
  const group = new THREE.Group();
  group.name = `sf:${spec.name}`;
  group.visible = false;
  let mesh: THREE.InstancedMesh | null = null;
  let next = 0, near = false;
  const said = new Set<string>(), visits: WestVisits = new Map();
  // one pair of hooks per spot and line, made once (the checks allocate nothing)
  const hooks = new Map<string, WestSayHooks>();
  const hooksFor = (s: WestSpot, l: WestLine): WestSayHooks => {
    const key = `${s.id}|${l.id}`;
    let h = hooks.get(key);
    if (!h) {
      h = {
        valid: () => { const p = player(); return p.afoot && visits.get(s.id) === l && atSpot(s, p.x, p.z); },
        onSay: () => { said.add(l.id); },
      };
      hooks.set(key, h);
    }
    return h;
  };
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
        if (near && spec.spots) {
          const p = player();
          westVisits(p.x, p.z, night, visits, said, p.afoot, spec.spots);
          for (const s of spec.spots) {
            const l = visits.get(s.id);
            if (l && !said.has(l.id)) say(l.text, hooksFor(s, l));
          }
        } else if (!near) visits.clear(); // (C3: far from every spot, e.g. after a fast travel: every visit ends)
      }
      if (!near || !mesh) return;
      mesh.count = spec.pose(mesh, t, night);
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { mesh?.geometry.dispose(); mesh?.dispose(); mesh = null; },
  };
}
