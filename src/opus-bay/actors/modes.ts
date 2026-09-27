import type { MovePhase } from '../core/runtime';
import type { MoveMode, MoveSpot } from '../core/store';

/**
 * Movement state machine (plan §6.1): foot · sit · bike · car · transit · glide · travel · photo, with the guarded
 * transitions between them. Pure and framework-free (node tests: tests/opus-bay-sf-modes.test.ts); the movement system
 * (actors/moveSystem.ts) feeds it presses and world facts and acts on what it reports.
 *
 * `mode` switches at the START of a transition into a mode (boarding a bike is already mode 'bike', phase
 * 'boarding') and at the END of a transition out of it (alighting is still 'bike' until the feet touch the ground), so
 * rendering / camera code can key on the mode alone and use `phase` + `progress` for the in-between animation.
 *
 * Door slots after GTA_SZ (MIT, src/city-walk.ts `doors` / `exitCar` / `canEnter`): a slot must fit the walker disc,
 * sit within 0.55 u of the vehicle's floor height and be reachable along a straight line sampled every 0.15 u — a car
 * parked against a wall cannot be left (or entered) through the wall.
 */

export type { MoveMode, MoveSpot, MovePhase };
export type VehicleKind = 'bike' | 'car';

/** Transition timings (seconds). */
export const TIMING = {
  board: 0.45,
  alight: 0.4,
  /** longest auto-brake before getting off anyway */
  brakeMax: 0.7,
  transitBoard: 0.5,
  transitAlight: 0.4,
  takeoff: 1.0,
  /** longest landing descent */
  landMax: 3,
  sitSnap: 0.35,
  stand: 0.3,
  /** a moving vehicle auto-brakes this long at most when dialogue / photo / a cinematic freezes play */
  freezeBrake: 1.5,
} as const;

/** auto-brake deceleration (u/s²) and the speed below which the rider steps off */
export const BRAKE_DECEL = 24;
export const ALIGHT_SPEED = 1.2;
/** a door slot this close to the player can be used (u) */
export const ENTER_RADIUS = 2.4;
/** the player must be this slow (u/s) to get in; the parked vehicle stopped */
export const PLAYER_STILL = 0.8;
export const VEHICLE_STILL = 0.5;
/** slot height vs the vehicle floor (u), sampling step of the straight-line check (u), walker disc (u) */
export const SLOT_DH = 0.55;
export const SLOT_STEP = 0.15;
export const SLOT_RADIUS = 0.45;
/** step between two samples of the straight line (u) — the walker's step-up limit */
const SLOT_RISE = 0.48;
/** holding F calls your vehicle only when it is farther than this (u) */
export const CALL_MIN_DIST = 25;

export type SlotSide = 'left' | 'right' | 'back' | 'front';
export interface DoorSlot { x: number; z: number; side: SlotSide }

/**
 * The four door slots of a vehicle at (x, z) facing `heading` (three.js: faces (sin h, cos h); local +x = its left):
 * ±(W/2 + 0.9) to the sides and ±(L/2 + 0.6) behind / ahead, in the order they are tried when getting out.
 */
export function doorSlots(x: number, z: number, heading: number, width: number, length: number): DoorSlot[] {
  const fx = Math.sin(heading), fz = Math.cos(heading), lx = Math.cos(heading), lz = -Math.sin(heading);
  const side = width / 2 + 0.9, end = length / 2 + 0.6;
  return [
    { x: x + lx * side, z: z + lz * side, side: 'left' },
    { x: x - lx * side, z: z - lz * side, side: 'right' },
    { x: x - fx * end, z: z - fz * end, side: 'back' },
    { x: x + fx * end, z: z + fz * end, side: 'front' },
  ];
}

/** What the slot checks ask of the world (core/terrain in the game; synthetic worlds in tests). */
export interface SlotWorld {
  canStand(x: number, z: number, radius: number): boolean;
  heightAt(x: number, z: number): number;
}

/**
 * A slot is usable from `from` (the vehicle centre when getting out, the player when getting in): the walker disc fits
 * there, its height is within SLOT_DH of `floorY`, and the straight line from `from` is walkable in SLOT_STEP samples
 * with no step above the walker's limit.
 */
export function slotClear(world: SlotWorld, from: { x: number; z: number }, slot: { x: number; z: number }, floorY: number): boolean {
  if (!world.canStand(slot.x, slot.z, SLOT_RADIUS)) return false;
  if (Math.abs(world.heightAt(slot.x, slot.z) - floorY) > SLOT_DH) return false;
  const d = Math.hypot(slot.x - from.x, slot.z - from.z);
  const n = Math.max(1, Math.ceil(d / SLOT_STEP));
  let prev = world.heightAt(from.x, from.z);
  for (let i = 1; i <= n; i++) {
    const k = i / n, x = from.x + (slot.x - from.x) * k, z = from.z + (slot.z - from.z) * k;
    // (a point sample: the vehicle's own hull is not a terrain blocker, so the line may start under it)
    if (!world.canStand(x, z, 0)) return false;
    const h = world.heightAt(x, z);
    if (Math.abs(h - prev) > SLOT_RISE) return false;
    prev = h;
  }
  return true;
}

