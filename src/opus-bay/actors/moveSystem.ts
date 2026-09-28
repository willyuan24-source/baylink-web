import * as THREE from 'three';
import { emit } from '../core/events';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { game, type MoveState } from '../core/store';
import { canStand, groundPending, heightAt, nearestWalkable } from '../core/terrain';
import type { Vec2 } from '../core/types';
import { seatSpots, type SeatSpot } from '../data/vehicles';
import { bubble, cancelRide, hopOffRide, refreshLock, say } from '../game/flow';
import { flow } from '../game/flowStore';
import { interactables } from '../game/interactables';
import { currentRide } from '../game/ride';
import { rideSystemFor } from '../data/transit';
import { travelPose, type TravelPose } from '../game/fastTravel';
import { readQa } from '../game/qa';
import { spawnFx } from '../world/fx';
import type { RidePose } from './anim';
import type { Obstacle, PlayerController } from './controller';
import { rideCamInfo } from './cameraModes';
import { CHAR_SCALE } from './dims';
import { GLIDE, GLIDE_BOX_LINE_S, NO_GLIDE_INPUT, glideSoftBoxLine, terrainGlideWorld, type GlideWorld, type TallStructure } from './glide';
import { LiveTall } from './glideTall';
import { faceOpen } from './faceOpen';
import { CALL_MIN_DIST, ENTER_RADIUS, MoveMachine, TIMING, nearestEnterSlot, pickExitSlot, pickTransitExit, type DoorSlot, type MoveOutcome, type SlotWorld } from './modes';
import { DeckWalker, agePlatforms, platforms, releasePlatformStop, requestPlatformStop, rider as platformRider, spotFor, toLocal, toWorld, type DeckRect, type Platform } from './platform';
import { PursuitDriver } from './vehicles/autopilot';
import { NO_DRIVE, TERRAIN_WORLD, findFit, poseCheck, type DriveInput, type StepReport } from './vehicles/collide';
import type { DriveTalk } from './vehicles/driveTalk';
import { Fleet, type Ride } from './vehicles/fleet';
import { Pelican } from './vehicles/pelican';
import { BIKE_VISUAL } from './vehicles/models';
import type { CityBikePool } from './vehicles/cityBikes';
import { notifyGlide, type FleetSnapshot } from './moveApi';
import { collectObstacles, residents, rideables } from './view';

/**
 * Movement system (plan §6): turns input into the movement state machine (actors/modes.ts) and runs whatever the
 * newcomer is on — the bike and the toy car (vehicles/*), the pelican glide, the streetcar platform, a bench — then
 * says where the newcomer and BAYBAY should be drawn (placement + pose hints) for actors/system.ts to apply.
 *
 * Input (plan §6.10): F enter / exit (hold with nothing near: call your vehicle), G take off / land, H bell / horn,
 * E at a bench / on transit (seat ↔ rail), Space hop / hop off transit, R back on the road. Store: `move` changes on
 * transitions only; per-frame vehicle / glide state goes to runtime.vehicle / runtime.glide. Events: see
 * core/events.ts ('vehicle:*', 'glide:*', 'sit', 'stand', 'hill', 'pant', 'transit:spot').
 * Collision / ground only through core/terrain (the streamed city extends it).
 *
 * Tap-to-drive (lane E2 wave 2, E2-4): while riding a bike or the toy car, a ground tap / moveApi.driveTo(p) fetches a
 * drive route (vehicles/driveRoute: grid A* on a drive mask, or the city walking graph with the vehicle's edge filter)
 * and a PursuitDriver (vehicles/autopilot) steers the vehicle along it through the same DriveInput the keyboard uses;
 * any manual input takes over. Save v2 (E2-15): fleetSnapshot / restoreFleet (via actors/moveApi).
 */

export interface MoveEnv {
  cameraYaw: number;
  /** flow-level freeze: dialogue, photo mode, cinematic, fishing, postcard reward, title */
  frozen: boolean;
  playing: boolean;
  controller: PlayerController;
  frustum: THREE.Frustum;
  /** compile an object's programs ahead of time (GLB swap without a hitch) */
  precompile?: (o: THREE.Object3D) => Promise<unknown>;
}

/** Where to draw a character this frame (rig root) when the movement system carries it. */
export interface Placement {
  active: boolean;
  x: number;
  y: number;
  z: number;
  quat: THREE.Quaternion;
  /** × CHAR_SCALE */
  scale: number;
}

/** Pose hints for the animator. */
export interface RideAnim {
  ride: RidePose | null;
  pedal: { angle: number; y: number; z: number; r: number } | null;
  standing: boolean;
  sitting: boolean;
  /** holding a transit pole (arm up) */
  pole: boolean;
  /** walking the aisle: speed + stride for the walk cycle */
  speed: number;
  stride: number;
}

type GuideSeat = 'none' | 'in' | 'seated' | 'out';

const SLOTS: SlotWorld = { canStand, heightAt };
/** vehicles/driveTalk, loaded with the first drive (W4-G4: BAYBAY's cues from the basket) */
let driveTalkMod: typeof import('./vehicles/driveTalk') | null = null;
/** a stuck autopilot tries this many ways round per drive, each to the route this far (u) past where it stands (D6) */
const DETOURS = 2, DETOUR_AHEAD = 14;
/** the autopilot waits this long (s) for someone in front to walk on before its back-up-and-retry (verify-desktop D6) */
const WAY_WAIT = 6;
/** obstacle kinds that move on by themselves (toy traffic): the autopilot waits for them like for people */
const MOVING_KINDS: ReadonlySet<string> = new Set(['car', 'traffic', 'vehicle', 'bus', 'streetcar']);
/** obstacle kinds that are people: a vehicle stopping short of one gets a "whoa" (giveWay) */
const PERSON_KINDS: ReadonlySet<string> = new Set(['npc', 'crowd', 'person', 'resident', 'baybay']);
const UPY = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const tmpE = new THREE.Euler(0, 0, 0, 'YXZ');
const tmpS = new THREE.Sphere();
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => k * k * (3 - 2 * k);
const newPlacement = (): Placement => ({ active: false, x: 0, y: 0, z: 0, quat: new THREE.Quaternion(), scale: 1 });

/** Key / button names for hints, by input device. */
function keyName(action: 'exit' | 'glide'): { zh: string; en: string } {
  const d = runtime.input.device;
  if (action === 'exit') return d === 'touch' ? { zh: '点「下车」', en: 'tap Get off' } : d === 'gamepad' ? { zh: 'Y 下车', en: 'Y to get off' } : { zh: 'F 下车', en: 'F to get off' };
  return d === 'touch' ? { zh: '点「起飞」', en: 'tap Glide' } : d === 'gamepad' ? { zh: '按 L3 起飞', en: 'press L3 to take off' } : { zh: '按 G 起飞', en: 'press G to take off' };
}

/**
 * Tap-to-drive's routing (vehicles/driveRoute: grid / graph drive routes, the park-short rule, the grid for a way round)
 * is its own chunk, fetched when a bike / the toy car is mounted (part b: GameRoot keeps its size).
 */
let driveMod: typeof import('./vehicles/driveRoute') | null = null;
let driveLoad: Promise<typeof import('./vehicles/driveRoute')> | null = null;
function loadDrive(): Promise<typeof import('./vehicles/driveRoute')> {
  return (driveLoad ??= import('./vehicles/driveRoute').then(m => (driveMod = m), e => { driveLoad = null; throw e; }));
}

/** Interactables a drive parks short of (not rides, seats, BAYBAY or a lead marker): ones you walk up to. */
const PARK_SKIP: ReadonlySet<string> = new Set(['vehicle', 'seat', 'baybay', 'free-lead']);
/** The things to walk up to within reach of a drive's end (verify-desktop D5): the autopilot stops short of them. */
function parkSpotsNear(end: Vec2, clear: number): Vec2[] {
  const out: Vec2[] = [];
  for (const it of interactables()) {
    if (PARK_SKIP.has(it.source) || it.id.startsWith('ride:') || it.id.startsWith('seat:')) continue;
    if (Math.hypot(it.x - end.x, it.z - end.z) < clear) out.push({ x: it.x, z: it.z });
  }
  return out;
}

/** A transit hop-off farther than this from the rider (u) is a cut to the spot, not a 0.4 s hop (a ferry's quay). */
const ALIGHT_HOP_MAX = 6;
/** On a cable car BAYBAY sits on the rider's (camera-side) outward bench, this far along it from the rider's seat (u). */
const CABLE_GUIDE_DZ = 0.62;
/** On the sightseeing bus BAYBAY sits this far toward the aisle from the rider's bench seat (lane T's TOUR_BUS_SPOTS). */
const BUS_GUIDE_DX = 0.46;
/** The walkable rect of a platform the rider is in: the aisle, or one of `decks` (a running board, a sun deck). */
function deckRectAt(plat: Platform, x: number, z: number): DeckRect {
  let best = plat.deck, bestD = rectDist(plat.deck, x, z);
  for (const d of plat.decks ?? []) { const dd = rectDist(d, x, z); if (dd < bestD) { best = d; bestD = dd; } }
  return best;
}
const rectDist = (r: DeckRect, x: number, z: number) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

/** BAYBAY's scale in each seat (the basket is small; she tucks in). */
const GUIDE_SEAT_SCALE = { bike: 0.72, car: 0.85, glide: 0.85 } as const;

