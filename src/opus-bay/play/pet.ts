import { charApi } from '../actors/charApi';
import { playSound } from '../audio/hooks';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual } from '../core/types';
import { isWater } from '../core/terrain';
import { baybayHeld } from '../game/baybayHold';
import { bubble } from '../game/flow';
import { flow } from '../game/flowStore';
import { registerFrameSystem } from '../game/systemsRegistry';
import { spawnFx } from '../world/fx';

/**
 * Wave 5 · lane A · pet BAYBAY (W5-A3, plan §3.2 A-pet): hearts, a squeak and a happy wiggle; a double tap on her
 * (lane F's `self-tap` with double), 问 BAYBAY → 摸摸, or E twice at her side on a keyboard. Near the water she
 * sometimes floats on her back for a while by herself (an idle moment, never a button), with her sea-otter line.
 *
 * Facts (checked 2026-09-28, https://www.montereybayaquarium.org/animals/animals-a-to-z/sea-otter): sea otters float on
 * their backs and use their chest as a table; loose skin under each forearm makes a pocket for food.
 */

/** She must be this close to be petted (u); farther, she hops over first. */
export const PET_REACH = 4.2;
/** Pets within PET_SPAM_WINDOW s that make her say 毛都乱了. */
export const PET_SPAM = 4;
export const PET_SPAM_WINDOW = 12;

export const PET_LINES: readonly Bilingual[] = [
  { zh: '嘿嘿，好痒！', en: 'Hehe, that tickles!' },
  { zh: '再摸摸头～', en: 'Pat my head again!' },
  { zh: '你摸得最舒服啦！', en: 'You give the best pats!' },
  { zh: '海獭前臂下有小口袋，我也有哦！', en: 'Sea otters have pockets under their arms. Me too!' },
];
export const PET_SPAM_LINE: Bilingual = { zh: '好啦好啦，毛都摸乱啦～', en: 'Okay, okay, my fur is all messy now!' };
export const FLOAT_LINE: Bilingual = { zh: '海獭亲戚也这样仰面漂，肚子当桌子！', en: 'My sea-otter cousins float like this, chest as a table!' };

let recent: number[] = [];
let lineIndex = 0;

const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

/** Can the player pet her now (playing, on foot, no dialogue / photo, she is near)? */
export function petAllowed(): boolean {
  const s = game.get();
  if (s.phase !== 'playing' || s.dialogue.nodeId || s.photoMode || s.riding !== null) return false;
  if (runtime.move.mode !== 'foot' && runtime.move.mode !== 'sit') return false;
  return dist(runtime.player.x, runtime.player.z, runtime.guide.x, runtime.guide.z) <= PET_REACH;
}

/** A double tap from afar: the first tap already walks the player over; pet her on arrival (within PET_WAIT s). */
export const PET_WAIT = 8;
let offWait: (() => void) | null = null;
function petOnArrival() {
  offWait?.();
  let left = PET_WAIT;
  const off = registerFrameSystem('a-play-pet-wait', dt => {
    left -= dt;
    const s = game.get();
    if (left <= 0 || s.phase !== 'playing' || s.dialogue.nodeId || s.photoMode) { off(); offWait = null; return; }
    if (petAllowed()) { off(); offWait = null; pet(); }
  });
  offWait = off;
}

/** Pet her: the wiggle, hearts, the squeak, a line (her own for spam). False when she is not in reach (yet). */
export function pet(now = performance.now() / 1000): boolean {
  if (!petAllowed()) {
    // too far: the player is on the way (the first tap walks over) — pet her on arrival, else a line
    if (game.get().phase === 'playing' && !game.get().dialogue.nodeId) {
      if (runtime.player.pathTarget) petOnArrival();
      else bubble({ zh: '我在这儿！走近点再摸～', en: 'Over here! Come closer for a pat.' }, 2200);
    }
    return false;
  }
  const g = runtime.guide, p = runtime.player;
  // face each other
  p.heading = Math.atan2(g.x - p.x, g.z - p.z);
  const api = charApi();
  if (api) { api.emote('baybay', 'pet'); api.emote('player', 'pet'); }
  else { runtime.guide.emote = 'hop'; emit({ type: 'emote', who: 'baybay', emote: 'hop' }); }
  spawnFx('hearts', g.x, g.y + 1.5, g.z);
  playSound('play-squeak', { pitch: 0.9 + Math.random() * 0.25 });
  recent = [...recent.filter(t => now - t < PET_SPAM_WINDOW), now];
  const line = recent.length >= PET_SPAM ? PET_SPAM_LINE : PET_LINES[lineIndex++ % PET_LINES.length];
  if (recent.length >= PET_SPAM) recent = [];
  bubble(line, 2400);
  emit({ type: 'play', activity: 'pet', what: 'end' });
  return true;
}

// --- the shoreline float (idle) ---------------------------------------------------------------------------------------

/** Standing still this long (s) near the water may start her float; at most once per FLOAT_EVERY s. */
export const FLOAT_IDLE = 9;
export const FLOAT_EVERY = 180;
export const FLOAT_CHANCE = 0.5;
export const FLOAT_WATER_R = 10;

/** Is there water within r of (x, z)? (8 samples on a ring and one halfway) */
export function waterNear(x: number, z: number, r = FLOAT_WATER_R, water: (x: number, z: number) => boolean = isWater): boolean {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    if (water(x + Math.sin(a) * r, z + Math.cos(a) * r) || water(x + Math.sin(a) * r * 0.5, z + Math.cos(a) * r * 0.5)) return true;
  }
  return false;
}

/** The idle watcher: registered by init (city mode). Returns its off. */
export function startFloatWatch(rand: () => number = Math.random): () => void {
  let still = 0, lastFloat = -Infinity, checked = false;
  return registerFrameSystem('a-play-float', (dt, now) => {
    const s = game.get(), p = runtime.player;
    const idle = s.phase === 'playing' && !s.dialogue.nodeId && !s.photoMode && s.riding === null && runtime.move.mode === 'foot' && !p.moving && !p.locked && !flow.get().cinematic;
    if (!idle) { still = 0; checked = false; return; }
    still += dt;
    if (still < FLOAT_IDLE || checked) return;
    // (W8-K4, lane K surgical) never over another bubble (it cut the Wharf's crab-wheel bark after 0.6 s in W8-K1's live
    // proof), nor under a play panel / card (game/baybayHold.ts): it waits for them
    if (flow.get().bubble || baybayHeld()) return;
    checked = true;
    const t = now / 1000;
    if (t - lastFloat < FLOAT_EVERY || rand() > FLOAT_CHANCE) return;
    const api = charApi();
    if (!api || !waterNear(runtime.guide.x, runtime.guide.z)) return;
    lastFloat = t;
    api.emote('baybay', 'float', { loop: true, seconds: 10 });
    bubble(FLOAT_LINE, 3600);
  });
}
