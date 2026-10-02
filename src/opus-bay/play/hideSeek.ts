import { findPath } from '../actors/nav';
import { charApi } from '../actors/charApi';
import { playSound } from '../audio/hooks';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { input } from '../core/input';
import { canStand, heightAt, STAND_RADIUS, surfaceAt } from '../core/terrain';
import type { Bilingual, Vec2 } from '../core/types';
import { ATTRACTIONS } from '../data/sf/attractions';
import { faceCameraToward } from '../game/cinema';
import { bubble } from '../game/flow';
import { flow } from '../game/flowStore';
import { registerFrameSystem } from '../game/systemsRegistry';
import { hideChip, patchChip, showChip } from './chip';
import { currentActivity, startActivity, tierFor, type ActivityRun } from './kit';
import { freeOnFoot, pinBaybay } from './partc';
import { setPuppet } from './puppet';
import { ensurePlaySounds2 } from './sounds2';

/**
 * Wave 6 · lane W · 捉迷藏 hide & seek with BAYBAY (W6-W4; sf-w6-lead §3 row W, NEXT #16 "hide & seek (could)").
 *
 *   start      问 BAYBAY → 捉迷藏 (play/hideSeekEntry.ts: one tap in her menu, phones too), in free roam on foot
 *   hide       she picks a spot near a landmark 18–60 u away (data/sf/attractions: its trip end, then a point a few u
 *              behind it, away from you) that is standable and that the nav grid walks to from where you stand — or,
 *              where no landmark is that close, a walkable spot 20–45 u away ("就在附近") — counts 3 · 2 · 1 and is gone
 *   seek       the PlayKit chip: 找 BAYBAY, the landmark's name, the seconds, and 暖了！/ 冷了… each time you get 2.5 u
 *              closer / farther than at the last word (for 2.5 s), between the words how warm it is (好烫！≤ 8 u · 暖暖的 ≤ 20 · 有点凉 ≤ 40 ·
 *              冷冰冰); every 15 s she hops where she hides (you may spot her); 放弃 on the chip ends it for free
 *   found      within FOUND_R u of her: 被你找到啦！ — the medal `medal:hide-seek:<tier>` through the kit (5 / 10 / 15 coins,
 *              each tier once: ≤ 45 s 太棒了, ≤ 90 s 很好, found at all 好), the best time kept (lower is better)
 *   time up    after GIVE_UP_S she calls out and comes back (no medal)
 *
 * She is pinned where she hides (partc pinBaybay: her feet and her drawn body) while you seek; the pin goes when the run
 * stops, whichever way (the kit's onStop). Nothing here runs in the district (the play feature loads in city mode only).
 *
 * W9-G3 (review 2026-10-01 R§5 #13, gamer-3 / x1: from the Ferry Building she hid across the Embarcadero 30 times of 30, the
 * kerb stopped the player without a word, the camera turned by itself, the words flipped, the time-out paid nothing and the
 * chip said 金银岛 while she sat on Pier 14):
 *   - the same side: a spot whose walking route is longer than SIDE_K × the straight line + SIDE_ADD (a road between, a
 *     crossing to walk to) is only a fallback, when no same-side spot is found;
 *   - no `offWalk` landmark (Alcatraz, Treasure Island: the trip end is a pier far from the island) and none whose trip end
 *     is far from the landmark itself: the clue names where she really is;
 *   - pushing into a kerb for CURB_S s: 「从斑马线过去」 on the chip and, once a round, her fixed line;
 *   - no automatic camera turn while you seek (the follow camera's assists wait as if you were steering it);
 *   - the heat word holds its band until the (smoothed) distance is BAND_HOLD u past the edge; 暖了 / 冷了 is added after it;
 *   - time up: she waves where she hid and the camera turns there (REVEAL_S s), then the card 再试试 says where she was;
 *     the kit pays the day's 今日小游戏 coins when not paid yet today (play/kit.ts).
 */