export class MoveSystem {
  readonly root = new THREE.Group();
  readonly machine = new MoveMachine();
  readonly fleet = new Fleet();
  readonly pelican = new Pelican();
  readonly deck = new DeckWalker();
  readonly seats: SeatSpot[] = seatSpots();
  /** outputs for actors/system.ts */
  readonly rider = newPlacement();
  readonly guide = newPlacement();
  readonly riderAnim: RideAnim = { ride: null, pedal: null, standing: false, sitting: false, pole: false, speed: 0, stride: 0 };
  readonly guideAnim = { sitting: false, pole: false, hop: 0 };
  /** the ridden / last-ridden vehicle */
  ride: Ride | null = null;
  lastRide: Ride | null = null;
  /** sitting on */
  seat: SeatSpot | null = null;
  /** true while BAYBAY is carried (seated / hopping in or out) — the guide mover must not steer her */
  guideCarried = false;
  /** landing impact to squash the newcomer with (consumed by the system) */
  landing = 0;
  glideUnlocked = false;
  /** the last movement events (QA / debugging; filled by actors/system.ts) */
  readonly recent: Record<string, unknown>[] = [];
  private glideWorld: GlideWorld | null = null;
  private seen = { vehicle: input.vehicleCount, call: input.callVehicleCount, glide: input.glideCount, horn: input.hornCount, interact: input.interactCount, reset: input.resetCount, hopOff: input.hopOffCount };
  private guideSeat: GuideSeat = 'none';
  private guideT = 0;
  private guideDur = 0.4;
  private guideFrom = new THREE.Vector3();
  private guideTo = new THREE.Vector3();
  private guidePop = false;
  private boardFrom = new THREE.Vector3();
  private boardHeading = 0;
  private standSpot: { x: number; z: number } | null = null;
  private landSpot: { x: number; z: number } | null = null;
  private hintAt = -99;
  private hillSeen = false;
  private freezeT = 0;
  private cameraSide: 1 | -1 = 1;
  private seenPant = -10;
  /** where this system last put the logical player (to notice someone else teleporting them) */
  private wroteX = NaN;
  private wroteZ = NaN;
  // --- tap-to-drive (E2-4)
  /** the autopilot following a drive route, and the pending route request */
  auto: PursuitDriver | null = null;
  /** W4-G4 (part b): BAYBAY's pointing and lines on the autopilot's route while she rides along */
  private driveTalk: DriveTalk | null = null;
  /** ways round a stuck spot taken on this drive (part b, D6) */
  private detours = 0;
  private autoToken: { aborted: boolean } | null = null;
  /** where the autopilot is heading (the tapped point, then the route's end) — the target ring */
  driveTarget: Vec2 | null = null;
  /** the current drive route (breadcrumbs) and counters the actor system watches: route arrived, arrival, no route */
  drivePath: Vec2[] = [];
  driveRoutes = 0;
  driveArrivals = 0;
  driveFails = 0;
  /** save v2: a fleet restore waiting for its ground to stream in */
  private restoreWait: { snap: FleetSnapshot; t: number } | null = null;
  /** city mode (E2-12): the pooled bikes at the racks near the player and the city benches (vehicles/cityBikes.ts, lazy) */
  cityBikes: CityBikePool | null = null;
  private cityBikesLoad: Promise<unknown> | null = null;
  /** dispose() ran (E2-review: the lazy city chunks check it) */
  private disposed = false;
  private frustum: THREE.Frustum | null = null;
  private readonly seenRide = (r: Ride) => !!this.frustum?.intersectsSphere(tmpS.set(tmpV.set(r.sim.x, r.sim.y + 0.5, r.sim.z), 1.4));

  constructor() {
    this.root.name = 'opus-move';
    this.root.add(this.fleet.group, this.pelican.group);
    this.glideUnlocked = game.get().viewpointUnlocked || readQa().debug;
    this.publishRideables();
  }

  /**
   * Save v2 restore (G1, via moveApi.setGlideUnlocked): unlock without the "Unlocked" line and sound (the player has
   * heard it before), start loading the pelican; false locks again (Settings reset). A viewpoint already unlocked in
   * the store unlocks it again on the next frame, as before.
   */
  setGlideUnlocked(v: boolean) {
    if (v && !this.glideUnlocked) this.pelican.load(this.precompile ?? undefined);
    this.glideUnlocked = v;
  }
  /** the last env.precompile seen (for a quiet unlock outside the frame) */
  private precompile: MoveEnv['precompile'] | null = null;

  get mode() { return this.machine.mode; }
  /** the controller must not move the body (vehicle, glide, bench, transit) */
  get carried() { const m = this.machine.mode; return m !== 'foot' && m !== 'photo'; }

  // ---------------------------------------------------------------------------
  // Requests
  // ---------------------------------------------------------------------------

  /** Interactables (game/interactables.ts): `ride:<id>` board that vehicle, `seat:<id>` sit there. */
  onInteract(id: string, controller: PlayerController) {
    if (id.startsWith('ride:')) { const r = this.fleet.byId(id.slice(5)); if (r) this.tryEnter(r, controller); }
    else if (id.startsWith('seat:')) { const s = this.seats.find(x => x.id === id); if (s) this.trySit(s, controller); }
  }

  /** The nearest free vehicle the player can walk up to (door slot within ENTER_RADIUS, reachable). */
  private boardable(): { ride: Ride; dist: number } | null {
    const p = runtime.player;
    let best: { ride: Ride; dist: number } | null = null;
    for (const r of this.fleet.rides) {
      if (r.occupied || r.call) continue;
      const s = r.sim;
      if (Math.hypot(s.x - p.x, s.z - p.z) > ENTER_RADIUS + 3) continue;
      const slot = nearestEnterSlot(SLOTS, p, { x: s.x, z: s.z, y: s.y, heading: s.heading }, r.width, r.length);
      // right next to it counts too (the slot check wants a clear walk; standing on the slot is enough)
      const d = slot ? slot.dist : Math.hypot(s.x - p.x, s.z - p.z) < r.length * 0.5 + 0.9 ? 0.5 : null;
      if (d === null) continue;
      if (!best || d < best.dist) best = { ride: r, dist: d };
    }
    return best;
  }

  private tryEnter(r: Ride, controller: PlayerController) {
    // tap-to-drive's routing, before the first tap
    if (r.kind === 'bike' || r.kind === 'car') void loadDrive().catch(() => { /* offline: routes load on the tap */ });
    const p = runtime.player;
    const s = r.sim;
    const slot = nearestEnterSlot(SLOTS, p, { x: s.x, z: s.z, y: s.y, heading: s.heading }, r.width, r.length);
    const dist = slot ? slot.dist : Math.hypot(s.x - p.x, s.z - p.z) < r.length * 0.5 + 0.9 ? 0.5 : null;
    // stop the walker first (the guard wants both still)
    controller.vx = 0; controller.vz = 0;
    p.pathTarget = null; p.pendingInteract = null;
    const res = this.machine.enter(r.kind, { slotDistance: dist, playerSpeed: 0, vehicleSpeed: Math.abs(s.v) });
    if (!res.ok) { if (res.reason === 'far') say('走近一点再上车', 'Walk up to it first'); return; }
    this.ride = r;
    this.lastRide = r;
    r.occupied = true;
    r.call = null;
    this.boardFrom.set(p.x, p.y, p.z);
    this.boardHeading = p.heading;
    this.startGuideIn();
    this.publishRideables();
  }

  private trySit(seat: SeatSpot, controller: PlayerController) {
    const res = this.machine.sit({ grounded: controller.grounded });
    if (!res.ok) return;
    const p = runtime.player;
    this.seat = seat;
    this.boardFrom.set(p.x, p.y, p.z);
    this.boardHeading = p.heading;
    // where to stand up again: in front of the seat, else where we came from
    const fx = seat.x + Math.sin(seat.heading) * 1.1, fz = seat.z + Math.cos(seat.heading) * 1.1;
    this.standSpot = canStand(fx, fz, 0.45) ? { x: fx, z: fz } : nearestWalkable({ x: fx, z: fz }, 3) ?? { x: p.x, z: p.z };
    controller.vx = 0; controller.vz = 0;
    p.pathTarget = null;
    emit({ type: 'sit', seat: seat.id });
  }

  private tryTakeOff(controller: PlayerController) {
    if (!this.glideUnlocked) {
      say('先去科伊特塔观景台看看，就能解锁鹈鹕滑翔', 'Visit the Coit Tower viewpoint to unlock the pelican glide');
      emit({ type: 'ui', action: 'error' });
      return;
    }
    const p = runtime.player;
    const res = this.machine.takeOff({ unlocked: true, grounded: controller.grounded });
    if (!res.ok) return;
    this.pelican.load();
    // fly where the camera looks (the view you want), not where the feet happen to point
    const heading = runtime.camera.yaw + Math.PI;
    this.pelican.sim.takeOff(p.x, p.z, heading, this.world());
    this.pelican.show();
    this.boardFrom.set(p.x, p.y, p.z);
    this.boardHeading = p.heading;
    controller.vx = 0; controller.vz = 0;
    p.pathTarget = null;
    this.startGuideIn();
    emit({ type: 'glide:start' });
  }

  /**
   * G while gliding: land at the nearest standable spot within 40 u; with none that close (roofs, open water), the
   * pelican heads for the nearest walkable ground within 200 u and lands once it is in range.
   */
  private tryLand(quiet = false): boolean {
    const dur = this.pelican.sim.beginLanding(this.world());
    const res = this.machine.land({ spotFound: dur !== null, seconds: dur ?? 0 });
    if (!res.ok) {
      if (res.reason === 'no-landing' && !this.approach) {
        const g = this.pelican.sim;
        const far = nearestWalkable({ x: g.x, z: g.z }, 200);
        if (far) { this.approach = far; if (!quiet) say('找个地方降落…', 'Looking for a place to land…'); }
        else if (!quiet) say('这里没有落脚的地方，再飞一会儿', 'Nowhere to land here — fly on a little');
        emit({ type: 'glide:no-landing' });
      }
      return false;
    }
    this.approach = null;
    this.landSpot = this.pelican.sim.landing;
    return true;
  }
  /** heading for ground to land on (see tryLand) */
  private approach: { x: number; z: number } | null = null;

  /** Hold F: roll your last vehicle up (only when it is far). */
  private callVehicle() {
    const r = this.lastRide, p = runtime.player;
    if (!r) { say('先骑一次单车或开一次小车，之后就能长按 F 叫它', 'Ride a bike or the toy car once, then hold F to call it'); return; }
    if (Math.hypot(r.sim.x - p.x, r.sim.z - p.z) < CALL_MIN_DIST) { say('你的车就在附近', 'Your ride is right nearby'); return; }
    if (this.fleet.summon(r, p, runtime.camera.yaw)) {
      emit({ type: 'vehicle:call', vehicle: r.kind, id: r.id });
      say(r.kind === 'car' ? '小车开过来啦' : '单车骑过来啦', r.kind === 'car' ? 'Here comes your toy car' : 'Here comes your bike', 'success');
    }
  }

  /** Fast travel / restarts (lane G): everything back on foot, the vehicle parked where it is. */
  toFoot() {
    this.cancelDrive(true);
    if (this.ride) { this.ride.occupied = false; this.ride = null; }
    this.machine.toFoot();
    this.seat = null;
    this.releaseGuide(false);
    if (this.pelican.visible) this.pelican.flyOff();
    platformRider.platform = null;
    this.publishRideables();
  }

  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------

