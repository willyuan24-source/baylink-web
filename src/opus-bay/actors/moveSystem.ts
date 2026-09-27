import * as THREE from 'three';
import { emit } from '../core/events';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { game, type MoveState } from '../core/store';
import { canStand, heightAt, nearestWalkable } from '../core/terrain';
import { DISTRICT } from '../data/district';
import { sfLandmarkInfo } from '../data/sf/landmarks';
import { seatSpots, type SeatSpot } from '../data/vehicles';
import { cancelRide, hopOffRide, say } from '../game/flow';
import { flow } from '../game/flowStore';
import { currentRide } from '../game/ride';
import { readQa } from '../game/qa';
import { spawnFx } from '../world/fx';
import { SF_LANDMARKS, landmarkToWorld } from '../world/sf/landmarks';
import { GGB } from '../world/sf/landmarks/golden-gate-bridge';
import type { RidePose } from './anim';
import type { PlayerController } from './controller';
import { rideCamInfo } from './cameraModes';
import { CHAR_SCALE } from './dims';
import { NO_GLIDE_INPUT, terrainGlideWorld, type GlideWorld, type TallStructure } from './glide';
import { CALL_MIN_DIST, ENTER_RADIUS, MoveMachine, nearestEnterSlot, pickExitSlot, type MoveOutcome, type SlotWorld } from './modes';
import { DeckWalker, agePlatforms, platforms, rider as platformRider, spotFor, toLocal, toWorld } from './platform';
import { NO_DRIVE, type DriveInput, type StepReport } from './vehicles/collide';
import { Fleet, type Ride } from './vehicles/fleet';
import { Pelican } from './vehicles/pelican';
import { BIKE_VISUAL } from './vehicles/models';
import { residents, rideables } from './view';

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
const UPY = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
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

