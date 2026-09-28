import { Gem } from 'lucide-react';
import type * as THREE from 'three';
import { charApi } from '../actors/charApi';
import { playSound } from '../audio/hooks';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import type { Bilingual } from '../core/types';
import { registerAskItem } from '../ui/slots';
import { spawnFx } from '../world/fx';
import { type EggHost, hostClock, momentFree, props, queueCard, say, sayMore, sound } from './hosts';
import { paidSet } from './paid';
import {
  GOLDEN_AT, PEBBLE_COINS, PEBBLE_IDS, PEBBLE_PICK, PEBBLE_POINT, PEBBLE_SNIFF, PEBBLE_TRICKS, PEBBLES,
  pebbleRewardSource, tricksAt, type PebbleDef, type PebbleTrick,
} from './pebbleSpots';
import { heldPebbleMesh } from './props';

/**
 * Wave 5 · lane D (W5-D6) · BAYBAY's pebbles in the world: the 48 stones lie in the prop pool (drawn only within its
 * range, gone once picked up); one host (≈ 10 Hz) sniffs for the nearest unfound one on foot — BAYBAY wiggles happily
 * within PEBBLE_SNIFF (her `pet` wiggle; a line the first two times a session), points within PEBBLE_POINT (a glint on
 * the stone), and walking over it puts it in her pouch: `find { kind: 'pebble' }`, `reward pebble:<id>` (3 金币 once,
 * lane E's ledger), a clack, "收进口袋！第 n 块。". The first pebble opens the card (what the aquarium says about otters
 * and rocks); 10 / 25 / 40 teach a trick she shows at once (and later from 问 BAYBAY → 玩石子); 48 = the golden pebble.
 * The compass (lane E) points at the nearest unfound one (registerHintSource('pebble')).
 */

const sessionFound = new Set<string>();
/** the pebbles lane E's ledger has paid (a memo: the host asks ten times a second, the compass four) */
const paidPebbles = paidSet(pebbleRewardSource, () => PEBBLE_IDS);
/** In the pouch: the ledger's bit (play.g.pebble) or this session. */
export function pebbleFound(id: string): boolean {
  return sessionFound.has(id) || paidPebbles().has(id);
}
export const pebbleCount = (): number => {
  const paid = paidPebbles();
  let n = paid.size;
  for (const id of sessionFound) if (!paid.has(id)) n++;
  return n;
};
export const hasGolden = (): boolean => pebbleCount() >= GOLDEN_AT;

export const SNIFF_LINES: readonly Bilingual[] = [
  { zh: '嗯？这附近好像有块好石头……', en: 'Hm? There’s a good pebble around here…' },
  { zh: '我闻到小石子的味道啦！', en: 'I can smell a pebble!' },
];
export const FIRST_LINE: Bilingual = { zh: '好圆的石头！我收进口袋啦——海獭都爱石头。', en: 'What a round one! Into my pouch — otters love rocks.' };
export const countLine = (n: number): Bilingual => ({ zh: `收进口袋！这是第 ${n} 块。`, en: `Into the pouch! That’s number ${n}.` });
export const TRICK_LINES: Readonly<Record<PebbleTrick, Bilingual>> = {
  tap: { zh: '十块啦！我学会了海獭的老本事：在肚皮上敲石子。', en: 'Ten! I’ve learned the old otter trick: tapping a stone on my tummy.' },
  balance: { zh: '二十五块！看，我能把石子顶在头上。', en: 'Twenty-five! Look — I can balance a pebble on my head.' },
  dance: { zh: '四十块！来一段石子舞！', en: 'Forty! Time for a pebble dance!' },
};
export const GOLDEN_LINE: Bilingual = { zh: '四十八块全齐啦！这块金色的，是我最宝贝的。', en: 'All forty-eight! And this golden one is my greatest treasure.' };
export const SHOW_LINE: Bilingual = { zh: '看我的！', en: 'Watch this!' };
export const ASK_LABEL: Bilingual = { zh: '玩石子', en: 'Pebble trick' };

// --- BAYBAY's tricks (charApi: emotes and a stone on a body slot; skipped quietly without it or when she is away) -----

let unplace: (() => void) | null = null;
let heldTimer: ReturnType<typeof setTimeout> | null = null;
const trickTimers: ReturnType<typeof setTimeout>[] = [];
let showing = false;

type Slot = 'head' | 'neck';
/** lane F's implementation can say what is on a slot (not in the frozen interface: read it when it is there) */
type SlotReader = { attachedAt?: (who: 'player' | 'baybay', slot: Slot) => THREE.Object3D | null };