  update(dt: number, t: number, env: MoveEnv) {
    agePlatforms(dt);
    const m = this.machine;
    const s = game.get(), p = runtime.player;
    const c = env.controller;
    this.landing = 0;
    if (env.precompile) this.precompile = env.precompile;

    // glide unlock (the Coit viewpoint sets viewpointUnlocked; ?debug=1 unlocks from the start)
    if (!this.glideUnlocked && s.viewpointUnlocked) {
      this.glideUnlocked = true;
      notifyGlide();
      this.pelican.load(env.precompile);
      emit({ type: 'glide:unlock' });
      const k = keyName('glide');
      say(`解锁：鹈鹕滑翔！${k.zh}`, `Unlocked: pelican glide! ${k.en[0].toUpperCase()}${k.en.slice(1)}`, 'gold', 4200);
    }

    // --- sync with the store: flow boards / ends streetcar rides and restarts the game
    if (s.move.mode === 'transit' && m.mode !== 'transit') this.beginTransit(s.move.line ?? 'streetcar');
    // (the hop-off's 0.4 s step down from the car runs on after the flow ended the ride: E2-10)
    else if (s.move.mode !== 'transit' && m.mode === 'transit' && m.phase !== 'alighting') { m.endTransit(); platformRider.platform = null; this.releaseGuide(true); }
    if (!env.playing && m.mode !== 'foot' && m.mode !== 'transit') this.toFoot();
    // fast travel (game flow): the store says 'travel' → everything parked, the pelican picks the player (and BAYBAY) up
    // and flies G1's sky path (travelPose, E2-8 / G1 request 1); back on foot at the arrival spot after
    // (a trip started mid-glide — the map's 飞过去 while flying — keeps the pelican and both riders aloft: E2-review)
    if (s.move.mode === 'travel' && m.mode !== 'travel') {
      const aloft = m.mode === 'glide' && this.pelican.visible;
      if (aloft) { this.approach = null; m.toFoot(); } else this.toFoot();
      m.beginTravel();
      this.beginTravelRide(aloft);
    }
    else if (s.move.mode !== 'travel' && m.mode === 'travel') { m.endTravel(); this.endTravelRide(); }

    // someone else moved the player (flow teleport, ?at=, QA) while we carried them: park and let the teleport stand
    if ((m.mode === 'bike' || m.mode === 'car' || m.mode === 'glide' || m.mode === 'sit') && Number.isFinite(this.wroteX)
      && Math.hypot(p.x - this.wroteX, p.z - this.wroteZ) > 0.5) {
      const tx = p.x, tz = p.z;
      this.toFoot();
      p.x = tx; p.z = tz;
      c.sync();
    }

    // --- edges (always consumed so they never fire late)
    const vehiclePress = input.vehicleCount !== this.seen.vehicle;
    const callPress = input.callVehicleCount !== this.seen.call;
    const glidePress = input.glideCount !== this.seen.glide;
    const hornPress = input.hornCount !== this.seen.horn;
    const interactPress = input.interactCount !== this.seen.interact;
    const resetPress = input.resetCount !== this.seen.reset;
    const hopOffPress = input.hopOffCount !== this.seen.hopOff;
    this.seen = { vehicle: input.vehicleCount, call: input.callVehicleCount, glide: input.glideCount, horn: input.hornCount, interact: input.interactCount, reset: input.resetCount, hopOff: input.hopOffCount };
    const frozen = env.frozen;
    const busyFlow = !!s.dialogue.nodeId || s.photoMode || !!flow.get().cinematic;

    // --- per mode
    const mode = m.mode;
    let near: { ride: Ride; dist: number } | null = null;
    if (mode === 'foot' && env.playing && !busyFlow) {
      near = this.boardable();
      if (vehiclePress && near) this.tryEnter(near.ride, c);
      else if (callPress) this.callVehicle();
      if (glidePress && m.mode === 'foot') this.tryTakeOff(c);
    } else if (mode === 'sit') {
      const moved = input.manualMove || runtime.input.jump || (interactPress && !s.focus && !s.dialogue.nodeId) || vehiclePress;
      if (m.phase === 'steady' && moved && !frozen) {
        runtime.input.jump = false;
        m.stand();
      }
    } else if (mode === 'bike' || mode === 'car') {
      if (vehiclePress && m.phase === 'steady' && !frozen) m.exit();
      if (hornPress && this.ride && !frozen) emit({ type: 'vehicle:horn', vehicle: this.ride.kind });
      if (resetPress && this.ride && m.phase === 'steady') { this.cancelDrive(); if (this.fleet.reset(this.ride)) spawnFx('dust', this.ride.sim.x, this.ride.sim.y + 0.3, this.ride.sim.z); }
    } else if (mode === 'glide') {
      if (glidePress && m.phase === 'steady' && !frozen) { if (this.approach) this.approach = null; else this.tryLand(); }
    } else if (mode === 'transit') {
      const r = currentRide();
      if (!frozen && r && (m.phase === 'steady' || m.phase === 'boarding')) {
        const hop = runtime.input.jump;
        if (hop) runtime.input.jump = false;
        if (hop || vehiclePress || hopOffPress) {
          const status = r.line && m.phase === 'steady' ? hopOffStatus(r.line) : null;
          if (r.mode === 'wait') { cancelRide(); m.endTransit(); platformRider.platform = null; this.releaseGuide(false); }
          else if (r.line && m.phase === 'steady' && r.kind === 'ferry' && status?.station == null) {
            // lane F's request (sf-w3-F.md part a): no hopping off a ferry under way — only onto a quay, once it docks
            say('等船靠岸', 'Wait until we dock');
          } else if (status?.canHopOff === false) {
            // wave 4 (lane T's review open 1, E2's review): a Metro train in a tunnel or under a portal hood ignores the
            // brake, so the rider would step off a moving (or hidden) train onto the street above: say why, ride on
            if (status.portalWait) say('马上出隧道…', 'Coming out of the tunnel…');
            else say('隧道里不能下车', 'No getting off inside the tunnel');
          } else if (r.line && m.phase === 'steady') {
            // E2-10 (sf-w2-contracts §5.2): ask the car to stop, brake, then step off (onOutcome 'transit-alight')
            requestPlatformStop(r.line, TIMING.transitBrake);
            m.brakeTransit();
          } else if (!r.line) {
            // the hero F-line car does not honour stop requests yet (lane F, world/streetcar.ts): off at once, as before
            hopOffRide();
            m.endTransit(); platformRider.platform = null; this.releaseGuide(false);
          }
        }
        else if (interactPress && r.mode !== 'wait' && m.switchSpot().ok && m.spot) { this.placeOnSpot(); emit({ type: 'transit:spot', line: m.line ?? 'streetcar', spot: m.spot }); }
        else if (input.manualMove && r.mode !== 'wait' && m.spot !== 'deck') m.walkDeck();
      } else if (!frozen) runtime.input.jump = false;
    }
    input.vehicleContext = this.carried && (mode === 'bike' || mode === 'car' || mode === 'glide') ? 'in' : near ? 'near' : 'none';
    // the autopilot only drives a steady ride (F to get off, R, a teleport … hand control back)
    if ((this.auto || this.autoToken) && (!(m.mode === 'bike' || m.mode === 'car') || m.phase !== 'steady' || !this.ride)) this.cancelDrive(m.mode !== 'bike' && m.mode !== 'car');
    if (this.restoreWait) { this.restoreWait.t += dt; if (this.restoreWait.t > 60 || this.tryRestore(this.restoreWait.snap)) this.restoreWait = null; }
    // city racks and benches (E2-12): park the pooled bikes near the player, recycle the far ones
    this.frustum = env.frustum;
    if (s.worldMode === 'city') {
      this.cityBikesLoad ??= import('./vehicles/cityBikes').then(mod => {
        // (a system disposed while the chunk loaded registers nothing: its interactables source would outlive it)
        if (this.disposed) return;
        this.cityBikes = new mod.CityBikePool(this.fleet);
        this.seats.push(...mod.cityBenchSeats());
        this.cityBikes.register();
      }, () => { this.cityBikesLoad = null; });
      if (this.cityBikes?.update(dt, p, this.seenRide)) this.publishRideables();
    }

    // --- advance the vehicles / glide
    const ride = this.ride;
    if ((mode === 'bike' || mode === 'car') && ride) this.driveRide(ride, dt, frozen, t);
    if (mode === 'glide') this.flyGlide(dt, frozen);
    if (mode === 'travel') this.flyTravel(dt);
    for (const r of this.fleet.rides) {
      if (r === this.ride && this.carried) continue;
      const visible = env.frustum.intersectsSphere(tmpS.set(tmpV.set(r.sim.x, r.sim.y + 0.5, r.sim.z), 1.4));
      this.fleet.idle(r, dt, p, visible);
    }
    for (const r of this.fleet.rides) if (r.dirty || r === this.ride) { this.fleet.pose(r, dt); r.rig.mesh.updateMatrixWorld(); }
    this.pelican.update(dt, t);

    // --- state machine timers
    const transitCar = m.mode === 'transit' ? platforms.get(m.line ?? 'streetcar') : undefined;
    const outs = m.tick(dt, {
      vehicleSpeed: this.ride ? Math.abs(this.ride.sim.v) : transitCar?.live ? Math.hypot(transitCar.vx, transitCar.vz) : 0,
      findExitSlot: () => (this.ride ? pickExitSlot(SLOTS, { x: this.ride.sim.x, z: this.ride.sim.z, y: this.ride.sim.y, heading: this.ride.sim.heading }, this.ride.width, this.ride.length)
        : m.mode === 'transit' ? this.transitExit(transitCar) : null),
    });
    for (const o of outs) this.onOutcome(o, c);

    // --- the crest pant (controller), first steep hill
    if (c.pantAt !== this.seenPant) { this.seenPant = c.pantAt; if (m.mode === 'foot') emit({ type: 'pant' }); }
    const grade = m.mode === 'foot' ? c.grade : this.ride && this.carried ? this.ride.sim.grade : 0;
    if (!this.hillSeen && grade > 0.4 && (m.mode === 'foot' ? p.moving : Math.abs(this.ride?.sim.v ?? 0) > 1)) {
      this.hillSeen = true;
      emit({ type: 'hill', grade, mode: m.mode === 'bike' || m.mode === 'car' ? m.mode : 'foot' });
    }

    // --- placement + runtime / store publish
    this.place(dt, env);
    this.publish();
    this.wroteX = p.x; this.wroteZ = p.z;
  }

  private beginTransit(line: string) {
    this.machine.beginTransit(line, 'rail');
    const plat = platforms.get(line);
    if (plat) this.deck.place(plat.rail);
    // (BAYBAY hops in once the car is actually here — see placeTransit)
  }

  private driveRide(ride: Ride, dt: number, frozen: boolean, t: number) {
    const m = this.machine;
    let inp: DriveInput = NO_DRIVE;
    const gated = this.guideSeat === 'in' && this.guideT < 1.5; // wait for BAYBAY to sit down
    if (m.phase === 'braking' || (frozen && Math.abs(ride.sim.v) > 0.05)) {
      this.freezeT += frozen ? dt : 0;
      inp = { ...NO_DRIVE, brake: this.freezeT < 1.5 || m.phase === 'braking' ? 1 : 0 };
    } else if (m.phase === 'steady' && !frozen && !gated) {
      this.freezeT = 0;
      const y = runtime.input.moveY;
      const hop = runtime.input.jump;
      runtime.input.jump = false;
      // any manual input takes over from the autopilot
      if ((this.auto || this.autoToken) && (input.manualMove || input.throttle > 0.05 || input.brake > 0.05 || hop)) this.cancelDrive();
      if (this.auto) inp = this.stepAuto(ride, this.auto, dt, t);
      else if (this.autoToken) inp = NO_DRIVE; // the route is on its way: roll on
      else {
        inp = {
          throttle: Math.max(0, y, input.throttle),
          brake: Math.max(0, -y, input.brake),
          steer: runtime.input.moveX,
          digital: !input.analogSteer,
          sprint: runtime.input.run,
          hop,
        };
      }
    }
    const x0 = ride.sim.x, y0 = ride.sim.y, z0 = ride.sim.z;
    const report = this.fleet.drive(ride, dt, inp);
    this.onDriveReport(ride, report, t);
    this.giveWay(ride, t, x0, y0, z0);
  }

