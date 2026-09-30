import { charApi } from '../actors/charApi';
import { playSound } from '../audio/hooks';
import { bubble } from '../game/flow';
import { flow } from '../game/flowStore';
import { registerFrameSystem } from '../game/systemsRegistry';
import { closeOverlay, openOverlay } from '../ui/slots';
import { startActivity, tierFor, type ActivityRun } from './kit';
import { freeOnFoot, holdKeys, type HeldKeys } from './partc';
import { CRAB_ID, CRAB_LINES, CRAB_NAME } from './sfgamesLines';
import { ensureSfSounds } from './sfgamesSounds';
import { sayWhenQuiet } from './zones';

/**
 * Wave 7 · lane M · crabbing off Pier 7 with a hoop net (three nets, about a minute): 放网 drops the net with its bait to
 * the bottom; crabs smell it and walk in from both sides, eat a while and wander off; the rope twitches while crabs are
 * on the net. 拉！ (hold) hauls it up — steadily: while the net is still low, a crab may scuttle off, more so when the
 * hauling stops and starts. Then each crab on the gauge: 放回去 or 够 4 英寸，留下 — by the real rules of San Francisco
 * Bay: a **Dungeness crab always goes back** (never taken from the bay), a **rock crab** may be kept from **4 inches**.
 * Everything goes back into the bay at the end (BAYBAY's bye line): the game is measuring, not taking.
 *
 * Points: 10 a crab landed + 10 a right call; tiers ● 30 · ◆ 90 · ★ 150 → `medal:crab:n`; best = points. Rules checked on
 * the web 2026-09-29 (https://wildlife.ca.gov/Fishing/Ocean/Regulations/Fishing-Map/sf-bay: "Dungeness crab … may not
 * be taken from, or possessed if taken from, San Francisco and San Pablo bays at any time"; rock crab 35 a day, 4 inches
 * at least; https://cdfwmarine.wordpress.com/2025/02/21/public-ocean-fishing-piers-know-before-you-go/: no licence on a
 * public pier, two nets each). The game itself (CrabGame) is pure; CrabPanel.tsx draws it.
 */

export const NETS = 3;
/** The net: sinking (s), the bait lasting (s after it lands), hauling (depth per s held), sinking back when let go. */
export const SINK_S = 1.1, BAIT_S = 16, SOAK_MAX = 24, PULL_SPEED = 0.95, SLIP_BACK = 0.3;
/** While the net is deeper than LOW, each crab on it may scuttle off: this rate (per s) hauling, ×STALL when not. */
export const LOW = 0.6, ESCAPE_RATE = 0.3, STALL = 6;
/** The ready prompt drops the net by itself after this long (s). */
export const READY_S = 8;
/** A keeper rock crab (inches, carapace width). */
export const MIN_ROCK = 4;
/** Points and tiers. */
export const PTS_CATCH = 10, PTS_CALL = 10;
export const CRAB_TIERS: readonly [number, number, number] = [30, 90, 150];

export type CrabKind = 'rock' | 'dungeness';
export type CrabState = 'coming' | 'eating' | 'leaving' | 'gone' | 'on-net';
export interface Crab { kind: CrabKind; size: number; x: number; from: -1 | 1; eatX: number; arrive: number; stay: number; state: CrabState; t: number }
export type CrabPhase = 'ready' | 'sink' | 'soak' | 'pull' | 'measure' | 'done';
export type CrabEvent = 'drop' | 'landed' | 'tug' | 'pull' | 'up' | 'escape' | 'right' | 'wrong' | 'net-done' | 'done';

/** The right call for a crab: keep only a rock crab of 4 inches or more. */
export const mustRelease = (c: Pick<Crab, 'kind' | 'size'>) => c.kind === 'dungeness' || c.size < MIN_ROCK;

