import type { Bilingual, Vec2 } from '../core/types';
import {
  TRIP_MODES, TRIP_MODE_NAMES, type TripDriveLeg, type TripFlyLeg, type TripLeg, type TripLineLeg, type TripMode, type TripOption,
  type TripPoint, type TripState, type TripWalkLeg,
} from './tripTypes';

/**
 * Wave 4 · the trip planner (lane G, W4-G1; plan sf-w4-plan.md §4.2 "Trip planner"). Pure: every fact about the world
 * comes in through injected providers, so node tests drive it with fakes and the map (lane P's TripOptions), the flow
 * (lane C's startTrip) and the arrival / pill UI share one set of honest numbers.
 *
 *   planTrips(from, dest, providers) → TripOption[]   sorted by seconds, at most 4, exactly one 推荐 (when any option)
 *
 * Honest game times (every constant below is pinned against the code that really moves the player by the sf-trip test):
 *
 *   walk   route length / 4.2 u/s (actors/controller WALK_SPEED); straight × 1.25 while the time-sliced A* has not
 *          answered (the leg carries `estimate: true`: 计算中…)
 *   run    route length / 7.5 u/s (RUN_SPEED), offered only when the walk takes over 90 s
 *   bike / car   only with one parked within 60 u (game/travel RIDEABLE_R) or while riding it: walk to it / 4.2 + 3 s to
 *          mount + drive-graph length / 6.5 (bike) or / 8.5 (car) (the autopilot's cruise 7 / 10 u/s less its corner
 *          caps) + a last walk when the drive route ends away from the arrival
 *   line   offered when both ends are within 150 u of walking (straight × 1.25) of stops on one line: walk + wait (the system's ETA; the
 *          dispatch caps it near 15 s) + ride (the system's estimate, else arc / speed + dwells + accel / brake, the
 *          tunnel spans at the subway overlay's 25 u/s) + 2 s to step off + walk
 *   fly    discovered places only: 0.8 + 1.0 + clamp(d / 400, 0.6, 3.5) + ≈ 2 + 1.2 s (game/fastTravel phases; the
 *          hold is the typical streaming wait), note "不算登顶 / 骑行成就"
 *
 * 推荐 = the fastest non-fly option, or the fastest option that completes an open goal (the goal rules the caller
 * passes: "顺便完成叮当车目标") when it costs at most GOAL_SLACK more. Ties keep the TRIP_MODES order.
 *
 * Routes are asynchronous in the game (actors/nav routeTo, actors/vehicles/driveRoute): `TripRouteCache` below wraps
 * them into the synchronous lookups the planner wants (undefined = still computing → the estimate) and tells its
 * subscribers when an answer arrives, so the UI simply plans again.
 */

// ---------------------------------------------------------------------------------------------------------------
// Constants (pinned by tests/opus-bay-sf-trip.test.ts against controller / fastTravel / travel / autopilot / CABLE)
// ---------------------------------------------------------------------------------------------------------------

/** Average speeds over a route (u/s): walking and running as actors/controller.ts, bike / car as the autopilot's
 * cruise (vehicles/autopilot.ts: 7 / 10) less its corner caps and starts (plan §4.2). */
export const TRIP_SPEED = { walk: 4.2, run: 7.5, bike: 6.5, car: 8.5 } as const;
/** Streets are not straight lines: straight distance × this while no route is known (game/travel.ts STREET_FACTOR). */
export const STREET_FACTOR = 1.25;
/** Running is offered only when walking takes longer than this (s). */
export const RUN_AFTER_S = 90;
/** Getting on a bike / into the toy car (s). */
export const MOUNT_S = 3;
/** A parked bike / the toy car counts when it is this close to the start (u; game/travel.ts RIDEABLE_R). */
export const RIDEABLE_R = 60;
/**
 * A line is offered when both ends are within this much walking of its stops (u), judged on the straight line × 1.25
 * so the rows do not come and go as the A* answers land; a known route longer than LINE_WALK_CAP (a detour round a
 * canyon or the hero roadway gone wrong) still rules the stop out. The times always use the real route.
 */
export const LINE_WALK_MAX = 150;
export const LINE_WALK_CAP = 300;
/** Stepping off a vehicle at the alighting stop (s). */
export const ALIGHT_S = 2;
/** Closer than this the destination is "right here": no options (u). */
export const HERE_R = 4;
/** Legs shorter than this are dropped from an option (u): standing at the stop already. */
export const LEG_MIN = 2;
/** At most this many rows (plan §4.2). */
export const MAX_OPTIONS = 4;
/** The pelican (game/fastTravel.ts): pickup, rise, pan clamp(d / 400, 0.6, 3.5), a typical streaming hold, descent. */
export const FLY_TIMING = { pickup: 0.8, rise: 1.0, panSpeed: 400, panMin: 0.6, panMax: 3.5, hold: 2, descent: 1.2 } as const;
/** A goal option is recommended over the fastest one when it takes at most fastest × k + s seconds. */
export const GOAL_SLACK = { k: 1.5, s: 60 } as const;

