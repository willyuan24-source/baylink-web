import { charApi } from '../actors/charApi';
import { playSound } from '../audio/hooks';
import type { Bilingual } from '../core/types';
import { bubble } from '../game/flow';
import { flow } from '../game/flowStore';
import { registerFrameSystem } from '../game/systemsRegistry';
import { closeOverlay, openOverlay } from '../ui/slots';
import { bestOf, saveNumber, startActivity, tierFor, type ActivityRun } from './kit';
import { freeOnFoot, holdKeys, type HeldKeys } from './partc';
import { CLAW_ID, CLAW_LINES, CLAW_NAME } from './sfgamesLines';
import { ensureSfSounds } from './sfgamesSounds';
import { sayWhenQuiet } from './zones';

/**
 * Wave 7 · lane M · the Musée Mécanique claw machine (Pier 45): five quarters, a glass cabinet of toy San Francisco
 * souvenirs, one claw. Aim (drag in the glass / hold ◀ ▶ / ← → A D), drop (let go of the drag / 抓！ / Space Enter ↓):
 * the claw drops, closes, lifts and carries what it holds to the chute on the left. A prize held near its middle never
 * slips; the farther off, the likelier it slips back. Tiers by souvenirs won in one go (● 1 · ◆ 2 · ★ 3), the kit's
 * `medal:claw:1..3`; the kinds ever won are kept in `play.b['claw-set']` (a bit per kind: the notebook row counts them).
 *
 * The game itself is pure (ClawGame, stepped by the game loop: a paused game pauses the claw); the panel (ClawPanel.tsx,
 * its own chunk) draws it on a canvas and feeds the input. Nothing is added to the 3D scene.
 */

/** The cabinet, in its own units: 100 wide; the chute's mouth at the left; the claw's rest point above the chute. */
export const CAB_W = 100;
export const CHUTE_W = 16;
export const CLAW_REST = 8;
/** Aim speed (u/s), the time to aim each try (s: then it drops by itself), quarters per game. */
export const CLAW_SPEED = 30;
export const AIM_SECONDS = 12;
export const TRIES = 5;
/** The souvenirs are drawn (and caught) this much larger than their art units. */
export const PRIZE_SCALE = 1.3;
/** Half the width a claw can catch a prize by (u). */
export const catchHalf = (k: PrizeKind) => (k.w * PRIZE_SCALE) / 2 + 0.6;
/** A prize held within this many u of its middle never slips. */
export const SWEET = 2.4;
/** Phase lengths (s). */
export const T_DROP = 0.9, T_CLOSE = 0.35, T_LIFT = 0.8, T_CARRY_SPEED = 45, T_RELEASE = 0.5;

export interface PrizeKind { id: string; name: Bilingual; w: number; grip: number }
/** The eight toy souvenirs (their art: clawArt.ts; append-only: the saved set is a bit per kind). */
export const PRIZE_KINDS: readonly PrizeKind[] = [
  { id: 'cable-car', name: { zh: '小缆车', en: 'a toy cable car' }, w: 12, grip: 0.95 },
  { id: 'bridge', name: { zh: '金门大桥挂件', en: 'a Golden Gate charm' }, w: 12, grip: 0.8 },
  { id: 'sea-lion', name: { zh: '海狮玩偶', en: 'a sea lion plush' }, w: 12, grip: 1 },
  { id: 'cookie', name: { zh: '幸运饼干', en: 'a fortune cookie' }, w: 9, grip: 0.85 },
  { id: 'loaf', name: { zh: '酸面包抱枕', en: 'a sourdough pillow' }, w: 11, grip: 1 },
  { id: 'coit', name: { zh: '科伊特塔模型', en: 'a Coit Tower model' }, w: 8, grip: 0.8 },
  { id: 'house', name: { zh: '彩色小屋', en: 'a Painted Lady house' }, w: 10, grip: 0.9 },
  { id: 'crab', name: { zh: '螃蟹玩偶', en: 'a crab plush' }, w: 12, grip: 0.95 },
];
export const SET_KEY = 'claw-set';
export const ALL_KINDS = (1 << PRIZE_KINDS.length) - 1;

