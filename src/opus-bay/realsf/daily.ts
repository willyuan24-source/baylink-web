import { emit, onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual, Catalog, Vec2 } from '../core/types';
import { getCatalog } from '../data/catalog';
import { isPaid } from '../economy/ledger';
import { bayNow, bayParts } from '../game/bayNow';
import { say } from '../game/flow';
import { registerFrameSystem } from '../game/systemsRegistry';
import { EVENT_SAY, VENUE_SAY } from './eventVenues';
import { handRowOf, weekEvents, type EventWindow } from './events';
import { isFireRingLit } from './seasons';
import { roundMinute, sunBandAt, sunTimes } from './sun';
import { atMinute, fireSeasonKey, freePlacesOn, hm, marketHours, PLACES } from './todayRows';

/**
 * Wave 5 · lane R (W5-R5) · 今日三件小事 — three small things to do today, seeded by the Bay date from San Francisco's
 * real signals (plan §3.3 item 5): be at a sunset spot while the sun sets; visit today's event at its venue while it is
 * on; taste at the Ferry Plaza market while it is open; ride a line; visit a place that is free today; see the Ocean
 * Beach fire rings in their season; find a place you have never been. +10 coins each and +20 for all three, paid by
 * lane E's ledger (`daily:<Bay date>:1 … :3`, `daily:<Bay date>:all` → save v2 `play.d`); no streak, nothing lost for
 * skipping a day (明天可能不一样).
 *
 *   daySignals(dateKey, catalog)  what the Bay date offers (date-level facts only, so the pick is stable all day)
 *   dailyThree(dateKey, signals)  the three tasks: the same for the same date and signals (a seeded shuffle); today's
 *                                 event first when there is one, never more than two tied to a time of day
 *   initDaily()                   city mode (realsf/index.ts): watches the game (2 Hz + events), pays each task once
 *
 * The windows are real Bay time; a task whose window is over today says so in the 今天 tab (not done, never lost).
 */

export type DailyKind = 'event' | 'sunset' | 'market' | 'ride' | 'free' | 'fire' | 'new';
/** tied to a time of day (at most two of these a day, so something is always doable) */
export const TIMED: ReadonlySet<DailyKind> = new Set(['event', 'sunset', 'market']);

export const DAILY_COINS = 10;
export const DAILY_ALL_COINS = 20;

/** The sunset spots (plan §3.3: Ocean Beach, Twin Peaks, Baker Beach, Lands End, Marina Green; attraction points), r in u. */
export const SUNSET_SPOTS: readonly { id: string; name: Bilingual; x: number; z: number; r: number }[] = [
  { id: 'ocean-beach', name: { zh: '海洋海滩', en: 'Ocean Beach' }, x: -431, z: 1475, r: 90 },
  { id: 'ocean-beach', name: { zh: '海洋海滩', en: 'Ocean Beach' }, x: -564.83, z: 1363.73, r: 60 },
  { id: 'twin-peaks', name: { zh: '双峰', en: 'Twin Peaks' }, x: 128.86, z: 922.32, r: 45 },
  { id: 'baker-beach', name: { zh: '贝克海滩', en: 'Baker Beach' }, x: -614, z: 849.3, r: 60 },
  { id: 'lands-end', name: { zh: '天涯海角', en: 'Lands End' }, x: -701.6, z: 1229.6, r: 45 },
  { id: 'marina-green', name: { zh: '码头绿地', en: 'Marina Green' }, x: -382.1, z: 300.7, r: 60 },
];

/** How close counts as "there" (u). */
export const AT = { event: 25, free: 30, fire: 45, market: 80 } as const;

export interface DaySignals {
  dateKey: string;
  /** world events with a window on the date (sorted by id) */
  events: EventWindow[];
  /** Ferry Plaza market hours, else null */
  market: readonly [number, number] | null;
  /** places free for everyone that day */
  free: ReturnType<typeof freePlacesOn>;
  /** the fire-ring season */
  fire: boolean;
}

export interface DailyTask {
  n: 1 | 2 | 3;
  kind: DailyKind;
  /** lane E's reward source */
  source: string;
  title: Bilingual;
  hint: Bilingual;
  /** a few words for BAYBAY's line */
  short: Bilingual;
  /** the real window today (ms); null = any time */
  window: { open: number; close: number } | null;
  /** 带我去 (the sunset task goes to the nearest sunset spot instead) */
  go: { placeId?: string; point: Vec2; name: Bilingual } | null;
  eventId?: string;
  freeId?: 'teaGarden' | 'conservatory' | 'botanical';
}

