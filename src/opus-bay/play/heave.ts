import { charApi } from '../actors/charApi';
import { audioNow, playSound } from '../audio/hooks';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import type { Bilingual } from '../core/types';
import { transitData } from '../data/transit';
import { bubble } from '../game/flow';
import { registerFrameSystem } from '../game/systemsRegistry';
import { pushTurntable, turntableBeat, turntableNear } from '../game/transit';
import { spawnFx } from '../world/fx';
import { hideChip, patchChip, showChip } from './chip';
import { bestOf, RhythmJudge, saveNumber, startActivity, tierFor, type ActivityRun } from './kit';
import { ensurePlaySounds3 } from './sounds3';
import { sayWhenQuiet } from './zones';
import { HEAVE_ID, HEAVE_NAME } from './zones3';

/**
 * Wave 5 · lane A · the turntable heave-ho (W5-A9, plan §3.2 A-turn): when a Powell cable car turns on a turntable
 * near the player (lane T's turntableNear / turntableBeat on audioNow(): a beat every 1.2 s from when the turn was first
 * seen), 嘿咻，推！ (phone: the contextual button; desktop: E) helps push it round. BAYBAY calls the beat — 嘿— on the
 * half beat, 咻！ on the beat (a sound and the chip's big word) — and a push on the beat (PlayKit's RhythmJudge, ±150 ms,
 * the player's own offset learnt from the first taps) is a big shove (lane T's pushTurntable(id, 2)); off the beat a
 * small one (1). The car only turns (presentation), and it is done when it has turned. The card: ● pushed, ◆ two pushes
 * on the beat, ★ three; the best is the most on-beat pushes. A stamp (`medal:turntables:3`, 15 coins) the first time all
 * three turntables have been pushed (Powell & Market, Hyde & Beach, Taylor & Bay; the set is kept in `play.b` as a mask).
 *
 * Never locks the feet; walking off 16 u ends it at no cost. Fact (checked 2026-09-28): "there are manually powered
 * turntables at each end to reverse the cars" (https://en.wikipedia.org/wiki/San_Francisco_cable_car_system).
 */

ensurePlaySounds3();

export const HEAVE_LINES = {
  start: { zh: '跟着我喊：嘿——咻！咻的时候推！', en: 'Shout with me: heave — ho! Push on the "ho"!' },
  hit: { zh: '咻！正好！', en: 'Ho! Spot on!' },
  early: { zh: '早了一点', en: 'A bit early' },
  late: { zh: '晚了一点', en: 'A bit late' },
  fact: { zh: '叮当车终点的转盘是人力推的，车就这样掉头！', en: 'The cable-car turntables are pushed by hand — that’s how the cars turn!' },
  all: { zh: '三个转盘都推过啦！盖个章～', en: 'All three turntables pushed! A stamp for you!' },
} satisfies Record<string, Bilingual>;

/** On-beat pushes for ● / ◆ / ★ (● = any push at all). */
export const HEAVE_THRESHOLDS: readonly [number, number, number] = [0, 2, 3];
export const HEAVE_LEAVE_R = 16;
/** play.b key: the turntables pushed so far (bit i = the i-th turntable id in sorted order) and the stamp's source. */
export const HEAVE_SET_KEY = 'heave-tt';
export const HEAVE_STAMP = 'medal:turntables:3';

/** What the heave-ho needs from lane T (tests stub them). */
export interface HeaveHooks {
  near: typeof turntableNear;
  beat: (id: string) => { period: number; next: number; n: number } | null;
  push: typeof pushTurntable;
  now: () => number;
  ids: () => string[];
}
let hooks: HeaveHooks = {
  near: turntableNear,
  beat: id => turntableBeat(id),
  push: pushTurntable,
  now: audioNow,
  ids: () => (transitData()?.turntables ?? []).map(t => t.id).sort(),
};
/** tests: replace lane T's hooks (null = the real ones) */
export function __setHeaveHooks(h: Partial<HeaveHooks> | null) {
  hooks = h ? { ...hooks, ...h } : { near: turntableNear, beat: id => turntableBeat(id), push: pushTurntable, now: audioNow, ids: hooks.ids };
}

interface Heave { id: string; name: Bilingual; x: number; z: number; run: ActivityRun; judge: RhythmJudge; pushes: number; onBeat: number; lastN: number; cueHalf: number }
let heave: Heave | null = null;
let offFrame: (() => void) | null = null;
let rounds = 0;

export const heaveState = (): Readonly<Heave> | null => heave;

/**
 * One press of 嘿咻，推！ at turntable `id` (the prompt's act): the first starts the heave-ho, each is judged against
 * BAYBAY's beat and pushes the car (2 on the beat, 1 off it). False when nothing turns there.
 */
