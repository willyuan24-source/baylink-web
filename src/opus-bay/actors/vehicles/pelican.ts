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

// the pelican's program is the characters' clay material on a skinned mesh (the player's own): warm it with the rest
registerWarmup('e2-pelican', () => {
  const rig = buildPelicanRig();
  rig.mesh.castShadow = true;
  return { objects: [rig.mesh], dispose: () => { rig.mesh.geometry.dispose(); rig.mesh.skeleton.dispose(); } };
});

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
  show() { this.want = 1; this.leaving = -1; this.group.visible = true; }

  /** After landing: glide away ahead and vanish. */
  flyOff() {
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
    const beating = this.beating || s.stage === 'takeoff' || this.leaving >= 0 || pitch > 0.3;
    const rate = beating ? 6.5 : 1.3;
    this.flap += dt * rate;
    const amp = beating ? 0.5 : 0.06;
    const beat = Math.sin(this.flap) * amp;
    const b = this.rig.bones, rest = this.rig.rest;
    b.wingL.rotation.z = beat - roll * 0.25;
    b.wingR.rotation.z = -beat - roll * 0.25;
    // the hands lag the arms (a soft wave through the wing), the soaring tips flex with the air
    b.tipL.rotation.z = Math.sin(this.flap - 0.7) * amp * 0.7 + Math.sin(t * 1.7) * 0.03;
    b.tipR.rotation.z = -Math.sin(this.flap - 0.7) * amp * 0.7 - Math.sin(t * 1.7) * 0.03;
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
