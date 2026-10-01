import * as THREE from 'three';
import { Batch, BOX, CONE, CYL, ICO, M, type Info } from '../world/builder';
import { hatMaterial } from '../economy/hats';

/**
 * Wave 6 · lane G (W6-G3) · the Halloween costumes' toy geometry, worn through charApi.attach (economy/wear.ts):
 *
 *   BAYBAY's head slot (economy/hats.ts hatGeometry delegates the two kinds here; the hats' frame: origin on the crown
 *   between the ears, +y up, +z the way she faces; her head ≈ 0.34 wide each side, ears at x ±0.25, y −0.06)
 *     witch      a tall purple-black witch hat: a wide brim, a cone crown with its tip bent back, an orange band, a buckle
 *     pumpkin    a little jack-o'-lantern sitting on her head: a ribbed pumpkin, stem and leaf, a carved face that glows
 *                at night
 *   the player's head slot (the bean's crown, actors/charImpl SLOTS.newcomer: the bucket hat hides while something is
 *   there; relative to it the bean spans y −0.92 … +0.30, widest 0.45 at y −0.31, the face at z ≈ 0.39, y ≈ −0.18)
 *     cat-ears   a black headband with two cat ears (pink inside)
 *     ghost      a white sheet over the whole bean, two black eyes and an "oo" mouth; the feet show under the hem
 *   the pelican's wing bones (W7-G2, charApi 'pelican' wingL / wingR)
 *     bat-wings  a bat's membrane over each wing, scalloped, with finger ribs and a claw; it flaps with the wing
 *   the pelican's neck (W8-H, charApi 'pelican' neck: actors/charImpl SLOTS.pelican, the body bone at (0, 0.2, 1.14))
 *     pumpkin-bow  a bow tie on the hindneck where the ribbon's bow sits, facing the riders: two ribbed pumpkin-orange
 *                  loops, two short tails and a little pumpkin knot with its stem and leaf
 *
 * One plain Mesh per kind on the hats' material (the TOY_DYN program 'ob-toy-dyn': no new program), built on first use
 * and kept; ≤ 420 triangles each (the hats' budget), no shadow cast.
 */

export type CostumeHat = 'witch' | 'pumpkin';
export type PlayerCostume = 'cat-ears' | 'ghost';

const NONE: Info = [0, 0, 0, 0];
const cylG = (rt: number, rb: number, h: number, seg = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
const sph = (r: number, ws = 14, hs = 8, thetaLen = Math.PI) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, thetaLen);

const WITCH = '#3a2d4a', WITCH_D = '#2c2238', BAND = '#e8792b', BUCKLE = '#e0a94a';
const PUMPKIN_A = new THREE.Color('#e8792b'), PUMPKIN_B = new THREE.Color('#d2641f'), STEM = '#5e7a3a', LEAF = '#6f9a45', CARVE = '#ffcf5a';

