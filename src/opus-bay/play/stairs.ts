import { useFrame } from '@react-three/fiber';
import { charApi } from '../actors/charApi';
import { gradeFactor, RUN_SPEED } from '../actors/controller';
import { playSound } from '../audio/hooks';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { canStand, heightAt, surfaceAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { bubble, walkTo } from '../game/flow';
import { flow } from '../game/flowStore';
import { holdLock } from '../game/playerLock';
import { registerFrameSystem, registerSceneSystem } from '../game/systemsRegistry';
import { hideChip, patchChip, showChip } from './chip';
import { bestOf, startActivity, type ActivityRun, type Tier } from './kit';
import { courseHeading, stairCourse, STAIR_COURSES, type StairCourse, type StairCourseId } from './stairCourses';
import { sayWhenQuiet, stepsLine, stepsToday } from './zones';

/**
 * Wave 5 · lane A · stair races with BAYBAY (W5-A8, plan §3.2 A-stairs): at the foot of a course (stairCourses.ts) she
 * asks 比赛？ (zones.ts: the prompt and her one invite); 3 · 2 · 1 · 跑！ and you both run for the top — you on your own
 * feet (stick, WASD or tap-to-walk; running all the way: the race holds the run for you), BAYBAY along the course at a
 * pace set from the course itself: `par` is a full run's time along the course line at the player's run speed and the
 * stairs' and slopes' own speed factors (actors/controller gradeFactor), and she takes par × BAYBAY_PACE + BAYBAY_START.
 * The card: ● 好 (at the top), ◆ 很好 (before BAYBAY), ★ 太棒了 (before her and within par × GOLD_PACE + GOLD_START);
 * the best time per course is kept; the step counter (zones.ts) counts the climb and BAYBAY says today's steps after.
 *
 * Nothing locks the player but the countdown (holdLock('activity') for ≈ 2.5 s). The race ends at no cost with 放弃,
 * getting on a bike / taking off, or wandering STRAY_R from the course; after RACE_MAX_S it just stops. A dialogue, photo
 * mode or a cinematic (lane C's pelican moment at a first viewpoint) holds the clock and BAYBAY until it is over.
 *
 * BAYBAY is run through her own walker (actors/guide): a scene system mounted for the race (its useFrame runs after the
 * brain's 10 Hz update) gives her the course point `LEAD` u ahead of where her schedule is, as her target, running; her
 * legs and her path are the walker's own. If her walker hops her back to your side (out of sight, far away), she is put
 * back on her schedule.
 */

export const STAIRS_NAME: Bilingual = { zh: '台阶赛跑', en: 'Stair race' };
/** BAYBAY's time = par × BAYBAY_PACE + BAYBAY_START; gold = par × GOLD_PACE + GOLD_START (seconds). */
export const BAYBAY_PACE = 1.12, BAYBAY_START = 0.8, GOLD_PACE = 1.06, GOLD_START = 0.7;
export const FINISH_R = 2.4;
export const STRAY_R = 26;
export const RACE_MAX_S = 60;
export const READY_S = 0.8, COUNT_S = 0.55;
/** how far ahead of her schedule BAYBAY's target runs (her walker settles ≈ 1.5 u behind a target it chases) */
export const LEAD = 1.6;

// --- the course line ------------------------------------------------------------------------------------------------------

export interface CourseLine { pts: { x: number; z: number }[]; cum: number[]; len: number }

export function courseLine(c: StairCourse): CourseLine {
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i + 1 < c.line.length; i += 2) pts.push({ x: c.line[i], z: c.line[i + 1] });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return { pts, cum, len: cum[cum.length - 1] };
}

/** The point at arc length s. */
export function linePoint(l: CourseLine, s: number): { x: number; z: number } {
  let i = 1;
  while (i < l.pts.length - 1 && s > l.cum[i]) i++;
  const a = l.pts[i - 1], b = l.pts[i], k = Math.max(0, Math.min(1, (s - l.cum[i - 1]) / (l.cum[i] - l.cum[i - 1] || 1)));
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
}

/** Arc length of the nearest point of the line to (x, z), and the distance to it. */
export function lineProgress(l: CourseLine, x: number, z: number): { s: number; off: number } {
  let best = { s: 0, off: Infinity };
  for (let i = 1; i < l.pts.length; i++) {
    const a = l.pts[i - 1], b = l.pts[i], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
    const off = Math.hypot(x - (a.x + dx * k), z - (a.z + dz * k));
    if (off < best.off) best = { s: l.cum[i - 1] + (l.cum[i] - l.cum[i - 1]) * k, off };
  }
  return best;
}

