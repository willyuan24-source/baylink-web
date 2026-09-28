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

export type PropKind =
  | 'decree' | 'tin' | 'windsock' | 'cookie'
  // part b (W5-D4)
  | 'labyrinth' | 'labyrinth-scattered' | 'dahlias' | 'sign100' | 'hydrant' | 'brush' | 'shadow' | 'print' | 'chips';
export interface PropSpec {
  kind: PropKind; x: number; z: number; heading?: number;
  /** world y; default: the ground */
  y?: number;
  /** a colour for the kinds that take one (the rainbow footprints, a dahlia bed's blooms) */
  color?: string;
  /** a length for the kinds that take one (the sundial's shadow, u) */
  size?: number;
}

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

/** `ground(x, z)`: the world height under a world point (flat pieces follow the slope: the labyrinth, the footprints). */
type Recipe = (b: TypedBatch, f: Frame, spec: PropSpec, ground: (x: number, z: number) => number) => void;

const UP = new THREE.Vector3(0, 1, 0);
const flatGround = (y: number) => () => y;

/** A flat quad lying on the ground (local centre lx, lz; length along local z, width along x, turned by `a`). */
function flatQuad(b: TypedBatch, f: Frame, ground: (x: number, z: number) => number, lx: number, lz: number, len: number, w: number, a: number, lift: number, col: string) {
  const c = Math.cos(a), s = Math.sin(a);
  const corner = (u: number, v: number) => {
    // u across, v along (local), rotated by a about y
    const x = lx + u * c + v * s, z = lz - u * s + v * c;
    const p = f.point(x, 0, z);
    p.y = ground(p.x, p.z) + lift;
    return p;
  };
  b.quad(corner(-w / 2, -len / 2), corner(w / 2, -len / 2), corner(w / 2, len / 2), corner(-w / 2, len / 2), UP, C(col));
}