/**
 * Put the stone on BAYBAY's `slot` without taking anything off her: on top of what is there (lane E's hat) or on the
 * empty slot; returns the undo. When the implementation cannot say what is on the slot, no stone (the emote only).
 */
function place(api: NonNullable<ReturnType<typeof charApi>>, slot: Slot, mesh: THREE.Mesh): () => void {
  const read = (api as unknown as SlotReader).attachedAt;
  if (typeof read !== 'function') return () => {};
  const prev = read.call(api, 'baybay', slot);
  if (prev) {
    mesh.position.y += 0.34;
    prev.add(mesh);
    return () => { prev.remove(mesh); };
  }
  api.attach('baybay', slot, mesh);
  return () => { try { if (read.call(api, 'baybay', slot) === mesh) api.attach('baybay', slot, null); } catch { /* the actors went away */ } };
}

function drop(): void {
  if (heldTimer) clearTimeout(heldTimer);
  heldTimer = null;
  const undo = unplace;
  unplace = null;
  undo?.();
  showing = false;
}

/** BAYBAY is near enough to be seen doing it (and on her own feet: charApi skips the body moods otherwise). */
const baybayNear = () => Math.hypot(runtime.guide.x - runtime.player.x, runtime.guide.z - runtime.player.z) <= 12;

/** Show `trick` now (true when it started). */
export function performTrick(trick: PebbleTrick | 'golden'): boolean {
  const api = charApi();
  if (!api || showing || !baybayNear()) return false;
  drop();
  showing = true;
  const gold = trick === 'golden' || hasGolden();
  const held = heldPebbleMesh(gold);
  const g = runtime.guide;
  let seconds = 3.2;
  if (trick === 'tap') {
    // on her back, the stone on her chest, three taps (the neck slot's frame lies on her chest when she floats)
    held.position.set(0, 0.06, 0.2);
    unplace = place(api, 'neck', held);
    api.emote('baybay', 'float', { loop: true, seconds: 4.2 });
    for (const at of [0.9, 1.5, 2.1, 2.5]) trickTimers.push(setTimeout(() => sound('egg:tap', { x: g.x, z: g.z }, { near: 6, far: 40 }), at * 1000));
    seconds = 4.4;
  } else {
    held.position.set(0, -0.03, 0.05);
    unplace = place(api, 'head', held);
    if (trick === 'balance') api.emote('baybay', 'pose', { seconds: 3 });
    else if (trick === 'dance') { api.emote('baybay', 'dance', { loop: true, seconds: 3.6 }); seconds = 3.8; }
    else { api.emote('baybay', 'cheer'); seconds = 4; }
    trickTimers.push(setTimeout(() => spawnFx('sparkle', g.x, g.y + 2.2, g.z, { count: 10, color: gold ? '#f3c75a' : '#dfe6ec' }), 400));
  }
  heldTimer = setTimeout(drop, seconds * 1000);
  return true;
}

/** 问 BAYBAY → 玩石子: the tricks she knows, one after the other. */
let nextShow = 0;
export function showNextTrick(): boolean {
  const known: (PebbleTrick | 'golden')[] = [...tricksAt(pebbleCount())];
  if (hasGolden()) known.push('golden');
  if (!known.length) return false;
  const t = known[nextShow % known.length];
  nextShow++;
  if (!performTrick(t)) return false;
  sayMore(SHOW_LINE);
  return true;
}

// --- the find ------------------------------------------------------------------------------------------------------

/** A pebble line replaces the previous pebble line (two stones picked close together say one count, not a queue). */
let lastLineAt = -Infinity;
function pebbleSay(line: Bilingual): void {
  const t = hostClock();
  if (t - lastLineAt < 6) say(line); else sayMore(line);
  lastLineAt = t;
}

function collect(def: PebbleDef): void {
  if (pebbleFound(def.id)) return;
  emit({ type: 'find', kind: 'pebble', id: def.id, first: true });
  sessionFound.add(def.id);
  emit({ type: 'reward', source: pebbleRewardSource(def.id), coins: PEBBLE_COINS });
  props.set(`pebble:${def.id}`, null);
  sound('egg:pebble', def, { near: 4, far: 30 });
  spawnFx('sparkle', def.x, runtime.player.y + 0.6, def.z, { count: 10, color: '#dfe6ec' });
  const n = pebbleCount();
  const trick = PEBBLE_TRICKS.find(t => t.at === n);
  if (n === 1) {
    pebbleSay(FIRST_LINE);
    queueCard({ id: 'first', kind: 'pebble', coins: PEBBLE_COINS }, 1600);
  } else if (n >= GOLDEN_AT) {
    playSound('egg:stars');
    pebbleSay(GOLDEN_LINE);
    trickTimers.push(setTimeout(() => { performTrick('golden'); }, 900));
    queueCard({ id: 'golden', kind: 'pebble', coins: PEBBLE_COINS }, 2400);
  } else if (trick) {
    pebbleSay(TRICK_LINES[trick.id]);
    trickTimers.push(setTimeout(() => { performTrick(trick.id); }, 1200));
  } else pebbleSay(countLine(n));
}

