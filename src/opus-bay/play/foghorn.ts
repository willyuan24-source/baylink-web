import type { AudioEngine } from '../audio/engine';
import { playSound, type SoundOpts } from '../audio/hooks';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { bubble } from '../game/flow';
import { flow } from '../game/flowStore';
import { registerFrameSystem } from '../game/systemsRegistry';
import { closeOverlay, openOverlay } from '../ui/slots';
import { CANCEL_GRACE, MOVE_CANCEL, startActivity, tierFor, type ActivityRun } from './kit';
import { freeOnFoot, holdKeys, type HeldKeys } from './partc';
import { FOG_ID, FOG_LINES, FOG_NAME } from './sfgames8Lines';
import { addSf8Sound, ensureSf8Sounds } from './sfgames8Sounds';
import { sayWhenQuiet } from './zones';

/**
 * Wave 8 · lane M · THE FOGHORNS' CALL AND ANSWER (W8-M6) at Fort Point, under the Golden Gate Bridge's south end.
 *
 * The Golden Gate's foghorns (goldengate.org, checked 2026-09-30): two on the south tower pier sound one long blast
 * ("a 2-second blast, an 18-second pause"); three at mid-span "sound as two blasts, each with a distinct tones". The
 * toy gives you all three to blow: 南塔 the south tower's long low horn (S: hold it), 桥中 高 / 低 the mid-span's high
 * and low (H, L: a tap each).
 *
 *   a round      a ship comes out of the fog; the bridge calls a short tune of horns; you blow it back in order (a south
 *                horn held under HOLD_MIN is too short). Right: the ship hears you and sails under the bridge. Wrong:
 *                listen again — the call plays once more; wrong again: the ship drops anchor and the next one comes
 *   six rounds   of 2, 3, 3, 4, 4, 5 horns (21), the fog thicker each round; the tunes are drawn fresh each game (the
 *                south horn at most once a round, never two of the same mid-span horn in a row more than twice)
 *   score        3 points a horn for a round right first time, 1 on the second try: 0–100 of the 63; tiers ● 40 · ◆ 70
 *                · ★ 90 → `medal:foghorn:1..3`, best = the score
 *
 * Keys: 1 / J (the south horn: hold), 2 / K (high), 3 / L (low), Esc gives up; the stick gives up too.
 */

export type Horn = 'S' | 'H' | 'L';
export const HORNS: readonly Horn[] = ['S', 'H', 'L'];
export const ROUND_LENGTHS: readonly number[] = [2, 3, 3, 4, 4, 5];
export const FOG_TIERS: readonly [number, number, number] = [40, 70, 90];
/** a south horn held shorter than this (s) is too short */
export const HOLD_MIN = 0.7;
/** a horn of the call sounds this long, then this gap (s) */
export const CALL_LEN: Readonly<Record<Horn, number>> = { S: 1.5, H: 0.6, L: 0.6 };
export const CALL_GAP = 0.4;
/** the answer may take this long a horn, plus this (s) */
export const ANSWER_PER = 2.6;
export const ANSWER_EXTRA = 2;
/** the opening, a ship coming out of the fog, sailing under the bridge (s) */
export const INTRO_S = 1.8;
export const SHIP_IN = 1.4;
export const SHIP_OUT = 2;

export type FogPhase = 'intro' | 'ship' | 'call' | 'answer' | 'pass' | 'anchor' | 'done';
export type FogEvent = 'ship' | 'call-S' | 'call-H' | 'call-L' | 'answer' | 'right' | 'wrong' | 'short' | 'late' | 'retry' | 'round-ok' | 'round-lost' | 'longer' | 'done';

/** Draw a game's six tunes from `rnd` (0..1). */
export function drawTunes(rnd: () => number = Math.random): Horn[][] {
  return ROUND_LENGTHS.map(n => {
    const t: Horn[] = [];
    let s = false;
    while (t.length < n) {
      let h: Horn = HORNS[Math.floor(rnd() * 3) % 3];
      if (h === 'S' && s) h = rnd() < 0.5 ? 'H' : 'L';
      // never the same mid-span horn three times running
      if (h !== 'S' && t.length >= 2 && t[t.length - 1] === h && t[t.length - 2] === h) h = h === 'H' ? 'L' : 'H';
      if (h === 'S') s = true;
      t.push(h);
    }
    return t;
  });
}

