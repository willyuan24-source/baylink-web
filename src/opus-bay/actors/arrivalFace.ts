import { onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { LANDMARK_ARRIVALS } from '../data/sf/arrivals';
import { faceCameraToward } from '../game/cinema';
import { vistaHeading } from './reveal';

/**
 * Wave 9 · lane C (W9-C3, review R§5 #15: "飞到双峰默认朝西"): a pelican landing faced the most open ground (W5-F7
 * faceOpen) — on Twin Peaks that is the west slope, while BAYBAY says to look at downtown and the Bay Bridge. When an
 * arrival comes within LANDED_MS of a glide landing (and plays no reveal: a reveal's last beat already turns the camera
 * to the subject), the player and the follow camera turn to the attraction's arrival heading: an overlook's view
 * (actors/reveal REVEAL_VIEWS), a landmark's arrival heading (data/sf/arrivals.ts), else toward the attraction itself.
 * Lazy (game/guideCity imports it; the listener lives from then on).
 */

export const LANDED_MS = 4000;
let landedAt = -Infinity;
let landX = 0, landZ = 0;
onEvent(e => { if (e.type === 'glide:land') { landedAt = performance.now(); landX = e.x; landZ = e.z; } });

/** The heading an arrival at `at` faces (forward = (sin h, cos h)), or null (nothing to face: the attraction is right here). */
export function arrivalHeading(a: { id: string; x: number; z: number; landmarkId?: string }, at: { x: number; z: number }): number | null {
  const vista = vistaHeading(a.id, at);
  if (vista !== null) return vista;
  const lm = a.landmarkId ? LANDMARK_ARRIVALS[a.landmarkId] : undefined;
  if (lm) return lm.heading;
  return Math.hypot(a.x - at.x, a.z - at.z) > 6 ? Math.atan2(a.x - at.x, a.z - at.z) : null;
}

/** Just landed off the pelican (within LANDED_MS, still within 6 u of the landing spot)? */
export function justLanded(now = performance.now()): boolean {
  const p = runtime.player;
  return now - landedAt < LANDED_MS && Math.hypot(p.x - landX, p.z - landZ) < 6;
}

/** After a pelican landing: turn the player and the camera to the arrival's heading. True when it turned. */
export function faceAfterLanding(a: { id: string; x: number; z: number; landmarkId?: string }): boolean {
  if (!justLanded()) return false;
  const p = runtime.player, h = arrivalHeading(a, p);
  if (h === null) return false;
  p.heading = h;
  faceCameraToward(p.x + Math.sin(h) * 12, p.z + Math.cos(h) * 12, { seconds: 0.9, uncapped: true });
  return true;
}

/** tests */
export function __landedForTests(x: number, z: number, at = performance.now()) { landedAt = at; landX = x; landZ = z; }
