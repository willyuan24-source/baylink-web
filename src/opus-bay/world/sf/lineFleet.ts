import * as THREE from 'three';
import { definePlatform, platforms, setPlatformPose } from '../../actors/platform';
import { emitAt } from '../../audio/cityHooks';
import { emit } from '../../core/events';
import { W4_LINES, stationAttractions } from '../../data/sf/stationNames';
import { BUS, type Bus, type BusEvent, BusSystem, type InterlockBox, busTrack } from '../busSystem';
import { type BodyDims, type LineTrack, bodySpans, proximitySpans } from '../lineTrack';
import { LRV, LightRailSystem, type RailEvent, TRAIN_LENGTH, type Train, railTrack } from '../lightRail';
import { patchToyShader } from '../materials';
import type { CarPose } from '../transitLine';
import { registerWarmup } from '../warmup';
import type { TransitLine, TransitPortal } from './format';
import { LRV_PLATFORM, lrvCarFarGeometry, lrvCarGeometry } from './lrv';
import { type PortalPlacement, portalBlockers, portalGeometry, portalPlacements } from './portals';
import { type StationProp, busPoleGeometry, kioskGeometry, railStopGeometry, stationGeometryKey, stationProps } from './stations';
import type { RoadVehicle } from './streetNet';
import { obstaclePool, setVehicle, vehiclePool } from './recordPool';
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
/**
 * Vehicles cast a shadow only this near the camera (W4-T14 + C2 w3 part b request 3: at Chinatown the cable cars and
 * streetcars drew 23k main + 10k shadow triangles in 9 + 4 calls); between this and FAR_LOD the full vehicle is drawn
 * by the non-casting mesh.
 */
export const SHADOW_NEAR = 60;

/**
 * Another layer's vehicles drawn in the fleet's meshes (integration: the cable cars and the city F-line's cars), so every
 * vehicle of the city's lines costs the same 2 calls + 1 shadow call: `count` vehicles of one look, near + far geometry.
 */
export interface ExtraVehicleKind {
  key: string; near: THREE.BufferGeometry; far: THREE.BufferGeometry; count: number;
  /**
   * (W5-T4, plan MF9) a middle look for SHADOW_NEAR … FAR_LOD (instead of the full geometry without a shadow): the cable
   * car's 2,124 triangles → ≈ 580, the F-line car's 1,112 → ≈ 490; with it the kind casts a shadow only within
   * `shadowNear` (default SHADOW_NEAR)
   */
  mid?: THREE.BufferGeometry;
  shadowNear?: number;
}
/**
 * (W5-T4) the cable cars and the F-line cars: full look with a shadow within this of the camera, the middle look beyond
 * (at 45 u a car is ≈ 70 px tall on a 900 px screen at the 42° lens, the middle look's detail reads the same)
 */
export const EXTRA_SHADOW_NEAR = 45;
const HEAR = 60;

