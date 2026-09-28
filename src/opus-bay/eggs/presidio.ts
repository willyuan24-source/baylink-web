import { runtime } from '../core/runtime';
import { isWater } from '../core/terrain';
import type { Bilingual } from '../core/types';
import type { Shot } from '../game/cinema';
import { registerFlagSource } from '../game/flags';
import { bayParts } from '../game/bayNow';
import { inMonths, mark, marked } from './gates';
import { type EggHost, SEA_Y, beat, flock, fx, glance, isFound, momentFree, props, reveal, say, sound } from './hosts';
import { deckCoords, GGB, MID, onDeck } from './marina';
import type { BirdPath } from './props';
import { eggById } from './registry';

/**
 * Wave 5 · lane D (W5-D4) · the Golden Gate, the Presidio and Pacific Heights: egg 13 (a humpback in the Gate), egg 23
 * (San Francisco's 250th birthday trail: three 1776 stops, always with the Ohlone line), egg 24 (Alta Plaza's chipped
 * steps, reached in the toy car or on a bike).
 */

// --- egg 13 · a humpback in the Golden Gate --------------------------------------------------------------------------

const WHALE = 'golden-gate-humpback';
/** Humpbacks have come into the Bay to feed from April to November since 2016 (baynature.org, read 2026-09-28). */
export const WHALE_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11] as const;
/** About one crossing in six (never guaranteed: 看缘分). */
export const WHALE_ODDS = 1 / 6;
/** A crossing counts within this distance of mid-span (u); another roll waits this long (s). */
export const CROSS_R = 320;
const WHALE_GAP = 60;
const WHALE_S = 9;

/** Which side of the Gate (sign of the along-deck and the across-deck coordinates): a change = one crossing. */
export function gateSides(x: number, z: number): { ns: number; ew: number } {
  const c = deckCoords(x, z);
  return { ns: Math.sign(c.along), ew: Math.sign(c.across) };
}

/** Never under the bridge: a whale spot keeps this far (u) from the deck's line while it is between the anchorages. */
export const DECK_CLEAR = 32;
const clearOfDeck = (x: number, z: number) => {
  const c = deckCoords(x, z);
  return Math.abs(c.across) >= DECK_CLEAR || c.along < GGB.deck.from - DECK_CLEAR || c.along > GGB.deck.to + DECK_CLEAR;
};

/**
 * A water spot about 40–85 u ahead of `from` along `dir` (rad, heading convention; the nearest open water to either side
 * when the view runs along the bridge), clear for the whale's length and never under the deck (seen in the game: a
 * whale under the span was hidden by it).
 */
export function whaleSpot(from: { x: number; z: number }, heading: number, water: (x: number, z: number) => boolean = isWater): { x: number; z: number; swim: number } | null {
  for (const a of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4]) {
    for (const d of [55, 45, 70, 38, 85]) {
      const h = heading + a;
      const x = from.x + Math.sin(h) * d, z = from.z + Math.cos(h) * d;
      // it swims across the view: its body along the perpendicular
      const swim = h + Math.PI / 2;
      const clear = [-8, -4, 0, 4, 8].every(k => water(x + Math.sin(swim) * k, z + Math.cos(swim) * k) && clearOfDeck(x + Math.sin(swim) * k, z + Math.cos(swim) * k))
        && water(x + Math.sin(h) * 5, z + Math.cos(h) * 5);
      if (clear) return { x, z, swim };
    }
  }
  return null;
}

/** The humpback's 9 s: the blow, the back rolling forward, the dive with the fluke up, gone. */
export function whalePath(at: { x: number; z: number }, swim: number): BirdPath {
  const fx0 = Math.sin(swim), fz0 = Math.cos(swim);
  return (t, i) => {
    if (i > 0) return null;
    const move = t * 1.1;
    let y: number, pitch: number;
    if (t < 1.6) { const k = t / 1.6; y = SEA_Y - 2.2 + k * 1.9; pitch = -0.12; }            // rising under the blow
    else if (t < 4.6) { const k = (t - 1.6) / 3; y = SEA_Y - 0.3 + Math.sin(k * Math.PI) * 0.5; pitch = -0.12 + k * 0.5; }   // the back rolls forward
    else if (t < 7.2) { const k = (t - 4.6) / 2.6; y = SEA_Y - 0.4 - k * 1.2; pitch = 0.38 + k * 0.95; } // the dive: nose down, the fluke up
    else { const k = (t - 7.2) / 1.8; y = SEA_Y - 1.6 - k * 3; pitch = 1.33; }
    return { x: at.x + fx0 * move, y, z: at.z + fz0 * move, heading: swim, flap: 0, pitch };
  };
}