/** Line kinds the planner knows (world/sf/format.ts TRANSIT_LINE_KINDS). */
export type TripLineKind = 'bus' | 'light-rail' | 'cable-car' | 'streetcar';

export interface LineModel {
  /** average surface speed between halts (u/s) */
  speed: number;
  /** acceleration / braking (u/s²): each halt costs speed / accel seconds */
  accel: number;
  /** dwell at a halting stop (s) */
  dwell: number;
  /** where the vehicle halts between boarding and alighting: every stop, or only `major` ones (request stops otherwise) */
  haltAt: 'all' | 'major';
  /** default wait at the boarding stop when the running system gives no ETA (s; the dispatch caps) */
  wait: number;
  /** underground (the subway overlay): time-compressed speed and the stop at each station (s) */
  tunnelSpeed?: number;
  tunnelDwell?: number;
}

/**
 * The ride model per kind when the line's own system gives no estimate (plan §3.2 / §3.3, data/transit.ts CABLE):
 * the loop bus 6,522 u in ≈ 11.5 min of driving (9.45 u/s), 8 s at every stop, dispatch ≤ 15 s; the LRV 10 u/s on the
 * surface, 4 s at major stops, 25 u/s + 3 s per station underground; the cable car 9 u/s, 4 s at its dwell stops,
 * dispatch 5 s; the hero F-line ≈ 13 u/s.
 */
export const LINE_MODELS: Readonly<Record<TripLineKind, LineModel>> = {
  bus: { speed: 9.45, accel: 2.6, dwell: 8, haltAt: 'all', wait: 15 },
  'light-rail': { speed: 10, accel: 2.6, dwell: 4, haltAt: 'major', wait: 15, tunnelSpeed: 25, tunnelDwell: 3 },
  'cable-car': { speed: 9, accel: 3, dwell: 4, haltAt: 'major', wait: 5 },
  streetcar: { speed: 13, accel: 2.6, dwell: 4, haltAt: 'all', wait: 20 },
};

// ---------------------------------------------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------------------------------------------

/** A route answer: its length (u) and, when known, the polyline flat [x0, z0, x1, z1, …]. */
export interface RouteAnswer { length: number; path?: number[] }
/** A drive route may end short of the goal (snapped to the drivable network): `end` = where it really ends. */
export interface DriveAnswer extends RouteAnswer { end?: Vec2 }
/**
 * A synchronous route lookup: an answer, `null` = no route exists, `undefined` = not known yet (the planner uses the
 * straight × 1.25 estimate). `request` false = only peek at what is known (the planner compares candidates with peeks
 * and requests routes only for the legs it keeps, so it never floods the A*).
 */
export type RouteLookup = (from: Vec2, to: Vec2, request?: boolean) => RouteAnswer | null | undefined;
export type DriveLookup = (from: Vec2, to: Vec2, kind: 'bike' | 'car', request?: boolean) => DriveAnswer | null | undefined;

export interface TripRideable { id: string; kind: 'bike' | 'car'; x: number; z: number; name?: Bilingual }

export interface TripLineStop {
  id: string;
  /** arc position along the line (u) */
  at: number;
  x: number;
  z: number;
  name?: Bilingual;
  /** vehicles always halt here (transfers, ★ stops, termini; the cable car's dwell stops) */
  major?: boolean;
}

export interface TripLineInfo {
  id: string;
  kind: TripLineKind;
  name: Bilingual;
  /** 'N', 'M', '观光' (the row label uses it) */
  short?: string;
  color?: string;
  length: number;
  /** one-way loop (arc positions wrap, travel only toward increasing `at`) */
  loop?: boolean;
  /** travel only toward increasing `at` (a one-way line that is not a loop); default: both ways */
  oneWay?: boolean;
  /** sorted by `at` */
  stops: readonly TripLineStop[];
  /** arc spans underground (the subway overlay) */
  tunnels?: readonly { fromAt: number; toAt: number }[];
  /** the line's path for the map / chevrons: world triples [x, y, z, …] (transit.json) or pairs [x, z, …] (`pathStride` 2) */
  path?: ArrayLike<number>;
  pathStride?: 2 | 3;
}

/** A rule that says which options complete an open goal (lane C passes the open goals' rules). */
export interface TripGoalRule {
  goal: string;
  /** shown under the row: "顺便完成叮当车目标" */
  note: Bilingual;
  test(option: TripOption, dest: TripDestination, lines: ReadonlyMap<string, TripLineInfo>): boolean;
}

