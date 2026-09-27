import * as THREE from 'three';
import { definePlatform, setPlatformPose } from '../actors/platform';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { CABLE, type TransitData, type Turntable, flineJson, loadTransit, pointAt } from '../data/transit';
import { Batch } from './builder';
import { CABLE_PLATFORM, cableCarFarGeometry, cableCarGeometry } from './cablecar';
import { FerryLayer } from './ferry';
import { setTurntableSpinner } from './sf/landmarks/cable-car-turntable';
import { type FLineLayer, createFLineLayer, flineRailTracks } from './flineLayer';
import { TOY, TOY_DYN, TOY_INST, U } from './materials';
import { RailLayer, residentGround } from './rails';
import { CableSystem, activeCableSystem, setActiveCableSystem } from './transitLine';
import { OWN_DISC_TOP, RING_SEGMENTS, apronInto, discGeometry, progressRingGeometry } from './turntable';

/**
 * City transit layer (lane F, checkpoint F14), hosted by world/streetcar.ts `Streetcars` in city mode and loaded lazily
 * (a separate chunk: district mode never downloads it). Owns:
 *
 * - the cable-car simulation (world/transitLine.ts `CableSystem`, installed as the active system for game/ride.ts);
 * - 6 cable cars as TOY_INST InstancedMeshes: the full car within 110 u of the camera (1 call + its shadow), a
 *   156-triangle far version beyond (1 call, no shadow), none beyond 300 u;
 * - 3 spinning turntable discs (one InstancedMesh), F's static aprons at Hyde & Beach and Taylor & Bay (one Mesh) and
 *   the push progress ring (one Mesh, only while a car turns near the player);
 * - F's rails where the city draws none (world/rails.ts: hero spans, stubs, the Powell/Jackson corner);
 * - the platforms `<lineId>` (actors/platform.ts): the car carrying (or coming for) the rider, else the line's car
 *   nearest the player, with pitch;
 * - the cars' events as `transit` game events near the player (bells, grip clank, turntable push / turned);
 * - the city F-line to the Castro (world/flineLayer.ts: its four streetcars, the platform 'streetcar', its rails);
 * - the rideable ferry (world/ferry.ts: life's ferry 0 after the arrival, Ferry Building ⇄ Pier 41, platform 'ferry').
 *
 * Budget (plan §5.10, vehicles + transit ≤ 8 calls / 20k tris): cars 1 + shadow 1, far cars 1, discs 1 (+ shadow 1),
 * aprons 1, rails 1, ring 1 while pushing: ≤ 8 calls. Triangles: 2,124 a near car (again in the shadow pass), 156 a far
 * one, 812 a disc (+ shadow); e.g. 2 near + 4 far cars and 3 discs ≈ 14k including shadows.
 */

const HEAR = 60;
/** cars farther than this from the camera draw the far version (no shadow) */
const FAR_LOD = 110;
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpP = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);

/** Rough "could the player see this": within 170 u of the camera and less than ~75° off its view line to the player. */
function visibleFromCamera(x: number, z: number): boolean {
  const c = U.uCam.value, p = runtime.player;
  const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
  if (d > 170) return false;
  if (d < 25) return true;
  const fx = p.x - c.x, fz = p.z - c.z, fl = Math.hypot(fx, fz) || 1;
  return (dx * fx + dz * fz) / (d * fl) > 0.25;
}

interface Disc { tt: Turntable; y: number; yaw: number }

export class TransitLayer {
  readonly group = new THREE.Group();
  readonly sys: CableSystem;
  readonly rails: RailLayer;
  private cars: THREE.InstancedMesh;
  private carsFar: THREE.InstancedMesh;
  private discMesh: THREE.InstancedMesh;
  private discs: Disc[] = [];
  private aprons: THREE.Mesh | null = null;
  private ring: THREE.Mesh;
  private ringFor: string | null = null;
  private discYDirty = 0;

  readonly data: TransitData;
  /** the city F-line (null without the published route) */
  readonly fline: FLineLayer | null;
  readonly ferry = new FerryLayer();

