import { platformStop } from '../../actors/platform';
import type { Bilingual, Vec2 } from '../../core/types';
import { ALCA_BACK, ALCA_CROSSING, ALCA_FERRY_ID, ALCA_OUT, ALCA_PIVOT, ALCA_TERMINALS, FERRY } from '../../data/ferry';
import type { CarPose, RideStatus, RiderRequest } from '../transitLine';
import { ALCA_LINES } from './alcatrazLines';

/**
 * Wave 8 · lane A · the toy Alcatraz ferry, Pier 33 (Alcatraz Landing) ⇄ the island's dock. PURE (no three.js, no
 * store): world/sf/alcatrazFerry.ts draws it and publishes its platform; node tests drive it with a pinned Bay clock.
 *
 * One boat (the city ferry's hull with its open sun deck, a navy stripe), a shuttle of its own rather than a loop: it
 * lies in Pier 33's slip bow toward the shore (the slip is 8–18 u wide, no room to turn), backs out past the pier
 * heads, pivots, waits for the waterfront's ferry tracks to be clear (the rideable Ferry Building ferry, the ambient
 * crossing ferry and the sailboats: it gives way, never the other way round), crosses them on the slip's axis to a lane
 * north of all the other boats, runs west to the island, rounds its south-west in a U-turn and lies alongside the float
 * heading east; back along its own return lane, down the slip's axis and into the slip bow first. ≈ 91 s out (13 s
 * astern, 7 s turning, 71 s under way), ≈ 55 s back, 20 s at each end: a boat every ≈ 3 minutes (toy time; the real
 * crossing takes about a quarter of an hour, a boat every half hour).
 *
 * Service (the real Day Tour timetable, Alcatraz City Cruises, summer schedule 8 Mar – 1 Nov 2026, the concessioner's
 * schedule sheet https://statue-static-content.s3.us-east-1.amazonaws.com/Alcatraz+City+Cruises+-+Schedule.pdf, read
 * 2026-09-30): departures from Pier 33 08:40 … 15:50 (about every half hour), return boats 09:35 … 18:30; the island is
 * closed on Thanksgiving, Christmas Day and New Year's Day (https://alcatrazcitycruises.com/faq/, read 2026-09-30). The
 * toy boat shuttles all day inside those hours (a departure every few minutes: a toy cadence on the real day), takes no
 * one out after the last outbound departure, keeps bringing people back until the last return, then rests in its slip
 * (the night tour exists, Tuesday–Saturday: the quay says so, 以官网为准). One exception, so nobody is ever stranded: a
 * rider waiting on the island is always fetched, whatever the hour.
 *
 *   new AlcaFerrySystem({ clock, traffic })   clock = the Bay wall clock (minutes, weekday, date); traffic = the other
 *                                             boats near the waterfront (position + velocity) the crossing gives way to
 *   request / board / cancel / rideStatus     the waiting-rider protocol of data/transit LineRideSystem
 *   serviceNote(station) / waitSeconds / rideSeconds   what the quay's deckhand says (game/transit.ts boardFerry)
 */

export const ALCA = {
  /** cruising speed (u/s) and its accelerations */
  speed: 9.5,
  acc: 1.2,
  dec: 1.4,
  /** lateral acceleration on curves (u/s²) and the slowest a curve limit goes */
  aLat: 1.6,
  vCurveMin: 2.4,
  /** slow ahead into a berth (u/s) within `berthZone` u of it */
  berthSpeed: 2.2,
  berthZone: 20,
  /** astern out of the slip (u/s) and the pivot's turn rate (rad/s) */
  astern: 2.6,
  pivotRate: 0.45,
  /** dwell at a terminal (s); cut to `dwellRider` when a rider waits at the other end */
  dwell: 20,
  dwellRider: 4,
  /**
   * the crossing of the waterfront's ferry tracks (data/ferry ALCA_CROSSING, the slip's axis from the pivot to the lane
   * north of them): no other boat within `clear` u of it now or on its course (straight on at its speed) over the next
   * `secs` s — how long the boat takes from where it waits to the far side
   */
  cross: { clear: 10, secs: 16 },
} as const;