/** BAYBAY's scale in each seat (the basket is small; she tucks in). */
const GUIDE_SEAT_SCALE = { bike: 0.72, car: 0.85, glide: 0.85 } as const;
/** Known tall structures for the glide repulsor while blockers carry no roof heights (district fallback). */
let tallCache: TallStructure[] | null = null;

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

  constructor() {
    this.root.name = 'opus-move';
    this.root.add(this.fleet.group, this.pelican.group);
    this.glideUnlocked = game.get().viewpointUnlocked || readQa().debug;
    this.publishRideables();
  }

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

    // glide unlock (the Coit viewpoint sets viewpointUnlocked; ?debug=1 unlocks from the start)
    if (!this.glideUnlocked && s.viewpointUnlocked) {
      this.glideUnlocked = true;
      this.pelican.load(env.precompile);
      emit({ type: 'glide:unlock' });
      const k = keyName('glide');
      say(`解锁：鹈鹕滑翔！${k.zh}`, `Unlocked: pelican glide! ${k.en[0].toUpperCase()}${k.en.slice(1)}`, 'gold', 4200);
    }

    // --- sync with the store: flow boards / ends streetcar rides and restarts the game
    if (s.move.mode === 'transit' && m.mode !== 'transit') this.beginTransit(s.move.line ?? 'streetcar');
    else if (s.move.mode !== 'transit' && m.mode === 'transit') { m.endTransit(); platformRider.platform = null; this.releaseGuide(true); }
    if (!env.playing && m.mode !== 'foot' && m.mode !== 'transit') this.toFoot();
    // fast travel (game flow): the store says 'travel' → everything parked, the flow carries the player; back to foot after
    if (s.move.mode === 'travel' && m.mode !== 'travel') { this.toFoot(); m.beginTravel(); }
    else if (s.move.mode !== 'travel' && m.mode === 'travel') m.endTravel();

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
      if (resetPress && this.ride && m.phase === 'steady') { if (this.fleet.reset(this.ride)) spawnFx('dust', this.ride.sim.x, this.ride.sim.y + 0.3, this.ride.sim.z); }
    } else if (mode === 'glide') {
      if (glidePress && m.phase === 'steady' && !frozen) { if (this.approach) this.approach = null; else this.tryLand(); }
    } else if (mode === 'transit') {
      const r = currentRide();
      if (!frozen && r) {
        const hop = runtime.input.jump;
        if (hop) runtime.input.jump = false;
        if (hop || vehiclePress || hopOffPress) {
          if (r.mode === 'wait') cancelRide(); else hopOffRide();
          m.endTransit(); platformRider.platform = null; this.releaseGuide(false);
        }
        else if (interactPress && r.mode !== 'wait' && m.switchSpot().ok && m.spot) { this.placeOnSpot(); emit({ type: 'transit:spot', line: m.line ?? 'streetcar', spot: m.spot }); }
        else if (input.manualMove && r.mode !== 'wait' && m.spot !== 'deck') m.walkDeck();
      }
    }
    input.vehicleContext = this.carried && (mode === 'bike' || mode === 'car' || mode === 'glide') ? 'in' : near ? 'near' : 'none';

    // --- advance the vehicles / glide
    const ride = this.ride;
    if ((mode === 'bike' || mode === 'car') && ride) this.driveRide(ride, dt, frozen, t);
    if (mode === 'glide') this.flyGlide(dt, frozen);
    for (const r of this.fleet.rides) {
      if (r === this.ride && this.carried) continue;
      const visible = env.frustum.intersectsSphere(tmpS.set(tmpV.set(r.sim.x, r.sim.y + 0.5, r.sim.z), 1.4));
      this.fleet.idle(r, dt, p, visible);
    }
    for (const r of this.fleet.rides) if (r.dirty || r === this.ride) { this.fleet.pose(r, dt); r.rig.mesh.updateMatrixWorld(); }
    this.pelican.update(dt, t);

    // --- state machine timers
    const outs = m.tick(dt, {
      vehicleSpeed: this.ride ? Math.abs(this.ride.sim.v) : 0,
      findExitSlot: () => (this.ride ? pickExitSlot(SLOTS, { x: this.ride.sim.x, z: this.ride.sim.z, y: this.ride.sim.y, heading: this.ride.sim.heading }, this.ride.width, this.ride.length) : null),
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
      inp = {
        throttle: Math.max(0, y, input.throttle),
        brake: Math.max(0, -y, input.brake),
        steer: runtime.input.moveX,
        digital: !input.analogSteer,
        sprint: runtime.input.run,
        hop,
      };
    }
    const report = this.fleet.drive(ride, dt, inp);
    this.onDriveReport(ride, report, t);
    this.giveWay(ride, t);
  }

  /** People never get knocked over: a vehicle about to touch a resident stops with a soft bump. */
  private giveWay(ride: Ride, t: number) {
    const s = ride.sim;
    if (Math.abs(s.v) < 0.5) return;
    const fx = Math.sin(s.heading) * Math.sign(s.v), fz = Math.cos(s.heading) * Math.sign(s.v);
    const reach = ride.length * 0.5 + 0.45;
    for (const r of residents) {
      const dx = r.x - s.x, dz = r.z - s.z;
      const ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < reach && side < ride.width * 0.5 + 0.4) {
        const strength = Math.min(1, Math.abs(s.v) / s.spec.vmax);
        s.v = 0; s.px = 0; s.pz = 0;
        if (t - this.giveWayAt > 0.8) { this.giveWayAt = t; emit({ type: 'vehicle:bump', vehicle: ride.kind, strength, hard: false, kind: 'wall' }); emit({ type: 'bump', kind: 'npc', strength: 0.3 }); }
        return;
      }
    }
  }
  private giveWayAt = -9;

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
  }

  private world(): GlideWorld {
    if (!this.glideWorld) this.glideWorld = terrainGlideWorld(tallStructures());
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
        this.landing = 0.7;
        spawnFx('dust', spot.x, heightAt(spot.x, spot.z) + 0.1, spot.z, { scale: 1.2 });
        emit({ type: 'glide:land', x: spot.x, z: spot.z });
        emit({ type: 'land', impact: 0.6 });
        this.pelican.flyOff();
        this.releaseGuide(true);
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
    }
  }

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
    if (m.mode === 'glide') { this.pelican.seat('baybay', out); return { scale: GUIDE_SEAT_SCALE.glide, sitting: true, pole: false }; }
    if (m.mode === 'transit') {
      const plat = platforms.get(m.line ?? 'streetcar');
      if (!plat || !plat.live || !platformRider.platform) return null;
      const seated = m.spot === 'seat';
      const lx = seated ? (this.cameraSide > 0 ? plat.seatRight.x : plat.seatLeft.x) : clamp(this.deck.x - 0.1, plat.deck.minX + 0.3, plat.deck.maxX - 0.3);
      const lz = clamp(this.deck.z + 0.95, plat.deck.minZ + 0.3, plat.deck.maxZ - 0.3);
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
        G.quat.copy(this.seatQuat());
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
    if (m.mode === 'glide') return { scale: GUIDE_SEAT_SCALE.glide, sitting: true, pole: false };
    return { scale: 1, sitting: m.spot === 'seat', pole: m.spot !== 'seat' };
  }

  /** Orientation of whatever carries the riders (vehicle / pelican / platform). */
  private seatQuat(): THREE.Quaternion {
    const m = this.machine;
    if ((m.mode === 'bike' || m.mode === 'car') && this.ride) return this.ride.rig.mesh.quaternion;
    if (m.mode === 'glide') return this.pelican.quaternion;
    if (m.mode === 'transit') {
      const plat = platforms.get(m.line ?? 'streetcar');
      if (plat) return tmpQ.setFromEuler(tmpE.set(0, plat.heading + this.deck.heading, plat.roll, 'YXZ'));
    }
    return tmpQ.setFromAxisAngle(UPY, runtime.player.heading);
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
    platformRider.platform = plat.id;
    if (m.spot === 'deck') {
      // camera yaw in the platform frame
      this.deck.step(dt, runtime.input.moveX, runtime.input.moveY, env.cameraYaw - plat.heading, plat.deck);
      A.speed = this.deck.speed;
      A.stride = this.deck.stride;
    }
    platformRider.x = this.deck.x; platformRider.z = this.deck.z; platformRider.heading = this.deck.heading; platformRider.spot = m.spot ?? 'rail';
    const seated = m.spot === 'seat';
    const w = toWorld(plat, this.deck.x, plat.floor + (seated ? plat.seatY + 0.22 : 0), this.deck.z);
    R.active = true;
    R.x = w.x; R.y = w.y; R.z = w.z;
    R.quat.setFromEuler(tmpE.set(0, plat.heading + this.deck.heading, plat.roll, 'YXZ'));
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

  /** Keep the rideables list fresh while vehicles move (cheap; ~6 entries). */
  syncRideables() {
    for (let i = 0; i < this.fleet.rides.length; i++) {
      const r = this.fleet.rides[i], o = rideables[i];
      if (!o) { this.publishRideables(); return; }
      o.x = r.sim.x; o.z = r.sim.z; o.free = !r.occupied && !r.call;
    }
  }

  dispose() {
    this.fleet.dispose();
    this.pelican.dispose();
    platformRider.platform = null;
    input.vehicleContext = 'none';
    rideables.length = 0;
  }
}

