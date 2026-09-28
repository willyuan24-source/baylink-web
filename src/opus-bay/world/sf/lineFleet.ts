import * as THREE from 'three';
import { definePlatform, platforms, setPlatformPose } from '../../actors/platform';
import { emitAt } from '../../audio/cityHooks';
import { emit } from '../../core/events';
import { W4_LINES, stationAttractions } from '../../data/sf/stationNames';
import { BUS, type Bus, type BusEvent, BusSystem, type InterlockBox, busTrack } from '../busSystem';
import { type LineTrack, proximitySpans } from '../lineTrack';
import { LRV, LightRailSystem, type RailEvent, TRAIN_LENGTH, type Train, railTrack } from '../lightRail';
import { patchToyShader } from '../materials';
import type { CarPose } from '../transitLine';
import { registerWarmup } from '../warmup';
import type { TransitLine, TransitPortal } from './format';
import { LRV_PLATFORM, lrvCarFarGeometry, lrvCarGeometry } from './lrv';
import { type PortalPlacement, portalGeometry, portalPlacements } from './portals';
import { type StationProp, busPoleGeometry, kioskGeometry, railStopGeometry, stationGeometryKey, stationProps } from './stations';
import type { RoadVehicle } from './streetNet';
import { TOUR_BUS_PLATFORM, tourBusFarGeometry, tourBusGeometry } from './tourBus';

/**
 * The wave-4 lines in the world (lane T): the sightseeing buses and the Muni Metro trains, their stops, kiosks and the
 * four portals. A self-contained layer for the lazy city transit chunk (integration: world/transitLayer.ts creates it
 * next to the cable cars; nothing here is imported by the main graph).
 *
 * Draw calls (plan §3.7: vehicles + transit ≤ 8 calls / 20k tris with the cable cars):
 *   - `near`   one BatchedMesh: buses + LRV cars within FAR_LOD (bus, N car, M car geometries), casts + receives
 *              shadows: 1 call + 1 in the shadow pass;
 *   - `far`    one BatchedMesh: the far bus / far cars (FAR_LOD … 300 u), no shadows: 1 call;
 *   - `props`  one BatchedMesh: every stop pole, kiosk, surface stop and the four portals, each hidden beyond 300 u
 *              and frustum-culled per item: 1 call.
 *   Each batched mesh has its own material instance (one per object kind and shadow flag, wave-3 P2); `near` is a new
 *   program variant (batching + colour + shadows), registered for warm-up; `far` / `props` reuse the L1 / L2 pool
 *   program (batching + colour, no shadow receive). Integration: the cable cars move into `near` / `far` too (their
 *   geometries join the same meshes: 2 fewer calls for F's layer), the turntable aprons into `props`.
 * Platforms: `sf-loop` (the upper deck), `n-judah`, `m-ocean-view` (the lead car) — the rider's vehicle, else the one
 * nearest the player. Events: the rider's approach / arrive / depart / board as `transit` game events with the station
 * and its attraction (lane C narrates, lane G biases the camera); other vehicles' arrivals / departures, horns and gongs
 * within earshot (doors have no event: arrive / depart carry the door chime, `bell` is the stop request's ding).
 */

/** The main attraction a stop serves (the `transit` event's `attraction`), or undefined. */
const stopAttraction = (station: string | null | undefined): string | undefined => (station ? stationAttractions(station)[0] : undefined);

/** vehicles farther than this from the camera draw the far version (no shadow) */
export const FAR_LOD = 110;
export const HIDE_BEYOND = 300;
const HEAR = 60;

export interface FleetInput {
  loop: TransitLine & { speeds?: [number, number, number][] };
  metro: TransitLine[];
  /** where each stop's pole / kiosk stands (the sidecar's placement on the built city), by stop id */
  props?: Readonly<Record<string, readonly [number, number]>>;
}

