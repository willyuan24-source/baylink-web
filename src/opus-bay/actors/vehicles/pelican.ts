import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MODELS } from '../../data/assets';
import { GlideSim } from '../glide';
import { buildWingsRig, PELICAN_RIDE } from './models';
import { sphere, buildRig, type Rig } from '../models';

/**
 * The ride pelican: the existing pelican.glb (standing; "for glide use the same mesh tilted", ASSETS-LEDGER) tilted
 * into a glide and scaled up to carry the newcomer + BAYBAY, plus procedural spread wings (one skinned draw) that
 * bank and flap. Loaded lazily the first time the glide is unlocked / used; until then a clay stand-in body.
 * The flight itself is actors/glide.ts (GlideSim); this only draws it.
 */

const tmpE = new THREE.Euler(0, 0, 0, 'YXZ');

function standInBody(): Rig {
  // a soft clay pelican body (only until the GLB arrives)
  return buildRig([{ name: 'root', parent: null, pos: [0, 0, 0] }], [
    { geo: sphere(0.55, [0, -0.35, -0.1], [1, 0.7, 1.9]), color: '#7a6d60', bone: 'root' },
    { geo: sphere(0.3, [0, -0.05, 1.05], [1, 1, 1.1]), color: '#e8d9b0', bone: 'root' },
    { geo: sphere(0.16, [0, -0.2, 1.45], [0.8, 0.6, 2.4]), color: '#c97a50', bone: 'root' },
  ], { ao: false });
}

export class Pelican {
  readonly group = new THREE.Group();
  readonly sim = new GlideSim();
  private body = new THREE.Group();
  private wings: Rig;
  private standIn: Rig | null;
  private glb: THREE.Mesh | null = null;
  private loading = false;
  /** 0..1 appear / leave scale */
  private shown = 0;
  private want = 0;
  private flap = 0;
  /** after landing: flies off ahead for a moment */
  private leaving = -1;
  private leave = { x: 0, y: 0, z: 0, heading: 0 };

  constructor() {
    this.group.name = 'opus-pelican-ride';
    this.group.visible = false;
    this.wings = buildWingsRig();
    this.wings.mesh.position.copy(PELICAN_RIDE.wings);
    this.wings.mesh.castShadow = true;
    this.standIn = standInBody();
    this.standIn.mesh.castShadow = true;
    this.body.add(this.standIn.mesh);
    this.group.add(this.body, this.wings.mesh);
  }

  /** Start fetching the GLB (once). */
  load(precompile?: (o: THREE.Object3D) => Promise<unknown>) {
    if (this.loading) return;
    this.loading = true;
    new GLTFLoader().loadAsync(MODELS.pelican.url).then(gltf => {
      let mesh: THREE.Mesh | null = null;
      gltf.scene.traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
      const found = mesh as THREE.Mesh | null;
      if (!found) return;
      found.updateWorldMatrix(true, false);
      const geo = found.geometry.clone().applyMatrix4(found.matrixWorld);
      const mat = (Array.isArray(found.material) ? found.material[0] : found.material) as THREE.MeshStandardMaterial;
      if ('roughness' in mat) { mat.roughness = 0.85; mat.metalness = 0; }
      const m = new THREE.Mesh(geo, mat);
      m.name = 'opus-pelican-ride-body';
      m.castShadow = true;
      // stand the model on its tail and lean it forward into a glide, scaled up to carry two
      m.scale.setScalar(PELICAN_RIDE.scale);
      m.rotation.x = PELICAN_RIDE.tilt;
      m.position.copy(PELICAN_RIDE.offset);
      const swap = () => {
        this.glb = m;
        if (this.standIn) { this.body.remove(this.standIn.mesh); this.standIn.mesh.geometry.dispose(); this.standIn.mesh.skeleton.dispose(); this.standIn = null; }
        this.body.add(m);
      };
      const pre = precompile?.(m);
      if (pre) pre.then(swap, swap); else swap();
    }).catch(() => { /* keep the clay stand-in */ });
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
    return out.copy(which === 'rider' ? PELICAN_RIDE.rider : PELICAN_RIDE.baybay).applyMatrix4(this.group.matrixWorld);
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
    // wings: slow soaring flex, a few strong beats on take-off / climbing, dihedral into the bank
    const beating = s.stage === 'takeoff' || this.leaving >= 0 || pitch > 0.3;
    const rate = beating ? 7 : 1.3;
    this.flap += dt * rate;
    const amp = beating ? 0.45 : 0.06;
    const beat = Math.sin(this.flap) * amp;
    const b = this.wings.bones;
    b.wingL.rotation.z = beat - roll * 0.25;
    b.wingR.rotation.z = -beat - roll * 0.25;
    b.tipL.rotation.z = beat * 0.6 + Math.sin(t * 1.7) * 0.03;
    b.tipR.rotation.z = -beat * 0.6 - Math.sin(t * 1.7) * 0.03;
    this.body.position.y = -Math.sin(this.flap) * amp * 0.12;
    this.group.updateMatrixWorld();
  }

  dispose() {
    this.wings.mesh.geometry.dispose();
    this.wings.mesh.skeleton.dispose();
    if (this.standIn) { this.standIn.mesh.geometry.dispose(); this.standIn.mesh.skeleton.dispose(); }
    if (this.glb) { this.glb.geometry.dispose(); }
  }
}