/** `water`: the terrain's isWater (tests may pass their own). */
export function humpbackHost(water: (x: number, z: number) => boolean = isWater): EggHost {
  let last: { ns: number; ew: number; deck: number } | null = null;
  let nextRoll = 0;
  let clock = 0;
  const surface = () => {
    const p = runtime.player, g = runtime.glide;
    const from = g.active ? { x: g.x, z: g.z } : { x: p.x, z: p.z };
    // ahead of the camera: the glide's heading in the air; the camera's view on foot
    const heading = g.active ? g.heading : runtime.camera.yaw + Math.PI;
    const spot = whaleSpot(from, heading, water);
    if (!spot) return false;
    flock.start('whale', 1, WHALE_S, whalePath(spot, spot.swim));
    sound('egg:spout', spot, { near: 20, far: 220 });
    setTimeout(() => {
      fx('splash', spot.x, SEA_Y + 0.4, spot.z, { count: 16, scale: 2 });
      fx('dust', spot.x, SEA_Y + 2.8, spot.z, { count: 18, scale: 2.6, color: '#ffffff' });
    }, 1200);
    setTimeout(() => fx('splash', spot.x + Math.sin(spot.swim) * 7, SEA_Y + 0.3, spot.z + Math.cos(spot.swim) * 7, { count: 12, scale: 1.6 }), 6200);
    // look at it: on foot a short beat from just behind you (the feet come back after); on the pelican a glance (the
    // controls stay yours)
    const air = g.active;
    const eye = air ? { x: g.x, y: g.y, z: g.z } : { x: p.x, y: p.y, z: p.z };
    const dx = spot.x - eye.x, dz = spot.z - eye.z, l = Math.hypot(dx, dz) || 1;
    // (behind and to one side, above the hat: the whale in the middle, you at the edge of the frame)
    const back = air ? 7 : 2.5, side = air ? 0 : 2.6, ux = dx / l, uz = dz / l;
    const shot = { position: [eye.x - ux * back - uz * side, eye.y + (air ? 3 : 5), eye.z - uz * back + ux * side] as [number, number, number], target: [spot.x, SEA_Y + 0.8, spot.z] as [number, number, number] };
    const looked = air ? glance({ ...shot, duration: 0.8 }, 5.2) : beat([{ ...shot, duration: 0.9, hold: 5.2 }]);
    // (after a beat the card waits for the letterbox to go)
    setTimeout(() => { reveal(WHALE, { repeatLine: true, cardDelay: looked && !air ? 4.8 : 3 }); }, 1500);
    return true;
  };
  return {
    id: WHALE,
    range: CROSS_R + 60,
    update: ctx => {
      clock = ctx.t;
      const g = runtime.glide;
      const air = g.active;
      const deck = onDeck(ctx.px, ctx.py, ctx.pz);
      if (!air && !deck) { last = null; return; }
      const x = air ? g.x : ctx.px, z = air ? g.z : ctx.pz;
      if (Math.hypot(x - MID.x, z - MID.z) > CROSS_R) { last = null; return; }
      const s = gateSides(x, z);
      const now = { ...s, deck: deck ? 1 : 0 };
      // a crossing: across the strait on the deck (past mid-span), or through / across the Gate on the pelican
      const crossed = !!last && ((deck && last.deck && s.ns !== last.ns) || (air && (s.ns !== last.ns || s.ew !== last.ew)));
      last = now;
      if (!crossed || clock < nextRoll || !inMonths(WHALE_MONTHS)) return;
      nextRoll = clock + WHALE_GAP;
      if (Math.random() < WHALE_ODDS && !flock.active) surface();
    },
    leave: () => { last = null; },
    qa: () => { surface(); },
  };
}

// --- egg 23 · San Francisco's 250th birthday trail -----------------------------------------------------------------

const TRAIL = 'sf-250-birthday-trail';
/** The three stops (registry spots: at, also[0], also[1]) and the line each one says (with the Ohlone line after it). */
export const TRAIL_STOPS = ['presidio', 'lake', 'mission'] as const;
const STOP_LINE = [0, 2, 3] as const;
const OHLONE_LINE = 1;
/** a stop counts within this distance (u), on foot */
export const STOP_R = 7;
/** the "250" pennants stand all of 2026, and every 17 September (the presidio's founding day) */
export const bannerDay = (p = bayParts()) => p.year === 2026 || (p.month === 9 && p.day === 17);
/** the per-viewer mark of a visited stop (eggs/gates mark / marked) */
export const trailMark = (stop: string) => `250:${stop}`;