export const HIDE_ID = 'hide-seek';
export const HIDE_NAME: Bilingual = { zh: '捉迷藏', en: 'Hide & seek' };
/** a landmark's trip end this far from you (u) may be where she hides */
export const HIDE_MIN = 18;
export const HIDE_MAX = 60;
/** without a landmark in range: a walkable spot this far away */
export const NEAR_MIN = 20;
export const NEAR_MAX = 45;
/** found within this many u of her */
export const FOUND_R = 2.6;
/** a warmer / colder word each time you are this much closer / farther than at the last word */
export const HINT_STEP = 2.5;
/** seconds before she gives up hiding */
export const GIVE_UP_S = 180;
/** medal thresholds (seconds, lower is better): 好 / 很好 / 太棒了 */
export const HIDE_TIERS: readonly [number, number, number] = [GIVE_UP_S, 90, 45];
const COUNT_S = 3;
/** W7-W2: the chip shows the found time this long (s) before the card */
export const FOUND_HOLD = 1.2;
const HOP_EVERY = 15;
/** W9-G3: a route this many times the straight line (+ SIDE_ADD u) means she is across a road from you */
export const SIDE_K = 1.35;
export const SIDE_ADD = 4;
/** W9-G3: a trip end farther than this from its landmark is not "near" it (u) */
export const NEAR_LANDMARK = 60;
/** W9-G3: pushing against a kerb this long (s) brings the crossing hint */
export const CURB_S = 1.4;
/** W9-G3: the reveal at time-up (s) */
export const REVEAL_S = 2.6;
/** W9-G3: a heat band holds until the smoothed distance is this far past its edge (u) */
export const BAND_HOLD = 1.5;
/** W9-G3: landmarks tried (was 6), the nearby ring's points per radius (was 8) and the cut spots walked at the end */
export const HIDE_POOL = 10;
export const RING_N = 16;
export const LATER_ASK = 8;
/** W9-G3: this many samples in a row (0.8 u apart) the walker may not stand on cut the straight line (a lamp post, a palm
 * or a bench is fewer; a street kerb to kerb, the tracks, a building more) */
export const CUT_RUN = 4;

export interface HideSpot {
  x: number;
  z: number;
  /** the landmark she hides near (its attraction id and short name), null = just nearby */
  near: { id: string; name: Bilingual } | null;
}

export interface HideCandidate { id: string; name: Bilingual; x: number; z: number }

/** Every attraction's trip end (its arrival, else its anchor): where she may hide near. */
export function hideCandidates(): HideCandidate[] {
  // (W9-G3) never an island seen from a pier (`offWalk`), never a trip end far from its landmark: the clue would name a
  // place she is not at (x1: 「她藏在金银岛附近」 on Pier 14)
  return ATTRACTIONS.filter(a => !a.offWalk && (!a.arrival || Math.hypot(a.arrival.x - a.x, a.arrival.z - a.z) <= NEAR_LANDMARK))
    .map(a => ({ id: a.id, name: a.short ?? a.name, x: a.arrival?.x ?? a.x, z: a.arrival?.z ?? a.z }));
}

export interface HideOpts {
  /** a walker stands there */
  stand(x: number, z: number): boolean;
  /** the nav grid walks there from the player */
  reach(from: Vec2, to: Vec2): boolean;
  /**
   * (W9-G3) the walking route's length there from the player, null when it does not get there; when given it replaces
   * `reach` (one nav query) and a spot across a road (route > SIDE_K × straight + SIDE_ADD) is only a fallback
   */
  route?(from: Vec2, to: Vec2): number | null;
  /** (W9-G3) ground the walker may not step on cuts the straight line between (the kerb that stops a player who heads
   * straight for her): such a spot is only a fallback too */
  across?(from: Vec2, to: Vec2): boolean;
  /** 0…1 */
  rand?: () => number;
  list?: readonly HideCandidate[];
}

