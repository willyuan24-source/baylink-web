import { runtime } from '../core/runtime';
import { heightAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { bayParts } from '../game/bayNow';
import type { Shot } from '../game/cinema';
import { KARL } from '../world/fogShader';
import { onDay } from './gates';
import { type EggHost, beat, fx, hostClock, momentFree, props, reveal, say, sound } from './hosts';
import { eggById } from './registry';

/**
 * Wave 5 · lane D (W5-D4) · the Mission, the Castro and Twin Peaks: egg 18 (Karl the Fog seen from the summit, with the
 * month's words), egg 20 (the Golden Fire Hydrant at 20th and Church, repainted every 18 April at dawn) and egg 21
 * (rainbow footprints after the Castro's rainbow crosswalks).
 */

// --- egg 18 · Karl's secrets on Twin Peaks ------------------------------------------------------------------------------

const KARL_EGG = 'karl-the-fog-diary';
/** Sutro Tower (the attraction's spot) and its antenna tips (world y, toy height). */
export const SUTRO = { x: 73.2, z: 973.7, y: 58 } as const;
/**
 * Karl is in when his bank is up and reaches the west slopes (the morning and golden-hour layouts of world/sf/fog.ts):
 * from the summit (≈ 55 u, above the fog top of 32–40) his white bank lies over the Sunset behind Sutro Tower (seen in
 * the game: the bank stands behind the tower, not round its legs — the line says what the view shows).
 */
export const karlIn = (): boolean => KARL.uKarl.value >= 0.5 && KARL.uKarlA.value.x >= 350;
export const SUTRO_LINE: Bilingual = { zh: '看！Karl 从海那边漫过来了，苏特罗塔在前面站岗。', en: 'Look! Karl is rolling in from the sea, with Sutro Tower standing guard.' };
/** July is usually the foggiest month (sfbayweather.com, read 2026-09-28). */
export const SUMMER_LINE: Bilingual = { zh: '夏天 Karl 来得最勤，七月通常最浓。', en: 'Karl visits most in summer — July is usually the thickest.' };
export const AWAY_LINE: Bilingual = { zh: 'Karl 今天好像请假了……早上或傍晚再上来看看吧。', en: 'Looks like Karl took the day off… come back up in the morning or at dusk.' };
/** stand still on the summit this long (s) within this distance (u) */
export const SUMMIT = { r: 16, seconds: 2.5, speed: 0.5 } as const;

/** The month's words when Karl is away: Sep–Oct "Karl often takes time off"; else "come back morning or dusk". */
export function karlAwayLine(month = bayParts().month): Bilingual {
  return month === 9 || month === 10 ? eggById(KARL_EGG)!.lines[1] : AWAY_LINE;
}
/** The find's lines with Karl in: the tower above him, his name, (summer) his season, the quip that is not Twain's. */
export function karlFogLines(month = bayParts().month): Bilingual[] {
  const egg = eggById(KARL_EGG)!;
  return [SUTRO_LINE, egg.lines[0], ...(month >= 6 && month <= 8 ? [SUMMER_LINE] : []), egg.lines[2]];
}

export function karlHost(): EggHost {
  let still = 0;
  let awaySaid = false;
  let doneThisVisit = false;
  const look = () => {
    doneThisVisit = true;
    const p = runtime.player;
    // from behind and above the player, over the white sea to Sutro Tower's tips
    const dx = SUTRO.x - p.x, dz = SUTRO.z - p.z, l = Math.hypot(dx, dz) || 1;
    const shots: Shot[] = [{ position: [p.x - (dx / l) * 6, p.y + 3.4, p.z - (dz / l) * 6], target: [SUTRO.x, SUTRO.y - 8, SUTRO.z], duration: 1.4, hold: 2.4 }];
    const after = () => { reveal(KARL_EGG, { lines: karlFogLines(), repeatLine: true, cardDelay: 2.4 }); };
    if (!beat(shots, after)) after();
  };
  return {
    id: KARL_EGG,
    range: 60,
    enter: () => { still = 0; awaySaid = false; doneThisVisit = false; },
    update: ctx => {
      const p = runtime.player;
      const near = ctx.dist <= SUMMIT.r && runtime.move.mode === 'foot' && p.speed < SUMMIT.speed && !p.pathTarget;
      still = near && !ctx.busy ? still + ctx.dt : 0;
      if (still < SUMMIT.seconds || doneThisVisit || !momentFree()) return;
      still = 0;
      if (karlIn()) { look(); return; }
      if (!awaySaid) { awaySaid = true; say(karlAwayLine()); }
    },
    qa: look,
  };
}

// --- egg 20 · the Golden Fire Hydrant ------------------------------------------------------------------------------------

const HYDRANT = 'golden-hydrant-1906';
/** OSM node 3989015890 ("The Golden Fire Hydrant", 20th & Church), on the pavement's edge. */
export const HYDRANT_AT = { x: 255.3, z: 724.3 } as const;
export const TODAY_18_LINE: Bilingual = { zh: '今天就是 4 月 18 日！看，有人在给它刷金漆。', en: 'It’s 18 April today! Look — someone’s giving it fresh gold paint.' };
/** the anniversary morning: 18 April, 05:00–09:00 Bay time (the repainting, en.wikipedia.org/wiki/Golden_Fire_Hydrant) */
export const paintMorning = () => onDay(4, 18, 5, 9);

export function hydrantHost(): EggHost {
  const egg = eggById(HYDRANT)!;
  props.set(`egg:${HYDRANT}`, { kind: 'hydrant', x: HYDRANT_AT.x, z: HYDRANT_AT.z, heading: 0.8 });
  let nextGlint = 0;
  let nextStroke = 0;
  let brushA = 0;
  let nextBrush = 0;
  const top = () => ({ x: HYDRANT_AT.x, y: heightAt(HYDRANT_AT.x, HYDRANT_AT.z) + 0.8, z: HYDRANT_AT.z });
  const look = () => {
    const t = top();
    sound('egg:ting', HYDRANT_AT, { near: 4, far: 30 });
    fx('sparkle', t.x, t.y, t.z, { count: 14, color: '#ffd966' });
    reveal(HYDRANT, { lines: paintMorning() ? [egg.lines[0], TODAY_18_LINE] : egg.lines, repeatLine: true, cardDelay: 2 });
  };
  return {
    id: HYDRANT,
    range: 30,
    update: ctx => {
      const painting = paintMorning();
      // the brush goes round the hydrant on the anniversary morning, else it is not there
      if (painting) {
        brushA += ctx.dt * 1.4;
        // (2 Hz: each move rebuilds the pool's merged geometry)
        if (ctx.t >= nextBrush) { nextBrush = ctx.t + 0.5; props.set(`egg:${HYDRANT}:brush`, { kind: 'brush', x: +(HYDRANT_AT.x + Math.sin(brushA) * 0.32).toFixed(2), z: +(HYDRANT_AT.z + Math.cos(brushA) * 0.32).toFixed(2), heading: +(brushA + Math.PI).toFixed(2), y: heightAt(HYDRANT_AT.x, HYDRANT_AT.z) + 0.25 }); }
        if (ctx.t >= nextStroke && ctx.dist < 14) { nextStroke = ctx.t + 2.2; sound('egg:brush', HYDRANT_AT, { near: 4, far: 24 }); }
      } else props.set(`egg:${HYDRANT}:brush`, null);
      // it glints gold now and then
      if (ctx.t >= nextGlint && ctx.dist < 25) {
        nextGlint = ctx.t + (painting ? 0.8 : 3.2);
        const t = top();
        fx('sparkle', t.x, t.y, t.z, { count: painting ? 5 : 3, color: '#ffd966', scale: 0.8 });
      }
    },
    interactables: () => [{
      id: `egg:${HYDRANT}`, source: 'find', action: 'info', verb: { zh: '看看小金栓', en: 'Look at the hydrant' }, name: egg.name,
      x: egg.at.x, z: egg.at.z, radius: 2.8, act: look,
    }],
    dispose: () => { props.set(`egg:${HYDRANT}`, null); props.set(`egg:${HYDRANT}:brush`, null); },
    qa: look,
  };
}

// --- egg 21 · rainbow footsteps ------------------------------------------------------------------------------------------

const CASTRO = 'castro-rainbow-steps';
/** 18th and Castro: the four rainbow crosswalks (OSM nodes 6483277752–55, colour=rainbow) lie within ≈ 1.3 u of here. */
export const CROSSING = { x: 161.7, z: 755.8, r: 2.4 } as const;
export const RAINBOW = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'] as const;
export const PRINTS = 12;
/** a print every this far (u); each fades after this long (s) */
export const PRINT_STEP = 0.7;
export const PRINT_LIFE = 6;
const CASTRO_GAP = 20;

export function castroHost(): EggHost {
  let trail: { left: number; lastX: number; lastZ: number; side: number } | null = null;
  let lastStart = -Infinity;
  const prints: { key: string; until: number }[] = [];
  let n = 0;
  const drop = (t: number) => {
    const p = runtime.player;
    const side = trail!.side;
    const h = p.heading;
    const key = `egg:${CASTRO}:p${n % PRINTS}`;
    props.set(key, { kind: 'print', x: +(p.x + Math.cos(h) * 0.2 * side).toFixed(2), z: +(p.z - Math.sin(h) * 0.2 * side).toFixed(2), heading: +h.toFixed(2), color: RAINBOW[n % RAINBOW.length] });
    prints.push({ key, until: t + PRINT_LIFE });
    n++;
    trail!.side = -side;
    trail!.left--;
    trail!.lastX = p.x; trail!.lastZ = p.z;
    if (trail!.left <= 0) trail = null;
  };
  const start = (t: number) => {
    lastStart = t;
    const p = runtime.player;
    trail = { left: PRINTS, lastX: p.x, lastZ: p.z, side: 1 };
    drop(t);
    reveal(CASTRO, { repeatLine: true, cardDelay: 2.6 });
  };
  return {
    id: CASTRO,
    range: 40,
    update: ctx => {
      // fade: each print goes after its life
      while (prints.length && prints[0].until <= ctx.t) props.set(prints.shift()!.key, null);
      const p = runtime.player;
      if (trail) {
        if (runtime.move.mode !== 'foot') { trail = null; return; }
        if (Math.hypot(p.x - trail.lastX, p.z - trail.lastZ) >= PRINT_STEP) drop(ctx.t);
        return;
      }
      if (runtime.move.mode !== 'foot' || p.speed < 0.8 || ctx.busy || ctx.t - lastStart < CASTRO_GAP) return;
      if (Math.hypot(p.x - CROSSING.x, p.z - CROSSING.z) > CROSSING.r) return;
      start(ctx.t);
    },
    dispose: () => { for (const q of prints.splice(0)) props.set(q.key, null); trail = null; },
    qa: () => { start(hostClock()); },
  };
}
