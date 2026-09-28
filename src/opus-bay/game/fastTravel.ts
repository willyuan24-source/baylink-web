import { useSyncExternalStore } from 'react';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { faceOpen, openHeading } from '../actors/faceOpen';
import { arrivalSpot as openArrivalSpot } from '../actors/nav';
import { faceCameraToward } from './cinema';
import { canStand, cityTerrain, heightAt, nearestWalkable } from '../core/terrain';
import type { Bilingual, Vec2 } from '../core/types';
import { cityStreamerLazy } from '../world/cityLoader';
import { flow } from './flowStore';
import { holdLock } from './playerLock';

/**
 * 飞过去 fast travel (lane G1, plan §6.7 / G1-7). Light on purpose (game/transit.ts imports travelEpoch): no flow, no
 * places, no three. The map's PlaceActions (game/travel.ts flyTo) starts a trip with the destination's arrival point.
 *
 *   pickup 0.8 s   the pelican picks the player up (E2 poses it from travelPose()); the camera eases in behind
 *   rise 1.0 s     up to the top view (pitch 1.1, distance 90) over the start
 *   pan            clamp(d / 400, 0.6, 3.5) s along the way; beyond 1,400 u the pan covers the first 45 % and a cloud
 *                  veil hides the jump
 *   hold           in the cloud until the city is ready around the destination (streamer whenReady(dest, 150)), cut
 *                  after 8 s (CS-14); skipped when it is ready already
 *   descent 1.2 s  the player is placed on the arrival spot (arrivalSpot: walkable, resident ground) and the camera
 *                  comes down behind them, then hands back to the follow rig
 *
 * The store's move.mode is 'travel' for the whole trip (actors park every vehicle, BAYBAY hops in beside the player
 * after it). `travelEpoch()` increments at every trip start, ?at= teleport and resume: lane F never counts a ride
 * across a change (anti-cheat). `travelPose()` is the sky path for E2's pelican / rider / BAYBAY while travelling.
 */

export interface TravelPose {
  phase: 'pickup' | 'rise' | 'pan' | 'hold' | 'descent';
  /** 0..1 within the phase */
  t: number;
  x: number;
  y: number;
  z: number;
  heading: number;
}

export type TravelPhase = TravelPose['phase'];

export interface TravelDest {
  /** place / landmark id (the `travel` event's `to`) */
  id: string;
  name: Bilingual;
  x: number;
  z: number;
  /** facing on arrival (world yaw) when nothing is more open (W5-F7 / N5: the most open ground wins), else the travel way */
  heading?: number;
  /**
   * W5-N5 · a first sight: the landmark to see on landing (an attraction's anchor, set by the trip runner for a place not
   * discovered yet). The player lands facing it and the descent camera ends behind them with it in view; the caption
   * says 第一次来 · 名称 (the landing is the discovery: the arrival moment follows).
   */
  look?: Vec2;
}

// ---------------------------------------------------------------------------
// Pure timing (tests run it with a fake clock)
// ---------------------------------------------------------------------------

export const PICKUP_S = 0.8;
export const RISE_S = 1.0;
export const DESCENT_S = 1.2;
export const HOLD_MAX_S = 8;
export const PAN_SPEED = 400;
export const CLOUD_CUT_D = 1400;
export const CLOUD_PAN_SHARE = 0.45;
export const TOP_PITCH = 1.1;
export const TOP_DIST = 90;
/** pelican cruise height above the ground (u) */
export const CRUISE_Y = 48;

export interface TripPlan {
  d: number; pan: number; cloud: boolean; yaw: number;
  /** W5-N9: the descent's length (s) when not DESCENT_S (a scenic flight's landing curve) */
  descent?: number;
}

/** A camera shot (runtime.camera.shot without its duration). */
export interface ScenicShot { position: [number, number, number]; target: [number, number, number] }

/**
 * W5-N9 · 看风景飞过去 (game/scenicFlight.ts, loaded with the trip runner): after the pickup and the rise the driver flies
 * the pelican itself (a GlideSim: the autopilot or the player's controls) until it asks to land; the trip keeps the
 * lock, the cinematic, the streaming, the landing and the events. Poses use TravelPose's convention (y = the seat − the
 * perch, as the fast hop's path).
 */