/**
 * Where she hides from the player at `p`: a landmark 18–60 u away (random among them), at a standable, reachable point
 * a few u behind its trip end (away from you), or the trip end itself; else a walkable spot 20–45 u away; else null.
 */
export function pickHideSpot(p: Vec2, o: HideOpts): HideSpot | null {
  const it = hideSpotSearch(p, o);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}

/**
 * The same search as steps (W7-W2: the ≈ 50 ms hitch at the tap, W6-W-review): it yields after every nav query, so a
 * round runs it over the first frames of the count (≤ SEARCH_MS a frame) instead of all in the tap's frame.
 */
export function* hideSpotSearch(p: Vec2, o: HideOpts): Generator<void, HideSpot | null> {
  const rand = o.rand ?? Math.random;
  // (W9-G3) the spots not on your side — the straight line cut (a road, the tracks, a building) or the walk a long detour —
  // wait until no clear one is found: then the shortest detour first (a cut one is walked to only then: one nav query)
  const later: { spot: HideSpot; k: number; walked: boolean }[] = [];
  /** the walk's length over the straight line, null when the nav does not get there */
  const walk = (t: Vec2): number | null => {
    const d = Math.hypot(t.x - p.x, t.z - p.z) || 1;
    if (!o.route) return o.reach(p, t) ? 1 : null;
    const len = o.route(p, t);
    return len === null || !Number.isFinite(len) ? null : len / d;
  };
  const sideOk = (t: Vec2, k: number) => k * Math.hypot(t.x - p.x, t.z - p.z) <= Math.hypot(t.x - p.x, t.z - p.z) * SIDE_K + SIDE_ADD;
  const list = (o.list ?? hideCandidates()).filter(c => { const d = Math.hypot(c.x - p.x, c.z - p.z); return d >= HIDE_MIN && d <= HIDE_MAX; });
  // a shuffled copy, at most HIDE_POOL tried (each try may run the nav)
  const pool = list.map(c => ({ c, k: rand() })).sort((a, b) => a.k - b.k).map(e => e.c).slice(0, HIDE_POOL);
  for (const c of pool) {
    const ax = c.x - p.x, az = c.z - p.z, al = Math.hypot(ax, az) || 1;
    const tries: Vec2[] = [];
    for (const r of [3.5, 2.5]) for (const turn of [0, 0.6, -0.6, 1.2, -1.2]) {
      const a = Math.atan2(ax / al, az / al) + turn;
      tries.push({ x: c.x + Math.sin(a) * r, z: c.z + Math.cos(a) * r });
    }
    tries.push({ x: c.x, z: c.z });
    let cut: Vec2 | null = null;
    for (const t of tries) {
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < HIDE_MIN - 3 || d > HIDE_MAX + 4 || !o.stand(t.x, t.z)) continue;
      // (W9-G3) a cut straight line: another point round this landmark first
      if (o.across?.(p, t)) { cut ??= t; continue; }
      const k = walk(t);
      yield;
      cut = null;
      if (k !== null && sideOk(t, k)) return { x: t.x, z: t.z, near: { id: c.id, name: c.name } };
      if (k !== null) later.push({ spot: { x: t.x, z: t.z, near: { id: c.id, name: c.name } }, k, walked: true });
      break; // the landmark is not walked to (or only round a long detour) from here: the next one
    }
    if (cut) later.push({ spot: { x: cut.x, z: cut.z, near: { id: c.id, name: c.name } }, k: 50, walked: false });
  }
  const a0 = rand() * Math.PI * 2;
  for (const r of [32, NEAR_MIN + 4, NEAR_MAX - 3]) for (let k = 0; k < RING_N; k++) {
    const a = a0 + (k * 2 * Math.PI) / RING_N, t = { x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r };
    if (!o.stand(t.x, t.z)) continue;
    if (o.across?.(p, t)) { later.push({ spot: { x: t.x, z: t.z, near: null }, k: 60, walked: false }); continue; }
    const kk = walk(t);
    yield;
    if (kk !== null && sideOk(t, kk)) return { x: t.x, z: t.z, near: null };
    if (kk !== null) later.push({ spot: { x: t.x, z: t.z, near: null }, k: kk, walked: true });
  }
  // nothing on your side: the shortest detour (a cut one only once the nav walks there)
  later.sort((x, y) => x.k - y.k);
  let asked = 0;
  for (const e of later) {
    if (e.walked) return e.spot;
    if (++asked > LATER_ASK) break;
    const k = walk(e.spot);
    yield;
    if (k !== null) return e.spot;
  }
  return null;
}