/** The call's horns with their start times from the call's start (s). */
export function callTimes(tune: readonly Horn[]): { h: Horn; at: number }[] {
  let at = 0.5;
  return tune.map(h => { const x = { h, at }; at += CALL_LEN[h] + CALL_GAP; return x; });
}
export const callLength = (tune: readonly Horn[]) => { const c = callTimes(tune); const l = c[c.length - 1]; return l.at + CALL_LEN[l.h] + 0.3; };

/** The game, pure: stepped by the game clock, the horns pressed and released by the player. */
export class FogGame {
  readonly tunes: Horn[][];
  phase: FogPhase = 'intro';
  /** the round (0..5) */
  round = 0;
  /** seconds in this phase */
  t = 0;
  /** the try of this round (0 first, 1 again) */
  tries = 0;
  /** horns answered right this try */
  got = 0;
  pts = 0;
  /** rounds right first time / second time / lost */
  first = 0;
  second = 0;
  lost = 0;
  /** the horn held now and since when (phase time) */
  held: { h: Horn; at: number } | null = null;
  /** the horn sounding in the call now (the panel lights it) */
  calling: Horn | null = null;
  /** the last judgement (the panel's flash) and the last horn blown */
  last: { ev: FogEvent; at: number } | null = null;
  blown: { h: Horn; at: number } | null = null;
  /** the game clock (s) */
  clock = 0;
  done = false;
  private nextCall = 0;
  constructor(tunes: Horn[][] = drawTunes()) { this.tunes = tunes; }
  get tune(): readonly Horn[] { return this.tunes[this.round] ?? []; }
  get maxPts() { return this.tunes.reduce((s, t) => s + 3 * t.length, 0); }
  get score() { return Math.round((100 * this.pts) / this.maxPts); }
  /** 0..1: the fog's thickness (the panel), thicker each round */
  get fog() { return Math.min(1, 0.35 + this.round * 0.12); }
  get answerLimit() { return this.tune.length * ANSWER_PER + ANSWER_EXTRA; }

  private go(p: FogPhase, out: FogEvent[]) {
    this.phase = p;
    this.t = 0;
    if (p === 'call') { this.nextCall = 0; this.got = 0; }
    if (p === 'answer') { this.got = 0; this.held = null; out.push('answer'); }
    if (p === 'ship') out.push('ship');
  }
  private mark(ev: FogEvent, out: FogEvent[]) { this.last = { ev, at: this.clock }; out.push(ev); }

  /** the round's answer went wrong (a wrong horn, a short south horn, too slow) */
  private miss(ev: 'wrong' | 'short' | 'late', out: FogEvent[]) {
    this.mark(ev, out);
    this.held = null;
    if (this.tries === 0) { this.tries = 1; out.push('retry'); this.go('call', out); return; }
    this.lost++;
    this.mark('round-lost', out);
    this.go('anchor', out);
  }

  /** A horn pressed (its sound starts: the run plays it). */
  press(h: Horn): FogEvent[] {
    const out: FogEvent[] = [];
    if (this.done || this.phase !== 'answer' || this.held) return out;
    this.held = { h, at: this.t };
    this.blown = { h, at: this.clock };
    return out;
  }

  /** A horn released: judged now (a south horn by how long it was held). */
  release(h: Horn): FogEvent[] {
    const out: FogEvent[] = [];
    if (this.done || this.phase !== 'answer' || !this.held || this.held.h !== h) return out;
    const d = this.t - this.held.at;
    this.held = null;
    const want = this.tune[this.got];
    if (h !== want) { this.miss('wrong', out); return out; }
    if (h === 'S' && d < HOLD_MIN) { this.miss('short', out); return out; }
    this.got++;
    this.mark('right', out);
    if (this.got >= this.tune.length) {
      const n = this.tune.length;
      if (this.tries === 0) { this.pts += 3 * n; this.first++; } else { this.pts += n; this.second++; }
      this.mark('round-ok', out);
      this.go('pass', out);
    }
    return out;
  }

