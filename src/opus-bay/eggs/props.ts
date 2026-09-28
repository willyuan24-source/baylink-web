import * as THREE from 'three';
import { runtime } from '../core/runtime';
import { heightAt } from '../core/terrain';
import { BOX, C, CONE, CYL, Frame, ICO } from '../world/builder';
import { patchToyShader } from '../world/materials';
import { TypedBatch } from '../world/typedBatch';
import { registerWarmup } from '../world/warmup';

/**
 * Wave 5 · lane D (W5-D2) · the eggs' things in the world, at most one draw call each and only near the player:
 *
 *   the prop pool   ONE plain Mesh whose geometry is the props within PROP_RANGE of the player, merged (≤ 200 triangles
 *                   a prop), rebuilt only when that set changes (checked at 2 Hz); hidden (0 calls) when none is near.
 *                   Props stand off the walk line and never block: nothing here is a collider.
 *   the flock       two small InstancedMeshes (parrots, pelicans), drawn only while a flight is on (+1 call, transient)
 *
 * Materials: our own instances (never shared with another object kind) running the SAME programs as TOY_DYN (plain
 * mesh) and TOY_INST (instanced, no instanceColor) — same onBeforeCompile, same cache key, same flags as the warm-up's
 * dummies — and registered with world/warmup.ts so they link before they are first seen.
 *
 * Downtown (the Ferry gate, Chinatown, the Financial District, Union Square) gets no new geometry until lane V publishes
 * the measured headroom (plan MF9 / D15): `DOWNTOWN_PROPS_HELD` keeps those props out of the pool (their eggs still work
 * through the prompt, the sound and the card).
 */

export type PropKind = 'decree' | 'tin' | 'windsock' | 'cookie';
export interface PropSpec { kind: PropKind; x: number; z: number; heading?: number; /** world y; default: the ground */ y?: number }

/** Props within this distance of the player are in the pool (u). */
export const PROP_RANGE = 110;
/** Downtown's box (city frame): the hero waterfront by the Ferry Building, the Financial District, Chinatown, Union Square. */
export const DOWNTOWN = { minX: -5, maxX: 330, minZ: -70, maxZ: 300 } as const;
/** true until lane V's downtown headroom is published (then the lead flips it). */
export const DOWNTOWN_PROPS_HELD = true;
export const isDowntown = (x: number, z: number) => x >= DOWNTOWN.minX && x <= DOWNTOWN.maxX && z >= DOWNTOWN.minZ && z <= DOWNTOWN.maxZ;

function toyMaterial(key: 'ob-toy-dyn' | 'ob-toy-inst', name: string): THREE.MeshStandardMaterial {
  // exactly world/materials.ts makeToy({ sway: false }) (the programs are shared by key: the patch must be identical)
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  m.name = name;
  m.onBeforeCompile = shader => { patchToyShader(shader, { sway: false }); };
  m.customProgramCacheKey = () => key;
  return m;
}

// --- the prop recipes (local frame: origin on the ground, +z = the prop's facing) ---------------------------------

type Recipe = (b: TypedBatch, f: Frame) => void;