/** Bay wall-clock parts the schedule reads (game/bayNow BayParts). */
export interface AlcaClock { year: number; month: number; day: number; hour: number; minute: number; weekday: number }

/** The day's timetable (minutes after midnight, Bay time). */
export const ALCA_HOURS = { first: 8 * 60 + 40, lastOut: 15 * 60 + 50, lastBack: 18 * 60 + 30 } as const;

export type AlcaServiceState = 'early' | 'day' | 'returns' | 'night' | 'closed';

/** Thanksgiving (the fourth Thursday of November), Christmas Day, New Year's Day: the island is closed. */
export function alcaClosedDay(c: Pick<AlcaClock, 'year' | 'month' | 'day'>): boolean {
  if (c.month === 12 && c.day === 25) return true;
  if (c.month === 1 && c.day === 1) return true;
  if (c.month === 11) {
    const firstDow = new Date(Date.UTC(c.year, 10, 1)).getUTCDay();
    const firstThu = 1 + ((4 - firstDow + 7) % 7);
    if (c.day === firstThu + 21) return true;
  }
  return false;
}

/** Where the day is: before the first boat, Day Tour departures, return boats only, night, or a closed day. */
export function alcaService(c: AlcaClock): AlcaServiceState {
  if (alcaClosedDay(c)) return 'closed';
  const m = c.hour * 60 + c.minute;
  if (m < ALCA_HOURS.first) return 'early';
  if (m < ALCA_HOURS.lastOut) return 'day';
  if (m < ALCA_HOURS.lastBack) return 'returns';
  return 'night';
}

/** The boat shuttles (empty runs included) only in these states; otherwise it rests in its slip unless fetching a rider. */
export const alcaRuns = (s: AlcaServiceState) => s === 'day' || s === 'returns';

/**
 * What the deckhand at a quay says when there is no boat out from it now (fixed lines: no numbers spliced in), or null
 * when a boat can be had. The island always gets null (a rider there is always fetched).
 */
export function alcaServiceNote(station: string, s: AlcaServiceState): Bilingual | null {
  if (station !== ALCA_TERMINALS.pier33.id) return null;
  switch (s) {
    case 'early': return { zh: '小渡轮还没开工。第一班船早上 8:40 开，时间以官网为准。', en: 'The little ferry isn’t running yet. The first boat leaves at 8:40 a.m. Check the official site for times.' };
    case 'returns': return { zh: '今天去岛上的最后一班已经开走了（下午 3:50）。回程船开到傍晚 6:30，时间以官网为准。', en: 'Today’s last boat out to the island has gone (3:50 p.m.). Boats come back until 6:30 p.m. Check the official site for times.' };
    case 'night': return { zh: '小渡轮收工休息啦。恶魔岛还有夜游团（周二到周六），时间和票务以官网为准。', en: 'The little ferry is resting for the night. There’s a night tour of Alcatraz (Tuesday to Saturday): check the official site for times and tickets.' };
    case 'closed': return { zh: '今天恶魔岛闭岛（感恩节、圣诞节和元旦闭岛），以官网为准。', en: 'Alcatraz is closed today (it closes on Thanksgiving, Christmas Day and New Year’s Day). Check the official site.' };
    default: return null;
  }
}

/** Distance from (x, z) to the segment a → b. */
function segDist(x: number, z: number, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)) : 0;
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
}

/**
 * Is the crossing clear: no boat within ALCA.cross.clear u of the crossing's stretch now, nor on its straight course over
 * the next ALCA.cross.secs s (sampled every second)? PURE (tests drive it with made-up traffic).
 */
