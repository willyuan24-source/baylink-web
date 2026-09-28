import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { heightAt, surfaceAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import type { Shot } from '../game/cinema';
import { presentToday } from './gates';
import { type EggHost, SEA_Y, beat, flock, fx, momentFree, props, reveal, say, sound } from './hosts';
import { MID } from './marina';
import type { BirdPath } from './props';
import { eggById } from './registry';

/**
 * Wave 5 · lane D (W5-D4) · the west coast: egg 14 (the Lands End labyrinth, there on about 70 % of Bay days: walk to
 * its centre and the camera turns to the Golden Gate) and egg 15 (China Beach at golden hour: three junk-sail
 * silhouettes rise from the water for six seconds — BAYBAY's imagining, 据说).
 */

// --- egg 14 · the labyrinth that comes and goes -----------------------------------------------------------------------

const LAB = 'lands-end-labyrinth';
/** Present on about this share of Bay days (the real one is scattered and rebuilt again and again). */
export const LABYRINTH_SHARE = 0.7;
export const labyrinthToday = (dateKey?: string) => presentToday('labyrinth', LABYRINTH_SHARE, dateKey);
/** reach the centre within this distance (u), having come from outside this one */
export const LAB_CENTRE_R = 0.6;
export const LAB_OUTSIDE_R = 2.8;
export const SCATTERED_LINE: Bilingual = { zh: '今天迷宫好像被弄乱了……希望有人再把它摆好。', en: 'Looks like someone scattered the labyrinth today… I hope it gets rebuilt.' };

export function labyrinthHost(): EggHost {
  const egg = eggById(LAB)!;
  const c = egg.at;
  let present: boolean | null = null;
  let outside = false;
  let scatteredSaid = false;
  let nextCheck = 0;
  const place = () => {
    const now = labyrinthToday();
    if (now === present) return;
    present = now;
    // the rings' opening faces inland (world +x here): local −z turned to +x
    props.set(`egg:${LAB}`, { kind: now ? 'labyrinth' : 'labyrinth-scattered', x: c.x, z: c.z, heading: -Math.PI / 2 });
  };
  place();
  const reach = () => {
    outside = false;
    const gy = heightAt(c.x, c.z);
    sound('egg:chime', c, { near: 4, far: 30 });
    fx('sparkle', c.x, gy + 0.6, c.z, { count: 16, color: '#fff3c4' });
    // from behind, inland and up: the rings in the lower third, the Golden Gate on the horizon (looking ≈ 13° down)
    const dx = MID.x - c.x, dz = MID.z - c.z, l = Math.hypot(dx, dz);
    const ux = dx / l, uz = dz / l;
    const cam: [number, number, number] = [c.x - ux * 11 + uz * 1.5, gy + 6.5, c.z - uz * 11 - ux * 1.5];
    const shots: Shot[] = [{ position: cam, target: [cam[0] + ux * 100, cam[1] - 23, cam[2] + uz * 100], duration: 1.3, hold: 2.6 }];
    const after = () => { reveal(LAB, { repeatLine: true, cardDelay: 1.6 }); };
    if (!beat(shots, after)) after();
  };
  return {
    id: LAB,
    range: 40,
    enter: () => { scatteredSaid = false; outside = false; place(); },
    update: ctx => {
      if (ctx.t >= nextCheck) { nextCheck = ctx.t + 30; place(); }
      if (!present) {
        if (!scatteredSaid && ctx.dist <= 5 && !ctx.busy && momentFree()) { scatteredSaid = true; say(SCATTERED_LINE); }
        return;
      }
      if (ctx.dist > LAB_OUTSIDE_R) { outside = true; return; }
      if (ctx.dist <= LAB_CENTRE_R && outside && runtime.move.mode === 'foot' && momentFree()) reach();
    },
    dispose: () => { props.set(`egg:${LAB}`, null); present = null; },
    qa: reach,
  };
}

// --- egg 15 · China Beach at golden hour ------------------------------------------------------------------------------

const CHINA = 'china-beach-fishermen';
/**
 * Where the three silhouettes rise (open water off the cove, checked in the published city), broadside to the lawn: the
 * hulls lie across the view from the benches (≈ west), so the sails show their full shape.
 */
export const JUNKS: readonly { x: number; z: number; heading: number }[] = [
  { x: -652, z: 950, heading: -0.05 },
  { x: -665, z: 964, heading: -0.2 },
  { x: -648, z: 977, heading: 0.08 },
];
const JUNK_MID = { x: JUNKS.reduce((s, j) => s + j.x, 0) / JUNKS.length, z: JUNKS.reduce((s, j) => s + j.z, 0) / JUNKS.length };
export const JUNK_S = 6.4;
export const IMAGINED_LINE: Bilingual = { zh: '这些帆影只是我的想象哦。', en: 'Those sails are only my imagining.' };
/** a showing waits this long after the last one (s) */
const CHINA_GAP = 90;

/** Rise from the water (1.2 s), bob, sink back (from 4.8 s): six seconds of old sails. */
export function junkPath(): BirdPath {
  return (t, i) => {
    const j = JUNKS[i];
    if (!j) return null;
    const rise = Math.min(1, t / 1.2), sink = Math.max(0, (t - 4.8) / 1.6);
    const y = SEA_Y - 3.4 * (1 - rise * rise * (3 - 2 * rise)) - 3.6 * sink * sink + Math.sin(t * 1.3 + i) * 0.08;
    const drift = t * 0.6;
    return { x: j.x + Math.sin(j.heading) * drift, y, z: j.z + Math.cos(j.heading) * drift, heading: j.heading, flap: 0, pitch: Math.sin(t * 0.9 + i * 2) * 0.03 };
  };
}

export const isGolden = () => game.get().timeOfDay === 'golden';
/**
 * Where the cove is watched from: the lawn above it (the site's benches look over the cove: the egg's spot) within
 * LAWN_R, or the sand below (the published city's sand strip is cut off from the stairway today, so the lawn is the
 * spot a player can always reach).
 */
export const LAWN_R = 5;
export const SAND_R = 24;
export function watchingCove(x: number, z: number, at: { x: number; z: number } = eggById(CHINA)!.at): boolean {
  const d = Math.hypot(x - at.x, z - at.z);
  return d <= LAWN_R || (d <= SAND_R && surfaceAt(x, z) === 'sand');
}

export function chinaBeachHost(): EggHost {
  const egg = eggById(CHINA)!;
  let shownThisVisit = false;
  let lastShow = -Infinity;
  const show = () => {
    shownThisVisit = true;
    flock.start('junk', JUNKS.length, JUNK_S, junkPath());
    sound('egg:sails', JUNKS[1], { near: 20, far: 120 });
    for (const j of JUNKS) fx('splash', j.x, SEA_Y + 0.2, j.z, { count: 8, scale: 1.2 });
    // a look out over the cove from just behind the player while the sails stand (≈ 4.5 s), then the feet come back
    const p = runtime.player;
    const dx = JUNK_MID.x - p.x, dz = JUNK_MID.z - p.z, l = Math.hypot(dx, dz) || 1;
    const looked = beat([{ position: [p.x - (dx / l) * 2.5, p.y + 4.6, p.z - (dz / l) * 2.5], target: [JUNK_MID.x, SEA_Y + 2, JUNK_MID.z], duration: 1.1, hold: 3.4 }]);
    // (the card waits for the look to end: under the letterbox it would be cut)
    reveal(CHINA, { lines: [egg.lines[0], IMAGINED_LINE], repeatLine: true, cardDelay: looked ? 4.8 : 3 });
  };
  return {
    id: CHINA,
    range: 60,
    enter: () => { shownThisVisit = false; },
    update: ctx => {
      if (shownThisVisit || ctx.dist > SAND_R || ctx.busy || ctx.t - lastShow < CHINA_GAP) return;
      if (runtime.move.mode !== 'foot' || !isGolden() || !watchingCove(ctx.px, ctx.pz, egg.at) || !momentFree()) return;
      lastShow = ctx.t;
      show();
    },
    qa: show,
  };
}
