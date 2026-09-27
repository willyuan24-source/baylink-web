import * as THREE from 'three';
import { definePlatform, setPlatformPose } from '../../actors/platform';
import { emit } from '../../core/events';
import { W4_LINES } from '../../data/sf/stationNames';
import { BUS, type BusEvent, BusSystem, type InterlockBox, busTrack } from '../busSystem';
import { type LineTrack, proximitySpans } from '../lineTrack';
import { LightRailSystem, type RailEvent, type Train, railTrack } from '../lightRail';
import { patchToyShader } from '../materials';
import { registerWarmup } from '../warmup';
import type { TransitLine, TransitPortal } from './format';
import { LRV_PLATFORM, lrvCarFarGeometry, lrvCarGeometry } from './lrv';
import { type PortalPlacement, portalGeometry, portalPlacements } from './portals';
import { type StationProp, busPoleGeometry, kioskGeometry, railStopGeometry, stationGeometryKey, stationProps } from './stations';
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
 * and its attraction (lane C narrates, lane G biases the camera); doors, horns and gongs within earshot.
 */

/** vehicles farther than this from the camera draw the far version (no shadow) */
export const FAR_LOD = 110;
export const HIDE_BEYOND = 300;
const HEAR = 60;

export interface FleetInput {
  loop: TransitLine & { speeds?: [number, number, number][] };
  metro: TransitLine[];
}

export interface FleetOptions {
  groundY?: (x: number, z: number) => number | null;
  visible?: (x: number, z: number) => boolean;
  viewer?: () => { x: number; z: number; onFoot: boolean };
  /** the surface near a portal is streamed in (the streamer's whenReady(exit, 150) as a sync flag) */
  portalReady?: (p: TransitPortal) => boolean;
  /** interlock boxes on the bus track (cable-car crossings / shared running; see busInterlocks) */
  boxes?: InterlockBox[];
  /** emit `transit` game events (default true; tests pass false) */
  emitEvents?: boolean;
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
    this.bus = new BusSystem(busTrack(input.loop), { groundY: opts.groundY, visible: opts.visible, viewer: opts.viewer, boxes: opts.boxes });
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
    this.props = stationProps([input.loop, ...input.metro], opts.groundY);
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

  /** Portal events of the rider's train (`portal-in`: start the subway overlay, `portal-out`: cut to the LRV emerging). */
  onPortal(fn: (e: RailEvent) => void): () => void { this.portalListeners.add(fn); return () => { this.portalListeners.delete(fn); }; }

  /** Step the systems and draw them for a camera at `cam` (xz), the player at `player`. */
  update(dt: number, cam: { x: number; z: number }, player: { x: number; z: number }) {
    this.bus.step(dt);
    this.rail.step(dt);
    const put = (mesh: THREE.BatchedMesh, id: number, pose: { x: number; y: number; z: number; heading: number; pitch: number; roll: number }) => {
      tmpQ.setFromEuler(tmpE.set(-pose.pitch, pose.heading, pose.roll, 'YXZ'));
      mesh.setMatrixAt(id, tmpM.compose(tmpP.set(pose.x, pose.y, pose.z), tmpQ, ONE));
    };
    const show = (slot: VehicleSlot, pose: { x: number; y: number; z: number; heading: number; pitch: number; roll: number }, hidden: boolean) => {
      const d = Math.hypot(pose.x - cam.x, pose.z - cam.z);
      const nearOn = !hidden && d <= FAR_LOD, farOn = !hidden && d > FAR_LOD && d <= HIDE_BEYOND;
      this.near.setVisibleAt(slot.near, nearOn);
      this.far.setVisibleAt(slot.far, farOn);
      if (nearOn) put(this.near, slot.near, pose);
      if (farOn) put(this.far, slot.far, pose);
    };
    this.bus.buses.forEach((b, i) => show(this.busSlots[i], b.pose, false));
    this.rail.trains.forEach((t, i) => { show(this.carSlots[i][0], t.cars[0], t.hidden); show(this.carSlots[i][1], t.cars[1], t.hidden); });
    // props: hidden beyond 300 u (4 Hz, and at once after a jump of the camera: fast travel, a portal cut)
    if ((this.propT -= dt) <= 0 || Math.hypot(cam.x - this.propCam.x, cam.z - this.propCam.z) > 30) {
      this.propT = 0.25;
      this.propCam.x = cam.x; this.propCam.z = cam.z;
      for (const p of this.propSlots) this.staticMesh.setVisibleAt(p.id, Math.hypot(p.x - cam.x, p.z - cam.z) <= HIDE_BEYOND);
    }
    // platforms: the rider's vehicle, else the one nearest the player
    const busLine = this.bus.track.id;
    const rb = this.bus.riderCarOf(busLine) ?? nearest(this.bus.buses, b => b.pose, player);
    if (rb) setPlatformPose(busLine, rb.pose, dt);
    for (const tr of this.rail.tracks) {
      const t = this.rail.riderCarOf(tr.id) ?? nearest(this.rail.trains.filter(q => q.track === tr && !q.hidden), q => this.rail.leadCar(q), player);
      if (t) setPlatformPose(tr.id, this.rail.leadCar(t), dt);
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
        case 'arrive': if (mine) emit({ ...base, what: 'arrive', station: e.station ?? undefined }); else if (d < HEAR) emit({ ...base, what: 'arrive', strength: Math.max(0.2, 1 - d / HEAR) }); break;
        case 'depart': if (mine) emit({ ...base, what: 'depart', station: e.station ?? undefined }); else if (d < HEAR) emit({ ...base, what: 'depart', strength: Math.max(0.2, 1 - d / HEAR) }); break;
        case 'board': emit({ ...base, what: 'board', station: e.station ?? undefined }); break;
        case 'horn': if (d < HEAR * 1.5) emit({ ...base, what: 'horn', strength: 0.9 }); break;
        case 'door': if (mine || d < HEAR * 0.5) emit({ ...base, what: 'bell', strength: mine ? 0.7 : 0.4 }); break;
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
      switch (e.what) {
        case 'approach': if (mine) emit({ ...base, what: 'approach', station: e.station ?? undefined, attraction: e.attraction }); break;
        case 'arrive': if (mine) emit({ ...base, what: 'arrive', station: e.station ?? undefined }); break;
        case 'depart': if (mine) emit({ ...base, what: 'depart', station: e.station ?? undefined }); else if (d < HEAR) emit({ ...base, what: 'bell', strength: Math.max(0.2, 1 - d / HEAR) }); break;
        case 'board': emit({ ...base, what: 'board', station: e.station ?? undefined }); break;
        case 'gong': if (d < HEAR * 1.5) emit({ ...base, what: 'bell', strength: 0.9 }); break;
        case 'reverse': if (d < HEAR) emit({ ...base, what: 'turned' }); break;
        default: break;
      }
    }
    this.rail.events.length = 0;
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

function nearest<T>(list: T[], pos: (t: T) => { x: number; z: number }, p: { x: number; z: number }): T | null {
  let best: T | null = null, bd = Infinity;
  for (const t of list) { const q = pos(t); const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = t; } }
  return best;
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
      out.push({ id: `${o.id}@${Math.round(s.a0)}`, a0: s.a0 - pad, a1: s.a1 + pad, blocked: () => blockedBy(o.id, s.b0 - 3, s.b1 + 3) });
    }
  }
  return out;
}