export interface FleetOptions {
  groundY?: (x: number, z: number) => number | null;
  visible?: (x: number, z: number) => boolean;
  viewer?: () => { x: number; z: number; onFoot: boolean };
  /** the surface near a portal is streamed in (the streamer's whenReady(exit, 150) as a sync flag) */
  portalReady?: (p: TransitPortal) => boolean;
  /** interlock boxes on the bus track (cable-car crossings / shared running; see busInterlocks), or a maker from the track */
  boxes?: InterlockBox[] | ((bus: LineTrack) => InterlockBox[]);
  /** emit `transit` game events (default true; tests pass false) */
  emitEvents?: boolean;
  /** the other road users (world/sf/streetNet.ts collectRoadVehicles): buses keep behind toy cars in their lane */
  roadUsers?: (out: RoadVehicle[]) => RoadVehicle[];
}

/** One material instance per batched mesh: the TOY patch under the 'ob-toy' key (same program family as the pools). */
export function makeFleetMaterial(name: string): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  m.name = name;
  m.onBeforeCompile = shader => { patchToyShader(shader, { sway: true }); };
  m.customProgramCacheKey = () => 'ob-toy';
  return m;
}

const WHITE = new THREE.Color('#ffffff');

/** A BatchedMesh sized for these geometries × counts, per-instance colour on (the pool program variant). */
function batched(geos: THREE.BufferGeometry[], counts: number[], material: THREE.Material, name: string): { mesh: THREE.BatchedMesh; ids: number[] } {
  let verts = 0, index = 0, inst = 0;
  geos.forEach((g, i) => { verts += g.getAttribute('position').count; index += g.getIndex()!.count; inst += counts[i]; });
  const mesh = new THREE.BatchedMesh(Math.max(1, inst), verts, index, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.perObjectFrustumCulled = true;
  mesh.sortObjects = false;
  mesh.matrixAutoUpdate = false;
  const ids = geos.map(g => mesh.addGeometry(g));
  return { mesh, ids };
}

interface VehicleSlot { near: number; far: number; tris: number; farTris: number }

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpP = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);

export class LineFleet {
  readonly group = new THREE.Group();
  readonly bus: BusSystem;
  readonly rail: LightRailSystem;
  readonly props: StationProp[];
  readonly portals: PortalPlacement[];
  readonly near: THREE.BatchedMesh;
  readonly far: THREE.BatchedMesh;
  readonly staticMesh: THREE.BatchedMesh;
  private busSlots: VehicleSlot[] = [];
  /** per train: its two cars */
  private carSlots: VehicleSlot[][] = [];
  private propSlots: { id: number; x: number; z: number; tris: number }[] = [];
  private opts: FleetOptions;
  private propT = 0;
  private propCam = { x: 1e9, z: 1e9 };
  private portalListeners = new Set<(e: RailEvent) => void>();
  readonly materials: THREE.MeshStandardMaterial[];