  // ---------------------------------------------------------------------------
  // Tap-to-drive (E2-4) and save v2 (E2-15)
  // ---------------------------------------------------------------------------

  /**
   * Drive the ridden bike / toy car to p (a ground tap, G1's 骑车去 / 开车去). False when not riding one. The route
   * is fetched asynchronously (abortable); the vehicle rolls on meanwhile and the autopilot takes it from there.
   */
  driveTo(p: Vec2): boolean {
    const m = this.machine, r = this.ride;
    if (!r || !(m.mode === 'bike' || m.mode === 'car') || m.phase !== 'steady' || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return false;
    this.cancelDrive(true);
    const token = { aborted: false };
    this.autoToken = token;
    this.driveTarget = { x: p.x, z: p.z };
    const from = { x: r.sim.x, z: r.sim.z }, kind = r.kind;
    (driveMod ? Promise.resolve(driveMod) : loadDrive()).then(D => D.driveRoute(from, p, kind, { signal: token }).then(route => ({ D, route }))).then(({ D, route }) => {
      if (token.aborted || this.autoToken !== token) return;
      this.autoToken = null;
      if (!route || this.ride !== r || route.points.length < 2) {
        this.driveTarget = null;
        this.driveFails++;
        say('那边开不过去', r.kind === 'car' ? 'The toy car can’t get there' : 'The bike can’t get there');
        return;
      }
      // (part b, verify-desktop D5) park short of a card / resident / place at the end, never on top of it
      const points = D.stopShortOf(route.points, parkSpotsNear(route.points[route.points.length - 1], D.PARK_CLEAR));
      this.auto = new PursuitDriver(r.sim.spec, points);
      this.driveTalk = null;
      this.talk(points, true);
      this.detours = 0;
      this.drivePath = points;
      this.driveTarget = points[points.length - 1];
      this.driveRoutes++;
      emit({ type: 'vehicle:auto', vehicle: r.kind, state: 'start' });
    }, () => {
      if (this.autoToken !== token) return;
      this.autoToken = null; this.driveTarget = null; this.driveFails++;
    });
    return true;
  }

  /** Stop the autopilot (and a pending route). `quiet`: no 'cancel' event (mode changes, a newer request). */
  cancelDrive(quiet = false) {
    if (this.autoToken) this.autoToken.aborted = true;
    const was = !!this.auto || !!this.autoToken;
    this.autoToken = null;
    this.auto = null;
    this.driveTarget = null;
    this.drivePath = [];
    if (was && !quiet && this.ride) emit({ type: 'vehicle:auto', vehicle: this.ride.kind, state: 'cancel' });
  }

  /** The autopilot is fetching or following a route. */
  get autoDriving(): boolean { return !!this.auto || !!this.autoToken; }

  private stepAuto(ride: Ride, auto: PursuitDriver, dt: number, t: number): DriveInput {
    const s = ride.sim;
    // the ground just ahead still streaming in (city): wait there, that is not being stuck
    const ahead = groundPending(s.x + Math.sin(s.heading) * 2.5, s.z + Math.cos(s.heading) * 2.5, 0.6);
    // (part b, verify-desktop D6) someone walking across in front (giveWay held the vehicle this frame or the last):
    // wait for them, up to WAY_WAIT s — the bike's 骑车去 from Dolores Park gave up 3 times among the park's walkers
    // (held → "no progress" → back up → held again → "your turn to steer"). Someone who stays put: the usual back-up.
    const held = t - this.wayHeldAt < 0.3 && t - this.wayHeldSince < WAY_WAIT;
    const inp = auto.step(s, dt, ahead || held);
    // W4-G4 (part b): BAYBAY in the basket / front seat points ≈ 20 u before a turn over 45° and says a line at a third
    // and at two thirds of a long drive (plan §4.2 "BAYBAY leads", bike / car)
    // (never over a line she is saying: the trip's "骑车出发！", a place greeting — a corner passed meanwhile goes unsaid)
    const cue = this.guideSeat === 'seated' && auto.state === 'drive' && !flow.get().bubble ? this.driveTalk?.step(auto.s, t) : null;
    if (cue && (ride.kind === 'bike' || ride.kind === 'car')) {
      if (cue.kind === 'turn') emit({ type: 'emote', who: 'baybay', emote: 'point' });
      bubble(driveTalkMod!.driveCueLine(cue, ride.kind), 2600);
    }
    if (auto.state === 'arrived' && Math.abs(s.v) < 0.3) {
      emit({ type: 'vehicle:auto', vehicle: ride.kind, state: 'arrive' });
      this.driveArrivals++;
      this.auto = null; this.driveTarget = null; this.drivePath = [];
    } else if (auto.state === 'stuck' && this.detours < DETOURS && this.detour(ride, auto)) {
      // (part b, verify-desktop D6) a way round: the rest of the drive goes on from here
    } else if (auto.state === 'stuck') {
      emit({ type: 'vehicle:auto', vehicle: ride.kind, state: 'stuck' });
      say('前面过不去了，换你来开吧', 'Can’t get through here — your turn to steer');
      this.driveFails++;
      this.auto = null; this.driveTarget = null; this.drivePath = [];
    }
    return inp;
  }

  /**
   * (part b, verify-desktop D6) The autopilot backed up and still could not get on (a hairpin at a street corner, a
   * tree on the sidewalk the walking graph runs past): a grid route on the drive mask from where the vehicle stands to
   * the first drivable point of the route DETOUR_AHEAD u or more further on, then the rest of the route. False when
   * there is none (the drive then gives up as before: "前面过不去了，换你来开吧").
   */
  private detour(ride: Ride, auto: PursuitDriver): boolean {
    const D = driveMod;
    if (!D || (ride.kind !== 'bike' && ride.kind !== 'car')) return false;
    const { drivableAt, findDrivePath } = D;
    const s = ride.sim, kind = ride.kind;
    let ahead = Math.min(auto.total, auto.s + DETOUR_AHEAD), to = auto.pointAt(ahead);
    while (!drivableAt(to.x, to.z, kind) && ahead < auto.total) { ahead = Math.min(auto.total, ahead + 1); to = auto.pointAt(ahead); }
    if (!drivableAt(to.x, to.z, kind)) return false;
    const res = findDrivePath({ x: s.x, z: s.z }, to, kind, 3);
    if (!res || res.snapped || !res.points.length) return false;
    const pts: Vec2[] = [{ x: s.x, z: s.z }, ...res.points];
    let acc = 0;
    for (let i = 1; i < auto.path.length; i++) {
      const a = auto.path[i - 1], b = auto.path[i];
      acc += Math.hypot(b.x - a.x, b.z - a.z);
      if (acc > ahead + 0.3) pts.push({ x: b.x, z: b.z });
    }
    if (pts.length < 2) return false;
    this.detours++;
    this.auto = new PursuitDriver(s.spec, pts);
    this.driveTalk = null;
    this.talk(pts, false);
    this.drivePath = pts;
    this.driveTarget = pts[pts.length - 1];
    return true;
  }

  /**
   * BAYBAY's cues for this drive (W4-G4): the module is its own chunk (fetched with the first drive; GameRoot does not
   * carry it). `thirds`: the 1/3 and 2/3 lines (not for a detour's rest of a drive).
   */
  private talk(points: Vec2[], thirds: boolean) {
    const auto = this.auto;
    const make = (m: typeof import('./vehicles/driveTalk')) => { if (this.auto === auto) this.driveTalk = new m.DriveTalk(points, m.DRIVE_TALK, thirds); };
    if (driveTalkMod) make(driveTalkMod);
    else void import('./vehicles/driveTalk').then(m => { driveTalkMod = m; make(m); }, () => { /* offline: a quiet drive */ });
  }

  /** Save v2 (G1): the last-ridden bike and the toy car, when they are away from their spots (or ridden). */
  fleetSnapshot(): FleetSnapshot {
    const out: FleetSnapshot = {};
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const bikes = this.fleet.rides.filter(r => r.kind === 'bike');
    const bike = [this.ride, this.lastRide].find(r => r?.kind === 'bike') ?? bikes.find(r => r.displaced);
    if (bike && (bike.displaced || bike.occupied)) out.bike = { id: bike.id, x: r2(bike.sim.x), z: r2(bike.sim.z), heading: r2(bike.sim.heading) };
    const car = this.fleet.rides.find(r => r.kind === 'car');
    if (car && (car.displaced || car.occupied)) out.car = { x: r2(car.sim.x), z: r2(car.sim.z), heading: r2(car.sim.heading) };
    return out;
  }

  /**
   * Put the bike / toy car of a save back (G1 validates the file; this checks the poses again: finite, on drivable
   * ground where the hull fits, else the nearest fit within 6 u, else skipped). City ground that is not resident yet
   * is waited for (≤ 60 s). A vehicle the player is riding is left alone. The restored bike becomes "your" vehicle
   * (hold F calls it).
   */
  restoreFleet(snap: FleetSnapshot) {
    this.restoreWait = null;
    if (!snap || typeof snap !== 'object') return;
    if (!this.tryRestore(snap)) this.restoreWait = { snap, t: 0 };
  }

  /** True when done (placed or skipped); false = some ground is still streaming in. */
  private tryRestore(snap: FleetSnapshot): boolean {
    let waiting = false;
    const put = (r: Ride | undefined, e: { x: number; z: number; heading: number } | undefined): boolean => {
      if (!r || !e || r.occupied || r.call) return false;
      const { x, z } = e, h = Number.isFinite(e.heading) ? e.heading : 0;
      if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 5000 || Math.abs(z) > 5000) return false;
      if (Math.hypot(r.sim.x - x, r.sim.z - z) < 0.05) return true;
      if (groundPending(x, z, 2)) { waiting = true; return false; }
      const fit = poseCheck(TERRAIN_WORLD, r.sim.spec, x, z, h).ok ? { x, z, heading: h } : findFit(TERRAIN_WORLD, r.sim.spec, x, z, h, 6);
      if (!fit) return false;
      r.sim.place(fit.x, fit.z, fit.heading, TERRAIN_WORLD);
      r.displaced = true; r.dirty = true;
      return true;
    };
    let bike = snap.bike && typeof snap.bike.id === 'string' ? this.fleet.rides.find(r => r.kind === 'bike' && r.id === snap.bike!.id) : undefined;
    // a city rack's bike (E2-12): the pool puts one there first (the pool loads with the city: wait for it)
    if (!bike && snap.bike && typeof snap.bike.id === 'string' && snap.bike.id.startsWith('city-bike-') && game.get().worldMode === 'city') {
      if (!this.cityBikes) waiting = true;
      else bike = this.cityBikes.claim(snap.bike.id, this.seenRide, runtime.player) ?? undefined;
    }
    const car = this.fleet.rides.find(r => r.kind === 'car');
    const placedCar = put(car, snap.car);
    const placedBike = put(bike, snap.bike);
    if (placedBike && bike) this.lastRide = bike; else if (placedCar && car && !this.lastRide) this.lastRide = car;
    if (placedBike || placedCar) this.publishRideables();
    return !waiting;
  }

