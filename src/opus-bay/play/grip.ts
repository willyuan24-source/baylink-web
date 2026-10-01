import { playSound } from '../audio/hooks';
import { game } from '../core/store';
import { activeCableSystem, cableLine, pointAt, type CableLine } from '../data/transit';
import { bubble } from '../game/flow';
import { flow } from '../game/flowStore';
import { registerFrameSystem } from '../game/systemsRegistry';
import { closeOverlay, openOverlay } from '../ui/slots';
import { startActivity, tierFor, type ActivityRun } from './kit';
import { holdKeys, type HeldKeys } from './partc';
import { GRIP_ID, GRIP_LINES, GRIP_NAME } from './sfgames8Lines';
import { ensureSf8Sounds } from './sfgames8Sounds';
import { sayWhenQuiet } from './zones';

/**
 * Wave 8 · lane M · THE CABLE-CAR GRIP (W8-M1): working the grip lever of the Powell St cable car you ride, for a minute.
 *
 * Read-only on the ride: the game reads the ridden car (data/transit activeCableSystem().rideStatus() → its car's arc
 * position `s`, direction, speed and mode on its line) and the line's own data (the Powell × California crossing, the
 * corners found from the track's heading, the stations, the grade); it never moves, brakes or holds the car — the
 * car runs as it always does, and the game judges how well you worked its grip:
 *
 *   hold the grip      while the car runs on the cable (the meter: the share of the running time you held it; letting go
 *                      on a climb for long makes BAYBAY call "hold tight uphill")
 *   let go             before the red stretches: the Powell × California crossing (the Powell cable runs under the
 *                      California one: the Powell cars drop the rope and coast across) and the corners (the toy treats
 *                      every corner as a let-go curve: let go, coast round) — judged as the car enters one (released:
 *                      +10, held: the alarm). Toy: the rope is taken again right past the crossing (the real northbound
 *                      cars coast on three and a half blocks downhill to Jackson: 20 s of nothing to do in a game)
 *   take the rope      again as the car leaves a red stretch (+5 within 1.2 s) and as it leaves a stop (+5)
 *   let go to stop     the car pulls into a stop with the grip let go (+5)
 *   ring the bell      approaching each cross street it runs through, and the crossing (+5 each; ringing all the time
 *                      after five stray rings costs a point a ring)
 *
 * Score 0–100 = 70 × the judged points' share + 30 × the held share; tiers ● 40 · ◆ 65 · ★ 88 (never ringing tops out
 * near 85) → `medal:grip:1..3`;
 * best = the score. 60 s of riding (the clock stops while Settings pauses the ride); a ride that ends sooner ends the
 * game there (a card from 15 s and a few judged moments, else nothing paid). Keys: Space (hold: the grip; the ride's own
 * hop-off key is the game's while it runs), H (the bell), Esc (give up).
 */

export const GRIP_SECONDS = 60;
/** a ride that ends sooner than this (s) pays nothing and shows no card */
export const MIN_SECONDS = 15;
export const GRIP_TIERS: readonly [number, number, number] = [40, 65, 88];
/** the Powell lines (the ones that let go at California) */
export const GRIP_LINES_OK: readonly string[] = ['powell-hyde', 'powell-mason'];
/** a let-go stretch begins this far before the crossing centre and ends this far past it (u, in travel order) */
export const CROSS_BEFORE = 9;
export const CROSS_AFTER = 3;
/** a corner: the heading turns more than CORNER_TURN over CORNER_SPAN u; the let-go stretch starts CORNER_LEAD before it */
export const CORNER_TURN = (20 * Math.PI) / 180;
export const CORNER_SPAN = 6;
export const CORNER_LEAD = 3;
/** the line's ends (turntable stubs, the terminus curve) are never corners (u) */
export const END_SKIP = 14;
/** a stop is passed this far beyond it; a car dwelling within STOP_AT of it is at it (u) */
export const STOP_PASSED = 1;
export const STOP_AT = 2.5;
/** the hint says let go this far before a red stretch (u: ≈ 0.7 s at the cable's 9 u/s) */
export const RELEASE_LEAD = 6;
/** let-go stretches closer than this make one (u) */
export const MERGE_GAP = 8;
/** a bell rung within this far before a cross street (or just past it) counts (u) */
export const BELL_BEFORE = 14;
export const BELL_AFTER = 1.5;
export const STRAY_FREE = 5;
/** take the rope again within this after a let-go stretch / a stop (s) */
export const TAKE_WINDOW = 1.2;
/** a let-go / a stop counts when the grip was held this recently before it (s) */
export const GRIPPED_WITHIN = 8;
export const PTS = { letgo: 10, take: 5, stop: 5, go: 5, bell: 5 } as const;

