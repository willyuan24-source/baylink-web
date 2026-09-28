import * as THREE from 'three';
import { registerWarmup } from '../../world/warmup';
import { GlideSim } from '../glide';
import { PELICAN_SEATS, buildPelicanRig } from './models';
import type { Rig } from '../models';

/**
 * The ride pelican (lane E2, wave 3, E2-8): the procedural brown pelican of vehicles/models.ts buildPelicanRig — one
 * skinned draw (+ its shadow) that reads as flying: a long body, the head drawn back, the bill laid forward, the feet
 * tucked, wings that soar with a slow flex, beat on take-off and climbs and lift into the bank. It carries the
 * newcomer on its back and BAYBAY on its shoulders (PELICAN_SEATS). The flight itself is actors/glide.ts (GlideSim);
 * this only draws it. Fast travel (G1's 飞过去) poses it along the trip's sky path (`travel`).
 */

const tmpE = new THREE.Euler(0, 0, 0, 'YXZ');

/** The unlock greeting (startGreet): approach seconds, the root above the ground when settled (the belly just touching
 *  it), the longest stay, the wing fold (rad round the shoulder / the hand). */
export const GREET = { inS: 1.6, sit: 1.5, maxS: 14, foldArm: 1.3, foldHand: 0.9 } as const;

// the pelican's program is the characters' clay material on a skinned mesh (the player's own): warm it with the rest
registerWarmup('e2-pelican', () => {
  const rig = buildPelicanRig();
  rig.mesh.castShadow = true;
  return { objects: [rig.mesh], dispose: () => { rig.mesh.geometry.dispose(); rig.mesh.skeleton.dispose(); } };
});

type Ground = { canStand(x: number, z: number, r: number): boolean; heightAt(x: number, z: number): number };
type P3 = { x: number; y: number; z: number };

/**
 * Where the greeting pelican settles (pure). With BAYBAY beside the player (0.5–6 u): behind the pair as the camera
 * sees them — the middle of the two, 3.2–3.8 u out across their line on the side away from the camera — so the
 * moment's two-shot shows it between and behind them, facing them. Otherwise (or with no room there): 2.6–3.8 u out
 * beside the player, away from BAYBAY first. Open ground for its body (a 1.1 u disc) within 0.8 u of the feet, ≥ 2.4 u
 * from both. `view` is the camera's heading (the controller's convention: forward = (sin h, cos h)). Null: nowhere fits.
 */
export function greetSpot(ax: number, az: number, feetY: number, view: number, guide: { x: number; z: number }, w: Ground): (P3 & { side: number; face: number }) | null {
  const fx = Math.sin(view), fz = Math.cos(view);
  // screen right when looking along `view` (three.js: looking down +z, the right is −x)
  const rx = -fz, rz = fx;
  const tries: { x: number; z: number; side: number }[] = [];
  const dx = guide.x - ax, dz = guide.z - az, gd = Math.hypot(dx, dz);
  let lookX = ax, lookZ = az;
  if (gd > 0.5 && gd < 6) {
    const ux = dx / gd, uz = dz / gd;
    let px = -uz, pz = ux;
    if (px * fx + pz * fz < 0) { px = -px; pz = -pz; }
    const mx = ax + dx / 2, mz = az + dz / 2;
    lookX = mx; lookZ = mz;
    const sideOf = (x: number, z: number) => Math.sign((x - ax) * rx + (z - az) * rz) || 1;
    for (const [a, b] of [[3.2, 0], [3.8, -1], [3.8, 1], [3.2, -2], [3.2, 2]] as const) {
      const x = mx + px * a + ux * b, z = mz + pz * a + uz * b;
      tries.push({ x, z, side: sideOf(x, z) });
    }
  }
  const gSide = Math.sign(dx * rx + dz * rz) || 1;
  for (const [side, ahead] of [[-gSide * 2.9, 0.6], [-gSide * 3.4, -0.4], [-gSide * 2.6, 1.8], [0, 3.4], [gSide * 3.2, 0.8], [gSide * 3.4, -0.6], [-gSide * 3.8, 0], [0, -3.6]] as const) {
    tries.push({ x: ax + rx * side + fx * ahead, z: az + rz * side + fz * ahead, side: Math.sign(side) || -gSide });
  }
  for (const t of tries) {
    if (!w.canStand(t.x, t.z, 1.1)) continue;
    const y = w.heightAt(t.x, t.z);
    if (!Number.isFinite(y) || Math.abs(y - feetY) > 0.8) continue;
    if (Math.hypot(guide.x - t.x, guide.z - t.z) < 2.4 || Math.hypot(ax - t.x, az - t.z) < 2.4) continue;
    return { x: t.x, y, z: t.z, side: t.side, face: Math.atan2(lookX - t.x, lookZ - t.z) };
  }
  return null;
}

