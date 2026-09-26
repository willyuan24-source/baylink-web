import type { MoveSpot } from '../core/store';

/**
 * Moving platforms (plan §6.2): a deck frame travelling through the world — the F-line streetcar today, the ferry and
 * cable cars later. The world module that moves the car publishes its pose every frame (setPlatformPose); the rider
 * lives in the deck's LOCAL frame (a spot, or walking the aisle with DeckWalker) and is written back to world space
 * with toWorld. This replaces pinning the player to the car's side step: the newcomer stands INSIDE the car.
 * Frames follow three.js: heading h faces (sin h, cos h), local +x is the platform's left, y up. Pure (no three).
 */

export interface PlatformPose {
  x: number;
  y: number;
  z: number;
  heading: number;
  /** body roll (rad, + = right side down) */
  roll: number;
}

export interface DeckRect { minX: number; maxX: number; minZ: number; maxZ: number }

export interface PlatformSpot { x: number; z: number; heading: number }

export interface Platform extends PlatformPose {
  id: string;
  /** world velocity (u/s), from successive poses */
  vx: number;
  vz: number;
  /** floor height above the platform origin */
  floor: number;
  /** the walkable aisle in the platform frame (a rider disc stays inside it) */
  deck: DeckRect;
  /** standing at the rail / pole, and the two bench seats (left / right side of the car, facing the aisle) */
  rail: PlatformSpot;
  seatLeft: PlatformSpot;
  seatRight: PlatformSpot;
  /** seat height above the floor */
  seatY: number;
  /** a pose was published in the last ~0.25 s */
  live: boolean;
  /** seconds since the last pose (the owner stopped updating → not live) */
  age: number;
}

export const platforms = new Map<string, Platform>();

/** Register (or re-shape) a platform. The pose starts at the origin, not live, until setPlatformPose is called. */
export function definePlatform(id: string, shape: Pick<Platform, 'floor' | 'deck' | 'rail' | 'seatLeft' | 'seatRight' | 'seatY'>): Platform {
  const prev = platforms.get(id);
  const p: Platform = { id, x: 0, y: 0, z: 0, heading: 0, roll: 0, vx: 0, vz: 0, live: false, age: 99, ...prev, ...shape };
  platforms.set(id, p);
  return p;
}

/** Publish this frame's pose (world module); velocity comes from the previous pose. */
export function setPlatformPose(id: string, pose: PlatformPose, dt: number) {
  const p = platforms.get(id);
  if (!p) return;
  if (p.live && dt > 1e-4) {
    const k = Math.min(1, dt * 12);
    p.vx += ((pose.x - p.x) / dt - p.vx) * k;
    p.vz += ((pose.z - p.z) / dt - p.vz) * k;
  } else { p.vx = 0; p.vz = 0; }
  p.x = pose.x; p.y = pose.y; p.z = pose.z; p.heading = pose.heading; p.roll = pose.roll;
  p.live = true;
  p.age = 0;
}

/** Called once per frame by the reader: a platform whose owner stopped publishing goes stale. */
export function agePlatforms(dt: number) {
  for (const p of platforms.values()) { p.age += dt; if (p.age > 0.25) p.live = false; }
}

/** Platform-local point → world (roll is visual only and ignored here). */
export function toWorld(p: PlatformPose, lx: number, ly: number, lz: number): { x: number; y: number; z: number } {
  const s = Math.sin(p.heading), c = Math.cos(p.heading);
  return { x: p.x + s * lz + c * lx, y: p.y + ly, z: p.z + c * lz - s * lx };
}

/** World point → platform-local (x = its left, z = forward). */
export function toLocal(p: PlatformPose, wx: number, wz: number): { x: number; z: number } {
  const s = Math.sin(p.heading), c = Math.cos(p.heading);
  const dx = wx - p.x, dz = wz - p.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

/** Clamp a rider disc of radius r into the deck rectangle. */
export function clampToDeck(deck: DeckRect, x: number, z: number, r: number): { x: number; z: number } {
  return {
    x: Math.min(deck.maxX - r, Math.max(deck.minX + r, x)),
    z: Math.min(deck.maxZ - r, Math.max(deck.minZ + r, z)),
  };
}

/** The spot for a transit rider: the rail, or the bench on the side away from the camera (facing the aisle). */
export function spotFor(p: Platform, spot: MoveSpot, cameraSide: 1 | -1): PlatformSpot {
  if (spot === 'seat') return cameraSide > 0 ? p.seatRight : p.seatLeft;
  return p.rail;
}

/**
 * The rider on a platform, published by the movement system every frame (local frame of `platform`). Game code that
 * needs the rider's world position while riding (game/ride.ts) reads riderWorld().
 */
export const rider = { platform: null as string | null, x: 0, z: 0, heading: 0, spot: 'rail' as MoveSpot };

export function riderWorld(): { x: number; y: number; z: number; heading: number } | null {
  if (!rider.platform) return null;
  const p = platforms.get(rider.platform);
  if (!p || !p.live) return null;
  const w = toWorld(p, rider.x, p.floor, rider.z);
  return { ...w, heading: p.heading + rider.heading };
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Walking the aisle in the deck frame (camera-relative stick, the controller's accel / decel feel at a calmer 2.4 u/s
 * inside a car). Pure: step() takes the input already expressed in the platform frame.
 */
export class DeckWalker {
  x = 0;
  z = 0;
  heading = 0;
  vx = 0;
  vz = 0;
  speed = 0;
  /** stride phase (steps) for the walk cycle */
  stride = 0;
  static readonly SPEED = 2.4;
  static readonly RADIUS = 0.3;

  place(spot: PlatformSpot) { this.x = spot.x; this.z = spot.z; this.heading = spot.heading; this.vx = this.vz = this.speed = 0; }

  /** mx / my: stick (right / forward), yawLocal: the camera yaw in the platform frame. */
  step(dt: number, mx: number, my: number, yawLocal: number, deck: DeckRect) {
    const m = Math.min(1, Math.hypot(mx, my));
    let tx = 0, tz = 0;
    if (m > 0.05) {
      const fx = -Math.sin(yawLocal), fz = -Math.cos(yawLocal), rx = Math.cos(yawLocal), rz = -Math.sin(yawLocal);
      let wx = rx * mx + fx * my, wz = rz * mx + fz * my;
      const L = Math.hypot(wx, wz) || 1;
      wx /= L; wz /= L;
      tx = wx * DeckWalker.SPEED * m; tz = wz * DeckWalker.SPEED * m;
    }
    const acc = m > 0.05 ? 20 : 26;
    const dvx = tx - this.vx, dvz = tz - this.vz, dv = Math.hypot(dvx, dvz), max = acc * dt;
    if (dv <= max) { this.vx = tx; this.vz = tz; } else { this.vx += (dvx / dv) * max; this.vz += (dvz / dv) * max; }
    const x0 = this.x, z0 = this.z;
    const c = clampToDeck(deck, this.x + this.vx * dt, this.z + this.vz * dt, DeckWalker.RADIUS);
    this.x = c.x; this.z = c.z;
    const moved = Math.hypot(this.x - x0, this.z - z0);
    this.speed = dt > 0 ? moved / dt : 0;
    if (this.speed > 0.3) this.heading = this.heading + wrap(Math.atan2(this.vx, this.vz) - this.heading) * (1 - Math.exp(-12 * dt));
    this.stride += moved / 0.8;
    this.speed = clamp(this.speed, 0, DeckWalker.SPEED);
  }
}
