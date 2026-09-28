import { charApi } from '../actors/charApi';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { heightAt, isWater } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { readSave } from '../data/save';
import { bitCount } from '../data/playSave';
import { bayParts } from '../game/bayNow';
import type { Shot } from '../game/cinema';
import { KARL } from '../world/fogShader';
import { type EggHost, beat, fx, hostClock, isFound, momentFree, note, props, reveal, say, sound } from './hosts';
import { eggById } from './registry';

/**
 * Wave 5 · lane D (W5-D3) · the Marina, the Presidio and the Golden Gate: egg 7 (the Wave Organ), egg 8 (a pelican
 * landing on Crissy Field at dusk), egg 9 (BAYBAY's otter cousins at Fort Point), egg 10 (the Octagon House time capsule),
 * egg 12 (the foghorn duet in fog).
 */

// --- egg 7 · the Wave Organ -------------------------------------------------------------------------------------

const ORGAN = 'wave-organ-high-tide';
/** The tide's loudness 0 … 1 (lane R's baked tide table when it ships; mid until then). */
export let organTide: () => number = () => 0.7;
export function setOrganTide(fn: (() => number) | null): void { organTide = fn ?? (() => 0.7); }

/** The direction (rad, heading convention: forward = (sin h, cos h)) from (x, z) with the most water within 10 u. */
export function waterHeading(x: number, z: number): number {
  let best = 0, bestN = -1;
  for (let k = 0; k < 16; k++) {
    const h = (k / 16) * Math.PI * 2;
    let n = 0;
    for (const r of [4, 7, 10]) if (isWater(x + Math.sin(h) * r, z + Math.cos(h) * r)) n++;
    if (n > bestN) { bestN = n; best = h; }
  }
  return best;
}

export function waveOrganHost(): EggHost {
  const egg = eggById(ORGAN)!;
  let playingUntil = 0;
  let clock = 0;
  const listen = () => {
    if (clock < playingUntil) return;
    playingUntil = clock + 8;
    const p = runtime.player;
    const h = waterHeading(p.x, p.z);
    const fx0 = Math.sin(h), fz0 = Math.cos(h);
    // ear-level: the camera drops low behind and beside the player, the water and the pipe mouths beyond (2.8 s, then back)
    const sx = Math.cos(h), sz = -Math.sin(h);
    const shots: Shot[] = [{
      position: [p.x + sx * 3.2 - fx0 * 2.2, p.y + 1.5, p.z + sz * 3.2 - fz0 * 2.2],
      target: [p.x + fx0 * 1.2, p.y + 0.8, p.z + fz0 * 1.2],
      duration: 1.1, hold: 1.7,
    }];
    sound('egg:organ', null, { gain: 0.45 + 0.55 * organTide() });
    fx('splash', p.x + fx0 * 3, p.y - 0.2, p.z + fz0 * 3, { count: 6 });
    const after = () => { reveal(ORGAN, { repeatLine: true, cardDelay: 1.8 }); };
    if (!beat(shots, after)) after();
  };
  return {
    id: ORGAN,
    range: 40,
    update: ctx => { clock = ctx.t; },
    interactables: () => [{
      id: `egg:${ORGAN}`, source: 'find', action: 'info', verb: { zh: '把耳朵凑近管口', en: 'Listen at a pipe' }, name: egg.name,
      x: egg.at.x, z: egg.at.z, radius: 3.5, act: listen,
    }],
    qa: listen,
  };
}

// --- egg 8 · land on Crissy Field at dusk ------------------------------------------------------------------------

const CRISSY = 'crissy-field-dusk-landing';
/** the lawn: within this radius of the egg's spot (u), on land */
export const CRISSY_LAWN_R = 48;
const WINDSOCK = { x: -558.5, z: 529.5 };
/** "dusk" = the sky's golden band (lane R's real sun band decides the sky once it ships) */
export const isDusk = () => game.get().timeOfDay === 'golden';

export function crissyHost(): EggHost {
  const egg = eggById(CRISSY)!;
  if (isFound(CRISSY)) props.set(`egg:${CRISSY}`, { kind: 'windsock', x: WINDSOCK.x, z: WINDSOCK.z, heading: Math.PI / 2 });
  const landed = (x: number, z: number) => {
    props.set(`egg:${CRISSY}`, { kind: 'windsock', x: WINDSOCK.x, z: WINDSOCK.z, heading: Math.PI / 2 });
    sound('egg:propeller');
    fx('sparkle', x, heightAt(x, z) + 2.5, z, { count: 24, color: '#ffffff' });
    fx('sparkle', WINDSOCK.x, heightAt(WINDSOCK.x, WINDSOCK.z) + 3, WINDSOCK.z, { count: 12, color: '#e0533c' });
    reveal(CRISSY, { repeatLine: true, cardDelay: 2 });
  };
  return {
    id: CRISSY,
    range: 120,
    onEvent: e => {
      if (e.type !== 'glide:land') return;
      const d = Math.hypot(e.x - egg.at.x, e.z - egg.at.z);
      if (d > CRISSY_LAWN_R || isWater(e.x, e.z) || !isDusk()) return;
      // the landing hop settles first
      setTimeout(() => landed(e.x, e.z), 900);
    },
    dispose: () => props.set(`egg:${CRISSY}`, null),
    qa: () => landed(runtime.player.x, runtime.player.z),
  };
}

