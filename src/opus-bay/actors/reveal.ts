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

/** The reveal plays only for the first on-foot arrival at a T1, never twice, not under reduced motion or quality low. */
export function revealAllowed(o: { tier: number; onFoot: boolean; first: boolean; reducedMotion: boolean; quality: 'low' | 'mid' | 'high'; seen?: boolean }): boolean {
  return o.tier === 1 && o.onFoot && o.first && !o.reducedMotion && o.quality !== 'low' && !o.seen;
}

export interface RevealPlan {
  start: CamPose;
  photo: CamPose;
  end: CamPose;
  /** the arc's centre (the photo target) */
  pivot: V3;
  ground?: (x: number, z: number) => number | null;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });
const smooth = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Plan the reveal from the camera pose now to the photo pose and back to a follow pose behind `player` (feet)
 * looking toward the landmark.
 */
export function planReveal(start: CamPose, photo: CamPose, player: V3, ground?: (x: number, z: number) => number | null): RevealPlan {
  const dx = photo.target.x - player.x, dz = photo.target.z - player.z, d = Math.hypot(dx, dz) || 1;
  const ux = dx / d, uz = dz / d;
  const end: CamPose = {
    pos: { x: player.x - ux * REVEAL.followDist, y: player.y + REVEAL.followHeight, z: player.z - uz * REVEAL.followDist },
    target: { x: player.x + ux * 6, y: player.y + REVEAL.lookHeight + 1.2, z: player.z + uz * 6 },
  };
  return { start, photo, end, pivot: { ...photo.target }, ...(ground ? { ground } : {}) };
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