export type ZoneKind = 'cross' | 'corner';
/** A let-go stretch: from `a` to `b` in arc, entered at `a` (travel order: a < b going +1, a > b going −1). */
export interface GripZone { kind: ZoneKind; a: number; b: number; entered: boolean; left: boolean; ok: boolean | null }
export interface BellMark { at: number; rung: boolean; passed: boolean; cross: boolean }
export interface StopMark { at: number; station: string }

const ahead = (dir: 1 | -1, from: number, s: number) => (s - from) * dir;

/** The corners of a line (arc intervals [lo, hi]) from its heading, ends skipped. */
export function lineCorners(line: Pick<CableLine, 'xyz' | 'cum' | 'length'>): [number, number][] {
  const out: [number, number][] = [];
  const p = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
  const head = (s: number) => pointAt(line, s, p).heading;
  let open: [number, number] | null = null;
  for (let s = END_SKIP; s <= line.length - END_SKIP - CORNER_SPAN; s += 1) {
    let d = head(s + CORNER_SPAN) - head(s);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) > CORNER_TURN) {
      if (open && s <= open[1] + 1) open[1] = s + CORNER_SPAN;
      else { if (open) out.push(open); open = [s, s + CORNER_SPAN]; }
    }
  }
  if (open) out.push(open);
  return out;
}

/** The let-go stretches, the bells and the stops of a ride on `line` going `dir` from arc `from` to arc `to`. */
export function gripMarks(line: Pick<CableLine, 'xyz' | 'cum' | 'length' | 'stops' | 'crossings'>, dir: 1 | -1, from: number, to: number) {
  const inRide = (s: number) => ahead(dir, from, s) > -2 && ahead(dir, s, to) > -2;
  const zones: GripZone[] = [];
  const corners = lineCorners(line).map(([lo, hi]) => (dir > 0 ? [lo - CORNER_LEAD, hi] : [hi + CORNER_LEAD, lo]) as [number, number]);
  for (const c of line.crossings) {
    const a = c.at - dir * CROSS_BEFORE, b = c.at + dir * CROSS_AFTER;
    if (inRide(a) || inRide(b)) zones.push({ kind: 'cross', a, b, entered: false, left: false, ok: null });
  }
  for (const [a, b] of corners) if (inRide(a)) zones.push({ kind: 'corner', a, b, entered: false, left: false, ok: null });
  zones.sort((x, y) => ahead(dir, from, x.a) - ahead(dir, from, y.a));
  // two stretches closer than MERGE_GAP: one (no rope to take in between)
  for (let i = zones.length - 1; i > 0; i--) {
    const p = zones[i - 1], q = zones[i];
    if (ahead(dir, p.b, q.a) < MERGE_GAP) { if (ahead(dir, p.b, q.b) > 0) p.b = q.b; if (q.kind === 'cross') p.kind = 'cross'; zones.splice(i, 1); }
  }
  // (a loop, not zones.some: asked several times a frame by the run and the panel)
  const inZone = (s: number) => { for (const z of zones) if (ahead(dir, z.a, s) >= 0 && ahead(dir, s, z.b) >= 0) return true; return false; };
  // bells: the cross streets the car runs through (request stops), the crossings
  const bells: BellMark[] = [];
  for (const st of line.stops) {
    if (st.dwell || st.terminus || !inRide(st.at) || ahead(dir, from, st.at) < BELL_AFTER) continue;
    if (Math.abs(st.at - to) < 1) continue;
    bells.push({ at: st.at, rung: false, passed: false, cross: false });
  }
  for (const c of line.crossings) if (inRide(c.at) && ahead(dir, from, c.at) > BELL_AFTER) bells.push({ at: c.at, rung: false, passed: false, cross: true });
  bells.sort((x, y) => ahead(dir, from, x.at) - ahead(dir, from, y.at));
  // stops the car dwells at (and the destination) — shown on the strip; judged when the car really dwells
  const stops: StopMark[] = line.stops
    .filter(st => (st.dwell || Math.abs(st.at - to) < 1) && inRide(st.at) && ahead(dir, from, st.at) > 0.5)
    .map(st => ({ at: st.at - dir * (st.near || 0), station: st.station }))
    .sort((x, y) => ahead(dir, from, x.at) - ahead(dir, from, y.at));
  return { zones, bells, stops, inZone };
}

