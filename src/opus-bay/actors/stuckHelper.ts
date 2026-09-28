import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { canStand, heightAt } from '../core/terrain';
import { moveDisc, type Obstacle } from './controller';
import { openHeading } from './faceOpen';
import { FEET, pullTarget } from './feet';

/**
 * Wave 5 · W5-F5 · BAYBAY's pull (plan sf-w5-plan.md §2 MF2 "BAYBAY pull", D19). A player who has pushed the stick /
 * keys for FEET.pullPush s and moved less than FEET.pullProgress u is stuck on something the eye does not see (a seam,
 * a notch the body does not fit, a lip the feet refuse): BAYBAY runs over, says 嘿咻！ and pulls them ≤ FEET.pullReach u
 * toward the push onto standable ground (feet.pullTarget: never across water, a building, a wall or a fence, never up a
 * cliff or down a drop). R does the same at once when the feet cannot move where the player pushes (or, with no push,
 * toward the most open ground). Every pull emits `stuck { what: 'pull' }` with where it happened (the sweep's list:
 * `__opusBay.actors.feet.pulls` in the game, a DEV console line); a real wall gets no pull and no line.
 *
 * Framework-free (tested in node): actors/system.ts calls `update` every frame before the controller steps, freezes the
 * controller while `active`, adds `lift()` to the player's height after it, dashes BAYBAY over on `start` and says the line.
 */

export interface PullRecord { x: number; z: number; tx: number; tz: number; t: number; reason: 'push' | 'reset' }

export interface StuckInput {
  dt: number;
  now: number;
  /** the player may be helped now: playing, on foot and grounded, nothing open, not carried */
  free: boolean;
  /** a manual push this frame and its world direction (unit) */
  pushing: boolean;
  dirX: number;
  dirZ: number;
  /** R was pressed this frame */
  reset: boolean;
  /** soft obstacles round the player (a parked car, a resident): pushing into one is not being stuck */
  obstacles?: readonly Obstacle[];
  /**
   * (W5-F review) the feet are no longer the player's own: a ride, the pelican, a bench, a fast travel, a restart. A pull
   * in progress stops at once and leaves the player where the new mover put them.
   */
  abort?: boolean;
}

/** what actors/system.ts needs to stage a pull that starts this frame */
export interface PullStart {
  /** where BAYBAY stands to pull (beyond the landing), how long her run takes (s) */
  baybay: { x: number; z: number };
  rush: number;
  to: { x: number; z: number };
}

/** the pull's hop (s) and its height (u); a pull at a spot this many times in PULL_REPEAT_S stops pulling there */
export const PULL_TIME = 0.45, PULL_HOP = 0.35, PULL_REPEAT = 3, PULL_REPEAT_S = 30, PULL_COOLDOWN = 1.5;
/** (W5-F review) the player found this far (u) from where the pull last put them: something else moved them */
export const PULL_MOVED_AWAY = 1;

const ease = (k: number) => k * k * (3 - 2 * k);

/** How far the feet get from (x, z) walking `dist` u toward (dx, dz) (unit), sub-stepped like the controller. */
export function probeReach(x: number, z: number, dx: number, dz: number, dist: number): number {
  let px = x, pz = z;
  for (let d = 0; d < dist - 1e-6; d += 0.2) {
    const r = moveDisc(px, pz, dx * 0.2, dz * 0.2, 0.45, heightAt(px, pz));
    px = r.x; pz = r.z;
  }
  return (px - x) * dx + (pz - z) * dz;
}

export class StuckHelper {
  /** DEV / QA: every pull, newest last (≤ 50) */
  readonly pulls: PullRecord[] = [];
  count = 0;
  phase: 'idle' | 'rush' | 'pull' = 'idle';
  private anchorX = NaN;
  private anchorZ = NaN;
  private pushT = 0;
  private t = 0;
  private rushDur = 0;
  private from = { x: 0, z: 0, y: 0 };
  private to = { x: 0, z: 0, y: 0 };
  private cooldownUntil = -Infinity;
  private clock = 0;
  /** where the pull last left the player (found far from it: somebody else moved them) */
  private lastX = NaN;
  private lastZ = NaN;

  /** a pull is running: the controller waits, the helper places the player */
  get active(): boolean { return this.phase !== 'idle'; }

  /** the hop's lift above the ground this frame (u) */
  lift(): number {
    if (this.phase !== 'pull') return 0;
    const k = Math.min(1, this.t / PULL_TIME);
    return Math.sin(k * Math.PI) * PULL_HOP;
  }

  /** 0..1 through the pull's hop (the animation), 0 otherwise */
  get pullK(): number { return this.phase === 'pull' ? Math.min(1, this.t / PULL_TIME) : 0; }

  /** Drop any pull in progress (a teleport, a ride, the world changing); the player stays where they are. */
  cancel() {
    if (this.phase !== 'idle') this.cooldownUntil = this.clock + PULL_COOLDOWN;
    this.phase = 'idle'; this.pushT = 0; this.anchorX = NaN;
  }