/** The crabs that will come to one net: 6, setting off over the first 9 s, a third of them Dungeness. */
export function crabWave(rand: () => number): Crab[] {
  const out: Crab[] = [];
  for (let i = 0; i < 6; i++) {
    const kind: CrabKind = rand() < 0.33 ? 'dungeness' : 'rock';
    // a rock crab is clearly under or over the 4-inch line (never within a quarter inch of it: the gauge is read by eye)
    const r = rand();
    const size = kind === 'rock' ? (r < 0.5 ? 2.7 + r * 2 * 1 : 4.3 + (r - 0.5) * 2 * 1.2) : 4.6 + r * 2.4;
    const from = rand() < 0.5 ? -1 : 1;
    out.push({ kind, size: +size.toFixed(1), x: from < 0 ? -4 : 104, from, eatX: 38 + rand() * 24, arrive: 0.5 + i * 1.5 + rand() * 1, stay: 5 + rand() * 4, state: 'coming', t: 0 });
  }
  return out;
}

const WALK = 13;

export class CrabGame {
  phase: CrabPhase = 'ready';
  t = 0;
  net = 1;
  /** 0 = at the surface, 1 = on the bottom */
  depth = 0;
  crabs: Crab[] = [];
  caught: Crab[] = [];
  measuring = 0;
  score = 0;
  landed = 0;
  right = 0;
  escaped = 0;
  holding = false;
  /** seconds since the net landed (the bait's clock) */
  soak = 0;
  /** the last call: for the panel's flash */
  last: { ok: boolean; release: boolean } | null = null;
  private tugAt = 0;
  private readonly rand: () => number;
  constructor(rand: () => number = Math.random) { this.rand = rand; }
  private go(p: CrabPhase) { this.phase = p; this.t = 0; }
  /** 放网 */
  drop(): boolean { if (this.phase !== 'ready') return false; this.go('sink'); this.crabs = crabWave(this.rand); this.soak = 0; return true; }
  /** 拉！ held or let go (the first hold during the soak starts the haul) */
  hold(on: boolean) {
    this.holding = on;
    if (on && this.phase === 'soak') {
      // the crabs eating on the net ride up with it; the others stay on the bottom
      for (const c of this.crabs) if (c.state === 'eating') c.state = 'on-net';
      this.go('pull');
    }
  }
  /** the call on the crab on the gauge: release (放回去) or keep (够 4 英寸，留下) */
  call(release: boolean): CrabEvent[] {
    if (this.phase !== 'measure') return [];
    const c = this.caught[this.measuring];
    if (!c) return [];
    const ok = mustRelease(c) === release;
    this.last = { ok, release };
    if (ok) { this.score += PTS_CALL; this.right++; }
    this.measuring++;
    const ev: CrabEvent[] = [ok ? 'right' : 'wrong'];
    if (this.measuring >= this.caught.length) ev.push(...this.nextNet());
    return ev;
  }
  // counted without a new array: the run's frame system reads both every frame (W7-M-review)
  get onNet() { return this.count('on-net'); }
  get eating() { return this.count('eating'); }
  private count(st: CrabState) { let n = 0; for (const c of this.crabs) if (c.state === st) n++; return n; }
  private nextNet(): CrabEvent[] {
    const ev: CrabEvent[] = ['net-done'];
    this.caught = []; this.measuring = 0; this.crabs = [];
    if (this.net >= NETS) { this.go('done'); ev.push('done'); } else { this.net++; this.depth = 0; this.go('ready'); }
    return ev;
  }
  step(dt: number): CrabEvent[] {
    const ev: CrabEvent[] = [];
    if (this.phase === 'done' || !(dt > 0)) return ev;
    this.t += dt;
    switch (this.phase) {
      case 'ready':
        this.depth = 0;
        if (this.t >= READY_S) { this.drop(); ev.push('drop'); }
        break;
      case 'sink':
        this.depth = Math.min(1, this.t / SINK_S);
        if (this.t >= SINK_S) { this.go('soak'); ev.push('landed'); }
        break;
      case 'soak':
        this.soak += dt;
        this.walk(dt);
        if (this.eating > 0 && this.soak - this.tugAt > 1.3) { this.tugAt = this.soak; ev.push('tug'); }
        // nobody hauls: the net comes up by itself at the end (empty by then)
        if (this.soak >= SOAK_MAX) { this.hold(true); ev.push('pull'); }
        break;
      case 'pull': {
        this.soak += dt;
        this.walk(dt);
        const was = this.depth;
        this.depth = this.holding ? Math.max(0, this.depth - PULL_SPEED * dt) : Math.min(1, this.depth + SLIP_BACK * dt);
        // low down, a crab may step off the net (a steady haul keeps most)
        if (this.depth > LOW || was > LOW) {
          const rate = ESCAPE_RATE * (this.holding ? 1 : STALL);
          for (const c of this.crabs) if (c.state === 'on-net' && this.rand() < 1 - Math.exp(-rate * dt)) { c.state = 'leaving'; c.t = 0; this.escaped++; ev.push('escape'); }
        }
        if (this.depth <= 0) {
          this.caught = this.crabs.filter(c => c.state === 'on-net');
          this.landed += this.caught.length;
          this.score += PTS_CATCH * this.caught.length;
          ev.push('up');
          if (this.caught.length) this.go('measure'); else ev.push(...this.nextNet());
        }
        break;
      }
    }
    return ev;
  }
  /** the crabs on the bottom: come to the bait, eat, wander off (and none come once the bait is gone) */
  private walk(dt: number) {
    const baitGone = this.soak >= BAIT_S;
    for (const c of this.crabs) {
      c.t += dt;
      if (c.state === 'coming') {
        if (this.soak < c.arrive) continue;
        if (baitGone) { c.state = 'gone'; continue; }
        const d = c.eatX - c.x;
        c.x += Math.sign(d) * Math.min(Math.abs(d), WALK * dt);
        if (Math.abs(c.eatX - c.x) < 0.01) { c.state = 'eating'; c.t = 0; }
      } else if (c.state === 'eating') {
        if (c.t >= c.stay || baitGone) { c.state = 'leaving'; c.t = 0; }
      } else if (c.state === 'leaving') {
        c.x += (c.eatX < 50 ? -1 : 1) * WALK * dt;
        if (c.x < -12 || c.x > 112) c.state = 'gone';
      }
    }
  }
}

