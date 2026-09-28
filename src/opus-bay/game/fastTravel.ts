import { useSyncExternalStore } from 'react';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { arrivalSpot as openArrivalSpot } from '../actors/nav';
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
  /** facing on arrival (world yaw); default: open ground (lane F's faceOpen, when registered), else the travel direction */
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

export interface TripPlan { d: number; pan: number; cloud: boolean; yaw: number }

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
    return phase === 'pickup' ? PICKUP_S : phase === 'rise' ? RISE_S : phase === 'pan' ? this.plan.pan : phase === 'hold' ? HOLD_MAX_S : DESCENT_S;
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
interface Trip { dest: TravelDest; from: Vec2; clock: TripClock; ready: boolean; landed: Vec2 | null; veil: boolean; release: () => void }
let trip: Trip | null = null;

export function travelActive(): boolean { return trip !== null; }
export function travelEpoch(): number { return epoch; }
/** ?at= teleports and resume also void rides in progress */
export function bumpTravelEpoch() { epoch++; }
export function travelPose(): TravelPose | null {
  return trip ? tripPose(trip.clock, trip.from, trip.landed ?? trip.dest, heightAt) : null;
}

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
export function arrivalSpot(p: Vec2, open: (p: Vec2, r: number) => Vec2 | null = openArrivalSpot): Vec2 {
  const o = cityTerrain() ? open(p, OPEN_ARRIVAL_R) : null;
  if (o) return o;
  if (canStand(p.x, p.z)) return { x: p.x, z: p.z };
  return nearestWalkable(p, 40) ?? { x: p.x, z: p.z };
}

/**
 * W5-N5 · the landing heading: a first sight faces its landmark; else lane F's open-ground facer (`faceOpen(x, z)`,
 * registered with setLandingFacer: the longest free direction, so the first step is never into a wall); else the
 * place's own arrival heading; else the travel direction. Pure (tests).
 */
export function landingHeading(spot: Vec2, dest: Pick<TravelDest, 'heading' | 'look'>, travelYaw: number, facer: LandingFacer | null = landingFacer): number {
  if (dest.look) {
    const dx = dest.look.x - spot.x, dz = dest.look.z - spot.z;
    if (Math.hypot(dx, dz) > 2) return Math.atan2(dx, dz);
  }
  const open = facer?.(spot.x, spot.z);
  if (typeof open === 'number' && Number.isFinite(open)) return open;
  return dest.heading !== undefined && Number.isFinite(dest.heading) ? dest.heading : travelYaw;
}

/** lane F's `faceOpen(x, z)` → a world yaw (null: no preference). */
export type LandingFacer = (x: number, z: number) => number | null | undefined;
let landingFacer: LandingFacer | null = null;
/** Lane F (W5-F7) registers its open-ground facer for every landing (returns the unregister). */
export function setLandingFacer(fn: LandingFacer | null): () => void {
  landingFacer = fn;
  return () => { if (landingFacer === fn) landingFacer = null; };
}

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

/** Start a trip (the caller closed the map and got the player off transit). False when one is running already. */
export function startTravel(dest: TravelDest): boolean {
  if (trip || !Number.isFinite(dest.x) || !Number.isFinite(dest.z)) return false;
  const from = { x: runtime.player.x, z: runtime.player.z };
  // (W5-0b) the trip holds the feet through game/playerLock: a lock re-derived mid-trip (a line's dialogue closing, a
  // ride ending) keeps the rider on the pelican, and the landing's release lets the refresher free them
  trip = { dest, from, clock: new TripClock(planTrip(from, dest)), ready: false, landed: null, veil: false, release: holdLock('travel', dest.id) };
  epoch++;
  game.set({ move: { mode: 'travel' } });
  runtime.player.pathTarget = null;
  flow.set({ cinematic: 'travel', caption: { zh: `飞往 · ${dest.name.zh}`, en: `Flying to ${dest.name.en}` }, captionSub: null, mapTarget: null });
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
  trip.clock.skip();
  enterPhase(trip, trip.clock.phase);
}

function enterPhase(tr: Trip, phase: TravelPhase) {
  const { plan } = tr.clock;
  const s = cityStreamerLazy();
  if (phase === 'rise') {
    const top = topShot(tr.from, heightAt(tr.from.x, tr.from.z), plan.yaw);
    runtime.camera.shot = { ...top, duration: RISE_S };
  } else if (phase === 'pan') {
    if (s) s.focusOverride = { x: tr.dest.x, z: tr.dest.z };
  } else if (phase === 'hold') {
    if (s) s.focusOverride = { x: tr.dest.x, z: tr.dest.z };
    // long trips and a destination still streaming: the cloud hides the jump / the pop-in
    const veil = plan.cloud || !tr.ready;
    if (veil && !tr.veil) { tr.veil = true; setView({ ...view, veil: true }); emit({ type: 'travel', what: 'cloud', to: tr.dest.id }); }
    const top = topShot(tr.dest, heightAt(tr.dest.x, tr.dest.z), plan.yaw);
    runtime.camera.shot = { ...top, duration: veil ? 0.001 : 0.6 };
  } else if (phase === 'descent') {
    const spot = arrivalSpot(tr.dest);
    const heading = landingHeading(spot, tr.dest, plan.yaw);
    tr.landed = spot;
    placePlayer(spot, heading);
    // the top view straight over the landing spot, then down to behind the player (a first sight: its landmark ahead)
    const gy = heightAt(spot.x, spot.z);
    tr.veil = false;
    setView({ ...view, veil: false });
    runtime.camera.shot = { ...descentShot(spot, gy, heading, tr.dest.look), duration: DESCENT_S };
    if (tr.dest.look) flow.set({ caption: { zh: `第一次来 · ${tr.dest.name.zh}`, en: `First time here · ${tr.dest.name.en}` } });
  }
}

function finish(tr: Trip) {
  trip = null;
  const s = cityStreamerLazy();
  if (s) s.focusOverride = null;  // CS-4: never leave the streamer pinned
  runtime.camera.shot = null;
  if (game.get().move.mode === 'travel') game.set({ move: { mode: 'foot' } });
  flow.set({ cinematic: null, caption: null, captionSub: null });
  // after the store says 'foot' and the cinematic is gone: the refresher derives the lock from what is still open
  tr.release();
  setView({ active: false, veil: false, to: null });
  emit({ type: 'travel', what: 'land', to: tr.dest.id });
}

/** Every frame from game/Systems.tsx (right after the cinema step). */
export function stepTravel(dt: number) {
  const tr = trip;
  if (!tr) return;
  const c = tr.clock;
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
