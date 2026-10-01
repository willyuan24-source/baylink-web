import { audioNow, duck, playSound } from '../audio/hooks';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { bubble } from '../game/flow';
import { flow } from '../game/flowStore';
import { registerFrameSystem } from '../game/systemsRegistry';
import { closeOverlay, openOverlay } from '../ui/slots';
import { addBuskSounds, nextBeat } from './buskSounds';
import { CANCEL_GRACE, MOVE_CANCEL, RhythmJudge, startActivity, tierFor, type ActivityRun } from './kit';
import { freeOnFoot, holdKeys, type HeldKeys } from './partc';
import { BUSK_ID, BUSK_LINES, BUSK_NAME } from './sfgames8Lines';
import { ensureSf8Sounds } from './sfgames8Sounds';
import { sayWhenQuiet } from './zones';

/**
 * Wave 8 · lane M · PLAY ALONG WITH THE BUSKER (W8-M3): the street guitarist on Haight St (a folk-rock strum: you
 * play the tambourine on the backbeat) or on 24th St (a cumbia: you shake the maracas on the off-beats). His song is
 * synthesized beat by beat (buskSounds.ts, scheduled a moment ahead on the audio clock); the dots slide in toward the
 * ring and you tap as each one meets it.
 *
 *   the song      18 bars: 2 to listen in, 6 of verse (the plain part), 8 of chorus (more notes, syncopated), 2 to end
 *   a tap         judged against the nearest dot still to play: within PERFECT 2 points, within GOOD 1; a near miss
 *                 (within STRAY) breaks the run of hits; a tap with no dot near it is a stray: −1 point (no mashing)
 *   a dot passed  unplayed GOOD after its time: a miss (the run breaks)
 *   score         0–100 = the points' share of every dot played perfectly; tiers ● 50 · ◆ 75 · ★ 90 →
 *                 `medal:busk:1..3`, best = the score; coins fall into the open guitar case as the run grows
 *
 * The song runs on the game's clock (stepped by the frame loop: Settings pauses it, the sound follows each beat), and
 * the first taps teach the player's own offset (the PlayKit's RhythmJudge: a late thumb, a Bluetooth speaker). When
 * the busker is not out (his corner shows him in the afternoon) BAYBAY plays his tune herself: the same game.
 * Keys: Space / Enter / J / F (tap), Esc (give up); the stick gives up too.
 */

export type BuskStyle = 'haight' | 'mission';

export interface Song {
  style: BuskStyle;
  bpm: number;
  /** seconds a beat */
  beat: number;
  bars: number;
  /** the dots, in beats from the song's first downbeat (ascending) */
  notes: readonly number[];
  /** the chorus's first beat */
  chorusAt: number;
  /** a chord per bar */
  chords: readonly string[];
}

export const PERFECT = 0.07;
export const GOOD = 0.14;
export const STRAY = 0.24;
export const BUSK_TIERS: readonly [number, number, number] = [50, 75, 90];
/** seconds of song a dot is seen before its time (the track's length) */
export const LEAD = 1.7;
/** the run of hits that drops a coin into the case, and BAYBAY's cheer */
export const COIN_EVERY = 4;
export const CHEER_AT = 12;

const INTRO = 2, VERSE = 6, CHORUS = 8, OUTRO = 2;

function chart(verse: readonly (readonly number[])[], chorus: readonly (readonly number[])[], outro: readonly (readonly number[])[]): { notes: number[]; chorusAt: number } {
  const notes: number[] = [];
  let bar = INTRO;
  for (let i = 0; i < VERSE; i++, bar++) for (const b of verse[i % verse.length]) notes.push(bar * 4 + b);
  const chorusAt = bar * 4;
  for (let i = 0; i < CHORUS; i++, bar++) for (const b of chorus[i % chorus.length]) notes.push(bar * 4 + b);
  for (let i = 0; i < OUTRO; i++, bar++) for (const b of outro[i % outro.length]) notes.push(bar * 4 + b);
  return { notes, chorusAt };
}

const HAIGHT = chart([[1, 3]], [[0, 1, 2, 3], [1, 1.5, 3, 3.5]], [[0, 1, 2, 3], [0]]);
const MISSION = chart([[0.5, 1.5, 2.5, 3.5]], [[0.5, 1, 1.5, 2.5, 3, 3.5], [0.5, 1.5, 2.5, 3, 3.5]], [[0.5, 1.5, 2.5, 3.5], [0]]);