  constructor(data: TransitData) {
    this.data = data;
    this.group.name = 'city-transit';
    this.group.matrixAutoUpdate = false;
    this.sys = new CableSystem(data, {
      groundY: residentGround,
      visible: visibleFromCamera,
      viewer: () => ({ x: runtime.player.x, z: runtime.player.z, onFoot: runtime.move.mode === 'foot' }),
    });
    setActiveCableSystem(this.sys);
    for (const line of data.lines) definePlatform(line.id, CABLE_PLATFORM);

    this.cars = new THREE.InstancedMesh(cableCarGeometry(), TOY_INST, this.sys.cars.length);
    this.cars.name = 'cable-cars';
    this.cars.castShadow = true;
    this.cars.receiveShadow = true;
    this.cars.frustumCulled = false;
    this.cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.carsFar = new THREE.InstancedMesh(cableCarFarGeometry(), TOY_INST, this.sys.cars.length);
    this.carsFar.name = 'cable-cars-far';
    this.carsFar.receiveShadow = true;
    this.carsFar.frustumCulled = false;
    this.carsFar.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // turntable discs: aligned with the track at the disc centre
    for (const tt of data.turntables) {
      const line = data.lines.find(l => l.turntableStart === tt || l.turntableEnd === tt)!;
      const at = line.turntableStart === tt ? 0 : line.length;
      const p = pointAt(line, at);
      this.discs.push({ tt, y: p.y, yaw: p.heading });
    }
    this.discMesh = new THREE.InstancedMesh(discGeometry(), TOY_INST, Math.max(1, this.discs.length));
    this.discMesh.name = 'turntable-discs';
    this.discMesh.receiveShadow = true;
    this.discMesh.castShadow = true;
    this.discMesh.frustumCulled = false;
    this.discMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.ring = new THREE.Mesh(progressRingGeometry(), TOY_DYN);
    this.ring.name = 'turntable-progress';
    this.ring.matrixAutoUpdate = false;
    this.ring.visible = false;
    this.ring.renderOrder = 2;

    this.fline = createFLineLayer(flineJson(), visibleFromCamera, residentGround);
    this.rails = new RailLayer(data, this.fline ? flineRailTracks(this.fline.line) : []);
    // D2's Powell & Market landmark drops its static disc top under F's spinning disc (its lod 0 rebuilds)
    if (this.discs.some(d => d.tt.landmark)) setTurntableSpinner(true);
    this.group.add(this.cars, this.carsFar, this.discMesh, this.ring, this.rails.mesh);
    if (this.fline) this.group.add(this.fline.group);
    this.refreshDiscHeights(true);
    this.update(0, 0);
    this.group.updateMatrixWorld(true);
  }

  /** Disc and apron heights follow the terrain once it is exact there (the apron mesh is rebuilt then). */
  private refreshDiscHeights(force = false) {
    let changed = force;
    for (const d of this.discs) {
      const g = residentGround(d.tt.x, d.tt.z);
      if (g === null) continue;
      const y = d.tt.landmark ? g + 0.005 : g + OWN_DISC_TOP;
      if (Math.abs(y - d.y) > 1e-3) { d.y = y; changed = true; }
    }
    if (!changed) return;
    if (this.aprons) { this.group.remove(this.aprons); this.aprons.geometry.dispose(); }
    const b = new Batch();
    for (const d of this.discs) if (!d.tt.landmark) apronInto(b, d.tt.x, d.y - OWN_DISC_TOP, d.tt.z);
    this.aprons = new THREE.Mesh(b.build(), TOY);
    this.aprons.name = 'turntable-aprons';
    this.aprons.matrixAutoUpdate = false;
    this.aprons.receiveShadow = true;
    this.group.add(this.aprons);
    this.aprons.updateMatrixWorld(true);
  }