/**
 * Tall landmarks the glide steers round. Landmark blockers carry no roof heights (city buildings do: Blocker.top), so
 * the hero's towers are listed here from their landmark positions with their modelled heights (world/landmarks.ts),
 * and in city mode lane D's tall San Francisco landmarks (cityTallStructures); more via setTallStructures.
 */
const TOWER_TOPS: Record<string, number> = { 'coit-tower': 16, transamerica: 41, 'salesforce-tower': 56.5, 'ferry-building': 30 };
function tallStructures(): TallStructure[] {
  if (tallCache) return tallCache;
  tallCache = DISTRICT.landmarks.filter(l => TOWER_TOPS[l.kind] !== undefined).map(l => ({
    x: l.position.x, z: l.position.z, r: l.kind === 'ferry-building' ? 3 : 4, top: (l.baseY ?? heightAt(l.position.x, l.position.z)) + TOWER_TOPS[l.kind] + 2,
  }));
  if (game.get().worldMode === 'city') tallCache.push(...cityTallStructures());
  return tallCache;
}

/**
 * City mode (checkpoint, lane E's request to lane D): landmarks at least 10 u tall with their modelled height
 * (data/sf/landmarks height.u; overlooks like Twin Peaks are terrain), the Golden Gate Bridge by its two towers.
 * 'terrain' bases are read from core/terrain when the first glide starts (streamed ground, else the far DEM).
 */
function cityTallStructures(): TallStructure[] {
  const out: TallStructure[] = [];
  for (const l of SF_LANDMARKS) {
    const h = sfLandmarkInfo(l.id)?.height;
    if (!h || h.rule === 'overlook' || h.u < 10) continue;
    if (l.id === 'golden-gate-bridge') {
      for (const x of [-GGB.TOWER, GGB.TOWER]) { const p = landmarkToWorld(l, { x, z: 0 }); out.push({ x: p.x, z: p.z, r: 4, top: GGB.TOP + 2 }); }
      continue;
    }
    const base = typeof l.base === 'number' ? l.base : heightAt(l.x, l.z);
    out.push({ x: l.x, z: l.z, r: 4, top: base + h.u + 2 });
  }
  return out;
}
export function setTallStructures(list: TallStructure[]) { tallCache = [...tallStructures(), ...list]; }