export interface TripProviders {
  /** walking routes (actors/nav routeTo through TripRouteCache) */
  walk?: RouteLookup;
  /** drive routes (actors/vehicles/driveRoute through TripRouteCache) */
  drive?: DriveLookup;
  /** parked bikes / the toy car within `radius` of `near` (interactables with source 'vehicle') */
  rideables?: (near: Vec2, radius: number) => readonly TripRideable[];
  /** what carries the player right now (moveApi + game.move.mode): a ridden bike / car skips the walk and the mount */
  riding?: () => 'bike' | 'car' | null;
  /** the lines to consider (cable cars, the loop, N, M, …) */
  lines?: () => readonly TripLineInfo[];
  /** the running system's ETA to `stop` in direction `dir` (s); undefined = the kind's default wait */
  lineWait?: (line: string, stop: string, dir: 1 | -1) => number | null | undefined;
  /** the system's ride estimate board → alight (s, dwells included); undefined = the kind's model */
  lineRide?: (line: string, board: string, alight: string, dir: 1 | -1) => number | null | undefined;
  /** fast travel is offered only to discovered places */
  discovered?: (placeId: string) => boolean;
  /** open goals the options may complete */
  goals?: readonly TripGoalRule[];
}

export interface TripDestination {
  /** place-index id (fly leg, TripState.placeId) */
  placeId: string;
  /** the arrival point (Attraction.arrival or CityPlace.arrival) */
  x: number;
  z: number;
  name?: Bilingual;
  /** Attraction id when the place is one */
  attraction?: string;
}

// ---------------------------------------------------------------------------------------------------------------
// Small helpers (pure)
// ---------------------------------------------------------------------------------------------------------------

const dist = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.z - a.z);
const point = (p: Vec2, extra?: Omit<TripPoint, 'x' | 'z'>): TripPoint => ({ x: p.x, z: p.z, ...extra });

/** Seconds of the pelican trip over a straight distance (game/fastTravel.ts phases + the typical hold). */
export function flySeconds(d: number): number {
  const f = FLY_TIMING;
  return f.pickup + f.rise + Math.min(f.panMax, Math.max(f.panMin, d / f.panSpeed)) + f.hold + f.descent;
}

/** A leg length: the known route, else straight × 1.25 (estimate). `null` when the lookup says there is no route. */
function measure(lookup: RouteLookup | undefined, a: Vec2, b: Vec2, request: boolean): { length: number; path?: number[]; estimate: boolean } | null {
  const straight = dist(a, b);
  if (straight < LEG_MIN) return { length: straight, estimate: false };
  const r = lookup?.(a, b, request);
  if (r === null) return null;
  if (r && Number.isFinite(r.length)) return { length: Math.max(straight, r.length), path: r.path, estimate: false };
  return { length: straight * STREET_FACTOR, estimate: true };
}

function walkLeg(via: 'walk' | 'run', from: TripPoint, to: TripPoint, m: { length: number; path?: number[]; estimate: boolean }): TripWalkLeg {
  const leg: TripWalkLeg = { via, from, to, seconds: m.length / TRIP_SPEED[via], length: m.length };
  if (m.path) leg.path = m.path;
  if (m.estimate) leg.estimate = true;
  const name = to.name;
  if (name) leg.label = via === 'run' ? { zh: `跑到${name.zh}`, en: `Run to ${name.en}` } : { zh: `步行到${name.zh}`, en: `Walk to ${name.en}` };
  return leg;
}

/** Travel distance along a line from arc a to arc b in direction dir (loops wrap forward). */
export function arcSpan(line: Pick<TripLineInfo, 'length' | 'loop'>, a: number, b: number, dir: 1 | -1): number {
  if (line.loop) return ((b - a) % line.length + line.length) % line.length;
  return dir > 0 ? b - a : a - b;
}

/** The arc intervals [s, e] (s < e, unwrapped) a ride covers; a loop ride across the seam gives two. */
function rideIntervals(line: Pick<TripLineInfo, 'length' | 'loop'>, a: number, b: number, dir: 1 | -1): [number, number][] {
  if (line.loop) return b >= a ? [[a, b]] : [[a, line.length], [0, b]];
  return dir > 0 ? [[a, b]] : [[b, a]];
}

/** Length of the ride inside tunnel spans (u). */
export function tunnelLength(line: Pick<TripLineInfo, 'length' | 'loop' | 'tunnels'>, a: number, b: number, dir: 1 | -1): number {
  let sum = 0;
  for (const [s, e] of rideIntervals(line, a, b, dir)) {
    for (const t of line.tunnels ?? []) sum += Math.max(0, Math.min(e, t.toAt) - Math.max(s, t.fromAt));
  }
  return sum;
}

/** The stops strictly between boarding and alighting, in travel order. */
export function stopsBetween(line: Pick<TripLineInfo, 'length' | 'loop' | 'stops'>, board: TripLineStop, alight: TripLineStop, dir: 1 | -1): TripLineStop[] {
  const span = arcSpan(line, board.at, alight.at, dir);
  const out: { s: TripLineStop; k: number }[] = [];
  for (const s of line.stops) {
    if (s.id === board.id || s.id === alight.id) continue;
    const k = arcSpan(line, board.at, s.at, dir);
    if (k > 1e-6 && k < span - 1e-6 && (line.loop || (dir > 0 ? s.at > board.at && s.at < alight.at : s.at < board.at && s.at > alight.at))) out.push({ s, k });
  }
  return out.sort((p, q) => p.k - q.k).map(p => p.s);
}