/**
 * Seconds to run the line at the player's run speed with the ground's own factors (stairs 0.8 up, slopes slower), in
 * 0.25 u steps: `at[k]` = the time at arc k·0.25 (BAYBAY's schedule), `par` = the time to the finish circle (FINISH_R
 * short of the line's end, where a runner is "at the top").
 */
export function idealRun(l: CourseLine, groundAt = heightAt, surface = surfaceAt): { par: number; at: number[] } {
  const STEP = 0.25, at = [0];
  let t = 0;
  const n = Math.ceil(l.len / STEP);
  let prev = linePoint(l, 0), h0 = groundAt(prev.x, prev.z);
  for (let k = 1; k <= n; k++) {
    const s = Math.min(l.len, k * STEP), p = linePoint(l, s), h1 = groundAt(p.x, p.z), dl = Math.hypot(p.x - prev.x, p.z - prev.z) || 1e-6;
    t += dl / (RUN_SPEED * gradeFactor((h1 - h0) / dl, surface(p.x, p.z) ?? null));
    at.push(t);
    prev = p; h0 = h1;
  }
  const edge = Math.max(0, l.len - FINISH_R) / STEP, i = Math.floor(edge);
  const par = i + 1 < at.length ? at[i] + (at[i + 1] - at[i]) * (edge - i) : t;
  return { par, at };
}

/** BAYBAY's finish time on a course (s after 跑！). */
export const baybayTime = (par: number) => par * BAYBAY_PACE + BAYBAY_START;

/** BAYBAY's arc length on her schedule `t` s after 跑！ (she starts BAYBAY_START late and runs at 1 / BAYBAY_PACE of a full run). */
export function scheduleAt(ideal: { par: number; at: number[] }, len: number, t: number): number {
  const k = (t - BAYBAY_START) / BAYBAY_PACE;
  if (k <= 0) return 0;
  if (k >= ideal.at[ideal.at.length - 1]) return len;
  let lo = 0, hi = ideal.at.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ideal.at[mid] <= k) lo = mid; else hi = mid; }
  const f = (k - ideal.at[lo]) / (ideal.at[hi] - ideal.at[lo] || 1);
  return Math.min(len, (lo + f) * 0.25);
}

/** The medal: at the top 1, before BAYBAY 2, before her and within the gold time 3. */
export function raceTier(time: number, baybay: number, par: number): 0 | Tier {
  if (!Number.isFinite(time)) return 0;
  if (time >= baybay) return 1;
  return time <= par * GOLD_PACE + GOLD_START ? 3 : 2;
}

// --- the race -------------------------------------------------------------------------------------------------------------

type Phase = 'ready' | 'run' | 'done';
interface Race {
  course: StairCourse;
  line: CourseLine;
  ideal: { par: number; at: number[] };
  top: { x: number; y: number; z: number };
  phase: Phase;
  t: number;
  clock: number;
  beat: number;
  run: ActivityRun;
  release: (() => void) | null;
  player: { s: number; finish: number | null };
  baybay: { s: number; finish: number | null; last: { x: number; z: number } };
  rabbit: { x: number; z: number } | null;
  rabbitS: number;
  chipAt: number;
  cheered: boolean;
}

let race: Race | null = null;
const raced = new Set<StairCourseId>();
let offFrame: (() => void) | null = null;
let offLayer: (() => void) | null = null;

export const raceState = (): Readonly<Race> | null => race;
export const racing = () => race !== null;

export const STAIRS_LINES = {
  ready: { zh: '预备——看谁先到顶！', en: 'Ready — first to the top!' },
  win: { zh: '你赢啦！跑得真快！', en: 'You win! So fast!' },
  lose: { zh: '我先到啦！再来一次？', en: 'Me first! Again?' },
  waiting: { zh: '我到顶啦！快上来～', en: 'I\'m at the top! Come on up!' },
} satisfies Record<string, Bilingual>;

/** Can a race start now (on foot, nothing modal, no other activity)? */
export function canRace(): boolean {
  const s = game.get();
  return !race && s.phase === 'playing' && !s.dialogue.nodeId && !s.photoMode && s.riding === null && runtime.move.mode === 'foot' && !flow.get().cinematic;
}

const RUN_KEY = 'ShiftLeft';