/** the time the spot search may take in one frame (ms; a nav query is a few ms on a desktop) */
export const SEARCH_MS = 6;
/** W7-W2 · BAYBAY's fixed lines (voiced by their text, sf-w7-lead §4): the seconds go on the chip, not in a bubble */
export const HIDE_LINES = {
  start: { zh: '捉迷藏！你数到三，我去藏好～', en: 'Hide and seek! You count to three, I’ll hide!' },
  found: { zh: '被你找到啦！', en: 'You found me!' },
  giveUp: { zh: '我在这儿呢～下次再来找我！', en: 'Here I am! Find me next time!' },
  nowhere: { zh: '这里没地方藏～换个地方再玩吧！', en: 'Nowhere to hide here. Let’s try somewhere else!' },
  // W9-G3: the kerb hint (a new fixed line: C:/Users/willy/opus-qa/w9/new-lines.md)
  crosswalk: { zh: '马路这里过不去，从斑马线过去吧！', en: 'You can’t cross here. Use the zebra crossing!' },
} satisfies Record<string, Bilingual>;
/** W9-G3: the chip's word while you push against a kerb */
export const CROSS_WORD: Bilingual = { zh: '从斑马线过去', en: 'Cross at the zebra crossing' };

/** The warmer / colder word: when `d` is HINT_STEP closer or farther than `ref` (the distance at the last word). */
export function heatStep(ref: number, d: number): { ref: number; say: 'warmer' | 'colder' | null } {
  if (d <= ref - HINT_STEP) return { ref: d, say: 'warmer' };
  if (d >= ref + HINT_STEP) return { ref: d, say: 'colder' };
  return { ref, say: null };
}
const HEAT: readonly Bilingual[] = [
  { zh: '好烫！就在附近！', en: 'Hot! Really close!' },
  { zh: '暖暖的', en: 'Warm' },
  { zh: '有点凉', en: 'Cool' },
  { zh: '冷冰冰', en: 'Cold' },
];
/** How warm it is at `d` u from her (one shared object per word: the chip is repainted only when the word changes). */
export function heatWord(d: number): Bilingual {
  return d <= 8 ? HEAT[0] : d <= 20 ? HEAT[1] : d <= 40 ? HEAT[2] : HEAT[3];
}
/**
 * W9-G3 · the heat band (0 好烫 · 1 暖暖的 · 2 有点凉 · 3 冷冰冰) with a hold: it moves to the band `d` falls in only once `d` is
 * BAND_HOLD u past the edge between them (the words flipped at the edges: gamer-3).
 */