export function alcaCrossingClear(traffic: readonly AlcaTraffic[]): boolean {
  const [a, b] = ALCA_CROSSING, R = ALCA.cross.clear;
  for (const t of traffic) {
    for (let s = 0; s <= ALCA.cross.secs; s++) if (segDist(t.x + t.vx * s, t.z + t.vz * s, a, b) < R) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------------------------------------------

/** A smoothed open path: samples (x, z pairs), arc length, speed limits. */
export interface AlcaPath { xz: Float32Array; cum: Float32Array; length: number; vlim: Float32Array }

/** Open Catmull-Rom through `src` (the ends mirrored), each segment cut into pieces of ≤ `step` u. */
function catmullOpen(src: readonly Vec2[], step = 2.5): Vec2[] {
  const n = src.length, out: Vec2[] = [];
  const get = (i: number): Vec2 => {
    if (i < 0) return { x: 2 * src[0].x - src[1].x, z: 2 * src[0].z - src[1].z };
    if (i >= n) return { x: 2 * src[n - 1].x - src[n - 2].x, z: 2 * src[n - 1].z - src[n - 2].z };
    return src[i];
  };
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const per = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / step));
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  out.push({ ...src[n - 1] });
  return out;
}

export function buildAlcaPath(src: readonly Vec2[], ends: { slowStart: boolean; slowEnd: boolean } = { slowStart: false, slowEnd: true }): AlcaPath {
  const pts = catmullOpen(src);
  const n = pts.length;
  const xz = new Float32Array(n * 2), cum = new Float32Array(n);
  pts.forEach((p, i) => { xz[i * 2] = p.x; xz[i * 2 + 1] = p.z; if (i) cum[i] = cum[i - 1] + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); });
  const length = cum[n - 1];
  const path: AlcaPath = { xz, cum, length, vlim: new Float32Array(n) };
  const half = FERRY.length / 2;
  for (let i = 0; i < n; i++) {
    const a = alcaPoint(path, cum[i] - half), b = alcaPoint(path, cum[i] + half);
    const p = alcaPoint(path, cum[i]);
    let dh = Math.atan2(b.x - p.x, b.z - p.z) - Math.atan2(p.x - a.x, p.z - a.z);
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const k = Math.abs(dh) / FERRY.length;
    let v = k > 1e-4 ? Math.max(ALCA.vCurveMin, Math.min(ALCA.speed, Math.sqrt(ALCA.aLat / k))) : ALCA.speed;
    const toEnd = length - cum[i], fromStart = cum[i];
    if (ends.slowEnd && toEnd < ALCA.berthZone) v = Math.min(v, ALCA.berthSpeed + (ALCA.speed - ALCA.berthSpeed) * (toEnd / ALCA.berthZone) ** 2);
    if (ends.slowStart && fromStart < ALCA.berthZone) v = Math.min(v, ALCA.berthSpeed + (ALCA.speed - ALCA.berthSpeed) * (fromStart / ALCA.berthZone) ** 2);
    path.vlim[i] = v;
  }
  return path;
}

/** Point on a path at arc length s (clamped): position, heading of travel, sample index. */
export function alcaPoint(path: Pick<AlcaPath, 'xz' | 'cum' | 'length'>, s: number): { x: number; z: number; heading: number; i: number } {
  const cum = path.cum, a = path.xz, n = cum.length;
  const ss = Math.max(0, Math.min(path.length, s));
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= ss) lo = mid; else hi = mid; }
  const j = Math.min(n - 1, lo + 1), t = (ss - cum[lo]) / (cum[j] - cum[lo] || 1);
  return { x: a[lo * 2] + (a[j * 2] - a[lo * 2]) * t, z: a[lo * 2 + 1] + (a[j * 2 + 1] - a[lo * 2 + 1]) * t, heading: Math.atan2(a[j * 2] - a[lo * 2], a[j * 2 + 1] - a[lo * 2 + 1]), i: lo };
}