const inTunnel = (line: Pick<TripLineInfo, 'tunnels'>, at: number) => (line.tunnels ?? []).some(t => at >= t.fromAt && at <= t.toAt);

/**
 * The kind's ride model board → alight (s): surface arc / speed + tunnel arc / tunnelSpeed + dwell at every halting stop
 * between + speed / accel for pulling away and braking into the last stop, and once more per halt between (a halt
 * costs half of it braking, half accelerating again). Used when the line's system gives no
 * estimate (lane T's systems answer `lineRide` once they run).
 */
export function modelRideSeconds(line: TripLineInfo, board: TripLineStop, alight: TripLineStop, dir: 1 | -1): number {
  const m = LINE_MODELS[line.kind];
  const span = arcSpan(line, board.at, alight.at, dir);
  const under = m.tunnelSpeed ? Math.min(span, tunnelLength(line, board.at, alight.at, dir)) : 0;
  let t = (span - under) / m.speed + (under > 0 ? under / m.tunnelSpeed! : 0);
  let halts = 1;
  for (const s of stopsBetween(line, board, alight, dir)) {
    const underground = m.tunnelSpeed !== undefined && inTunnel(line, s.at);
    if (underground) { t += m.tunnelDwell ?? 0; continue; }
    if (m.haltAt === 'all' || s.major) { t += m.dwell; halts++; }
  }
  return t + (halts * m.speed) / m.accel;
}

/** A slice of the line's path between two arc positions (flat [x, z, …]; wraps for loops); undefined without a path. */
export function linePathSlice(line: TripLineInfo, a: number, b: number, dir: 1 | -1): number[] | undefined {
  const P = line.path;
  if (!P || P.length < 4) return undefined;
  const stride = line.pathStride ?? 3;
  const n = Math.floor(P.length / stride);
  const xs = new Float64Array(n), zs = new Float64Array(n), cum = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = P[i * stride]; zs[i] = P[i * stride + (stride === 3 ? 2 : 1)];
    if (i) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
  }
  const total = cum[n - 1] || 1;
  // arc positions are in the line's own length; the polyline may differ by a little (stubs, resampling): scale
  const k = total / (line.length || total);
  const at = (s: number): [number, number] => {
    const u = Math.min(total, Math.max(0, s * k));
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= u) lo = mid; else hi = mid; }
    const seg = cum[hi] - cum[lo] || 1, f = (u - cum[lo]) / seg;
    return [xs[lo] + (xs[hi] - xs[lo]) * f, zs[lo] + (zs[hi] - zs[lo]) * f];
  };
  const out: number[] = [];
  const push = (x: number, z: number) => { const L = out.length; if (L < 2 || Math.hypot(out[L - 2] - x, out[L - 1] - z) > 0.3) out.push(x, z); };
  for (const [s, e] of rideIntervals(line, a, b, dir)) {
    const seg: [number, number][] = [at(s)];
    for (let i = 0; i < n; i++) { const u = cum[i] / k; if (u > s && u < e) seg.push([xs[i], zs[i]]); }
    seg.push(at(e));
    if (!line.loop && dir < 0) seg.reverse();
    for (const [x, z] of seg) push(x, z);
  }
  return out;
}

/** A name after a CJK verb: a space before Latin ("坐 N 线"), none before CJK ("坐观光巴士"). */
export const zhJoin = (name: string) => (/^[A-Za-z0-9]/.test(name) ? ` ${name}` : name);

/** "约 8 秒" / "约 2 分钟" (the same rounding as the waypoint: game/travel gameSeconds). */
export function tripTimeLabel(seconds: number): Bilingual {
  const s0 = Math.max(0, seconds);
  const s = s0 > 20 ? Math.round(s0 / 5) * 5 : Math.max(1, Math.round(s0));
  if (s < 60) return { zh: `约 ${s} 秒`, en: `~${s}s` };
  const m = Math.max(1, Math.round(s / 60));
  return { zh: `约 ${m} 分钟`, en: `~${m} min` };
}

/** The line's short display name: "观光巴士", "N 线", "叮当车" (+ en). */
export function lineDisplayName(line: Pick<TripLineInfo, 'kind' | 'short' | 'name'>): Bilingual {
  if (line.kind === 'bus') return { zh: '观光巴士', en: 'Sightseeing bus' };
  if (line.kind === 'light-rail' && line.short) return { zh: `${line.short} 线`, en: `${line.short} line` };
  if (line.kind === 'cable-car') return { zh: '叮当车', en: 'Cable car' };
  return line.name;
}