export function heatBand(prev: number, d: number): number {
  const EDGES = [8, 20, 40];
  const raw = d <= EDGES[0] ? 0 : d <= EDGES[1] ? 1 : d <= EDGES[2] ? 2 : 3;
  if (prev < 0 || prev > 3 || raw === prev) return raw;
  // warmer: past the edge below the old band by the hold; colder: past the edge above it by the hold
  if (raw < prev) return d <= EDGES[prev - 1] - BAND_HOLD ? raw : prev;
  return d > EDGES[prev] + BAND_HOLD ? raw : prev;
}
export const heatOfBand = (b: number): Bilingual => HEAT[Math.max(0, Math.min(3, b))];
export const SAY: Record<'warmer' | 'colder', Bilingual> = {
  warmer: { zh: '暖了！', en: 'Warmer!' },
  colder: { zh: '冷了…', en: 'Colder…' },
};
/** W9-G3: the word of the moment with the band after it, one shared object per pair (the chip repaints on a change only) */
const pair = (a: Bilingual, b: Bilingual): Bilingual => ({ zh: `${a.zh} ${b.zh}`, en: `${a.en} ${b.en}` });
const BANDS = [0, 1, 2, 3];
const WARMER_OF: readonly Bilingual[] = BANDS.map(b => pair({ zh: '暖了！', en: 'Warmer!' }, HEAT[b]));
const COLDER_OF: readonly Bilingual[] = BANDS.map(b => pair({ zh: '冷了…', en: 'Colder…' }, HEAT[b]));

/** The runtime's checks: STAND_RADIUS ground, and a nav path that ends within 1.1 u of the spot. */
export const liveOpts = (): HideOpts => ({
  stand: (x, z) => canStand(x, z, STAND_RADIUS),
  reach: (from, to) => { const r = findPath(from, to, 1), e = r?.points[r.points.length - 1]; return !!e && Math.hypot(e.x - to.x, e.z - to.z) < 1.1; },
  // (W9-G3) the route's length (one nav query): a spot round a road is only a fallback
  route: (from, to) => {
    const r = findPath(from, to, 1), pts = r?.points, e = pts?.[pts.length - 1];
    if (!pts || !e || Math.hypot(e.x - to.x, e.z - to.z) >= 1.1) return null;
    let len = 0, a = from;
    for (const q of pts) { len += Math.hypot(q.x - a.x, q.z - a.z); a = q; }
    return len;
  },
  across: blockedBetween,
});

/**
 * W9-G3: the straight line from `a` to `b` is cut by ground the walker may not step on (sampled every 0.8 u; CUT_RUN
 * samples in a row: a street kerb to kerb, the tracks, a building) — heading straight for her you would hit it. From the
 * Ferry Building plaza the Embarcadero cut the line to the Railway Museum spot for 14 samples (the review's 30 / 30).
 */
export function blockedBetween(a: Vec2, b: Vec2): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.8);
  let run = 0;
  for (let i = 1; i < n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
    run = canStand(x, z, STAND_RADIUS) ? 0 : run + 1;
    if (run >= CUT_RUN) return true;
  }
  return false;
}

let kerbProbe: () => boolean = () => kerbAhead();
/** tests: replace the kerb probe (null: the live one) */
export function __setKerbProbe(fn: (() => boolean) | null) { kerbProbe = fn ?? (() => kerbAhead()); }

/** W9-G3: the ground right ahead of the player (1.2 u along the heading) is a road the walker may not step on. */
export function kerbAhead(): boolean {
  const p = runtime.player, x = p.x + Math.sin(p.heading) * 1.2, z = p.z + Math.cos(p.heading) * 1.2;
  return !canStand(x, z, STAND_RADIUS) && surfaceAt(x, z) === 'road';
}

/** A hide & seek game may start now: free roam on foot, nothing else running, BAYBAY not leading a trip. */
export function hideSeekAllowed(): boolean {
  const f = flow.get();
  return freeOnFoot() && !currentActivity() && game.get().mode === 'free' && !f.trip && !f.freeLead;
}

let stopLive: (() => void) | null = null;

