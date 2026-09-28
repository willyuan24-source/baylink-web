/**
 * Wave 5 · lane E · W5-E8: the scripted economy run (plan sf-w5-plan.md MF5 acceptance, D21) — a typical first hour,
 * then more hours of ordinary play, on the REAL data and the REAL ledger, to lock the 小铺's prices:
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/economy-run.mts [--hours 8] [--date 2026-10-03T10:30]
 *                                                                       [--profile typical|brisk|relaxed|all] [--json out.json]
 *
 * What is real: the published city (the walking graph the player walks, the ground height), lane E's coin spots and the
 * CoinWorld pickup (radii, heights, the Bay-day refill), lane C's ArrivalWatcher over ATTRACTIONS (a first arrival pays
 * arrive:<id> T1 10 · T2 5 · T3 3, as game/cityMoments.ts does), lane D's egg spots and EGG_COINS, lane A's view spots
 * and VIEW_COINS, the first flight (8 rings × RING_COINS + the three medals MEDAL_COINS), lane C's postcards and goal
 * coins (game/rewards.ts REWARD_COINS), lane R's 今日三件小事 for each Bay date (realsf/daily.ts dailyThree over
 * public/planner-catalog.json), and the ledger (economy/ledger.ts) paying every source once.
 *
 * What is a model (the report states it; three player profiles bracket it):
 *   travel   walking at 0.95 × WALK_SPEED (4.0 u/s; the GGB deck walker measured 4.16) to a place ≤ `walkMax` u away,
 *            else 飞过去 in 6 s (lane N's 约 6 秒; the checkpoint landed in 4.3 s)
 *   a place  the arrival card (T1 20 s · T2 10 s · T3 5 s), then `stay` looking round / a photo, and a short wander (two
 *            walks to graph nodes ≤ 40 u away) — the must-sees first (a T1 counts as `rankPull` u nearer per tier)
 *   noticing a coin trail or a cache within 40 u, a postcard, an egg spot or a view within 45 u: the player goes for it
 *            (at most 2 eggs, 2 postcards and 2 views an hour — nobody finds everything; an egg takes 40 s, a postcard
 *            30 s, sitting at a view 25 s)
 *   other    `other` minutes an hour earn nothing (a bus leg — the full lap is 17.8 min, the checkpoint measured —, a
 *            ride, chatting, emotes, the photo mode, being lost): 15 for the typical player (5 brisk, 18 relaxed); hour 1
 *            spends 4 of them on the cable car (the 坐一段叮当车 goal and a daily ride when offered)
 *   days     one hour a day (a new Bay day each hour: the trails refill, a new daily three). Favours, the Metro and
 *            campuses goals, activities other than the first flight, event souvenirs and notebook pages are left out,
 *            so the run sits on the low side of real play.
 *
 * Hour 1 opens as the checkpoint's phone script did: the goals step, BAYBAY carries you up the Filbert Steps to Coit
 * (the parrots egg on the way), the pelican, the first flight (45 s, lane A), a walk out on PIER 39 (its trail, the end
 * cache), then the loop above until 60:00.
 */
import fs from 'node:fs';
import path from 'node:path';

const P = await import('./coins-place.mts');
const terrain = await import('../../src/opus-bay/core/terrain');
const { emit, onEvent } = await import('../../src/opus-bay/core/events');
const { findGraphPath } = await import('../../src/opus-bay/core/walkGraph');
const save = await import('../../src/opus-bay/data/save');
const L = await import('../../src/opus-bay/economy/ledger');
const C = await import('../../src/opus-bay/economy/coins');
const S = await import('../../src/opus-bay/economy/coinSpots');
const { ITEMS, forSale } = await import('../../src/opus-bay/economy/items');
const { __setBayNowForTests, parseBayDate, bayParts } = await import('../../src/opus-bay/game/bayNow');
const { ArrivalWatcher, arrivalAnchors } = await import('../../src/opus-bay/game/arrival');
const { REWARD_COINS } = await import('../../src/opus-bay/game/rewards');
const { ATTRACTIONS, tripDestination } = await import('../../src/opus-bay/data/sf/attractions');
const { CITY_POSTCARDS } = await import('../../src/opus-bay/data/sf/postcards');
const { DISTRICT } = await import('../../src/opus-bay/data/district');
const { WALK_SPEED } = await import('../../src/opus-bay/actors/controller');
const { EGGS, EGG_IDS, EGG_COINS, eggRewardSource } = await import('../../src/opus-bay/eggs/registry');
const { VIEW_SPOTS, VIEW_SPOT_IDS, VIEW_COINS, viewReward } = await import('../../src/opus-bay/play/viewSpots');
const { RING_COINS, ringSource } = await import('../../src/opus-bay/play/firstFlight');
const { MEDAL_COINS } = await import('../../src/opus-bay/play/kit');
const { SOUVENIR_IDS } = await import('../../src/opus-bay/realsf/eventVenues');
const daily = await import('../../src/opus-bay/realsf/daily');
const { PLACES } = await import('../../src/opus-bay/realsf/todayRows');
const { setCatalogForTests, sanitizeCatalog } = await import('../../src/opus-bay/data/catalog');

