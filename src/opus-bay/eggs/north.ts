import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { heightAt } from '../core/terrain';
import { type EggHost, flock, momentFree, reveal, sound } from './hosts';
import type { BirdPath } from './props';
import { eggById } from './registry';

/**
 * Wave 5 · lane D (W5-D3) · North Beach / Telegraph Hill: egg 1, the wild parrots.
 *
 * In the stair gardens on Telegraph Hill (the Filbert steps' garden, OSM "Grace Marchant Garden", snapped to a standable
 * spot of the published city) a flock of green conures sometimes sweeps over while you pass by day (never at night:
 * they roost); stand still there for 4 s and the flock comes down, three perch beside you — the find. Wildlife is never
 * guaranteed (a pass-by fly-over is a coin toss, at most one every 3 minutes).
 */

const EGG = 'telegraph-hill-parrots';
/** stand this still (u/s) this long (s) within STILL_R of the spot */
export const PARROTS_STILL = { r: 12, speed: 0.35, seconds: 4 } as const;
const FLYOVER_GAP = 180;
const FLIGHT_S = 13;

/** The flock: a loose circle over the garden, three birds perch by the player from 4 s to 10.5 s, then all leave. */
export function parrotPath(cx: number, cz: number, gy: number, perch: { x: number; y: number; z: number } | null, n: number): BirdPath {
  const leaveDir = Math.random() * Math.PI * 2;
  return (t, i) => {
    const ph = (i / n) * Math.PI * 2 + (i % 3) * 0.4;
    const R = 7 + (i % 4) * 1.3;
    const circle = (tt: number) => ({
      x: cx + Math.cos(ph + tt * 0.95) * R,
      y: gy + 8 + Math.sin(tt * 2.1 + i) * 0.7 + (i % 2) * 1.2,
      z: cz + Math.sin(ph + tt * 0.95) * R,
    });
    // arrive from afar over 1.6 s
    const arrive = Math.min(1, t / 1.6);
    let pos = circle(t);
    if (arrive < 1) {
      const far = { x: cx + Math.cos(leaveDir + 2.4) * 60, y: gy + 22, z: cz + Math.sin(leaveDir + 2.4) * 60 };
      const k = arrive * arrive * (3 - 2 * arrive);
      pos = { x: far.x + (pos.x - far.x) * k, y: far.y + (pos.y - far.y) * k, z: far.z + (pos.z - far.z) * k };
    }
    let flap = Math.sin(t * 22 + i * 1.7);
    // three perch beside the player
    if (perch && i < 3 && t > 4 && t < 10.5) {
      const spot = { x: perch.x + (i - 1) * 0.55, y: perch.y + (i === 1 ? 0.12 : 0), z: perch.z + (i % 2) * 0.25 };
      const k = Math.min(1, (t - 4) / 1.4);
      const from = circle(4);
      pos = { x: from.x + (spot.x - from.x) * k, y: from.y + (spot.y - from.y) * k, z: from.z + (spot.z - from.z) * k };
      flap = k < 1 ? flap : 0.15 * Math.sin(t * 5 + i);
    }
    // everyone leaves together
    if (t > 10.5) {
      const k = (t - 10.5) * 14;
      pos = { x: pos.x + Math.cos(leaveDir) * k, y: pos.y + (t - 10.5) * 5, z: pos.z + Math.sin(leaveDir) * k };
    }
    const next = circle(t + 0.05);
    const heading = t > 10.5 ? Math.atan2(Math.cos(leaveDir), Math.sin(leaveDir)) : Math.atan2(next.x - pos.x, next.z - pos.z);
    return { ...pos, heading, flap };
  };
}

export function parrotsHost(): EggHost {
  const egg = eggById(EGG)!;
  let still = 0;
  let lastFlight = -Infinity;
  let perchedThisVisit = false;
  const day = () => game.get().timeOfDay !== 'night';
  const fly = (perch: boolean) => {
    const p = runtime.player;
    const gy = heightAt(egg.at.x, egg.at.z);
    // perch on "the branch beside you": a little to the side of the player, at shoulder height
    const side = { x: p.x + Math.cos(runtime.camera.yaw) * 1.8, y: p.y + 1.9, z: p.z - Math.sin(runtime.camera.yaw) * 1.8 };
    flock.start('parrot', 12, FLIGHT_S, parrotPath(egg.at.x, egg.at.z, gy, perch ? side : null, 12));
    sound('egg:parrots', egg.at, { near: 14, far: 90 });
  };
  return {
    id: EGG,
    range: 60,
    enter: ctx => {
      perchedThisVisit = false;
      // a fly-over as you arrive: about half the visits by day, at most one every 3 minutes
      if (day() && ctx.t - lastFlight > FLYOVER_GAP && Math.random() < 0.5 && !flock.active) { fly(false); lastFlight = ctx.t; }
    },
    update: ctx => {
      const p = runtime.player;
      const near = ctx.dist <= PARROTS_STILL.r && runtime.move.mode === 'foot' && p.speed < PARROTS_STILL.speed && !p.pathTarget;
      still = near && !ctx.busy && day() ? still + ctx.dt : 0;
      if (still < PARROTS_STILL.seconds) return;
      still = -8; // not again right away
      // found before: one perching a visit is plenty (a pass-by flight in the air comes down to perch)
      if (!momentFree() || (ctx.found && perchedThisVisit)) return;
      fly(true);
      lastFlight = ctx.t;
      perchedThisVisit = true;
      reveal(EGG, { repeatLine: true, cardDelay: 3.2 });
    },
    leave: () => { still = 0; },
    qa: () => { fly(true); reveal(EGG, { cardDelay: 3.2, repeatLine: true }); },
  };
}