/** The labyrinth's stone rings: radius, the gap's angle (rad) and half-width (rad). */
export const LABYRINTH_RINGS: readonly { r: number; gap: number; half: number }[] = [
  { r: 2.3, gap: Math.PI, half: 0.22 },
  { r: 1.6, gap: 0, half: 0.26 },
  { r: 0.95, gap: Math.PI, half: 0.4 },
];
/** a stone: length along the ring, width across it, and the spacing round the ring (u) */
const STONE = { len: 0.34, w: 0.2, step: 0.46 } as const;
const STONES = ['#c9c2b3', '#aaa192', '#ddd6c6', '#9c9486'];

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
  // --- part b (W5-D4) ---
  // Lands End's labyrinth: three rings of flat stones laid on the grass (each with its opening), a cairn in the middle (≈ 150 tris)
  labyrinth: (b, f, _s, ground) => {
    let k = 0;
    for (const ring of LABYRINTH_RINGS) {
      const n = Math.round((ring.r * Math.PI * 2) / STONE.step);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        let d = Math.abs(a - ring.gap) % (Math.PI * 2);
        if (d > Math.PI) d = Math.PI * 2 - d;
        if (d < ring.half) continue;
        flatQuad(b, f, ground, Math.sin(a) * ring.r, Math.cos(a) * ring.r, STONE.len, STONE.w, a + Math.PI / 2, 0.05, STONES[k++ % STONES.length]);
      }
    }
    const y = ground(f.point(0, 0, 0).x, f.point(0, 0, 0).z) - f.point(0, 0, 0).y;
    b.add(CONE(4), f.at(0, y - 0.02, 0, 0.4, 0.2, 0.26, 0.18), C('#a39a8b'));
    b.add(CONE(3), f.at(0.12, y + 0.18, 0.02, 1.1, 0.1, 0.12, 0.09), C('#c9c1b0'));
  },
  // the same on a day it was scattered: a few stones lying about (≈ 60 tris)
  'labyrinth-scattered': (b, f, _s, ground) => {
    const spots = [[2.1, 0.6], [1.4, -1.8], [-1.9, 1.3], [-0.6, 2.4], [0.3, -0.5], [-2.4, -0.9], [2.5, 1.9], [-0.3, -2.6], [0.9, 1.4], [-1.2, -1.5]];
    spots.forEach(([x, z], i) => flatQuad(b, f, ground, x, z, STONE.len, STONE.w, i * 1.3, 0.05, STONES[i % STONES.length]));
    const o = f.point(0, 0, 0);
    b.add(CONE(3), f.at(0.5, ground(o.x, o.z) - o.y - 0.02, -0.6, 0.4, 0.14, 0.14, 0.12), C('#a39a8b'));
    b.add(CONE(3), f.at(-0.7, ground(o.x, o.z) - o.y - 0.02, 0.3, 2.2, 0.12, 0.1, 0.1), C('#bdb6a7'));
  },
  // a Dahlia Dell bed (1.5× toy scale, so it reads from the path): three leafy mounds and six blooms in the bed's
  // colour family (≈ 180 tris)
  dahlias: (b, f, s) => {
    const base = s.color ?? '#d6336c', S = 1.5;
    const cols = [base, '#f59f00', '#fcc419', '#e03131', '#f783ac', '#fff4e6'];
    for (const [x, z] of [[-0.55, 0], [0.5, 0.1], [0, -0.45]]) b.add(ICO(0), f.at(x * S, 0, z * S, 0.3, 0.42 * S, 0.36 * S, 0.4 * S), C('#3d7a3a'));
    [[-0.6, 0.15], [-0.35, -0.2], [0.1, 0.25], [0.45, -0.15], [0.7, 0.3], [0.05, -0.55]].forEach(([x, z], i) => {
      b.add(ICO(0), f.at(x * S, (0.36 + (i % 2) * 0.06) * S, z * S, i, 0.17 * S, 0.12 * S, 0.17 * S), C(cols[i]));
    });
  },
  // the "100" sign for the city flower's centenary (2026): a board on two posts, the digits in dahlia pink on both
  // faces (flat bars, readable from either side), a little bloom on the corner (≈ 90 tris)
  sign100: (b, f) => {
    const S = 1.4;
    for (const x of [-0.42, 0.42]) b.add(BOX(), f.at(x * S, 0, 0, 0, 0.06 * S, 0.78 * S, 0.06 * S), C('#6b4a2f'));
    b.add(BOX(), f.at(0, 0.62 * S, 0, 0, 1.12 * S, 0.46 * S, 0.05 * S), C('#f6efe0'));
    const pink = C('#d6336c'), face = 0.026 * S + 0.004;
    // a bar of a digit: centre (x, y), width w, height h (board units), on the front (+z) or the back (−z, mirrored)
    const bar = (x: number, y: number, w: number, h: number) => {
      for (const side of [1, -1]) {
        const cx = x * side * S, cy = (0.62 + 0.23 + y) * S, hw = (w * S) / 2, hh = (h * S) / 2, z = face * side;
        b.quad(f.point(cx - hw, cy - hh, z), f.point(cx + hw, cy - hh, z), f.point(cx + hw, cy + hh, z), f.point(cx - hw, cy + hh, z), new THREE.Vector3(0, 0, side).transformDirection(f.m), pink);
      }
    };
    bar(-0.34, 0, 0.06, 0.34);
    for (const cx of [-0.02, 0.3]) { bar(cx - 0.1, 0, 0.05, 0.34); bar(cx + 0.1, 0, 0.05, 0.34); bar(cx, -0.145, 0.25, 0.05); bar(cx, 0.145, 0.25, 0.05); }
    b.add(ICO(0), f.at(0.52 * S, 0.9 * S, 0, 0.2, 0.11 * S, 0.08 * S, 0.11 * S), C('#f59f00'));
  },
  // the Golden Fire Hydrant: a squat gold body, a domed bonnet, two side outlets (≈ 110 tris)
  hydrant: (b, f) => {
    // (1.3×: a real hydrant is knee-high; this one has to be found from the follow camera)
    const gold = '#e8b634', deep = '#c8962a', S = 1.3;
    b.add(CYL(8), f.at(0, 0, 0, 0, 0.2 * S, 0.08 * S, 0.2 * S), C(deep));
    b.add(CYL(8), f.at(0, 0.08 * S, 0, 0, 0.15 * S, 0.5 * S, 0.15 * S), C(gold));
    b.add(CYL(8, 0.55), f.at(0, 0.58 * S, 0, 0, 0.17 * S, 0.14 * S, 0.17 * S), C(deep));
    b.add(BOX(), f.at(0, 0.72 * S, 0, Math.PI / 4, 0.06 * S, 0.07 * S, 0.06 * S), C(gold));
    for (const s of [-1, 1]) b.add(CYL(6), f.at(s * 0.14 * S, 0.38 * S, 0, 0, 0.06 * S, 0.1 * S, 0.06 * S, 0, (s * Math.PI) / 2), C(gold));
  },
  // a paintbrush on the hydrant's anniversary morning (18 April) (≈ 36 tris)
  brush: (b, f) => {
    b.add(BOX(), f.at(0, 0.2, 0, 0, 0.04, 0.44, 0.04, 0.5), C('#9c6b3c'));
    b.add(BOX(), f.at(0, 0.11, -0.05, 0, 0.09, 0.07, 0.05, 0.5), C('#b8bcc2'));
    b.add(BOX(), f.at(0, 0.02, -0.1, 0, 0.1, 0.1, 0.05, 0.5), C('#e2b23a'));
  },
  // the sundial's shadow: a dark wedge laid on the dial from the gnomon toward local +z, `size` long (4 tris)
  shadow: (b, f, s) => {
    const len = Math.max(0.3, s.size ?? 1), y = 0.012;
    const P = (x: number, z: number) => f.point(x, y, z);
    b.quad(P(-0.1, 0), P(0.1, 0), P(0.07, len * 0.6), P(-0.07, len * 0.6), UP, C('#5e584e'));
    b.quad(P(-0.07, len * 0.6), P(0.07, len * 0.6), P(0.025, len), P(-0.025, len), UP, C('#6a645a'));
  },
  // one rainbow footprint (the Castro): a sole and a heel, flat on the ground (4 tris)
  // (toy-sized so it reads from the follow camera, lifted above the painted crosswalks)
  print: (b, f, s, ground) => {
    const col = s.color ?? '#e53935';
    flatQuad(b, f, ground, 0, 0.1, 0.3, 0.22, 0, 0.07, col);
    flatQuad(b, f, ground, 0, -0.18, 0.16, 0.16, 0, 0.07, col);
  },
  // Alta Plaza's chipped step edge: a few dark nicks and a pale broken lip (≈ 48 tris)
  chips: (b, f) => {
    b.add(BOX(), f.at(-0.3, -0.02, 0, 0.3, 0.16, 0.05, 0.08), C('#6f6a62'));
    b.add(BOX(), f.at(0.05, -0.02, 0.02, -0.2, 0.22, 0.05, 0.09), C('#5f5a53'));
    b.add(BOX(), f.at(0.36, -0.02, 0, 0.5, 0.12, 0.05, 0.07), C('#6f6a62'));
    b.add(BOX(), f.at(0.02, -0.03, -0.06, 0, 0.9, 0.04, 0.03), C('#d8d2c5'));
  },
};

