import { charApi } from '../actors/charApi';
import { onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import type { Bilingual } from '../core/types';
import { bubble } from '../game/flow';
import { registerFrameSystem } from '../game/systemsRegistry';
import { hideChip, patchChip, showChip } from './chip';
import { bestOf, saveNumber, startActivity, type ActivityRun, type Tier } from './kit';
import { CROOKED, crookedBottom, offLine, progressOn, type CrookedCourse } from './crookedCourses';
import { sayWhenQuiet } from './zones';

/**
 * Wave 5 · lane A · the gentle descent of a crooked block (W5-A9, plan §3.2 A-toys: "the Lombard descent + which is
 * crookeder? vs Vermont St"): ride the toy car or the bike into the top of Lombard Street's crooked block (Hyde St) or
 * Vermont Street's (20th St) and the descent begins by itself: the chip shows your speed against the 5 mph sign (a toy
 * scale: SLOW u/s, the gauge's band) and the bumps (lane F's `vehicle:bump`). At the bottom, the card: ● down, ◆ at most
 * one bump and hardly over the sign, ★ no bump and never over it. Lombard first: BAYBAY then says Vermont was measured
 * more crooked; both done, her verdict. Leaving the lane, getting off or turning back ends it at no cost. On foot, a walk
 * from the top to the bottom brings BAYBAY's facts only (walkedDown). (2026-09-28: in the node physics neither the toy
 * car nor the bike gets past the first hairpins of either lane — Requests: L / F; the descent starts only once one can.)
 */

/** "5 mph" in the toy city (u/s): the gauge's band; a grace at the start while you brake in. */
export const SLOW = 3.6;
export const GAUGE_MAX = 9;
export const GRACE_S = 1.2;
/** Over the sign this long (s) still counts as ◆. */
export const OVER_OK = 1.5;
export const OFF_LANE = 4.5;
export const CROOKED_LINES = {
  lombard: { zh: '九曲花街限速每小时 5 英里——慢慢开，别碰到花坛！', en: 'Lombard’s sign says 5 mph — nice and slow, mind the flower beds!' },
  vermont: { zh: '佛蒙特街只有 7 个弯，可坡更陡——慢一点！', en: 'Vermont has seven bends but a steeper hill — slowly!' },
  lombardFact: { zh: '九曲花街这一段有 8 个急弯，而且只能往下开哦！', en: 'Eight hairpins on this block — and it’s one way, downhill!' },
  tease: { zh: '有人量过，佛蒙特街其实更弯：弯曲度 1.56 比 1.2！', en: 'Someone measured it: Vermont Street is curvier — 1.56 to 1.2!' },
  vermontFact: { zh: '佛蒙特街只有 7 个弯，却被量出比九曲花街还弯！', en: 'Only seven bends, yet measured curvier than Lombard!' },
  verdict: { zh: '两条都开过啦！论弯，佛蒙特街赢；论花，九曲花街赢～', en: 'Both done! Vermont wins on bends, Lombard on flowers!' },
  bump: { zh: '哎哟，碰到啦～', en: 'Oops — a bump!' },
} satisfies Record<string, Bilingual>;

/** The medal from the ride: bumps and seconds over the sign. */
export function crookedTier(bumps: number, over: number): Tier {
  if (bumps === 0 && over <= 0) return 3;
  return bumps <= 1 && over <= OVER_OK ? 2 : 1;
}

interface Descent { course: CrookedCourse; run: ActivityRun; t: number; bumps: number; over: number; top: number; last: { x: number; z: number } | null; speed: number; offBump: () => void }
let d: Descent | null = null;
let offFrame: (() => void) | null = null;

export const descentState = (): Readonly<Descent> | null => d;

/** Start the descent of `id` (zones3.ts: a rider entered its top going down). */
export function startDescent(id: CrookedCourse['id']): boolean {
  const course = CROOKED.find(c => c.id === id);
  if (!course || d || !runtime.vehicle.occupied) return false;
  const run = startActivity({ id: `crooked-${id}`, name: { zh: `慢慢开下${course.name.zh}`, en: `Gently down ${course.name.en}` } }, { onStop: () => cleanup() });
  if (!run) return false;
  const offBump = onEvent(e => {
    if (e.type !== 'vehicle:bump' || !d || d.t < 0.3) return;
    d.bumps++;
    patchChip(run.spec.id, { status: { zh: `碰撞 ${d.bumps}`, en: `Bumps ${d.bumps}` } });
    if (d.bumps === 1) bubble(CROOKED_LINES.bump, 1200);
  });
  d = { course, run, t: 0, bumps: 0, over: 0, top: 0, last: null, speed: 0, offBump };
  showChip({
    id: run.spec.id, title: run.spec.name, icon: 'play', meter: { value: 0, lo: 0, hi: SLOW / GAUGE_MAX },
    status: { zh: '碰撞 0', en: 'Bumps 0' }, line: { zh: '慢慢开 · 别超过小旗', en: 'Slowly · keep in the band' },
  });
  bubble(id === 'lombard' ? CROOKED_LINES.lombard : CROOKED_LINES.vermont, 3200);
  offFrame = registerFrameSystem('a-play-crooked', step);
  return true;
}

function step(dt: number) {
  const s = d;
  if (!s) return;
  s.t += dt;
  const v = runtime.vehicle;
  if (!v.occupied) { s.run.cancel(); return; }
  // the speed from the ride itself (|u/s|), smoothed a little for the gauge
  s.speed += (Math.abs(v.speed) - s.speed) * Math.min(1, dt * 8);
  if (s.t > GRACE_S) { if (Math.abs(v.speed) > SLOW) s.over += dt; s.top = Math.max(s.top, Math.abs(v.speed)); }
  patchChip(s.run.spec.id, { meter: { value: Math.min(1, s.speed / GAUGE_MAX), lo: 0, hi: SLOW / GAUGE_MAX } });
  if (offLine(s.course, v.x, v.z) > OFF_LANE) { s.run.cancel(); return; }
  const b = crookedBottom(s.course);
  if (Math.hypot(v.x - b.x, v.z - b.z) < 2.5 && progressOn(s.course, v.x, v.z) > 0.9) finish(s);
  else if (s.t > 90) s.run.cancel();
}

function finish(s: Descent) {
  const id = s.course.id, firstLombard = id === 'lombard' && bestOf('crooked-lombard') === undefined;
  s.run.end({
    tier: crookedTier(s.bumps, s.over),
    detail: { zh: `用时 ${s.t.toFixed(1)} 秒 · 碰撞 ${s.bumps} 次 · 超速 ${s.over.toFixed(1)} 秒`, en: `${s.t.toFixed(1)} s · ${s.bumps} bumps · ${s.over.toFixed(1)} s too fast` },
  });
  // done once (play.b, a flag: BAYBAY's tease and verdict read it)
  saveNumber(`crooked-${id}`, 1);
  charApi()?.emote('baybay', 'clap');
  const both = bestOf('crooked-lombard') !== undefined && bestOf('crooked-vermont') !== undefined;
  if (both) sayWhenQuiet(CROOKED_LINES.verdict, 3000);
  else if (firstLombard) { sayWhenQuiet(CROOKED_LINES.lombardFact, 2600); sayWhenQuiet(CROOKED_LINES.tease, 7600); }
}

function cleanup() {
  const s = d;
  d = null;
  s?.offBump();
  offFrame?.(); offFrame = null;
  if (s) hideChip(s.run.spec.id);
}

/** tests */
export function __resetDescent() { d?.run.cancel(); d = null; }

/**
 * On foot, down from the top to the bottom (zones3.ts saw it): no chip, no card — BAYBAY's facts, and the verdict once
 * both blocks are done (the drive's flags are shared).
 */
export function walkedDown(id: CrookedCourse['id']) {
  const before = { lombard: bestOf('crooked-lombard') !== undefined, vermont: bestOf('crooked-vermont') !== undefined };
  saveNumber(`crooked-${id}`, 1);
  if (before.lombard && before.vermont) return;
  const other = id === 'lombard' ? before.vermont : before.lombard;
  if (other) { sayWhenQuiet(CROOKED_LINES.verdict, 1200); return; }
  // (Lombard's own bark, lane L's landmark card, already says its eight hairpins and 5 mph: on foot only the tease)
  if (id === 'lombard') sayWhenQuiet(CROOKED_LINES.tease, 1200);
  else sayWhenQuiet(CROOKED_LINES.vermontFact, 1200);
}
