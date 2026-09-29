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