/** First clear slot to step out to, or null (→ "这里下不了车"). */
export function pickExitSlot(world: SlotWorld, v: { x: number; z: number; y: number; heading: number }, width: number, length: number): DoorSlot | null {
  for (const slot of doorSlots(v.x, v.z, v.heading, width, length)) if (slotClear(world, v, slot, v.y)) return slot;
  return null;
}

/** Nearest slot the player can walk to within ENTER_RADIUS (reachable in a straight line), with its distance. */
export function nearestEnterSlot(world: SlotWorld, player: { x: number; z: number }, v: { x: number; z: number; y: number; heading: number }, width: number, length: number): { slot: DoorSlot; dist: number } | null {
  let best: { slot: DoorSlot; dist: number } | null = null;
  for (const slot of doorSlots(v.x, v.z, v.heading, width, length)) {
    const d = Math.hypot(slot.x - player.x, slot.z - player.z);
    if (d > ENTER_RADIUS || (best && d >= best.dist)) continue;
    // the walk to the slot must not cross a wall (a bike behind a railing is not "near")
    if (!slotClear(world, player, slot, v.y)) continue;
    best = { slot, dist: d };
  }
  return best;
}

export type MoveBlock = 'busy' | 'far' | 'moving' | 'no-slot' | 'locked' | 'airborne' | 'no-landing';
export type MoveResult = { ok: true } | { ok: false; reason: MoveBlock };
const OK: MoveResult = { ok: true };
const no = (reason: MoveBlock): MoveResult => ({ ok: false, reason });

/** What happened during a tick (the system turns these into game events, sounds and BAYBAY moves). */
export type MoveOutcome =
  | { type: 'boarded'; vehicle: VehicleKind }
  | { type: 'alighted'; vehicle: VehicleKind; slot: DoorSlot }
  | { type: 'blocked'; reason: MoveBlock }
  | { type: 'took-off' }
  | { type: 'landed' }
  | { type: 'sat' }
  | { type: 'stood' }
  | { type: 'transit-spot'; spot: MoveSpot };

/** World facts the machine needs each tick. */
export interface MoveSense {
  /** |speed| of the vehicle being ridden (u/s) */
  vehicleSpeed: number;
  /** resolve an exit slot now (called once the auto-brake is done) */
  findExitSlot: () => DoorSlot | null;
}

export class MoveMachine {
  mode: MoveMode = 'foot';
  phase: MovePhase = 'steady';
  /** seconds spent in the current phase */
  phaseT = 0;
  /** the bike / car being boarded, ridden or left */
  vehicle: VehicleKind | null = null;
  line: string | null = null;
  spot: MoveSpot | null = null;
  /** where the rider steps off (set when alighting starts) */
  exitSlot: DoorSlot | null = null;
  private dur = 0;

  /** 0..1 through the current transition (1 when steady) */
  get progress(): number { return this.phase === 'steady' ? 1 : Math.min(1, this.phaseT / Math.max(1e-3, this.dur)); }
  /** the vehicle must brake: before stepping off (auto-brake) */
  get braking(): boolean { return this.phase === 'braking'; }
  /** player / vehicle controls are ignored during transitions */
  get inputLocked(): boolean { return this.phase !== 'steady'; }
  get riding(): boolean { return this.mode === 'bike' || this.mode === 'car'; }

  private go(phase: MovePhase, dur: number) { this.phase = phase; this.phaseT = 0; this.dur = dur; }
  private steady() { this.phase = 'steady'; this.phaseT = 0; this.dur = 0; }

  /** F near a parked bike / car. `slotDistance` null = no reachable door slot within ENTER_RADIUS. */
  enter(kind: VehicleKind, g: { slotDistance: number | null; playerSpeed: number; vehicleSpeed: number }): MoveResult {
    if (this.mode !== 'foot' || this.phase !== 'steady') return no('busy');
    if (g.slotDistance === null || g.slotDistance > ENTER_RADIUS) return no('far');
    if (g.vehicleSpeed >= VEHICLE_STILL || g.playerSpeed >= PLAYER_STILL) return no('moving');
    this.mode = kind;
    this.vehicle = kind;
    this.exitSlot = null;
    this.go('boarding', TIMING.board);
    return OK;
  }

