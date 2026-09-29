import * as THREE from 'three';
import { setPlatformPose } from '../actors/platform';
import { emitAt } from '../audio/cityHooks';
import { emit } from '../core/events';
import { currentRide } from '../game/ride';
import { runtime } from '../core/runtime';
import { DISTRICT } from '../data/district';
import { FL, type FLine, buildFLine, centreAt, laneOffset, sAtU } from '../data/fline';
import { type TransitLineJson, activeStreetcarSystem, setActiveStreetcarSystem } from '../data/transit';
import { TOY_INST, U } from './materials';
import { type FCar, FLINE_ID, type FLineOptions, StreetcarSystem } from './flineSystem';
import type { RailTrack } from './rails';
import { BOX, Batch, CYL, M } from './builder';
import { CAR_LEN, CAR_Y, carFarGeometry, carGeometry } from './streetcar';
import { roadViewer } from './sf/roadViewer';

/**
 * (W5-T4, plan MF9; in the lazy city chunk rather than world/streetcar.ts, which the main graph carries) The car at a
 * middle distance (city mode, ≈ 45–110 u, drawn without a shadow): the near car's look in ≈ 490 triangles instead of
 * 1,112 — livery, gold belt and cream sill, the open window band (the light inside between six posts a side), header,
 * roof and vents, the rounded cabs in 8-sided pieces with their windscreens, lit signs and head lamps, the pole.
 */
export function carMidGeometry(livery: string): THREE.BufferGeometry {
  const b = new Batch();
  const cream = '#f3ead6', glass = '#3d4d52';
  const L = CAR_LEN - 2, W = 2.1;
  const BELT = 1.02, SILL = 1.14, WIN = 1.26, HEAD = 2.28, ROOF = 2.57;
  b.add(BOX(), M(0, 0.1, 0, 0, W - 0.3, 0.35, L - 1), '#454b48');
  b.add(BOX(), M(0, 0.4, 0, 0, W - 0.06, 0.1, L), '#8f7a62');
  for (const s of [-1, 1]) b.add(BOX(), M(0, 0.05, s * (L / 2 - 1), 0, 1.6, 0.35, 1.8), '#2d3431');
  b.add(BOX(), M(0, 0.5, 0, 0, W, BELT - 0.5, L), livery);
  b.add(BOX(), M(0, BELT, 0, 0, W + 0.02, SILL - BELT, L), '#e0a94a');
  b.add(BOX(), M(0, SILL, 0, 0, W, WIN - SILL, L), cream);
  // the open windows show the light inside of the car between the posts (six a side: the near car has eight)
  b.add(BOX(), M(0, WIN, 0, 0, W - 0.04, HEAD - WIN, L), '#d6c8a8');
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) b.add(BOX(), M(s * (W / 2 - 0.04), WIN, -L / 2 + 0.12 + i * ((L - 0.24) / 5), 0, 0.08, HEAD - WIN, 0.16), cream);
  b.add(BOX(), M(0, HEAD, 0, 0, W, ROOF - HEAD, L), cream);
  b.add(BOX(), M(0, ROOF, 0, 0, W - 0.2, 0.22, L + 0.8), '#d9d4c7');
  b.add(BOX(), M(0, ROOF + 0.22, 0, 0, 0.9, 0.18, L * 0.6), '#bdb7aa');
  for (const s of [-1, 1]) {
    b.add(CYL(8), M(0, 0.5, s * L / 2, 0, W / 2, SILL - 0.5, 1.0), livery);
    b.add(CYL(8), M(0, SILL, s * L / 2, 0, W / 2, ROOF - SILL, 1.0), cream);
    b.add(BOX(), M(0, 1.45, s * (L / 2 + 0.72), s > 0 ? 0 : Math.PI, 1.3, 0.75, 0.35), glass);
    b.add(BOX(), M(0, 2.3, s * (L / 2 + 0.55), 0, 1.0, 0.26, 0.3), '#ffcf7a', [0, 0, 0, 1]);
    b.add(BOX(), M(0, 0.8, s * (L / 2 + 0.9), 0, 0.26, 0.2, 0.12), '#fff4d0', [0, 0, 0, 1]);
  }
  // the trolley pole, trailing up to the wire (as the near car's)
  const base = new THREE.Matrix4().makeTranslation(0, 2.9 - CAR_Y, -1.8).multiply(new THREE.Matrix4().makeRotationX(-0.71));
  b.add(BOX(), base.clone().multiply(M(0, 0, 0, 0, 0.08, 2.9, 0.08)), '#2a2a2a');
  return b.build();
}