  constructor(input: FleetInput, opts: FleetOptions = {}) {
    this.opts = opts;
    this.group.name = 'w4-lines';
    this.group.matrixAutoUpdate = false;
    const bt = busTrack(input.loop);
    this.bus = new BusSystem(bt, {
      groundY: opts.groundY, visible: opts.visible, viewer: opts.viewer, boxes: typeof opts.boxes === 'function' ? opts.boxes(bt) : opts.boxes,
      roadAhead: opts.roadUsers ? b => this.roadAhead(b) : undefined,
    });
    this.rail = new LightRailSystem(input.metro.map(railTrack), { groundY: opts.groundY, visible: opts.visible, viewer: opts.viewer, portalReady: opts.portalReady });
    definePlatform(input.loop.id, TOUR_BUS_PLATFORM);
    for (const l of input.metro) definePlatform(l.id, LRV_PLATFORM);

    // --- vehicles
    const nearMat = makeFleetMaterial('ob-w4-fleet-near'), farMat = makeFleetMaterial('ob-w4-fleet-far'), propMat = makeFleetMaterial('ob-w4-props');
    this.materials = [nearMat, farMat, propMat];
    const lineColor = (id: string) => (id === 'n-judah' ? W4_LINES['n-judah'].color : W4_LINES['m-ocean-view'].color);
    const metroIds = input.metro.map(l => l.id);
    const nearGeos = [tourBusGeometry(), ...metroIds.map(id => lrvCarGeometry(lineColor(id)))];
    const farGeos = [tourBusFarGeometry(), ...metroIds.map(id => lrvCarFarGeometry(lineColor(id)))];
    const trainsOf = (id: string) => this.rail.trains.filter(t => t.track.id === id).length * 2;
    const counts = [this.bus.buses.length, ...metroIds.map(trainsOf)];
    const n = batched(nearGeos, counts, nearMat, 'w4-vehicles');
    const f = batched(farGeos, counts, farMat, 'w4-vehicles-far');
    this.near = n.mesh; this.far = f.mesh;
    this.near.castShadow = true;
    this.near.receiveShadow = true;
    this.far.receiveShadow = false;
    const triOf = (g: THREE.BufferGeometry) => g.getIndex()!.count / 3;
    const slot = (gi: number): VehicleSlot => {
      const a = this.near.addInstance(n.ids[gi]), b = this.far.addInstance(f.ids[gi]);
      this.near.setColorAt(a, WHITE); this.far.setColorAt(b, WHITE);
      this.near.setVisibleAt(a, false); this.far.setVisibleAt(b, false);
      return { near: a, far: b, tris: triOf(nearGeos[gi]), farTris: triOf(farGeos[gi]) };
    };
    for (let k = 0; k < this.bus.buses.length; k++) this.busSlots.push(slot(0));
    for (const t of this.rail.trains) { const gi = 1 + metroIds.indexOf(t.track.id); this.carSlots.push([slot(gi), slot(gi)]); }

    // --- stops, kiosks, portals (static)
    this.props = stationProps([input.loop, ...input.metro], opts.groundY, input.props);
    this.portals = portalPlacements(input.metro);
    const keys = ['bus-pole', 'kiosk', 'rail-stop-n', 'rail-stop-m', 'rail-stop-nm'] as const;
    const propGeos: Record<string, THREE.BufferGeometry> = {
      'bus-pole': busPoleGeometry(), kiosk: kioskGeometry(), 'rail-stop-n': railStopGeometry('n'), 'rail-stop-m': railStopGeometry('m'), 'rail-stop-nm': railStopGeometry('nm'),
    };
    for (const p of this.portals) propGeos[`portal-${p.id}`] = portalGeometry(p.id);
    const allKeys = [...keys, ...this.portals.map(p => `portal-${p.id}`)];
    const geoList = allKeys.map(k => propGeos[k]);
    const perKey = allKeys.map(k => (k.startsWith('portal-') ? 1 : this.props.filter(p => stationGeometryKey(p) === k).length));
    const s = batched(geoList, perKey, propMat, 'w4-stops-portals');
    this.staticMesh = s.mesh;
    this.staticMesh.receiveShadow = false;
    const place = (key: string, x: number, y: number, z: number, heading: number) => {
      const gi = allKeys.indexOf(key);
      const id = this.staticMesh.addInstance(s.ids[gi]);
      this.staticMesh.setColorAt(id, WHITE);
      tmpQ.setFromEuler(tmpE.set(0, heading, 0, 'YXZ'));
      this.staticMesh.setMatrixAt(id, tmpM.compose(tmpP.set(x, y, z), tmpQ, ONE));
      this.propSlots.push({ id, x, z, tris: triOf(geoList[gi]) });
    };
    for (const p of this.props) place(stationGeometryKey(p), p.x, p.y, p.z, p.heading);
    for (const p of this.portals) place(`portal-${p.id}`, p.x, p.y, p.z, p.heading);
    for (const g of [...nearGeos, ...farGeos, ...geoList]) g.dispose();

    this.group.add(this.near, this.far, this.staticMesh);
    this.group.updateMatrixWorld(true);
    this.update(0, { x: 0, z: 0 }, { x: 0, z: 0 });
  }