/** One row's words: "步行 约 4 分钟", "观光巴士 2 站 约 3 分钟", "骑车 约 2 分钟", "飞过去 约 6 秒". */
export function optionSummary(o: TripOption, lines?: ReadonlyMap<string, TripLineInfo>): Bilingual {
  const time = tripTimeLabel(o.seconds);
  const ride = o.legs.find((l): l is TripLineLeg => l.via === 'line');
  if (ride) {
    const line = lines?.get(ride.line);
    const name = line ? lineDisplayName(line) : TRIP_MODE_NAMES.line;
    return { zh: `${name.zh} ${ride.stops} 站 ${time.zh}`, en: `${name.en} · ${ride.stops} stop${ride.stops === 1 ? '' : 's'} ${time.en}` };
  }
  const n = TRIP_MODE_NAMES[o.mode];
  return { zh: `${n.zh} ${time.zh}`, en: `${n.en} ${time.en}` };
}

/** Any leg still on the straight × 1.25 estimate (the row shows 计算中…). */
export const optionPending = (o: TripOption) => o.legs.some(l => l.estimate);

/** Seconds left in a trip: the current leg's remaining seconds (default: the whole leg) + every later leg. */
export function tripRemainingSeconds(trip: Pick<TripState, 'legs' | 'leg'>, currentLegLeft?: number): number {
  if (trip.leg >= trip.legs.length) return 0;
  let s = currentLegLeft ?? trip.legs[trip.leg].seconds;
  for (let i = trip.leg + 1; i < trip.legs.length; i++) s += trip.legs[i].seconds;
  return Math.max(0, s);
}

// ---------------------------------------------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------------------------------------------

function onFoot(from: TripPoint, dest: TripDestination, to: TripPoint, p: TripProviders): TripOption[] {
  const m = measure(p.walk, from, dest, true);
  if (!m) return [];
  const walk = walkLeg('walk', from, to, m);
  const out: TripOption[] = [{ mode: 'walk', legs: [walk], seconds: walk.seconds }];
  if (walk.seconds > RUN_AFTER_S) {
    const run = walkLeg('run', from, to, m);
    out.push({ mode: 'run', legs: [run], seconds: run.seconds });
  }
  return out;
}

function driving(kind: 'bike' | 'car', from: TripPoint, dest: TripDestination, to: TripPoint, p: TripProviders): TripOption | null {
  const riding = p.riding?.() === kind;
  let start: TripPoint = from;
  const legs: TripLeg[] = [];
  let mount = 0;
  // a ridden vehicle keeps its own id out of the plan: 'ridden' (the autopilot drives whatever carries the player)
  let vehicle = riding ? 'ridden' : '';
  if (!riding) {
    const near = (p.rideables?.(from, RIDEABLE_R) ?? []).filter(r => r.kind === kind && dist(from, r) <= RIDEABLE_R).sort((a, b) => dist(from, a) - dist(from, b))[0];
    if (!near) return null;
    vehicle = near.id;
    start = point(near, { vehicle: near.id, name: near.name });
    if (dist(from, near) >= LEG_MIN) {
      const m = measure(p.walk, from, near, true);
      if (!m) return null;
      legs.push(walkLeg('walk', from, start, m));
    }
    mount = MOUNT_S;
  }
  const straight = dist(start, dest);
  const r = straight < LEG_MIN ? { length: straight } : p.drive?.(start, dest, kind, true);
  if (r === null) return null;
  const known = !!r && Number.isFinite(r.length);
  const length = known ? Math.max(straight, r!.length) : straight * STREET_FACTOR;
  const end: Vec2 = known && r!.end ? r!.end : dest;
  const tail = dist(end, dest) >= HERE_R;
  const driveTo = tail ? point(end) : to;
  const leg: TripDriveLeg = { via: kind, vehicle, from: start, to: driveTo, seconds: length / TRIP_SPEED[kind] + mount, length };
  if (known && r!.path) leg.path = r!.path;
  if (!known) leg.estimate = true;
  const name = to.name;
  if (name) leg.label = kind === 'bike' ? { zh: `骑车到${name.zh}`, en: `Bike to ${name.en}` } : { zh: `开车到${name.zh}`, en: `Drive to ${name.en}` };
  legs.push(leg);
  if (tail) {
    const m = measure(p.walk, end, dest, true);
    legs.push(walkLeg('walk', point(end), to, m ?? { length: dist(end, dest) * STREET_FACTOR, estimate: true }));
  }
  return { mode: kind, legs, seconds: legs.reduce((s, l) => s + l.seconds, 0) };
}

interface LineCandidate { line: TripLineInfo; board: TripLineStop; alight: TripLineStop; dir: 1 | -1; seconds: number }