export function heavePush(id: string): boolean {
  const tt = hooks.near();
  if (!tt || tt.id !== id) return false;
  if (!heave || heave.id !== id) {
    const run = startActivity({ id: HEAVE_ID, name: HEAVE_NAME, better: 'higher' }, { onStop: () => stop() });
    if (!run) return false;
    rounds++;
    heave = { id, name: tt.name, x: tt.x, z: tt.z, run, judge: new RhythmJudge({ clock: hooks.now }), pushes: 0, onBeat: 0, lastN: -1, cueHalf: -1 };
    showChip({ id: HEAVE_ID, title: HEAVE_NAME, icon: 'play', big: '嘿', status: { zh: '推 0 · 正好 0', en: 'Pushes 0 · on beat 0' }, action: { label: { zh: '不推了', en: 'Stop' }, run: cancelHeave } });
    if (rounds === 1) bubble(HEAVE_LINES.start, 3000);
    charApi()?.emote('baybay', 'cheer');
    offFrame = registerFrameSystem('a-play-heave', step);
  }
  const h = heave!;
  const b = hooks.beat(id);
  let hit = false;
  if (b) {
    const j = h.judge.judgeNearest([b.next - b.period, b.next]);
    hit = j.kind === 'hit';
    patchChip(HEAVE_ID, { line: hit ? HEAVE_LINES.hit : j.kind === 'early' ? HEAVE_LINES.early : HEAVE_LINES.late });
  }
  hooks.push(id, hit ? 2 : 1);
  h.pushes++;
  if (hit) {
    h.onBeat++;
    playSound('play-pop', { pitch: 1 + Math.min(4, h.onBeat) * 0.08 });
    spawnFx('sparkle', h.x, runtime.player.y + 1.2, h.z, { color: '#ffd27a', scale: 0.8, count: 8 });
  }
  patchChip(HEAVE_ID, { status: { zh: `推 ${h.pushes} · 正好 ${h.onBeat}`, en: `Pushes ${h.pushes} · on beat ${h.onBeat}` } });
  return true;
}

function step() {
  const h = heave;
  if (!h) return;
  const p = runtime.player;
  if (Math.hypot(p.x - h.x, p.z - h.z) > HEAVE_LEAVE_R) { h.run.cancel(); return; }
  const b = hooks.beat(h.id);
  if (!b) { finish(h); return; }
  // BAYBAY's call (the chip's big word and a sound): 咻！ as a beat passes, 嘿— half a beat before the next
  if (h.lastN !== b.n) {
    if (h.lastN >= 0) { patchChip(HEAVE_ID, { big: '咻！' }); playSound('play-heave', { pitch: 1.5 }); }
    h.lastN = b.n;
  }
  if (hooks.now() >= b.next - b.period / 2 && h.cueHalf !== b.n) { h.cueHalf = b.n; patchChip(HEAVE_ID, { big: '嘿—' }); playSound('play-heave'); }
}

function finish(h: Heave) {
  const tier = tierFor(h.onBeat, HEAVE_THRESHOLDS);
  // the turntables pushed so far (a mask in play.b); the stamp the first time all of them are in it
  const ids = hooks.ids(), i = ids.indexOf(h.id);
  const before = bestOf(HEAVE_SET_KEY) ?? 0;
  const mask = i >= 0 ? before | (1 << i) : before;
  if (mask !== before) saveNumber(HEAVE_SET_KEY, mask);
  const all = ids.length > 0 && mask === (1 << ids.length) - 1 && before !== mask;
  h.run.end({
    tier,
    score: h.onBeat,
    detail: { zh: `推了 ${h.pushes} 下 · 踩中节拍 ${h.onBeat} 次`, en: `${h.pushes} pushes · ${h.onBeat} on the beat` },
    bestText: v => ({ zh: `最多一次踩中 ${v} 拍！`, en: `Your best: ${v} on the beat!` }),
  });
  if (all) {
    emit({ type: 'reward', source: HEAVE_STAMP, coins: 15, stamp: HEAVE_STAMP });
    sayWhenQuiet(HEAVE_LINES.all, 2800);
  } else if (rounds === 1) sayWhenQuiet(HEAVE_LINES.fact, 3000);
}

function stop() {
  offFrame?.(); offFrame = null;
  hideChip(HEAVE_ID);
  heave = null;
}

/** 不推了 / walking off / tests: end it now at no cost. */
export function cancelHeave() { heave?.run.cancel(); }

/** tests */
export function __resetHeave() { heave?.run.cancel(); heave = null; rounds = 0; }
