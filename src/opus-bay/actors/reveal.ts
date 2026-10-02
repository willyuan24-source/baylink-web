/**
 * Wave 4 · the arrival reveal camera (lane G, W4-G10; plan sf-w4-plan.md §4.2 "Arrival moments"): the first time the
 * player arrives on foot at a T1 attraction, the camera swings out to the landmark's photo pose (SfLandmarkInfo.photo),
 * holds with a slow push-in, and comes back behind the player facing the landmark — 2.4 s, skippable, never replayed,
 * off under reduced motion and at quality low. Pure math (no three.js, no store): the camera rig (actors/camera.ts)
 * reads `RevealClock.pose` in the integration phase; `revealShots` gives the same beats as game/cinema.ts shots for a
 * rig that only eases between poses.
 *
 *   0.0–1.0 s  swing: an arc round the photo target (bearing, radius and height eased together, a small lift in the
 *              middle so it never skims the roofs), the look point sliding from the player's head to the photo target
 *   1.0–1.8 s  hold: the photo pose with a 4 % push-in
 *   1.8–2.4 s  back: to the follow pose behind the player, looking past the player at the landmark
 * The camera stays ≥ 2 u above the ground under it (`ground`, when known).
 */

import { forEachBlockerNear, type Blocker } from '../core/terrain';
import { canopySource } from './cameraModes';

export interface V3 { x: number; y: number; z: number }
export interface CamPose { pos: V3; target: V3 }
/** SfLandmarkInfo.photo: target in the landmark's local frame (front +z), distance, elevation and bearing (rad). */
export interface PhotoSpec { target: readonly [number, number, number]; distance: number; elevation: number; bearing: number }
/** The landmark's frame in the world: origin (x, baseY, z) and yaw (world/sf/landmarks landmarkMatrix). */
export interface SiteFrame { x: number; y: number; z: number; yaw: number }

export const REVEAL = {
  seconds: 2.4,
  swing: 1.0,
  hold: 0.8,
  back: 0.6,
  /** push-in over the hold (share of the distance) */
  push: 0.04,
  /** clearance over the ground (u) */
  clear: 2,
  /** the follow pose it hands back to: distance behind the player, height over the player's feet, look height */
  followDist: 11,
  followHeight: 4.6,
  lookHeight: 1.6,
  /** the arc's lift: share of the larger radius, capped (u) */
  lift: 0.12,
  liftMax: 20,
} as const;

/** The photo pose in the world (the SoloView formula, rotated into the site's frame). */
export function photoPose(site: SiteFrame, photo: PhotoSpec): CamPose {
  const c = Math.cos(site.yaw), s = Math.sin(site.yaw);
  const [tx, ty, tz] = photo.target;
  // local → world: x' = x c + z s, z' = −x s + z c (landmarkToWorld)
  const target = { x: site.x + tx * c + tz * s, y: site.y + ty, z: site.z - tx * s + tz * c };
  const b = photo.bearing, e = photo.elevation, d = photo.distance;
  const lx = Math.sin(b) * Math.cos(e) * d, ly = Math.sin(e) * d, lz = Math.cos(b) * Math.cos(e) * d;
  return { pos: { x: target.x + lx * c + lz * s, y: target.y + ly, z: target.z - lx * s + lz * c }, target };
}

/**
 * The reveal plays only for the first on-foot arrival at a T1, never twice, not at quiet places, not under reduced
 * motion or quality low (the same rule as lane C's game/arrival.ts arrivalBeats().reveal, which the Overlay follows).
 */
export function revealAllowed(o: { tier: number; onFoot: boolean; first: boolean; reducedMotion: boolean; quality: 'low' | 'mid' | 'high'; seen?: boolean; quiet?: boolean }): boolean {
  return o.tier === 1 && o.onFoot && o.first && !o.reducedMotion && o.quality !== 'low' && !o.seen && !o.quiet;
}

export interface RevealPlan {
  start: CamPose;
  photo: CamPose;
  end: CamPose;
  /** the arc's centre (the photo target; W9-C3: the player for a vista) */
  pivot: V3;
  ground?: (x: number, z: number) => number | null;
}