/** Start a round (问 BAYBAY → 捉迷藏). False (and a word from her) when it cannot start here. */
export function startHideSeek(opts: HideOpts = liveOpts()): boolean {
  if (!hideSeekAllowed()) { bubble({ zh: '等一下再玩捉迷藏吧～', en: 'Let’s play hide and seek in a bit!' }, 2400); return false; }
  const p = runtime.player;
  // W7-W2: the spot is searched over the count's first frames (≤ SEARCH_MS a frame), not all in the tap's frame (the
  // live nav took ≈ 50 ms on a desktop, a few times that on a phone: W6-W-review)
  const search = hideSpotSearch({ x: p.x, z: p.z }, opts);
  let spot: HideSpot | null = null;
  const advance = (budget: number): 'found' | 'none' | 'more' => {
    const t0 = performance.now();
    for (;;) {
      const r = search.next();
      if (r.done) { spot = r.value; return spot ? 'found' : 'none'; }
      if (performance.now() - t0 >= budget) return 'more';
    }
  };
  if (advance(SEARCH_MS) === 'none') { bubble(HIDE_LINES.nowhere, 2800); return false; }
  let phase: 'count' | 'seek' | 'found' | 'reveal' | 'done' = 'count';
  let t = 0, ref = 0, lastHop = 0, said: Bilingual | null = null, saidAt = -9, foundSecs = 0, foundAt = 0;
  // (W9-G3) the smoothed distance and its heat band; the kerb push (s), the crossing word's time, the line said this round
  let dS = -1, band = -1, curbT = 0, crossAt = -99, crossSaid = false, revealT = 0;
  // what the chip shows now (review: repaint only when the second or the word changes, not every frame)
  let shownSec = -1, shownStatus: Bilingual | null = null;
  const whereOf = (s: HideSpot): Bilingual => (s.near
    ? { zh: `她藏在${s.near.name.zh}附近`, en: `She’s hiding near ${s.near.name.en}` }
    : { zh: '她就藏在附近', en: 'She’s hiding nearby' });
  const unpin = () => { setPuppet('baybay', null); runtime.guide.target = null; };
  let offFrame: () => void = () => {};
  const run: ActivityRun | null = startActivity({ id: HIDE_ID, name: HIDE_NAME, better: 'lower' }, {
    onStop: () => { phase = 'done'; offFrame(); unpin(); hideChip(HIDE_ID); stopLive = null; },
  });
  if (!run) return false;
  stopLive = () => run.cancel();
  /** (W9-G3) the camera turns to where she is (the hunt kept it still: its assists then may run at once) */
  const lookAtHer = (sp: HideSpot | null) => {
    if (!sp) return;
    input.lastCameraInputAt = Math.min(input.lastCameraInputAt, performance.now() - 2600);
    faceCameraToward(sp.x, sp.z, { seconds: 0.8 });
  };
  const giveUp = () => {
    if (!run.active) return;
    const sp = spot as HideSpot | null;
    run.cancel();
    // (W9-G3) she pops up where she was: the camera turns there as she says so
    lookAtHer(sp);
    bubble(HIDE_LINES.giveUp, 3000);
  };
  showChip({
    id: HIDE_ID, icon: 'play', title: HIDE_NAME, big: String(COUNT_S),
    line: { zh: '闭上眼睛数三下，我去藏好！', en: 'Close your eyes and count to three!' },
    action: { label: { zh: '放弃', en: 'Give up' }, run: giveUp },
  });
  ensurePlaySounds2();
  bubble(HIDE_LINES.start, 2600);
  charApi()?.emote('baybay', 'cheer', { seconds: 1.2 });
  playSound('play-go');

  offFrame = registerFrameSystem('w-hide-seek', dt => {
    if (!run.active) return;
    const s = game.get(), f = flow.get();
    if (s.phase !== 'playing') { run.cancel(); return; }
    // review: BAYBAY asked to lead (问 BAYBAY → the next goal, a trip, the tour) ends the round — she cannot lead you
    // while she is pinned in hiding (live: the player was walked off by nobody while the chip kept saying 冷了…)
    if (s.mode !== 'free' || f.trip || f.freeLead) { run.cancel(); return; }
    t += dt;
    const pl = runtime.player;
    if (!spot) {
      const r = advance(SEARCH_MS);
      if (r === 'none') { run.cancel(); bubble(HIDE_LINES.nowhere, 2800); return; }
      if (r === 'more') { if (t > COUNT_S) t = COUNT_S; return; }
    }
    const sp: HideSpot = spot!, d = Math.hypot(sp.x - pl.x, sp.z - pl.z);
    if (phase === 'count') {
      const n = Math.max(1, Math.ceil(COUNT_S - t));
      if (n !== shownSec) { shownSec = n; patchChip(HIDE_ID, { big: String(n) }); }
      if (t >= 0.8) pinBaybay({ x: sp.x, y: heightAt(sp.x, sp.z), z: sp.z, heading: Math.atan2(pl.x - sp.x, pl.z - sp.z) + Math.PI });
      if (t < COUNT_S) return;
      phase = 'seek';
      t = 0;
      ref = d;
      playSound('play-whoosh');
      shownSec = 0; shownStatus = heatWord(d);
      const where = whereOf(sp);
      patchChip(HIDE_ID, { line: { zh: `找 BAYBAY！${where.zh}`, en: `Find BAYBAY! ${where.en}` }, big: '0', status: shownStatus });
      return;
    }
    if (phase === 'found') {
      // W7-W2: the chip holds the seconds for FOUND_HOLD s while she says the fixed line, then the card
      if ((foundAt += dt) < FOUND_HOLD) return;
      phase = 'done';
      const secs = foundSecs, tier = tierFor(secs, HIDE_TIERS, 'lower');
      run.end({
        tier: tier === 0 ? 1 : tier, score: secs,
        detail: { zh: `${secs} 秒找到 BAYBAY`, en: `Found BAYBAY in ${secs} s` },
        bestText: best => ({ zh: `最快 ${best} 秒`, en: `Best ${best} s` }),
        again: () => { startHideSeek(opts); },
      });
      return;
    }
    if (phase === 'reveal') {
      // (W9-G3) time up: she waves where she hid while the camera turns there, then the card says where she was
      if ((revealT += dt) < REVEAL_S) return;
      phase = 'done';
      run.end({
        tier: 0,
        detail: sp.near ? { zh: `她刚才藏在${sp.near.name.zh}附近`, en: `She was hiding near ${sp.near.name.en}` } : { zh: '她刚才就藏在附近', en: 'She was hiding nearby' },
        again: () => { startHideSeek(opts); },
      });
      return;
    }
    if (phase !== 'seek') return;
    pinBaybay({ x: sp.x, y: heightAt(sp.x, sp.z), z: sp.z, heading: runtime.guide.heading });
    // (W9-G3) no automatic camera turn while you seek: the follow camera's assists wait as if you were steering it
    input.lastCameraInputAt = Math.max(input.lastCameraInputAt, performance.now() - 1000);
    if (d <= FOUND_R) {
      phase = 'found';
      foundSecs = Math.round(t);
      foundAt = 0;
      unpin();
      charApi()?.emote('baybay', 'cheer', { seconds: 1.6 });
      // W7-W2: a fixed line (voiceable, sf-w7-lead §4); the seconds are on the chip and the card
      patchChip(HIDE_ID, { big: String(foundSecs), status: { zh: `${foundSecs} 秒找到！`, en: `Found in ${foundSecs} s!` }, action: undefined });
      bubble(HIDE_LINES.found, 3200);
      return;
    }
    if (t >= GIVE_UP_S) {
      // (W9-G3) time up: the reveal (no 放弃 any more), then the card
      phase = 'reveal';
      revealT = 0;
      lookAtHer(sp);
      charApi()?.emote('baybay', 'wave', { seconds: REVEAL_S });
      patchChip(HIDE_ID, { status: { zh: '时间到！她在这儿', en: 'Time’s up! Here she is' }, action: undefined });
      bubble(HIDE_LINES.giveUp, 3000);
      return;
    }
    const h = heatStep(ref, d);
    ref = h.ref;
    if (h.say) { said = SAY[h.say]; saidAt = t; if (h.say === 'warmer') playSound('play-tick'); }
    if (said && t - saidAt > 2.5) said = null;
    // (W9-G3) the band from the smoothed distance, held past its edges; the word of the moment goes before it
    dS = dS < 0 ? d : dS + (d - dS) * Math.min(1, dt * 2.5);
    band = heatBand(band, dS);
    // (W9-G3) pushing into a kerb (the stick held, the feet not moving, a road ahead): 从斑马线过去, her line once a round
    const pushing = Math.hypot(runtime.input.moveX, runtime.input.moveY) > 0.5 && pl.speed < 0.4 && !pl.pathTarget;
    curbT = pushing && kerbProbe() ? curbT + dt : 0;
    if (curbT >= CURB_S) {
      curbT = 0;
      crossAt = t;
      if (!crossSaid) { crossSaid = true; bubble(HIDE_LINES.crosswalk, 3400); }
    }
    const base = heatOfBand(band);
    const word = t - crossAt < 3 ? CROSS_WORD : said ? (said === SAY.warmer ? WARMER_OF[band] : COLDER_OF[band]) : base;
    const sec = Math.floor(t), status = word;
    if (sec !== shownSec || status !== shownStatus) {
      shownSec = sec; shownStatus = status;
      patchChip(HIDE_ID, { big: String(sec), status });
    }
    // every HOP_EVERY s she hops where she hides (a hint for sharp eyes), and squeaks when you are near
    if (t - lastHop >= HOP_EVERY) {
      lastHop = t;
      charApi()?.emote('baybay', 'wave', { seconds: 1.2 });
      if (d < 20) playSound('play-squeak');
    }
  });
  return true;
}