/** The triangles a prop adds (tests: ≤ 200 each). */
export function propTriangles(kind: PropKind, spec: Partial<PropSpec> = {}): number {
  const b = new TypedBatch(256);
  RECIPES[kind](b, new Frame(0, 0, 0), { kind, x: 0, z: 0, ...spec }, flatGround(0));
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
  RECIPES.tin(b, new Frame(0, -50, 0), { kind: 'tin', x: 0, z: 0 }, flatGround(-50));
  return TypedBatch.toGeometry(b.toArrays());
}

const sameSpec = (a: PropSpec, b: PropSpec) => a.kind === b.kind && a.x === b.x && a.z === b.z && a.heading === b.heading && a.y === b.y && a.color === b.color && a.size === b.size;

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
    if (prev && sameSpec(prev.spec, spec)) return;
    this.props.set(key, { key, spec, y: spec.y ?? heightAt(spec.x, spec.z) });
    this.dirty = true;
  }

  has(key: string): boolean { return this.props.has(key); }
  /** The spec placed under `key` (QA / tests). */
  get(key: string): PropSpec | undefined { return this.props.get(key)?.spec; }

  /** The keys drawn now (QA / tests). */
  visibleKeys(): string[] { return this.shown ? this.shown.split('|') : []; }

  /** ≈ 2 Hz: rebuild when the set within range of (x, z) changed. */
  step(now: number, x = runtime.player.x, z = runtime.player.z): void {
    if (now < this.next && !this.dirty) return;
    this.next = now + 0.5;
    const near = [...this.props.values()].filter(p => (p.spec.x - x) ** 2 + (p.spec.z - z) ** 2 < PROP_RANGE * PROP_RANGE).sort((a, b) => (a.key < b.key ? -1 : 1));
    // a prop placed before its ground streamed in stood on the coarse far terrain: follow the ground as it arrives
    for (const p of near) {
      if (p.spec.y !== undefined) continue;
      const h = heightAt(p.spec.x, p.spec.z);
      if (Math.abs(h - p.y) > 0.03) { p.y = h; this.dirty = true; }
    }
    const sig = near.map(p => p.key).join('|');
    if (sig === this.shown && !this.dirty) return;
    this.dirty = false;
    this.shown = sig;
    if (this.mesh.geometry !== this.idle) this.mesh.geometry.dispose();
    if (!near.length) { this.mesh.geometry = this.idle; this.mesh.visible = false; return; }
    const b = new TypedBatch(near.length * 160);
    for (const p of near) RECIPES[p.spec.kind](b, new Frame(p.spec.x, p.y, p.spec.z, p.spec.heading ?? 0), p.spec, p.spec.y !== undefined ? flatGround(p.y) : heightAt);
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

/**
 * The flock layer: every transient animal or ghost of an egg, each kind its own small InstancedMesh (drawn only during
 * its flight): the parrots, the pelicans, (part b) the Golden Gate humpback and China Beach's three junk-sail
 * silhouettes. One flight at a time (they never share a place).
 */
export type FlockKind = 'parrot' | 'pelican' | 'whale' | 'junk';
export const FLOCK_KINDS: readonly FlockKind[] = ['parrot', 'pelican', 'whale', 'junk'];
const FLOCK_MAX = 16;

function birdGeometry(kind: FlockKind): THREE.BufferGeometry {
  const b = new TypedBatch(256);
  if (kind === 'whale') {
    // a humpback about 10 u long (toy scale, so it reads from the deck): a dark rounded body along +z, pale long
    // flippers, a small dorsal hump and the broad tail fluke (≈ 170 tris); the origin is the body's middle at the waterline
    const f = new Frame(0, 0, 0, 0, 1.4);
    b.add(ICO(1), f.at(0, 0, 0.3, 0, 1.05, 0.85, 3.1), C('#3a414d'));
    b.add(ICO(0), f.at(0, -0.3, 0.9, 0, 0.8, 0.45, 1.9), C('#c9ccd2'));
    b.add(CONE(4), f.at(0, 0.6, -1.3, Math.PI / 4, 0.18, 0.36, 0.3), C('#2f353f'));
    for (const s of [-1, 1]) b.add(BOX(), f.at(s * 1.35, -0.35, 1.1, s * 0.5, 1.6, 0.08, 0.42, 0, s * 0.35), C('#dfe1e5'));
    b.add(CYL(6, 0.55), f.at(0, 0, -2.6, 0, 0.42, 1.6, 0.42, -Math.PI / 2), C('#353b46'));
    for (const s of [-1, 1]) b.add(BOX(), f.at(s * 0.75, 0, -4.05, s * 0.35, 1.5, 0.08, 0.7), C('#2f353f'));
    return TypedBatch.toGeometry(b.toArrays());
  }
  if (kind === 'junk') {
    // a junk under sail, pale as a memory (≈ 144 tris; origin at the waterline, bow +z): a low hull with a raised stern
    // and bow, three masts, and three battened lug sails — each three panels, wider going up, the top edge rising aft,
    // with dark battens between (two-sided quads: seen from either side of the cove); 1.35× so it reads across the cove
    const f = new Frame(0, 0, 0, 0, 1.35);
    b.add(BOX(), f.at(0, -0.45, 0, 0, 1.1, 0.55, 4), C('#7c6852'));
    b.add(BOX(), f.at(0, 0.1, -1.55, 0, 1.05, 0.45, 0.9), C('#8a755d'));
    b.add(BOX(), f.at(0, 0.1, 1.75, 0, 0.9, 0.2, 0.5), C('#8a755d'));
    const X = new THREE.Vector3(1, 0, 0), NX = new THREE.Vector3(-1, 0, 0);
    const both = (pts: [number, number][], col: string) => {
      const P = pts.map(([y, z]) => f.point(0, y, z));
      b.quad(P[0], P[1], P[2], P[3], X, C(col));
      b.quad(P[0], P[1], P[2], P[3], NX, C(col));
    };
    for (const [zm, H, W] of [[1.25, 2.5, 1.35], [0.1, 3.4, 1.8], [-1.35, 2.1, 1.25]] as const) {
      b.add(BOX(), f.at(0, 0.05, zm, 0, 0.08, H + 0.35, 0.08), C('#6b5946'));
      const n = 3, ph = (H * 0.9) / n, y0 = 0.45, slant = 0.35;
      const luff = (k: number) => zm + 0.3 * W * (0.85 + 0.05 * k);
      const leech = (k: number) => zm - 0.7 * W * (0.85 + 0.08 * k);
      for (let k = 0; k < n; k++) {
        const ya = y0 + k * ph, yb = ya + ph - 0.07, lift = (s: number) => slant * (s / n);
        both([[ya, luff(k)], [ya + lift(k), leech(k)], [yb + lift(k + 1), leech(k + 1)], [yb, luff(k + 1)]], '#f0dcc0');
        both([[yb, luff(k + 1)], [yb + lift(k + 1), leech(k + 1)], [yb + 0.07 + lift(k + 1), leech(k + 1)], [yb + 0.07, luff(k + 1)]], '#8f7457');
      }
    }
    return TypedBatch.toGeometry(b.toArrays());
  }
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
export interface BirdPose { x: number; y: number; z: number; heading: number; flap: number; /** nose down (+) / up (−), rad (the whale's arc) */ pitch?: number }
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
      whale: this.make('whale'),
      junk: this.make('junk'),
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
      this.e.set(pose.pitch ?? 0, pose.heading, 0, 'YXZ');
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
    RECIPES.tin(b, new Frame(0, 0, 0), { kind: 'tin', x: 0, z: 0 }, flatGround(0));
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