/**
 * (W9-C3) What blocks the line from a camera at a to the subject at b: a weight, 0 when clear (the world's: `revealSight`
 * — street-tree canopies and building tops; tests inject their own).
 */
export type SightTest = (a: V3, b: V3) => number;

/**
 * (W9-C3, review R§5 #15: the Painted Ladies' reveal had a cone tree dead centre) A photo pose whose line to its target is
 * blocked turns round the target a little (±0.14 rad steps up to ±0.56), then rises (+0.08 rad) and comes in (0.75 ×): the
 * first clear pose in that order (the least change), else the least blocked. Pure.
 */
export function clearPhotoPose(photo: CamPose, sight: SightTest, ground?: (x: number, z: number) => number | null): CamPose {
  const w0 = sight(photo.pos, photo.target);
  if (w0 <= 0) return photo;
  const t = photo.target, dx = photo.pos.x - t.x, dy = photo.pos.y - t.y, dz = photo.pos.z - t.z;
  const r = Math.hypot(dx, dz), d = Math.hypot(r, dy), b0 = Math.atan2(dx, dz), e0 = Math.atan2(dy, r);
  let best = photo, bestW = w0;
  for (const [db, de, k] of CLEAR_STEPS) {
    const b = b0 + db, e = e0 + de, dd = d * k;
    const pos = { x: t.x + Math.sin(b) * Math.cos(e) * dd, y: t.y + Math.sin(e) * dd, z: t.z + Math.cos(b) * Math.cos(e) * dd };
    const g = ground?.(pos.x, pos.z);
    if (g !== null && g !== undefined && pos.y < g + REVEAL.clear) pos.y = g + REVEAL.clear;
    const w = sight(pos, t);
    if (w <= 0) return { pos, target: { ...t } };
    if (w < bestW) { bestW = w; best = { pos, target: { ...t } }; }
  }
  return best;
}
/**
 * (W9-C3) The world's sight test for a reveal's photo line from the camera `a` to the subject `b`: a street tree's canopy
 * across the line or within ≈ 9° of the lens (world/sf/props.ts segmentCanopy from the subject's end, the first quarter
 * — at most 6 u — next to the subject left out: a landmark among trees) weighs 3; each sample of the line's camera-side
 * 70 % under a building's top (Blocker.top: city buildings, landmarks — the subject's own walls sit in the rest) weighs 1.
 */
export function revealSight(a: V3, b: V3): number {
  let w = 0;
  const len = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const trees = canopySource();
  if (trees && trees.segmentCanopy(b.x, b.y, b.z, a.x, a.y, a.z, Math.min(6, len * 0.25), 0.16) >= 0) w += 3;
  const n = Math.max(8, Math.ceil(len / 1.5));
  for (let i = 1; i <= n * 0.7; i++) {
    const k = i / n;
    sightY = a.y + (b.y - a.y) * k; sightHit = false;
    forEachBlockerNear(a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k, 0.3, underTop);
    if (sightHit) w++;
  }
  return w;
}
// (revealSight's blocker test writes here: module state, no closure per sample)
let sightY = 0, sightHit = false;
const underTop = (o: Blocker) => { if (o.top !== undefined && sightY < o.top) sightHit = true; };

/** (bearing offset, elevation offset, distance factor) in the order clearPhotoPose tries them */
const CLEAR_STEPS: readonly (readonly [number, number, number])[] = (() => {
  const out: [number, number, number][] = [];
  for (const k of [1, 2, 3, 4]) out.push([0.14 * k, 0, 1], [-0.14 * k, 0, 1]);
  for (const db of [0, 0.14, -0.14, 0.28, -0.28]) out.push([db, 0.08, 1]);
  for (const db of [0, 0.14, -0.14]) out.push([db, 0.08, 0.75]);
  return out;
})();

/**
 * (W9-C3, review R§5 #15) Reveals for attractions the landmark photo poses do not serve: an overlook's reveal looks out
 * at its view (`vista`: the world point it looks toward — Twin Peaks' BAYBAY line names downtown and the Bay Bridge, so
 * Salesforce Tower at the head of Market St), and Coit Tower (a district landmark with no photo pose) gets one of the
 * tower itself (`subject`). World units; the district's landmark positions (data/district: Salesforce (166, 108), Coit
 * (−50.25, 51.1) on its 20 u hill) and the Golden Gate Bridge's two towers' midpoint for Lands End.
 */