export interface FleetInput {
  loop: TransitLine & { speeds?: [number, number, number][] };
  metro: TransitLine[];
  /** where each stop's pole / kiosk stands (the sidecar's placement on the built city), by stop id */
  props?: Readonly<Record<string, readonly [number, number]>>;
  /** other layers' vehicles to draw here (drawExtra) */
  extra?: ExtraVehicleKind[];
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

/**
 * The near vehicles' shadow-pass material: a MeshDepthMaterial of their own (BackSide, the side three's shadow pass uses
 * for a FrontSide caster), so the batched depth program is looked up for this kind only. Module-level, never disposed.
 * Its program (batching + colours, no fog, into the shadow map) needs warming like the plain casters' (lane V: the
 * warm-up's shadowDepthSet).
 */
export const FLEET_DEPTH = new THREE.MeshDepthMaterial({ side: THREE.BackSide });
FLEET_DEPTH.name = 'ob-depth-batched';

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

/**
 * One vehicle's three instances: the casting near mesh (≤ `shadowNear`), the full look — or the kind's middle look —
 * in the far mesh (≤ FAR_LOD), the far look.
 */
interface VehicleSlot { near: number; mid: number; far: number; tris: number; farTris: number; midTris: number; shadowNear: number }

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
  /** other layers' vehicles (ExtraVehicleKind), by key */
  private extraSlots = new Map<string, VehicleSlot[]>();
  private propSlots: { id: number; x: number; z: number; tris: number }[] = [];
  /** the stops' poles, the kiosks and the portal hoods as discs the walker steps round (obstacles()) */
  private discs: { x: number; z: number; r: number }[] = [];
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
      roadAhead: opts.roadUsers ? (b, who) => this.roadAhead(b, who) : undefined,
    });
    this.rail = new LightRailSystem(input.metro.map(railTrack), { groundY: opts.groundY, visible: opts.visible, viewer: opts.viewer, portalReady: opts.portalReady });
    definePlatform(input.loop.id, TOUR_BUS_PLATFORM);
    for (const l of input.metro) definePlatform(l.id, LRV_PLATFORM);

    // --- vehicles
    const nearMat = makeFleetMaterial('ob-w4-fleet-near'), farMat = makeFleetMaterial('ob-w4-fleet-far'), propMat = makeFleetMaterial('ob-w4-props');
    this.materials = [nearMat, farMat, propMat];
    const lineColor = (id: string) => (id === 'n-judah' ? W4_LINES['n-judah'].color : W4_LINES['m-ocean-view'].color);
    const metroIds = input.metro.map(l => l.id);
    const extra = input.extra ?? [];
    const nearGeos = [tourBusGeometry(), ...metroIds.map(id => lrvCarGeometry(lineColor(id))), ...extra.map(e => e.near)];
    const farGeos = [tourBusFarGeometry(), ...metroIds.map(id => lrvCarFarGeometry(lineColor(id))), ...extra.map(e => e.far)];
    const trainsOf = (id: string) => this.rail.trains.filter(t => t.track.id === id).length * 2;
    const counts = [this.bus.buses.length, ...metroIds.map(trainsOf), ...extra.map(e => e.count)];
    // (W5-T4) the kinds with a middle look: their middle instances use it instead of the full geometry
    const G0 = 1 + metroIds.length;
    const withMid = extra.map((e, k) => (e.mid ? k : -1)).filter(k => k >= 0);
    const midGeos = withMid.map(k => extra[k].mid!);
    const midIndex = new Map(withMid.map((k, j) => [G0 + k, j]));
    const midCounts = counts.map((c, gi) => (midIndex.has(gi) ? 0 : c));
    // near: the full look, casting (≤ SHADOW_NEAR); far: the full look or the middle one (≤ FAR_LOD) and the far look, no shadows
    const n = batched(nearGeos, counts, nearMat, 'w4-vehicles');
    const f = batched([...nearGeos, ...farGeos, ...midGeos], [...midCounts, ...counts, ...withMid.map(k => extra[k].count)], farMat, 'w4-vehicles-far');
    this.near = n.mesh; this.far = f.mesh;
    this.near.castShadow = true;
    this.near.receiveShadow = true;
    // the batched casters' own depth material (one per object kind, like materials.ts kindSweep's instanced / skinned
    // ones): three's shared depth material would switch programs between plain and batched casters every frame
    this.near.customDepthMaterial = FLEET_DEPTH;
    this.far.receiveShadow = false;
    const triOf = (g: THREE.BufferGeometry) => g.getIndex()!.count / 3;
    const G = nearGeos.length;
    const slot = (gi: number): VehicleSlot => {
      const mj = midIndex.get(gi);
      const a = this.near.addInstance(n.ids[gi]), m = this.far.addInstance(f.ids[mj === undefined ? gi : 2 * G + mj]), b = this.far.addInstance(f.ids[G + gi]);
      this.near.setColorAt(a, WHITE); this.far.setColorAt(m, WHITE); this.far.setColorAt(b, WHITE);
      this.near.setVisibleAt(a, false); this.far.setVisibleAt(m, false); this.far.setVisibleAt(b, false);
      const kind = gi >= G0 ? extra[gi - G0] : undefined;
      return {
        near: a, mid: m, far: b, tris: triOf(nearGeos[gi]), farTris: triOf(farGeos[gi]), midTris: triOf(mj === undefined ? nearGeos[gi] : midGeos[mj]),
        shadowNear: kind?.shadowNear ?? (kind?.mid ? EXTRA_SHADOW_NEAR : SHADOW_NEAR),
      };
    };
    for (let k = 0; k < this.bus.buses.length; k++) this.busSlots.push(slot(0));
    for (const t of this.rail.trains) { const gi = 1 + metroIds.indexOf(t.track.id); this.carSlots.push([slot(gi), slot(gi)]); }
    extra.forEach((e, k) => {
      const gi = 1 + metroIds.length + k, list: VehicleSlot[] = [];
      for (let i = 0; i < e.count; i++) list.push(slot(gi));
      this.extraSlots.set(e.key, list);
    });

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
    // walk obstacles: a pole is a thin disc; a kiosk (2.2 × 3.0 u) two discs along its length; a portal's hood and wing
    // walls rows of discs over their rectangles (the walker cannot wander into a tunnel mouth or through a kiosk)
    for (const p of this.props) {
      if (p.kind !== 'kiosk') { this.discs.push({ x: p.x, z: p.z, r: 0.22 }); continue; }
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      for (const o of [-0.7, 0.7]) this.discs.push({ x: p.x + fx * o, z: p.z + fz * o, r: 1.12 });
    }
    for (const p of this.portals) for (const poly of portalBlockers(p)) this.discs.push(...rectDiscs(poly));
    for (const g of [...nearGeos, ...farGeos, ...midGeos, ...geoList]) g.dispose();

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
  private roadAhead(b: Bus, who?: { kind: string }): number {
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
      if (along - v.halfL < best) { best = along - v.halfL; if (who) who.kind = v.kind; }
    }
    return best;
  }

  /** Portal events of the rider's train (`portal-in`: start the subway overlay, `portal-out`: cut to the LRV emerging). */
  onPortal(fn: (e: RailEvent) => void): () => void { this.portalListeners.add(fn); return () => { this.portalListeners.delete(fn); }; }

  /**
   * Draw one vehicle (near with its shadow / the full look without / far / hidden, by its camera distance). No
   * allocation: it runs for every vehicle every frame.
   */
  private show(slot: VehicleSlot, pose: CarPose, hidden: boolean, cam: { x: number; z: number }) {
    const d = Math.hypot(pose.x - cam.x, pose.z - cam.z), sn = slot.shadowNear;
    const nearOn = !hidden && d <= sn, midOn = !hidden && d > sn && d <= FAR_LOD, farOn = !hidden && d > FAR_LOD && d <= HIDE_BEYOND;
    this.near.setVisibleAt(slot.near, nearOn);
    this.far.setVisibleAt(slot.mid, midOn);
    this.far.setVisibleAt(slot.far, farOn);
    if (!nearOn && !midOn && !farOn) return;
    tmpQ.setFromEuler(tmpE.set(-pose.pitch, pose.heading, pose.roll, 'YXZ'));
    tmpM.compose(tmpP.set(pose.x, pose.y, pose.z), tmpQ, ONE);
    if (nearOn) this.near.setMatrixAt(slot.near, tmpM);
    else this.far.setMatrixAt(midOn ? slot.mid : slot.far, tmpM);
  }

  /** Draw vehicle `i` of another layer's kind `key` (ExtraVehicleKind) for a camera at `cam` (xz). */
  drawExtra(key: string, i: number, pose: CarPose, hidden: boolean, cam: { x: number; z: number }) {
    const slot = this.extraSlots.get(key)?.[i];
    if (slot) this.show(slot, pose, hidden, cam);
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
    const pool = this.vehiclePool.begin(out);
    for (const b of this.bus.buses) {
      const q = b.pose;
      if (Math.abs(q.x - near.x) > 250 || Math.abs(q.z - near.z) > 250) continue;
      out.push(setVehicle(pool.next(), q.x, q.z, q.heading, b.v, BUS.length / 2, BUS.width / 2, 'bus', this.bus.track.id));
    }
    for (const t of this.rail.trains) {
      if (t.hidden) continue;
      const a = t.cars[0], c = t.cars[1];
      const x = (a.x + c.x) / 2, z = (a.z + c.z) / 2;
      if (Math.abs(x - near.x) > 250 || Math.abs(z - near.z) > 250) continue;
      out.push(setVehicle(pool.next(), x, z, this.rail.leadCar(t).heading, Math.abs(t.v), TRAIN_LENGTH / 2, LRV.width / 2, 'light-rail', t.track.id));
    }
  }
  /** (F4) pooled records: one pool per consumer array */
  private readonly vehiclePool = vehiclePool();
  private readonly obstaclePool = obstaclePool();

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

  /**
   * Walker obstacles near (x, z) (actors/view registerObstacleSource, via the transit layer): the stops, kiosks and
   * portals ('static': a soft bump), the buses and the visible train cars ('traffic').
   */
  obstacles(out: { x: number; z: number; r: number; kind: string }[], x: number, z: number, r: number) {
    const pool = this.obstaclePool.begin(out);
    const put = (px: number, pz: number, pr: number, kind: string) => { const o = pool.next(); o.x = px; o.z = pz; o.r = pr; o.kind = kind; out.push(o); };
    for (const d of this.discs) if (Math.abs(d.x - x) < r + d.r && Math.abs(d.z - z) < r + d.r) put(d.x, d.z, d.r, 'static');
    for (const b of this.bus.buses) {
      const q = b.pose;
      if (Math.abs(q.x - x) > r + 5 || Math.abs(q.z - z) > r + 5) continue;
      const fx = Math.sin(q.heading), fz = Math.cos(q.heading);
      for (let k = -1; k <= 1; k++) put(q.x + fx * 2.6 * k, q.z + fz * 2.6 * k, BUS.width / 2, 'traffic');
    }
    for (const t of this.rail.trains) {
      if (t.hidden) continue;
      for (const q of t.cars) {
        if (Math.abs(q.x - x) > r + 4 || Math.abs(q.z - z) > r + 4) continue;
        const fx = Math.sin(q.heading), fz = Math.cos(q.heading);
        for (let k = -1; k <= 1; k++) put(q.x + fx * 2.1 * k, q.z + fz * 2.1 * k, LRV.width / 2, 'traffic');
      }
    }
  }

  /** The train the rider rides (for the overlay / camera), or null. */
  riderTrain(): Train | null {
    const rs = this.rail.rideStatus();
    return rs ? this.rail.trains[rs.car] ?? null : null;
  }

  /** Draw data for QA and the budget test: instances and triangles drawn this frame (shadow pass counted separately). */
  stats(): { calls: number; shadowCalls: number; tris: number; shadowTris: number; nearVehicles: number; midVehicles: number; farVehicles: number; props: number } {
    let tris = 0, shadowTris = 0, nearV = 0, midV = 0, farV = 0, props = 0;
    const vis = (m: THREE.BatchedMesh, id: number) => m.getVisibleAt(id);
    for (const s of [...this.busSlots, ...this.carSlots.flat(), ...[...this.extraSlots.values()].flat()]) {
      if (vis(this.near, s.near)) { tris += s.tris; shadowTris += s.tris; nearV++; }
      if (vis(this.far, s.mid)) { tris += s.midTris; midV++; }
      if (vis(this.far, s.far)) { tris += s.farTris; farV++; }
    }
    for (const p of this.propSlots) if (vis(this.staticMesh, p.id)) { tris += p.tris; props++; }
    const calls = (nearV ? 1 : 0) + (midV || farV ? 1 : 0) + (props ? 1 : 0);
    return { calls, shadowCalls: nearV ? 1 : 0, tris, shadowTris, nearVehicles: nearV, midVehicles: midV, farVehicles: farV, props };
  }

  dispose() {
    this.near.dispose();
    this.far.dispose();
    this.staticMesh.dispose();
    for (const m of this.materials) m.dispose();
    this.portalListeners.clear();
  }
}