  /** One frame. */
  step(dt: number): FogEvent[] {
    const out: FogEvent[] = [];
    if (this.done) return out;
    this.t += dt;
    this.clock += dt;
    switch (this.phase) {
      case 'intro': if (this.t >= INTRO_S) this.go('ship', out); break;
      case 'ship': if (this.t >= SHIP_IN) this.go('call', out); break;
      case 'call': {
        const c = callTimes(this.tune);
        while (this.nextCall < c.length && this.t >= c[this.nextCall].at) { out.push(`call-${c[this.nextCall].h}` as FogEvent); this.nextCall++; }
        const cur = c.find(x => this.t >= x.at && this.t < x.at + CALL_LEN[x.h]);
        this.calling = cur ? cur.h : null;
        if (this.t >= callLength(this.tune)) { this.calling = null; this.go('answer', out); }
        break;
      }
      case 'answer':
        if (this.t >= this.answerLimit) this.miss('late', out);
        break;
      case 'pass': case 'anchor':
        if (this.t >= SHIP_OUT) {
          if (this.round + 1 >= this.tunes.length) { this.phase = 'done'; this.done = true; out.push('done'); break; }
          this.round++;
          this.tries = 0;
          if (this.tune.length > this.tunes[this.round - 1].length) out.push('longer');
          this.go('ship', out);
        }
        break;
      default: break;
    }
    return out;
  }
}

export const fogTier = (score: number) => tierFor(score, FOG_TIERS);

// --- the sounds (synthesized: the call's horns and the player's are the same three) ------------------------------------

const hz = (semi: number) => 440 * 2 ** (semi / 12);
/** the three horns' notes (semitones from A4): the south tower deep, the mid-span pair a third apart */
export const HORN_NOTE: Readonly<Record<Horn, number>> = { S: -33, L: -21, H: -17 };

function horn(h: Horn) {
  return (e: AudioEngine, o?: SoundOpts) => {
    const len = CALL_LEN[h] + 0.2;
    const v = e.voice({ bus: 'sfx', dur: len + 1.6, gain: (h === 'S' ? 0.34 : 0.3) * (o?.gain ?? 1), priority: 3, reverb: 0.6, name: `m8:horn-${h}` });
    if (!v) return;
    const f = hz(HORN_NOTE[h]);
    for (const d of [-6, 6]) e.tone(v, { type: 'sawtooth', freq: f, decay: len, peak: 0.26, attack: 0.12, detune: d, filter: { type: 'lowpass', freq: f * 3.2, Q: 0.9 }, vibrato: { rate: 4, depth: 0.003 } });
    e.tone(v, { type: 'sine', freq: f / 2, decay: len, peak: 0.3, attack: 0.18 });
  };
}
/** a ship's two toots back: it heard you */
function toot(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1.6, gain: 0.2 * (o?.gain ?? 1), priority: 2, reverb: 0.5, name: 'm8:toot' });
  if (!v) return;
  for (const at of [0, 0.42]) e.tone(v, { type: 'square', freq: 196, decay: 0.32, peak: 0.18, attack: 0.03, offset: at, filter: { type: 'lowpass', freq: 900 } });
}
let soundsAdded = false;
function addFogSounds() {
  if (soundsAdded) return;
  soundsAdded = true;
  for (const h of HORNS) addSf8Sound(`m8-horn-${h}`, horn(h));
  addSf8Sound('m8-toot', toot);
}

// --- the run -------------------------------------------------------------------------------------------------------------

export const FOG_OVERLAY = 'play-foghorn';
const KEYS: Readonly<Record<string, Horn>> = { Digit1: 'S', KeyJ: 'S', Digit2: 'H', KeyK: 'H', Digit3: 'L', KeyL: 'L' };