/** 比赛？: start the race on a course from its foot. Returns whether it started. */
export function startStairRace(id: StairCourseId): boolean {
  const course = stairCourse(id);
  if (!course || !canRace()) return false;
  const line = courseLine(course);
  const run = startActivity({ id: `stairs-${course.id}`, name: { zh: `${STAIRS_NAME.zh} · ${course.name.zh}`, en: `${STAIRS_NAME.en} · ${course.name.en}` }, better: 'lower' }, { onStop: how => { if (how === 'cancel') cleanup(); } });
  if (!run) return false;
  const top = line.pts[line.pts.length - 1];
  race = {
    course, line, ideal: idealRun(line), top: { ...top, y: heightAt(top.x, top.z) }, phase: 'ready', t: 0, clock: 0, beat: -1, run,
    release: holdLock('activity', `stairs-${course.id}`), player: { s: 0, finish: null }, baybay: { s: 0, finish: null, last: { x: 0, z: 0 } },
    rabbit: null, rabbitS: -1, chipAt: 0, cheered: false,
  };
  // on your marks: face up the course, BAYBAY at your side
  const h = courseHeading(course), p = runtime.player, g = runtime.guide;
  p.heading = h; p.pathTarget = null;
  const rx = Math.cos(h), rz = -Math.sin(h);
  for (const side of [1, -1, 1.8, -1.8]) {
    const x = p.x + rx * 1.2 * side, z = p.z + rz * 1.2 * side;
    if (canStand(x, z, 0.3)) { g.x = x; g.z = z; g.y = heightAt(x, z); break; }
  }
  g.heading = h; g.target = null;
  race.baybay.last = { x: g.x, z: g.z };
  charApi()?.emote('baybay', 'point');
  showChip({ id: 'stairs', title: course.name, icon: 'stairs', line: STAIRS_LINES.ready, action: { label: { zh: '放弃', en: 'Give up' }, run: cancelStairRace } });
  bubble(STAIRS_LINES.ready, 2400);
  flow.set({ quietUntil: performance.now() + 20000 });
  offFrame = registerFrameSystem('a-play-stairs', step);
  offLayer = registerSceneSystem('a-play-stairs', GuideDriver);
  return true;
}

function step(dt: number) {
  const r = race;
  if (!r) return;
  r.t += dt;
  const s = game.get(), p = runtime.player;
  if (s.phase !== 'playing' || s.riding !== null || runtime.move.mode !== 'foot') { r.run.cancel(); return; }
  // a dialogue / photo mode / a cinematic mid-race (lane C's pelican moment at a first viewpoint): the clock waits, and
  // BAYBAY on it; before 跑！ it just ends
  if (s.dialogue.nodeId || s.photoMode || flow.get().cinematic) { if (r.phase === 'ready') r.run.cancel(); return; }

  if (r.phase === 'ready') {
    const beat = r.t < READY_S ? -1 : Math.floor((r.t - READY_S) / COUNT_S);
    if (beat >= 0 && beat < 3 && beat !== r.beat) { r.beat = beat; patchChip('stairs', { big: String(3 - beat), line: undefined }); playSound('play-tick'); }
    if (beat >= 3) {
      r.phase = 'run'; r.t = 0;
      r.release?.(); r.release = null;
      patchChip('stairs', { big: '0.0', status: undefined });
      playSound('play-go');
      bubble({ zh: '跑！', en: 'Go!' }, 900);
    }
    return;
  }

  if (r.phase === 'run') {
    r.clock += dt;
    // the race runs for you (a real Shift / a full stick does the same)
    input.keys.add(RUN_KEY);
    const pp = lineProgress(r.line, p.x, p.z);
    r.player.s = Math.max(r.player.s, pp.s);
    const g = runtime.guide, gp = lineProgress(r.line, g.x, g.z);
    r.baybay.s = Math.max(r.baybay.s, gp.s);
    const atTop = (x: number, y: number, z: number, reach = FINISH_R) => Math.hypot(x - r.top.x, z - r.top.z) <= reach && Math.abs(y - r.top.y) < 2.2;
    // BAYBAY is up on her schedule's time (her walker runs a step behind the schedule's point: she is at the circle then)
    if (r.baybay.finish === null && r.clock >= baybayTime(r.ideal.par) && atTop(g.x, g.y, g.z, FINISH_R + 3)) {
      r.baybay.finish = r.clock;
      if (r.player.finish === null) { charApi()?.emote('baybay', 'cheer'); bubble(STAIRS_LINES.waiting, 2400); }
    }
    if (r.player.finish === null && atTop(p.x, p.y, p.z)) { r.player.finish = r.clock; finish(r); return; }
    if (pp.off > STRAY_R || r.clock > RACE_MAX_S) { r.run.cancel(); return; }
    if (r.clock - r.chipAt >= 0.1) {
      r.chipAt = r.clock;
      const ahead = r.player.s >= r.baybay.s || r.baybay.finish === null && r.player.s > r.baybay.s - 0.5;
      patchChip('stairs', { big: r.clock.toFixed(1), status: r.baybay.finish !== null ? { zh: 'BAYBAY 到顶了', en: 'BAYBAY is up' } : ahead ? { zh: '你领先！', en: 'You lead!' } : { zh: 'BAYBAY 在前面', en: 'BAYBAY leads' } });
    }
  }
}

