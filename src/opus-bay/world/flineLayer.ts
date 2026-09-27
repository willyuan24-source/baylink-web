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
import { FLINE_ID, StreetcarSystem } from './flineSystem';
import type { RailTrack } from './rails';
import { carFarGeometry, carGeometry } from './streetcar';

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

  constructor(line: FLine, visible: (x: number, z: number) => boolean, groundY: (x: number, z: number) => number | null) {
    this.line = line;
    this.group.name = 'city-fline';
    this.group.matrixAutoUpdate = false;
    this.sys = new StreetcarSystem(line, {
      groundY,
      visible,
      viewer: () => ({ x: runtime.player.x, z: runtime.player.z, onFoot: runtime.move.mode === 'foot' }),
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

  update(dt: number) {
    const sys = this.sys;
    // a ride the game ended some other way (a trip, a reset): the cars forget the rider
    if (sys.rideStatus() && currentRide()?.line !== FLINE_ID) sys.cancel();
    sys.step(dt);
    const cam = U.uCam.value, p = runtime.player;
    const n = this.near.map(() => 0), nf = this.far.map(() => 0);
    for (const car of sys.cars) {
      const q = car.pose, liv = car.index % LIVERIES.length;
      const d = Math.hypot(q.x - cam.x, q.z - cam.z);
      if (d > HIDE) continue;
      tmpQ.setFromEuler(tmpE.set(-q.pitch, q.heading, q.roll, 'YXZ'));
      tmpM.compose(tmpP.set(q.x, q.y, q.z), tmpQ, ONE);
      if (d > FAR_LOD) this.far[liv].setMatrixAt(nf[liv]++, tmpM); else this.near[liv].setMatrixAt(n[liv]++, tmpM);
    }
    this.near.forEach((m, i) => { m.count = n[i]; m.visible = n[i] > 0; m.instanceMatrix.needsUpdate = true; });
    this.far.forEach((m, i) => { m.count = nf[i]; m.visible = nf[i] > 0; m.instanceMatrix.needsUpdate = true; });
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
export function createFLineLayer(json: TransitLineJson | null, visible: (x: number, z: number) => boolean, groundY: (x: number, z: number) => number | null): FLineLayer | null {
  const line = buildFLine(json ?? undefined, DISTRICT.streetcar);
  return line ? new FLineLayer(line, visible, groundY) : null;
}