/** The date-level signals of a Bay date. */
export function daySignals(dateKey: string, catalog: Catalog | null = getCatalog()): DaySignals {
  const start = atMinute(dateKey, 0);
  // (W6-S) an event the day already has as a hand task (the Ferry Plaza market → `market`) is not a second task
  const events = Number.isFinite(start) ? weekEvents(new Date(start), 1, catalog).filter(w => w.dateKey === dateKey && !handRowOf(w.event)) : [];
  events.sort((a, b) => a.event.id.localeCompare(b.event.id));
  return { dateKey, events, market: marketHours(dateKey), free: freePlacesOn(dateKey), fire: fireSeasonKey(dateKey) };
}

/** A small seeded generator (mulberry32 over the date string's hash). */
export function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shuffle = <T>(list: T[], rnd: () => number): T[] => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const hours = (open: number, close: number) => `${hm(open)}–${hm(close)}`;
const placeOf = (p: { placeId?: string }) => (p.placeId ? { placeId: p.placeId } : {});

function task(n: 1 | 2 | 3, kind: DailyKind, s: DaySignals, rnd: () => number): DailyTask {
  const source = `daily:${s.dateKey}:${n}`;
  switch (kind) {
    case 'event': {
      // (W6-S) the autumn catalog brings paid arena / opera nights: a free event of the day wins the task when there is one
      const free = s.events.filter(e => e.event.cost === 'free');
      const pool = free.length ? free : s.events;
      const w = pool[Math.floor(rnd() * pool.length)];
      const name = EVENT_SAY[w.event.id] ?? { zh: '活动', en: 'the event' };
      const place = VENUE_SAY[w.venue.id] ?? w.venue.name;
      const open = bayParts(new Date(w.open)), close = bayParts(new Date(w.close));
      const span = hours(open.hour * 60 + open.minute, close.hour * 60 + close.minute || 24 * 60);
      return {
        n, kind, source, eventId: w.event.id,
        title: { zh: `去看看${name.zh}`, en: `Drop in on ${name.en}` },
        hint: { zh: `${place.zh} · 今天 ${span}`, en: `${place.en} · today ${span}` },
        short: name, window: { open: w.open, close: w.close },
        go: { ...(w.venue.placeId ? { placeId: w.venue.placeId } : {}), point: { x: w.venue.x, z: w.venue.z }, name: w.venue.name },
      };
    }
    case 'sunset': {
      const sun = sunTimes(new Date(atMinute(s.dateKey, 12 * 60)));
      const p = (d: Date) => { const b = bayParts(roundMinute(d)); return b.hour * 60 + b.minute; };
      const span = hours(p(sun.golden), p(sun.dusk));
      return {
        n, kind, source,
        title: { zh: '在海边或山顶看日落', en: 'Watch the sunset from a beach or a hill' },
        hint: { zh: `今天 ${span} · 海洋海滩、双峰、贝克海滩、天涯海角、码头绿地`, en: `Today ${span} · Ocean Beach, Twin Peaks, Baker Beach, Lands End, Marina Green` },
        short: { zh: '看日落', en: 'the sunset' }, window: { open: sun.golden.getTime(), close: sun.dusk.getTime() }, go: null,
      };
    }
    case 'market': {
      const [o, c] = s.market ?? [600, 840];
      return {
        n, kind, source,
        title: { zh: '在农夫市集尝一口', en: 'Taste something at the farmers market' },
        hint: { zh: `渡轮大厦 · 今天 ${hours(o, c)} 开集`, en: `Ferry Building · open today ${hours(o, c)}` },
        short: { zh: '市集尝一口', en: 'a market taste' }, window: { open: atMinute(s.dateKey, o), close: atMinute(s.dateKey, c) },
        go: { ...placeOf(PLACES.market), point: PLACES.market.at, name: { zh: '渡轮大厦市集', en: 'the Ferry Building market' } },
      };
    }
    case 'ride':
      return {
        n, kind, source,
        title: { zh: '坐一站叮当车、轻轨或渡轮', en: 'Ride a cable car, streetcar, Muni or ferry' },
        hint: { zh: '随便哪条线，坐一站就算', en: 'Any line, one stop counts' },
        short: { zh: '坐一站车', en: 'a ride' }, window: null, go: null,
      };
    case 'free': {
      const f = s.free[Math.floor(rnd() * s.free.length)];
      const p = PLACES[f.id];
      return {
        n, kind, source, freeId: f.id,
        title: { zh: `去${p.name.zh}看看`, en: `Visit ${p.name.en}` },
        hint: { zh: `现实里今天 ${hours(f.hours[0], f.hours[1])} 免费进 · 游戏里随时都算`, en: `Free today ${hours(f.hours[0], f.hours[1])} in real life · any time counts here` },
        short: { zh: `去${p.name.zh}`, en: p.name.en }, window: null,
        go: { ...placeOf(p), point: p.at, name: p.name },
      };
    }
    case 'fire':
      return {
        n, kind, source,
        // (review) "see the fires" promised flames the toy rings show only after dusk: the task is to visit the rings
        title: { zh: '去海洋海滩的篝火圈看看', en: 'Visit the fire rings at Ocean Beach' },
        hint: { zh: '篝火季到 10 月底 · 每天 6:00–21:30', en: 'Fire season runs to October 31 · 6 am–9:30 pm' },
        short: { zh: '篝火圈', en: 'the fire rings' }, window: { open: atMinute(s.dateKey, 6 * 60), close: atMinute(s.dateKey, 21 * 60 + 30) },
        go: { point: PLACES.fireRings.at, name: PLACES.fireRings.name },
      };
    case 'new':
    default:
      return {
        n, kind: 'new', source,
        title: { zh: '去一个没去过的地方', en: 'Go somewhere you have never been' },
        hint: { zh: '还没盖过章的地方都算', en: 'Any place without a stamp yet' },
        short: { zh: '去新地方', en: 'a new place' }, window: null, go: null,
      };
  }
}