const ROOT = path.resolve(import.meta.dirname, '../..');

// ---------------------------------------------------------------------------------------------------------------
// The model's numbers (seconds, u, u/s)
// ---------------------------------------------------------------------------------------------------------------

export interface Profile {
  id: 'typical' | 'brisk' | 'relaxed';
  /** extra seconds at a place after its card, by tier */
  stay: Record<1 | 2 | 3, number>;
  /** minutes an hour that earn nothing */
  other: number;
  /** a place farther than this is flown to */
  walkMax: number;
}
export const PROFILES: Record<Profile['id'], Profile> = {
  typical: { id: 'typical', stay: { 1: 120, 2: 45, 3: 20 }, other: 15, walkMax: 300 },
  brisk: { id: 'brisk', stay: { 1: 60, 2: 20, 3: 10 }, other: 5, walkMax: 200 },
  relaxed: { id: 'relaxed', stay: { 1: 200, 2: 80, 3: 35 }, other: 18, walkMax: 400 },
};

export const MODEL = {
  walk: 0.95 * WALK_SPEED,
  fly: 6,
  ride: 240,
  goalsStep: 25,
  read: { 1: 20, 2: 10, 3: 5 } as Record<1 | 2 | 3, number>,
  egg: 40,
  postcard: 30,
  view: 25,
  pelican: 30,
  firstFlight: 45,
  deck: 30,
  wander: 40,
  rankPull: 300,
  notice: { trail: 40, cache: 40, egg: 45, postcard: 45, view: 45 },
  perHour: { egg: 2, postcard: 2, view: 2 },
} as const;

type Pt = { x: number; z: number };
interface Row { t: number; source: string; coins: number; total: number }

export interface HourResult { hour: number; date: string; earned: number; total: number; bySource: Record<string, number>; daily: string[]; places: number }
export interface RunResult {
  profile: Profile['id'];
  hours: HourResult[];
  /** the balance at each minute of hour 1 (index = minute) */
  minutes: number[];
  rows: Row[];
}