// --- egg 9 · BAYBAY's otter cousins at Fort Point -----------------------------------------------------------------

const OTTER = 'baybay-otter-roots';
/** the water just south-west of the spot (checked in the published city) */
const OTTER_WATER = { x: -752.8, z: 603.5 };

export function otterHost(): EggHost {
  let told = false;
  const tell = () => {
    told = true;
    const g = runtime.guide;
    // she floats on her back (lane F's charApi; without it, a splash and the lines)
    charApi()?.emote('baybay', 'float', { seconds: 7 });
    sound('egg:splash', { x: g.x, z: g.z }, { near: 6, far: 40 });
    fx('splash', OTTER_WATER.x, 0.2, OTTER_WATER.z, { count: 10 });
    reveal(OTTER, { cardDelay: 7.5 });
  };
  return {
    id: OTTER,
    range: 40,
    update: ctx => {
      if (told || ctx.found || ctx.dist > 7 || ctx.busy || runtime.move.mode !== 'foot') return;
      const g = runtime.guide;
      if (Math.hypot(g.x - ctx.px, g.z - ctx.pz) > 12 || !momentFree()) return;
      tell();
    },
    qa: tell,
  };
}

// --- egg 10 · the Octagon House time capsule ---------------------------------------------------------------------

const OCTAGON = 'octagon-house-time-capsule';
const TIN = { x: -184.4, z: 290.7 };
/** The 1861-style note in our own words (never the real letter), and the player's own capsule page. */
export const CAPSULE_NOTE = {
  title: { zh: '一张 1861 年的小纸条（BAYBAY 仿写）', en: 'A note from 1861 (BAYBAY’s own words)' },
  lines: [
    { zh: '给以后打开这个盒子的人：', en: 'To whoever opens this tin one day:' },
    { zh: '我们在这山坡上盖了一座八个角的房子，希望你也喜欢它。', en: 'We built an eight-sided house on this hill. We hope you like it too.' },
    { zh: '愿你一路平安，风景常新。', en: 'May your roads be safe and your views always new.' },
  ] as readonly Bilingual[],
  sign: { zh: '—— 1861 年的房主', en: '— the owners, 1861' },
} as const;

/** The player's own capsule: a few numbers from the save (arrivals, neighbourhoods, finds, coins, lines ridden). */
export function capsuleStats(): { label: Bilingual; value: string }[] {
  const s = readSave();
  const rides = s?.rides ? Object.keys(s.rides).length : 0;
  return [
    { label: { zh: '去过的地方', en: 'places reached' }, value: String(s?.arrivals?.length ?? 0) },
    { label: { zh: '走过的街区', en: 'neighbourhoods' }, value: String(s?.zones?.length ?? 0) },
    { label: { zh: '小发现', en: 'finds' }, value: String(bitCount(s?.play?.g.egg)) },
    { label: { zh: '坐过的线路', en: 'lines ridden' }, value: String(rides) },
  ];
}

export function octagonHost(): EggHost {
  const egg = eggById(OCTAGON)!;
  props.set(`egg:${OCTAGON}`, { kind: 'tin', x: TIN.x, z: TIN.z, heading: 0.3 });
  const open = () => {
    sound('egg:tin', TIN, { near: 5, far: 30 });
    const d = bayParts();
    note({
      style: 'letter', title: CAPSULE_NOTE.title, lines: CAPSULE_NOTE.lines, sign: CAPSULE_NOTE.sign,
      statsTitle: { zh: `你的时间胶囊 · ${d.year} 年 ${d.month} 月 ${d.day} 日`, en: `Your time capsule · ${d.dateKey}` },
      stats: capsuleStats(),
    }, () => { reveal(OCTAGON, { cardDelay: 1.4 }); });
  };
  return {
    id: OCTAGON,
    range: 30,
    interactables: () => [{
      id: `egg:${OCTAGON}`, source: 'find', action: 'info', verb: { zh: '打开小铁盒', en: 'Open the tin' }, name: egg.name,
      x: egg.at.x, z: egg.at.z, radius: 2.6, act: open,
    }],
    dispose: () => props.set(`egg:${OCTAGON}`, null),
    qa: open,
  };
}

// --- egg 12 · the foghorn duet --------------------------------------------------------------------------------------