const RECIPES: Readonly<Record<PropKind, Recipe>> = {
  // Emperor Norton's proclamation: a slim post, a rolled parchment with its knobs, a little crown on top (≈ 110 tris)
  decree: (b, f) => {
    b.add(CYL(6), f.at(0, 0, 0, 0, 0.06, 1.9, 0.06), C('#35584a'));
    b.add(CYL(8), f.at(-0.32, 1.35, 0.09, 0, 0.1, 0.64, 0.1, 0, Math.PI / 2), C('#f1e3c2'));
    b.add(BOX(), f.at(0, 0.88, 0.1, 0, 0.56, 0.5, 0.02), C('#f6ecd3'));
    b.add(BOX(), f.at(-0.37, 1.3, 0.09, 0, 0.06, 0.1, 0.12), C('#8d5b2f'));
    b.add(BOX(), f.at(0.37, 1.3, 0.09, 0, 0.06, 0.1, 0.12), C('#8d5b2f'));
    b.add(BOX(), f.at(0, 1.02, 0.115, 0, 0.12, 0.12, 0.02), C('#b8322e'));
    b.add(BOX(), f.at(0, 1.9, 0, 0, 0.26, 0.07, 0.26), C('#e2b43b'));
    for (const x of [-0.09, 0, 0.09]) b.add(CONE(4), f.at(x, 1.97, 0, Math.PI / 4, 0.05, 0.12, 0.05), C('#f0c64a'));
  },
  // the Octagon House time capsule: a round tin with its lid (≈ 80 tris)
  tin: (b, f) => {
    b.add(CYL(10), f.at(0, 0, 0, 0, 0.3, 0.33, 0.3), C('#8f9a9c'));
    b.add(CYL(10), f.at(0, 0.33, 0, 0, 0.32, 0.07, 0.32), C('#6f7a7d'));
    b.add(BOX(), f.at(0, 0.14, 0.29, 0, 0.26, 0.09, 0.02), C('#c9b98f'));
  },
  // Crissy Field's toy windsock: a pole and a striped sock streaming west (≈ 90 tris)
  windsock: (b, f) => {
    b.add(CYL(6), f.at(0, 0, 0, 0, 0.05, 3.1, 0.05), C('#e9e4da'));
    const stripes = ['#e0533c', '#f3efe6', '#e0533c'];
    stripes.forEach((col, i) => b.add(CYL(8, 0.8, true), f.at(0.18 + i * 0.36, 2.85, 0, 0, 0.26 - i * 0.05, 0.36, 0.26 - i * 0.05, 0, -Math.PI / 2), C(col)));
    b.add(BOX(), f.at(0, 3.05, 0, 0, 0.12, 0.08, 0.12), C('#3d3d3d'));
  },
  // the Tea Garden's fortune cookie: a small wooden stand, a cookie, its paper slip (≈ 50 tris)
  cookie: (b, f) => {
    b.add(BOX(), f.at(0, 0, 0, 0, 0.5, 0.7, 0.36), C('#7a4e2d'));
    b.add(BOX(), f.at(0, 0.7, 0, 0, 0.56, 0.05, 0.42), C('#5f3a1f'));
    b.add(ICO(0), f.at(0, 0.9, 0, 0.6, 0.24, 0.16, 0.18), C('#e7b35f'));
    b.add(BOX(), f.at(0.16, 0.8, 0.1, 0.4, 0.34, 0.012, 0.08), C('#fbf7ee'));
  },
};

/** The triangles a prop adds (tests: ≤ 200 each). */
export function propTriangles(kind: PropKind): number {
  const b = new TypedBatch(256);
  RECIPES[kind](b, new Frame(0, 0, 0));
  return b.triangleCount;
}

// --- the pool --------------------------------------------------------------------------------------------------

interface PropEntry { key: string; spec: PropSpec; y: number }

/**
 * A real prop geometry for the hidden pool: the world's warm-up passes compile hidden meshes too, and an empty geometry
 * (no normal attribute) would link a flat-shaded program of its own (one extra program); a real one keeps TOY_DYN's.
 */
function idleGeometry(): THREE.BufferGeometry {
  const b = new TypedBatch(64);
  RECIPES.tin(b, new Frame(0, -50, 0));
  return TypedBatch.toGeometry(b.toArrays());
}

export class PropPool {
  readonly mesh: THREE.Mesh;
  private readonly props = new Map<string, PropEntry>();
  private shown = '';
  private dirty = true;
  private next = 0;
  private readonly idle = idleGeometry();

  constructor() {
    this.mesh = new THREE.Mesh(this.idle, toyMaterial('ob-toy-dyn', 'ob-egg-props'));
    this.mesh.name = 'ob-egg-props';
    this.mesh.visible = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
  }

