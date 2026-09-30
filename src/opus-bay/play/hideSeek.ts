import { findPath } from '../actors/nav';
import { charApi } from '../actors/charApi';
import { playSound } from '../audio/hooks';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { canStand, heightAt, STAND_RADIUS } from '../core/terrain';
import type { Bilingual, Vec2 } from '../core/types';
import { ATTRACTIONS } from '../data/sf/attractions';
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

export interface HideSpot {
  x: number;
  z: number;
  /** the landmark she hides near (its attraction id and short name), null = just nearby */
  near: { id: string; name: Bilingual } | null;
}

export interface HideCandidate { id: string; name: Bilingual; x: number; z: number }

/** Every attraction's trip end (its arrival, else its anchor): where she may hide near. */
export function hideCandidates(): HideCandidate[] {
  return ATTRACTIONS.map(a => ({ id: a.id, name: a.short ?? a.name, x: a.arrival?.x ?? a.x, z: a.arrival?.z ?? a.z }));
}

export interface HideOpts {
  /** a walker stands there */
  stand(x: number, z: number): boolean;
  /** the nav grid walks there from the player */
  reach(from: Vec2, to: Vec2): boolean;
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
  const list = (o.list ?? hideCandidates()).filter(c => { const d = Math.hypot(c.x - p.x, c.z - p.z); return d >= HIDE_MIN && d <= HIDE_MAX; });
  // a shuffled copy, at most 6 tried (each try may run the nav)
  const pool = list.map(c => ({ c, k: rand() })).sort((a, b) => a.k - b.k).map(e => e.c).slice(0, 6);
  for (const c of pool) {
    const ax = c.x - p.x, az = c.z - p.z, al = Math.hypot(ax, az) || 1;
    const tries: Vec2[] = [];
    for (const r of [3.5, 2.5]) for (const turn of [0, 0.6, -0.6, 1.2, -1.2]) {
      const a = Math.atan2(ax / al, az / al) + turn;
      tries.push({ x: c.x + Math.sin(a) * r, z: c.z + Math.cos(a) * r });
    }
    tries.push({ x: c.x, z: c.z });
    for (const t of tries) {
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < HIDE_MIN - 3 || d > HIDE_MAX + 4 || !o.stand(t.x, t.z)) continue;
      const ok = o.reach(p, t);
      yield;
      if (ok) return { x: t.x, z: t.z, near: { id: c.id, name: c.name } };
      break; // the landmark is not walked to from here: the next one
    }
  }
  const a0 = rand() * Math.PI * 2;
  for (const r of [32, NEAR_MIN + 4, NEAR_MAX - 3]) for (let k = 0; k < 8; k++) {
    const a = a0 + (k * Math.PI) / 4, t = { x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r };
    if (!o.stand(t.x, t.z)) continue;
    const ok = o.reach(p, t);
    yield;
    if (ok) return { x: t.x, z: t.z, near: null };
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
} satisfies Record<string, Bilingual>;

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
export const SAY: Record<'warmer' | 'colder', Bilingual> = {
  warmer: { zh: '暖了！', en: 'Warmer!' },
  colder: { zh: '冷了…', en: 'Colder…' },
};

/** The runtime's checks: STAND_RADIUS ground, and a nav path that ends within 1.1 u of the spot. */
export const liveOpts = (): HideOpts => ({
  stand: (x, z) => canStand(x, z, STAND_RADIUS),
  reach: (from, to) => { const r = findPath(from, to, 1), e = r?.points[r.points.length - 1]; return !!e && Math.hypot(e.x - to.x, e.z - to.z) < 1.1; },
});

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
  let phase: 'count' | 'seek' | 'found' | 'done' = 'count';
  let t = 0, ref = 0, lastHop = 0, said: Bilingual | null = null, saidAt = -9, foundSecs = 0, foundAt = 0;
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
  const giveUp = () => {
    if (!run.active) return;
    run.cancel();
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
    if (phase !== 'seek') return;
    pinBaybay({ x: sp.x, y: heightAt(sp.x, sp.z), z: sp.z, heading: runtime.guide.heading });
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
    if (t >= GIVE_UP_S) { giveUp(); return; }
    const h = heatStep(ref, d);
    ref = h.ref;
    if (h.say) { said = SAY[h.say]; saidAt = t; if (h.say === 'warmer') playSound('play-tick'); }
    if (said && t - saidAt > 2.5) said = null;
    const sec = Math.floor(t), status = said ?? heatWord(d);
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