  /**
   * People never get knocked over: a vehicle about to touch a resident stops with a soft bump. The same holds for the
   * moving things other lanes register as obstacle sources (actors/view.ts registerObstacleSource: F's crowd walkers
   * and toy traffic), each with its own radius. The step that reached them is undone (x0, y0, z0: the pose before the
   * drive step), so holding the throttle never creeps the vehicle into anyone. Only people (PERSON_KINDS) say "whoa";
   * traffic and static sources (any other kind, e.g. a mural board) just give the soft bump.
   */
  private giveWay(ride: Ride, t: number, x0: number, y0: number, z0: number) {
    const s = ride.sim;
    // (checked at any speed: a vehicle nudged from a standstill must not creep into someone either)
    if (Math.abs(s.v) < 0.02) return;
    const fx = Math.sin(s.heading) * Math.sign(s.v), fz = Math.cos(s.heading) * Math.sign(s.v);
    const reach = ride.length * 0.5 + 0.45;
    const inPath = (dx: number, dz: number, r: number) => {
      const ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      return ahead > 0 && ahead < reach + Math.max(0, r - 0.45) && side < ride.width * 0.5 + r;
    };
    let hit: string | null = null;
    for (const r of residents) if (inPath(r.x - s.x, r.z - s.z, 0.4)) { hit = 'npc'; break; }
    if (!hit) {
      const obs = this.wayObstacles;
      obs.length = 0;
      collectObstacles(obs, s.x + fx * reach * 0.5, s.z + fz * reach * 0.5, reach + 2);
      for (const o of obs) if (inPath(o.x - s.x, o.z - s.z, o.r)) { hit = o.kind; break; }
    }
    if (!hit) { if (t - this.wayHeldAt > 0.6) this.wayHeldSince = Infinity; return; }
    if (PERSON_KINDS.has(hit) || MOVING_KINDS.has(hit)) { if (this.wayHeldSince === Infinity) this.wayHeldSince = t; this.wayHeldAt = t; }
    const speed = Math.abs(s.v), strength = Math.min(1, speed / s.spec.vmax);
    s.v = 0; s.px = 0; s.pz = 0;
    s.x = x0; s.y = y0; s.z = z0;
    if (speed >= 0.5 && t - this.giveWayAt > 0.8) {
      this.giveWayAt = t;
      emit({ type: 'vehicle:bump', vehicle: ride.kind, strength, hard: false, kind: 'wall' });
      // a person (resident, crowd walker) says "whoa"; other traffic and static things (a mural board …) just bump
      if (PERSON_KINDS.has(hit)) emit({ type: 'bump', kind: 'npc', strength: 0.3 });
    }
  }
  private giveWayAt = -9;
  /** the last frame a person / traffic held the vehicle (giveWay) and since when it has been held (Infinity = not held) */
  private wayHeldAt = -9;
  private wayHeldSince = Infinity;
  private readonly wayObstacles: Obstacle[] = [];

  private onDriveReport(ride: Ride, r: StepReport, t: number) {
    const s = ride.sim;
    if (r.bump) {
      const kind = r.bump.reason === 'edge' ? 'edge' : r.bump.reason === 'stairs' ? 'stairs' : r.bump.reason === 'water' ? 'water' : 'wall';
      emit({ type: 'vehicle:bump', vehicle: ride.kind, strength: r.bump.strength, hard: r.bump.hard, kind });
      // the model edge keeps its line ("前面是模型边缘啦", flow listens for /edge/)
      if (kind === 'edge') emit({ type: 'bump', kind: 'slab-edge', strength: r.bump.strength });
      if (r.bump.strength > 0.25) { spawnFx('dust', s.x, s.y + 0.3, s.z, { scale: 0.6 + r.bump.strength }); runtime.camera.shake = Math.max(runtime.camera.shake, r.bump.hard ? 0.35 : 0.12); }
    }
    if (r.refuse && t - this.hintAt > 3) {
      this.hintAt = t;
      const surf = r.refuse.surface;
      const kind = surf === 'stairs' ? 'stairs' : surf === 'wood' ? 'wood' : surf === 'dirt' ? 'dirt' : 'other';
      emit({ type: 'vehicle:refuse', vehicle: ride.kind, surface: kind });
      const k = keyName('exit');
      if (kind === 'stairs') say(`楼梯要走上去 · ${k.zh}`, `Stairs are for walking · ${k.en}`);
      else if (ride.kind === 'car' && kind === 'wood') say('码头木板路只能步行', 'The pier boardwalk is for walking');
    }
    if (r.hop) emit({ type: 'vehicle:hop', vehicle: ride.kind, crest: r.hop.crest });
    if (r.land) { emit({ type: 'vehicle:land', vehicle: ride.kind, impact: r.land }); if (r.land > 0.3) spawnFx('dust', s.x, s.y + 0.1, s.z, { scale: 0.8 }); }
  }

  private flyGlide(dt: number, frozen: boolean) {
    const g = this.pelican.sim;
    let inp = frozen || this.machine.phase !== 'steady' ? NO_GLIDE_INPUT : {
      pitch: runtime.input.moveY,
      steer: runtime.input.moveX,
      boost: runtime.input.run || input.throttle > 0.5,
      slow: input.jumpHeld || input.brake > 0.5,
    };
    if (this.approach && this.machine.phase === 'steady') {
      // steer for the landing ground (the player can still override), gently down; land once within reach
      const a = this.approach;
      const err = wrap(Math.atan2(a.x - g.x, a.z - g.z) - g.heading);
      if (Math.abs(inp.steer) < 0.2) inp = { ...inp, steer: clamp(-err * 1.6, -1, 1), pitch: Math.min(inp.pitch, -0.3) };
      if (Math.hypot(a.x - g.x, a.z - g.z) < 34) this.tryLand(true);
    }
    const r = g.step(dt, inp, this.world());
    if (r.bump) emit({ type: 'bump', kind: 'glide', strength: 0.3 });
    // wave 5 (W5-F2): turned back from a soft box (charApi glideSoftBox): BAYBAY says its line, not every frame
    if (r.softBox) {
      this.boxT += dt;
      const line = glideSoftBoxLine(r.softBox);
      if (line && (this.boxSaidKey !== r.softBox || this.boxT - this.boxSaidAt > GLIDE_BOX_LINE_S)) {
        this.boxSaidKey = r.softBox; this.boxSaidAt = this.boxT;
        bubble(line, 2800);
      }
    }
  }
  /** the soft-box line's clock (s of turning back) and the last box whose line BAYBAY said */
  private boxT = 0;
  private boxSaidAt = -Infinity;
  private boxSaidKey: string | null = null;

  /** The glide world (built once; its tall structures are looked up live, E2-7). */
  // ---------------------------------------------------------------------------
  // Fast travel on the pelican (E2-8, G1 request 1)
  // ---------------------------------------------------------------------------

  /**
   * the travel ride: the pose last frame (pitch from the climb / descent), the phase for the hops; `aloft` = the trip
   * began mid-glide (the riders are already on the pelican at `ay` u: no pickup hop, it holds its height until G1's
   * rise passes it)
   */
  private travel = { on: false, aloft: false, ay: 0, phase: '' as TravelPose['phase'] | '', t: 0, x: 0, y: 0, z: 0 };

  private beginTravelRide(aloft = false) {
    const p = runtime.player;
    if (aloft) {
      // E2-review: the glide pelican flies on (before, it was reset to the player's feet: the rider stood in mid-air for
      // the pickup and BAYBAY dropped to the ground)
      const g = this.pelican.sim;
      g.stage = 'flight';
      this.travel = { on: true, aloft: true, ay: g.y, phase: '', t: 0, x: g.x, y: g.y, z: g.z };
      this.pelican.show();
      return;
    }
    this.boardFrom.set(p.x, p.y, p.z);
    this.boardHeading = p.heading;
    const g = this.pelican.sim;
    g.x = p.x; g.y = p.y + GLIDE.perch; g.z = p.z; g.heading = p.heading; g.pitch = 0; g.roll = 0; g.speed = 0; g.stage = 'flight';
    this.travel = { on: true, aloft: false, ay: 0, phase: '', t: 0, x: p.x, y: g.y, z: p.z };
    this.pelican.show();
    this.startGuideIn();
  }

  private endTravelRide() {
    if (!this.travel.on) return;
    this.travel.on = false;
    this.pelican.beating = false;
    this.pelican.flyOff();
    this.releaseGuide(true);
  }

  /**
   * Pose the pelican on G1's sky path (game/fastTravel travelPose: pickup 2.5 u up, rise to +48 u, pan, the cloud hold,
   * descent to the arrival spot): the seat rides `perch` over the path, the nose follows the climb and the descent, the
   * wings beat through the pickup, the rise and the flare at the end and soar in between.
   */
  private flyTravel(dt: number) {
    const pose = travelPose(), tr = this.travel, g = this.pelican.sim;
    if (!pose || !tr.on) return;
    const x = pose.x, z = pose.z;
    // (a trip begun mid-glide holds its height over the pickup until the rise climbs past it: never down between roofs)
    const early = pose.phase === 'pickup' || pose.phase === 'rise';
    const y = tr.aloft && early ? Math.max(tr.ay, pose.y + GLIDE.perch) : pose.y + GLIDE.perch;
    const d = Math.hypot(x - tr.x, z - tr.z), vy = dt > 0 ? (y - tr.y) / dt : 0, vh = dt > 0 ? d / dt : 0;
    const wantPitch = pose.phase === 'hold' ? 0 : clamp(Math.atan2(vy, Math.max(vh, 6)), -0.45, 0.5);
    g.pitch += (wantPitch - g.pitch) * Math.min(1, dt * 5);
    const wantHeading = d > 0.05 ? Math.atan2(x - tr.x, z - tr.z) : pose.heading;
    // (the glide pelican is on screen: it turns onto the trip's heading instead of snapping)
    g.heading = tr.aloft && early ? g.heading + wrap(wantHeading - g.heading) * Math.min(1, dt * 4) : wantHeading;
    g.roll = Math.sin(pose.t * Math.PI * 2) * (pose.phase === 'pan' || pose.phase === 'hold' ? 0.06 : 0);
    g.x = x; g.y = y; g.z = z; g.speed = vh;
    tr.x = x; tr.y = y; tr.z = z; tr.phase = pose.phase; tr.t = pose.t;
    this.pelican.beating = pose.phase === 'pickup' || pose.phase === 'rise' || (pose.phase === 'descent' && pose.t > 0.7);
  }