  update(dt: number, t: number) {
    const sys = this.sys;
    sys.step(dt);
    const cam = U.uCam.value, p = runtime.player;
    // cars
    // cars within range are packed to the front of the near (≤ FAR_LOD, with shadows) or the far mesh; each draw covers
    // only its cars, so hidden ones cost no triangles
    let n = 0, nf = 0;
    for (const car of sys.cars) {
      const q = car.pose;
      const d = Math.hypot(q.x - cam.x, q.z - cam.z);
      if (d > CABLE.hideBeyond) continue;
      tmpQ.setFromEuler(tmpE.set(-q.pitch, q.heading, q.roll, 'YXZ'));
      tmpM.compose(tmpP.set(q.x, q.y, q.z), tmpQ, ONE);
      if (d > FAR_LOD) this.carsFar.setMatrixAt(nf++, tmpM); else this.cars.setMatrixAt(n++, tmpM);
    }
    this.cars.count = n;
    this.cars.instanceMatrix.needsUpdate = true;
    this.cars.visible = n > 0;
    this.carsFar.count = nf;
    this.carsFar.instanceMatrix.needsUpdate = true;
    this.carsFar.visible = nf > 0;
    // platforms: the rider's car, else each line's car nearest the player
    for (const line of this.data.lines) {
      let car = sys.riderCarOf(line.id);
      if (!car) {
        let bd = Infinity;
        for (const c of sys.cars) { if (c.line !== line) continue; const d = Math.hypot(c.pose.x - p.x, c.pose.z - p.z); if (d < bd) { bd = d; car = c; } }
      }
      if (car) setPlatformPose(line.id, car.pose, dt);
    }
    // discs (+ the progress ring for a turn near the player)
    if ((this.discYDirty -= dt) <= 0) { this.discYDirty = 1; this.refreshDiscHeights(); }
    let discs = 0, ringTT: Disc | null = null, ringK = 0;
    for (const d of this.discs) {
      if (Math.hypot(d.tt.x - cam.x, d.tt.z - cam.z) > CABLE.hideBeyond) continue;
      const turning = sys.turningAt(d.tt.id);
      const yaw = d.yaw + (turning ? turning.turn : 0);
      tmpQ.setFromEuler(tmpE.set(0, yaw, 0, 'YXZ'));
      this.discMesh.setMatrixAt(discs++, tmpM.compose(tmpP.set(d.tt.x, d.y, d.tt.z), tmpQ, ONE));
      if (turning && Math.hypot(d.tt.x - p.x, d.tt.z - p.z) < 26) { ringTT = d; ringK = turning.turn / Math.PI; }
    }
    this.discMesh.count = discs;
    this.discMesh.instanceMatrix.needsUpdate = true;
    this.discMesh.visible = discs > 0;
    const rt = ringTT as Disc | null;
    this.ring.visible = !!rt;
    if (rt) {
      if (this.ringFor !== rt.tt.id) {
        this.ringFor = rt.tt.id;
        this.ring.matrix.makeRotationY(rt.yaw).setPosition(rt.tt.x, rt.y, rt.tt.z);
        this.ring.matrixWorldNeedsUpdate = true;
      }
      this.ring.geometry.setDrawRange(0, Math.max(1, Math.round(ringK * RING_SEGMENTS)) * 6);
    } else this.ringFor = null;
    this.rails.update(dt);
    this.drainEvents();
    this.fline?.update(dt);
    this.ferry.update(dt);
    void t;
  }

  /** The cars' events → `transit` game events: the rider's car always, other cars within earshot. */
  private drainEvents() {
    const sys = this.sys, p = runtime.player;
    const rider = sys.rideStatus();
    for (const e of sys.events) {
      const car = sys.cars[e.car];
      const d = Math.hypot(car.pose.x - p.x, car.pose.z - p.z);
      const mine = !!rider && rider.car === e.car && car.rider;
      const heard = mine || d < HEAR;
      const base = { type: 'transit' as const, line: e.line, kind: 'cable-car' as const };
      switch (e.what) {
        case 'depart':
          if (mine) emit({ ...base, what: 'depart' });
          if (heard) emit({ ...base, what: 'bell', strength: mine ? 1 : Math.max(0.2, 1 - d / HEAR) });
          break;
        case 'grip': if (heard) emit({ ...base, what: 'grip', strength: mine ? 1 : Math.max(0.2, 1 - d / HEAR) }); break;
        case 'arrive': if (mine) emit({ ...base, what: 'arrive' }); break;
        case 'bell': if (heard) emit({ ...base, what: 'bell', strength: 0.8 }); break;
        case 'push': emit({ ...base, what: 'push', strength: 1 }); break;
        case 'turned': if (d < HEAR * 1.5) { emit({ ...base, what: 'turned' }); emit({ ...base, what: 'bell', strength: 0.9 }); } break;
        case 'board': emit({ ...base, what: 'board' }); break;
        default: break;
      }
    }
    sys.events.length = 0;
  }

  /** Per-car draw data for QA. */
  stats() {
    return { cars: this.sys.cars.map(c => ({ line: c.line.id, s: +c.s.toFixed(1), dir: c.dir, mode: c.mode, v: +c.v.toFixed(2), station: c.station, pitch: +c.pose.pitch.toFixed(3) })), rails: this.rails.stats(), fline: this.fline?.stats() ?? null };
  }

  dispose() {
    if (activeCableSystem() === this.sys) setActiveCableSystem(null);
    this.cars.geometry.dispose();
    this.carsFar.geometry.dispose();
    this.discMesh.geometry.dispose();
    this.ring.geometry.dispose();
    this.aprons?.geometry.dispose();
    this.rails.dispose();
    this.fline?.dispose();
    this.ferry.dispose();
    setTurntableSpinner(false);
    if (LAYER === this) LAYER = null;
  }
}

let LAYER: TransitLayer | null = null;
/** The live layer (city mode, once transit.json is in), for game/transit.ts and QA. */
export function transitLayer(): TransitLayer | null { return LAYER; }

/** Load transit.json and build the layer (city mode; called once by Streetcars). */
export async function createTransitLayer(): Promise<TransitLayer | null> {
  const data = await loadTransit();
  if (!data) return null;
  LAYER?.dispose();
  LAYER = new TransitLayer(data);
  return LAYER;
}