/**
 * Where the greeting pelican's approach starts (pure): ahead of the camera and out to its side, 9 u up, so it glides
 * in toward the camera and shows its face; if a roof or a hill stands in that line, a steeper drop from right above.
 */
export function greetFrom(at: P3 & { side: number }, view: number, w: { heightAt(x: number, z: number): number; roofAt(x: number, z: number, r: number): number }): P3 {
  const fx = Math.sin(view), fz = Math.cos(view), rx = -fz, rz = fx, side = at.side || 1;
  const clear = (from: P3) => {
    for (const k of [0.2, 0.4, 0.6, 0.8]) {
      const x = from.x + (at.x - from.x) * k, z = from.z + (at.z - from.z) * k;
      const y = at.y + GREET.sit + (from.y - at.y - GREET.sit) * (1 - k) ** 1.6;
      if (Math.max(w.heightAt(x, z), w.roofAt(x, z, 1.6)) > y - 1.2) return false;
    }
    return true;
  };
  const glide = { x: at.x + fx * 13 + rx * side * 6, y: at.y + 9, z: at.z + fz * 13 + rz * side * 6 };
  if (clear(glide)) return glide;
  const side2 = { x: at.x + rx * side * 12 + fx * 4, y: at.y + 10, z: at.z + rz * side * 12 + fz * 4 };
  if (clear(side2)) return side2;
  return { x: at.x + rx * side * 3, y: at.y + 16, z: at.z + rz * side * 3 };
}

export class Pelican {
  readonly group = new THREE.Group();
  readonly sim = new GlideSim();
  readonly rig: Rig;
  private compiled = false;
  /** 0..1 appear / leave scale */
  private shown = 0;
  private want = 0;
  private flap = 0;
  /** after landing: flies off ahead for a moment */
  private leaving = -1;
  private leave = { x: 0, y: 0, z: 0, heading: 0 };
  /** fast travel: a strong beat (pickup / climb / the flare at the end) instead of the soaring flex */
  beating = false;

  constructor() {
    this.group.name = 'opus-pelican-ride';
    this.group.visible = false;
    this.rig = buildPelicanRig();
    this.rig.mesh.name = 'opus-pelican-ride-body';
    this.rig.mesh.castShadow = true;
    this.group.add(this.rig.mesh);
  }

  /** Compile its program ahead of the first flight (once; the same program as the characters', so usually a no-op). */
  load(precompile?: (o: THREE.Object3D) => Promise<unknown>) {
    if (this.compiled || !precompile) return;
    this.compiled = true;
    void precompile(this.rig.mesh).catch(() => { this.compiled = false; });
  }

  get visible() { return this.group.visible; }
  show() { this.want = 1; this.leaving = -1; this.greet = null; this.group.visible = true; }

  /**
   * W5-F (lane C's request, the unlock moment): fly in from `from` and settle on the ground at `at` (its ground height
   * `y`) facing `face`, wings folded, for `seconds` — longer while `hold` is set (the moment's dialogue), never past
   * GREET.maxS — then take off toward `away`. A take-off (`show`) ends it at once: the glide takes the bird.
   */
  startGreet(from: P3, at: P3, face: number, away: number, seconds: number) {
    this.greet = { t: 0, from: { ...from }, at: { x: at.x, y: at.y, z: at.z }, face, away, seconds, travel: Math.atan2(at.x - from.x, at.z - from.z) };
    this.want = 1; this.leaving = -1; this.group.visible = true;
  }
  /** the moment's dialogue is open: the bird waits on (moveSystem sets it each frame) */
  greetHold = false;
  get greeting() { return this.greet !== null; }
  private greet: null | { t: number; from: { x: number; y: number; z: number }; at: { x: number; y: number; z: number }; face: number; away: number; seconds: number; travel: number } = null;

  /** After landing: glide away ahead and vanish. */
  flyOff() {
    const G = this.greet;
    if (G) {
      // (a greeting bird: from where it sits, toward its way out)
      const q = this.group.position;
      this.greet = null;
      this.leaving = 0;
      this.leave = { x: q.x, y: q.y, z: q.z, heading: G.away };
      return;
    }
    const s = this.sim;
    this.leaving = 0;
    this.leave = { x: s.x, y: s.y, z: s.z, heading: s.heading };
  }

  /** Rider seat / BAYBAY seat in world space (after update). */
  seat(which: 'rider' | 'baybay', out: THREE.Vector3): THREE.Vector3 {
    return out.copy(which === 'rider' ? PELICAN_SEATS.rider : PELICAN_SEATS.baybay).applyMatrix4(this.group.matrixWorld);
  }
  get quaternion() { return this.group.quaternion; }

