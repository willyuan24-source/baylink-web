import * as THREE from 'three';
import { BOX, CONE, ICO, M, Batch, type Info } from '../world/builder';
import { patchToyShader } from '../world/materials';
import type { TreatDoor } from './treatDoors';

/**
 * Wave 6 · lane G (W6-G2) · the decorated doors, toy geometry on ONE material (an instance of the TOY_DYN program,
 * 'ob-toy-dyn', sway off: no new program; warmed as 'g-doors' by play.ts):
 *
 *   a street's doors   one merged mesh per street (≤ DOOR_TRIS_MAX triangles a door): a stone step, a white frame, a
 *                      coloured door with two panels and a brass knob (or, open, a warm lit doorway), a glowing transom,
 *                      a porch lantern, a jack-o'-lantern on the step, a paper bat over the door, and on a door that does
 *                      not answer today a paper note ("出去讨糖啦")
 *   the swing          the one door being opened: its panel on the hinge (a plain Mesh, rotated by play.ts)
 *   the candy          a few wrapped sweets flying from the door to the player (a plain Mesh, moved by play.ts)
 *
 * Doors are authored in the door's frame: origin on the wall at the door's foot, +z out to the street (world (sin f,
 * cos f)), +x to the right as seen from the street, y up from the ground (door.y).
 *
 * Glow (aInfo.w): (0, 1] lights at night only, (1, 2] always. A door's lantern, transom and pumpkin face glow always in
 * the treat hours (16–22) and all of the big night — the brightest — else at night only; a door that does not answer
 * today stays dark.
 */

export const DOOR_W = 0.5;
export const DOOR_H = 1.02;
/** the step's top above door.y */
export const STEP_TOP = 0.12;
export const DOOR_TRIS_MAX = 300;
/** the porch round the door: width, height (to the eaves) and depth back into the lot (u) */
export const PORCH_W = 0.84, PORCH_H = 1.5, PORCH_D = 1.3;
const PORCH_WALL = ['#efe3cb', '#e7d6bd', '#dfe4d6', '#efd9cf'], ROOF = '#4d4250';

const STONE = '#b9aea0', TRIM = '#f4efe4', BRASS = '#e0a94a', WARM = '#ffcf7a', NOTE = '#f7f3e8';
const ORANGE = ['#e8792b', '#d9651f', '#f0913a'], STEM = '#5e7a3a', CARVE = '#ffcf5a', BAT = '#2a2530', LANTERN_OFF = '#77736a';
/** door paints (Victorian colours), by door number */
export const DOOR_PAINTS = ['#6b2d5c', '#2f5d50', '#8e2f3c', '#26374f', '#c44a31', '#3b3a40', '#2f8f88', '#7a4b2a'];
const NONE: Info = [0, 0, 0, 0];

let MAT: THREE.MeshStandardMaterial | null = null;
/** The doors' material (our own instance of the TOY_DYN program: no new program). */
export function doorMaterial(): THREE.MeshStandardMaterial {
  if (MAT) return MAT;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  m.name = 'ob-halloween-doors';
  m.onBeforeCompile = shader => { patchToyShader(shader, { sway: false }); };
  m.customProgramCacheKey = () => 'ob-toy-dyn';
  return (MAT = m);
}

export interface DoorLook {
  /** answers today */
  answers: boolean;
  /** the treat hours or the big night: the lights glow always (the brightest) */
  bright: boolean;
  /** open now (the swing mesh shows its panel; the doorway is lit) */
  open: boolean;
}

/** A door's frame → world matrix helper. */
function frame(d: TreatDoor) {
  const c = Math.cos(d.f), s = Math.sin(d.f);
  // local x → world (cos f, −sin f), local z → world (sin f, cos f)
  return (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0) =>
    M(d.x + lx * c + lz * s, d.y + ly, d.z - lx * s + lz * c, d.f + ry, sx, sy, sz, rx, rz);
}

