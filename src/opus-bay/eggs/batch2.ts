import { charApi } from '../actors/charApi';
import { duck } from '../audio/hooks';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { heightAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import type { Shot } from '../game/cinema';
import { bayParts } from '../game/bayNow';
import { bayHour } from './gates';
import { type EggHost, SEA_Y, beat, flock, fx, glance, isFound, momentFree, props, reveal, say, sound } from './hosts';
import type { BirdPath } from './props';
import { eggById } from './registry';

/**
 * Wave 5 · lane D (W5-D6, should) · the second batch of eggs (plan §3.1 "batch 2"), nine that the published city can
 * host today: 25 the top of San Francisco (Mount Davidson), 26 the Telegraph Hill semaphore, 27 the Sutro Baths tunnel,
 * 28 Spreckels Lake's model yachts, 29 Fort Funston's hang gliders, 30 the Castro Theatre's organ at dusk, 31 the
 * Presidio pet cemetery (quiet, a flower), 32 Grace Cathedral's outdoor labyrinth, 33 the Bay Lights (lane V's shimmer on
 * the west span by night, W5-V10). Not hosted (see lane D's report): the Hyde St Pier ships (no walkable pier in the
 * city), the Lands End wrecks (lane R's tide dressing shows them, with R's own line) and the King Philip (rare, tides).
 */

/** Standing still (on foot) near a spot for `seconds` — the shared trigger of the quiet eggs. */
function stillTimer(seconds: number) {
  let still = 0;
  return {
    reset: () => { still = 0; },
    /** true once, when the player has stood within `r` of `at` for `seconds` */
    step: (dt: number, at: { x: number; z: number }, r: number): boolean => {
      const p = runtime.player;
      const ok = runtime.move.mode === 'foot' && Math.hypot(p.x - at.x, p.z - at.z) <= r && Math.abs(p.speed) < 0.4 && !p.moving;
      still = ok ? still + dt : 0;
      if (still < seconds) return false;
      still = -1e9;
      return true;
    },
  };
}

/**
 * A short look at what just happened (a glance: no lock, the feet stay yours): the camera steps back and up behind the
 * player, facing `target`, for `seconds`, then follows again.
 */
function lookAt(target: { x: number; y: number; z: number }, seconds: number, o: { back?: number; up?: number; side?: number } = {}): boolean {
  const p = runtime.player;
  const dx = target.x - p.x, dz = target.z - p.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
  // (side: a step to the right of the line, so the player stands at the edge of the frame, not in front of it)
  const back = o.back ?? 4.5, up = o.up ?? 3.2, side = o.side ?? 0;
  return glance({ position: [p.x - ux * back - uz * side, p.y + up, p.z - uz * back + ux * side], target: [target.x, target.y, target.z], duration: 0.8 }, seconds);
}

// --- 25 · the top of San Francisco ---------------------------------------------------------------------------------

const DAVIDSON = 'mt-davidson-top-of-sf';
/** the summit's standable top (OSM natural=peak, snapped: 928 ft) and the way the view opens (toward downtown) */
export const DAVIDSON_TOP = { x: 256.9, z: 1160.9 } as const;
export const DAVIDSON_R = 9;

export function davidsonHost(): EggHost {
  const still = stillTimer(1.5);
  let done = false;
  const top = () => {
    const c = DAVIDSON_TOP, gy = heightAt(c.x, c.z);
    sound('egg:wind', c, { near: 6, far: 40, gain: 0.7 });
    fx('sparkle', runtime.player.x, runtime.player.y + 1.9, runtime.player.z, { count: 12, color: '#f3c75a' });
    // up and back from the summit, looking north over the whole city to downtown
    const dx = 131 - c.x, dz = 15 - c.z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
    const cam: [number, number, number] = [c.x - ux * 9, gy + 11, c.z - uz * 9];
    const shots: Shot[] = [{ position: cam, target: [cam[0] + ux * 140, gy - 18, cam[2] + uz * 140], duration: 1.4, hold: 2.6 }];
    const after = () => { reveal(DAVIDSON, { repeatLine: true, cardDelay: 1.6 }); };
    if (!beat(shots, after)) after();
  };
  return {
    id: DAVIDSON,
    range: 40,
    enter: () => { done = false; still.reset(); },
    update: ctx => {
      if (done || ctx.busy || !momentFree()) { still.reset(); return; }
      if (still.step(ctx.dt, DAVIDSON_TOP, DAVIDSON_R)) { done = true; top(); }
    },
    leave: () => { done = false; },
    qa: top,
  };
}

// --- 26 · the Telegraph Hill semaphore -----------------------------------------------------------------------------

const SEMA = 'telegraph-hill-semaphore';
/** the stand spot on the plaza before Coit Tower, and our toy pole beside it */
export const SEMA_STAND = { x: -51.7, z: 46.1 } as const;
export const SEMA_POLE = { x: -53.9, z: 44.4 } as const;
/** the arms: 0 down; 1 "a steamer", 2 "a sailing ship" (our own shapes, like the 1849 pole's meanings) */
export const SEMA_SIGNALS = [
  { zh: '一艘轮船进金门啦！', en: 'A steamer’s coming through the Gate!' },
  { zh: '一艘帆船进金门啦！', en: 'A sailing ship’s coming through the Gate!' },
] as const satisfies readonly Bilingual[];

export function semaphoreHost(): EggHost {
  const egg = eggById(SEMA)!;
  const still = stillTimer(1.5);
  let raised = 0, downAt = 0, clock = 0;
  const setArms = (pose: number) => { props.set(`egg:${SEMA}`, { kind: 'semaphore', x: SEMA_POLE.x, z: SEMA_POLE.z, heading: Math.PI * 0.25, size: pose }); };
  setArms(0);
  const signal = () => {
    const pose = 1 + (Math.random() < 0.5 ? 0 : 1);
    raised = pose;
    downAt = clock + 7;
    setArms(pose);
    sound('egg:creak', SEMA_POLE, { near: 4, far: 30 });
    setTimeout(() => sound('egg:ting', SEMA_POLE, { near: 4, far: 30, pitch: 0.8 }), 600);
    const py = heightAt(SEMA_POLE.x, SEMA_POLE.z);
    fx('sparkle', SEMA_POLE.x, py + 3.6, SEMA_POLE.z, { count: 8, color: '#f3c75a' });
    lookAt({ x: SEMA_POLE.x, y: py + 2.6, z: SEMA_POLE.z }, 3, { back: 3.5, up: 1.8, side: 1.6 });
    const first = !isFound(SEMA);
    if (!reveal(SEMA, { lines: [SEMA_SIGNALS[pose - 1], ...egg.lines], cardDelay: 3.2 }) && !first) say(SEMA_SIGNALS[pose - 1]);
  };
  return {
    id: SEMA,
    range: 30,
    enter: () => still.reset(),
    update: ctx => {
      clock = ctx.t;
      if (raised && clock >= downAt) { raised = 0; setArms(0); sound('egg:creak', SEMA_POLE, { near: 4, far: 30, pitch: 0.85 }); }
      if (raised || ctx.busy || !momentFree()) { still.reset(); return; }
      if (still.step(ctx.dt, SEMA_STAND, 3.2)) { signal(); still.reset(); }
    },
    dispose: () => props.set(`egg:${SEMA}`, null),
    qa: signal,
  };
}

// --- 27 · the Sutro Baths tunnel -----------------------------------------------------------------------------------

const TUNNEL = 'sutro-baths-tunnel';
/** the tunnel mouth by the ruins (= 城市之声's sea-cave spot) and where the sea spouts through the rock */
export const TUNNEL_AT = { x: -738.5, z: 1239.6 } as const;
export const TUNNEL_SPRAY = { x: -743.6, z: 1238.8 } as const;
export const TUNNEL_R = 3.5;

export function tunnelHost(): EggHost {
  let fired = false, nextBoom = 0;
  const boom = (find: boolean) => {
    sound('egg:cave', TUNNEL_AT, { near: 5, far: 50 });
    const s = TUNNEL_SPRAY;
    fx('splash', s.x, SEA_Y + 1.2, s.z, { count: 18, scale: 2.2 });
    setTimeout(() => fx('dust', s.x, SEA_Y + 2.6, s.z, { count: 14, scale: 2, color: '#ffffff' }), 250);
    setTimeout(() => fx('splash', s.x + 1.2, SEA_Y + 1, s.z - 0.8, { count: 10, scale: 1.6 }), 2300);
    if (find) { lookAt({ x: s.x, y: SEA_Y + 1.5, z: s.z }, 3.2, { back: 1.2, up: 3.6, side: 2.8 }); reveal(TUNNEL, { repeatLine: true, cardDelay: 3.2 }); }
  };
  return {
    id: TUNNEL,
    range: 30,
    enter: () => { fired = false; },
    update: ctx => {
      if (runtime.move.mode !== 'foot' || ctx.dist > TUNNEL_R) return;
      // on arrival: the sea spouts through the crack (the find); then a wave every 12–18 s while you stay
      if (!fired && !ctx.busy && momentFree()) { fired = true; nextBoom = ctx.t + 12 + Math.random() * 6; boom(true); return; }
      if (fired && ctx.t >= nextBoom) { nextBoom = ctx.t + 12 + Math.random() * 6; boom(false); }
    },
    leave: () => { fired = false; },
    qa: () => boom(true),
  };
}

// --- 28 · Spreckels Lake's model yachts ----------------------------------------------------------------------------

const YACHTS = 'spreckels-lake-model-yachts';
/** the north-west shore (stand) and the open water the toy yachts sail round (published city: water for 5 u around) */
export const YACHT_SHORE = { x: -461.6, z: 1163.9 } as const;
export const YACHT_WATER = { x: -458, z: 1174, r: 4.6 } as const;
/**
 * Sailboats have the lake except when powered boats run: Tuesday, Thursday and Saturday 10:00–13:00 (Wikipedia,
 * Spreckels Lake, read 2026-09-28); the toy fleet sails by day outside those hours.
 */
export function yachtsOut(p = bayParts()): boolean {
  const h = bayHour(p);
  if (h < 8 || h >= 19) return false;
  const powered = (p.weekday === 2 || p.weekday === 4 || p.weekday === 6) && h >= 10 && h < 13;
  return !powered;
}
export const POWERED_LINE: Bilingual = { zh: '现在是动力模型船的时间，帆船过了下午一点再出来。', en: 'It’s powered-boat time now — the sailboats come out after one o’clock.' };
const YACHT_S = 24;

/** Four toy sailboats round the lake, spaced, leaning a little in the wind. */
export function yachtPath(water: number = heightAt(YACHT_WATER.x, YACHT_WATER.z)): BirdPath {
  const w = YACHT_WATER;
  return (t, i) => {
    // anticlockwise round the lake, each on its own lane; the bow along the circle
    const a = t * 0.28 + (i * Math.PI) / 2, r = w.r * (0.62 + 0.3 * ((i * 37) % 3) / 2);
    return { x: w.x + Math.cos(a) * r, y: water + 0.02, z: w.z + Math.sin(a) * r, heading: Math.atan2(-Math.sin(a), Math.cos(a)), flap: 0, pitch: 0 };
  };
}

export function yachtsHost(): EggHost {
  const still = stillTimer(2);
  let saidPowered = false;
  const sail = (find: boolean) => {
    if (flock.active !== 'yacht') flock.start('yacht', 4, YACHT_S, yachtPath());
    sound('egg:sails', YACHT_WATER, { near: 6, far: 40, gain: 0.6 });
    lookAt({ x: YACHT_WATER.x, y: heightAt(YACHT_WATER.x, YACHT_WATER.z) + 0.3, z: YACHT_WATER.z }, 4, { back: 3, up: 3.4 });
    if (find) reveal(YACHTS, { repeatLine: true, cardDelay: 4.2 });
  };
  return {
    id: YACHTS,
    range: 45,
    enter: () => { still.reset(); saidPowered = false; },
    update: ctx => {
      if (ctx.busy || !momentFree()) { still.reset(); return; }
      if (!still.step(ctx.dt, YACHT_SHORE, 10)) return;
      still.reset();
      if (!yachtsOut()) { if (!saidPowered && bayHour() >= 10 && bayHour() < 13) { saidPowered = true; say(POWERED_LINE); } return; }
      sail(true);
    },
    leave: () => { if (flock.active === 'yacht') flock.stop(); },
    qa: () => sail(true),
  };
}

// --- 29 · Fort Funston's hang gliders ------------------------------------------------------------------------------

const GLIDERS = 'fort-funston-hang-gliders';
/** the viewing deck by the launch (OSM, snapped) and the bluff line out to sea (−x) where they soar */
export const FUNSTON_DECK = { x: 100.4, z: 1846.3 } as const;
export const GLIDER_S = 14;

/** Three toy hang gliders riding the wind along the bluff, back and forth, the nearest passing in front of the deck. */
export function gliderPath(from: { x: number; y: number; z: number } = { x: FUNSTON_DECK.x, y: heightAt(FUNSTON_DECK.x, FUNSTON_DECK.z), z: FUNSTON_DECK.z }): BirdPath {
  return (t, i) => {
    const off = [16, 26, 34][i] ?? 30, ph = i * 1.9;
    const s = Math.sin(t * 0.32 + ph);
    const z = from.z + s * (22 + i * 6);
    const x = from.x - off + Math.cos(t * 0.5 + ph) * 2.5;
    const heading = Math.cos(t * 0.32 + ph) >= 0 ? Math.PI : 0;
    return { x, y: from.y + 6 + i * 3.2 + Math.sin(t * 0.9 + ph) * 0.8, z, heading, flap: 0, pitch: -0.08 };
  };
}

export function glidersHost(): EggHost {
  let fired = false;
  const soar = () => {
    fired = true;
    const g = runtime.glide;
    const from = g.active ? { x: FUNSTON_DECK.x, y: Math.max(g.y - 8, heightAt(FUNSTON_DECK.x, FUNSTON_DECK.z)), z: FUNSTON_DECK.z } : undefined;
    flock.start('glider', 3, GLIDER_S, gliderPath(from));
    if (!g.active) lookAt({ x: FUNSTON_DECK.x - 22, y: heightAt(FUNSTON_DECK.x, FUNSTON_DECK.z) + 7, z: FUNSTON_DECK.z }, 4.5, { back: 3.5, up: 2.2 });
    sound('egg:whoosh', { x: FUNSTON_DECK.x - 20, z: FUNSTON_DECK.z }, { near: 8, far: 60 });
    setTimeout(() => sound('egg:wind', { x: FUNSTON_DECK.x - 20, z: FUNSTON_DECK.z }, { near: 8, far: 60, gain: 0.5 }), 500);
    reveal(GLIDERS, { repeatLine: true, cardDelay: 4.6 });
  };
  return {
    id: GLIDERS,
    range: 90,
    enter: () => { fired = false; },
    update: ctx => {
      if (fired || flock.active) return;
      const g = runtime.glide;
      // on foot at the deck, or flying the pelican past the bluff
      if (g.active ? Math.hypot(g.x - FUNSTON_DECK.x, g.z - FUNSTON_DECK.z) <= 80 : (runtime.move.mode === 'foot' && ctx.dist <= 10 && momentFree())) soar();
    },
    leave: () => { fired = false; },
    qa: soar,
  };
}

// --- 30 · the Castro Theatre's organ at dusk -----------------------------------------------------------------------

const ORGAN2 = 'castro-theatre-organ';
/** under the marquee: the theatre's arrival spot on the sidewalk (lane L's site: local (5.5, 4) → world, snapped), and the marquee (local (0, 2.2), 4 u up) */
export const MARQUEE = { x: 154.5, z: 747 } as const;
export const MARQUEE_SIGN = { x: 151, z: 742.4 } as const;
/** golden hour and night (the marquee lit) */
export const organHours = () => game.get().timeOfDay === 'golden' || game.get().timeOfDay === 'night';

export function castroOrganHost(): EggHost {
  let played = false;
  const play = () => {
    played = true;
    sound('egg:theatre-organ', MARQUEE, { near: 4, far: 40 });
    const gy = heightAt(MARQUEE.x, MARQUEE.z);
    for (const [k, dx] of [[0, -1.2], [1, 0], [2, 1.2]] as const) setTimeout(() => fx('sparkle', MARQUEE_SIGN.x + dx * 0.77, gy + 4.2, MARQUEE_SIGN.z + dx * 0.64, { count: 6, color: '#ffd27a' }), 500 + k * 450);
    lookAt({ x: MARQUEE_SIGN.x, y: gy + 3.8, z: MARQUEE_SIGN.z }, 3.4, { back: 4, up: 1.2 });
    reveal(ORGAN2, { repeatLine: true, cardDelay: 3.6 });
  };
  return {
    id: ORGAN2,
    range: 30,
    enter: () => { played = false; },
    update: ctx => {
      if (played || runtime.move.mode !== 'foot' || ctx.dist > 5 || !organHours() || ctx.busy || !momentFree()) return;
      play();
    },
    leave: () => { played = false; },
    qa: play,
  };
}

// --- 31 · the Presidio pet cemetery ---------------------------------------------------------------------------------

const PETS = 'presidio-pet-cemetery';
/**
 * On the open grass just south of the cemetery (OSM landuse=cemetery's centroid lies under the Presidio Parkway's deck
 * in the published city, where the follow camera cannot see you), the toy picket fence north of you, the flower by it.
 */
export const PETS_AT = { x: -584, z: 601 } as const;
export const PICKET = { x: -584.5, z: 597.8 } as const;
export const FLOWER = { x: -584.2, z: 598.6 } as const;

export function petCemeteryHost(): EggHost {
  const egg = eggById(PETS)!;
  const still = stillTimer(2);
  let done = false;
  props.set(`egg:${PETS}:fence`, { kind: 'picket', x: PICKET.x, z: PICKET.z, heading: Math.PI });
  const visit = () => {
    done = true;
    // quiet: the music steps back, one soft chime, BAYBAY sits for a moment, a flower by the fence
    duck('music', 0.4, 9000);
    sound('egg:chime', PETS_AT, { near: 4, far: 20, gain: 0.5, pitch: 0.75 });
    charApi()?.emote('baybay', 'sit', { loop: true, seconds: 6 });
    props.set(`egg:${PETS}:flower`, { kind: 'flower', x: FLOWER.x, z: FLOWER.z, heading: 0.4 });
    // a low, still look at the fence and the flower (no lock; the parkway's deck is overhead here, as in the real place)
    lookAt({ x: FLOWER.x, y: heightAt(FLOWER.x, FLOWER.z) + 0.4, z: FLOWER.z }, 4, { back: 3.2, up: 1.4, side: 1.2 });
    reveal(PETS, { lines: egg.lines, repeatLine: true, cardDelay: 3.4 });
  };
  return {
    id: PETS,
    range: 30,
    enter: () => { still.reset(); done = false; },
    update: ctx => {
      if (done || ctx.busy || !momentFree()) { still.reset(); return; }
      if (still.step(ctx.dt, PETS_AT, 5)) visit();
    },
    leave: () => { done = false; },
    dispose: () => { props.set(`egg:${PETS}:fence`, null); props.set(`egg:${PETS}:flower`, null); },
    qa: visit,
  };
}

// --- 32 · Grace Cathedral's outdoor labyrinth -----------------------------------------------------------------------

const GRACE = 'grace-outdoor-labyrinth';
/** the terrazzo circle on the terrace (lane L's site: local (−1.3, 7.55) → world) and a standable spot beside it */
export const GRACE_LAB = { x: 6.74, z: 226.83 } as const;
export const GRACE_STAND = { x: 8.2, z: 228.3 } as const;
export const PAIR_LINE: Bilingual = { zh: '海边一座，山顶一座——两座迷宫你都找到啦！', en: 'One by the sea, one on the hill — you’ve found both labyrinths!' };

export function graceLabyrinthHost(): EggHost {
  const egg = eggById(GRACE)!;
  const still = stillTimer(2);
  let done = false;
  const glow = () => {
    done = true;
    const gy = heightAt(GRACE_STAND.x, GRACE_STAND.z);
    sound('egg:chime', GRACE_LAB, { near: 4, far: 30, pitch: 0.9 });
    for (let k = 0; k < 3; k++) setTimeout(() => fx('rings', GRACE_LAB.x, gy + 0.08, GRACE_LAB.z, { count: 1, scale: 0.35 + k * 0.12, color: '#fff3c4' }), k * 700);
    setTimeout(() => fx('sparkle', GRACE_LAB.x, gy + 0.3, GRACE_LAB.z, { count: 10, color: '#fff3c4' }), 2100);
    lookAt({ x: GRACE_LAB.x, y: gy, z: GRACE_LAB.z }, 3, { back: 1.2, up: 3.8, side: 1.8 });
    const lines = isFound('lands-end-labyrinth') ? [egg.lines[0], PAIR_LINE] : egg.lines;
    reveal(GRACE, { lines, repeatLine: true, cardDelay: 2.4 });
  };
  return {
    id: GRACE,
    range: 25,
    enter: () => { still.reset(); done = false; },
    update: ctx => {
      if (done || ctx.busy || !momentFree()) { still.reset(); return; }
      if (still.step(ctx.dt, GRACE_LAB, 3.2)) glow();
    },
    leave: () => { done = false; },
    qa: glow,
  };
}

// --- 33 · The Bay Lights --------------------------------------------------------------------------------------------

const BAYLIGHTS = 'bay-lights';
/** on the Embarcadero by Pier 14 (snapped, open), the west span's middle (lane V's strands shimmer there by night) */
export const PIER14 = { x: 208.3, z: 10.4 } as const;
export const WEST_SPAN = { x: 240.7, y: 18, z: -99 } as const;
/** The Bay Lights shine nightly from dusk to dawn (illuminate.org, read 2026-09-28): the night sky here. */
export const lightsOn = () => game.get().timeOfDay === 'night';

export function bayLightsHost(): EggHost {
  const still = stillTimer(1.5);
  let done = false;
  const look = () => {
    done = true;
    // a long look out along the span (no lock: stay as long as you like)
    lookAt(WEST_SPAN, 5.5, { back: 3.5, up: 2.2, side: 1.4 });
    sound('egg:stars', PIER14, { near: 4, far: 30, gain: 0.6, pitch: 0.9 });
    reveal(BAYLIGHTS, { repeatLine: true, cardDelay: 5.6 });
  };
  return {
    id: BAYLIGHTS,
    range: 40,
    enter: () => { still.reset(); done = false; },
    update: ctx => {
      if (done || !lightsOn() || ctx.busy || !momentFree()) { still.reset(); return; }
      if (still.step(ctx.dt, PIER14, 12)) look();
    },
    leave: () => { done = false; },
    qa: look,
  };
}

/** Batch 2's hosts, in the registry's order (eggs 25–33). */
export function batch2Hosts(): EggHost[] {
  return [davidsonHost(), semaphoreHost(), tunnelHost(), yachtsHost(), glidersHost(), castroOrganHost(), petCemeteryHost(), graceLabyrinthHost(), bayLightsHost()];
}