export interface CarView { s: number; dir: 1 | -1; v: number; mode: 'run' | 'dwell' | 'turn' | 'hold' }
export type GripEvent =
  | 'cue-cross' | 'cue-corner' | 'letgo-ok' | 'letgo-idle' | 'alarm' | 'take-ok' | 'take-late' | 'stop-ok' | 'stop-bad' | 'stop-idle'
  | 'go-ok' | 'go-late' | 'bell-ok' | 'bell-miss' | 'bell-stray' | 'bell-spam' | 'bell-first' | 'slip' | 'hyde' | 'done';

/** The game, pure: stepped with the ridden car's view and the grip held or not. */
export class GripGame {
  readonly line: Pick<CableLine, 'id' | 'xyz' | 'cum' | 'length' | 'stops' | 'crossings'>;
  readonly dir: 1 | -1;
  readonly zones: GripZone[];
  readonly bells: BellMark[];
  readonly stops: StopMark[];
  readonly inZone: (s: number) => boolean;
  t = 0;
  s: number;
  v = 0;
  mode: CarView['mode'] = 'run';
  grip = false;
  pts = 0;
  max = 0;
  held = 0;
  need = 0;
  stray = 0;
  /** the last judgement (the panel's flash) */
  last: { ev: GripEvent; at: number } | null = null;
  done = false;
  private take: { until: number; why: 'zone' | 'stop' } | null = null;
  /** when the grip was last held (s of game time; the start counts: a stop in the game's first seconds is a fair let-go) */
  private lastGrip = 0;
  /** a let-go or a stop counts only after holding the cable on the way in (doing nothing is not letting go) */
  private grippedLately() { return this.t - this.lastGrip <= GRIPPED_WITHIN; }
  private wasDwell = false;
  /** the next stop on the strip not yet dwelt at or passed */
  private stopIdx = 0;
  /** the car left a stop and has not got going yet */
  private leaving = false;
  /** the last stop was pulled into with the grip let go (the start counts as one) */
  private stopOk = true;
  private slipT = 0;
  private slipSaid = -Infinity;
  private cued = new Set<ZoneKind>();
  private bellSaid = false;
  private spamSaid = false;
  private hydeSaid = false;
  constructor(line: GripGame['line'], start: CarView, to: number) {
    this.line = line;
    this.dir = start.dir;
    this.s = start.s;
    this.v = start.v;
    this.mode = start.mode;
    const m = gripMarks(line, start.dir, start.s, to);
    this.zones = m.zones; this.bells = m.bells; this.stops = m.stops; this.inZone = m.inZone;
    this.wasDwell = start.mode === 'dwell';
  }
  get timeLeft() { return Math.max(0, GRIP_SECONDS - this.t); }
  /** the held share of the running time (1 before any) */
  get heldShare() { return this.need > 0.5 ? this.held / this.need : 1; }
  /** 0–100 */
  get score() {
    const ev = this.max > 0 ? Math.max(0, this.pts) / this.max : this.heldShare;
    return Math.round(70 * ev + 30 * this.heldShare);
  }
  /** a red stretch starting within RELEASE_LEAD ahead (the hint turns to let go before it, not inside it) */
  zoneAhead(): GripZone | undefined {
    for (const z of this.zones) { const d = ahead(this.dir, this.s, z.a); if (!z.entered && d > 0 && d <= RELEASE_LEAD) return z; }
    return undefined;
  }
  /** what the player should do now (the panel's hint) */
  get want(): 'grip' | 'release' | 'wait' {
    if (this.inZone(this.s) || this.zoneAhead()) return 'release';
    if (this.mode === 'dwell' || this.v < 0.4) return 'wait';
    if (this.stopAhead()) return 'release';
    return 'grip';
  }
  /** braking into the next stop (to its last bit: the hint never flips back to grip in the car's final half-unit) */
  stopAhead(): boolean {
    const st = this.stops[this.stopIdx];
    if (!st || this.mode !== 'run') return false;
    const d = ahead(this.dir, this.s, st.at);
    return d > -STOP_PASSED && d < 9 && (this.v < 8.9 || d < 1.5);
  }
  /** a bell to ring now (the lever's hint goes on: the crossing's bell is rung while coasting across) */
  get bellNow(): boolean { return !!this.bellWindow(); }
  private bellWindow(): BellMark | undefined {
    for (const b of this.bells) { const d = ahead(this.dir, this.s, b.at); if (!b.rung && !b.passed && d <= BELL_BEFORE && d >= -BELL_AFTER) return b; }
    return undefined;
  }
  private judge(ev: GripEvent, got: number, of: number, out: GripEvent[]) {
    this.pts += got; this.max += of;
    this.last = { ev, at: this.t };
    out.push(ev);
  }
  /** A ring of the bell. */
  ring(): GripEvent[] {
    const out: GripEvent[] = [];
    if (this.done) return out;
    const b = this.bellWindow();
    if (b) { b.rung = true; this.judge('bell-ok', PTS.bell, PTS.bell, out); return out; }
    this.stray++;
    if (this.stray > STRAY_FREE) { this.pts -= 1; if (!this.spamSaid) { this.spamSaid = true; out.push('bell-spam'); } }
    out.push('bell-stray');
    return out;
  }
  /** One frame: the car's view (null: the ride is gone) and the grip lever. */
  step(dt: number, car: CarView | null, grip: boolean): GripEvent[] {
    const out: GripEvent[] = [];
    if (this.done) return out;
    this.grip = grip;
    if (!car) { this.done = true; out.push('done'); return out; }
    const prevS = this.s;
    this.t += dt;
    this.s = car.s; this.v = car.v; this.mode = car.mode;
    const dir = this.dir;
    const moving = car.mode === 'run' && car.v > 0.4;
    // the let-go window counts running time only: a red stretch right after a stop (Powell & Pine going south, the
    // crossing station going north) is a fair let-go when the grip was last held on the way into that stop
    if (grip) this.lastGrip = this.t;
    else if (!moving) this.lastGrip += dt;
    const inZone = this.inZone(car.s);
    // the red stretches: cue ahead, judge on entry, take the rope after
    for (const z of this.zones) {
      const toA = ahead(dir, car.s, z.a);
      if (!z.entered && toA <= 18 && toA > 0 && !this.cued.has(z.kind)) {
        this.cued.add(z.kind);
        out.push(z.kind === 'cross' ? 'cue-cross' : 'cue-corner');
      }
      if (!z.entered && ahead(dir, prevS, z.a) > 0 && toA <= 0) {
        z.entered = true;
        z.ok = !grip && this.grippedLately();
        if (grip) this.judge('alarm', 0, PTS.letgo, out);
        else this.judge(z.ok ? 'letgo-ok' : 'letgo-idle', z.ok ? PTS.letgo : 0, PTS.letgo, out);
      } else if (!z.entered && toA <= 0 && ahead(dir, car.s, z.b) > 0) z.entered = true;
      if (z.entered && !z.left && ahead(dir, car.s, z.b) <= 0) {
        z.left = true;
        // a right let-go keeps the lever "in rhythm": a stop right after the red is a fair let-go too
        if (z.ok) this.lastGrip = this.t;
        // taking the rope again counts after a real let-go (held through: no rope was ever dropped)
        if (moving && z.ok) this.take = { until: this.t + TAKE_WINDOW, why: 'zone' };
      }
    }
    // the bells passed by
    for (const b of this.bells) {
      if (b.passed || ahead(dir, car.s, b.at) >= -BELL_AFTER) continue;
      b.passed = true;
      if (!b.rung) this.judge('bell-miss', 0, PTS.bell, out);
    }
    const bw = this.bellWindow();
    if (bw && !this.bellSaid) { this.bellSaid = true; out.push('bell-first'); }
    // a stop: let go before it (judged as the car dwells; not inside a red stretch, already judged)
    const dwell = car.mode === 'dwell';
    // the next stop: done once the car has stood at it or run past it
    for (let st = this.stops[this.stopIdx]; st; st = this.stops[this.stopIdx]) {
      const d = ahead(dir, car.s, st.at);
      if (d < -STOP_PASSED || (dwell && Math.abs(d) < STOP_AT)) this.stopIdx++;
      else break;
    }
    if (dwell && !this.wasDwell && !inZone) {
      this.stopOk = !grip && this.grippedLately();
      if (grip) this.judge('stop-bad', 0, PTS.stop, out);
      else this.judge(this.stopOk ? 'stop-ok' : 'stop-idle', this.stopOk ? PTS.stop : 0, PTS.stop, out);
      this.take = null;
    }
    // leaving a stop: take the rope (pressing it while the car stands counts)
    if (this.wasDwell && !dwell) this.leaving = true;
    if (this.leaving && moving) { this.leaving = false; if (!inZone && this.stopOk) this.take = { until: this.t + TAKE_WINDOW, why: 'stop' }; }
    if (dwell) this.leaving = false;
    if (this.take) {
      // a new red stretch or a stop right away (or the hint already says let go for one): nothing to take; standing
      // still (a hold): the window waits
      if (inZone || dwell || this.stopAhead() || this.zoneAhead()) this.take = null;
      else if (!moving) this.take.until += dt;
      else if (grip) { this.judge(this.take.why === 'zone' ? 'take-ok' : 'go-ok', PTS.take, PTS.take, out); this.take = null; }
      else if (this.t > this.take.until) { this.judge(this.take.why === 'zone' ? 'take-late' : 'go-late', 0, PTS.take, out); this.take = null; }
    }
    // the cable: held while it runs (outside the red, not braking into a stop)
    const want = this.want;
    if (moving && !inZone && want !== 'release' && car.v > 2) {
      this.need += dt;
      if (grip) { this.held += dt; this.slipT = 0; }
      else {
        const p = pointAt(this.line, car.s);
        if (p.grade * dir > 0.05) {
          this.slipT += dt;
          if (this.slipT > 0.8 && this.t - this.slipSaid > 8) { this.slipSaid = this.t; out.push('slip'); }
        }
      }
    }
    // Hyde St from Chestnut to Bay: the steepest grade on the system (once)
    if (!this.hydeSaid && this.line.id === 'powell-hyde' && moving) {
      const a = this.line.stops.find(st => st.station === 'hyde-chestnut')?.at, b = this.line.stops.find(st => st.station === 'hyde-bay')?.at;
      if (a !== undefined && b !== undefined && car.s > Math.min(a, b) && car.s < Math.max(a, b)) { this.hydeSaid = true; out.push('hyde'); }
    }
    this.wasDwell = dwell;
    if (this.t >= GRIP_SECONDS) { this.done = true; out.push('done'); }
    return out;
  }
}

