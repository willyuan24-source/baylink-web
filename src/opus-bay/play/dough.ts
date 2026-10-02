import { charApi } from '../actors/charApi';
import { playSound } from '../audio/hooks';
import { bubble } from '../game/flow';
import { flow } from '../game/flowStore';
import { game as obStore } from '../core/store';
import { registerFrameSystem } from '../game/systemsRegistry';
import { closeOverlay, openOverlay } from '../ui/slots';
import { runtime } from '../core/runtime';
import { CANCEL_GRACE, MOVE_CANCEL, startActivity, tierFor, type ActivityRun } from './kit';
import { freeOnFoot, holdKeys, type HeldKeys } from './partc';
import { DOUGH_ID, DOUGH_LINES, DOUGH_NAME } from './sfgamesLines';
import { ensureSfSounds } from './sfgamesSounds';
import { sayWhenQuiet } from './zones';

/**
 * Wave 7 · lane M · shaping a sourdough loaf at a Wharf bakery (about 40 s, three judged steps and a choice):
 *
 *   揉面 knead   eight beats: a ring closes on the dough; tap (揉！/ Space) as it meets it — fold and press      0–40
 *   整形 shape   a round boule, a crab or a turtle (the Wharf's bakers really shape loaves into animals)           —
 *   划口 score   the blade swings over the loaf; tap as it crosses each of the three dashed guides               0–30
 *   烤  bake     the loaf browns in the oven: take it out (出炉！) while the crust is in the golden band        0–30
 *
 * Points 0–100; tiers ● 40 · ◆ 65 · ★ 85 → `medal:sourdough:n`; best = points. Nothing is timed on the wall clock: the
 * game is stepped by the game loop (a paused game pauses the oven). Facts (checked 2026-09-29): a San Francisco staple since
 * the 1849 Gold Rush (https://en.wikipedia.org/wiki/History_of_bread_in_California); the starter's bacterium is named after
 * the city (https://en.wikipedia.org/wiki/Fructilactobacillus_sanfranciscensis); the Wharf's bakers sculpt loaves into
 * crabs, turtles, teddy bears and alligators (https://kirbiecravings.com/sculpted-bread-animals-at-boudin-in-sf/). No
 * bakery is named in the game.
 */

export const BEATS = 8, BEAT_S = 0.72, LEAD_S = 1.6;
/** Tap windows (s) around a beat: perfect / good. */
export const PERFECT = 0.09, GOOD = 0.2;
/** The blade: one sweep across the loaf (s); the guides where it should cut (0…1 across the loaf); a cut's reach. */
export const SWEEP_S = 1.5, GUIDES = [0.3, 0.5, 0.7] as const, CUT_GOOD = 0.1;
/** The oven: the crust's colour 0 (pale) … 1 (burnt) over BAKE_S; the golden band. */
export const BAKE_S = 9, GOLD_LO = 0.55, GOLD_HI = 0.72;
export const DOUGH_TIERS: readonly [number, number, number] = [40, 65, 85];

export type DoughShape = 'boule' | 'crab' | 'turtle';
export const SHAPES: readonly DoughShape[] = ['boule', 'crab', 'turtle'];
export type DoughPhase = 'knead' | 'shape' | 'score' | 'bake' | 'done';
export type DoughEvent = 'beat' | 'perfect' | 'good' | 'miss' | 'shaped' | 'cut' | 'cut-miss' | 'baked' | 'done';

/** A cut's points (0–10) by how far across the loaf it landed from the nearest guide not cut yet. */
export function cutPoints(d: number): number { return d > CUT_GOOD ? 0 : Math.round(10 * (1 - d / CUT_GOOD) ** 0.7); }
/** The bake's points (0–30): 30 in the middle of the golden band, falling to 0 a band's width outside it. */
export function bakePoints(c: number): number {
  const mid = (GOLD_LO + GOLD_HI) / 2, half = (GOLD_HI - GOLD_LO) / 2, d = Math.abs(c - mid);
  if (d <= half) return Math.round(30 - 8 * (d / half));
  return Math.max(0, Math.round(22 * (1 - (d - half) / (half * 2))));
}