  private world(): GlideWorld {
    this.glideWorld ??= terrainGlideWorld(() => liveTall.get());
    return this.glideWorld;
  }

  private onOutcome(o: MoveOutcome, c: PlayerController) {
    const p = runtime.player;
    switch (o.type) {
      case 'boarded':
        if (this.ride) emit({ type: 'vehicle:enter', vehicle: this.ride.kind, id: this.ride.id, baybay: this.guidePop ? 'pop' : 'hop' });
        break;
      case 'alighted': {
        const r = this.ride;
        if (r) { r.occupied = false; r.sim.v = 0; r.dirty = true; emit({ type: 'vehicle:exit', vehicle: r.kind, id: r.id }); }
        this.ride = null;
        p.x = o.slot.x; p.z = o.slot.z; p.heading = r ? r.sim.heading : p.heading;
        c.sync();
        this.releaseGuide(true);
        this.publishRideables();
        break;
      }
      case 'blocked':
        if (o.reason === 'no-slot') {
          say('这里下不了车', 'Can’t get out here');
          if (this.ride) emit({ type: 'vehicle:blocked', vehicle: this.ride.kind, reason: 'no-slot' });
        }
        break;
      case 'took-off': break;
      case 'landed': {
        this.approach = null;
        const spot = this.landSpot ?? { x: p.x, z: p.z };
        p.x = spot.x; p.z = spot.z;
        c.sync();
        // W5-F7: face the open ground (the first push of the stick walks somewhere, never into a wall or the Bay)
        faceOpen(spot.x, spot.z);
        this.landing = 0.7;
        spawnFx('dust', spot.x, heightAt(spot.x, spot.z) + 0.1, spot.z, { scale: 1.2 });
        emit({ type: 'glide:land', x: spot.x, z: spot.z });
        emit({ type: 'land', impact: 0.6 });
        this.pelican.flyOff();
        this.releaseGuide(true);
        // W5-0b: on the ground again, the lock is derived from what is open now (never one left over from the air)
        refreshLock();
        break;
      }
      case 'sat': break;
      case 'stood': {
        const at = this.standSpot ?? { x: p.x, z: p.z };
        p.x = at.x; p.z = at.z;
        c.sync();
        if (this.seat) emit({ type: 'stand', seat: this.seat.id });
        this.seat = null;
        break;
      }
      case 'transit-spot': break;
      case 'transit-alight': {
        // E2-10: the car is slow (or the brake time ran out): end the ride (lane F counts it and steps the player off
        // beside the car), put the feet on our clear exit slot, let the car go, and hop down over TIMING.transitAlight
        const line = this.machine.line ?? 'streetcar';
        const ferry = currentRide()?.kind === 'ferry';
        this.alightFrom.set(this.rider.x, this.rider.y, this.rider.z);
        this.alightQuat.copy(this.rider.quat);
        hopOffRide();
        releasePlatformStop(line);
        platformRider.platform = null;
        // E2-review: lane F has placed the player where its ride ends (game/transit leaveLineRide). Off a ferry that is
        // always F's spot (only onto a quay: hopping off at sea goes to the next terminal — our slot beside the boat
        // was open water), and F's spot also wins wherever our slot is no ground to stand on. Far from the car the step
        // down is a cut, not a hop across the water.
        if ((ferry || !canStand(o.slot.x, o.slot.z, 0.45)) && canStand(p.x, p.z, 0.45)) { o.slot.x = p.x; o.slot.z = p.z; }
        else if (!canStand(o.slot.x, o.slot.z, 0.45) && !groundPending(o.slot.x, o.slot.z)) {
          // (neither is ground — F found no quay spot resident yet: never leave the rider in the water)
          const w = nearestWalkable(o.slot, 40);
          if (w) { o.slot.x = w.x; o.slot.z = w.z; }
        }
        if (Math.hypot(o.slot.x - this.alightFrom.x, o.slot.z - this.alightFrom.z) > ALIGHT_HOP_MAX) this.alightFrom.set(o.slot.x, heightAt(o.slot.x, o.slot.z), o.slot.z);
        p.x = o.slot.x; p.z = o.slot.z; p.y = heightAt(o.slot.x, o.slot.z);
        p.pathTarget = null; p.pendingInteract = null;
        this.releaseGuide(true);
        runtime.camera.shake = Math.max(runtime.camera.shake, 0.08);
        break;
      }
      case 'transit-alighted':
        p.x = o.slot.x; p.z = o.slot.z;
        c.sync();
        this.lean = 0;
        // W5-F7: off the car, facing the open pavement (not the car's side or a wall)
        faceOpen(o.slot.x, o.slot.z);
        break;
    }
  }

  /**
   * The exit slot for a transit hop-off: beside the car on the rider's side (running board / aisle side), level with
   * the rider, else the other clear slots (modes.transitExitSlots), else the nearest walkable spot around the car.
   */
  private transitExit(plat: Platform | undefined): DoorSlot | null {
    const p = runtime.player;
    if (!plat) return { x: p.x, z: p.z, side: 'left' };
    const side: 1 | -1 = this.deck.x < 0 ? -1 : 1;
    let half = Math.max(Math.abs(plat.deck.minX), Math.abs(plat.deck.maxX));
    for (const d of plat.decks ?? []) half = Math.max(half, Math.abs(d.minX), Math.abs(d.maxX));
    const length = Math.max(plat.deck.maxZ - plat.deck.minZ, ...(plat.decks ?? []).map(d => d.maxZ - d.minZ)) + 0.6;
    const slot = pickTransitExit(SLOTS, plat, side, this.deck.z, half, length);
    if (slot) return slot;
    const w = nearestWalkable({ x: plat.x, z: plat.z }, 12);
    return w ? { x: w.x, z: w.z, side: 'left' } : { x: p.x, z: p.z, side: 'left' };
  }
  /** E2-10: the rider's pose on the car when the hop down began */
  private readonly alightFrom = new THREE.Vector3();
  private readonly alightQuat = new THREE.Quaternion();
  /** current outward hang lean on a running board (rad, eased) */
  private lean = 0;

  // ---------------------------------------------------------------------------
  // BAYBAY in the seat
  // ---------------------------------------------------------------------------

  private startGuideIn() {
    const g = runtime.guide, p = runtime.player;
    const d = Math.hypot(g.x - p.x, g.z - p.z);
    this.guidePop = d > 25;
    this.guideSeat = 'in';
    this.guideT = 0;
    this.guideDur = this.guidePop ? 0.3 : clamp(d / 10, 0.45, 1.2);
    this.guideFrom.set(g.x, g.y, g.z);
    this.guideCarried = true;
  }

  /** Hop out beside the player (or just let go). */
  private releaseGuide(hop: boolean) {
    if (this.guideSeat === 'none') { this.guideCarried = false; return; }
    const p = runtime.player;
    const side = { x: p.x + Math.cos(p.heading) * 1.3, z: p.z - Math.sin(p.heading) * 1.3 };
    const to = canStand(side.x, side.z, 0.42) ? side : nearestWalkable(side, 4) ?? { x: p.x + 1, z: p.z };
    if (!hop) { this.guideSeat = 'none'; this.guideCarried = false; runtime.guide.x = to.x; runtime.guide.z = to.z; runtime.guide.y = heightAt(to.x, to.z); return; }
    const g = runtime.guide;
    this.guideFrom.set(g.x, g.y, g.z);
    this.guideTo.set(to.x, heightAt(to.x, to.z), to.z);
    this.guideSeat = 'out';
    this.guideT = 0;
    this.guideDur = 0.4;
  }