  update(dt: number, t: number) {
    const s = this.sim;
    let x = s.x, y = s.y, z = s.z, heading = s.heading, pitch = s.pitch, roll = s.roll;
    let fold = 0, greetBeat = false;
    const G = this.greet;
    if (G) {
      G.t += dt;
      if (G.t < GREET.inS) {
        // the approach: a descending glide that slows into the spot, turning to face the player, a flare to finish
        const k = G.t / GREET.inS, e = 1 - (1 - k) ** 2.2;
        x = G.from.x + (G.at.x - G.from.x) * e; z = G.from.z + (G.at.z - G.from.z) * e;
        y = G.at.y + GREET.sit + (G.from.y - G.at.y - GREET.sit) * (1 - k) ** 1.6;
        const turn = Math.max(0, (k - 0.6) / 0.4);
        heading = G.travel + Math.atan2(Math.sin(G.face - G.travel), Math.cos(G.face - G.travel)) * turn;
        pitch = k < 0.72 ? -0.16 : 0.5 * ((k - 0.72) / 0.28);
        roll = 0;
        greetBeat = k > 0.55;
      } else {
        // settled: wings folded, a small breathing bob and a look round
        const st = G.t - GREET.inS;
        x = G.at.x; z = G.at.z; y = G.at.y + GREET.sit + Math.sin(st * 2.4) * 0.03;
        heading = G.face + Math.sin(st * 0.9) * 0.12; pitch = 0; roll = 0;
        fold = Math.min(1, st / 0.45);
        if (st > G.seconds && (!this.greetHold || G.t > GREET.maxS)) {
          this.greet = null;
          this.leaving = 0;
          this.leave = { x, y, z, heading: G.away };
          fold = 0;
        }
      }
    }
    if (this.leaving >= 0) {
      this.leaving += dt;
      const L = this.leave;
      const k = this.leaving;
      x = L.x + Math.sin(L.heading) * k * 12; z = L.z + Math.cos(L.heading) * k * 12; y = L.y + k * k * 4 + k * 2;
      heading = L.heading; pitch = 0.35; roll = 0;
      if (k > 1.6) { this.want = 0; }
    }
    this.shown += (this.want - this.shown) * Math.min(1, dt * 7);
    if (this.want === 0 && this.shown < 0.02) { this.group.visible = false; this.leaving = -1; return; }
    this.group.visible = true;
    this.group.position.set(x, y, z);
    tmpE.set(-pitch, heading, roll, 'YXZ');
    this.group.quaternion.setFromEuler(tmpE);
    this.group.scale.setScalar(Math.max(0.01, this.shown));
    // wings: slow soaring flex, a few strong beats on take-off / climbing, lifted into the bank
    const beating = this.beating || greetBeat || s.stage === 'takeoff' || this.leaving >= 0 || pitch > 0.3;
    const rate = beating ? 6.5 : 1.3;
    this.flap += dt * rate;
    const amp = (beating ? 0.5 : 0.06) * (1 - fold);
    const beat = Math.sin(this.flap) * amp;
    const b = this.rig.bones, rest = this.rig.rest;
    b.wingL.rotation.z = beat - roll * 0.25 - fold * 0.12;
    b.wingR.rotation.z = -beat - roll * 0.25 + fold * 0.12;
    // (greeting on the ground) the wings swept back along the body, the hands folded over the tail
    b.wingL.rotation.y = fold * GREET.foldArm; b.wingR.rotation.y = -fold * GREET.foldArm;
    b.tipL.rotation.y = fold * GREET.foldHand; b.tipR.rotation.y = -fold * GREET.foldHand;
    // the hands lag the arms (a soft wave through the wing), the soaring tips flex with the air
    b.tipL.rotation.z = Math.sin(this.flap - 0.7) * amp * 0.7 + Math.sin(t * 1.7) * 0.03 * (1 - fold);
    b.tipR.rotation.z = -Math.sin(this.flap - 0.7) * amp * 0.7 - Math.sin(t * 1.7) * 0.03 * (1 - fold);
    // the body rides the beat, the head holds still in the air (a small counter-nod)
    b.body.position.y = rest.body.y - Math.sin(this.flap) * amp * 0.12;
    b.head.rotation.x = Math.sin(this.flap) * amp * 0.15;
    b.tail.rotation.x = -pitch * 0.2;
    this.group.updateMatrixWorld();
  }

  dispose() {
    this.rig.mesh.geometry.dispose();
    this.rig.mesh.skeleton.dispose();
  }
}