/** The three paths: out (pivot → island), back (island → the slip berth), astern (the berth → the pivot, straight). */
export const ALCA_FERRY_PATHS = {
  out: buildAlcaPath(ALCA_OUT, { slowStart: false, slowEnd: true }),
  back: buildAlcaPath(ALCA_BACK, { slowStart: true, slowEnd: true }),
  astern: buildAlcaPath([ALCA_TERMINALS.pier33.berth, ALCA_PIVOT], { slowStart: false, slowEnd: false }),
};
/** the boat's heading lying in the slip (bow toward the shore: the reverse of the astern path) */
export const ALCA_SLIP_HEADING = Math.atan2(ALCA_TERMINALS.pier33.berth.x - ALCA_PIVOT.x, ALCA_TERMINALS.pier33.berth.z - ALCA_PIVOT.z);
/** where the return path waits for the crossing to be clear (before it turns south across the tracks) */
export const ALCA_BACK_HOLD = (() => {
  const p = ALCA_FERRY_PATHS.back, want = { x: -146, z: -119 };
  let best = 0, bd = Infinity;
  for (let i = 0; i < p.cum.length; i++) { const d = Math.hypot(p.xz[i * 2] - want.x, p.xz[i * 2 + 1] - want.z); if (d < bd) { bd = d; best = i; } }
  return p.cum[best];
})();

/**
 * Seconds a leg takes with no hold (measured with the system: tests/opus-bay-w8-a-ferry checks them within 10 %): astern
 * out of the slip, the pivot, the outbound run, the return run.
 */
