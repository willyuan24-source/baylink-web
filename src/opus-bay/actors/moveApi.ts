import { input } from '../core/input';
import type { Vec2 } from '../core/types';

/**
 * Movement API for UI and flow code (lane E2 owns this file from wave 2; plan E2-0). The ActorSystem binds its
 * MoveSystem at construction (bindMoveApi), so UI / game modules never import the ActorSystem or three.js scene code.
 * Every function is safe before the bind (no-op / neutral answer).
 *
 *   driveTo(p): boolean                 tap-to-drive / 骑车去·开车去 (G1): start the autopilot toward p while riding a
 *                                       bike or the toy car (steady, not boarding / braking); false = not riding /
 *                                       refused. The drive route is fetched asynchronously (district grid, city
 *                                       walking graph with the vehicle's edge filter); events 'vehicle:auto'
 *                                       start / arrive / stuck / cancel. With no way there: a line and no 'start'.
 *   cancelDrive()                       stop the autopilot (any manual input also cancels it)
 *   requestHopOff()                     "提前下车" (HUD button): the same path as Space / pad B in a transit car
 *   toFoot()                            park whatever carries the player (bike, car, pelican, bench) right now
 *   fleetSnapshot(): FleetSnapshot      last-ridden bike (+ id) and the toy car poses when they are away from their
 *                                       spots or ridden, for G1's save v2 ({} when nothing moved).
 *   restoreFleet(s)                     place them back: finite, inside the model, the hull fits (else the nearest
 *                                       fit within 6 u, else skipped); city ground still streaming in is waited for
 *                                       (≤ 60 s); a ridden vehicle is left alone. Call after the player is placed.
 *   glideUnlocked(): boolean            the pelican glide is unlocked (Coit viewpoint or ?debug=1)
 *   setGlideUnlocked(v)                 G1's save v2 restore (unlocked.glide): unlock quietly (no "Unlocked" line, no
 *                                       sound; the pelican model starts loading) or lock again (Settings reset). Safe
 *                                       before the bind: the last value is applied when the ActorSystem binds.
 *   isRiding(): boolean                 carried by anything (bike, car, glide, transit, bench)
 */

export interface FleetSnapshot {
  bike?: { id: string; x: number; z: number; heading: number };
  car?: { x: number; z: number; heading: number };
}

/** What the ActorSystem's MoveSystem provides (actors/moveSystem.ts implements it structurally). */
export interface MoveApiImpl {
  readonly carried: boolean;
  glideUnlocked: boolean;
  setGlideUnlocked?(v: boolean): void;
  toFoot(): void;
  driveTo?(p: Vec2): boolean;
  cancelDrive?(): void;
  fleetSnapshot?(): FleetSnapshot;
  restoreFleet?(s: FleetSnapshot): void;
}

let impl: MoveApiImpl | null = null;
/** a setGlideUnlocked call that came before the bind (resume runs while the world is still mounting) */
let pendingGlide: boolean | null = null;
/** actors/system.ts at construction (and null on dispose). */
export function bindMoveApi(m: MoveApiImpl | null) {
  impl = m;
  if (m && pendingGlide !== null) { applyGlide(m, pendingGlide); pendingGlide = null; }
}
function applyGlide(m: MoveApiImpl, v: boolean) { if (m.setGlideUnlocked) m.setGlideUnlocked(v); else m.glideUnlocked = v; }

export function driveTo(p: Vec2): boolean { return impl?.driveTo?.(p) ?? false; }
export function cancelDrive() { impl?.cancelDrive?.(); }
export function requestHopOff() { input.hopOffCount++; }
export function toFoot() { impl?.toFoot(); }
export function fleetSnapshot(): FleetSnapshot { return impl?.fleetSnapshot?.() ?? {}; }
export function restoreFleet(s: FleetSnapshot) { impl?.restoreFleet?.(s); }
export function glideUnlocked(): boolean { return impl?.glideUnlocked ?? pendingGlide ?? false; }
export function setGlideUnlocked(v: boolean) {
  if (typeof v !== 'boolean') return;
  if (impl) applyGlide(impl, v); else pendingGlide = v;
}
export function isRiding(): boolean { return impl?.carried ?? false; }