export interface RevealView {
  /** an overlook: the point the view looks toward (x, z) */
  vista?: { x: number; z: number };
  /** a subject: its target (world), the camera's bearing from it (rad, world: camera at target + (sin, cos)·d), distance, elevation */
  subject?: { target: V3; bearing: number; distance: number; elevation: number };
}
const DOWNTOWN = { x: 166, z: 108 };
export const REVEAL_VIEWS: Readonly<Record<string, RevealView>> = {
  'twin-peaks': { vista: DOWNTOWN },
  'mount-davidson': { vista: DOWNTOWN },
  'bernal-heights-park': { vista: DOWNTOWN },
  'corona-heights-randall-museum': { vista: DOWNTOWN },
  'lands-end': { vista: { x: -865, z: 508 } },
  // (the camera west of the tower, over the hill's shoulder, looking east: the tower against the Bay and the Bay Bridge)
  'coit-tower': { subject: { target: { x: -50.25, y: 29, z: 51.1 }, bearing: -1.6, distance: 34, elevation: 0.1 } },
};
/** a vista's photo pose: this far behind the player (u), this high over their feet, looking this far out and down */
export const VISTA = { back: 13, up: 7, far: 150, drop: 14 } as const;

/**
 * The photo pose and the arc's pivot for an attraction in REVEAL_VIEWS (null otherwise): a vista's pose stands behind the
 * player on the line to the view, over them, looking out and a little down at the city; its arc turns round the player
 * (a pivot 150 u out would sweep the camera across the sky). A subject's is its own photo pose round the target.
 */
export function revealView(id: string, player: V3): { photo: CamPose; pivot?: V3 } | null {
  const v = REVEAL_VIEWS[id];
  if (!v) return null;
  if (v.subject) {
    const s = v.subject, c = Math.cos(s.elevation) * s.distance;
    return { photo: { pos: { x: s.target.x + Math.sin(s.bearing) * c, y: s.target.y + Math.sin(s.elevation) * s.distance, z: s.target.z + Math.cos(s.bearing) * c }, target: { ...s.target } } };
  }
  if (!v.vista) return null;
  const dx = v.vista.x - player.x, dz = v.vista.z - player.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
  return {
    photo: {
      pos: { x: player.x - ux * VISTA.back, y: player.y + VISTA.up, z: player.z - uz * VISTA.back },
      target: { x: player.x + ux * VISTA.far, y: player.y + VISTA.up - VISTA.drop, z: player.z + uz * VISTA.far },
    },
    pivot: { ...player },
  };
}

/** (W9-C3) The heading an arrival here faces (forward = (sin h, cos h)): toward an overlook's view, else null. */
export function vistaHeading(id: string, at: { x: number; z: number }): number | null {
  const v = REVEAL_VIEWS[id]?.vista;
  return v ? Math.atan2(v.x - at.x, v.z - at.z) : null;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });
const smooth = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Plan the reveal from the camera pose now to the photo pose and back to a follow pose behind `player` (feet)
 * looking toward the landmark.
 */
export function planReveal(start: CamPose, photo: CamPose, player: V3, ground?: (x: number, z: number) => number | null, opts: { pivot?: V3; sight?: SightTest } = {}): RevealPlan {
  // (W9-C3) a photo line through a tree or a roof turns / rises / comes in to a clear one (the vista's arc round the player)
  if (opts.sight) photo = clearPhotoPose(photo, opts.sight, ground);
  const dx = photo.target.x - player.x, dz = photo.target.z - player.z, d = Math.hypot(dx, dz) || 1;
  const ux = dx / d, uz = dz / d;
  const end: CamPose = {
    pos: { x: player.x - ux * REVEAL.followDist, y: player.y + REVEAL.followHeight, z: player.z - uz * REVEAL.followDist },
    target: { x: player.x + ux * 6, y: player.y + REVEAL.lookHeight + 1.2, z: player.z + uz * 6 },
  };
  return (lastPlan = { start, photo, end, pivot: { ...(opts.pivot ?? photo.target) }, ...(ground ? { ground } : {}) });
}
/** the last plan (QA: `__opusBay.reveal.last()`) */
let lastPlan: RevealPlan | null = null;
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  const w = window as unknown as { __opusBay?: Record<string, unknown> };
  w.__opusBay = { ...(w.__opusBay ?? {}), reveal: { last: () => lastPlan, revealSight, clearPhotoPose, revealView, photoPose } };
}