export interface ScenicDriver {
  /** the rise is over: fly on from this pose */
  begin(x: number, y: number, z: number, heading: number): void;
  /** one frame: 'fly' on; 'land' at the destination; 'here' where the pelican is (G); 'skip' the fast way from here */
  step(dt: number, ready: boolean): 'fly' | 'land' | 'here' | 'skip';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly heading: number;
  /** 0..1 of the way */
  readonly progress: number;
  /** where the city streams (a little ahead of the pelican) */
  focus(): Vec2;
  /** the camera this frame */
  shot(dt: number): ScenicShot;
  /** the rise's closing camera behind a pose */
  chaseAt(x: number, y: number, z: number, heading: number): ScenicShot;
  /** the flight is over (landed, skipped, cancelled) */
  end(): void;
}

export function planTrip(from: Vec2, to: Vec2): TripPlan {
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  return { d, pan: Math.min(3.5, Math.max(0.6, d / PAN_SPEED)), cloud: d > CLOUD_CUT_D, yaw: d > 0.01 ? Math.atan2(to.x - from.x, to.z - from.z) : 0 };
}

/** Phase clock: advance with dt; `ready` = the destination is streamed in (hold ends at once or after HOLD_MAX_S). */
export class TripClock {
  phase: TravelPhase = 'pickup';
  elapsed = 0;
  done = false;
  readonly plan: TripPlan;
  constructor(plan: TripPlan) { this.plan = plan; }
  duration(phase: TravelPhase = this.phase): number {
    return phase === 'pickup' ? PICKUP_S : phase === 'rise' ? RISE_S : phase === 'pan' ? this.plan.pan : phase === 'hold' ? HOLD_MAX_S : this.plan.descent ?? DESCENT_S;
  }
  /** 0..1 in the current phase */
  get t(): number { return Math.min(1, this.elapsed / this.duration()); }
  /** Returns the phase entered this step (or null). */
  step(dt: number, ready: boolean): TravelPhase | 'done' | null {
    if (this.done) return null;
    this.elapsed += dt;
    const end = this.phase === 'hold' ? ready || this.elapsed >= HOLD_MAX_S : this.elapsed >= this.duration();
    if (!end) return null;
    const next: Record<TravelPhase, TravelPhase | 'done'> = { pickup: 'rise', rise: 'pan', pan: 'hold', hold: 'descent', descent: 'done' };
    const n = next[this.phase];
    if (n === 'done') { this.done = true; return 'done'; }
    this.phase = n;
    this.elapsed = 0;
    return n;
  }
  /** skip (Esc / Skip): straight to the hold */
  skip() { if (this.phase === 'pickup' || this.phase === 'rise' || this.phase === 'pan') { this.phase = 'hold'; this.elapsed = 0; } }
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Ground point of the sky path at pan progress t (cloud trips cover only the first 45 % before the cut). */
export function panPoint(from: Vec2, to: Vec2, plan: TripPlan, t: number): Vec2 {
  const k = smooth(Math.min(1, Math.max(0, t))) * (plan.cloud ? CLOUD_PAN_SHARE : 1);
  return { x: from.x + (to.x - from.x) * k, z: from.z + (to.z - from.z) * k };
}

/** The pelican's pose along the trip (pure). `ground(x, z)` is the terrain height. */
export function tripPose(c: TripClock, from: Vec2, to: Vec2, ground: (x: number, z: number) => number): TravelPose {
  const { plan } = c, t = c.t, heading = plan.yaw;
  let p: Vec2 = from, lift: number;
  if (c.phase === 'pickup') lift = 2.5 * smooth(t);
  else if (c.phase === 'rise') lift = 2.5 + (CRUISE_Y - 2.5) * smooth(t);
  else if (c.phase === 'pan') { p = panPoint(from, to, plan, t); lift = CRUISE_Y; }
  else if (c.phase === 'hold') { p = to; lift = CRUISE_Y; }
  else { p = to; lift = CRUISE_Y * (1 - smooth(t)); }
  return { phase: c.phase, t, x: p.x, y: ground(p.x, p.z) + lift, z: p.z, heading };
}

export const PICKUP_PITCH = 1.0;
export const PICKUP_DIST = 14;

/** Camera on the follow rig's orbit: `yaw` points from the target to the camera (actors/camera.ts convention). */
export function orbitShot(p: Vec2, gy: number, yaw: number, pitch: number, dist: number): { position: [number, number, number]; target: [number, number, number] } {
  const h = Math.cos(pitch) * dist;
  return { position: [p.x + Math.sin(yaw) * h, gy + 1.6 + Math.sin(pitch) * dist, p.z + Math.cos(yaw) * h], target: [p.x, gy + 1.6, p.z] };
}

/** Top-view camera over a ground point, looking along yaw. */
export function topShot(p: Vec2, gy: number, yaw: number, dist = TOP_DIST, pitch = TOP_PITCH): { position: [number, number, number]; target: [number, number, number] } {
  const h = Math.cos(pitch) * dist;
  return { position: [p.x - Math.sin(yaw) * h, gy + Math.sin(pitch) * dist, p.z - Math.cos(yaw) * h], target: [p.x, gy, p.z] };
}

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

let epoch = 0;
interface Trip {
  dest: TravelDest; from: Vec2; clock: TripClock; ready: boolean; landed: Vec2 | null; veil: boolean; release: () => void;
  /** W5-N9: the scenic flight's driver (null: the fast hop, or a scenic flight skipped to it) */
  scenic: ScenicDriver | null;
  /** W5-N9: where a scenic flight lands when not at the destination (G: where the pelican is) */
  landAt: Vec2 | null;
  /** W5-N9: the scenic landing curve (from the pelican, ahead at its height, down to the spot) */
  curve: ScenicCurve | null;
}

/** W5-N9 · the scenic landing: a quadratic curve a → b → c (TravelPose y) and the heading along it. */
export interface ScenicCurve { ax: number; ay: number; az: number; bx: number; by: number; bz: number; cx: number; cy: number; cz: number; heading: number }
let trip: Trip | null = null;

export function travelActive(): boolean { return trip !== null; }
export function travelEpoch(): number { return epoch; }
/** ?at= teleports and resume also void rides in progress */
export function bumpTravelEpoch() { epoch++; }
export function travelPose(): TravelPose | null {
  if (!trip) return null;
  const c = trip.clock, sc = trip.scenic;
  // W5-N9: a scenic flight is the driver's between the rise and the landing, then the landing curve
  if (sc && c.phase === 'pan') return { phase: 'pan', t: sc.progress, x: sc.x, y: sc.y, z: sc.z, heading: sc.heading };
  if (trip.curve && c.phase === 'descent') return curvePose(trip.curve, c.t);
  return tripPose(c, trip.from, trip.landed ?? trip.dest, heightAt);
}

/** A point of the scenic landing curve at t (0..1, eased) as a pose. Pure. */
export function curvePose(k: ScenicCurve, t: number): TravelPose {
  const e = smooth(Math.min(1, Math.max(0, t)));
  const q = (a: number, b: number, c: number) => (1 - e) * (1 - e) * a + 2 * (1 - e) * e * b + e * e * c;
  return { phase: 'descent', t, x: q(k.ax, k.bx, k.cx), y: q(k.ay, k.by, k.cy), z: q(k.az, k.bz, k.cz), heading: k.heading };
}

/** The scenic landing's length (s): 11 u/s along the way down, 2–3.2 s. */
export const scenicDescentSeconds = (d: number, drop: number): number => Math.min(3.2, Math.max(2, Math.hypot(d, drop) / 11));

/** DOM view of the trip (the cloud veil and the caption): changes a few times per trip. */
interface TravelView { active: boolean; veil: boolean; to: Bilingual | null }
let view: TravelView = { active: false, veil: false, to: null };
const subs = new Set<() => void>();
function setView(v: TravelView) { view = v; for (const fn of subs) fn(); }
const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
const getView = () => view;
export function useTravelView(): TravelView { return useSyncExternalStore(subscribe, getView, getView); }

/** How far the city arrival may move to reach a large open area (actors/nav arrivalSpot). */
export const OPEN_ARRIVAL_R = 30;

/**
 * Walkable, standable spot for arriving at p (ground must be resident: call after whenReady). In the city the spot of
 * a large open area within 30 u comes first (actors/nav `arrivalSpot`, the glide's and the tap's rule: never a backyard
 * pocket or a slot between two house rows, E2 w3 part b request 1 / CS-10); then p itself when it is standable, then
 * the nearest walkable spot within 40 u. District mode: p or the nearest walkable spot, as before.
 */
export function arrivalSpot(p: Vec2, open: (p: Vec2, r: number) => Vec2 | null = openArrivalSpot, env: ArrivalEnv = LIVE_ENV): Vec2 {
  const o = env.city() ? open(p, OPEN_ARRIVAL_R) : null;
  const here = env.stand(p.x, p.z);
  // (W5-N5) never another level than the place: the open ground nav finds within 30 u may be a deck above it (Fort
  // Point's door lies under the Golden Gate's approach, 15 u up: a flight there landed on the bridge) or a terrace
  // below a cliff; a standable place then keeps its own spot
  if (o && (!here || Math.abs(env.height(o.x, o.z) - env.height(p.x, p.z)) <= LEVEL_STEP)) return o;
  if (here) return { x: p.x, z: p.z };
  return nearestWalkable(p, 40) ?? { x: p.x, z: p.z };
}

/** An arrival's open area may lie at most this far above or below the place's own ground (u). */
export const LEVEL_STEP = 4;
/** What arrivalSpot asks of the world (injectable for tests). */
export interface ArrivalEnv { city: () => boolean; stand: (x: number, z: number) => boolean; height: (x: number, z: number) => number }
const LIVE_ENV: ArrivalEnv = { city: () => !!cityTerrain(), stand: (x, z) => canStand(x, z), height: (x, z) => heightAt(x, z) };

/**
 * W5-N5 · the landing heading: a first sight faces its landmark; else the most open ground (lane F's W5-F7
 * actors/faceOpen `openHeading`: the longest run of walkable ground, so the first push never walks into a wall; ties
 * and a spot with nothing open go to the place's own arrival heading, else the travel direction). Pure over `facer`.
 */
export function landingHeading(spot: Vec2, dest: Pick<TravelDest, 'heading' | 'look'>, travelYaw: number, facer: LandingFacer | null = openFacer): number {
  if (dest.look) {
    const dx = dest.look.x - spot.x, dz = dest.look.z - spot.z;
    if (Math.hypot(dx, dz) > 2) return Math.atan2(dx, dz);
  }
  const prefer = dest.heading !== undefined && Number.isFinite(dest.heading) ? dest.heading : travelYaw;
  const open = facer?.(spot.x, spot.z, prefer);
  return typeof open === 'number' && Number.isFinite(open) ? open : prefer;
}

/** A landing facer: the heading to face at (x, z), `prefer` on ties / nothing open (null: no opinion). */
export type LandingFacer = (x: number, z: number, prefer: number) => number | null | undefined;
/** lane F's open-ground rule (actors/faceOpen openHeading; the ground is streamed at the descent: the hold waited). */
const openFacer: LandingFacer = (x, z, prefer) => openHeading(x, z, prefer).heading;

/**
 * The descent's closing camera (W5-N5): behind the player along the heading. A first sight pulls back and up a little
 * and looks past the player toward the landmark (at most 30 u ahead, 4 u up), so it is in the frame as the camera lands.
 */
export function descentShot(spot: Vec2, gy: number, heading: number, look?: Vec2): { position: [number, number, number]; target: [number, number, number] } {
  const sx = Math.sin(heading), cz = Math.cos(heading);
  if (!look) return { position: [spot.x - sx * 10, gy + 5, spot.z - cz * 10], target: [spot.x, gy + 1.6, spot.z] };
  const ahead = Math.min(30, 0.4 * Math.hypot(look.x - spot.x, look.z - spot.z));
  return { position: [spot.x - sx * 12, gy + 6.5, spot.z - cz * 12], target: [spot.x + sx * ahead, gy + 4, spot.z + cz * ahead] };
}

/** Place the player (no event, no locks): shared by the trip, ?at= and resume. */
export function placePlayer(p: Vec2, heading?: number) {
  const pl = runtime.player;
  pl.x = p.x; pl.z = p.z; pl.y = heightAt(p.x, p.z);
  if (heading !== undefined && Number.isFinite(heading)) pl.heading = heading;
  pl.pathTarget = null;
  pl.pendingInteract = null;
}

/**
 * Start a trip (the caller closed the map and got the player off transit). False when one is running already.
 * `scenic` (W5-N9): the driver that flies the way itself after the rise (看风景飞过去).
 */
export function startTravel(dest: TravelDest, scenic: ScenicDriver | null = null): boolean {
  if (trip || !Number.isFinite(dest.x) || !Number.isFinite(dest.z)) return false;
  const from = { x: runtime.player.x, z: runtime.player.z };
  const plan = planTrip(from, dest);
  // a scenic flight's sky part ends when its driver asks to land, never on the clock
  if (scenic) { plan.pan = Infinity; plan.cloud = false; }
  // (W5-0b) the trip holds the feet through game/playerLock: a lock re-derived mid-trip (a line's dialogue closing, a
  // ride ending) keeps the rider on the pelican, and the landing's release lets the refresher free them
  trip = { dest, from, clock: new TripClock(plan), ready: false, landed: null, veil: false, release: holdLock('travel', dest.id), scenic, landAt: null, curve: null };
  epoch++;
  game.set({ move: { mode: 'travel' } });
  runtime.player.pathTarget = null;
  const caption = scenic ? { zh: `看风景 · 飞往${dest.name.zh}`, en: `Scenic flight to ${dest.name.en}` } : { zh: `飞往 · ${dest.name.zh}`, en: `Flying to ${dest.name.en}` };
  flow.set({ cinematic: 'travel', caption, captionSub: null, mapTarget: null });
  setView({ active: true, veil: false, to: dest.name });
  emit({ type: 'travel', what: 'start', to: dest.id });
  // the city around the destination: resolves once it is on screen and walkable
  const s = cityStreamerLazy();
  const mine = trip;
  if (s) void s.whenReady({ x: dest.x, z: dest.z }, 150).then(() => { if (trip === mine) mine.ready = true; });
  else trip.ready = true;
  // pickup: up along the follow camera's own orbit (clear of buildings), steep enough that the horizon (and the whole
  // city behind it) never fills the frame on the way up to the top view (≤ 400k triangles at high)
  runtime.camera.shot = { ...orbitShot(from, heightAt(from.x, from.z), runtime.camera.yaw, PICKUP_PITCH, PICKUP_DIST), duration: PICKUP_S };
  return true;
}

/** Esc / Skip during a trip: straight into the cloud (the landing still waits for the city). */
export function skipTravel() {
  if (!trip) return;
  // W5-N9: a scenic flight skipped takes the fast way from where it is (the cloud hides the jump to the destination)
  if (trip.scenic && trip.clock.phase !== 'descent') { dropScenic(trip); trip.clock.plan.cloud = true; }
  trip.clock.skip();
  enterPhase(trip, trip.clock.phase);
}

/** The scenic flight hands the rest of the trip to the fast hop (skipped, or the autopilot cannot get there). */
function dropScenic(tr: Trip) {
  tr.scenic?.end();
  tr.scenic = null;
  tr.landAt = null;
  tr.clock.plan.pan = 0;
}

/** A scenic flight lands: at the destination, or where the pelican is (G). Its descent is the landing curve. */
function scenicLand(tr: Trip, sc: ScenicDriver, here: boolean) {
  if (here) {
    const f = 14;
    tr.landAt = { x: sc.x + Math.sin(sc.heading) * f, z: sc.z + Math.cos(sc.heading) * f };
  }
  tr.clock.phase = 'descent';
  tr.clock.elapsed = 0;
  enterPhase(tr, 'descent');
}

function enterPhase(tr: Trip, phase: TravelPhase) {
  const { plan } = tr.clock;
  const s = cityStreamerLazy();
  if (phase === 'rise') {
    // W5-N9: a scenic flight rises into the glide's own camera behind the pelican (not the top view)
    const gy = heightAt(tr.from.x, tr.from.z);
    const shot = tr.scenic ? tr.scenic.chaseAt(tr.from.x, gy + CRUISE_Y, tr.from.z, plan.yaw) : topShot(tr.from, gy, plan.yaw);
    runtime.camera.shot = { ...shot, duration: RISE_S };
  } else if (phase === 'pan') {
    if (tr.scenic) tr.scenic.begin(tr.from.x, heightAt(tr.from.x, tr.from.z) + CRUISE_Y, tr.from.z, plan.yaw);
    else if (s) s.focusOverride = { x: tr.dest.x, z: tr.dest.z };
  } else if (phase === 'hold') {
    if (s) s.focusOverride = { x: tr.dest.x, z: tr.dest.z };
    // long trips and a destination still streaming: the cloud hides the jump / the pop-in
    const veil = plan.cloud || !tr.ready;
    if (veil && !tr.veil) { tr.veil = true; setView({ ...view, veil: true }); emit({ type: 'travel', what: 'cloud', to: tr.dest.id }); }
    const top = topShot(tr.dest, heightAt(tr.dest.x, tr.dest.z), plan.yaw);
    runtime.camera.shot = { ...top, duration: veil ? 0.001 : 0.6 };
  } else if (phase === 'descent') {
    // (W5-N9: a scenic flight landing where the pelican is: that spot, facing on — no destination heading or first sight)
    const sc = tr.scenic, at = tr.landAt;
    const spot = arrivalSpot(at ?? tr.dest);
    const dest = at ? {} : tr.dest;
    const heading = landingHeading(spot, dest, sc ? sc.heading : plan.yaw);
    tr.landed = spot;
    placePlayer(spot, heading);
    const gy = heightAt(spot.x, spot.z);
    tr.veil = false;
    setView({ ...view, veil: false });
    let dur = DESCENT_S;
    if (sc) {
      // the landing curve from the pelican, ahead at its height, down onto the spot (the pose's y: the seat − the perch)
      const d = Math.hypot(spot.x - sc.x, spot.z - sc.z), k = Math.min(d * 0.55, 18);
      const fx = Math.sin(sc.heading), fz = Math.cos(sc.heading);
      dur = scenicDescentSeconds(d, sc.y - gy);
      tr.curve = { ax: sc.x, ay: sc.y, az: sc.z, bx: sc.x + fx * k, by: sc.y, bz: sc.z + fz * k, cx: spot.x, cy: gy, cz: spot.z, heading: d > 1 ? Math.atan2(spot.x - sc.x, spot.z - sc.z) : sc.heading };
      tr.clock.plan.descent = dur;
      sc.end();
      tr.scenic = null;
    }
    // the top view straight over the landing spot (a scenic flight: from behind the pelican), then down to behind the
    // player (a first sight: its landmark ahead)
    const look = at ? undefined : tr.dest.look;
    runtime.camera.shot = { ...descentShot(spot, gy, heading, look), duration: dur };
    if (look) flow.set({ caption: { zh: `第一次来 · ${tr.dest.name.zh}`, en: `First time here · ${tr.dest.name.en}` } });
  }
}

function finish(tr: Trip) {
  trip = null;
  tr.scenic?.end();
  const s = cityStreamerLazy();
  if (s) s.focusOverride = null;  // CS-4: never leave the streamer pinned
  runtime.camera.shot = null;
  if (game.get().move.mode === 'travel') game.set({ move: { mode: 'foot' } });
  flow.set({ cinematic: null, caption: null, captionSub: null });
  // after the store says 'foot' and the cinematic is gone: the refresher derives the lock from what is still open
  tr.release();
  setView({ active: false, veil: false, to: null });
  // W5-N5 / W5-F7: the follow camera swings in behind the player — toward the landmark of a first sight, else toward
  // the open ground they face (actors/faceOpen: it outranks the camera's own arrival yaw for a moment)
  const at = tr.landed;
  if (at && tr.dest.look) faceCameraToward(tr.dest.look.x, tr.dest.look.z, { uncapped: true, open: true });
  else if (at) faceOpen(at.x, at.z);
  emit({ type: 'travel', what: 'land', to: tr.dest.id });
}

/** Every frame from game/Systems.tsx (right after the cinema step). */
export function stepTravel(dt: number) {
  const tr = trip;
  if (!tr) return;
  const c = tr.clock;
  // W5-N9: the scenic flight flies itself (the autopilot or the player) until it asks to land
  const sc = tr.scenic;
  if (sc && c.phase === 'pan') {
    const r = sc.step(dt, tr.ready);
    const s = cityStreamerLazy();
    if (s) s.focusOverride = sc.focus();
    runtime.camera.shot = { ...sc.shot(dt), duration: 0.001 };
    if (r === 'land' || r === 'here') scenicLand(tr, sc, r === 'here');
    else if (r === 'skip') skipTravel();
    return;
  }
  if (c.phase === 'pan') {
    // the camera flies with the pelican: target along the path
    const p = panPoint(tr.from, tr.dest, c.plan, c.t);
    runtime.camera.shot = { ...topShot(p, heightAt(p.x, p.z), c.plan.yaw), duration: 0.001 };
    // a long trip: the cloud closes in before the cut, so the jump is never seen
    if (c.plan.cloud && c.t > 0.55 && !tr.veil) { tr.veil = true; setView({ ...view, veil: true }); emit({ type: 'travel', what: 'cloud', to: tr.dest.id }); }
  }
  const entered = c.step(dt, tr.ready);
  if (entered === 'done') finish(tr);
  else if (entered) enterPhase(tr, entered);
}