/**
 * The city F-line (lane F, checkpoint F7): part of the lazy transit layer (world/transitLayer.ts), city mode only.
 * Owns the streetcar simulation (world/flineSystem.ts, installed as the active streetcar system for game/ride.ts), the
 * four vintage cars as TOY_INST InstancedMeshes (one per livery: full car within 110 u with shadow, a few-box far car
 * beyond, none beyond 320 u), the platform 'streetcar' (the rider's car, else the car nearest the player) and the
 * `runtime.streetcar` mirror, the cars' events near the player, and the extra rails F draws for it (world/rails.ts):
 * the foot of Market inside the slab, the switch ramps and the passing places on Market Street.
 * Budget: ≤ 4 calls + 2 shadow calls; a near car is ≈ 2.2k triangles (again in the shadow pass), a far one 84.
 */

const LIVERIES = ['#2f7d5a', '#e0874a'];
/** the cars' two liveries (car i has livery i % 2): the transit layer draws them in lane T's fleet meshes (setDrawer) */
export const FLINE_LIVERIES: readonly string[] = LIVERIES;
const FAR_LOD = 110;
const HIDE = 320;
const HEAR = 48;
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpP = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);

/** A polyline track (x, y, z triples + arc table) for the rail layer. */
function trackOf(pts: { x: number; y: number; z: number }[]): RailTrack['track'] {
  const xyz = new Float32Array(pts.length * 3), cum = new Float32Array(pts.length);
  pts.forEach((p, i) => {
    xyz[i * 3] = p.x; xyz[i * 3 + 1] = p.y; xyz[i * 3 + 2] = p.z;
    if (i) cum[i] = cum[i - 1] + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
  });
  return { xyz, cum, length: cum[cum.length - 1] };
}

/** A lane of C from s0 to s1 (the lane offset of `dir`, or the centre with dir 0). */
function laneTrack(line: FLine, s0: number, s1: number, dir: 1 | -1 | 0): RailTrack['track'] {
  const pts: { x: number; y: number; z: number }[] = [];
  const n = Math.max(2, Math.ceil((s1 - s0) / 1));
  for (let k = 0; k <= n; k++) {
    const s = s0 + ((s1 - s0) * k) / n;
    const c = centreAt(line, s), o = dir ? laneOffset(line, s, dir) : 0;
    // right-hand normal of the heading (sin h, cos h): (cos h, −sin h)
    pts.push({ x: c.x + Math.cos(c.heading) * o, y: c.y, z: c.z - Math.sin(c.heading) * o });
  }
  return trackOf(pts);
}

/** The rails F lays for the city F-line (pure: the tests check them): in the slab, the switch, the passing sidings. */
export function flineRailTracks(line: FLine): RailTrack[] {
  const out: RailTrack[] = [];
  const sSlabEdge = line.sSlab + 6; // z ≈ 114: the slab edge on Market (the city draws Market up to it)
  const rampTop = line.sJoin - FL.switchRamp;
  out.push({ track: laneTrack(line, sSlabEdge, rampTop, 0), cable: false });
  for (const dir of [1, -1] as const) out.push({ track: laneTrack(line, rampTop, line.sJoin + 0.5, dir), cable: false });
  for (let k = 1; k < line.bounds.length - 1; k++) {
    const b = line.bounds[k], r = FL.passHalf + FL.passRamp;
    for (const dir of [1, -1] as const) out.push({ track: laneTrack(line, b - r, b + r, dir), cable: false });
  }
  return out;
}