export class DoughGame {
  phase: DoughPhase = 'knead';
  t = 0;
  /** knead */
  beat = 0;
  hits: ('perfect' | 'good' | 'miss')[] = [];
  knead = 0;
  /** shape */
  shape: DoughShape = 'boule';
  /** score: the blade's place across the loaf 0…1, the cuts made (their places) */
  blade = 0;
  cuts: number[] = [];
  scoring = 0;
  /** bake: the crust 0…1 */
  crust = 0;
  baked = 0;
  get score() { return this.knead + this.scoring + this.baked; }
  private go(p: DoughPhase) { this.phase = p; this.t = 0; }
  /** the time of beat i (s from the knead's start) */
  beatAt(i: number) { return LEAD_S + i * BEAT_S; }
  /** 揉！ / 划！ / 出炉！ — the one button of the step */
  tap(): DoughEvent[] {
    const ev: DoughEvent[] = [];
    if (this.phase === 'knead') {
      if (this.beat >= BEATS) return ev;
      const d = Math.abs(this.t - this.beatAt(this.beat));
      if (d > GOOD * 1.8) return ev; // a tap far from any beat: ignored (no penalty for nerves)
      const k = d <= PERFECT ? 'perfect' : d <= GOOD ? 'good' : 'miss';
      this.hits.push(k); this.beat++;
      this.knead += k === 'perfect' ? 5 : k === 'good' ? 3 : 0;
      ev.push(k);
      if (this.beat >= BEATS) { this.go('shape'); }
    } else if (this.phase === 'score') {
      if (this.cuts.length >= GUIDES.length) return ev;
      const open = GUIDES.filter(gd => !this.cuts.some(c => Math.abs(c - gd) < CUT_GOOD));
      const d = open.length ? Math.min(...open.map(gd => Math.abs(gd - this.blade))) : 1;
      this.cuts.push(this.blade);
      const p = cutPoints(d);
      this.scoring += p;
      ev.push(p > 0 ? 'cut' : 'cut-miss');
      if (this.cuts.length >= GUIDES.length) this.go('bake');
    } else if (this.phase === 'bake') {
      this.baked = bakePoints(this.crust);
      ev.push('baked', 'done');
      this.go('done');
    }
    return ev;
  }
  pick(s: DoughShape): DoughEvent[] { if (this.phase !== 'shape') return []; this.shape = s; this.go('score'); return ['shaped']; }
  step(dt: number): DoughEvent[] {
    const ev: DoughEvent[] = [];
    if (this.phase === 'done' || this.phase === 'shape' || !(dt > 0)) return ev;
    this.t += dt;
    if (this.phase === 'knead') {
      // a beat that passed its window untapped is a miss
      while (this.beat < BEATS && this.t > this.beatAt(this.beat) + GOOD * 1.8) { this.hits.push('miss'); this.beat++; ev.push('miss'); }
      if (this.beat >= BEATS) this.go('shape');
    } else if (this.phase === 'score') {
      // the blade sweeps across and back (a triangle wave); after 5 sweeps the missing cuts are made where it is
      const u = (this.t / SWEEP_S) % 2;
      this.blade = u <= 1 ? u : 2 - u;
      if (this.t > SWEEP_S * 10) while (this.phase === 'score') ev.push(...this.tap());
    } else if (this.phase === 'bake') {
      this.crust = Math.min(1, this.t / BAKE_S);
      if (this.crust >= 1) ev.push(...this.tap());
    }
    return ev;
  }
}

export const doughTier = (score: number) => tierFor(score, DOUGH_TIERS);

// --- the run ---------------------------------------------------------------------------------------------------------------