  private road: RoadVehicle[] = [];
  private roadT = -1;

  /**
   * The nearest toy car / player vehicle in the bus's lane ahead (u from the bus centre), ∞ if none: within 30 u, less
   * than a lane (1.7 u) to the side of the bus's line, heading the same way (± 60°). The road users are collected once a
   * frame for all buses.
   */
  private roadAhead(b: Bus): number {
    if (this.roadT !== this.bus.time) { this.roadT = this.bus.time; this.opts.roadUsers!(this.road); }
    const q = b.pose, fx = Math.sin(q.heading), fz = Math.cos(q.heading);
    let best = Infinity;
    for (const v of this.road) {
      if (v.kind !== 'traffic' && v.kind !== 'player') continue;
      const dx = v.x - q.x, dz = v.z - q.z;
      if (dx * dx + dz * dz > 900) continue;
      const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (along <= 0 || side > 1.7) continue;
      if (Math.cos(v.heading - q.heading) < 0.5) continue;
      best = Math.min(best, along - v.halfL);
    }
    return best;
  }

  /** Portal events of the rider's train (`portal-in`: start the subway overlay, `portal-out`: cut to the LRV emerging). */
  onPortal(fn: (e: RailEvent) => void): () => void { this.portalListeners.add(fn); return () => { this.portalListeners.delete(fn); }; }

  /** Draw one vehicle (near / far / hidden by its camera distance). No allocation: it runs for every vehicle every frame. */
  private show(slot: VehicleSlot, pose: CarPose, hidden: boolean, cam: { x: number; z: number }) {
    const d = Math.hypot(pose.x - cam.x, pose.z - cam.z);
    const nearOn = !hidden && d <= FAR_LOD, farOn = !hidden && d > FAR_LOD && d <= HIDE_BEYOND;
    this.near.setVisibleAt(slot.near, nearOn);
    this.far.setVisibleAt(slot.far, farOn);
    if (!nearOn && !farOn) return;
    tmpQ.setFromEuler(tmpE.set(-pose.pitch, pose.heading, pose.roll, 'YXZ'));
    tmpM.compose(tmpP.set(pose.x, pose.y, pose.z), tmpQ, ONE);
    if (nearOn) this.near.setMatrixAt(slot.near, tmpM);
    else this.far.setMatrixAt(slot.far, tmpM);
  }