export const SONGS: Readonly<Record<BuskStyle, Song>> = {
  // a folk-rock strum in G (the tambourine on the backbeat, then on every beat and the "and"s)
  haight: {
    style: 'haight', bpm: 108, beat: 60 / 108, bars: INTRO + VERSE + CHORUS + OUTRO, ...HAIGHT,
    chords: ['G', 'G', 'G', 'C', 'G', 'D', 'G', 'C', 'C', 'G', 'D', 'G', 'C', 'G', 'D', 'G', 'G', 'G'],
  },
  // a cumbia in A minor (the maracas on the off-beats, then the güiro's "chk-chiki" figure)
  mission: {
    style: 'mission', bpm: 96, beat: 60 / 96, bars: INTRO + VERSE + CHORUS + OUTRO, ...MISSION,
    chords: ['Am', 'Am', 'Am', 'Dm', 'Am', 'E', 'Am', 'Dm', 'Am', 'Dm', 'G', 'C', 'Am', 'Dm', 'E', 'Am', 'Am', 'Am'],
  },
};

export type BuskEvent = 'perfect' | 'good' | 'off' | 'stray' | 'miss' | 'coin' | 'cheer' | 'chorus' | 'done';
/** a dot's state: 0 to play, 1 good, 2 perfect, 3 missed */
export type DotState = 0 | 1 | 2 | 3;

/** The jam, pure: stepped by the game's clock, tapped by the player. */
export class BuskGame {
  readonly song: Song;
  /** song time (s): 0 = the first downbeat */
  t = 0;
  readonly state: DotState[];
  readonly judge: RhythmJudge;
  pts = 0;
  run = 0;
  bestRun = 0;
  perfect = 0;
  good = 0;
  missed = 0;
  strays = 0;
  coins = 0;
  done = false;
  /** the last judgement (the panel's flash) */
  last: { ev: BuskEvent; at: number } | null = null;
  private next = 0;
  private chorusSaid = false;
  private cheered = false;
  constructor(song: Song) {
    this.song = song;
    this.state = song.notes.map(() => 0 as DotState);
    this.judge = new RhythmJudge({ window: GOOD, clock: () => this.t });
  }
  /** a dot's time (s) */
  at(i: number) { return this.song.notes[i] * this.song.beat; }
  get end() { return this.song.bars * 4 * this.song.beat + 0.6; }
  get maxPts() { return this.song.notes.length * 2; }
  get score() { return Math.round((100 * Math.max(0, this.pts)) / this.maxPts); }
  /** the first dot still to play (the panel draws from it) */
  get first() { return this.next; }
  get inChorus() { return this.t >= this.song.chorusAt * this.song.beat; }

  private hitRun(out: BuskEvent[]) {
    this.run++;
    if (this.run > this.bestRun) this.bestRun = this.run;
    if (this.run % COIN_EVERY === 0) { this.coins++; out.push('coin'); }
    if (!this.cheered && this.run >= CHEER_AT) { this.cheered = true; out.push('cheer'); }
  }

  /** A tap at song time `at` (default now). */
  tap(at: number = this.t): BuskEvent[] {
    const out: BuskEvent[] = [];
    if (this.done) return out;
    // the nearest dot still to play (after the player's learnt offset)
    let best = -1, bestD = Infinity;
    for (let i = this.next; i < this.state.length; i++) {
      if (this.state[i] !== 0) continue;
      const d = Math.abs(at - this.judge.offset - this.at(i));
      if (d < bestD) { bestD = d; best = i; }
      if (this.at(i) - at > STRAY + 0.3) break;
    }
    if (best < 0 || bestD > STRAY) {
      this.strays++;
      this.pts -= 1;
      this.run = 0;
      this.last = { ev: 'stray', at: this.t };
      out.push('stray');
      return out;
    }
    const j = this.judge.judge(this.at(best), at);
    if (j.kind !== 'hit') { this.run = 0; this.last = { ev: 'off', at: this.t }; out.push('off'); return out; }
    const perfect = Math.abs(j.delta) <= PERFECT;
    this.state[best] = perfect ? 2 : 1;
    this.pts += perfect ? 2 : 1;
    if (perfect) this.perfect++; else this.good++;
    const ev: BuskEvent = perfect ? 'perfect' : 'good';
    this.last = { ev, at: this.t };
    out.push(ev);
    this.hitRun(out);
    while (this.next < this.state.length && this.state[this.next] !== 0) this.next++;
    return out;
  }