  /** BAYBAY's seat in world space for the current mode (null = she is not carried in this mode). */
  private guideSeatWorld(out: THREE.Vector3): { scale: number; sitting: boolean; pole: boolean } | null {
    const m = this.machine;
    if ((m.mode === 'bike' || m.mode === 'car') && this.ride) {
      const r = this.ride;
      out.copy(r.kind === 'bike' ? r.rig.seats.basket : r.rig.seats.front).applyMatrix4(r.rig.mesh.matrixWorld);
      return { scale: GUIDE_SEAT_SCALE[r.kind], sitting: true, pole: false };
    }
    if (m.mode === 'glide' || (m.mode === 'travel' && this.travel.on)) { this.pelican.seat('baybay', out); return { scale: GUIDE_SEAT_SCALE.glide, sitting: true, pole: false }; }
    if (m.mode === 'transit') {
      const plat = platforms.get(m.line ?? 'streetcar');
      if (!plat || !plat.live || !platformRider.platform) return null;
      if (plat.kind === 'cable-car') {
        // on the outward bench on the rider's (= the camera's) side, next to the rider (the far bench would hide her
        // behind the backrest)
        const seat = spotFor(plat, 'seat', this.benchSide());
        const w = toWorld(plat, seat.x, plat.floor + plat.seatY + 0.2, seat.z + CABLE_GUIDE_DZ);
        out.set(w.x, w.y, w.z);
        return { scale: 1, sitting: true, pole: false };
      }
      if (plat.kind === 'bus') {
        // W4-G4 · the sightseeing bus's open top deck (lane T's TOUR_BUS_PLATFORM): BAYBAY sits beside the rider on the
        // same front bench, its aisle half (lane T's TOUR_BUS_SPOTS.baybaySeat: 0.46 u in from the rider's seat); when
        // the rider stands at the front rail she keeps the bench on the camera's side
        const seat = spotFor(plat, 'seat', this.cameraSide);
        const w = toWorld(plat, seat.x - Math.sign(seat.x || 1) * BUS_GUIDE_DX, plat.floor + plat.seatY + 0.2, seat.z);
        out.set(w.x, w.y, w.z);
        return { scale: 1, sitting: true, pole: false };
      }
      const seated = m.spot === 'seat';
      const lx = seated ? (this.cameraSide > 0 ? plat.seatRight.x : plat.seatLeft.x) : clamp(this.deck.x - 0.1, plat.deck.minX + 0.3, plat.deck.maxX - 0.3);
      let lz = clamp(this.deck.z + 0.95, plat.deck.minZ + 0.3, plat.deck.maxZ - 0.3);
      // (E2 w3 review open) the ferry's sun deck: the rider at the bow rail is at the deck's front edge, so "0.95 u
      // ahead" clamped onto the rider (0.05 u apart: in the side-on ride shot BAYBAY covered the player). There she
      // stands 1.1 u aft of the rider instead: beside them in the frame. (W4-G4, part b) The same on the Metro LRV: the
      // rider's standing spot behind the cab is 0.15 u from the aisle's front end, where she stood on the rider too
      if (!seated && Math.abs(lz - this.deck.z) < 0.8) lz = clamp(this.deck.z - 1.1, plat.deck.minZ + 0.3, plat.deck.maxZ - 0.3);
      const w = toWorld(plat, lx, plat.floor + (seated ? plat.seatY + 0.2 : 0), lz);
      out.set(w.x, w.y, w.z);
      return { scale: 1, sitting: seated, pole: !seated };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Placement
  // ---------------------------------------------------------------------------

  private placeOnSpot() {
    const m = this.machine;
    const plat = platforms.get(m.line ?? 'streetcar');
    if (!plat || !m.spot || m.spot === 'deck') return;
    this.deck.place(spotFor(plat, m.spot, this.cameraSide));
  }

  private place(dt: number, env: MoveEnv) {
    const m = this.machine, p = runtime.player;
    const R = this.rider, A = this.riderAnim;
    R.active = false; R.scale = 1;
    A.ride = null; A.pedal = null; A.standing = false; A.sitting = false; A.pole = false; A.speed = 0;
    const k = m.progress, e = ease(k);

    if ((m.mode === 'bike' || m.mode === 'car') && this.ride) {
      const r = this.ride, s = r.sim, mesh = r.rig.mesh;
      const seat = tmpV.copy(r.kind === 'bike' ? r.rig.seats.rider : r.rig.seats.driver).applyMatrix4(mesh.matrixWorld);
      R.active = true;
      R.quat.copy(mesh.quaternion);
      A.ride = r.kind;
      if (r.kind === 'bike') {
        const crank = r.rig.seats.crank, sr = r.rig.seats.rider;
        A.pedal = { angle: r.crank, y: (crank.y - sr.y) / CHAR_SCALE, z: (crank.z - sr.z) / CHAR_SCALE, r: (0.13 * BIKE_VISUAL) / CHAR_SCALE };
        A.standing = r.standing;
      }
      A.speed = Math.abs(s.v);
      if (m.phase === 'boarding' || m.phase === 'alighting') {
        // hop into / out of the seat along a small arc
        const from = m.phase === 'boarding' ? this.boardFrom : tmpV2.set(m.exitSlot?.x ?? s.x, heightAt(m.exitSlot?.x ?? s.x, m.exitSlot?.z ?? s.z), m.exitSlot?.z ?? s.z);
        const kk = m.phase === 'boarding' ? e : 1 - e;
        R.x = lerp(from.x, seat.x, kk); R.z = lerp(from.z, seat.z, kk);
        R.y = lerp(from.y, seat.y, kk) + Math.sin(Math.PI * k) * 0.55;
        const h = lerp(this.boardHeading, this.boardHeading + wrap(s.heading - this.boardHeading), kk);
        R.quat.slerpQuaternions(tmpQ.setFromAxisAngle(UPY, h), mesh.quaternion, kk);
        if (kk < 0.5) A.ride = null;
      } else { R.x = seat.x; R.y = seat.y; R.z = seat.z; }
      // the logical player rides the vehicle
      p.x = s.x; p.z = s.z; p.heading = s.heading;
    } else if (m.mode === 'glide') {
      const g = this.pelican.sim;
      const seat = this.pelican.seat('rider', tmpV);
      R.active = true;
      R.quat.copy(this.pelican.quaternion);
      A.ride = 'glide';
      A.speed = g.speed;
      if (m.phase === 'takeoff' && k < 0.3) {
        const kk = ease(k / 0.3);
        R.x = lerp(this.boardFrom.x, seat.x, kk); R.z = lerp(this.boardFrom.z, seat.z, kk);
        R.y = lerp(this.boardFrom.y, seat.y, kk) + Math.sin(Math.PI * kk) * 0.6;
      } else if (m.phase === 'landing' && k > 0.72 && this.landSpot) {
        // hop down to the landing spot
        const kk = ease((k - 0.72) / 0.28), gy = heightAt(this.landSpot.x, this.landSpot.z);
        R.x = lerp(seat.x, this.landSpot.x, kk); R.z = lerp(seat.z, this.landSpot.z, kk);
        R.y = lerp(seat.y, gy, kk) + Math.sin(Math.PI * kk) * 0.7;
        if (kk > 0.5) { A.ride = null; R.quat.setFromAxisAngle(UPY, g.heading); }
      } else { R.x = seat.x; R.y = seat.y; R.z = seat.z; }
      p.x = g.x; p.z = g.z; p.heading = g.heading;
    } else if (m.mode === 'travel' && this.travel.on) {
      this.placeTravel();
    } else if (m.mode === 'sit' && this.seat) {
      const st = this.seat, gy = heightAt(st.x, st.z);
      const sy = gy + st.y + 0.22;
      R.active = true;
      const kk = m.phase === 'rising' ? 1 - e : m.phase === 'settling' ? e : 1;
      const from = m.phase === 'rising' ? (this.standSpot ?? st) : this.boardFrom;
      const fy = heightAt(from.x, from.z);
      R.x = lerp(from.x, st.x, kk); R.z = lerp(from.z, st.z, kk); R.y = lerp(fy, sy, kk) + (m.phase === 'steady' ? 0 : Math.sin(Math.PI * kk) * 0.25);
      R.quat.setFromAxisAngle(UPY, m.phase === 'rising' ? st.heading : lerp(this.boardHeading, this.boardHeading + wrap(st.heading - this.boardHeading), kk));
      A.sitting = kk > 0.4;
      p.heading = st.heading;
    } else if (m.mode === 'transit' && m.phase === 'alighting') {
      this.placeAlight();
    } else if (m.mode === 'transit') {
      this.placeTransit(dt, env);
    }

    // --- BAYBAY
    const G = this.guide;
    G.active = false; G.scale = 1;
    this.guideAnim.sitting = false; this.guideAnim.pole = false; this.guideAnim.hop = 0;
    if (this.guideSeat !== 'none') {
      this.guideT += dt;
      const target = this.guideSeatWorld(tmpV2) ? tmpV2 : null;
      if (this.guideSeat === 'out') {
        const kk = clamp(this.guideT / this.guideDur, 0, 1), ee = ease(kk);
        G.active = true;
        G.x = lerp(this.guideFrom.x, this.guideTo.x, ee); G.z = lerp(this.guideFrom.z, this.guideTo.z, ee);
        G.y = lerp(this.guideFrom.y, this.guideTo.y, ee) + Math.sin(Math.PI * kk) * 0.8;
        G.quat.setFromAxisAngle(UPY, p.heading);
        G.scale = lerp(this.guideFromScale, 1, ee);
        this.guideAnim.hop = 1;
        if (kk >= 1) {
          this.guideSeat = 'none';
          this.guideCarried = false;
          runtime.guide.x = this.guideTo.x; runtime.guide.z = this.guideTo.z; runtime.guide.y = this.guideTo.y;
          G.active = false;
        }
      } else if (target) {
        const info = this.guideSeatInfo();
        G.active = true;
        if (this.guideSeat === 'in') {
          const kk = clamp(this.guideT / this.guideDur, 0, 1), ee = ease(kk);
          if (this.guidePop) { G.x = target.x; G.y = target.y; G.z = target.z; G.scale = info.scale * Math.max(0.05, ee); }
          else {
            G.x = lerp(this.guideFrom.x, target.x, ee); G.z = lerp(this.guideFrom.z, target.z, ee);
            G.y = lerp(this.guideFrom.y, target.y, ee) + Math.sin(Math.PI * kk) * (0.6 + this.guideDur * 0.8);
            G.scale = lerp(1, info.scale, ee);
            this.guideAnim.hop = 1;
          }
          if (kk >= 1) this.guideSeat = 'seated';
        } else { G.x = target.x; G.y = target.y; G.z = target.z; G.scale = info.scale; }
        this.guideFromScale = G.scale;
        G.quat.copy(this.guideQuat());
        this.guideAnim.sitting = info.sitting && this.guideSeat === 'seated';
        this.guideAnim.pole = info.pole;
        runtime.guide.x = G.x; runtime.guide.z = G.z; runtime.guide.y = G.y; runtime.guide.heading = p.heading;
      } else if (this.guideSeat === 'in' && this.guideT > 2) { this.guideSeat = 'none'; this.guideCarried = false; }
    }
  }

  private guideFromScale = 1;
  private guideSeatInfo(): { scale: number; sitting: boolean; pole: boolean } {
    const m = this.machine;
    if ((m.mode === 'bike' || m.mode === 'car') && this.ride) return { scale: GUIDE_SEAT_SCALE[this.ride.kind], sitting: true, pole: false };
    if (m.mode === 'glide' || m.mode === 'travel') return { scale: GUIDE_SEAT_SCALE.glide, sitting: true, pole: false };
    if (m.mode === 'transit' && platforms.get(m.line ?? 'streetcar')?.kind === 'cable-car') return { scale: 1, sitting: true, pole: false };
    return { scale: 1, sitting: m.spot === 'seat', pole: m.spot !== 'seat' };
  }

  /** BAYBAY's orientation: the carrier's (seatQuat), or facing out from her cable-car bench. */
  private guideQuat(): THREE.Quaternion {
    const m = this.machine;
    if (m.mode === 'transit') {
      const plat = platforms.get(m.line ?? 'streetcar');
      if (plat?.kind === 'cable-car') return this.platQuat(plat, spotFor(plat, 'seat', this.benchSide()).heading);
    }
    return this.seatQuat();
  }

  /** The side of the car BAYBAY's cable-car bench is on: the rider's (board or bench), else the camera's. */
  private benchSide(): 1 | -1 {
    return Math.abs(this.deck.x) > 0.5 ? (this.deck.x > 0 ? 1 : -1) : this.cameraSide;
  }

  /**
   * Orientation on a platform: the car body as lane F draws it (three.js Euler(−pitch, heading, roll, 'YXZ')), leaning
   * `leanLeft` about the car's forward axis (+ = toward the car's left: a rider hanging off the left running board),
   * then `localYaw` in the car frame. Flat and upright (the F-line) it is the old Euler(0, heading + yaw, roll).
   */
  private platQuat(plat: Platform, localYaw: number, leanLeft = 0): THREE.Quaternion {
    const pitch = plat.pitch ?? 0;
    if (!pitch && !leanLeft) return tmpQ.setFromEuler(tmpE.set(0, plat.heading + localYaw, plat.roll, 'YXZ'));
    tmpQ.setFromEuler(tmpE.set(-pitch, plat.heading, plat.roll - leanLeft, 'YXZ'));
    return tmpQ.multiply(tmpQ2.setFromAxisAngle(UPY, localYaw));
  }

  /** Orientation of whatever carries the riders (vehicle / pelican / platform). */
  private seatQuat(): THREE.Quaternion {
    const m = this.machine;
    if ((m.mode === 'bike' || m.mode === 'car') && this.ride) return this.ride.rig.mesh.quaternion;
    if (m.mode === 'glide' || m.mode === 'travel') return this.pelican.quaternion;
    if (m.mode === 'transit') {
      const plat = platforms.get(m.line ?? 'streetcar');
      if (plat) return tmpQ.setFromEuler(tmpE.set(0, plat.heading + this.deck.heading, plat.roll, 'YXZ'));
    }
    return tmpQ.setFromAxisAngle(UPY, runtime.player.heading);
  }

  /**
   * Fast travel: the rider on the pelican's back — hopping on during the pickup (0.3–0.9 of it) from where they stood,
   * hopping off in the last quarter of the descent to the arrival spot (the flow put the logical player there when the
   * descent began).
   */
  private placeTravel() {
    const tr = this.travel, p = runtime.player, R = this.rider, A = this.riderAnim;
    const seat = this.pelican.seat('rider', tmpV);
    R.active = true;
    R.quat.copy(this.pelican.quaternion);
    A.ride = 'glide';
    if (!tr.aloft && (tr.phase === 'pickup' || tr.phase === '')) {
      const kk = ease(clamp((tr.t - 0.3) / 0.6, 0, 1));
      R.x = lerp(this.boardFrom.x, seat.x, kk); R.z = lerp(this.boardFrom.z, seat.z, kk);
      R.y = lerp(this.boardFrom.y, seat.y, kk) + Math.sin(Math.PI * kk) * 0.6;
      if (kk < 0.5) { A.ride = null; R.quat.setFromAxisAngle(UPY, this.boardHeading); }
    } else if (tr.phase === 'descent' && tr.t > 0.75) {
      const kk = ease((tr.t - 0.75) / 0.25), gy = heightAt(p.x, p.z);
      R.x = lerp(seat.x, p.x, kk); R.z = lerp(seat.z, p.z, kk);
      R.y = lerp(seat.y, gy, kk) + Math.sin(Math.PI * kk) * 0.7;
      if (kk > 0.5) { A.ride = null; R.quat.setFromAxisAngle(UPY, p.heading); }
    } else { R.x = seat.x; R.y = seat.y; R.z = seat.z; }
  }

  /** E2-10: stepping down from a transit car to the exit slot (TIMING.transitAlight), turning away from the car. */
  private placeAlight() {
    const m = this.machine, p = runtime.player, R = this.rider, A = this.riderAnim;
    const slot = m.exitSlot;
    if (!slot) return;
    const k = m.progress, e = ease(k), gy = heightAt(slot.x, slot.z);
    R.active = true;
    R.x = lerp(this.alightFrom.x, slot.x, e); R.z = lerp(this.alightFrom.z, slot.z, e);
    R.y = lerp(this.alightFrom.y, gy, e) + Math.sin(Math.PI * k) * 0.45;
    const away = Math.atan2(slot.x - this.alightFrom.x, slot.z - this.alightFrom.z);
    R.quat.slerpQuaternions(this.alightQuat, tmpQ.setFromAxisAngle(UPY, away), e);
    A.pole = k < 0.25;
    p.heading = away;
  }

  /** The newcomer inside the streetcar: rail spot, bench seat or walking the aisle. */
  private placeTransit(dt: number, env: MoveEnv) {
    const m = this.machine, p = runtime.player, R = this.rider, A = this.riderAnim;
    const r = currentRide();
    const plat = platforms.get(m.line ?? 'streetcar');
    if (!r || r.mode === 'wait' || !plat || !plat.live) { platformRider.platform = null; return; }
    // the camera side of the car (the rider sits on the far bench, facing the camera)
    const cam = runtime.camera;
    const camLocal = toLocal(plat, p.x + Math.sin(cam.yaw) * 10, p.z + Math.cos(cam.yaw) * 10);
    // keep the bench choice stable while seated; otherwise follow the camera (it settles on the car's water side)
    if (m.spot !== 'seat') this.cameraSide = platformRider.platform ? rideCamInfo.side : camLocal.x >= 0 ? 1 : -1;
    // at the rail: hold the pole and turn three-quarters toward the open window on the camera's side
    if (m.spot === 'rail') this.deck.heading += wrap((Math.PI / 2) * this.cameraSide * 0.75 - this.deck.heading) * (1 - Math.exp(-4 * dt));
    if (!platformRider.platform) { this.placeOnSpot(); platformRider.platform = plat.id; this.startGuideIn(); }
    // a cable car's running board follows the camera's side (lane F railMirror: the body never hides the rider)
    else if (plat.railMirror && m.spot === 'rail' && m.phase === 'steady' && (this.deck.x >= 0 ? 1 : -1) !== this.cameraSide) this.placeOnSpot();
    platformRider.platform = plat.id;
    if (m.spot === 'deck') {
      // camera yaw in the platform frame; the rider stays in the rect they walk in (the aisle, a running board: F's decks)
      const rect = deckRectAt(plat, this.deck.x, this.deck.z);
      this.deck.step(dt, runtime.input.moveX, runtime.input.moveY, env.cameraYaw - plat.heading, rect);
      if (rect.maxX - rect.minX < 2 * DeckWalker.RADIUS) this.deck.x = (rect.minX + rect.maxX) / 2;
      A.speed = this.deck.speed;
      A.stride = this.deck.stride;
    }
    // hanging off a cable car's running board (lane F: railMirror, hangLean): lean out, eased; upright while walking
    const board = plat.railMirror && plat.hangLean && m.spot !== 'seat' && this.deck.speed < 0.3 && deckRectAt(plat, this.deck.x, this.deck.z) !== plat.deck;
    const leanTo = board ? (plat.hangLean ?? 0) * (this.deck.x >= 0 ? 1 : -1) : 0;
    this.lean += (leanTo - this.lean) * (1 - Math.exp(-5 * dt));
    platformRider.x = this.deck.x; platformRider.z = this.deck.z; platformRider.heading = this.deck.heading; platformRider.spot = m.spot ?? 'rail';
    const seated = m.spot === 'seat';
    const w = toWorld(plat, this.deck.x, plat.floor + (seated ? plat.seatY + 0.22 : 0), this.deck.z);
    R.active = true;
    R.x = w.x; R.y = w.y; R.z = w.z;
    R.quat.copy(this.platQuat(plat, this.deck.heading, this.lean));
    A.sitting = seated;
    A.pole = m.spot === 'rail';
    // logical player = the rider's feet in the car (uPlayer dither, zones, the camera focus)
    const feet = toWorld(plat, this.deck.x, plat.floor, this.deck.z);
    p.x = feet.x; p.z = feet.z; p.heading = plat.heading + this.deck.heading;
  }

  // ---------------------------------------------------------------------------
  // Publish
  // ---------------------------------------------------------------------------

  /** After the controller step: per-frame runtime state (vehicle / glide / move) and the store's `move` on change. */
  private publish() {
    const m = this.machine;
    runtime.move.mode = m.mode;
    runtime.move.phase = m.phase;
    runtime.move.progress = m.progress;
    runtime.move.spot = m.spot;
    const v = runtime.vehicle, r = this.ride ?? this.lastRide;
    if (r) {
      const s = r.sim;
      v.id = r.id; v.kind = r.kind; v.occupied = !!this.ride;
      v.x = s.x; v.y = s.y; v.z = s.z; v.heading = s.heading; v.speed = s.v; v.steer = s.steer;
      v.pitch = r.pitch; v.roll = r.kind === 'bike' ? r.lean : r.roll; v.grade = s.grade; v.airborne = s.airborne;
    } else v.occupied = false;
    const g = runtime.glide, gs = this.pelican.sim;
    g.active = m.mode === 'glide';
    g.x = gs.x; g.y = gs.y; g.z = gs.z; g.heading = gs.heading; g.pitch = gs.pitch; g.roll = gs.roll; g.speed = gs.speed;
    g.height = gs.y - heightAt(gs.x, gs.z);
    // store: only on transitions (≤ a few per minute)
    const want: MoveState = m.mode === 'transit' ? { mode: 'transit', line: m.line ?? 'streetcar', spot: m.spot ?? 'rail' } : { mode: m.mode };
    const cur = game.get().move;
    if (cur.mode !== want.mode || cur.line !== want.line || cur.spot !== want.spot) {
      // game flow starts and ends transit rides (the store is the authority there: only the spot is ours), and photo on
      // foot is the store's own mirror of photoMode
      const flowOwned = (want.mode === 'transit') !== (cur.mode === 'transit') || (want.mode === 'travel') !== (cur.mode === 'travel');
      if (!flowOwned && !(cur.mode === 'photo' && want.mode === 'foot')) game.set({ move: want });
    }
  }

  /** Called by actors/system.ts after the controller stepped: speed flags for the carried body. */
  finishPlayer() {
    if (!this.carried) return;
    const p = runtime.player, m = this.machine;
    const speed = (m.mode === 'bike' || m.mode === 'car') && this.ride ? Math.abs(this.ride.sim.v) : m.mode === 'glide' ? this.pelican.sim.speed : m.mode === 'transit' ? this.deck.speed : 0;
    p.speed = speed;
    p.moving = speed > 0.3;
    p.running = false;
    p.grounded = m.mode !== 'glide';
    if (this.rider.active) p.y = m.mode === 'glide' ? this.pelican.sim.y : m.mode === 'transit' ? this.rider.y : (this.ride?.sim.y ?? p.y);
  }

  /** Parked vehicles for the interactables (positions change only when something moves them). */
  publishRideables() {
    rideables.length = 0;
    for (const r of this.fleet.rides) rideables.push({ id: r.id, kind: r.kind, x: r.sim.x, z: r.sim.z, free: !r.occupied && !r.call });
  }

  /**
   * Keep the rideables list fresh while vehicles move (cheap; ~10 entries). Keyed by id (E2-12): a pooled city bike that
   * moved to another rack changed its id, and the list is published again.
   */
  syncRideables() {
    const rides = this.fleet.rides;
    if (rideables.length !== rides.length) { this.publishRideables(); return; }
    for (let i = 0; i < rides.length; i++) {
      const r = rides[i], o = rideables[i];
      if (o.id !== r.id) { this.publishRideables(); return; }
      o.x = r.sim.x; o.z = r.sim.z; o.free = !r.occupied && !r.call;
    }
  }

  dispose() {
    this.disposed = true;
    this.cityBikes?.dispose();
    this.fleet.dispose();
    this.pelican.dispose();
    platformRider.platform = null;
    input.vehicleContext = 'none';
    rideables.length = 0;
  }
}

/**
 * What the hop-off asks of the ridden line's status: `station` (a ferry only lets you off at a quay) and, for lane T's
 * light rail (world/lightRail.ts), `canHopOff` false while any part of the train is in a tunnel or under a portal hood
 * (`portalWait`: stopped in a mouth for the surface to stream in). The cable cars, the F-line and the ferry never set
 * `canHopOff` (undefined = allowed). Exported for the tests.
 */
export function hopOffStatus(line: string): { station: string | null; canHopOff?: boolean; portalWait?: boolean } | null {
  return (rideSystemFor(line)?.rideStatus() as { station: string | null; canHopOff?: boolean; portalWait?: boolean } | null | undefined) ?? null;
}

/** The glide's tall structures, live (actors/glideTall, E2-7); other lanes add theirs here. */
const liveTall = new LiveTall();
export function setTallStructures(list: TallStructure[]) { liveTall.setExtra(list); }
/** QA / tests: the glide's current tall list. */
export function tallStructuresNow(): readonly TallStructure[] { return liveTall.get().list; }
