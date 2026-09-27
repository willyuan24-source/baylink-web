import * as THREE from 'three';
import { BOX, Batch, CYL, type Info, M } from './builder';
import { figure } from './cablecar';

/**
 * Cable-car turntables (lane F, checkpoint F4): the spinning timber disc the cars turn on at Powell & Market, Hyde &
 * Beach and Taylor & Bay, the static apron F draws where no landmark does (Hyde & Beach, Taylor & Bay; Powell & Market's
 * apron, booth and railings are lane D2's `cable-car-turntable` landmark, whose static disc F's disc covers 0.005 u
 * higher with r + 0.02), and the 3D progress ring shown while someone helps push a car round.
 *
 * Disc local frame: y = 0 at the disc top, rails along z (the track), two crew figures pushing at the rim.
 */

/** Landmark disc radius (world/sf/landmarks/cable-car-turntable.ts R) + 0.02. */
export const DISC_R = 3.12;
/** F's own disc top above the ground where there is no landmark (low profile: the car's rails stay at +0.08). */
export const OWN_DISC_TOP = 0.05;
export const RAIL_GAUGE = 0.72;

const WOOD = '#a37a52', WOOD_DARK = '#86613f', STEEL = '#6f7479', BRICK = '#b8b2a7';
const NO: Info = [0, -100, 0, 0];

function ngonXZ(r: number, n: number, y: number, b: Batch, color: string, ox = 0, oz = 0) {
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    b.tri(new THREE.Vector3(ox, y, oz), new THREE.Vector3(ox + Math.sin(a0) * r, y, oz + Math.cos(a0) * r), new THREE.Vector3(ox + Math.sin(a1) * r, y, oz + Math.cos(a1) * r), color, NO, up);
  }
}

/** A flat ring band r0..r1 at height y (n segments) around (ox, oz), with an outer skirt down to y − skirt. */
function ringXZ(b: Batch, r0: number, r1: number, y: number, n: number, color: string, skirt = 0, ox = 0, oz = 0) {
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const p = (r: number, a: number, yy = y) => new THREE.Vector3(ox + Math.sin(a) * r, yy, oz + Math.cos(a) * r);
    b.quad(p(r0, a1), p(r1, a1), p(r1, a0), p(r0, a0), up, color, NO);
    if (skirt > 0) {
      const n0 = new THREE.Vector3(Math.sin((a0 + a1) / 2), 0, Math.cos((a0 + a1) / 2));
      b.quad(p(r1, a1), p(r1, a1, y - skirt), p(r1, a0, y - skirt), p(r1, a0), n0, color, NO);
    }
  }
}

/** The spinning part: timber disc with planks, steel rim, the rails across, the pivot cap and two pushing crew. */
export function discGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const R = DISC_R;
  ngonXZ(R, 28, 0, b, WOOD);
  ringXZ(b, R - 0.14, R, 0.004, 28, STEEL, 0.07);
  for (let k = -6; k <= 6; k += 2) {
    const x = k * 0.23, half = Math.sqrt(Math.max(0, R * R - x * x)) - 0.12;
    b.add(BOX(), M(x, 0.001, 0, 0, 0.16, 0.008, half * 2), WOOD_DARK, NO);
  }
  for (const x of [-RAIL_GAUGE, RAIL_GAUGE]) b.add(BOX(), M(x, 0, 0, 0, 0.1, 0.05, R * 2 - 0.12), STEEL, NO);
  b.add(BOX(), M(0, 0, 0, 0, 0.07, 0.012, R * 2 - 0.2), '#3a3d40', NO);
  b.add(CYL(10), M(0, 0, 0, 0, 0.35, 0.05, 0.35), STEEL, NO);
  // the crew who walk the car round, one at each end of the disc, pushing
  figure(b, 0.55, 0, R - 0.16, Math.PI, { push: true, vest: '#7d2a2d' });
  figure(b, -0.55, 0, -R + 0.16, 0, { push: true, vest: '#2f5a4a' });
  const g = b.build();
  g.computeBoundingSphere();
  g.name = 'turntable-disc';
  return g;
}

/** Static apron for one site in world space (ground y at the centre): brick ring and steel ring, skirts below. */
export function apronInto(b: Batch, x: number, y: number, z: number) {
  ringXZ(b, DISC_R + 0.16, DISC_R + 1.4, y + 0.03, 32, BRICK, 1.2, x, z);
  ringXZ(b, DISC_R, DISC_R + 0.18, y + OWN_DISC_TOP, 32, STEEL, OWN_DISC_TOP + 0.4, x, z);
  // the pit under F's disc (seen through the gap while it turns)
  ngonXZ(DISC_R, 20, y - 0.02, b, '#5d5750', x, z);
}

/** 36-segment progress ring (drawRange shows the filled part): a gold band just outside the disc. */
export const RING_SEGMENTS = 36;
export function progressRingGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const up = new THREE.Vector3(0, 1, 0);
  const r0 = DISC_R + 0.35, r1 = DISC_R + 0.7;
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a0 = (i / RING_SEGMENTS) * Math.PI * 2, a1 = ((i + 0.86) / RING_SEGMENTS) * Math.PI * 2;
    const p = (r: number, a: number) => new THREE.Vector3(Math.sin(a) * r, 0.02, Math.cos(a) * r);
    b.quad(p(r0, a1), p(r1, a1), p(r1, a0), p(r0, a0), up, '#f3c75a', [0, -100, 0, 1.6]);
  }
  const g = b.build();
  g.name = 'turntable-progress';
  return g;
}