export class FLineLayer {
  readonly group = new THREE.Group();
  readonly sys: StreetcarSystem;
  readonly line: FLine;
  private near: THREE.InstancedMesh[] = [];
  private far: THREE.InstancedMesh[] = [];

  constructor(line: FLine, visible: (x: number, z: number) => boolean, groundY: (x: number, z: number) => number | null, opts: Pick<FLineOptions, 'roadAhead' | 'hurryDwell'> = {}) {
    this.line = line;
    this.group.name = 'city-fline';
    this.group.matrixAutoUpdate = false;
    this.sys = new StreetcarSystem(line, {
      groundY,
      visible,
      // (W6-B) the player on foot or in their bike / toy car (world/sf/roadViewer.ts): no transit drives through either
      viewer: roadViewer,
      roadAhead: opts.roadAhead,
      hurryDwell: opts.hurryDwell,
    });
    setActiveStreetcarSystem(this.sys);
    const perLivery = Math.ceil(this.sys.cars.length / LIVERIES.length);
    for (const livery of LIVERIES) {
      const near = new THREE.InstancedMesh(carGeometry(livery, true), TOY_INST, perLivery);
      near.name = 'fline-cars';
      near.castShadow = true;
      near.receiveShadow = true;
      near.frustumCulled = false;
      near.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const far = new THREE.InstancedMesh(carFarGeometry(livery), TOY_INST, perLivery);
      far.name = 'fline-cars-far';
      far.receiveShadow = true;
      far.frustumCulled = false;
      far.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.near.push(near);
      this.far.push(far);
      this.group.add(near, far);
    }
    this.update(0);
  }

  /**
   * (review) False while the hero loop (world/streetcar.ts) still carries a ride that began before this layer came in:
   * the cars keep running but are not drawn, and the platform 'streetcar', runtime.streetcar and the bells stay the
   * hero loop's (two sets of cars on the hero track, and the rider switched onto another car, otherwise).
   */
  get active(): boolean { return this.isActive; }
  setActive(on: boolean) {
    if (on === this.isActive) return;
    this.isActive = on;
    this.group.visible = on;
  }
  /**
   * Wave 4 (lane T, W4-T14): draw the cars through someone else's meshes (world/sf/lineFleet.ts drawExtra: every city
   * line's vehicles in 2 calls + 1 shadow call, a shadow only near the camera) instead of this layer's own InstancedMeshes.
   * `fn(car index, pose, hidden)` is called for every car every frame (hidden: inactive, or beyond 320 u).
   */
  setDrawer(fn: ((car: number, pose: FCar['pose'], hidden: boolean) => void) | null) {
    this.drawer = fn;
    for (const m of [...this.near, ...this.far]) { m.visible = false; m.count = 0; }
    if (fn) this.group.remove(...this.near, ...this.far);
    else this.group.add(...this.near, ...this.far);
  }
  private drawer: ((car: number, pose: FCar['pose'], hidden: boolean) => void) | null = null;
  private isActive = true;
  /** instances per livery this frame (near / far), reused */
  private readonly nNear = [0, 0];
  private readonly nFar = [0, 0];

