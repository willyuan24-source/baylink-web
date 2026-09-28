import { runtime } from '../core/runtime';
import { heightAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { inMonths, inYear } from './gates';
import { type EggHost, fx, momentFree, props, reveal, sound } from './hosts';
import { heard } from './listen';
import { eggById } from './registry';

/**
 * Wave 5 · lane D (W5-D4) · Golden Gate Park and the Sunset: egg 16 (the Dahlia Dell: the city flower in bloom from June
 * to October, a small "100" sign all of 2026) and egg 17 (the 16th Avenue Tiled Steps climbed in one go: bubbles, then
 * birds, then star chimes as you go from the sea to the sky).
 */

// --- egg 16 · the dahlia turns 100 -------------------------------------------------------------------------------------

const DAHLIA = 'dahlia-dell-100';
/** In bloom June – October (sfdahlias.org Dahlia Dell, read 2026-09-28). */
export const DAHLIA_MONTHS = [6, 7, 8, 9, 10] as const;
/** The beds (offsets from the dell's spot, u) and their colour families; the "100" sign at the dell's south edge. */
export const DAHLIA_BEDS: readonly { dx: number; dz: number; color: string; heading: number }[] = [
  { dx: -1.7, dz: -0.5, color: '#d6336c', heading: 0.4 },
  { dx: 0.3, dz: 1.6, color: '#e8590c', heading: 1.9 },
  { dx: 1.7, dz: -0.9, color: '#ae3ec9', heading: -0.7 },
];
export const SIGN_100 = { dx: 0.2, dz: -2.2, heading: 0 } as const;
export const OFF_SEASON_LINE: Bilingual = { zh: '大丽花通常六到十月开，现在花圃在休息。', en: 'Dahlias usually bloom June to October — the beds are resting now.' };

export const dahliaInBloom = () => inMonths(DAHLIA_MONTHS);
export const dahliaSignUp = () => inYear(2026);

export function dahliaHost(): EggHost {
  const egg = eggById(DAHLIA)!;
  const c = egg.at;
  let visitDone = false;
  let nextCheck = 0;
  const place = () => {
    const bloom = dahliaInBloom();
    DAHLIA_BEDS.forEach((b, i) => props.set(`egg:${DAHLIA}:bed${i}`, bloom ? { kind: 'dahlias', x: c.x + b.dx, z: c.z + b.dz, heading: b.heading, color: b.color } : null));
    props.set(`egg:${DAHLIA}:sign`, dahliaSignUp() ? { kind: 'sign100', x: c.x + SIGN_100.dx, z: c.z + SIGN_100.dz, heading: SIGN_100.heading } : null);
  };
  place();
  const visit = () => {
    visitDone = true;
    const bloom = dahliaInBloom();
    for (const b of DAHLIA_BEDS) fx('sparkle', c.x + b.dx, heightAt(c.x + b.dx, c.z + b.dz) + 0.7, c.z + b.dz, { count: 6, color: bloom ? b.color : '#9ccf8f' });
    sound('egg:chime', c, { near: 5, far: 30, pitch: 1.12 });
    reveal(DAHLIA, { lines: bloom ? egg.lines : [OFF_SEASON_LINE, ...egg.lines], repeatLine: true, cardDelay: 2.2 });
  };
  return {
    id: DAHLIA,
    range: 40,
    enter: () => { visitDone = false; place(); },
    update: ctx => {
      if (ctx.t >= nextCheck) { nextCheck = ctx.t + 60; place(); }
      if (visitDone || ctx.dist > 4.5 || ctx.busy || runtime.move.mode !== 'foot' || !momentFree()) return;
      visit();
    },
    dispose: () => { DAHLIA_BEDS.forEach((_, i) => props.set(`egg:${DAHLIA}:bed${i}`, null)); props.set(`egg:${DAHLIA}:sign`, null); },
    qa: visit,
  };
}

// --- egg 17 · from the sea to the stars ----------------------------------------------------------------------------------

const STEPS = 'tiled-steps-sea-to-stars';
/** The foot of the stairway at 16th Avenue and its top at 15th Avenue (OSM ways 39333460 … 1526166861, Moraga St). */
export const STEPS_BOTTOM = { x: -115.9, z: 1147 } as const;
export const STEPS_TOP = { x: -109.8, z: 1139.9 } as const;
/** the climb stays within this distance of the stair line (u); the stages: the sea, the sky, the stars */
export const STEPS_LANE = 2.6;
export const STEP_STAGES: readonly { at: number; sound: 'egg:bubbles' | 'egg:birds' | 'egg:stars'; color: string }[] = [
  { at: 0.12, sound: 'egg:bubbles', color: '#7cc6f2' },
  { at: 0.45, sound: 'egg:birds', color: '#ffe08a' },
  { at: 0.76, sound: 'egg:stars', color: '#ffffff' },
];
/** a pause longer than this (s) or stepping back down more than this share of the climb starts it over */
const STEP_PAUSE = 25;
const STEP_BACK = 0.18;

/** Progress along the stair (0 at the foot, 1 at the top) and the distance off its line. */
export function stairProgress(x: number, z: number): { t: number; off: number } {
  const ax = STEPS_TOP.x - STEPS_BOTTOM.x, az = STEPS_TOP.z - STEPS_BOTTOM.z, l2 = ax * ax + az * az;
  const t = ((x - STEPS_BOTTOM.x) * ax + (z - STEPS_BOTTOM.z) * az) / l2;
  const px = STEPS_BOTTOM.x + ax * t, pz = STEPS_BOTTOM.z + az * t;
  return { t, off: Math.hypot(x - px, z - pz) };
}

export function tiledStepsHost(): EggHost {
  let climbing = false;
  let best = 0;
  let stage = 0;
  let pause = 0;
  const reset = () => { climbing = false; best = 0; stage = 0; pause = 0; };
  const stageFx = (i: number) => {
    const s = STEP_STAGES[i], p = runtime.player;
    sound(s.sound);
    fx(i === 0 ? 'rings' : 'sparkle', p.x, p.y + (i === 0 ? 0.6 : 1.9), p.z, { count: i === 0 ? 5 : 10, color: s.color });
  };
  const top = () => {
    reset();
    reveal(STEPS, { repeatLine: true, cardDelay: 1.8 });
    // (part c) the whole crossfade heard, sea to stars: the steps join 城市之声
    heard('tiled-steps');
  };
  return {
    id: STEPS,
    range: 30,
    update: ctx => {
      const { t, off } = stairProgress(ctx.px, ctx.pz);
      const onFoot = runtime.move.mode === 'foot' && !ctx.busy;
      if (!onFoot || off > STEPS_LANE || t < -0.35 || t > 1.3) { reset(); return; }
      if (!climbing) {
        if (t <= 0.1) { climbing = true; best = Math.max(0, t); stage = 0; pause = 0; }
        return;
      }
      if (t > best + 0.01) { best = t; pause = 0; } else pause += ctx.dt;
      if (pause > STEP_PAUSE || t < best - STEP_BACK) { reset(); return; }
      while (stage < STEP_STAGES.length && best >= STEP_STAGES[stage].at) stageFx(stage++);
      if (best >= 0.96 && momentFree()) top();
    },
    leave: reset,
    qa: () => { for (let i = 0; i < STEP_STAGES.length; i++) setTimeout(() => stageFx(i), i * 700); setTimeout(top, 2200); },
  };
}