export function trailHost(): EggHost {
  const egg = eggById(TRAIL)!;
  const spots = [egg.at, ...(egg.also ?? [])];
  const offFlags = registerFlagSource('eggs-250', () => {
    if (isFound(TRAIL) || !bannerDay()) return [];
    return TRAIL_STOPS.flatMap((stop, i) => (marked(trailMark(stop)) ? [] : [{ key: stop, x: spots[i].x, z: spots[i].z, color: '#c8553d', glyph: 'CalendarDays' as const, far: 260 }]));
  });
  let saidAt = -1;
  const visit = (i: number) => {
    const stop = TRAIL_STOPS[i];
    const fresh = mark(trailMark(stop));
    const all = TRAIL_STOPS.every(s => marked(trailMark(s)));
    const lines = [egg.lines[STOP_LINE[i]], egg.lines[OHLONE_LINE]];
    sound('egg:chime', spots[i], { near: 6, far: 40 });
    fx('sparkle', runtime.player.x, runtime.player.y + 1.8, runtime.player.z, { count: 10, color: '#e8705a' });
    if (all && reveal(TRAIL, { lines, cardDelay: 2 })) return;
    if (fresh) {
      const left = TRAIL_STOPS.filter(s => !marked(trailMark(s))).length;
      say([...lines, { zh: `1776 年的地方还差 ${left} 个，顺序随意。`, en: `${left} more 1776 place${left === 1 ? '' : 's'} to go, in any order.` }]);
    }
  };
  return {
    id: TRAIL,
    range: 30,
    update: ctx => {
      if (ctx.busy || runtime.move.mode !== 'foot' || ctx.found) return;
      const i = spots.findIndex(s => Math.hypot(s.x - ctx.px, s.z - ctx.pz) <= STOP_R);
      if (i < 0) { saidAt = -1; return; }
      if (i === saidAt || marked(trailMark(TRAIL_STOPS[i])) || !momentFree()) return;
      saidAt = i;
      visit(i);
    },
    dispose: offFlags,
    qa: () => { for (const s of TRAIL_STOPS) mark(trailMark(s)); visit(0); },
  };
}

// --- egg 24 · Alta Plaza's chipped steps ----------------------------------------------------------------------------

const ALTA = 'alta-plaza-chipped-steps';
/** The top of the south stairway (OSM way 1154319389's upper end) and the way down (towards Clay St). */
export const ALTA_TOP = { x: -194.1, z: 456.3 } as const;
const DOWN = (() => { const dx = -187.9 - ALTA_TOP.x, dz = 460.7 - ALTA_TOP.z, l = Math.hypot(dx, dz); return { x: dx / l, z: dz / l }; })();
/** the chipped lip of the top step, just below the top */
export const CHIPS = { x: +(ALTA_TOP.x + DOWN.x * 0.9).toFixed(2), z: +(ALTA_TOP.z + DOWN.z * 0.9).toFixed(2) } as const;
/** the vehicle stops politely within this distance of the top (u) at no more than this speed (u/s) */
export const ALTA_STOP = { r: 3.4, speed: 2.5 } as const;
export const BIKE_LINE: Bilingual = { zh: '别骑下去！1972 年一场电影飞车把台阶磕坏了，印子还在呢。', en: 'Not down the steps! A 1972 movie chase chipped them, and the marks are still there.' };

export function altaHost(): EggHost {
  const egg = eggById(ALTA)!;
  props.set(`egg:${ALTA}`, { kind: 'chips', x: CHIPS.x, z: CHIPS.z, heading: Math.atan2(DOWN.x, DOWN.z) });
  let firedThisVisit = false;
  const stop = () => {
    firedThisVisit = true;
    const line = runtime.move.mode === 'bike' ? BIKE_LINE : egg.lines[0];
    sound('egg:squeak');
    const y = runtime.vehicle.occupied ? runtime.vehicle.y : runtime.player.y;
    // from uphill, behind and above the car, down the stairway to the chipped lip (the stair's walls stay out of the
    // lens: a camera beside the steps sat inside them), then back
    const side = { x: -DOWN.z, z: DOWN.x };
    const shots: Shot[] = [{
      position: [ALTA_TOP.x - DOWN.x * 3.6 + side.x * 0.8, y + 4.6, ALTA_TOP.z - DOWN.z * 3.6 + side.z * 0.8],
      target: [CHIPS.x + DOWN.x * 1.6, y - 1.4, CHIPS.z + DOWN.z * 1.6],
      duration: 1.1, hold: 2.2,
    }];
    const after = () => { reveal(ALTA, { lines: [line], cardDelay: 1.6, repeatLine: true }); };
    if (!beat(shots, after, { vehicle: true })) after();
  };
  return {
    id: ALTA,
    range: 40,
    enter: () => { firedThisVisit = false; },
    update: ctx => {
      const v = runtime.vehicle;
      const mode = runtime.move.mode;
      if (firedThisVisit || ctx.busy || (mode !== 'car' && mode !== 'bike') || !v.occupied) return;
      if (Math.hypot(v.x - ALTA_TOP.x, v.z - ALTA_TOP.z) > ALTA_STOP.r || Math.abs(v.speed) > ALTA_STOP.speed) return;
      stop();
    },
    leave: () => { firedThisVisit = false; },
    dispose: () => props.set(`egg:${ALTA}`, null),
    qa: stop,
  };
}