/** Her target this frame (after the brain): the course point LEAD u past her schedule; back on it if her walker hopped. */
function driveGuide() {
  const r = race;
  if (!r || r.phase === 'done') return;
  const g = runtime.guide;
  g.state = 'idle';
  if (r.phase === 'ready') { g.target = null; g.run = false; return; }
  // her walker hopped her back to your side (out of sight, far): put her back on her schedule
  if (Math.hypot(g.x - r.baybay.last.x, g.z - r.baybay.last.z) > 4 && r.baybay.finish === null) {
    const at = linePoint(r.line, scheduleAt(r.ideal, r.line.len, r.clock));
    if (canStand(at.x, at.z, 0.3)) { g.x = at.x; g.z = at.z; g.y = heightAt(at.x, at.z); }
  }
  r.baybay.last = { x: g.x, z: g.z };
  const s = Math.min(r.line.len, scheduleAt(r.ideal, r.line.len, r.clock) + LEAD);
  if (!r.rabbit || s - r.rabbitS >= 0.5 || (s >= r.line.len && r.rabbitS < r.line.len)) { r.rabbit = linePoint(r.line, s); r.rabbitS = s; }
  g.target = r.rabbit;
  g.run = s > 0.01;
}

function GuideDriver() {
  useFrame(driveGuide);
  return null;
}

function finish(r: Race) {
  const n = (x: number) => x.toFixed(1);
  const pt = r.player.finish ?? Infinity;
  // BAYBAY's time: hers if she is up, else her schedule's (she is a moment behind you)
  const bt = r.baybay.finish ?? Math.max(pt + 0.1, baybayTime(r.ideal.par));
  const tier = raceTier(pt, bt, r.ideal.par);
  const won = pt < bt;
  const first = !raced.has(r.course.id);
  raced.add(r.course.id);
  r.phase = 'done';
  const id = r.course.id;
  r.run.end({
    tier,
    score: +pt.toFixed(2),
    detail: { zh: `你 ${n(pt)} 秒 · BAYBAY ${n(bt)} 秒`, en: `You ${n(pt)} s · BAYBAY ${n(bt)} s` },
    bestText: b => ({ zh: `上次你最快 ${n(b)} 秒！`, en: `Your best: ${n(b)} s!` }),
    again: () => againStairs(id),
  });
  cleanup();
  const api = charApi();
  api?.emote('player', won ? 'cheer' : 'wave');
  api?.emote('baybay', won ? 'clap' : 'cheer');
  bubble(won ? STAIRS_LINES.win : STAIRS_LINES.lose, 2600);
  // the flight's fact the first time, then today's steps (when nothing else talks: at Coit, lane C's pelican moment)
  if (first) sayWhenQuiet(r.course.fact, 2800);
  sayWhenQuiet(stepsLine(stepsToday()), first ? 6600 : 2800, 3000);
}

function cleanup() {
  const r = race;
  race = null;
  offFrame?.(); offFrame = null;
  input.keys.delete(RUN_KEY);
  hideChip('stairs');
  if (r) { r.release?.(); r.release = null; }
  const g = runtime.guide;
  if (r && r.phase !== 'done') g.target = null;
  const off = offLayer;
  offLayer = null;
  off?.();
}

/** 再来一次: walk back down to the foot; the race starts again on arrival (the prompt there). */
export function againStairs(id: StairCourseId) {
  const c = stairCourse(id);
  if (!c) return;
  walkTo({ x: c.line[0], z: c.line[1] }, `play:stairs:${id}`);
}

/** 放弃 / tests: stop at no cost. */
export function cancelStairRace() { race?.run.cancel(); }

/** The best on a course (s), if any. */
export const stairBest = (id: StairCourseId) => bestOf(`stairs-${id}`);
export const STAIR_IDS = STAIR_COURSES.map(c => c.id);

/** tests */
export function __resetStairs() { if (race) race.run.cancel(); race = null; raced.clear(); }
