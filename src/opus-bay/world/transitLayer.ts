import * as THREE from 'three';
import { definePlatform, setPlatformPose } from '../actors/platform';
import { emitAt } from '../audio/cityHooks';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { CABLE, type TransitData, type Turntable, activeLineFleet, flineJson, loadTransit, pointAt, setActiveLineFleet, transitW4 } from '../data/transit';
import { currentRide, isLineRide } from '../game/ride';
import { Batch } from './builder';
import { cityStreamerLazy } from './cityLoader';
import { trackPoint } from './lineTrack';
import { CABLE_PLATFORM, cableCarFarGeometry, cableCarGeometry } from './cablecar';
import { FerryLayer } from './ferry';
import { setTurntableSpinner } from './sf/landmarks/cable-car-turntable';
import { FLINE_LIVERIES, type FLineLayer, createFLineLayer, flineRailTracks } from './flineLayer';
import { carFarGeometry, carGeometry } from './streetcar';
import { TOY, TOY_DYN, TOY_INST, U } from './materials';
import { RailLayer, residentGround } from './rails';
import { CityLife } from './sf/cityLife';
import type { TransitPortal } from './sf/format';
import { LineFleet, busInterlocks } from './sf/lineFleet';
import { boxBlocked, busAheadOfFCar, interlockLines } from './sf/lineInterlocks';
import { type RoadVehicle, collectRoadVehicles, registerRoadVehicles, registerTransitStreet } from './sf/streetNet';
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
 * - the rideable ferry (world/ferry.ts: life's ferry 0 after the arrival, Ferry Building ⇄ Pier 41, platform 'ferry');
 * - the city's crowd and toy traffic (world/sf/cityLife.ts, F11 / F12): the cable cars and the F-line are published to
 *   them as road vehicles (walkers hop aside, cars wait) and their streets as transit streets (no toy traffic along them);
 * - wave 4 (lane T): the sightseeing buses and the Muni Metro N / M (world/sf/lineFleet.ts: buses, LRVs, the stop poles,
 *   kiosks and four portals), installed as `activeLineFleet()`. Buses wait at their interlock boxes for a cable car (and
 *   cable cars for a bus in them: CableSystem.free) or an F-line car in the shared stretch; buses and visible trains are
 *   road vehicles, the surface Metro tracks transit streets; a portal the rider's train heads for is streamed in first
 *   (`portalReady`), and the rider's bus / surface train streams the next 200 u of its line ahead (prefetch).
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
  /** the crowd and the toy traffic (built once the walking graph is in) */
  readonly life: CityLife;
  /** wave 4: the loop buses and the Metro trains (null without the wave-4 lines in transit.json) */
  readonly lines: LineFleet | null = null;
  private offs: (() => void)[] = [];
  /** portals asked of the streamer (whenReady) and when they were ready (ms), by position */
  private portals = new Map<string, { asked: number; ready: number }>();
  private prefetchT = 0;
  private prefetching = false;

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

    this.fline = createFLineLayer(flineJson(), visibleFromCamera, residentGround, { roadAhead: car => this.busAhead(car) });
    this.rails = new RailLayer(data, this.fline ? flineRailTracks(this.fline.line) : []);
    // D2's Powell & Market landmark drops its static disc top under F's spinning disc (its lod 0 rebuilds)
    if (this.discs.some(d => d.tt.landmark)) setTurntableSpinner(true);
    this.group.add(this.cars, this.carsFar, this.discMesh, this.ring, this.rails.mesh);
    if (this.fline) this.group.add(this.fline.group);
    // the crowd and the traffic: the transit streets are theirs to cross, not to drive along; the cars are road vehicles
    this.life = new CityLife({ visible: visibleFromCamera });
    this.group.add(this.life.group);
    for (const line of data.lines) this.offs.push(registerTransitStreet(line.xyz));
    if (this.fline) this.offs.push(registerTransitStreet(this.fline.line.cxyz));
    this.offs.push(registerRoadVehicles(out => this.roadVehicles(out)));
    // wave 4 (lane T): the sightseeing loop and the Muni Metro
    const w4 = transitW4();
    if (w4) {
      // every city line's vehicles in the fleet's two batched meshes (W4-T14): the cable cars and the F-line cars too,
      // a shadow only within SHADOW_NEAR of the camera (C2 w3 part b request 3)
      const perLivery = this.fline ? Math.ceil(this.fline.sys.cars.length / FLINE_LIVERIES.length) : 0;
      const extra = [
        { key: 'cable', near: cableCarGeometry(), far: cableCarFarGeometry(), count: this.sys.cars.length },
        ...(this.fline ? FLINE_LIVERIES.map((c, li) => ({ key: `fline-${li}`, near: carGeometry(c, true), far: carFarGeometry(c), count: perLivery })) : []),
      ];
      const lines = new LineFleet({ loop: w4.loop, metro: w4.metro, props: w4.props, extra }, {
        groundY: residentGround,
        visible: visibleFromCamera,
        viewer: () => ({ x: runtime.player.x, z: runtime.player.z, onFoot: runtime.move.mode === 'foot' }),
        portalReady: p => this.portalReady(p),
        boxes: bt => busInterlocks(bt, interlockLines(this.data, this.fline), (line, b0, b1) => boxBlocked(this.sys, this.fline, line, b0, b1)),
        roadUsers: out => collectRoadVehicles(out),
      });
      this.lines = lines;
      this.group.add(lines.group);
      setActiveLineFleet(lines);
      this.group.remove(this.cars, this.carsFar);
      const nl = FLINE_LIVERIES.length;
      this.fline?.setDrawer((i, pose, hidden) => lines.drawExtra(`fline-${i % nl}`, Math.floor(i / nl), pose, hidden, U.uCam.value));
      for (const run of LineFleet.surfaceRuns(w4.metro)) this.offs.push(registerTransitStreet(run));
      this.offs.push(registerRoadVehicles(out => lines.roadVehicles(out, runtime.player)));
    }
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
    const lines = this.lines;
    for (const car of sys.cars) {
      const q = car.pose;
      const d = Math.hypot(q.x - cam.x, q.z - cam.z);
      // wave 4: drawn by the fleet's batched meshes (near with a shadow ≤ 60 u, the full car ≤ 110 u, the far car)
      if (lines) { lines.drawExtra('cable', car.index, q, d > CABLE.hideBeyond, cam); continue; }
      if (d > CABLE.hideBeyond) continue;
      tmpQ.setFromEuler(tmpE.set(-q.pitch, q.heading, q.roll, 'YXZ'));
      tmpM.compose(tmpP.set(q.x, q.y, q.z), tmpQ, ONE);
      if (d > FAR_LOD) this.carsFar.setMatrixAt(nf++, tmpM); else this.cars.setMatrixAt(n++, tmpM);
    }
    if (!lines) {
      this.cars.count = n;
      this.cars.instanceMatrix.needsUpdate = true;
      this.cars.visible = n > 0;
      this.carsFar.count = nf;
      this.carsFar.instanceMatrix.needsUpdate = true;
      this.carsFar.visible = nf > 0;
    }
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
    this.lines?.update(dt, cam, p);
    this.prefetch(dt);
    this.life.update(dt);
    void t;
  }

  /** An F-line car's view down its track: a bus ahead, or a shared box a bus is in (world/sf/lineInterlocks.ts). */
  private busAhead(car: { u: number }): number {
    return this.lines && this.fline ? busAheadOfFCar(this.lines, this.fline, car) : Infinity;
  }

  /**
   * The rider's train heads for a portal: is the surface there streamed in? (the streamer's whenReady(portal, 150),
   * asked once and re-asked after 10 s; a ready answer holds 20 s). No streamer: nothing to wait for.
   */
  private portalReady(p: TransitPortal): boolean {
    const s = cityStreamerLazy();
    if (!s) return true;
    const key = `${Math.round(p.x)},${Math.round(p.z)}`;
    const now = performance.now();
    const e = this.portals.get(key);
    if (e && e.ready > 0 && now - e.ready < 20000) return true;
    if (!e || now - e.asked > 10000) {
      const rec = { asked: now, ready: 0 };
      this.portals.set(key, rec);
      void s.whenReady({ x: p.x, z: p.z }, 150).then(() => { rec.ready = performance.now(); });
    }
    return false;
  }

  /**
   * W4-T11: while the rider's bus / surface train moves, stream the next 200 u of its line (one whenReady at a time,
   * 90 u round the point 200 u ahead; every 0.5 s once the last one landed or after 3 s).
   */
  private prefetch(dt: number) {
    const f = this.lines, r = currentRide();
    if (!f || !isLineRide(r) || r.mode === 'wait') return;
    if ((this.prefetchT -= dt) > 0) return;
    const s = cityStreamerLazy();
    if (!s) return;
    let pt: { x: number; z: number } | null = null;
    const bus = f.bus.riderCarOf(r.line);
    if (bus && bus.v > 2) pt = trackPoint(f.bus.track, bus.s + 200);
    const train = f.rail.riderCarOf(r.line);
    if (train && !train.hidden && Math.abs(train.v) > 2) pt = trackPoint(train.track, train.s + train.dir * 200);
    if (!pt) { this.prefetchT = 0.5; return; }
    if (this.prefetching && this.prefetchT > -2.5) return;
    this.prefetching = true;
    this.prefetchT = 0.5;
    void s.whenReady({ x: pt.x, z: pt.z }, 90).then(() => { this.prefetching = false; });
  }

  /** The cable cars and the F-line cars within 250 u of the player as road vehicles (crowd hop, traffic give-way). */
  private roadVehicles(out: RoadVehicle[]) {
    const p = runtime.player;
    for (const c of this.sys.cars) {
      const q = c.pose;
      if (Math.abs(q.x - p.x) > 250 || Math.abs(q.z - p.z) > 250) continue;
      out.push({ x: q.x, z: q.z, heading: q.heading, v: c.mode === 'turn' ? 0 : Math.abs(c.v), halfL: CABLE.length / 2, halfW: CABLE.width / 2, kind: 'cable-car', line: c.line.id });
    }
    for (const c of this.fline?.sys.cars ?? []) {
      const q = c.pose;
      if (Math.abs(q.x - p.x) > 250 || Math.abs(q.z - p.z) > 250) continue;
      out.push({ x: q.x, z: q.z, heading: q.heading, v: Math.abs(c.v), halfL: 4.3, halfW: 1.1, kind: 'streetcar', line: 'f-line' });
    }
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
      // another car's bell / clank comes from where that car is (audio pans it); the rider's own is centred.
      // `strength` is the loudness audio plays it at (and BAYBAY's "a bell close by" line wants ≥ 0.4): by distance
      const near = mine ? 1 : Math.max(0.2, 1 - d / HEAR);
      const at = (ev: Parameters<typeof emit>[0]) => { if (mine) emit(ev); else emitAt(ev, car.pose.x, car.pose.z); };
      switch (e.what) {
        case 'depart':
          if (mine) emit({ ...base, what: 'depart' });
          if (heard) at({ ...base, what: 'bell', strength: near });
          break;
        case 'grip': if (heard) at({ ...base, what: 'grip', strength: near }); break;
        case 'arrive': if (mine) emit({ ...base, what: 'arrive' }); break;
        case 'bell': if (heard) at({ ...base, what: 'bell', strength: mine ? 1 : 0.8 * near }); break;
        case 'push': emit({ ...base, what: 'push', strength: 1 }); break;
        // (review) the rumble and the bell of a car that has turned were full loudness out to 90 u
        case 'turned': if (mine || d < HEAR * 1.5) {
          const k = mine ? 1 : Math.max(0.2, 1 - d / (HEAR * 1.5));
          at({ ...base, what: 'turned', strength: k });
          at({ ...base, what: 'bell', strength: 0.9 * k });
        } break;
        case 'board': emit({ ...base, what: 'board' }); break;
        default: break;
      }
    }
    sys.events.length = 0;
  }

  /** Per-car draw data for QA. */
  stats() {
    return { cars: this.sys.cars.map(c => ({ line: c.line.id, s: +c.s.toFixed(1), dir: c.dir, mode: c.mode, v: +c.v.toFixed(2), station: c.station, pitch: +c.pose.pitch.toFixed(3) })), rails: this.rails.stats(), fline: this.fline?.stats() ?? null, life: this.life.stats(), lines: this.lines?.stats() ?? null };
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
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.life.dispose();
    if (this.lines) { if (activeLineFleet() === this.lines) setActiveLineFleet(null); this.lines.dispose(); }
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
  // QA (DEV): the live layer (window.__opusBay.transitLayer: stats, the meshes for per-part budgets)
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = { ...(w.__opusBay ?? {}), transitLayer: LAYER };
  }
  return LAYER;
}