  /** Place (or move) a prop under `key`; null removes it. Held downtown while DOWNTOWN_PROPS_HELD. */
  set(key: string, spec: PropSpec | null): void {
    if (!spec || (DOWNTOWN_PROPS_HELD && isDowntown(spec.x, spec.z))) {
      if (this.props.delete(key)) this.dirty = true;
      return;
    }
    const prev = this.props.get(key);
    if (prev && prev.spec.kind === spec.kind && prev.spec.x === spec.x && prev.spec.z === spec.z && prev.spec.heading === spec.heading && prev.spec.y === spec.y) return;
    this.props.set(key, { key, spec, y: spec.y ?? heightAt(spec.x, spec.z) });
    this.dirty = true;
  }

  has(key: string): boolean { return this.props.has(key); }

  /** The keys drawn now (QA / tests). */
  visibleKeys(): string[] { return this.shown ? this.shown.split('|') : []; }

  /** ≈ 2 Hz: rebuild when the set within range of (x, z) changed. */
  step(now: number, x = runtime.player.x, z = runtime.player.z): void {
    if (now < this.next && !this.dirty) return;
    this.next = now + 0.5;
    const near = [...this.props.values()].filter(p => (p.spec.x - x) ** 2 + (p.spec.z - z) ** 2 < PROP_RANGE * PROP_RANGE).sort((a, b) => (a.key < b.key ? -1 : 1));
    const sig = near.map(p => p.key).join('|');
    if (sig === this.shown && !this.dirty) return;
    this.dirty = false;
    this.shown = sig;
    if (this.mesh.geometry !== this.idle) this.mesh.geometry.dispose();
    if (!near.length) { this.mesh.geometry = this.idle; this.mesh.visible = false; return; }
    const b = new TypedBatch(near.length * 160);
    for (const p of near) RECIPES[p.spec.kind](b, new Frame(p.spec.x, p.y, p.spec.z, p.spec.heading ?? 0));
    const geo = TypedBatch.toGeometry(b.toArrays());
    geo.computeBoundingSphere();
    this.mesh.geometry = geo;
    this.mesh.visible = true;
  }

  dispose(): void {
    if (this.mesh.geometry !== this.idle) this.mesh.geometry.dispose();
    this.idle.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.props.clear();
  }
}

// --- the flock -------------------------------------------------------------------------------------------------

export type FlockKind = 'parrot' | 'pelican';
const FLOCK_MAX = 16;

function birdGeometry(kind: FlockKind): THREE.BufferGeometry {
  const b = new TypedBatch(256);
  // toy scale: a parrot about a third of the player's height, a pelican with a 3 u span (they read from the follow camera)
  const f = new Frame(0, 0, 0, 0, kind === 'parrot' ? 1.5 : 1.35);
  if (kind === 'parrot') {
    // red-masked conure: green body and long tail, red face, pale beak
    b.add(BOX(), f.at(0, -0.08, 0, 0, 0.16, 0.16, 0.34), C('#3f9b3a'));
    b.add(BOX(), f.at(0, -0.02, 0.2, 0, 0.13, 0.13, 0.13), C('#d8412f'));
    b.add(BOX(), f.at(0, -0.01, 0.29, 0, 0.05, 0.05, 0.06), C('#efe2c4'));
    b.add(BOX(), f.at(0, -0.07, -0.3, 0, 0.07, 0.03, 0.3), C('#2f7d44'));
    b.add(BOX(), f.at(-0.24, -0.01, 0, 0, 0.34, 0.03, 0.16), C('#52ad45'));
    b.add(BOX(), f.at(0.24, -0.01, 0, 0, 0.34, 0.03, 0.16), C('#52ad45'));
  } else {
    // brown pelican: grey-brown body and wings, pale head, long orange-yellow bill
    // a rounded body lying along +z, the head up front, the long bill, wings in two tapered parts with a slight lift
    b.add(CYL(7), f.at(0, -0.12, -0.42, 0, 0.17, 0.84, 0.15, Math.PI / 2), C('#8a7a68'));
    b.add(ICO(0), f.at(0, 0.02, 0.5, 0, 0.13, 0.13, 0.14), C('#efe0b8'));
    b.add(CONE(4), f.at(0, -0.02, 0.58, Math.PI / 4, 0.05, 0.5, 0.05, Math.PI / 2), C('#e0a24a'));
    for (const s of [-1, 1]) {
      b.add(BOX(), f.at(s * 0.42, -0.07, 0, 0, 0.62, 0.03, 0.34, 0, s * 0.12), C('#6a5b4d'));
      b.add(BOX(), f.at(s * 1.0, 0.0, -0.04, s * -0.12, 0.62, 0.025, 0.24, 0, s * 0.2), C('#4f443a'));
    }
    b.add(CONE(4), f.at(0, -0.12, -0.44, Math.PI / 4, 0.1, 0.24, 0.05, -Math.PI / 2), C('#5b4e42'));
  }
  return TypedBatch.toGeometry(b.toArrays());
}