  /** Step the systems and draw them for a camera at `cam` (xz), the player at `player`. */
  update(dt: number, cam: { x: number; z: number }, player: { x: number; z: number }) {
    this.bus.step(dt);
    this.rail.step(dt);
    const buses = this.bus.buses, trains = this.rail.trains;
    for (let i = 0; i < buses.length; i++) this.show(this.busSlots[i], buses[i].pose, false, cam);
    for (let i = 0; i < trains.length; i++) {
      const t = trains[i];
      this.show(this.carSlots[i][0], t.cars[0], t.hidden, cam);
      this.show(this.carSlots[i][1], t.cars[1], t.hidden, cam);
    }
    // props: hidden beyond 300 u (4 Hz, and at once after a jump of the camera: fast travel, a portal cut)
    if ((this.propT -= dt) <= 0 || Math.hypot(cam.x - this.propCam.x, cam.z - this.propCam.z) > 30) {
      this.propT = 0.25;
      this.propCam.x = cam.x; this.propCam.z = cam.z;
      for (const p of this.propSlots) this.staticMesh.setVisibleAt(p.id, Math.hypot(p.x - cam.x, p.z - cam.z) <= HIDE_BEYOND);
    }
    // platforms: the rider's vehicle, else the one nearest the player. A hidden train (the virtual subway) publishes
    // nothing: the platform goes stale, so the rider is not carried along under the street (and nothing streams there);
    // game/ride.ts keeps them at the boarding kiosk under the subway overlay (integration step 4).
    const busLine = this.bus.track.id;
    let rb = this.bus.riderCarOf(busLine);
    if (!rb) {
      let bd = Infinity;
      for (const b of buses) { const d = Math.hypot(b.pose.x - player.x, b.pose.z - player.z); if (d < bd) { bd = d; rb = b; } }
    }
    if (rb) setPlatformPose(busLine, rb.pose, dt);
    for (const tr of this.rail.tracks) {
      let t = this.rail.riderCarOf(tr.id);
      if (!t) {
        let bd = Infinity;
        for (const q of trains) {
          if (q.track !== tr || q.hidden) continue;
          const lead = this.rail.leadCar(q), d = Math.hypot(lead.x - player.x, lead.z - player.z);
          if (d < bd) { bd = d; t = q; }
        }
      }
      if (t && !t.hidden) setPlatformPose(tr.id, this.rail.leadCar(t), dt);
      else if (t && t.rider) {
        // the rider's train is under ground: the platform is not there at all (not merely aging out: a pose another
        // train published a moment ago must not carry the rider off to that train)
        const plat = platforms.get(tr.id);
        if (plat) plat.live = false;
      }
    }
    this.drain(player);
  }

  /** The systems' events → `transit` game events: the rider's vehicle always, others within earshot. */
  private drain(player: { x: number; z: number }) {
    const loud = this.opts.emitEvents !== false;
    const busLine = this.bus.track.id;
    const riderBus = this.bus.riderCarOf(busLine);
    const busStatus = this.bus.rideStatus();
    for (const e of this.bus.events as BusEvent[]) {
      const b = this.bus.buses[e.bus];
      const mine = !!riderBus && riderBus.index === e.bus && (busStatus?.phase === 'riding' || busStatus?.phase === 'arrived');
      const d = Math.hypot(b.pose.x - player.x, b.pose.z - player.z);
      const base = { type: 'transit' as const, line: busLine, kind: 'bus' as const };
      if (!loud) continue;
      switch (e.what) {
        case 'approach': if (mine) emit({ ...base, what: 'approach', station: e.station ?? undefined, attraction: e.attraction }); break;
        // another bus's brakes / doors / horn come from where it is (audio pans them: audio/cityHooks emitAt)
        case 'arrive': if (mine) emit({ ...base, what: 'arrive', station: e.station ?? undefined, attraction: stopAttraction(e.station) }); else if (d < HEAR) emitAt({ ...base, what: 'arrive', strength: Math.max(0.2, 1 - d / HEAR) }, b.pose.x, b.pose.z); break;
        case 'depart': if (mine) emit({ ...base, what: 'depart', station: e.station ?? undefined }); else if (d < HEAR) emitAt({ ...base, what: 'depart', strength: Math.max(0.2, 1 - d / HEAR) }, b.pose.x, b.pose.z); break;
        case 'board': emit({ ...base, what: 'board', station: e.station ?? undefined }); break;
        case 'horn': if (d < HEAR * 1.5) { if (mine) emit({ ...base, what: 'horn', strength: 0.9 }); else emitAt({ ...base, what: 'horn', strength: 0.9 }, b.pose.x, b.pose.z); } break;
        // doors: no event of their own (arrive / depart carry the door chime; a `bell` is the stop request's ding)
        default: break;
      }
    }
    this.bus.events.length = 0;
    const rs = this.rail.rideStatus();
    for (const e of this.rail.events as RailEvent[]) {
      const t = this.rail.trains[e.train];
      if (e.what === 'portal-in' || e.what === 'portal-out') { for (const fn of this.portalListeners) fn(e); continue; }
      const mine = !!rs && rs.car === e.train && t.rider;
      const lead = this.rail.leadCar(t);
      const d = t.hidden ? Infinity : Math.hypot(lead.x - player.x, lead.z - player.z);
      const base = { type: 'transit' as const, line: t.track.id, kind: 'light-rail' as const };
      if (!loud) continue;
      // the rider's events carry the train's direction along the arc (+1 outbound from Embarcadero, −1 inbound): lane C's
      // portal lines ("钻出日落隧道" / "前面是日落隧道") need it
      const dir = t.dir;
      switch (e.what) {
        case 'approach': if (mine) emit({ ...base, what: 'approach', station: e.station ?? undefined, attraction: e.attraction, dir }); break;
        case 'arrive': if (mine) emit({ ...base, what: 'arrive', station: e.station ?? undefined, attraction: stopAttraction(e.station), dir }); break;
        case 'depart': if (mine) emit({ ...base, what: 'depart', station: e.station ?? undefined, dir }); else if (d < HEAR) emitAt({ ...base, what: 'bell', strength: Math.max(0.2, 1 - d / HEAR) }, lead.x, lead.z); break;
        case 'board': emit({ ...base, what: 'board', station: e.station ?? undefined, dir }); break;
        case 'gong': if (d < HEAR * 1.5) { if (mine) emit({ ...base, what: 'bell', strength: 0.9 }); else emitAt({ ...base, what: 'bell', strength: 0.9 }, lead.x, lead.z); } break;
        case 'reverse': if (d < HEAR) emitAt({ ...base, what: 'turned' }, lead.x, lead.z); break;
        default: break;
      }
    }
    this.rail.events.length = 0;
  }