  /** One frame of the song. */
  step(dt: number): BuskEvent[] {
    const out: BuskEvent[] = [];
    if (this.done) return out;
    this.t += dt;
    for (let i = this.next; i < this.state.length; i++) {
      if (this.state[i] !== 0) continue;
      if (this.t - this.judge.offset - this.at(i) <= GOOD) break;
      this.state[i] = 3;
      this.missed++;
      this.run = 0;
      this.last = { ev: 'miss', at: this.t };
      out.push('miss');
    }
    while (this.next < this.state.length && this.state[this.next] !== 0) this.next++;
    if (!this.chorusSaid && this.inChorus) { this.chorusSaid = true; out.push('chorus'); }
    if (this.t >= this.end) { this.done = true; out.push('done'); }
    return out;
  }
}

export const buskTier = (score: number) => tierFor(score, BUSK_TIERS);

// --- the run ---------------------------------------------------------------------------------------------------------------

export const BUSK_OVERLAY = 'play-busk';
/** how far ahead the beats are handed to the audio clock (s) */
const SCHEDULE_AHEAD = 0.18;

interface Run {
  run: ActivityRun;
  game: BuskGame;
  keys: HeldKeys | null;
  off: () => void;
  quiet: number;
  said: number;
  /** the busker plays (false: BAYBAY plays his tune) */
  busker: boolean;
  /** the next beat to hand to the audio */
  beat: number;
  /** performance.now() of the last step (a tap between two frames is judged at its own moment) */
  stepAt: number;
  misses: number;
  duckAt: number;
}