/** Run the scripted play: `hours` sessions of 60 minutes, one Bay day each, from `start` (a Bay wall-clock minute). */
export async function runEconomy(opts: { hours?: number; start?: string; profile?: Profile; log?: (s: string) => void } = {}): Promise<RunResult> {
  const hours = opts.hours ?? 8, start = opts.start ?? '2026-10-03T10:30', prof = opts.profile ?? PROFILES.typical, log = opts.log ?? (() => undefined);
  const ctx = await P.loadCity();
  const { ix } = ctx;
  const home = (i: number) => ix.component(i) === ctx.home;
  setCatalogForTests(sanitizeCatalog(JSON.parse(fs.readFileSync(path.join(ROOT, 'public/planner-catalog.json'), 'utf8'))));
  let seed = 0x2f6e2b1;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);

  // a fresh save and the ledger with every lane's id list, as the game's inits register them
  save.resetSaveCache();
  save.clearSave();
  L.__resetLedgerForTests();
  __setBayNowForTests(start);
  const offLedger = L.initLedger();
  L.registerRewardIds('trail', S.trailCoinIds());
  L.registerRewardIds('cache', S.cacheIds());
  L.registerRewardIds('ring', S.ringCoinIds());
  L.registerRewardIds('egg', EGG_IDS);
  L.registerRewardIds('view', VIEW_SPOT_IDS);
  L.registerRewardIds('event', SOUVENIR_IDS);
  const world = new C.CoinWorld(C.coinItems());
  const offDirty = L.subscribeLedger(() => world.markDirty());

  const rows: Row[] = [];
  let t = 0; // seconds since the run started
  const offCoins = onEvent(e => { if (e.type === 'coins') rows.push({ t, source: e.source, coins: e.delta, total: e.total }); });
  const reward = (source: string, coins: number) => emit({ type: 'reward', source, coins });

  const watcher = new ArrivalWatcher(arrivalAnchors(ATTRACTIONS));
  const visited = new Set<string>();
  let pos: Pt = { ...DISTRICT.anchors['ferry-gate'] };
  let hourStart = 0, hourEnd = 0, otherDone = false, otherSec = 0;
  const found = { egg: new Set<string>(), postcard: new Set<string>(), view: new Set<string>() };
  let perHour = { egg: 0, postcard: 0, view: 0 };
  let tasks: import('../../src/opus-bay/realsf/daily').DailyTask[] = [];
  const tasksDone = new Set<number>();
  let sessionStartMs = 0;
  const hoods = new Set<string>();
  const goals = new Set<string>();
  const bayMs = () => sessionStartMs + (t - hourStart) * 1000;

  const goal = (id: string) => { if (!goals.has(id)) { goals.add(id); reward(`goal:${id}`, REWARD_COINS.goal); } };
  const dailyDone = (kind: string) => {
    const task = tasks.find(k => k.kind === kind);
    if (!task || tasksDone.has(task.n)) return;
    if (task.window && (bayMs() < task.window.open || bayMs() >= task.window.close)) return;
    tasksDone.add(task.n);
    reward(task.source, daily.DAILY_COINS);
    if (tasksDone.size === 3) reward(`daily:${bayParts(new Date(sessionStartMs)).dateKey}:all`, daily.DAILY_ALL_COINS);
  };
  const arrive = (hit: ReturnType<typeof watcher.step>) => {
    if (!hit || !hit.first) return 0;
    const a = hit.anchor;
    visited.add(a.attraction);
    reward(`arrive:${a.attraction}`, REWARD_COINS.arrive[a.rank as 1 | 2 | 3] ?? 0);
    dailyDone('new');
    return MODEL.read[a.rank as 1 | 2 | 3] ?? 5;
  };
  const zone = () => { const z = ctx.zoneOf(pos.x, pos.z); if (z) { hoods.add(z); if (hoods.size >= 8) goal('neighbourhoods'); } };
  const dwell = (s: number) => { t += s; };

  /** walk the graph from pos to `to` (then straight to it), picking coins up, arriving at places */
  const walkTo = async (to: Pt) => {
    const a = ix.nearestNode(pos.x, pos.z, 60, home), b = ix.nearestNode(to.x, to.z, 60, home);
    const pts: Pt[] = [{ ...pos }];
    if (a >= 0 && b >= 0 && a !== b) { const p = findGraphPath(ix, a, b); if (p) for (const n of p.nodes) pts.push({ x: ix.x(n), z: ix.z(n) }); }
    pts.push({ ...to });
    const stepU = MODEL.walk / 30;
    let lastEnsure: Pt = { x: 1e9, z: 1e9 }, arriveAcc = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const p0 = pts[i], p1 = pts[i + 1], len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      const n = Math.max(1, Math.ceil(len / stepU));
      for (let k = 1; k <= n; k++) {
        pos = { x: p0.x + ((p1.x - p0.x) * k) / n, z: p0.z + ((p1.z - p0.z) * k) / n };
        t += len / n / MODEL.walk;
        if (Math.hypot(pos.x - lastEnsure.x, pos.z - lastEnsure.z) > 24) { await ctx.ensure(pos.x, pos.z); lastEnsure = pos; }
        world.step({ x: pos.x, y: terrain.heightAt(pos.x, pos.z), z: pos.z, mode: 'foot', low: true }, t * 1000);
        if ((arriveAcc += len / n / MODEL.walk) >= 0.2) {
          arriveAcc = 0;
          dwell(arrive(watcher.step({ x: pos.x, z: pos.z, now: t * 1000, onFoot: true, busy: false, travelling: false })));
          zone();
        }
      }
    }
  };
  /** 飞过去: no pickups on the way; the landing counts as a hop-off (lane N's request to C) */
  const flyTo = (to: Pt) => {
    watcher.step({ x: pos.x, z: pos.z, now: t * 1000, onFoot: false, busy: false, travelling: true });
    t += MODEL.fly;
    pos = { ...to };
    dwell(arrive(watcher.step({ x: pos.x, z: pos.z, now: t * 1000, onFoot: false, hoppedOffAt: t * 1000, busy: false, travelling: false })));
    zone();
  };
  /** look round a place: two short walks to graph nodes ≤ MODEL.wander u away */
  const wander = async () => {
    const around: number[] = [];
    ix.forNodesNear(pos.x, pos.z, MODEL.wander, i => { if (home(i)) around.push(i); });
    for (let k = 0; k < 2 && around.length; k++) { const n = around[Math.floor(rnd() * around.length)]; await walkTo({ x: ix.x(n), z: ix.z(n) }); }
  };

  type Near = { kind: 'trail' | 'cache' | 'egg' | 'postcard' | 'view'; id: string; at: Pt; end?: Pt; d: number };
  const collectibles = (): Near[] => {
    const out: Near[] = [];
    const d = (q: Pt) => Math.hypot(q.x - pos.x, q.z - pos.z);
    for (const tr of S.COIN_TRAILS) {
      if (tr.retired || (tr.dt && !C.DOWNTOWN_OPEN) || tr.p.length < 6) continue;
      const n = tr.p.length / 3;
      if (Array.from({ length: n }, (_, i) => L.isPaid(`trail:${tr.id}:${i + 1}`)).every(Boolean)) continue;
      const first = { x: tr.p[0], z: tr.p[2] }, last = { x: tr.p[tr.p.length - 3], z: tr.p[tr.p.length - 1] };
      const [near, far] = d(first) <= d(last) ? [first, last] : [last, first];
      if (d(near) <= MODEL.notice.trail) out.push({ kind: 'trail', id: tr.id, at: near, end: far, d: d(near) });
    }
    for (const c of S.COIN_CACHES) if (!c.retired && !c.air && !(c.dt && !C.DOWNTOWN_OPEN) && !L.isPaid(`cache:${c.id}`) && d(c) <= MODEL.notice.cache) out.push({ kind: 'cache', id: c.id, at: c, d: d(c) });
    if (perHour.egg < MODEL.perHour.egg) for (const e of EGGS) if (e.kind === 'ground' && !found.egg.has(e.id) && d(e.at) <= MODEL.notice.egg) out.push({ kind: 'egg', id: e.id, at: e.at, d: d(e.at) });
    if (perHour.postcard < MODEL.perHour.postcard) for (const c of CITY_POSTCARDS) if (!found.postcard.has(c.id) && d(c.position) <= MODEL.notice.postcard) out.push({ kind: 'postcard', id: c.id, at: c.position, d: d(c.position) });
    if (perHour.view < MODEL.perHour.view) for (const v of VIEW_SPOTS) if (!found.view.has(v.id) && d(v) <= MODEL.notice.view) out.push({ kind: 'view', id: v.id, at: v, d: d(v) });
    return out.sort((a, b) => a.d - b.d);
  };
  const collect = async (c: Near) => {
    await walkTo(c.at);
    if (c.kind === 'trail') {
      // walk the trail's coins in order from the near end (a trail bends: the graph path between its ends may not)
      const tr = S.COIN_TRAILS.find(x => x.id === c.id)!;
      const pts = Array.from({ length: tr.p.length / 3 }, (_, i) => ({ x: tr.p[3 * i], z: tr.p[3 * i + 2] }));
      if (Math.hypot(pts[0].x - c.at.x, pts[0].z - c.at.z) > 0.01) pts.reverse();
      for (const q of pts) await walkTo(q);
    } else if (c.kind === 'egg') { found.egg.add(c.id); perHour.egg++; dwell(MODEL.egg); reward(eggRewardSource(c.id), EGG_COINS); }
    else if (c.kind === 'postcard') { found.postcard.add(c.id); perHour.postcard++; dwell(MODEL.postcard); reward(`postcard:${c.id}`, REWARD_COINS.postcard); }
    else if (c.kind === 'view') { found.view.add(c.id); perHour.view++; dwell(MODEL.view); reward(viewReward(c.id), VIEW_COINS); }
  };
  const DOWNTOWN = ['financial-district-south-beach', 'chinatown'];
  /** the next place: the nearest one not visited yet, the must-sees pulled nearer */
  const nextPlace = () => {
    let best: (typeof ATTRACTIONS)[number] | null = null, bestS = Infinity;
    for (const a of ATTRACTIONS) {
      if (visited.has(a.id) || a.offWalk) continue;
      const q = tripDestination(a);
      const s = Math.hypot(q.x - pos.x, q.z - pos.z) + (a.rank - 1) * MODEL.rankPull + (DOWNTOWN.includes(ctx.zoneOf(q.x, q.z) ?? '') ? 200 : 0);
      if (s < bestS) { bestS = s; best = a; }
    }
    return best;
  };
  /** the day's small things the player goes for (lane R's 今天 tab shows them with 带我去) */
  const doDaily = () => {
    for (const task of tasks) {
      if (tasksDone.has(task.n) || hourEnd - t < 300) continue;
      if (task.window && (bayMs() < task.window.open || bayMs() >= task.window.close)) continue;
      if (task.kind === 'ride') { t += MODEL.ride; goal('cable-car'); dailyDone('ride'); }
      else if (task.kind === 'market') { flyTo(PLACES.market.at); dwell(20); dailyDone('market'); }
      else if (task.kind === 'fire') { flyTo(PLACES.fireRings.at); dwell(20); dailyDone('fire'); }
      else if ((task.kind === 'free' || task.kind === 'event') && task.go) { flyTo(task.go.point); dwell(30); dailyDone(task.kind); }
      // 'new' comes with the next first arrival; 'sunset' needs the real sunset (these sessions are in the day)
    }
  };
  const loop = async () => {
    while (t < hourEnd) {
      if (!otherDone && t >= hourStart + 1800) { otherDone = true; t += otherSec; continue; }
      const c = collectibles()[0];
      if (c) { await collect(c); continue; }
      if (tasks.some(k => !tasksDone.has(k.n) && k.kind !== 'new' && k.kind !== 'sunset')) doDaily();
      const a = nextPlace();
      if (!a) { t = hourEnd; break; }
      const q = tripDestination(a);
      if (Math.hypot(q.x - pos.x, q.z - pos.z) > prof.walkMax) flyTo(q); else await walkTo(q);
      visited.add(a.id);
      dwell(prof.stay[a.rank as 1 | 2 | 3] ?? 10);
      if (a.id === 'golden-gate-bridge') { dwell(MODEL.deck); t += 400 / MODEL.walk; goal('golden-gate'); }
      if (a.id === 'alamo-square-painted-ladies') goal('painted-ladies');
      await wander();
    }
  };
  const newSession = (h: number) => {
    const startMs = (parseBayDate(start) ?? new Date()).getTime() + h * 24 * 3600 * 1000;
    sessionStartMs = startMs;
    __setBayNowForTests(new Date(startMs));
    world.step(null, t * 1000);
    const key = bayParts(new Date(startMs)).dateKey;
    tasks = daily.dailyThree(key, daily.daySignals(key));
    tasksDone.clear();
    perHour = { egg: 0, postcard: 0, view: 0 };
    hourStart = t; hourEnd = t + 3600; otherDone = false; otherSec = prof.other * 60;
    return key;
  };

  const result: RunResult = { profile: prof.id, hours: [], minutes: [], rows };
  try {
    for (let h = 0; h < hours; h++) {
      const key = newSession(h);
      const before = L.coinsTotal(), rowsBefore = rows.length, seenBefore = visited.size;
      if (h === 0) {
        // the opening (the checkpoint's phone script): goals step, carried up the Filbert Steps, the pelican, the flight
        dwell(MODEL.goalsStep);
        const fil = S.COIN_TRAILS.find(x => x.id === 'filbert-steps')!;
        for (let i = 0; i < fil.p.length; i += 3) await walkTo({ x: fil.p[i], z: fil.p[i + 2] });
        const parrots = EGGS.find(e => e.id === 'telegraph-hill-parrots');
        if (parrots) { await walkTo(parrots.at); found.egg.add(parrots.id); perHour.egg++; dwell(MODEL.egg); reward(eggRewardSource(parrots.id), EGG_COINS); }
        const coit = ATTRACTIONS.find(a => a.id === 'coit-tower')!;
        await walkTo(tripDestination(coit));
        dwell(MODEL.pelican);
        goal('pelican');
        t += MODEL.firstFlight;
        for (let i = 0; i < 8; i++) reward(ringSource(i), RING_COINS);
        for (const tier of [1, 2, 3] as const) reward(`medal:first-flight:${tier}`, MEDAL_COINS[tier]);
        pos = { x: 80, z: -8 };  // the landing by Pier 15 (the checkpoint's glide landing)
        watcher.step({ x: pos.x, z: pos.z, now: t * 1000, onFoot: false, hoppedOffAt: t * 1000, busy: false, travelling: false });
        const p39 = S.COIN_TRAILS.find(x => x.id === 'pier-39')!;
        for (let i = 0; i < p39.p.length; i += 3) await walkTo({ x: p39.p[i], z: p39.p[i + 2] });
        await walkTo(S.COIN_CACHES.find(c => c.id === 'pier-39-end')!);
        // the cable car (4 of the hour's coin-free minutes): 坐一段叮当车, and today's ride if it is one of the three
        t += MODEL.ride; goal('cable-car'); dailyDone('ride');
        otherSec = Math.max(0, prof.other * 60 - MODEL.ride);
      }
      await loop();
      if (t > hourEnd) t = hourEnd;
      const earned = L.coinsTotal() - before;
      const bySource: Record<string, number> = {};
      for (const r of rows.slice(rowsBefore)) { const k = r.source.split(':')[0]; bySource[k] = (bySource[k] ?? 0) + r.coins; }
      result.hours.push({ hour: h + 1, date: key, earned, total: L.coinsTotal(), bySource, daily: tasks.map(k => `${k.kind}${tasksDone.has(k.n) ? ' ✓' : ''}`), places: visited.size - seenBefore });
      log(`[${prof.id}] hour ${h + 1} (${key}): +${earned} → ${L.coinsTotal()} · ${visited.size - seenBefore} places · ${Object.entries(bySource).map(([k, v]) => `${k} ${v}`).join(' · ')} · daily ${tasks.map(k => `${k.kind}${tasksDone.has(k.n) ? '✓' : ''}`).join(' ')}`);
      t = hourEnd;
    }
    for (let m = 0; m <= 60; m++) { let tot = 0; for (const r of rows) if (r.t <= m * 60) tot = r.total; result.minutes.push(tot); }
  } finally {
    offCoins(); offDirty(); offLedger();
    setCatalogForTests(null);
    __setBayNowForTests(null);
    ctx.done();
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------------
// What the balance buys (the prices under test)
// ---------------------------------------------------------------------------------------------------------------

/** How many cosmetics a balance buys, cheapest first. */
export function cosmeticsFor(balance: number, prices: readonly number[]): number {
  let n = 0, left = balance;
  for (const p of [...prices].sort((a, b) => a - b)) { if (p > left) break; left -= p; n++; }
  return n;
}
/** The shop's wearables for sale (the helpers are one-outing conveniences, not cosmetics). */
export const wearablePrices = (): number[] => ITEMS.filter(it => forSale(it) && it.slot !== 'use').map(it => it.price);

/**
 * The price check (plan MF5 / D21): after hour 1 the balance buys 3–5 cosmetics at the average wearable price, one
 * about every 15 minutes; everything is bought after 6–8 hours. `cosmetics` = balance / average price.
 */
export function priceCheck(res: RunResult, prices: readonly number[] = wearablePrices()) {
  const all = prices.reduce((a, b) => a + b, 0), avg = all / prices.length;
  const h1 = res.hours[0]?.total ?? 0;
  const allAt = res.hours.find(h => h.total >= all)?.hour ?? null;
  return { all, avg: Math.round(avg * 10) / 10, hour1: h1, cosmeticsHour1: Math.round((h1 / avg) * 10) / 10, minutesPerItem: Math.round((60 / (h1 / avg)) * 10) / 10, allAt, byHour: res.hours.map(h => Math.round((h.total / avg) * 10) / 10) };
}

/**
 * The one-off coins the city holds (every source paid once per save), by family, and what refills each Bay day — the
 * ceiling the shop's total sits under (with downtown held, the activities' medals only as lane A lists them).
 */
export async function supply() {
  const { RESIDENTS } = await import('../../src/opus-bay/data/sf/residents');
  const { CITY_FREE_GOALS } = await import('../../src/opus-bay/data/sf/goals');
  const { PAGE_IDS } = await import('../../src/opus-bay/economy/stamps');
  const tier = (r: number) => REWARD_COINS.arrive[r as 1 | 2 | 3] ?? 0;
  const liveTrails = S.COIN_TRAILS.filter(t => !t.retired && !(t.dt && !C.DOWNTOWN_OPEN));
  const once: Record<string, number> = {
    arrive: ATTRACTIONS.filter(a => !a.offWalk).reduce((n, a) => n + tier(a.rank), 0),
    postcard: CITY_POSTCARDS.length * REWARD_COINS.postcard,
    egg: EGGS.length * EGG_COINS,
    view: VIEW_SPOTS.filter(v => !v.retired).length * VIEW_COINS,
    goal: CITY_FREE_GOALS.length * REWARD_COINS.goal,
    favour: RESIDENTS.length * REWARD_COINS.favour,
    cache: S.COIN_CACHES.filter(c => !c.retired && !(c.dt && !C.DOWNTOWN_OPEN)).length * C.CACHE_COINS,
    ring: S.COIN_RINGS.filter(r => !r.retired && !r.reserved && !(r.dt && !C.DOWNTOWN_OPEN)).length * S.SLOT_COINS + 8 * RING_COINS,
    medal: 4 * (MEDAL_COINS[1] + MEDAL_COINS[2] + MEDAL_COINS[3]),
    page: PAGE_IDS.length * 30,
    event: SOUVENIR_IDS.length * 15,
  };
  const daily = { trail: liveTrails.reduce((n, t) => n + t.p.length / 3, 0), three: 3 * 10 + 20 };
  return { once, onceTotal: Object.values(once).reduce((a, b) => a + b, 0), daily };
}

async function main() {
  const args = process.argv.slice(2);
  const sup = await supply();
  console.log(`one-off coins in the city: ${sup.onceTotal} (${Object.entries(sup.once).map(([k, v]) => `${k} ${v}`).join(' · ')}); each Bay day: trails ${sup.daily.trail}, the daily three ${sup.daily.three}\n`);
  const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const t0 = Date.now();
  const which = arg('--profile') ?? 'all';
  const profiles = which === 'all' ? Object.values(PROFILES) : [PROFILES[which as Profile['id']]];
  const prices = wearablePrices(), all = prices.reduce((a, b) => a + b, 0);
  const out: RunResult[] = [];
  for (const prof of profiles) {
    const res = await runEconomy({ hours: Number(arg('--hours') ?? 8), start: arg('--date') ?? '2026-10-03T10:30', profile: { ...prof, stay: { ...prof.stay } }, log: s => console.log(s) });
    out.push(res);
    console.log(`[${prof.id}] hour 1 by minute: ${[5, 10, 15, 20, 30, 40, 50, 60].map(m => `${m}′ ${res.minutes[m]}`).join(' · ')}`);
    const pc = priceCheck(res, prices);
    console.log(`[${prof.id}] ${res.hours.map(h => `h${h.hour} ${h.total}`).join(' · ')} · average price ${pc.avg}: hour 1 = ${pc.cosmeticsHour1} cosmetics (one per ${pc.minutesPerItem} min), cumulative ${pc.byHour.join(' / ')}${pc.allAt ? ` — everything after hour ${pc.allAt}` : ' — not everything within the run'}\n`);
  }
  console.log(`wearables for sale: ${prices.length}, ${all} coins in all (${[...new Set(prices)].sort((a, b) => a - b).join(' / ')}) · (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  const json = arg('--json');
  if (json) fs.writeFileSync(json, JSON.stringify(out.map(r => ({ ...r, rows: r.rows.length })), null, 1));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) await main();