interface Run { run: ActivityRun; game: FogGame; keys: HeldKeys | null; off: () => void; quiet: number; said: number }
let cur: Run | null = null;
let listeners = new Set<() => void>();
let seq = 0;
let rounds = 0;
const changed = () => { seq++; for (const fn of [...listeners]) fn(); };
export const fogSeq = () => seq;
export function subscribeFog(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export const fogGame = (): FogGame | null => cur?.game ?? null;

/** 雾笛对答 at Fort Point. `tunes` for tests. Returns whether a game started. */
export function startFoghorn(tunes?: Horn[][]): boolean {
  if (cur || !freeOnFoot()) return false;
  const run = startActivity({ id: FOG_ID, name: FOG_NAME, better: 'higher' }, { lock: true, onStop: how => { if (how === 'cancel') cleanup(); } });
  if (!run) return false;
  addFogSounds();
  ensureSf8Sounds();
  const g = new FogGame(tunes ?? drawTunes());
  const keys = holdKeys(['Escape', 'KeyE', ...Object.keys(KEYS)], code => {
    if (code === 'Escape') { cancelFoghorn(); return; }
    const h = KEYS[code];
    if (h) fogPress(h);
  });
  const r: Run = { run, game: g, keys, off: () => {}, quiet: performance.now() + 90000, said: -Infinity };
  const down = new Set<string>();
  let grace = CANCEL_GRACE;
  r.off = registerFrameSystem('m-play-foghorn', dt => {
    if (cur !== r) return;
    if (game.get().paused) return;
    if (grace > 0) grace -= dt;
    else if (Math.hypot(runtime.input.moveX, runtime.input.moveY) > MOVE_CANCEL) { cancelFoghorn(); return; }
    // a key let go: the horn's release
    for (const code of Object.keys(KEYS)) {
      const isDown = keys.isDown(code);
      if (isDown) down.add(code);
      else if (down.has(code)) { down.delete(code); fogRelease(KEYS[code]); }
    }
    if (cur !== r) return;
    const before = g.phase, calling = g.calling, round = g.round;
    for (const e of g.step(Math.min(dt, 0.1))) onFogEvent(r, e);
    if (before !== g.phase || calling !== g.calling || round !== g.round) changed();
  });
  cur = r;
  rounds++;
  openOverlay(FOG_OVERLAY);
  flow.set({ quietUntil: Math.max(flow.get().quietUntil, r.quiet) });
  bubble(FOG_LINES.start, 3000);
  changed();
  return true;
}

/** The panel's horn buttons and the keys: press, then release. */
export function fogPress(h: Horn) {
  const r = cur;
  if (!r || r.game.phase !== 'answer' || r.game.held) return;
  playSound(`m8-horn-${h}`);
  for (const e of r.game.press(h)) onFogEvent(r, e);
  changed();
}
export function fogRelease(h: Horn) {
  const r = cur;
  if (!r) return;
  for (const e of r.game.release(h)) onFogEvent(r, e);
  changed();
}

/** BAYBAY at most every 2.5 s, an important line always */
function say(r: Run, line: { zh: string; en: string }, ms = 2400, force = false) {
  const now = r.game.clock;
  if (!force && now - r.said < 2.5) return;
  r.said = now;
  bubble(line, ms);
}

function onFogEvent(r: Run, e: FogEvent) {
  const g = r.game;
  switch (e) {
    case 'call-S': case 'call-H': case 'call-L': playSound(`m8-horn-${e.slice(5)}`); break;
    case 'ship': if (g.round === 0) say(r, FOG_LINES.ship, 2400); break;
    case 'round-ok': playSound('m8-toot', { gain: 0.8 }); if (g.first + g.second === 1) say(r, FOG_LINES.good, 2400, true); break;
    case 'retry': if (g.last?.ev !== 'short') say(r, FOG_LINES.wrong, 2400, true); break;
    case 'short': say(r, FOG_LINES.hold, 2400, true); break;
    case 'round-lost': say(r, FOG_LINES.anchor, 2600, true); break;
    case 'longer': if (g.round === 3) say(r, FOG_LINES.longer, 2600); break;
    case 'done': finish(r); break;
    default: break;
  }
}

const FACTS = [FOG_LINES.factSouth, FOG_LINES.factMid, FOG_LINES.factWorkers];

function finish(r: Run) {
  const g = r.game;
  cleanup(r);
  const score = g.score, tier = fogTier(score);
  r.run.end({
    tier, score,
    detail: {
      zh: `${score} 分 · 一次对上 ${g.first} 艘 · 再听一遍对上 ${g.second} 艘 · 抛锚 ${g.lost} 艘`,
      en: `${score} · ${g.first} ships first time · ${g.second} on a second listen · ${g.lost} at anchor`,
    },
    bestText: b => ({ zh: `最高 ${b} 分！`, en: `Best: ${b}!` }),
    again: () => { startFoghorn(); },
  });
  sayWhenQuiet(tier === 3 ? FOG_LINES.star : FOG_LINES.end, 1600);
  sayWhenQuiet(FACTS[(rounds - 1) % FACTS.length], 6500, 4400);
}

function cleanup(r: Run | null = cur) {
  if (!r || cur !== r) return;
  cur = null;
  r.keys?.off();
  r.off();
  closeOverlay(FOG_OVERLAY);
  if (flow.get().quietUntil === r.quiet) flow.set({ quietUntil: performance.now() + 4000 });
  changed();
}

/** 放弃 (✕, Esc, the stick): nothing paid. */
export function cancelFoghorn() { cur?.run.cancel(); }
/** tests */
export function __resetFoghorn() { cur?.run.cancel(); cur = null; rounds = 0; listeners = new Set(); }