  update(inp: StuckInput): PullStart | null {
    const p = runtime.player;
    this.clock = inp.now;
    if (this.phase !== 'idle') {
      // (W5-F review) the feet were taken over (起飞 while BAYBAY runs over, a vehicle, a fast travel, a restart) or the
      // player was put somewhere else (a teleport, R's own unstick): the pull stops there — before, it went on writing
      // the player's position for up to 1.15 s and dragged them back to the spot they had been taken from
      if (inp.abort || Math.hypot(p.x - this.lastX, p.z - this.lastZ) > PULL_MOVED_AWAY) { this.cancel(); return null; }
      this.advance(inp.dt);
      return null;
    }
    if (!inp.free) { this.pushT = 0; this.anchorX = NaN; return null; }
    let reason: 'push' | 'reset' | null = null;
    let dx = inp.dirX, dz = inp.dirZ;
    if (inp.reset && canStand(p.x, p.z, 0.45 * 0.7)) {
      // R: pull at once when the feet cannot move the way the player pushes (or the most open way)
      if (!inp.pushing) { const h = openHeading(p.x, p.z, p.heading).heading; dx = Math.sin(h); dz = Math.cos(h); }
      if (probeReach(p.x, p.z, dx, dz, 1) < 0.9) reason = 'reset';
    }
    if (!reason) {
      if (!inp.pushing) { this.pushT = 0; this.anchorX = NaN; return null; }
      if (!Number.isFinite(this.anchorX) || Math.hypot(p.x - this.anchorX, p.z - this.anchorZ) >= FEET.pullProgress) {
        this.anchorX = p.x; this.anchorZ = p.z; this.pushT = 0;
        return null;
      }
      this.pushT += inp.dt;
      if (this.pushT < FEET.pullPush || inp.now < this.cooldownUntil) return null;
      this.pushT = 0;
      // leaning on a parked car or a resident is not being stuck
      if (inp.obstacles?.some(o => o.kind !== 'baybay' && Math.hypot(o.x - p.x, o.z - p.z) < o.r + 0.45 + 0.25)) return null;
      reason = 'push';
    }
    // the same spot again and again: stop pulling there (the sweep lists it)
    let near = 0;
    for (const r of this.pulls) if (inp.now - r.t < PULL_REPEAT_S && Math.hypot(r.x - p.x, r.z - p.z) < 3) near++;
    if (near >= PULL_REPEAT) return null;
    const feet = heightAt(p.x, p.z);
    const to = pullTarget(p.x, p.z, feet, dx, dz);
    if (!to) return null;
    return this.begin(to, reason, inp.now);
  }

  private begin(to: { x: number; z: number; y: number }, reason: 'push' | 'reset', now: number): PullStart {
    const p = runtime.player, g = runtime.guide;
    this.from = { x: p.x, z: p.z, y: heightAt(p.x, p.z) };
    this.to = { ...to };
    this.lastX = p.x; this.lastZ = p.z;
    this.count++;
    this.pulls.push({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), tx: +to.x.toFixed(2), tz: +to.z.toFixed(2), t: +now.toFixed(2), reason });
    if (this.pulls.length > 50) this.pulls.shift();
    emit({ type: 'stuck', x: p.x, z: p.z, what: 'pull', source: reason });
    if (import.meta.env?.DEV) console.info(`[opus-bay] BAYBAY pulled the player at ${p.x.toFixed(1)}, ${p.z.toFixed(1)} → ${to.x.toFixed(1)}, ${to.z.toFixed(1)} (${reason})`);
    // BAYBAY stands just beyond the landing, facing back: the player is pulled toward her
    const ux = to.x - p.x, uz = to.z - p.z, L = Math.hypot(ux, uz) || 1;
    const cands = [
      { x: to.x + (ux / L) * 0.95, z: to.z + (uz / L) * 0.95 },
      { x: to.x + (uz / L) * 0.95, z: to.z - (ux / L) * 0.95 },
      { x: to.x - (uz / L) * 0.95, z: to.z + (ux / L) * 0.95 },
    ];
    const baybay = cands.find(c => canStand(c.x, c.z, 0.42)) ?? { x: to.x, z: to.z };
    const run = Math.hypot(baybay.x - g.x, baybay.z - g.z);
    this.rushDur = Math.min(0.7, Math.max(0.25, run / 9));
    this.t = 0;
    this.phase = 'rush';
    return { baybay, rush: this.rushDur, to: { x: to.x, z: to.z } };
  }

  private advance(dt: number) {
    const p = runtime.player;
    this.t += dt;
    if (this.phase === 'rush') {
      if (this.t < this.rushDur) return;
      this.phase = 'pull';
      this.t = 0;
    }
    const k = Math.min(1, this.t / PULL_TIME), e = ease(k);
    p.x = this.from.x + (this.to.x - this.from.x) * e;
    p.z = this.from.z + (this.to.z - this.from.z) * e;
    p.heading = Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z);
    this.lastX = p.x; this.lastZ = p.z;
    if (k >= 1) {
      p.x = this.to.x; p.z = this.to.z;
      this.phase = 'idle';
      this.pushT = 0;
      this.anchorX = NaN;
      // no new push-pull for a moment (the player first tries the new spot)
      this.cooldownUntil = this.clock + PULL_COOLDOWN;
    }
  }
}