export interface Prize { kind: number; x: number; row: 0 | 1; won: boolean }
export type ClawPhase = 'aim' | 'drop' | 'close' | 'lift' | 'carry' | 'release' | 'done';
export type ClawEvent = 'grab' | 'slip' | 'miss' | 'won' | 'drop' | 'done';

/** The pile: every kind once, shuffled, in two staggered rows right of the chute (x 24…96). */
export function layoutPrizes(rand: () => number): Prize[] {
  const kinds = PRIZE_KINDS.map((_, i) => i);
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  return kinds.map((kind, i) => ({ kind, x: +(25 + (i % 4) * 18 + (i >= 4 ? 9 : 0) + (rand() - 0.5) * 3).toFixed(1), row: (i >= 4 ? 1 : 0) as 0 | 1, won: false }));
}

/** The chance a grab at `dx` from a prize's middle holds it (1 inside SWEET, falling to a quarter of its grip at the edge). */
export function holdChance(dx: number, k: PrizeKind): number {
  const half = catchHalf(k), d = Math.abs(dx);
  if (d > half) return 0;
  if (d <= SWEET) return 1;
  return k.grip * (1 - 0.75 * (d - SWEET) / (half - SWEET));
}

/** The claw game, pure: step it with the frame's dt and the input; it returns what happened this step. */
export class ClawGame {
  prizes: Prize[];
  x = CLAW_REST + 14;
  /** 0 = up, 1 = down on the pile */
  y = 0;
  /** 0 = open, 1 = closed */
  grip = 0;
  phase: ClawPhase = 'aim';
  t = 0;
  tries = TRIES;
  won: number[] = [];
  held: number | null = null;
  /** the grab will slip at this height (0…1 of the lift) */
  slipAt = -1;
  /** input: -1 / 0 / 1, or a target x (a drag in the glass) */
  dir = 0;
  target: number | null = null;
  private dropAsked = false;
  /** a tap in the glass: drop once the claw reaches the target */
  dropOnArrive = false;
  private readonly rand: () => number;
  constructor(rand: () => number = Math.random) { this.rand = rand; this.prizes = layoutPrizes(rand); }
  get aimLeft() { return this.phase === 'aim' ? Math.max(0, AIM_SECONDS - this.t) : 0; }
  /** 抓！ (only while aiming) */
  drop() { if (this.phase === 'aim') this.dropAsked = true; }
  private go(p: ClawPhase) { this.phase = p; this.t = 0; }
  /** The prize under the claw (the top row first, then the nearest middle), or null. */
  under(x = this.x): { i: number; dx: number } | null {
    let best: { i: number; dx: number } | null = null, bestKey = Infinity;
    this.prizes.forEach((p, i) => {
      if (p.won) return;
      const dx = x - p.x, half = catchHalf(PRIZE_KINDS[p.kind]);
      if (Math.abs(dx) > half) return;
      const key = Math.abs(dx) - p.row * 3;
      if (key < bestKey) { bestKey = key; best = { i, dx }; }
    });
    return best;
  }
  step(dt: number): ClawEvent[] {
    const ev: ClawEvent[] = [];
    if (this.phase === 'done' || !(dt > 0)) return ev;
    this.t += dt;
    switch (this.phase) {
      case 'aim': {
        if (this.target !== null) {
          const d = this.target - this.x;
          this.x += Math.sign(d) * Math.min(Math.abs(d), CLAW_SPEED * 1.6 * dt);
          if (this.dropOnArrive && Math.abs(this.target - this.x) < 0.05) this.dropAsked = true;
        } else this.x += this.dir * CLAW_SPEED * dt;
        this.x = Math.max(CHUTE_W + 4, Math.min(CAB_W - 4, this.x));
        if (this.dropAsked || this.t >= AIM_SECONDS) { this.dropAsked = false; this.dropOnArrive = false; this.target = null; this.dir = 0; ev.push('drop'); this.go('drop'); }
        break;
      }
      case 'drop':
        this.y = Math.min(1, this.t / T_DROP);
        if (this.t >= T_DROP) this.go('close');
        break;
      case 'close': {
        this.grip = Math.min(1, this.t / T_CLOSE);
        if (this.t >= T_CLOSE) {
          const u = this.under();
          this.held = null; this.slipAt = -1;
          if (u) {
            const chance = holdChance(u.dx, PRIZE_KINDS[this.prizes[u.i].kind]);
            this.held = u.i;
            // a grab that will not hold slips partway up (you see it lift, then fall)
            if (this.rand() >= chance) this.slipAt = 0.35 + this.rand() * 0.4;
            ev.push('grab');
          } else ev.push('miss');
          this.go('lift');
        }
        break;
      }
      case 'lift':
        this.y = Math.max(0, 1 - this.t / T_LIFT);
        if (this.held !== null && this.slipAt >= 0 && 1 - this.y >= this.slipAt) {
          // it slips back onto the pile, a little to one side
          const p = this.prizes[this.held];
          p.x = Math.max(CHUTE_W + 8, Math.min(CAB_W - 6, p.x + (this.rand() < 0.5 ? -1 : 1) * (1.5 + this.rand() * 2.5)));
          this.held = null; this.slipAt = -1;
          ev.push('slip');
        }
        if (this.t >= T_LIFT) this.go('carry');
        break;
      case 'carry': {
        const d = CLAW_REST - this.x;
        this.x += Math.sign(d) * Math.min(Math.abs(d), T_CARRY_SPEED * dt);
        if (Math.abs(CLAW_REST - this.x) < 0.01) this.go('release');
        break;
      }
      case 'release':
        this.grip = Math.max(0, 1 - this.t / 0.25);
        if (this.held !== null && this.t >= 0.2) {
          const p = this.prizes[this.held];
          p.won = true; this.won.push(p.kind); this.held = null;
          ev.push('won');
        }
        if (this.t >= T_RELEASE) {
          this.tries--;
          if (this.tries <= 0 || this.prizes.every(p => p.won)) { this.go('done'); ev.push('done'); }
          else { this.x = CLAW_REST + 14; this.go('aim'); }
        }
        break;
    }
    return ev;
  }
}