/** The three tasks of a Bay date (stable for the same date and signals). */
export function dailyThree(dateKey: string, s: DaySignals = daySignals(dateKey)): DailyTask[] {
  const rnd = seeded(`opus-bay:daily:${dateKey}`);
  const kinds: DailyKind[] = [];
  if (s.events.length) kinds.push('event');
  const pool: DailyKind[] = ['sunset', 'ride', 'new'];
  if (s.market) pool.push('market');
  if (s.free.length) pool.push('free');
  if (s.fire) pool.push('fire');
  for (const k of shuffle(pool, rnd)) {
    if (kinds.length === 3) break;
    if (TIMED.has(k) && kinds.filter(x => TIMED.has(x)).length >= 2) continue;
    kinds.push(k);
  }
  return kinds.map((k, i) => task((i + 1) as 1 | 2 | 3, k, s, rnd));
}

/** BAYBAY's once-a-day line (≤ 45 zh characters): 今日三件小事：蓝草音乐节、看日落、坐一站车，旅行本里有～ */
export function dailyLine(tasks: readonly DailyTask[]): Bilingual {
  return {
    zh: `今日三件小事：${tasks.map(t => t.short.zh).join('、')}，旅行本里有～`,
    en: `Three small things today: ${tasks.map(t => t.short.en).join(', ')} — they are in your journal.`,
  };
}
export const DAILY_ALL_LINE: Bilingual = { zh: '今天的三件小事都做完啦！明天可能不一样哦～', en: 'All three done today! Tomorrow may bring different ones.' };

/** A task's window now: 'any' (no window), 'now', 'later' (opens later today) or 'over' (not done today: never lost). */
export function taskWhen(t: DailyTask, now: number = bayNow().getTime()): 'any' | 'now' | 'later' | 'over' {
  if (!t.window) return 'any';
  return now >= t.window.close ? 'over' : now >= t.window.open ? 'now' : 'later';
}

/** The sunset spot nearest `p`. */
export const nearestSunsetSpot = (p: Vec2) => SUNSET_SPOTS.reduce((a, b) => (Math.hypot(b.x - p.x, b.z - p.z) < Math.hypot(a.x - p.x, a.z - p.z) ? b : a));

/** Paid (lane E's ledger), or done in this page when the ledger is not there. */
export const taskDone = (t: DailyTask, local: ReadonlySet<string> = doneHere) => local.has(t.source) || isPaid(t.source);
const doneHere = new Set<string>();