/** BAYBAY's two costume hats, in the head slot's frame. */
export function costumeHatGeometry(kind: CostumeHat): THREE.BufferGeometry {
  const b = new Batch();
  if (kind === 'witch') {
    const tilt = -0.14;
    b.add(cylG(0.36, 0.37, 0.022, 22), M(0, 0.03, -0.02, 0, 1, 1, 1, tilt), WITCH_D, NONE);
    // the crown: a cone leaning back a little, its tip bent over
    b.add(CONE(12), M(0, 0.03, -0.03, 0, 0.17, 0.34, 0.17, tilt), WITCH, NONE);
    b.add(CONE(8), M(0, 0.34, -0.1, 0, 0.07, 0.17, 0.07, tilt - 0.95), WITCH, NONE);
    b.add(CYL(14), M(0, 0.035, -0.022, 0, 0.172, 0.055, 0.172, tilt), BAND, NONE);
    b.add(BOX(), M(0, 0.04, 0.15, 0, 0.07, 0.05, 0.02, tilt), BUCKLE, NONE);
  } else {
    // a squat ribbed pumpkin on the crown, its carved face to the front (lit at night)
    // (QA on the GLB BAYBAY: centred at 0.12 it floated a hand above her crown — the slot sits at the ear tips)
    const R = 0.2, SY = 0.72, y = 0.0;
    const rib = (_x: number, _y: number, _z: number, lx: number, _ly: number, lz: number) => (Math.floor(((Math.atan2(lz, lx) / (Math.PI * 2)) + 1) * 12) % 2 ? PUMPKIN_A : PUMPKIN_B);
    b.add(sph(R, 16, 9), M(0, y, 0, 0, 1, SY, 1), rib, NONE);
    b.add(CYL(6), M(0, y + R * SY - 0.01, 0, 0.3, 0.025, 0.08, 0.025, -0.25), STEM, NONE);
    b.add(ICO(0), M(0.06, y + R * SY + 0.03, -0.01, 0.6, 0.07, 0.015, 0.035, 0, 0.4), LEAF, NONE);
    const face: Info = [0, 0, 0, 0.9];
    for (const sx of [-1, 1]) b.add(BOX(), M(sx * 0.07, y + 0.025, R * 0.93, 0, 0.05, 0.05, 0.02, 0, sx * 0.3), CARVE, face);
    b.add(BOX(), M(0, y - 0.07, R * 0.9, 0, 0.12, 0.035, 0.02), CARVE, face);
    for (const sx of [-1, 1]) b.add(BOX(), M(sx * 0.035, y - 0.045, R * 0.92, 0, 0.025, 0.025, 0.02, 0, 0.785), CARVE, face);
  }
  return b.build();
}

/** The player's costumes, in the bean's head-slot frame. */
export function playerCostumeGeometry(kind: PlayerCostume): THREE.BufferGeometry {
  const b = new Batch();
  if (kind === 'cat-ears') {
    const BLACK = '#2a2530', PINK = '#f2a0b5';
    // the headband over the crown (a half ring from ear to ear)
    b.add(new THREE.TorusGeometry(0.27, 0.025, 6, 16, Math.PI), M(0, -0.07, -0.02, 0, 1, 1, 1), BLACK, NONE);
    for (const sx of [-1, 1]) {
      b.add(CONE(4), M(sx * 0.17, 0.12, -0.02, Math.PI / 4, 0.1, 0.2, 0.06, 0, -sx * 0.4), BLACK, NONE);
      b.add(CONE(4), M(sx * 0.165, 0.135, 0.015, Math.PI / 4, 0.055, 0.13, 0.03, 0, -sx * 0.4), PINK, NONE);
    }
  } else {
    const SHEET = '#f6f3ee', INK = '#26222b';
    // the dome over the bean's top half and the skirt flaring to the hem, a few soft folds at the hem
    b.add(sph(0.5, 14, 5, Math.PI / 2), M(0, -0.31, 0, 0, 1, 1.3, 0.94), SHEET, NONE);
    b.add(cylG(0.5, 0.6, 0.7, 14, true), M(0, -0.66, 0, 0, 1, 1, 0.94), SHEET, NONE);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      b.add(ICO(0), M(Math.sin(a) * 0.55, -1.0, Math.cos(a) * 0.52, a, 0.12, 0.07, 0.12), SHEET, NONE);
    }
    // two black eyes and an "oo" mouth on the front
    for (const sx of [-1, 1]) b.add(ICO(0), M(sx * 0.15, -0.12, 0.465, 0, 0.054, 0.08, 0.02), INK, NONE);
    b.add(ICO(0), M(0, -0.3, 0.47, 0, 0.045, 0.054, 0.016), INK, NONE);
  }
  return b.build();
}