/** One door's pieces into the batch. */
export function addDoor(b: Batch, d: TreatDoor, look: DoorLook): void {
  const at = frame(d);
  const glow: Info = look.answers ? [0, 0, 0, look.bright ? 1.9 : 0.9] : NONE;
  // the porch: a little gabled entry reaching PORCH_D back into the lot — hidden inside a house that stands on its
  // footprint's street edge, and bridging the gap to one that stands back (the near-player kit houses can)
  b.add(BOX(), at(0, -0.3, -PORCH_D / 2 + 0.01, PORCH_W, PORCH_H + 0.3, PORCH_D), PORCH_WALL[d.n % PORCH_WALL.length], NONE);
  for (const side of [-1, 1]) b.add(BOX(), at(side * PORCH_W * 0.26, PORCH_H - 0.07 + 0.11, -PORCH_D / 2 + 0.05, PORCH_W * 0.6, 0.05, PORCH_D + 0.12, 0, 0, side * -0.42), ROOF, NONE);
  // the stone step (reaches down into a sloping pavement) and the white frame
  b.add(BOX(), at(0, -0.35, 0.17, 0.8, 0.35 + STEP_TOP, 0.36), STONE, NONE);
  b.add(BOX(), at(0, STEP_TOP, 0.0, DOOR_W + 0.16, DOOR_H + 0.26, 0.07), TRIM, NONE);
  if (look.open) {
    // the doorway: warm light from inside (always lit: somebody is home and the door is open)
    b.add(BOX(), at(0, STEP_TOP + 0.01, 0.036, DOOR_W, DOOR_H, 0.01), WARM, [0, 0, 0, 1.6]);
  } else {
    const paint = DOOR_PAINTS[(d.n * 5) % DOOR_PAINTS.length];
    b.add(BOX(), at(0, STEP_TOP + 0.01, 0.035, DOOR_W, DOOR_H, 0.04), paint, NONE);
    const inset = new THREE.Color(paint).multiplyScalar(1.25);
    b.add(BOX(), at(0, STEP_TOP + 0.12, 0.056, DOOR_W * 0.64, DOOR_H * 0.34, 0.01), inset, NONE);
    b.add(BOX(), at(0, STEP_TOP + 0.56, 0.056, DOOR_W * 0.64, DOOR_H * 0.34, 0.01), inset, NONE);
    b.add(BOX(), at(DOOR_W * 0.34, STEP_TOP + 0.5, 0.06, 0.05, 0.05, 0.04), BRASS, NONE);
    // a door that does not answer today: a paper note
    if (!look.answers) b.add(BOX(), at(-0.02, STEP_TOP + 0.5, 0.066, 0.2, 0.15, 0.01), NOTE, NONE);
  }
  // the transom over the door and the porch lantern
  b.add(BOX(), at(0, STEP_TOP + DOOR_H + 0.04, 0.04, DOOR_W - 0.04, 0.12, 0.04), look.answers ? WARM : '#8a8374', glow);
  b.add(BOX(), at(DOOR_W / 2 + 0.12, STEP_TOP + 0.78, 0.07, 0.09, 0.15, 0.09), look.answers ? CARVE : LANTERN_OFF, glow);
  b.add(BOX(), at(DOOR_W / 2 + 0.12, STEP_TOP + 0.93, 0.07, 0.12, 0.03, 0.12), BAT, NONE);
  // a paper bat over the door: two tilted wings and a body
  b.add(BOX(), at(-0.09, STEP_TOP + DOOR_H + 0.26, 0.05, 0.16, 0.05, 0.01, 0, 0, 0.35), BAT, NONE);
  b.add(BOX(), at(0.09, STEP_TOP + DOOR_H + 0.26, 0.05, 0.16, 0.05, 0.01, 0, 0, -0.35), BAT, NONE);
  b.add(BOX(), at(0, STEP_TOP + DOOR_H + 0.24, 0.055, 0.05, 0.08, 0.02), BAT, NONE);
  // the jack-o'-lantern on the step, its carved face to the street
  const r = 0.14, h = r * 0.8, px = -0.27, pz = 0.2, py = STEP_TOP;
  b.add(ICO(0), at(px, py + h, pz, r, h, r, d.n * 0.7), ORANGE[d.n % ORANGE.length], NONE);
  b.add(BOX(), at(px, py + h * 1.8, pz, r * 0.2, r * 0.45, r * 0.2, d.n), STEM, NONE);
  const face: Info = look.answers ? glow : [0, 0, 0, 0.5];
  for (const [sx, up, w, hh] of [[-0.3, 0.12, 0.22, 0.2], [0.3, 0.12, 0.22, 0.2], [0, -0.3, 0.62, 0.16]] as const) {
    b.add(BOX(), at(px + sx * r, py + h + up * r - hh * r * 0.5, pz + r * 0.86, w * r, hh * r, r * 0.08), CARVE, face);
  }
}