export const crabTier = (score: number) => tierFor(score, CRAB_TIERS);

// --- the run ---------------------------------------------------------------------------------------------------------------

export const CRAB_OVERLAY = 'play-crab';
interface Run { run: ActivityRun; game: CrabGame; keys: HeldKeys | null; off: () => void; quiet: number; tugSaid: boolean; ruleSaid: Set<string> }
let cur: Run | null = null;
let listeners = new Set<() => void>();
let seq = 0;
const changed = () => { seq++; for (const fn of [...listeners]) fn(); };
export const crabSeq = () => seq;
export function subscribeCrab(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export const crabGame = (): CrabGame | null => cur?.game ?? null;
let rounds = 0;
let padHold = false;

/** 捞螃蟹 at the rail. Returns whether a game started. */
export function startCrab(rand: () => number = Math.random): boolean {
  if (cur || !freeOnFoot()) return false;
  const run = startActivity({ id: CRAB_ID, name: CRAB_NAME, better: 'higher' }, { lock: true, cancelOnMove: true, onStop: how => { if (how === 'cancel') cleanup(); } });
  if (!run) return false;
  ensureSfSounds();
  const game = new CrabGame(rand);
  const keys = holdKeys(['Space', 'Enter', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Digit1', 'Digit2', 'Escape', 'KeyE'], code => {
    if (code === 'Escape') { cancelCrab(); return; }
    if ((code === 'Space' || code === 'Enter') && game.phase === 'ready') { crabDrop(); return; }
    if (game.phase === 'measure') {
      if (code === 'ArrowLeft' || code === 'KeyA' || code === 'Digit1') crabCall(true);
      else if (code === 'ArrowRight' || code === 'KeyD' || code === 'Digit2') crabCall(false);
    }
  });
  const r: Run = { run, game, keys, off: () => {}, quiet: performance.now() + 90000, tugSaid: false, ruleSaid: new Set() };
  // a Space still held from 放网 never starts the haul: it has to be let go and pressed again
  let fresh = true, lastEat = 0;
  r.off = registerFrameSystem('m-play-crab', dt => {
    if (cur !== r) return;
    const spaceHeld = keys.isDown('Space') || keys.isDown('Enter');
    if (!spaceHeld) fresh = true;
    else if (game.phase === 'ready' || game.phase === 'sink') fresh = false;
    const want = padHold || (spaceHeld && fresh);
    const before = game.phase, n = game.onNet, held = game.holding;
    if ((game.phase === 'soak' || game.phase === 'pull') && want !== game.holding) game.hold(want);
    for (const e of game.step(Math.min(dt, 0.1))) onCrabEvent(r, e);
    // the panel hears of a new phase, a crab on / off the net, the haul held or let go (the rest it draws by itself)
    const eat = game.eating;
    if (before !== game.phase || n !== game.onNet || held !== game.holding || eat !== lastEat) { lastEat = eat; changed(); }
  });
  cur = r;
  rounds++;
  openOverlay(CRAB_OVERLAY);
  flow.set({ quietUntil: Math.max(flow.get().quietUntil, r.quiet) });
  changed();
  return true;
}

/** The panel's buttons. */
export function crabDrop() { const r = cur; if (r && r.game.drop()) onCrabEvent(r, 'drop'); changed(); }
export function setCrabHold(on: boolean) { padHold = on; }
export function crabCall(release: boolean) {
  const r = cur;
  if (!r) return;
  const c = r.game.caught[r.game.measuring];
  for (const e of r.game.call(release)) onCrabEvent(r, e, c);
  changed();
}

function onCrabEvent(r: Run, e: CrabEvent, c?: Crab) {
  const g = r.game;
  switch (e) {
    case 'drop': playSound('m-splash', { gain: 0.8 }); if (g.net === 1) bubble(CRAB_LINES.drop, 2600); break;
    case 'landed': playSound('m-splash', { gain: 0.3 }); break;
    case 'tug': playSound('m-tug'); if (!r.tugSaid) { r.tugSaid = true; bubble(CRAB_LINES.tug, 2400); } break;
    case 'escape': playSound('m-grab', { pitch: 0.5 }); bubble(CRAB_LINES.escape, 1800); break;
    case 'up':
      playSound('m-splash', { gain: 0.5, pitch: 1.3 });
      if (!g.caught.length) bubble(g.soak < 4 ? CRAB_LINES.early : g.escaped && g.soak < BAIT_S ? CRAB_LINES.escape : CRAB_LINES.late, 2400);
      else { charApi()?.emote('baybay', 'cheer'); if (g.net === 1) bubble(CRAB_LINES.measure, 2600); }
      break;
    case 'right': case 'wrong': {
      playSound('m-grab', { pitch: e === 'right' ? 1.2 : 0.7 });
      if (!c) break;
      const key = c.kind === 'dungeness' ? 'dungeness' : c.size < MIN_ROCK ? 'small' : 'keeper';
      // each rule said once a game (the right call) — or whenever the call was wrong
      if (e === 'wrong') bubble(CRAB_LINES.wrong, 1600);
      else if (!r.ruleSaid.has(key)) { r.ruleSaid.add(key); bubble(CRAB_LINES[key], 2600); }
      break;
    }
    case 'done': finish(r); break;
  }
}

function finish(r: Run) {
  const g = r.game;
  cleanup(r);
  r.run.end({
    tier: crabTier(g.score),
    score: g.score,
    detail: { zh: `捞上 ${g.landed} 只 · 判断对 ${g.right} 只 · ${g.score} 分`, en: `${g.landed} landed · ${g.right} called right · ${g.score} points` },
    bestText: b => ({ zh: `最高 ${b} 分！`, en: `Best: ${b} points!` }),
    again: () => { startCrab(); },
  });
  sayWhenQuiet(CRAB_LINES.bye, 1800);
  if (rounds === 1) sayWhenQuiet(CRAB_LINES.fact, 7000);
}

function cleanup(r: Run | null = cur) {
  if (!r || cur !== r) return;
  cur = null;
  padHold = false;
  r.keys?.off();
  r.off();
  closeOverlay(CRAB_OVERLAY);
  if (flow.get().quietUntil === r.quiet) flow.set({ quietUntil: performance.now() + 4000 });
  changed();
}

/** 放弃 (✕, Esc): nothing paid. */
export function cancelCrab() { cur?.run.cancel(); }
/** tests */
export function __resetCrab() { cur?.run.cancel(); cur = null; padHold = false; rounds = 0; listeners = new Set(); }