let cur: Run | null = null;
let listeners = new Set<() => void>();
let seq = 0;
let rounds = 0;
const changed = () => { seq++; for (const fn of [...listeners]) fn(); };
export const buskSeq = () => seq;
export function subscribeBusk(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export const buskGame = (): BuskGame | null => cur?.game ?? null;
/** the busker plays (false: BAYBAY plays his tune; null: no jam) */
export const buskWithBusker = (): boolean | null => (cur ? cur.busker : null);

/** 合奏: at the busker's spot (`busker` false: BAYBAY plays his tune). Returns whether a jam started. */
export function startBusk(style: BuskStyle, busker = true): boolean {
  if (cur || !freeOnFoot()) return false;
  const run = startActivity({ id: BUSK_ID, name: BUSK_NAME, better: 'higher' }, { lock: true, onStop: how => { if (how === 'cancel') cleanup(); } });
  if (!run) return false;
  addBuskSounds();
  ensureSf8Sounds();
  const g = new BuskGame(SONGS[style]);
  const keys = holdKeys(['Space', 'Enter', 'KeyJ', 'KeyF', 'Escape', 'KeyE'], code => {
    if (code === 'Escape') { cancelBusk(); return; }
    if (code !== 'KeyE') buskTap();
  });
  const r: Run = { run, game: g, keys, off: () => {}, quiet: performance.now() + 75000, said: -Infinity, busker, beat: 0, stepAt: performance.now(), misses: 0, duckAt: -Infinity };
  let grace = CANCEL_GRACE;
  r.off = registerFrameSystem('m-play-busk', dt => {
    if (cur !== r) return;
    // Settings pauses the song (the beats already handed to the audio are a fifth of a second at most)
    if (game.get().paused) { r.stepAt = performance.now(); return; }
    if (grace > 0) grace -= dt;
    else if (Math.hypot(runtime.input.moveX, runtime.input.moveY) > MOVE_CANCEL) { cancelBusk(); return; }
    const step = Math.min(dt, 0.1);
    const before = g.last?.at;
    for (const e of g.step(step)) onBuskEvent(r, e);
    r.stepAt = performance.now();
    if (cur !== r) return;
    scheduleBeats(r);
    // the city's own music and the ambient buskers make room for the jam
    if (g.t - r.duckAt > 1) { r.duckAt = g.t; duck('ambience', 0.2, 1600); duck('music', 0.15, 1600); }
    if (before !== g.last?.at) changed();
  });
  cur = r;
  rounds++;
  openOverlay(BUSK_OVERLAY);
  flow.set({ quietUntil: Math.max(flow.get().quietUntil, r.quiet) });
  bubble(BUSK_LINES.start, 2800);
  changed();
  return true;
}

/** Hand the beats within SCHEDULE_AHEAD to the audio clock (each its own short voice). */
function scheduleBeats(r: Run) {
  const g = r.game, s = g.song, total = s.bars * 4;
  while (r.beat < total && r.beat * s.beat < g.t + SCHEDULE_AHEAD) {
    const dtAhead = r.beat * s.beat - g.t;
    if (dtAhead > -0.05) {
      nextBeat.at = audioNow() + Math.max(0, dtAhead);
      nextBeat.style = s.style;
      nextBeat.chord = s.chords[Math.floor(r.beat / 4)] ?? s.chords[0];
      nextBeat.beat = r.beat;
      nextBeat.len = s.beat;
      // BAYBAY's practice take is softer (a toy ukulele's worth)
      nextBeat.level = r.busker ? 1 : 0.75;
      playSound('m8-busk-beat');
    }
    r.beat++;
  }
}

/** A tap (the panel's button, a tap on the street picture, Space / Enter / J / F). */
export function buskTap() {
  const r = cur;
  if (!r) return;
  const g = r.game;
  playSound(g.song.style === 'mission' ? 'm8-maracas' : 'm8-tambourine', { pitch: 1 + (Math.random() - 0.5) * 0.06 });
  // judged at the tap's own moment between two frames (a paused song: at its frozen time)
  const since = game.get().paused ? 0 : Math.min(0.05, (performance.now() - r.stepAt) / 1000);
  for (const e of g.tap(g.t + since)) onBuskEvent(r, e);
  changed();
}

/** BAYBAY at most every 2.5 s, an important line always */
function say(r: Run, line: { zh: string; en: string }, ms = 2400, force = false) {
  const now = r.game.t;
  if (!force && now - r.said < 2.5) return;
  r.said = now;
  bubble(line, ms);
}

function onBuskEvent(r: Run, e: BuskEvent) {
  switch (e) {
    case 'perfect': case 'good': r.misses = 0; break;
    case 'miss': if (++r.misses === 3) say(r, BUSK_LINES.miss); break;
    case 'coin': playSound('m8-clink', { pitch: 0.9 + Math.random() * 0.25 }); break;
    case 'cheer': say(r, BUSK_LINES.combo, 2600, true); break;
    case 'chorus': say(r, BUSK_LINES.chorus, 2400, true); break;
    case 'done': finish(r); break;
    default: break;
  }
}

function finish(r: Run) {
  const g = r.game;
  cleanup(r);
  const score = g.score, tier = buskTier(score);
  const style = g.song.style;
  r.run.end({
    tier, score,
    detail: {
      zh: `${score} 分 · 完美 ${g.perfect} · 不错 ${g.good} · 最长连击 ${g.bestRun} · 琴盒里 ${g.coins} 枚硬币`,
      en: `${score} · perfect ${g.perfect} · good ${g.good} · best run ${g.bestRun} · ${g.coins} coins in the case`,
    },
    bestText: b => ({ zh: `最高 ${b} 分！`, en: `Best: ${b}!` }),
    again: () => { startBusk(style, r.busker); },
  });
  sayWhenQuiet(tier === 3 ? BUSK_LINES.star : BUSK_LINES.end, 1600);
  if (rounds === 1 || rounds % 3 === 0) sayWhenQuiet(style === 'mission' ? BUSK_LINES.factMission : BUSK_LINES.factHaight, 6500, 4200);
}

function cleanup(r: Run | null = cur) {
  if (!r || cur !== r) return;
  cur = null;
  r.keys?.off();
  r.off();
  closeOverlay(BUSK_OVERLAY);
  if (flow.get().quietUntil === r.quiet) flow.set({ quietUntil: performance.now() + 4000 });
  changed();
}

/** 放弃 (✕, Esc, the stick): nothing paid. */
export function cancelBusk() { cur?.run.cancel(); }
/** tests */
export function __resetBusk() { cur?.run.cancel(); cur = null; rounds = 0; listeners = new Set(); }