/** One merged geometry of a street's doors (world space). */
export function buildDoorsGeometry(doors: readonly TreatDoor[], look: (d: TreatDoor) => DoorLook): THREE.BufferGeometry {
  const b = new Batch();
  for (const d of doors) if (!d.gone) addDoor(b, d, look(d));
  return b.build();
}

/** The swinging panel, in the hinge's frame: the hinge on the door's left edge (x = 0), the panel toward +x. */
export function buildSwingGeometry(paint: string): THREE.BufferGeometry {
  const b = new Batch();
  b.add(BOX(), M(DOOR_W / 2, 0, 0.02, 0, DOOR_W, DOOR_H, 0.04), paint, NONE);
  const inset = new THREE.Color(paint).multiplyScalar(1.25);
  b.add(BOX(), M(DOOR_W / 2, 0.11, 0.041, 0, DOOR_W * 0.64, DOOR_H * 0.34, 0.01), inset, NONE);
  b.add(BOX(), M(DOOR_W / 2, 0.55, 0.041, 0, DOOR_W * 0.64, DOOR_H * 0.34, 0.01), inset, NONE);
  b.add(BOX(), M(DOOR_W * 0.84, 0.49, 0.045, 0, 0.05, 0.05, 0.04), BRASS, NONE);
  return b.build();
}

/** A handful of wrapped sweets around the origin (the flight moves the mesh). */
export function buildCandyGeometry(colors: readonly { color: string; wrap: string }[]): THREE.BufferGeometry {
  const b = new Batch();
  colors.forEach((c, i) => {
    const a = (i / Math.max(1, colors.length)) * Math.PI * 2, x = Math.cos(a) * 0.09, z = Math.sin(a) * 0.09, y = i * 0.04;
    b.add(ICO(0), M(x, y, z, a, 0.07, 0.055, 0.055), c.color, [0, 0, 0, 1.2]);
    // the twisted wrapper ends
    b.add(CONE(5), M(x + Math.cos(a + Math.PI / 2) * 0.06, y, z + Math.sin(a + Math.PI / 2) * 0.06, a, 0.04, 0.07, 0.04, 0, Math.PI / 2), c.wrap, NONE);
    b.add(CONE(5), M(x - Math.cos(a + Math.PI / 2) * 0.06, y, z - Math.sin(a + Math.PI / 2) * 0.06, a, 0.04, 0.07, 0.04, 0, -Math.PI / 2), c.wrap, NONE);
  });
  return b.build();
}

/** Where the swing's hinge stands in the world, and the knock spot (tests, play.ts). */
export function doorPoints(d: TreatDoor, out = 0.9): { hinge: THREE.Vector3; knock: { x: number; z: number }; front: { x: number; y: number; z: number } } {
  const c = Math.cos(d.f), s = Math.sin(d.f);
  const lx = -DOOR_W / 2, lz = 0.015;
  return {
    hinge: new THREE.Vector3(d.x + lx * c + lz * s, d.y + STEP_TOP + 0.01, d.z - lx * s + lz * c),
    knock: { x: d.x + s * out, z: d.z + c * out },
    front: { x: d.x + s * 0.25, y: d.y + STEP_TOP + 0.6, z: d.z + c * 0.25 },
  };
}

export const trianglesOf = (g: THREE.BufferGeometry): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