  update(dt: number) {
    const sys = this.sys;
    // a ride the game ended some other way (a trip, a reset): the cars forget the rider
    if (sys.rideStatus() && currentRide()?.line !== FLINE_ID) sys.cancel();
    sys.step(dt);
    const cam = U.uCam.value, p = runtime.player;
    const draw = this.drawer;
    if (!this.isActive) {
      if (draw) for (const car of sys.cars) draw(car.index, car.pose, true);
      sys.events.length = 0;
      return;
    }
    const n = this.nNear, nf = this.nFar;
    n.fill(0); nf.fill(0);
    if (draw) for (const car of sys.cars) draw(car.index, car.pose, Math.hypot(car.pose.x - cam.x, car.pose.z - cam.z) > HIDE);
    else for (const car of sys.cars) {
      const q = car.pose, liv = car.index % LIVERIES.length;
      const d = Math.hypot(q.x - cam.x, q.z - cam.z);
      if (d > HIDE) continue;
      tmpQ.setFromEuler(tmpE.set(-q.pitch, q.heading, q.roll, 'YXZ'));
      tmpM.compose(tmpP.set(q.x, q.y, q.z), tmpQ, ONE);
      if (d > FAR_LOD) this.far[liv].setMatrixAt(nf[liv]++, tmpM); else this.near[liv].setMatrixAt(n[liv]++, tmpM);
    }
    if (!draw) for (let i = 0; i < LIVERIES.length; i++) {
      const m = this.near[i], f = this.far[i];
      m.count = n[i]; m.visible = n[i] > 0; m.instanceMatrix.needsUpdate = true;
      f.count = nf[i]; f.visible = nf[i] > 0; f.instanceMatrix.needsUpdate = true;
    }
    // the platform and the runtime mirror: the car serving the rider, else the car nearest the player
    let car = sys.riderCarOf(FLINE_ID);
    if (!car) {
      let bd = Infinity;
      for (const c of sys.cars) { const d = Math.hypot(c.pose.x - p.x, c.pose.z - p.z); if (d < bd) { bd = d; car = c; } }
    }
    if (car) {
      setPlatformPose(FLINE_ID, car.pose, dt);
      const sc = runtime.streetcar, s = sAtU(this.line, car.u);
      sc.x = car.pose.x; sc.z = car.pose.z; sc.heading = car.pose.heading;
      sc.t = s >= this.line.sJoin ? Math.min(1, (s - this.line.sJoin) / Math.max(1, this.line.clen - this.line.sJoin)) : 0;
      sc.atStop = car.mode === 'dwell' ? this.line.stops[car.at]?.station ?? null : null;
    }
    this.drainEvents();
  }

  /** The cars' events: bells near the player (the district's streetcar bell), the rider's own as `transit` events. */
  private drainEvents() {
    const sys = this.sys, p = runtime.player, rider = sys.rideStatus();
    for (const e of sys.events) {
      const car = sys.cars[e.car];
      const d = Math.hypot(car.pose.x - p.x, car.pose.z - p.z);
      const mine = !!rider && rider.car === e.car && car.rider;
      const base = { type: 'transit' as const, line: FLINE_ID, kind: 'streetcar' as const };
      switch (e.what) {
        // another car's bell comes from where that car is (audio pans it: audio/cityHooks emitAt)
        case 'depart':
          if (mine) emit({ type: 'streetcar-bell' });
          else if (d < HEAR) emitAt({ type: 'streetcar-bell' }, car.pose.x, car.pose.z);
          if (mine) emit({ ...base, what: 'depart' });
          break;
        case 'arrive': if (mine) emit({ ...base, what: 'arrive' }); break;
        case 'bell': if (d < HEAR) { if (mine) emit({ type: 'streetcar-bell' }); else emitAt({ type: 'streetcar-bell' }, car.pose.x, car.pose.z); } break;
        case 'board': emit({ ...base, what: 'board' }); break;
        default: break;
      }
    }
    sys.events.length = 0;
  }

  stats() {
    return { cars: this.sys.cars.map(c => ({ u: +c.u.toFixed(1), s: +sAtU(this.line, c.u).toFixed(1), mode: c.mode, v: +c.v.toFixed(2), at: this.line.stops[c.at]?.station ?? null, blocks: [...c.blocks], rider: c.rider })) };
  }

  dispose() {
    if (activeStreetcarSystem() === this.sys) setActiveStreetcarSystem(null);
    for (const m of [...this.near, ...this.far]) m.geometry.dispose();
  }
}

/** Build the city F-line layer from the published route (null without it). */
export function createFLineLayer(json: TransitLineJson | null, visible: (x: number, z: number) => boolean, groundY: (x: number, z: number) => number | null, opts: Pick<FLineOptions, 'roadAhead' | 'hurryDwell'> = {}): FLineLayer | null {
  const line = buildFLine(json ?? undefined, DISTRICT.streetcar);
  return line ? new FLineLayer(line, visible, groundY, opts) : null;
}