export const DOUGH_OVERLAY = 'play-dough';
interface Run { run: ActivityRun; game: DoughGame; keys: HeldKeys | null; off: () => void; quiet: number }
let cur: Run | null = null;
let listeners = new Set<() => void>();
let seq = 0;
const changed = () => { seq++; for (const fn of [...listeners]) fn(); };
export const doughSeq = () => seq;
export function subscribeDough(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export const doughGame = (): DoughGame | null => cur?.game ?? null;
let rounds = 0;

/** 捏酸面包 at the bakery. Returns whether a game started. */
export function startDough(): boolean {
  if (cur || !freeOnFoot()) return false;
  // the stick gives up (the kit's cancelOnMove, kept here): not once the loaf is out — its card comes FINISH_MS later, and a
  // thumb back on the stick in that beat lost the medals and the card (W7-M-review)
  const run = startActivity({ id: DOUGH_ID, name: DOUGH_NAME, better: 'higher' }, { lock: true, onStop: how => { if (how === 'cancel') cleanup(); } });
  if (!run) return false;
  ensureSfSounds();
  const game = new DoughGame();
  const keys = holdKeys(['Space', 'Enter', 'Digit1', 'Digit2', 'Digit3', 'Escape', 'KeyE'], code => {
    if (code === 'Escape') { cancelDough(); return; }
    if (code === 'Space' || code === 'Enter') doughTap();
    else if (game.phase === 'shape') doughPick(SHAPES[Number(code.slice(5)) - 1] ?? 'boule');
  });
  const r: Run = { run, game, keys, off: () => {}, quiet: performance.now() + 90000 };
  let grace = CANCEL_GRACE;
  r.off = registerFrameSystem('m-play-dough', dt => {
    // (W9-G-review G-RV-2) Settings pauses the game: the oven waits too
    if (cur !== r || obStore.get().paused) return;
    if (grace > 0) grace -= dt;
    else if (game.phase !== 'done' && Math.hypot(runtime.input.moveX, runtime.input.moveY) > MOVE_CANCEL) { cancelDough(); return; }
    const before = game.phase, beat = game.beat;
    for (const e of game.step(Math.min(dt, 0.1))) onDoughEvent(r, e);
    if (before !== game.phase || beat !== game.beat) changed();
  });
  cur = r;
  rounds++;
  openOverlay(DOUGH_OVERLAY);
  flow.set({ quietUntil: Math.max(flow.get().quietUntil, r.quiet) });
  bubble(DOUGH_LINES.knead, 2600);
  changed();
  return true;
}

/** The panel's buttons. */
export function doughTap() { const r = cur; if (!r) return; for (const e of r.game.tap()) onDoughEvent(r, e); changed(); }
export function doughPick(s: DoughShape) { const r = cur; if (!r) return; for (const e of r.game.pick(s)) onDoughEvent(r, e); changed(); }

function onDoughEvent(r: Run, e: DoughEvent) {
  const g = r.game;
  switch (e) {
    case 'perfect': case 'good': playSound('m-pat', { pitch: e === 'perfect' ? 1.15 : 1 }); break;
    case 'miss': playSound('m-pat', { gain: 0.4, pitch: 0.7 }); break;
    case 'shaped': bubble(DOUGH_LINES.score, 2400); break;
    case 'cut': playSound('m-grab', { pitch: 1.5 }); break;
    case 'cut-miss': playSound('m-grab', { pitch: 0.8, gain: 0.5 }); break;
    case 'baked': {
      playSound('m-ding');
      const c = g.crust;
      bubble(c < GOLD_LO ? DOUGH_LINES.pale : c > GOLD_HI ? DOUGH_LINES.dark : DOUGH_LINES.golden, 2400);
      break;
    }
    case 'done': finish(r); break;
  }
  // the step's own line as it begins
  if (g.phase === 'shape' && e !== 'shaped' && g.t === 0 && (e === 'perfect' || e === 'good' || e === 'miss')) bubble(DOUGH_LINES.shape, 2600);
  if (g.phase === 'bake' && g.t === 0 && (e === 'cut' || e === 'cut-miss')) bubble(DOUGH_LINES.bake, 2400);
}

const SHAPE_NAME: Record<DoughShape, { zh: string; en: string }> = {
  boule: { zh: '圆面包', en: 'a round boule' }, crab: { zh: '螃蟹面包', en: 'a crab loaf' }, turtle: { zh: '乌龟面包', en: 'a turtle loaf' },
};

function finish(r: Run) {
  const g = r.game;
  // the card after a beat: the loaf out of the oven stays on the panel for a moment
  setTimeout(() => {
    if (cur !== r) return;
    cleanup(r);
    r.run.end({
      tier: doughTier(g.score),
      score: g.score,
      detail: { zh: `${SHAPE_NAME[g.shape].zh} · 揉面 ${g.knead} · 划口 ${g.scoring} · 烤 ${g.baked} · 共 ${g.score} 分`, en: `${SHAPE_NAME[g.shape].en} · knead ${g.knead} · score ${g.scoring} · bake ${g.baked} · ${g.score} points` },
      bestText: b => ({ zh: `最高 ${b} 分！`, en: `Best: ${b} points!` }),
      again: () => { startDough(); },
    });
    if (g.score >= DOUGH_TIERS[1]) charApi()?.emote('baybay', 'clap');
    sayWhenQuiet(rounds % 2 ? DOUGH_LINES.factGold : DOUGH_LINES.factBug, 2600);
  }, FINISH_MS);
}
/** The loaf out of the oven stays on the panel this long before the card (ms). */
export const FINISH_MS = 1400;

function cleanup(r: Run | null = cur) {
  if (!r || cur !== r) return;
  cur = null;
  r.keys?.off();
  r.off();
  closeOverlay(DOUGH_OVERLAY);
  if (flow.get().quietUntil === r.quiet) flow.set({ quietUntil: performance.now() + 4000 });
  changed();
}

/** 放弃 (✕, Esc): nothing paid. */
export function cancelDough() { cur?.run.cancel(); }
/** tests: end a finished game now (no timer) */
export function __finishNow() { const r = cur; if (r && r.game.phase === 'done') { cleanup(r); r.run.end({ tier: doughTier(r.game.score), score: r.game.score }); } }
/** tests */
export function __resetDough() { cur?.run.cancel(); cur = null; rounds = 0; listeners = new Set(); }