/** Discs covering a rectangle (4 corners): radius = half its short side, spaced along its long side. */
function rectDiscs(poly: readonly { x: number; z: number }[]): { x: number; z: number; r: number }[] {
  const [a, b, , d] = poly;
  const ux = b.x - a.x, uz = b.z - a.z, vx = d.x - a.x, vz = d.z - a.z;
  const lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
  const [lx, lz, L, sx, sz, S] = lu >= lv ? [ux, uz, lu, vx, vz, lv] : [vx, vz, lv, ux, uz, lu];
  const r = S / 2, n = Math.max(1, Math.ceil((L - S) / r) + 1);
  const out: { x: number; z: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : (r + ((L - 2 * r) * i) / (n - 1)) / L;
    out.push({ x: a.x + lx * t + sx / 2, z: a.z + lz * t + sz / 2, r });
  }
  return out;
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
export function busInterlocks(bus: LineTrack, others: (Pick<TransitLine, 'id' | 'path' | 'tunnels'> & { body?: BodyDims })[], blockedBy: (line: string, b0: number, b1: number) => boolean, dist = BUS.width / 2 + 1.4): InterlockBox[] {
  const out: InterlockBox[] = [];
  for (const o of others) {
    const n = Math.floor(o.path.length / 3), xyz = new Float32Array(o.path), cum = new Float32Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(xyz[i * 3] - xyz[i * 3 - 3], xyz[i * 3 + 2] - xyz[i * 3 - 1]);
    const track = { xyz, cum, length: cum[n - 1], loop: false };
    // with the other vehicle's body: where the two bodies can touch (a0 / a1 are the bus's centre arcs already); without
    // it: where the centre lines come within `dist` (widened by half a bus)
    const spans = o.body ? bodySpans(bus, { halfL: BUS.length / 2, halfW: BUS.width / 2, margin: BUS.kerbShift }, track, o.body) : proximitySpans(bus, track, dist);
    for (const s of spans) {
      // underground stretches of a Metro line never conflict
      if ((o.tunnels ?? []).some(t => s.b0 >= t.fromAt && s.b1 <= t.toAt)) continue;
      const pad = o.body ? 1 : BUS.length / 2;
      const b0 = s.b0 - 3, b1 = s.b1 + 3;
      out.push({ id: `${o.id}@${Math.round(s.a0)}:${Math.round(s.b0)}`, a0: s.a0 - pad, a1: s.a1 + pad, blocked: () => blockedBy(o.id, b0, b1), other: { line: o.id, b0, b1 } });
    }
  }
  return out;
}