export function alcaLegSeconds(leg: 'astern' | 'pivot' | 'out' | 'back'): number {
  const P = ALCA_FERRY_PATHS;
  switch (leg) {
    case 'astern': return P.astern.length / 2.25;
    case 'pivot': return 7;
    case 'out': return P.out.length / 7.84;
    case 'back': return P.back.length / 7.59;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The system
// ---------------------------------------------------------------------------------------------------------------

export type AlcaLeg = 'dwell33' | 'astern' | 'pivot' | 'out' | 'dwellI' | 'back';
export interface AlcaBoat {
  leg: AlcaLeg;
  /** arc length along the leg's path */
  s: number;
  v: number;
  /** dwell timer (s) */
  timer: number;
  rider: boolean;
  /** terminal ids of the rider's pickup / drop-off ('' = none) */
  pickup: string;
  dropoff: string;
  odometer: number;
  arrivals: number;
  /** the crossing held the boat this long (s, the current hold) */
  held: number;
  pose: CarPose;
}
export interface AlcaTraffic { x: number; z: number; vx: number; vz: number }
export type AlcaEventWhat = 'arrive' | 'depart' | 'board';
export interface AlcaEvent { what: AlcaEventWhat; station: string | null }

export interface AlcaOptions {
  /** the Bay wall clock now (game/bayNow bayParts) */
  clock: () => AlcaClock;
  /** the other boats the crossing gives way to (default none) */
  traffic?: () => readonly AlcaTraffic[];
  /** the hop-off / pause brake on the ride line (default actors/platform platformStop) */
  brake?: () => boolean;
}

const P33: string = ALCA_TERMINALS.pier33.id, ISL: string = ALCA_TERMINALS.island.id;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class AlcaFerrySystem {
  readonly cars: AlcaBoat[];
  readonly events: AlcaEvent[] = [];
  private status: RideStatus | null = null;
  private heading = ALCA_SLIP_HEADING;
  private readonly opts: AlcaOptions;
  time = 0;
  /** QA: how long the crossing has held the boat in all (s) */
  heldTotal = 0;

  constructor(opts: AlcaOptions) {
    this.opts = opts;
    const b: AlcaBoat = { leg: 'dwell33', s: 0, v: 0, timer: ALCA.dwell, rider: false, pickup: '', dropoff: '', odometer: 0, arrivals: 0, held: 0, pose: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 } };
    this.cars = [b];
    this.updatePose(b, 0);
  }

  get boat(): AlcaBoat { return this.cars[0]; }
  /** the terminal the boat lies at, or null */
  get docked(): string | null { const l = this.boat.leg; return l === 'dwell33' ? P33 : l === 'dwellI' ? ISL : null; }
  serviceState(): AlcaServiceState { return alcaService(this.opts.clock()); }

  // --- the deckhand's questions -------------------------------------------------------------------------------

  /** A note instead of a ride from `station` now (the timetable), or null. */
  serviceNote(station: string): Bilingual | null { return alcaServiceNote(station, this.serviceState()); }

  /** BAYBAY's fixed lines on boarding and stepping ashore (game/transit.ts asks a ferry line's own system). */
  boardLine(): Bilingual { return ALCA_LINES.board; }
  offLine(to: string): Bilingual { return to === ISL ? ALCA_LINES.ashore : ALCA_LINES.backAt33; }

  /** Seconds until the boat can take a rider waiting at `station` (0 when it lies there). */
  waitSeconds(station: string): number { return this.eta(station); }

  /** Seconds of the ride itself from `from` to `to` (casting off, the crossing, berthing; measured: ≈ 95 s out, 59 s back). */
  rideSeconds(from: string, to: string): number {
    if (from === to) return 0;
    return (from === P33 ? alcaLegSeconds('astern') + alcaLegSeconds('pivot') + alcaLegSeconds('out') : alcaLegSeconds('back')) + 4;
  }

  /** Rough seconds until the boat stands at terminal `target` (from where it is now). */
  eta(target: string): number {
    const b = this.boat, P = ALCA_FERRY_PATHS, L = alcaLegSeconds;
    const outT = L('astern') + L('pivot') + L('out'), backT = L('back');
    const dwellRest = (b.leg === 'dwell33' || b.leg === 'dwellI') ? Math.max(0, b.timer) : 0;
    const quick = ALCA.dwellRider;
    const left = (leg: 'astern' | 'out' | 'back') => L(leg) * Math.max(0, 1 - b.s / P[leg].length);
    switch (b.leg) {
      case 'dwell33': return target === P33 ? 0 : Math.min(dwellRest, quick) + outT;
      case 'dwellI': return target === ISL ? 0 : Math.min(dwellRest, quick) + backT;
      case 'astern': { const rest = left('astern') + L('pivot') + L('out'); return target === ISL ? rest : rest + quick + backT; }
      case 'pivot': { const rest = L('pivot') / 2 + L('out'); return target === ISL ? rest : rest + quick + backT; }
      case 'out': { const rest = left('out'); return target === ISL ? rest : rest + quick + backT; }
      case 'back': { const rest = left('back'); return target === P33 ? rest : rest + quick + outT; }
    }
    return 0;
  }

  // --- the rider protocol (data/transit LineRideSystem) ---------------------------------------------------------

  request(req: RiderRequest): RideStatus | null {
    this.cancel();
    if (req.station === req.to || ![P33, ISL].includes(req.station) || ![P33, ISL].includes(req.to)) return null;
    // no boat out after the timetable's last departure (the island is always fetched: nobody is stranded)
    if (this.serviceNote(req.station)) return null;
    const b = this.boat;
    b.pickup = req.station; b.dropoff = req.to;
    this.status = { line: ALCA_FERRY_ID, car: 0, phase: 'coming', eta: this.eta(req.station), station: null, arrivals: 0, lastStation: null, odometer: 0, turning: false, braking: false };
    const here = this.docked;
    if (here === req.station) this.markHere();
    else if (here) b.timer = Math.min(b.timer, ALCA.dwellRider);
    return this.status;
  }

  private markHere() {
    if (!this.status) return;
    this.status.phase = 'here';
    this.status.station = this.docked;
    this.boat.timer = Math.max(this.boat.timer, 5);
  }

  board() {
    const b = this.boat;
    if (!this.status) return;
    b.rider = true; b.pickup = ''; b.odometer = 0; b.arrivals = 0;
    b.timer = Math.max(b.timer, 4);
    this.status.phase = 'riding';
    this.events.push({ what: 'board', station: this.docked });
  }

  cancel() {
    const b = this.boat;
    b.rider = false; b.pickup = ''; b.dropoff = '';
    this.status = null;
  }

  rideStatus(): RideStatus | null { return this.status; }
  /** seconds to the rider's stop from the boat's real progress (game/transit rideEta) */
  rideLeft(): number | null { const st = this.status; return st && this.boat.dropoff ? this.eta(this.boat.dropoff) : null; }

  // --- motion ---------------------------------------------------------------------------------------------------

  /** Is the crossing of the waterfront's ferry tracks clear of the other boats (none near, none coming)? */
  crossingClear(): boolean {
    return alcaCrossingClear(this.opts.traffic?.() ?? []);
  }

  private braking(): boolean { return this.opts.brake ? this.opts.brake() : platformStop(ALCA_FERRY_ID) !== null; }

  /** Will the boat cast off from where it lies (a rider, a fetch, the timetable)? */
  private wantsToGo(at: string): boolean {
    const b = this.boat;
    if (at === ISL) return true; // never rests at the island
    if (b.rider && b.dropoff === ISL) return true;
    if (b.pickup === ISL) return true;
    return alcaRuns(this.serviceState());
  }

  step(dt: number) {
    if (dt <= 0) return;
    this.time += dt;
    const b = this.boat, P = ALCA_FERRY_PATHS;
    const brake = this.braking() && (b.rider || this.status?.phase === 'riding');
    switch (b.leg) {
      case 'dwell33':
      case 'dwellI': {
        b.v = 0;
        b.timer -= dt;
        const at = b.leg === 'dwell33' ? P33 : ISL;
        const holding = this.status?.phase === 'here' || (b.rider && brake);
        if (b.timer <= 0 && !holding && this.wantsToGo(at)) {
          b.leg = b.leg === 'dwell33' ? 'astern' : 'back';
          b.s = 0; b.v = 0;
          this.events.push({ what: 'depart', station: at });
          if (this.status) this.status.station = null;
        } else if (b.timer <= 0) b.timer = 0.3;
        break;
      }
      case 'astern': {
        const left = P.astern.length - b.s;
        const limit = brake ? 0 : Math.min(ALCA.astern, Math.sqrt(2 * ALCA.dec * Math.max(0, left)));
        this.drive(b, limit, dt);
        const step = Math.min(left, b.v * dt);
        b.s += step;
        if (b.rider) b.odometer += step;
        if (left - step < 0.03) { b.leg = 'pivot'; b.s = 0; b.v = 0; }
        break;
      }
      case 'pivot': {
        const want = alcaPoint(P.out, 1.5).heading;
        const dh = wrap(want - this.heading);
        if (!brake) this.heading += Math.sign(dh) * Math.min(Math.abs(dh), ALCA.pivotRate * dt);
        if (Math.abs(wrap(want - this.heading)) < 0.01) { this.heading = want; b.leg = 'out'; b.s = 0; b.v = 0; }
        break;
      }
      case 'out':
      case 'back': {
        const path = b.leg === 'out' ? P.out : P.back;
        const left = path.length - b.s;
        let limit = Math.sqrt(2 * ALCA.dec * Math.max(0, left));
        const i0 = alcaPoint(path, b.s).i, n = path.vlim.length;
        limit = Math.min(limit, path.vlim[i0], path.vlim[Math.min(n - 1, i0 + 1)]);
        const reach = (b.v * b.v) / (2 * ALCA.dec) + 6;
        for (let i = i0; i < n; i++) {
          const d = path.cum[i] - b.s;
          if (d > reach) break;
          limit = Math.min(limit, Math.sqrt(path.vlim[i] * path.vlim[i] + 2 * ALCA.dec * Math.max(0, d - 3)));
        }
        // the crossing: out waits at its start (after the pivot), back before it turns south across the tracks
        const holdAt = b.leg === 'out' ? 0 : ALCA_BACK_HOLD;
        if (b.s <= holdAt + 0.05 && !this.crossingClear()) {
          limit = Math.min(limit, Math.sqrt(2 * ALCA.dec * Math.max(0, holdAt - b.s)));
          b.held += dt; this.heldTotal += dt;
        } else if (b.s > holdAt + 0.05) b.held = 0;
        if (brake) limit = 0;
        this.drive(b, limit, dt);
        const step = Math.min(left, b.v * dt);
        b.s += step;
        if (b.rider) b.odometer += step;
        if (left - step < 0.03) this.arrive(b.leg === 'out' ? ISL : P33);
        break;
      }
    }
    this.updatePose(b, dt);
    const st = this.status;
    if (st) {
      st.odometer = b.odometer;
      st.station = this.docked;
      st.braking = brake && b.v > 0.05;
      if (st.phase === 'coming' && b.pickup) st.eta = this.eta(b.pickup);
    }
  }

  private drive(b: AlcaBoat, limit: number, dt: number) {
    b.v = b.v < limit ? Math.min(limit, b.v + ALCA.acc * dt) : Math.max(limit, b.v - ALCA.dec * 1.5 * dt);
  }

  private arrive(at: string) {
    const b = this.boat;
    b.leg = at === P33 ? 'dwell33' : 'dwellI';
    b.s = 0; b.v = 0;
    const waitingOther = this.status?.phase === 'coming' && b.pickup !== '' && b.pickup !== at;
    b.timer = waitingOther ? ALCA.dwellRider : ALCA.dwell;
    if (b.rider) b.arrivals++;
    this.events.push({ what: 'arrive', station: at });
    const status = this.status;
    if (!status) return;
    if (!b.rider && b.pickup === at) this.markHere();
    if (b.rider) {
      status.lastStation = at;
      status.arrivals = b.arrivals;
      if (b.dropoff === at) { status.phase = 'arrived'; b.timer = Math.max(b.timer, 4); }
    }
  }

  /** Pose: on the leg's path (astern: bow toward the slip's shore), the heading eased, a gentle roll and bob. */
  private updatePose(b: AlcaBoat, dt: number) {
    const P = ALCA_FERRY_PATHS;
    let x: number, z: number, want: number | null = null;
    switch (b.leg) {
      case 'dwell33': { const p = ALCA_TERMINALS.pier33.berth; x = p.x; z = p.z; want = ALCA_SLIP_HEADING; break; }
      case 'dwellI': { const p = alcaPoint(P.out, P.out.length); x = p.x; z = p.z; want = alcaPoint(P.out, P.out.length - 2.5).heading; break; }
      case 'astern': { const p = alcaPoint(P.astern, b.s); x = p.x; z = p.z; want = ALCA_SLIP_HEADING; break; }
      case 'pivot': { x = ALCA_PIVOT.x; z = ALCA_PIVOT.z; break; }
      default: {
        const path = b.leg === 'out' ? P.out : P.back;
        const p = alcaPoint(path, b.s), q = alcaPoint(path, b.s + 2.5);
        x = p.x; z = p.z; want = Math.atan2(q.x - p.x, q.z - p.z);
      }
    }
    let dh = 0;
    if (want !== null) {
      dh = wrap(want - this.heading);
      this.heading = dt > 0 ? this.heading + dh * (1 - Math.exp(-dt * 3)) : want;
    }
    const pose = b.pose, t = this.time;
    pose.x = x; pose.z = z;
    pose.y = ALCA_Y + Math.sin(t * 1.1 + 1.3) * FERRY.bob;
    pose.heading = wrap(this.heading);
    pose.pitch = Math.sin(t * 0.9 + 0.7) * 0.008;
    pose.roll = Math.sin(t * FERRY.rollRate + 0.4) * FERRY.roll + Math.max(-0.03, Math.min(0.03, -dh * 0.4));
  }
}

/** The boat's origin height (world/ferry.ts FERRY_Y: the water level + 0.55). */
export const ALCA_Y = -0.6 + 0.55;