export interface DailyRuntime {
  /** today's tasks (null until the catalog is in: the pick needs today's events) */
  tasks(): DailyTask[] | null;
  done(t: DailyTask): boolean;
  /** lines on offer (the scheduler in realsf/index.ts picks at most one) */
  offered(): { key: string; text: Bilingual }[];
  /** tests / QA: complete a task as the game would */
  complete(kind: DailyKind): boolean;
  off(): void;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

/** City mode: watch for the day's three, pay each once. */
export function initDaily(opts: { introAfter?: number } = {}): DailyRuntime {
  const introAfter = opts.introAfter ?? 75;
  let day = '';
  let list: DailyTask[] | null = null;
  let catalogSeen: Catalog | null = null;
  let playing = 0;
  const lines: { key: string; text: Bilingual }[] = [];

  // the pick waits for the catalog (today's events); if it cannot load, the day goes on without events
  let noCatalog = false;
  const refresh = () => {
    const d = bayParts(bayNow()).dateKey, c = getCatalog();
    const failed = !c && game.get().catalogStatus === 'error';
    if (d === day && c === catalogSeen && failed === noCatalog && list) return;
    // (review) a new Bay day forgets yesterday's lines: the intro named yesterday's three, and 'daily-all' would have
    // said "all three done" again right after midnight (the scheduler's day memory had just rolled over)
    if (d !== day) lines.length = 0;
    day = d; catalogSeen = c; noCatalog = failed;
    list = c || failed ? dailyThree(d, daySignals(d, c)) : null;
  };

  const complete = (t: DailyTask): boolean => {
    if (taskDone(t)) return false;
    doneHere.add(t.source);
    emit({ type: 'reward', source: t.source, coins: DAILY_COINS });
    const tasks = list ?? [];
    const count = tasks.filter(x => taskDone(x)).length;
    say(`今日小事 ✓ ${t.short.zh} · ${count}/3`, `Today’s three ✓ ${t.short.en} · ${count}/3`, 'success', 2800);
    if (tasks.length === 3 && count === 3) {
      const all = `daily:${day}:all`;
      if (!isPaid(all)) emit({ type: 'reward', source: all, coins: DAILY_ALL_COINS });
      lines.push({ key: 'daily-all', text: DAILY_ALL_LINE });
    }
    return true;
  };
  const doKind = (kind: DailyKind, ok: (t: DailyTask) => boolean = () => true): boolean => {
    refresh();
    const t = list?.find(x => x.kind === kind);
    return !!t && ok(t) && complete(t);
  };
  const inWindow = (t: DailyTask, now = bayNow().getTime()) => !t.window || (now >= t.window.open && now < t.window.close);
  const onGround = () => { const m = game.get().move.mode; return m !== 'glide' && m !== 'travel'; };
  const P = () => ({ x: runtime.player.x, z: runtime.player.z });

  const offEvents = onEvent(e => {
    if (game.get().worldMode !== 'city') return;
    if (e.type === 'transit' && e.what === 'ride' && e.real) doKind('ride');
    else if (e.type === 'arrival' && e.first) doKind('new');
    else if (e.type === 'emote' && e.who === 'player' && e.emote === 'taste') doKind('market', t => inWindow(t) && dist(P(), PLACES.market.at) < AT.market);
    else if (e.type === 'realsf' && e.what === 'event-enter') doKind('event', t => t.eventId === e.id && inWindow(t));
  });

  let acc = 0;
  const offFrame = registerFrameSystem('w5-realsf-daily', dt => {
    if ((acc += dt) < 0.5) return;
    const step = acc;
    acc = 0;
    refresh();
    const s = game.get();
    if (s.phase !== 'playing' || s.worldMode !== 'city' || !list) return;
    if (!s.paused) playing += step;
    // BAYBAY's once-a-day line after a while in the city, while something is left to do
    if (playing > introAfter && list.some(t => !taskDone(t)) && !lines.some(l => l.key === 'daily-intro')) lines.push({ key: 'daily-intro', text: dailyLine(list) });
    if (!onGround()) return;
    const p = P(), now = bayNow();
    for (const t of list) {
      if (taskDone(t)) continue;
      // the real sun only (Settings' fixed time or the first visit's golden sky never count)
      if (t.kind === 'sunset' && sunBandAt(now) === 'golden' && SUNSET_SPOTS.some(sp => dist(p, sp) < sp.r)) complete(t);
      else if (t.kind === 'free' && t.go && dist(p, t.go.point) < AT.free) complete(t);
      else if (t.kind === 'fire' && isFireRingLit(now) && dist(p, PLACES.fireRings.at) < AT.fire) complete(t);
      else if (t.kind === 'event' && t.go && inWindow(t, now.getTime()) && dist(p, t.go.point) < AT.event) complete(t);
    }
  }, 5);

  const rt: DailyRuntime = {
    tasks: () => { refresh(); return list; },
    done: t => taskDone(t),
    offered: () => lines.filter(l => l.key !== 'daily-intro' || (list ?? []).some(t => !taskDone(t))),
    complete: kind => doKind(kind),
    off: () => { offEvents(); offFrame(); if (active === rt) active = null; },
  };
  active = rt;
  return rt;
}

let active: DailyRuntime | null = null;
/** The running daily three (city mode, after realsf's init), else null: the 今天 tab reads it. */
export const activeDaily = (): DailyRuntime | null => active;

/** tests: forget the page's own done marks */
export function __resetDailyForTests(): void { doneHere.clear(); }