/** QA / tests: put pebble `id` in the pouch now (as walking over it would). */
export function pickPebble(id: string): boolean {
  const def = PEBBLES.find(q => q.id === id);
  if (!def || pebbleFound(def.id)) return false;
  collect(def);
  return true;
}

/** The unfound pebbles (lane E's compass). */
export const pebbleHintSpots = (): { id: string; x: number; z: number }[] => PEBBLES.filter(q => !pebbleFound(q.id)).map(q => ({ id: q.id, x: q.x, z: q.z }));

/** A stable little turn per pebble (they never all face one way). */
const turnOf = (id: string) => { let h = 7; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return ((h % 628) / 100); };

/** The host: the stones in the pool, the sniffing, the pointing, the pick-up; the 玩石子 ask item; the compass list. */
export function pebblesHost(): EggHost {
  const place = () => { for (const q of PEBBLES) if (!pebbleFound(q.id)) props.set(`pebble:${q.id}`, { kind: 'pebble', x: q.x, z: q.z, heading: turnOf(q.id) }); };
  place();
  const sniffed = new Set<string>(), pointed = new Set<string>();
  let lines = 0, glintAt = 0;
  const offAsk = registerAskItem({ id: 'eggs-pebbles', order: 40, label: ASK_LABEL, icon: Gem, visible: () => tricksAt(pebbleCount()).length > 0, onSelect: () => { showNextTrick(); } });
  return {
    id: 'pebbles',
    range: Infinity,
    isFound: () => pebbleCount() >= GOLDEN_AT,
    // (review) Settings → reset progress: the pouch is empty again — every stone back where it lay, the tricks unlearnt
    reset: () => {
      sessionFound.clear();
      paidPebbles.forget();
      for (const t of trickTimers.splice(0)) clearTimeout(t);
      drop();
      nextShow = 0; lastLineAt = -Infinity;
      sniffed.clear(); pointed.clear(); lines = 0;
      place();
    },
    update: ctx => {
      if (runtime.move.mode !== 'foot') return;
      let best: PebbleDef | null = null, bd = Infinity;
      for (const q of PEBBLES) {
        const d = Math.hypot(q.x - ctx.px, q.z - ctx.pz);
        if (d > PEBBLE_SNIFF + 15) { sniffed.delete(q.id); pointed.delete(q.id); continue; }
        if (d < bd && !pebbleFound(q.id)) { best = q; bd = d; }
      }
      if (!best || bd > PEBBLE_SNIFF) return;
      if (bd <= PEBBLE_PICK) { collect(best); return; }
      const api = charApi();
      const near = baybayNear();
      if (bd <= PEBBLE_POINT) {
        if (ctx.t >= glintAt) { glintAt = ctx.t + 2.5; spawnFx('sparkle', best.x, runtime.player.y + 0.5, best.z, { count: 5, color: '#ffffff' }); }
        if (!pointed.has(best.id)) {
          pointed.add(best.id);
          if (api && near && !showing) api.emote('baybay', 'point');
          sound('egg:ting', best, { near: 4, far: 20, gain: 0.35, pitch: 1.3 });
        }
        return;
      }
      if (sniffed.has(best.id)) return;
      sniffed.add(best.id);
      if (api && near && !showing) api.emote('baybay', 'pet');
      sound('egg:sniff', { x: runtime.guide.x, z: runtime.guide.z }, { near: 6, far: 30 });
      if (lines < SNIFF_LINES.length && momentFree()) sayMore(SNIFF_LINES[lines++]);
    },
    dispose: () => {
      offAsk();
      for (const q of PEBBLES) props.set(`pebble:${q.id}`, null);
      for (const t of trickTimers.splice(0)) clearTimeout(t);
      drop();
    },
    qa: () => { const q = PEBBLES.find(x => !pebbleFound(x.id)); if (q) collect(q); },
  };
}

/** Tests: forget the session. */
export function __resetPebblesForTests(): void {
  sessionFound.clear(); paidPebbles.forget(); nextShow = 0; lastLineAt = -Infinity;
  for (const t of trickTimers.splice(0)) clearTimeout(t);
  drop();
}