/** The swing's point at k ∈ [0, 1]: bearing, radius and height round the pivot eased together, plus the lift. */
function swingPos(plan: RevealPlan, k: number): V3 {
  const p = plan.pivot, a = plan.start.pos, b = plan.photo.pos;
  const ba = Math.atan2(a.x - p.x, a.z - p.z), bb = Math.atan2(b.x - p.x, b.z - p.z);
  const ra = Math.hypot(a.x - p.x, a.z - p.z), rb = Math.hypot(b.x - p.x, b.z - p.z);
  const ang = ba + wrap(bb - ba) * k, r = lerp(ra, rb, k);
  const lift = Math.min(REVEAL.liftMax, REVEAL.lift * Math.max(ra, rb)) * Math.sin(Math.PI * k);
  return { x: p.x + Math.sin(ang) * r, y: lerp(a.y, b.y, k) + lift, z: p.z + Math.cos(ang) * r };
}

function clearGround(plan: RevealPlan, pos: V3): V3 {
  const g = plan.ground?.(pos.x, pos.z);
  return g === null || g === undefined || pos.y >= g + REVEAL.clear ? pos : { ...pos, y: g + REVEAL.clear };
}

/** The camera pose t seconds into the reveal (clamped to [0, 2.4]). */
export function revealPose(plan: RevealPlan, t: number): CamPose {
  const { swing, hold, back } = REVEAL;
  if (t <= swing) {
    const k = smooth(t / swing);
    return { pos: clearGround(plan, swingPos(plan, k)), target: lerp3(plan.start.target, plan.photo.target, k) };
  }
  if (t <= swing + hold) {
    const k = smooth((t - swing) / hold);
    const pos = lerp3(plan.photo.pos, plan.photo.target, REVEAL.push * k);
    return { pos: clearGround(plan, pos), target: plan.photo.target };
  }
  const k = smooth((t - swing - hold) / back);
  const from = lerp3(plan.photo.pos, plan.photo.target, REVEAL.push);
  return { pos: clearGround(plan, lerp3(from, plan.end.pos, k)), target: lerp3(plan.photo.target, plan.end.target, k) };
}

/** The reveal's clock: step(dt) → the pose; skip() jumps to the way back (the last 0.6 s); `done` after 2.4 s. */
export class RevealClock {
  readonly plan: RevealPlan;
  t = 0;
  constructor(plan: RevealPlan) { this.plan = plan; }
  step(dt: number): CamPose { this.t = Math.min(REVEAL.seconds, this.t + Math.max(0, dt)); return this.pose; }
  skip() { this.t = Math.max(this.t, REVEAL.swing + REVEAL.hold); }
  get done(): boolean { return this.t >= REVEAL.seconds; }
  get pose(): CamPose { return revealPose(this.plan, this.t); }
}

/** The same beats as game/cinema.ts shots (position, target, duration, hold): for a rig that eases between poses. */
export function revealShots(plan: RevealPlan): { position: [number, number, number]; target: [number, number, number]; duration: number; hold?: number }[] {
  const arr = (v: V3): [number, number, number] => [v.x, v.y, v.z];
  const mid = revealPose(plan, REVEAL.swing / 2);
  const held = revealPose(plan, REVEAL.swing + REVEAL.hold);
  return [
    { position: arr(mid.pos), target: arr(mid.target), duration: REVEAL.swing / 2 },
    { position: arr(plan.photo.pos), target: arr(plan.photo.target), duration: REVEAL.swing / 2 },
    { position: arr(held.pos), target: arr(held.target), duration: REVEAL.hold },
    { position: arr(plan.end.pos), target: arr(plan.end.target), duration: REVEAL.back },
  ];
}