  /** F while riding: auto-brake first (≤ 0.7 s), then step off at a clear slot — or stay put if there is none. */
  exit(): MoveResult {
    if (!this.riding || this.phase !== 'steady') return no('busy');
    this.go('braking', TIMING.brakeMax);
    return OK;
  }

  /** E at a bench / step / seat anchor. */
  sit(g: { grounded: boolean }): MoveResult {
    if (this.mode !== 'foot' || this.phase !== 'steady') return no('busy');
    if (!g.grounded) return no('airborne');
    this.mode = 'sit';
    this.go('settling', TIMING.sitSnap);
    return OK;
  }

  /** Any move (or E) while sitting. */
  stand(): MoveResult {
    if (this.mode !== 'sit' || this.phase === 'rising') return no('busy');
    this.go('rising', TIMING.stand);
    return OK;
  }

  /** G on foot: the pelican swoops in (1 s) — only once the glide is unlocked (Coit viewpoint / ?debug=1). */
  takeOff(g: { unlocked: boolean; grounded: boolean }): MoveResult {
    if (this.mode !== 'foot' || this.phase !== 'steady') return no('busy');
    if (!g.unlocked) return no('locked');
    if (!g.grounded) return no('airborne');
    this.mode = 'glide';
    this.go('takeoff', TIMING.takeoff);
    return OK;
  }

  /** G (or a long-press) while gliding: descend to the resolved spot over `seconds` (≤ 3). */
  land(g: { spotFound: boolean; seconds: number }): MoveResult {
    if (this.mode !== 'glide' || this.phase !== 'steady') return no('busy');
    if (!g.spotFound) return no('no-landing');
    this.go('landing', Math.min(TIMING.landMax, Math.max(0.5, g.seconds)));
    return OK;
  }

  /** A transit ride started (flow boarded the streetcar): stand at the rail. */
  beginTransit(line: string, spot: MoveSpot = 'rail') {
    this.mode = 'transit';
    this.line = line;
    this.spot = spot;
    this.vehicle = null;
    this.go('boarding', TIMING.transitBoard);
  }

  /** E on transit: rail ↔ seat (a deck walker goes back to the rail). */
  switchSpot(): MoveResult {
    if (this.mode !== 'transit' || this.phase !== 'steady') return no('busy');
    this.spot = this.spot === 'rail' ? 'seat' : 'rail';
    return OK;
  }

  /** Moving the stick on a transit car: walk the deck (ferry / aisle). */
  walkDeck() { if (this.mode === 'transit' && this.phase === 'steady') this.spot = 'deck'; }

  /** The ride ended (flow): off the car. */
  endTransit() {
    if (this.mode !== 'transit') return;
    this.toFoot();
  }

  /** Map "飞过去" (fast travel, owned by game flow): scripted, ends on foot. */
  beginTravel() { this.mode = 'travel'; this.vehicle = null; this.steady(); }
  endTravel() { if (this.mode === 'travel') this.toFoot(); }

  /** Teleports, restarts, anything that must drop every vehicle state at once. */
  toFoot() {
    this.mode = 'foot';
    this.vehicle = null;
    this.line = null;
    this.spot = null;
    this.exitSlot = null;
    this.steady();
  }

  /** Advance timers; returns what completed this tick. */
  tick(dt: number, sense: MoveSense): MoveOutcome[] {
    const out: MoveOutcome[] = [];
    if (this.phase === 'steady') return out;
    this.phaseT += dt;
    switch (this.phase) {
      case 'boarding':
        if (this.phaseT >= this.dur) {
          this.steady();
          if (this.vehicle && this.riding) out.push({ type: 'boarded', vehicle: this.vehicle });
        }
        break;
      case 'braking':
        if (sense.vehicleSpeed < ALIGHT_SPEED || this.phaseT >= this.dur) {
          const slot = sense.findExitSlot();
          if (slot) { this.exitSlot = slot; this.go('alighting', TIMING.alight); }
          else { this.steady(); out.push({ type: 'blocked', reason: 'no-slot' }); }
        }
        break;
      case 'alighting':
        if (this.phaseT >= this.dur) {
          const vehicle = this.vehicle, slot = this.exitSlot;
          this.toFoot();
          if (vehicle && slot) out.push({ type: 'alighted', vehicle, slot });
        }
        break;
      case 'takeoff':
        if (this.phaseT >= this.dur) { this.steady(); out.push({ type: 'took-off' }); }
        break;
      case 'landing':
        if (this.phaseT >= this.dur) { this.toFoot(); out.push({ type: 'landed' }); }
        break;
      case 'settling':
        if (this.phaseT >= this.dur) { this.steady(); out.push({ type: 'sat' }); }
        break;
      case 'rising':
        if (this.phaseT >= this.dur) { this.toFoot(); out.push({ type: 'stood' }); }
        break;
      default:
        this.steady();
    }
    return out;
  }
}