/** QA / teardown: end a running round at no cost. */
export function stopHideSeek() { stopLive?.(); }

// ---------------------------------------------------------------------------
// W6-W5: the one coach line that tells a new player 捉迷藏 is there (once per device)
// ---------------------------------------------------------------------------

export const HIDE_COACH_KEY = 'opus-bay:play:hide-coach:v1';
/** seconds of quiet free roam (standing still, nothing said, nothing open) before the line */
export const HIDE_COACH_AFTER = 40;

export interface CoachStore { get(k: string): string | null; set(k: string, v: string): void }
const LOCAL: CoachStore = {
  get: k => { try { return localStorage.getItem(k); } catch { return '1'; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked: once per visit */ } },
};

/**
 * Once per device, after HIDE_COACH_AFTER s of quiet free roam where a round may start, BAYBAY says the game is there
 * and how to start it (phones: 点「问 BAYBAY」→ 捉迷藏; keyboards: Q → 捉迷藏). Returns the off.
 * W7-W2: it no longer waits for lane A's emote coach (play/index.ts): a player who kept moving heard neither line
 * (sf-w6-W.md Known gaps); storage is read once, at the start.
 */
export function startHideCoach(store: CoachStore = LOCAL): () => void {
  if (store.get(HIDE_COACH_KEY) === '1') return () => {};
  let quiet = 0;
  const off = registerFrameSystem('w-hide-coach', dt => {
    const s = game.get(), f = flow.get(), p = runtime.player;
    const ok = hideSeekAllowed() && !s.panel.kind && !f.bubble && !p.moving;
    quiet = ok ? quiet + dt : Math.max(0, quiet - dt);
    if (quiet < HIDE_COACH_AFTER) return;
    off();
    store.set(HIDE_COACH_KEY, '1');
    bubble(runtime.input.device === 'touch'
      ? { zh: '想玩捉迷藏吗？点「问 BAYBAY」，再点「捉迷藏」！', en: 'Fancy hide and seek? Tap Ask, then Hide & seek!' }
      : { zh: '想玩捉迷藏吗？按 Q 问我，再选「捉迷藏」！', en: 'Fancy hide and seek? Press Q to ask me, then Hide & seek!' }, 5200);
  });
  return off;
}