export const gripTier = (score: number) => tierFor(score, GRIP_TIERS);

// --- the run ---------------------------------------------------------------------------------------------------------------

export const GRIP_OVERLAY = 'play-grip';

/** The ridden Powell car as the game sees it (null: not on a Powell car under way). */
export function liveCar(): { view: CarView; line: CableLine; to: number } | null {
  const r = flow.get().ride;
  if (!r || r.kind !== 'cable-car' || r.stage === 'waiting' || !r.line || !GRIP_LINES_OK.includes(r.line)) return null;
  const sys = activeCableSystem(), st = sys?.rideStatus();
  if (!sys || !st || st.phase !== 'riding') return null;
  const car = sys.cars[st.car], line = cableLine(r.line);
  if (!car || !line || car.line.id !== line.id) return null;
  const to = line.stops.find(x => x.station === r.to)?.at ?? (car.dir > 0 ? line.length : 0);
  return { view: { s: car.s, dir: car.dir, v: car.v, mode: car.mode }, line, to };
}

interface Run { run: ActivityRun; game: GripGame; keys: HeldKeys | null; off: () => void; quiet: number; said: number }
let cur: Run | null = null;
let listeners = new Set<() => void>();
let seq = 0;
let rounds = 0;
let padHold = false;
const changed = () => { seq++; for (const fn of [...listeners]) fn(); };
export const gripSeq = () => seq;
export function subscribeGrip(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export const gripGame = (): GripGame | null => cur?.game ?? null;
export const gripRunning = () => !!cur;

/**
 * 拉闸 on a Powell car under way (the ride banner's pad). `view` is the car's source (tests pass a fake car); returns
 * whether a game started.
 */
export function startGrip(source: () => ReturnType<typeof liveCar> = liveCar): boolean {
  if (cur) return false;
  const first = source();
  if (!first) return false;
  const run = startActivity({ id: GRIP_ID, name: GRIP_NAME, better: 'higher' }, { onStop: how => { if (how === 'cancel') cleanup(); } });
  if (!run) return false;
  ensureSf8Sounds();
  const g = new GripGame(first.line, first.view, first.to);
  const keys = holdKeys(['Space', 'KeyH', 'Escape'], code => {
    if (code === 'Escape') { cancelGrip(); return; }
    if (code === 'KeyH') gripBell();
  });
  const r: Run = { run, game: g, keys, off: () => {}, quiet: performance.now() + 75000, said: -Infinity };
  let lastGrip = false;
  r.off = registerFrameSystem('m-play-grip', dt => {
    if (cur !== r) return;
    // Settings pauses the ride: the game's clock stops with it
    if (game.get().paused) return;
    const live = source();
    const grip = padHold || keys.isDown('Space');
    if (grip !== lastGrip) { lastGrip = grip; playSound(grip ? 'm8-grip-on' : 'm8-grip-off'); }
    const before = g.last?.at, want = g.want, bell = g.bellNow;
    for (const e of g.step(Math.min(dt, 0.1), live ? live.view : null, grip)) onGripEvent(r, e);
    if (before !== g.last?.at || want !== g.want || bell !== g.bellNow) changed();
  });
  cur = r;
  rounds++;
  openOverlay(GRIP_OVERLAY);
  flow.set({ quietUntil: Math.max(flow.get().quietUntil, r.quiet) });
  bubble(GRIP_LINES.start, 2800);
  changed();
  return true;
}

/** The panel's buttons. */
export function setGripHold(on: boolean) { padHold = on; }
export function gripBell() {
  const r = cur;
  if (!r) return;
  playSound('play-bell', { pitch: 1 + (Math.random() - 0.5) * 0.02 });
  for (const e of r.game.ring()) onGripEvent(r, e);
  changed();
}

/** BAYBAY at most every 2.2 s, an important line always */
function say(r: Run, line: { zh: string; en: string }, ms = 2400, force = false) {
  const now = r.game.t;
  if (!force && now - r.said < 2.2) return;
  r.said = now;
  bubble(line, ms);
}

function onGripEvent(r: Run, e: GripEvent) {
  switch (e) {
    case 'cue-cross': say(r, GRIP_LINES.cross, 2600, true); break;
    case 'cue-corner': say(r, GRIP_LINES.corner, 2400); break;
    case 'letgo-ok': playSound('m8-coast'); if (r.game.zones.filter(z => z.ok).length === 1) say(r, GRIP_LINES.letgoGood); break;
    case 'alarm': playSound('m8-alarm'); say(r, GRIP_LINES.alarm, 2400, true); break;
    case 'take-ok': playSound('m8-take'); if (r.game.zones.filter(z => z.left).length === 1) say(r, GRIP_LINES.take); break;
    case 'go-late': case 'take-late': say(r, GRIP_LINES.depart); break;
    case 'go-ok': playSound('m8-take'); break;
    case 'stop-ok': if (r.game.max <= PTS.stop * 2) say(r, GRIP_LINES.stopGood); break;
    case 'stop-bad': playSound('m8-alarm', { gain: 0.5 }); say(r, GRIP_LINES.stopBad); break;
    case 'bell-first': say(r, GRIP_LINES.bellFirst); break;
    case 'bell-spam': say(r, GRIP_LINES.bellSpam); break;
    case 'slip': say(r, GRIP_LINES.slip); break;
    case 'hyde': say(r, GRIP_LINES.hyde, 3200); break;
    case 'done': finish(r); break;
    default: break;
  }
}

const FACTS = [GRIP_LINES.factCross, GRIP_LINES.factSpeed, GRIP_LINES.factStrength];

function finish(r: Run) {
  const g = r.game;
  cleanup(r);
  // a ride that ended at once: nothing to judge — no card, nothing paid (BAYBAY says why)
  if (g.t < MIN_SECONDS || g.max < 15) { r.run.cancel(); bubble(GRIP_LINES.short, 3200); return; }
  const score = g.score, tier = gripTier(score);
  const zonesOk = g.zones.filter(z => z.ok).length, zonesIn = g.zones.filter(z => z.ok !== null).length, bells = g.bells.filter(b => b.rung).length, bellsAll = g.bells.filter(b => b.rung || b.passed).length;
  const heldPct = Math.round(g.heldShare * 100);
  r.run.end({
    tier, score,
    detail: { zh: `${score} 分 · 松闸 ${zonesOk}/${zonesIn} · 摇铃 ${bells}/${bellsAll} · 抓缆 ${heldPct}%`, en: `${score} · let-gos ${zonesOk}/${zonesIn} · bells ${bells}/${bellsAll} · on the cable ${heldPct}%` },
    bestText: b => ({ zh: `最高 ${b} 分！`, en: `Best: ${b}!` }),
    again: liveCar() ? () => { startGrip(); } : undefined,
  });
  sayWhenQuiet(tier === 3 ? GRIP_LINES.star : GRIP_LINES.good, 1600);
  sayWhenQuiet(FACTS[(rounds - 1) % FACTS.length], 6500, 4200);
}

function cleanup(r: Run | null = cur) {
  if (!r || cur !== r) return;
  cur = null;
  padHold = false;
  r.keys?.off();
  r.off();
  closeOverlay(GRIP_OVERLAY);
  if (flow.get().quietUntil === r.quiet) flow.set({ quietUntil: performance.now() + 4000 });
  changed();
}

/** 放弃 (✕, Esc): nothing paid. */
export function cancelGrip() { cur?.run.cancel(); }
/** tests */
export function __resetGrip() { cur?.run.cancel(); cur = null; padHold = false; rounds = 0; listeners = new Set(); }