/** One bird's plan: a function of time since the flight began → pose, or null once it has left. */
export interface BirdPose { x: number; y: number; z: number; heading: number; flap: number }
export type BirdPath = (t: number, i: number) => BirdPose | null;

export class Flock {
  readonly group = new THREE.Group();
  private readonly meshes: Record<FlockKind, THREE.InstancedMesh>;
  private readonly material = toyMaterial('ob-toy-inst', 'ob-egg-flock');
  private flight: { kind: FlockKind; n: number; path: BirdPath; t: number; until: number } | null = null;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  constructor() {
    this.group.name = 'ob-egg-flock';
    this.meshes = {
      parrot: this.make('parrot'),
      pelican: this.make('pelican'),
    };
  }

  private make(kind: FlockKind): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(birdGeometry(kind), this.material, FLOCK_MAX);
    mesh.name = `ob-egg-${kind}s`;
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    // the warm-up's TOY_INST dummy receives shadows: the same flag keeps the same program
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  get active(): FlockKind | null { return this.flight?.kind ?? null; }

  /** Fly `n` birds of `kind` along `path` for `seconds` (a new flight replaces the old one). */
  start(kind: FlockKind, n: number, seconds: number, path: BirdPath): void {
    this.stop();
    this.flight = { kind, n: Math.max(1, Math.min(FLOCK_MAX, n)), path, t: 0, until: seconds };
    this.meshes[kind].visible = true;
  }

  stop(): void {
    if (!this.flight) return;
    const mesh = this.meshes[this.flight.kind];
    mesh.count = 0;
    mesh.visible = false;
    this.flight = null;
  }

  step(dt: number): void {
    const f = this.flight;
    if (!f) return;
    f.t += dt;
    if (f.t >= f.until) { this.stop(); return; }
    const mesh = this.meshes[f.kind];
    let n = 0;
    for (let i = 0; i < f.n; i++) {
      const pose = f.path(f.t, i);
      if (!pose) continue;
      const flap = 1 + 0.35 * pose.flap;
      this.e.set(0, pose.heading, 0, 'YXZ');
      this.q.setFromEuler(this.e);
      this.m.compose(this.p.set(pose.x, pose.y, pose.z), this.q, this.s.set(1, flap, 1));
      mesh.setMatrixAt(n++, this.m);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (!n) this.stop();
  }

  dispose(): void {
    this.stop();
    for (const mesh of Object.values(this.meshes)) { mesh.geometry.dispose(); mesh.dispose(); }
    this.material.dispose();
  }
}

/** The warm-up set: objects built exactly like the live ones (same materials, same kinds, same flags). */
export function registerEggWarmup(pool: PropPool, flock: Flock): () => void {
  return registerWarmup('eggs', () => {
    const geo = new THREE.BufferGeometry();
    const b = new TypedBatch(64);
    RECIPES.tin(b, new Frame(0, 0, 0));
    const tinGeo = TypedBatch.toGeometry(b.toArrays());
    geo.copy(tinGeo);
    const prop = new THREE.Mesh(geo, pool.mesh.material);
    const birds = flock.group.children.map(c => {
      const src = c as THREE.InstancedMesh;
      const inst = new THREE.InstancedMesh(src.geometry, src.material, 1);
      inst.receiveShadow = src.receiveShadow;
      inst.castShadow = false;
      return inst;
    });
    return { objects: [prop, ...birds], dispose: () => { geo.dispose(); tinGeo.dispose(); for (const i of birds) i.dispose(); } };
  });
}