/**
 * W7-G2 · the pelican's bat wings: one per wing bone (actors/charImpl SLOTS.pelican wingL / wingR, the wing bone's own
 * frame: +x outward on wingL — the right wing is its mirror — +y up, +z forward; the feathered arm spans x ≈ 0 … 1.9,
 * y ≈ ±0.1, z ≈ ±0.5 and the hand, on its own bone, starts at x ≈ 1.6). A thin membrane just above the arm, its trailing
 * edge scalloped between three finger ribs that fan back from the wrist, a little claw at the wrist, and an orange
 * piping along the leading edge that glows at night (so the wings read against the dark sky). The membrane stops near
 * the wrist: the hand flexes on its own bone, so a membrane over it would part from the feathers in flight.
 */
export const BAT_WRIST: readonly [number, number] = [1.72, 0.47];
/** the membrane's outline (x, z) in the wing bone's frame: the leading edge, the wrist, three finger tips and the scallops between */
export const BAT_OUTLINE: readonly (readonly [number, number])[] = [
  [0.06, 0.42], [0.9, 0.52], [1.72, 0.47], [2.02, 0.1], [2.0, -0.36],
  [1.74, -0.33], [1.56, -0.5], [1.46, -0.84],
  [1.22, -0.62], [1.02, -0.66], [0.86, -0.9],
  [0.6, -0.62], [0.3, -0.52], [0.06, -0.44],
];
/** the finger tips the ribs reach (indices into BAT_OUTLINE) */
const BAT_FINGERS = [4, 7, 10];
const BAT_Y = 0.105, BAT_T = 0.03;
const BAT_TOP = new THREE.Color('#3b2d4a'), BAT_UNDER = new THREE.Color('#6b5080');
const BAT_RIB = '#231a2c', BAT_PIPING = '#e8792b', BAT_CLAW = '#efe4c8';
const PIPING_GLOW: Info = [0, 0, 0, 0.9];

/** One bat wing (side 1 = the left wing, −1 = its mirror for the right). */
export function batWingGeometry(side: 1 | -1): THREE.BufferGeometry {
  const b = new Batch();
  const mirror = (m: THREE.Matrix4) => (side < 0 ? new THREE.Matrix4().makeScale(-1, 1, 1).multiply(m) : m);
  const shape = new THREE.Shape(BAT_OUTLINE.map(([x, z]) => new THREE.Vector2(x, z)));
  // the shape in (x, z); extruded along −y after the turn: top face at BAT_Y + BAT_T (dark), the underside lighter
  const skin = new THREE.ExtrudeGeometry(shape, { depth: BAT_T, bevelEnabled: false, steps: 1 }).rotateX(Math.PI / 2).translate(0, BAT_Y + BAT_T, 0);
  b.add(skin, mirror(new THREE.Matrix4()), (_x, _y, _z, _lx, ly) => (ly > BAT_Y + BAT_T * 0.5 ? BAT_TOP : BAT_UNDER), NONE);
  skin.dispose();
  const [wx, wz] = BAT_WRIST;
  const rib = (x0: number, z0: number, x1: number, z1: number, w: number, h: number, color: string, info: Info) => {
    const dx = x1 - x0, dz = z1 - z0;
    b.add(BOX(), mirror(M((x0 + x1) / 2, BAT_Y + BAT_T - 0.005, (z0 + z1) / 2, Math.atan2(dx, dz), w, h, Math.hypot(dx, dz))), color, info);
  };
  // the arm's leading edge (the piping), the three fingers fanning back from the wrist
  rib(BAT_OUTLINE[0][0], BAT_OUTLINE[0][1], wx, wz, 0.07, 0.05, BAT_PIPING, PIPING_GLOW);
  for (const i of BAT_FINGERS) rib(wx, wz, BAT_OUTLINE[i][0], BAT_OUTLINE[i][1], 0.045, 0.035, BAT_RIB, NONE);
  // the thumb claw at the wrist, hooked forward
  b.add(CONE(4), mirror(M(wx + 0.02, BAT_Y + 0.05, wz + 0.02, 0, 0.045, 0.14, 0.045, 1.1)), BAT_CLAW, NONE);
  return b.build();
}

