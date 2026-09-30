import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Vec2 } from '../core/types';
import { registerFrameSystem } from '../game/systemsRegistry';
import { U } from '../world/materials';
import { currentActivity } from './kit';
import { freeOnFoot } from './partc';

/**
 * Wave 7 · lane W2 · where 放风筝 is offered and Marina Green's ambient kites (a small lazy chunk play/kiteEntry.ts loads
 * at init, so the play core stays small):
 *   - kiteHere(): 问 BAYBAY → 放风筝 (play/kite.ts, its own chunk) on the Marina Green lawn and the Crissy Field lawn, on
 *     foot, in free roam, with no other activity running;
 *   - startKiteZone(): the ambient kites (play/kites.ts, its own chunk) mounted while the player is within KITES_NEAR u
 *     of Marina Green by day, dropped beyond KITES_FAR or at night (checked once a second).
 */

/** Marina Green's lawn (the city's park rings: a strip along Marina Blvd), a capsule round its midline */
export const MARINA_STRIP = { a: { x: -360.3, z: 269.9 }, b: { x: -403.6, z: 331.8 }, r: 6 } as const;
/** Crissy Field's big lawn (the old airfield: the city's park ring in chunk −5_4, simplified) */
export const CRISSY_LAWN: readonly Vec2[] = [
  [-527.7, 531.8], [-526.9, 528], [-528.5, 519.7], [-532.9, 515.5], [-539.8, 513.4], [-544.6, 514.3], [-551.3, 518.8],
  [-568.6, 539.5], [-583.1, 553.3], [-599.6, 563.4], [-617.1, 566], [-631, 566.4], [-626.2, 569.9], [-608, 578.5],
  [-597.2, 581], [-590.9, 580.9], [-574.4, 569.5],
].map(([x, z]) => ({ x, z }));
export const KITES_NEAR = 240, KITES_FAR = 280;
const MARINA_MID = { x: (MARINA_STRIP.a.x + MARINA_STRIP.b.x) / 2, z: (MARINA_STRIP.a.z + MARINA_STRIP.b.z) / 2 };

function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}
function inPoly(p: Vec2, poly: readonly Vec2[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
}

/** Is (x, z) on a kite lawn (Marina Green or Crissy Field)? */
export function onKiteLawn(p: Vec2): boolean {
  return segDist(p, MARINA_STRIP.a, MARINA_STRIP.b) <= MARINA_STRIP.r || inPoly(p, CRISSY_LAWN);
}

/** 放风筝 may start now. */
export function kiteHere(): boolean {
  return freeOnFoot() && !currentActivity() && game.get().mode === 'free' && onKiteLawn(runtime.player);
}

export function startKiteZone(): () => void {
  let gone = false, mounted: (() => void) | null = null, loading = false, acc = 1;
  const offFrame = registerFrameSystem('w2-kites-near', dt => {
    acc += dt;
    if (acc < 1) return;
    acc = 0;
    const p = runtime.player, d = Math.hypot(p.x - MARINA_MID.x, p.z - MARINA_MID.z), day = U.uNight.value <= 0.35;
    if (!mounted && !loading && day && d < KITES_NEAR) {
      loading = true;
      void import('./kites').then(m => { loading = false; if (!gone && !mounted) mounted = m.mountKites(); }).catch(() => { loading = false; });
    } else if (mounted && (!day || d > KITES_FAR)) { mounted(); mounted = null; }
  });
  return () => { gone = true; offFrame(); mounted?.(); mounted = null; };
}