  /**
   * The buses and the visible trains within 250 u of `near` as road vehicles (world/sf/streetNet.ts: crowd walkers hop
   * aside, the toy traffic waits for them). A train is one body over both cars.
   */
  roadVehicles(out: RoadVehicle[], near: { x: number; z: number }) {
    for (const b of this.bus.buses) {
      const q = b.pose;
      if (Math.abs(q.x - near.x) > 250 || Math.abs(q.z - near.z) > 250) continue;
      out.push({ x: q.x, z: q.z, heading: q.heading, v: b.v, halfL: BUS.length / 2, halfW: BUS.width / 2, kind: 'bus', line: this.bus.track.id });
    }
    for (const t of this.rail.trains) {
      if (t.hidden) continue;
      const a = t.cars[0], c = t.cars[1];
      const x = (a.x + c.x) / 2, z = (a.z + c.z) / 2;
      if (Math.abs(x - near.x) > 250 || Math.abs(z - near.z) > 250) continue;
      out.push({ x, z, heading: this.rail.leadCar(t).heading, v: Math.abs(t.v), halfL: TRAIN_LENGTH / 2, halfW: LRV.width / 2, kind: 'light-rail', line: t.track.id });
    }
  }

  /** The Metro lines' surface stretches (outside the tunnels and the portal hoods) as [x, y, z] runs: the transit streets. */
  static surfaceRuns(metro: readonly Pick<TransitLine, 'path' | 'tunnels'>[]): Float32Array[] {
    const out: Float32Array[] = [];
    for (const l of metro) {
      const n = Math.floor(l.path.length / 3);
      let run: number[] = [], s = 0;
      for (let i = 0; i < n; i++) {
        if (i > 0) s += Math.hypot(l.path[i * 3] - l.path[i * 3 - 3], l.path[i * 3 + 2] - l.path[i * 3 - 1]);
        const under = (l.tunnels ?? []).some(t => s > t.fromAt - 2 && s < t.toAt + 2);
        if (under) { if (run.length >= 6) out.push(new Float32Array(run)); run = []; continue; }
        run.push(l.path[i * 3], l.path[i * 3 + 1], l.path[i * 3 + 2]);
      }
      if (run.length >= 6) out.push(new Float32Array(run));
    }
    return out;
  }