const BAT = new Map<'L' | 'R', THREE.Mesh>();
/** The pelican's bat wing for its wingL / wingR slot (built on first use, kept for the page; the hats' material). */
export function pelicanBatWingMesh(wing: 'L' | 'R'): THREE.Mesh {
  let m = BAT.get(wing);
  if (!m) {
    m = new THREE.Mesh(batWingGeometry(wing === 'L' ? 1 : -1), hatMaterial());
    m.name = `ob-costume-bat-wing-${wing}`;
    m.castShadow = false;
    m.receiveShadow = false;
    BAT.set(wing, m);
  }
  return m;
}

/** W8-H: where the bow sits in the neck slot's frame (the slot is the ribbon ring's centre, body (0, 0.2, 1.14)): on top
 * of the hindneck where the ribbon's own bow sits (models.ts: mesh (±0.13, 0.06, 1.0) = body (0, 0.56, 1.0); the neck's top
 * there is at body y ≈ 0.60), facing the riders */
export const BOW_AT = { x: 0, y: 0.42, z: -0.16 } as const;
const BOW_ORANGE = '#e8792b', BOW_RIB = '#d2641f', BOW_KNOT = '#f0913a', BOW_STEM = '#5e7a3a', BOW_LEAF = '#6f9a45';

/** The pelican's pumpkin bow in the neck slot's frame (+z the way the pelican faces: the bow faces −z, the riders). */
export function pumpkinBowGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const { x, y, z } = BOW_AT;
  for (const s of [-1, 1]) {
    // a loop: a squashed ball leaning out and a little down, with a darker rib along its middle (a pumpkin's groove)
    b.add(ICO(1), M(x + s * 0.17, y + 0.01, z, 0, 0.17, 0.12, 0.075, 0, s * -0.35), BOW_ORANGE, NONE);
    b.add(BOX(), M(x + s * 0.17, y - 0.005, z - 0.07, 0, 0.26, 0.022, 0.012, 0, s * -0.35), BOW_RIB, NONE);
    // a short tail hanging down from the knot
    b.add(BOX(), M(x + s * 0.06, y - 0.2, z - 0.01, 0, 0.055, 0.18, 0.02, 0, s * 0.3), BOW_RIB, NONE);
  }
  // the knot: a little pumpkin with its stem and a leaf
  b.add(ICO(0), M(x, y, z - 0.02, 0.3, 0.075, 0.068, 0.07), BOW_KNOT, NONE);
  b.add(CONE(4), M(x, y + 0.055, z - 0.02, 0.4, 0.016, 0.05, 0.016), BOW_STEM, NONE);
  b.add(BOX(), M(x + 0.035, y + 0.08, z - 0.02, 0.2, 0.05, 0.012, 0.028, 0, -0.5), BOW_LEAF, NONE);
  return b.build();
}

let BOW: THREE.Mesh | null = null;
/** The pelican's pumpkin bow for its neck slot (built on first use, kept; the hats' material, no shadow). */
export function pelicanPumpkinBowMesh(): THREE.Mesh {
  if (!BOW) {
    BOW = new THREE.Mesh(pumpkinBowGeometry(), hatMaterial());
    BOW.name = 'ob-costume-pumpkin-bow';
    BOW.castShadow = false;
    BOW.receiveShadow = false;
  }
  return BOW;
}

const PLAYER = new Map<PlayerCostume, THREE.Mesh>();
/** The one mesh of a player costume (built on first use, kept for the page). */
export function playerCostumeMesh(kind: PlayerCostume): THREE.Mesh {
  let m = PLAYER.get(kind);
  if (!m) {
    m = new THREE.Mesh(playerCostumeGeometry(kind), hatMaterial());
    m.name = `ob-costume-${kind}`;
    m.castShadow = false;
    m.receiveShadow = false;
    PLAYER.set(kind, m);
  }
  return m;
}

export const trianglesOfGeometry = (g: THREE.BufferGeometry): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