const FOG = 'ggb-foghorn-duet';
/** The towers (world/sf/landmarks/golden-gate-bridge.ts) and the deck line between the anchorages. */
export const GGB = {
  south: { x: -796.1, z: 564.4 },
  north: { x: -935.5, z: 452.7 },
  /** along the deck from mid-span (u, + = north): the south / north anchorages */
  deck: { from: -160.33, to: 144.37, halfWidth: 4, minY: 11 },
} as const;
/** Mid-span and the deck's axis (unit, south → north). */
export const MID = { x: (GGB.south.x + GGB.north.x) / 2, z: (GGB.south.z + GGB.north.z) / 2 };
export const AX = (() => { const dx = GGB.north.x - GGB.south.x, dz = GGB.north.z - GGB.south.z, l = Math.hypot(dx, dz); return { x: dx / l, z: dz / l }; })();
/** Along the deck from mid-span (u, + = north) and across it (+ = the Bay side, towards Alcatraz). */
export function deckCoords(x: number, z: number): { along: number; across: number } {
  const rx = x - MID.x, rz = z - MID.z;
  return { along: rx * AX.x + rz * AX.z, across: rx * -AX.z + rz * AX.x };
}

/** On the bridge deck (between the anchorages, on the deck's width, up at deck height). */
export function onDeck(x: number, y: number, z: number): boolean {
  const rx = x - MID.x, rz = z - MID.z;
  const s = rx * AX.x + rz * AX.z, across = Math.abs(-rx * AX.z + rz * AX.x);
  return s >= GGB.deck.from && s <= GGB.deck.to && across <= GGB.deck.halfWidth && y >= GGB.deck.minY;
}

/**
 * The real pattern (goldengate.org, read 2026-09-28): the south tower pier: 2 s on, 18 s off; mid-span: a 9 s pause,
 * then 1 s, 2 s pause, 1 s, 36 s pause, repeating. Returns which horns START a blast in (t0, t1] (seconds since the fog
 * came in): the host plays them.
 */
export function hornStarts(t0: number, t1: number): { south: boolean; mid: boolean } {
  const hit = (times: (k: number) => number, first: number, period: number) => {
    const k0 = Math.max(0, Math.floor((t0 - first) / period) - 1);
    for (let k = k0; k < k0 + 4; k++) { const t = times(k); if (t > t0 && t <= t1) return true; }
    return false;
  };
  const south = hit(k => k * 20, 0, 20);
  const mid = hit(k => 9 + Math.floor(k / 2) * 40 + (k % 2) * 3, 9, 20);
  return { south, mid };
}

/** Karl's fog at the bridge now (0 … 1): his level × the Golden Gate lobe reaching the span (≈ 520 u along the strait). */
export function fogAtBridge(): number {
  const level = KARL.uKarl.value;
  const a = KARL.uKarlA.value;
  const gate = a.z, gateLen = a.w;
  const t = Math.min(1, Math.max(0, (520 - (gateLen - 160)) / 160));
  return level * gate * (1 - t * t * (3 - 2 * t));
}
export const FOG_ON = 0.4;

export function foghornHost(): EggHost {
  const egg = eggById(FOG)!;
  let fogT = -1;
  let heardSouth = -Infinity, heardMid = -Infinity;
  let forced = 0;
  const heard = (at: { x: number; z: number }) => Math.hypot(at.x - runtime.player.x, at.z - runtime.player.z) < 420;
  return {
    id: FOG,
    range: 700,
    update: ctx => {
      const foggy = fogAtBridge() >= FOG_ON || ctx.t < forced;
      if (!foggy) { fogT = -1; return; }
      const t0 = fogT < 0 ? -0.001 : fogT;
      fogT = t0 + ctx.dt;
      const s = hornStarts(t0, fogT);
      if (s.south) { sound('egg:horn-south', GGB.south, { near: 40, far: 700 }); if (heard(GGB.south)) heardSouth = ctx.t; }
      if (s.mid) { sound('egg:horn-mid', MID, { near: 40, far: 700 }); if (heard(MID)) heardMid = ctx.t; }
      // both heard within the last 45 s while standing on the deck: the find
      if (onDeck(ctx.px, ctx.py, ctx.pz) && ctx.t - heardSouth < 45 && ctx.t - heardMid < 45 && !ctx.found && momentFree()) {
        reveal(FOG, { cardDelay: 3.5 });
      }
    },
    leave: () => { fogT = -1; },
    qa: () => {
      forced = hostClock() + 120;
      say(egg.lines[0]);
      sound('egg:horn-south', GGB.south, { near: 40, far: 700 });
      setTimeout(() => sound('egg:horn-mid', MID, { near: 40, far: 700 }), 2600);
      setTimeout(() => sound('egg:horn-mid', MID, { near: 40, far: 700 }), 4600);
    },
  };
}