/** ● 1 souvenir · ◆ 2 · ★ 3 or more (in one go of five quarters). */
export const clawTier = (n: number) => tierFor(n, [1, 2, 3]);

// --- the run (the kit, the panel, the keys, BAYBAY) ------------------------------------------------------------------------

export const CLAW_OVERLAY = 'play-claw';

interface Run { run: ActivityRun; game: ClawGame; keys: HeldKeys | null; off: () => void; newKinds: number; quiet: number }
let cur: Run | null = null;
let listeners = new Set<() => void>();
let seq = 0;
const changed = () => { seq++; for (const fn of [...listeners]) fn(); };
export const clawSeq = () => seq;
export function subscribeClaw(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export const clawGame = (): ClawGame | null => cur?.game ?? null;
/** The kinds ever won (a bit per PRIZE_KINDS index). */
export const clawSet = (): number => Math.max(0, Math.floor(bestOf(SET_KEY) ?? 0)) & ALL_KINDS;
export const setCount = (mask: number) => { let n = 0; for (let m = mask & ALL_KINDS; m; m &= m - 1) n++; return n; };

/** 抓娃娃 at the Musée's door. Returns whether a game started. */
export function startClaw(rand: () => number = Math.random): boolean {
  if (cur || !freeOnFoot()) return false;
  const run = startActivity({ id: CLAW_ID, name: CLAW_NAME, better: 'higher' }, { lock: true, cancelOnMove: true, onStop: how => { if (how === 'cancel') cleanup(); } });
  if (!run) return false;
  ensureSfSounds();
  const game = new ClawGame(rand);
  const keys = holdKeys(['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'Enter', 'ArrowDown', 'KeyS', 'Escape', 'KeyE'], code => {
    if (code === 'Escape') { cancelClaw(); return; }
    if (code === 'Space' || code === 'Enter' || code === 'ArrowDown' || code === 'KeyS') game.drop();
  });
  const r: Run = { run, game, keys, off: () => {}, newKinds: 0, quiet: performance.now() + 60000 };
  r.off = registerFrameSystem('m-play-claw', dt => {
    if (cur !== r) return;
    if (keys.held()) {
      const l = keys.isDown('ArrowLeft') || keys.isDown('KeyA'), rt = keys.isDown('ArrowRight') || keys.isDown('KeyD');
      if (l !== rt) { game.target = null; game.dir = l ? -1 : 1; } else if (game.target === null) game.dir = 0;
    } else if (game.target === null && !padDir) game.dir = 0;
    if (padDir && game.target === null) game.dir = padDir;
    const before = game.phase;
    for (const e of game.step(Math.min(dt, 0.1))) onClawEvent(r, e);
    // the panel draws the claw every animation frame by itself; React only hears of a new phase (the header, the buttons)
    if (before !== game.phase) changed();
  });
  cur = r;
  openOverlay(CLAW_OVERLAY);
  flow.set({ quietUntil: Math.max(flow.get().quietUntil, r.quiet) });
  bubble(CLAW_LINES.start, 2600);
  playSound('m-coin');
  changed();
  return true;
}

let padDir = 0;
/** The panel's ◀ ▶ (held): -1 / 0 / 1. */
export function setClawDir(d: -1 | 0 | 1) { padDir = d; const g = cur?.game; if (g && d) g.target = null; }
/** A drag in the glass: aim at x (cabinet units); `release` (the finger lifts): drop once the claw is there. */
export function aimClaw(x: number, release = false) {
  const g = cur?.game;
  if (!g || g.phase !== 'aim') return;
  g.target = Math.max(CHUTE_W + 4, Math.min(CAB_W - 4, x));
  if (release) g.dropOnArrive = true;
}
export function dropClaw() { cur?.game.drop(); }

function onClawEvent(r: Run, e: ClawEvent) {
  const g = r.game;
  if (e === 'drop') playSound('m-whir');
  else if (e === 'grab') playSound('m-grab');
  else if (e === 'miss') { bubble(CLAW_LINES.miss, 1800); }
  else if (e === 'slip') { playSound('m-grab', { pitch: 0.6 }); bubble(CLAW_LINES.slip, 1600); }
  else if (e === 'won') {
    playSound('play-ring');
    const kind = g.won[g.won.length - 1], mask = clawSet(), bit = 1 << kind;
    if (!(mask & bit)) { r.newKinds++; saveNumber(SET_KEY, mask | bit); }
    charApi()?.emote('baybay', 'clap');
    bubble((clawSet() & ALL_KINDS) === ALL_KINDS && !(mask & bit) ? CLAW_LINES.allKinds : !(mask & bit) ? CLAW_LINES.newKind : CLAW_LINES.got, 2200);
  } else if (e === 'done') finish(r);
}

function finish(r: Run) {
  const g = r.game, n = g.won.length, kinds = setCount(clawSet());
  const names = g.won.map(k => PRIZE_KINDS[k].name);
  cleanup();
  r.run.end({
    tier: clawTier(n),
    score: n,
    detail: n
      ? { zh: `抓到 ${n} 个：${names.map(x => x.zh).join('、')} · 收集 ${kinds} / ${PRIZE_KINDS.length} 种`, en: `${n} won: ${names.map(x => x.en).join(', ')} · ${kinds} / ${PRIZE_KINDS.length} kinds collected` }
      : { zh: `五枚硬币都没抓到 · 收集 ${kinds} / ${PRIZE_KINDS.length} 种`, en: `Nothing this time · ${kinds} / ${PRIZE_KINDS.length} kinds collected` },
    bestText: b => ({ zh: `最多一次抓到 ${b} 个！`, en: `Best: ${b} in one go!` }),
    again: () => { startClaw(); },
  });
  // a fact about the arcade, then the fortune teller next door
  const facts = [CLAW_LINES.factQuarters, CLAW_LINES.factOld, CLAW_LINES.factMove];
  sayWhenQuiet(facts[rounds++ % facts.length], 2600);
  sayWhenQuiet(CLAW_LINES.fortuneInvite, 9000, 3000);
}
let rounds = 0;

function cleanup() {
  const r = cur;
  if (!r) return;
  cur = null;
  padDir = 0;
  r.keys?.off();
  r.off();
  closeOverlay(CLAW_OVERLAY);
  // BAYBAY's own chatter comes back a few seconds after (only the quiet this game asked for)
  if (flow.get().quietUntil === r.quiet) flow.set({ quietUntil: performance.now() + 4000 });
  changed();
}

/** 放弃 (the panel's ✕, Esc): nothing paid. */
export function cancelClaw() { cur?.run.cancel(); }
/** tests */
export function __resetClaw() { cur?.run.cancel(); cur = null; padDir = 0; rounds = 0; listeners = new Set(); }