function lineOptions(from: TripPoint, dest: TripDestination, to: TripPoint, p: TripProviders): TripOption[] {
  const lines = p.lines?.() ?? [];
  const best: LineCandidate[] = [];
  // walking cost to a stop for comparing candidates: a peek at a known route, else the estimate (no A* requests)
  const peek = (a: Vec2, b: Vec2) => measure(p.walk, a, b, false);
  // walking the whole way (known route or estimate; unreachable on foot = any ride is worth it)
  const direct = peek(from, dest);
  const walkAll = direct ? direct.length / TRIP_SPEED.walk : Infinity;
  for (const line of lines) {
    if (line.stops.length < 2) continue;
    const near = (q: Vec2) => line.stops
      .filter(s => dist(q, s) * STREET_FACTOR <= LINE_WALK_MAX)
      .map(s => ({ s, m: peek(q, s) }))
      .filter((e): e is { s: TripLineStop; m: NonNullable<ReturnType<typeof peek>> } => !!e.m && (e.m.estimate || e.m.length <= LINE_WALK_CAP));
    const boards = near(from), alights = near(dest);
    let top: LineCandidate | null = null;
    for (const b of boards) {
      for (const a of alights) {
        if (a.s.id === b.s.id) continue;
        const dirs: (1 | -1)[] = line.loop || line.oneWay ? [1] : [a.s.at > b.s.at ? 1 : -1];
        for (const dir of dirs) {
          if (!line.loop && (dir > 0 ? a.s.at <= b.s.at : a.s.at >= b.s.at)) continue;
          const ride = rideSeconds(line, b.s, a.s, dir, p);
          const wait = waitSeconds(line, b.s, dir, p);
          const seconds = b.m.length / TRIP_SPEED.walk + wait + ride + ALIGHT_S + a.m.length / TRIP_SPEED.walk;
          if (!top || seconds < top.seconds) top = { line, board: b.s, alight: a.s, dir, seconds };
        }
      }
    }
    // a ride that saves nothing over walking straight there is not a way to go
    if (top && top.seconds < walkAll) best.push(top);
  }
  // lines sharing a track and its stations (N and M under Market St) give the same ride: one row, the faster
  const seen = new Set<string>();
  const rows = best.sort((a, b) => a.seconds - b.seconds).filter(c => { const k = `${c.board.id}>${c.alight.id}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return rows.map(c => lineOption(c, from, dest, to, p)).filter((o): o is TripOption => !!o);
}

function waitSeconds(line: TripLineInfo, stop: TripLineStop, dir: 1 | -1, p: TripProviders): number {
  const w = p.lineWait?.(line.id, stop.id, dir);
  return typeof w === 'number' && Number.isFinite(w) && w >= 0 ? w : LINE_MODELS[line.kind].wait;
}

function rideSeconds(line: TripLineInfo, board: TripLineStop, alight: TripLineStop, dir: 1 | -1, p: TripProviders): number {
  const r = p.lineRide?.(line.id, board.id, alight.id, dir);
  return typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : modelRideSeconds(line, board, alight, dir);
}

function lineOption(c: LineCandidate, from: TripPoint, dest: TripDestination, to: TripPoint, p: TripProviders): TripOption | null {
  const { line, board, alight, dir } = c;
  const legs: TripLeg[] = [];
  const boardPt = point(board, { station: board.id, name: board.name });
  const alightPt = point(alight, { station: alight.id, name: alight.name });
  if (dist(from, board) >= LEG_MIN) {
    const m = measure(p.walk, from, board, true);
    if (!m) return null;
    legs.push(walkLeg('walk', from, boardPt, m));
  }
  const wait = waitSeconds(line, board, dir, p);
  const ride = rideSeconds(line, board, alight, dir, p);
  const between = stopsBetween(line, board, alight, dir);
  const span = arcSpan(line, board.at, alight.at, dir);
  const leg: TripLineLeg = {
    via: 'line', line: line.id, board: board.id, alight: alight.id, wait, stops: between.length + 1, dir,
    from: boardPt, to: alightPt, seconds: wait + ride + ALIGHT_S, length: span,
  };
  if (tunnelLength(line, board.at, alight.at, dir) > 0) leg.underground = true;
  const path = linePathSlice(line, board.at, alight.at, dir);
  if (path) leg.path = path;
  const name = lineDisplayName(line);
  const stopName = alight.name;
  const rideZh = `坐${zhJoin(name.zh)} ${leg.stops} 站`;
  leg.label = stopName
    ? { zh: `${rideZh}到${stopName.zh}`, en: `${name.en} ${leg.stops} stop${leg.stops === 1 ? '' : 's'} to ${stopName.en}` }
    : { zh: rideZh, en: `${name.en} · ${leg.stops} stop${leg.stops === 1 ? '' : 's'}` };
  legs.push(leg);
  if (dist(alight, dest) >= LEG_MIN) {
    const m = measure(p.walk, alight, dest, true);
    if (!m) return null;
    legs.push(walkLeg('walk', alightPt, to, m));
  }
  return { mode: 'line', legs, seconds: legs.reduce((s, l) => s + l.seconds, 0) };
}

function flying(from: TripPoint, dest: TripDestination, to: TripPoint, p: TripProviders): TripOption | null {
  if (!p.discovered?.(dest.placeId)) return null;
  const d = dist(from, dest);
  const leg: TripFlyLeg = { via: 'fly', place: dest.placeId, from, to, seconds: flySeconds(d), length: d };
  if (dest.name) leg.label = { zh: `飞到${dest.name.zh}`, en: `Fly to ${dest.name.en}` };
  return { mode: 'fly', legs: [leg], seconds: leg.seconds, note: FLY_NOTE };
}

/** The fly row's caveat: fast travel never counts for the climb / ride goals. */
export const FLY_NOTE: Bilingual = { zh: '不算登顶 / 骑行成就', en: "Doesn't count for climbing or riding goals" };

const modeRank = (m: TripMode) => TRIP_MODES.indexOf(m);
const bySeconds = (a: TripOption, b: TripOption) => a.seconds - b.seconds || modeRank(a.mode) - modeRank(b.mode);

/**
 * Every honest way from `from` to the destination, fastest first, at most MAX_OPTIONS, exactly one `recommended`
 * (unless the list is empty: the destination is within HERE_R, or nothing reaches it).
 */
export function planTrips(from: Vec2 | TripPoint, dest: TripDestination, providers: TripProviders = {}): TripOption[] {
  const start: TripPoint = { ...from };
  if (dist(start, dest) < HERE_R) return [];
  const to = point(dest, { place: dest.placeId, ...(dest.name ? { name: dest.name } : {}) });
  const all: TripOption[] = [...onFoot(start, dest, to, providers)];
  for (const kind of ['bike', 'car'] as const) { const o = driving(kind, start, dest, to, providers); if (o) all.push(o); }
  all.push(...lineOptions(start, dest, to, providers));
  const fly = flying(start, dest, to, providers);
  if (fly) all.push(fly);
  // keep the best line option per line only (several lines: each its own row), then sort
  all.sort(bySeconds);
  if (!all.length) return [];
  // goals: tag every option that completes one; 推荐 = the fastest non-fly, or the fastest goal option within the slack
  const lineMap = new Map((providers.lines?.() ?? []).map(l => [l.id, l] as const));
  for (const o of all) {
    if (o.mode === 'fly') continue;
    const rule = (providers.goals ?? []).find(g => g.test(o, dest, lineMap));
    if (rule) { o.goal = rule.goal; o.note = rule.note; }
  }
  const nonFly = all.filter(o => o.mode !== 'fly');
  let rec: TripOption | undefined = nonFly[0];
  const goalOpt = nonFly.find(o => o.goal);
  if (rec && goalOpt && goalOpt !== rec && goalOpt.seconds <= rec.seconds * GOAL_SLACK.k + GOAL_SLACK.s) rec = goalOpt;
  if (!rec) rec = all[0];
  rec.recommended = true;
  // at most MAX_OPTIONS rows, never without the recommended one
  let list = all;
  if (list.length > MAX_OPTIONS) {
    list = list.slice(0, MAX_OPTIONS);
    if (!list.includes(rec)) list = [...list.slice(0, MAX_OPTIONS - 1), rec].sort(bySeconds);
  }
  return list;
}

// ---------------------------------------------------------------------------------------------------------------
// Goal rules (lane C passes the open ones; ids are data/sf/goals.ts CITY_GOAL / wave-4 goal ids)
// ---------------------------------------------------------------------------------------------------------------

const lineLegs = (o: TripOption) => o.legs.filter((l): l is TripLineLeg => l.via === 'line');

/** 'cable-car': a cable-car ride of at least `minLength` u (lane F counts a ride from RIDE_MIN_ODOMETER = 150). */
export function cableCarGoalRule(goal = 'cable-car', minLength = 150): TripGoalRule {
  return {
    goal,
    note: { zh: '顺便完成叮当车目标', en: 'Also completes the cable-car goal' },
    test: (o, _d, lines) => lineLegs(o).some(l => lines.get(l.line)?.kind === 'cable-car' && l.length >= minLength),
  };
}

/** A goal reached by getting to one of `places` yourself (twin-peaks: on foot, by bike or car; never flying or riding a line). */
export function arriveYourselfGoalRule(goal: string, places: readonly string[], note: Bilingual): TripGoalRule {
  return { goal, note, test: (o, d) => places.includes(d.placeId) && o.legs.every(l => l.via !== 'fly' && l.via !== 'line') };
}

/**
 * A ride goal on given lines: at least `minLength` u (and `minStops` stops) on one of `lines`, optionally only when it
 * gets off at one of `alightAt` (metro: N to Judah & La Playa, M to 19th & Winston / Holloway; sightseeing: 8 loop stops).
 */
export function lineRideGoalRule(goal: string, lineIds: readonly string[], note: Bilingual, opts: { minLength?: number; minStops?: number; alightAt?: readonly string[] } = {}): TripGoalRule {
  const { minLength = 150, minStops = 1, alightAt } = opts;
  return {
    goal,
    note,
    test: o => lineLegs(o).some(l => lineIds.includes(l.line) && l.length >= minLength && l.stops >= minStops && (!alightAt || alightAt.includes(l.alight))),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Route cache: the async routers → the planner's synchronous lookups
// ---------------------------------------------------------------------------------------------------------------

export interface TripRouteCacheOptions {
  /** actors/nav routeTo adapted to a RouteAnswer (null = no route) */
  walk?: (from: Vec2, to: Vec2) => Promise<RouteAnswer | null>;
  /** actors/vehicles/driveRoute adapted to a DriveAnswer */
  drive?: (from: Vec2, to: Vec2, kind: 'bike' | 'car') => Promise<DriveAnswer | null>;
  /** positions are rounded to this grid for the cache key (u) */
  quantum?: number;
  /** remembered answers (LRU) */
  capacity?: number;
  /** at most this many route searches at once; later requests queue */
  concurrency?: number;
}

type Entry = { state: 'pending' } | { state: 'done'; value: RouteAnswer | DriveAnswer | null };
/** a router's answer, checked: a non-finite / negative length is "no route" */
const sane = (v: RouteAnswer | DriveAnswer | null | undefined): RouteAnswer | DriveAnswer | null => (v && Number.isFinite(v.length) && v.length >= 0 ? v : null);

/**
 * Wraps the asynchronous routers for the planner. `walk(a, b)` / `drive(a, b, kind)` answer synchronously from the
 * cache: the answer, null (no route), or undefined while unknown — a request (the default) then starts the search
 * (queued, at most `concurrency` at once) and `subscribe` listeners hear when it lands, so the UI calls planTrips again.
 * A failed search (a rejected promise) is remembered as "unknown" for this cache's life: the estimate stays.
 */
export class TripRouteCache {
  private readonly map = new Map<string, Entry>();
  /** searches that failed (a rejected promise): never retried by this cache, the estimate stays */
  private readonly failed = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private readonly queue: (() => Promise<void>)[] = [];
  private running = 0;
  private waiters: (() => void)[] = [];
  private readonly q: number;
  private readonly cap: number;
  private readonly conc: number;
  private readonly opts: TripRouteCacheOptions;
  constructor(opts: TripRouteCacheOptions) {
    this.opts = opts;
    this.q = opts.quantum ?? 1;
    this.cap = opts.capacity ?? 96;
    this.conc = Math.max(1, opts.concurrency ?? 2);
  }

  readonly walk: RouteLookup = (from, to, request = true) => {
    const router = this.opts.walk;
    return router ? this.lookup(`w|${this.key(from)}|${this.key(to)}`, request, () => router(from, to)) : undefined;
  };
  readonly drive: DriveLookup = (from, to, kind, request = true) => {
    const router = this.opts.drive;
    return router ? this.lookup(`${kind}|${this.key(from)}|${this.key(to)}`, request, () => router(from, to, kind)) as DriveAnswer | null | undefined : undefined;
  };

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  /** searches running or queued */
  pending(): number { let n = 0; for (const e of this.map.values()) if (e.state === 'pending') n++; return n; }
  /** resolves once nothing is pending (tests, QA) */
  idle(): Promise<void> { return this.pending() === 0 ? Promise.resolve() : new Promise(res => { this.waiters.push(res); }); }
  clear() { this.map.clear(); }

  private key(p: Vec2) { return `${Math.round(p.x / this.q)},${Math.round(p.z / this.q)}`; }

  private lookup(key: string, request: boolean, start: () => Promise<RouteAnswer | DriveAnswer | null>): RouteAnswer | DriveAnswer | null | undefined {
    const e = this.map.get(key);
    if (e) {
      // LRU: a hit moves to the back
      if (e.state === 'done') { this.map.delete(key); this.map.set(key, e); return e.value; }
      return undefined;
    }
    if (!request || this.failed.has(key)) return undefined;
    const job = () => {
      let p: Promise<RouteAnswer | DriveAnswer | null>;
      try { p = Promise.resolve(start()); } catch (error) { p = Promise.reject(error); }
      return p.then(value => { this.map.set(key, { state: 'done', value: sane(value) }); this.trim(); }, () => { this.map.delete(key); this.failed.add(key); });
    };
    this.map.set(key, { state: 'pending' });
    this.queue.push(job);
    this.pump();
    return undefined;
  }

  private pump() {
    while (this.running < this.conc && this.queue.length) {
      const job = this.queue.shift()!;
      this.running++;
      void job().finally(() => {
        this.running--;
        for (const fn of [...this.listeners]) { try { fn(); } catch { /* a listener's own problem */ } }
        this.pump();
        if (this.pending() === 0) { const w = this.waiters; this.waiters = []; for (const res of w) res(); }
      });
    }
  }

  private trim() {
    let over = 0;
    for (const e of this.map.values()) if (e.state === 'done') over++;
    over -= this.cap;
    for (const [k, e] of this.map) { if (over <= 0) break; if (e.state === 'done') { this.map.delete(k); over--; } }
  }
}