  /** The train the rider rides (for the overlay / camera), or null. */
  riderTrain(): Train | null {
    const rs = this.rail.rideStatus();
    return rs ? this.rail.trains[rs.car] ?? null : null;
  }

  /** Draw data for QA and the budget test: instances and triangles drawn this frame (shadow pass counted separately). */
  stats(): { calls: number; shadowCalls: number; tris: number; shadowTris: number; nearVehicles: number; farVehicles: number; props: number } {
    let tris = 0, shadowTris = 0, nearV = 0, farV = 0, props = 0;
    const vis = (m: THREE.BatchedMesh, id: number) => m.getVisibleAt(id);
    for (const s of [...this.busSlots, ...this.carSlots.flat()]) {
      if (vis(this.near, s.near)) { tris += s.tris; shadowTris += s.tris; nearV++; }
      if (vis(this.far, s.far)) { tris += s.farTris; farV++; }
    }
    for (const p of this.propSlots) if (vis(this.staticMesh, p.id)) { tris += p.tris; props++; }
    const calls = (nearV ? 1 : 0) + (farV ? 1 : 0) + (props ? 1 : 0);
    return { calls, shadowCalls: nearV ? 1 : 0, tris, shadowTris, nearVehicles: nearV, farVehicles: farV, props };
  }

  dispose() {
    this.near.dispose();
    this.far.dispose();
    this.staticMesh.dispose();
    for (const m of this.materials) m.dispose();
    this.portalListeners.clear();
  }
}

/** Warm-up (plan: every new program registered): the three batched-mesh kinds exactly as the fleet builds them. */
registerWarmup('w4-lines', () => {
  const geo = tourBusFarGeometry();
  const make = (mat: THREE.Material, cast: boolean, receive: boolean) => {
    const { mesh, ids } = batched([geo], [1], mat, 'warm');
    mesh.setColorAt(mesh.addInstance(ids[0]), WHITE);
    mesh.castShadow = cast; mesh.receiveShadow = receive;
    return mesh;
  };
  const mats = [makeFleetMaterial('ob-w4-fleet-near'), makeFleetMaterial('ob-w4-fleet-far')];
  const objects = [make(mats[0], true, true), make(mats[1], false, false)];
  return { objects, dispose: () => { for (const o of objects) o.dispose(); for (const m of mats) m.dispose(); geo.dispose(); } };
});

/**
 * Interlock boxes for the bus track from the other lines' tracks (pure helper for the host): every span where the bus
 * path comes within `dist` u of a surface stretch of another line (crossings, shared running), widened by half a bus.
 * `blockedBy(line, b0, b1)` answers whether that line has a vehicle in its part [b0, b1] (integration: the cable-car
 * spans of CableSystem, the hero streetcar's position).
 */
export function busInterlocks(bus: LineTrack, others: Pick<TransitLine, 'id' | 'path' | 'tunnels'>[], blockedBy: (line: string, b0: number, b1: number) => boolean, dist = BUS.width / 2 + 1.4): InterlockBox[] {
  const out: InterlockBox[] = [];
  for (const o of others) {
    const n = Math.floor(o.path.length / 3), xyz = new Float32Array(o.path), cum = new Float32Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(xyz[i * 3] - xyz[i * 3 - 3], xyz[i * 3 + 2] - xyz[i * 3 - 1]);
    for (const s of proximitySpans(bus, { xyz, cum, length: cum[n - 1], loop: false }, dist)) {
      // underground stretches of a Metro line never conflict
      if ((o.tunnels ?? []).some(t => s.b0 >= t.fromAt && s.b1 <= t.toAt)) continue;
      const pad = BUS.length / 2;
      const b0 = s.b0 - 3, b1 = s.b1 + 3;
      out.push({ id: `${o.id}@${Math.round(s.a0)}`, a0: s.a0 - pad, a1: s.a1 + pad, blocked: () => blockedBy(o.id, b0, b1), other: { line: o.id, b0, b1 } });
    }
  }
  return out;
}
