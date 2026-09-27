import { platformStop } from '../actors/platform';
import { type LineTrack, type TrackPoint, type TrackStop, buildLineTrack, limitAt, runSeconds, trackPoint, tunnelOf } from './lineTrack';
import type { TransitLine, TransitPortal, TransitTunnel } from './sf/format';
import type { CarPose, RideStatus } from './transitLine';

/**
 * Muni Metro light rail (wave 4 · lane T, plan §3.3), pure: no three.js, no DOM. Same rider / platform API as the cable
 * cars (world/transitLine.ts `CableSystem`) for the N Judah and M Ocean View:
 *
 * - Two-car trains, double-ended: at a terminus the train dwells and reverses (the cab at the other end leads).
 * - Surface: 10 u/s cruise (the curve limit √(a_lat · R) below it), accel 1.8 / decel 2.2 u/s², dwell 4 s at the major
 *   stops (transfers, ★ attraction stops, termini); minor stops only for a waiting rider, the rider's destination or a
 *   下一站下车 request (`requestNextStop`).
 * - Underground: no geometry; the trains run the tunnel spans "virtually" at 25 u/s (the subway overlay compresses the
 *   ride: Embarcadero → Church ≈ 35 s) and stop 3 s at each station; a train is `hidden` once wholly inside a mouth.
 * - Portal hand-over: the rider's train, heading underground toward a mouth, waits 25 u inside it until the host says
 *   the surface is ready there (`portalReady(portal)` = the streamer's whenReady, plan §3.3) or 8 s have passed; then it
 *   emerges (`portal-out` event: the host cuts the view to the LRV coming out).
 * - Two trains per line; same-direction trains keep a gap; opposite ones pass on the other track (a visual 1.25 u
 *   offset each to its right); one train at a time at a terminus.
 * - Waiting-rider dispatch: if no train stops for the rider within 20 s, an unseen train (underground, or out of the
 *   camera's view and ≥ 22 u from the player) is moved upstream so it arrives within 15 s.
 * - A rider's hop-off request (actors/platform.ts `platformStop(line)`) brakes the train on the surface; underground it
 *   is ignored (`status.underground`: the HUD greys 提前下车 out, "隧道里不能下车").
 */

export const LRV = {
  /** one car (u): length, width, height; two cars + a coupler make a train */
  carLength: 6.2,
  coupler: 0.5,
  width: 2.3,
  height: 2.9,
  /** half a car's bogie base */
  bogie: 2.0,
  cruise: 10,
  cruiseCap: 12,
  tunnelCruise: 25,
  accel: 1.8,
  decel: 2.2,
  aLat: 1.8,
  dwell: 4,
  dwellUnderground: 3,
  terminus: 6,
  perLine: 2,
  approach: 60,
  dispatchWithin: 15,
  dispatchIfOver: 20,
  passOffset: 1.25,
  /** the rider's train waits this far inside a mouth for the surface, at most `portalHold` s */
  portalWait: 25,
  portalHold: 8,
  gap: 8,
  /** the virtual subway (hidden trains) brakes and pulls away this much harder: the overlay compresses the ride */
  tunnelAccel: 7,
  hideBeyond: 300,
  farLod: 110,
  stopPenalty: 3,
  /** time lost per underground station besides the dwell (the virtual subway accelerates at tunnelAccel) */
  stopPenaltyUnderground: 1.2,
} as const;

export const TRAIN_LENGTH = LRV.carLength * 2 + LRV.coupler;
const HALF = TRAIN_LENGTH / 2;
/** car centres from the train centre */
const CAR_OFF = LRV.carLength / 2 + LRV.coupler / 2;

export type TrainMode = 'run' | 'dwell' | 'hold';

export interface Train {
  index: number;
  track: LineTrack;
  /** train centre (arc) */
  s: number;
  dir: 1 | -1;
  v: number;
  mode: TrainMode;
  timer: number;
  station: string | null;
  rider: boolean;
  pickup: { station: string; dir: 1 | -1 } | null;
  dropoff: string | null;
  /** minor stops this train will stop at (requests) */
  requested: Set<string>;
  odometer: number;
  arrivals: number;
  braking: boolean;
  brakeRate: number;
  lateral: number;
  approached: string | null;
  /** portal gating (the rider's train): the mouth arc it was released through, and seconds held */
  portalOk: number;
  portalHeld: number;
  holdingPortal: boolean;
  still: number;
  gongAt: number;
  /** wholly inside a tunnel (not drawn) */
  hidden: boolean;
  /** the two cars: [0] = the car at the higher arc (its cab faces +path), [1] the other */
  cars: [CarPose, CarPose];
}

export type RailEventWhat = 'arrive' | 'depart' | 'approach' | 'board' | 'door' | 'gong' | 'reverse' | 'portal-in' | 'portal-out' | 'dispatch';
export interface RailEvent { what: RailEventWhat; train: number; line: string; station?: string | null; attraction?: string; portal?: TransitPortal | null }

export interface RailOptions {
  groundY?: (x: number, z: number) => number | null;
  visible?: (x: number, z: number) => boolean;
  viewer?: () => { x: number; z: number; onFoot: boolean };
  perLine?: number;
  /** the surface around a portal is streamed in and ready to show (the host: stream whenReady(exit, 150)) */
  portalReady?: (p: TransitPortal) => boolean;
}

export interface RailRequest { line: string; station: string; dir: 1 | -1; to: string }

export interface RailRideStatus extends RideStatus {
  nextStop: string | null;
  nextEta: number;
  /** the rider's train is inside a tunnel (the subway overlay shows; no hopping off) */
  underground: boolean;
  /** the tunnel the rider's train is in, and its arc there (the overlay's strip) */
  tunnel: TransitTunnel | null;
  at: number;
  dir: 1 | -1;
  /** waiting inside a mouth for the surface to stream in */
  portalWait: boolean;
}

/** Where a train's centre stands at a stop: the stop's arc, kept a half train inside the track ends (termini). */
export function stopPos(track: Pick<LineTrack, 'length'>, st: Pick<TrackStop, 'at'>): number {
  return Math.min(track.length - HALF - 0.2, Math.max(HALF + 0.2, st.at));
}
/** Seconds a stop costs a passing train that stops there: the dwell plus braking and pulling away. */
const stopCost = (st: Pick<TrackStop, 'underground'>) => (st.underground ? LRV.dwellUnderground + LRV.stopPenaltyUnderground : LRV.dwell + LRV.stopPenalty);
/** Is arc s at (or beyond) a terminus stand? */
const atEnd = (track: Pick<LineTrack, 'length'>, s: number) => s <= HALF + 0.7 || s >= track.length - HALF - 0.7;

const tmpA: TrackPoint = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
const tmpB: TrackPoint = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
const tmpC: TrackPoint = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
const pose0 = (): CarPose => ({ x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 });
const DISPATCH_RUN = [11, 9, 13, 7, 5];

/** The light-rail track for a transit.json Metro line (plan §3.3 profile). */
export function railTrack(line: TransitLine): LineTrack {
  return buildLineTrack(line, { cruise: LRV.cruise, tunnelCruise: LRV.tunnelCruise, tunnelAccel: LRV.tunnelAccel, aLat: LRV.aLat, accel: LRV.accel, decel: LRV.decel, minCurve: 2.5 });
}

export class LightRailSystem {
  readonly trains: Train[] = [];
  readonly events: RailEvent[] = [];
  readonly tracks: LineTrack[];
  private opts: RailOptions;
  private req: RailRequest | null = null;
  private riderTrain = -1;
  private status: RailRideStatus | null = null;
  private retry = 0;
  time = 0;

  constructor(tracks: LineTrack[], opts: RailOptions = {}) {
    this.tracks = tracks;
    this.opts = opts;
    const per = opts.perLine ?? LRV.perLine;
    for (const track of tracks) {
      if (track.loop || !track.doubleEnded) throw new Error(`${track.id}: light rail is double-ended`);
      for (let k = 0; k < per; k++) {
        // train A at the outer surface terminus heading in, train B two fifths along heading out
        const f = k === 0 ? 1 : 0.4;
        const dir: 1 | -1 = k === 0 ? -1 : 1;
        const stop = this.nearestMajor(track, f * track.length);
        const t: Train = {
          index: this.trains.length, track, s: stopPos(track, stop), dir, v: 0, mode: 'dwell', timer: 1 + k * 2.3 + this.trains.length * 0.6, station: stop.id,
          rider: false, pickup: null, dropoff: null, requested: new Set(), odometer: 0, arrivals: 0, braking: false, brakeRate: 0, lateral: 0,
          approached: stop.id, portalOk: NaN, portalHeld: 0, holdingPortal: false, still: 0, gongAt: -99, hidden: false, cars: [pose0(), pose0()],
        };
        this.trains.push(t);
        this.updatePose(t);
      }
    }
  }

  private nearestMajor(track: LineTrack, s: number): TrackStop {
    return track.stops.filter(st => st.major).sort((a, b) => Math.abs(a.at - s) - Math.abs(b.at - s))[0];
  }

  trackOf(line: string): LineTrack | undefined { return this.tracks.find(t => t.id === line); }

  // -------------------------------------------------------------------------
  // Stops and timing
  // -------------------------------------------------------------------------

  /** Does train `t` stop at `st` when passing in its direction? */
  private stopsAt(t: Train, st: TrackStop, dir: 1 | -1 = t.dir): boolean {
    if (st.major || t.requested.has(st.id)) return true;
    if (t.pickup && t.pickup.station === st.id && t.pickup.dir === dir) return true;
    return t.rider && t.dropoff === st.id;
  }

  /** The next stop train `t` will stop at ahead of it (null past the last one in its direction). */
  nextStop(t: Train, from = t.s): TrackStop | null {
    let best: TrackStop | null = null, bd = Infinity;
    for (const st of t.track.stops) {
      const d = (stopPos(t.track, st) - from) * t.dir;
      if (d < 0.01 || d >= bd || !this.stopsAt(t, st)) continue;
      best = st; bd = d;
    }
    return best;
  }

  /** Seconds lost at the stopping stops strictly between a and b (dwell + braking / pulling away). */
  private stopsBetween(t: Train, a: number, b: number, dir: 1 | -1): number {
    let n = 0;
    for (const st of t.track.stops) {
      const p = stopPos(t.track, st);
      const da = (p - a) * dir, db = (b - p) * dir;
      if (da > 0.5 && db > 0.5 && this.stopsAt(t, st, dir)) n += stopCost(st);
    }
    return n;
  }

  private dwellOf(st: TrackStop): number { return st.underground ? LRV.dwellUnderground : LRV.dwell; }

  /** Seconds until train `t` stops at arc `target` travelling in `dir` (dwells, runs at the profile, reversals). */
  eta(t: Train, target: number, dir: 1 | -1): number {
    const tr = t.track;
    let time = t.mode === 'dwell' || t.mode === 'hold' ? Math.max(0, t.timer) : 0;
    let s = t.s, d = t.dir;
    for (let k = 0; k < 3; k++) {
      if (d === dir && (target - s) * d >= -0.3) {
        if (Math.abs(target - s) < 0.3 && (t.mode === 'dwell' || t.mode === 'hold') && k === 0) return time;
        return time + runSeconds(tr, s, target, d) + this.stopsBetween(t, s, target, d) + (Math.abs(target - s) > 0.5 ? 2 : 0);
      }
      const end = d > 0 ? tr.length - HALF - 0.2 : HALF + 0.2;
      time += runSeconds(tr, s, end, d) + this.stopsBetween(t, s, end, d) + LRV.terminus;
      s = end; d = -d as 1 | -1;
    }
    return time;
  }

  /** Seconds of a ride on `line` from station `from` to `to` (dwells at the stopping stations in between). */
  rideSeconds(line: string, from: string, to: string): number {
    const tr = this.trackOf(line);
    const a = tr?.stops.find(s => s.id === from), b = tr?.stops.find(s => s.id === to);
    if (!tr || !a || !b || a === b) return 0;
    const dir: 1 | -1 = b.at > a.at ? 1 : -1;
    const pa = stopPos(tr, a), pb = stopPos(tr, b);
    let between = 0;
    for (const st of tr.stops) if ((st.at - a.at) * dir > 0.5 && (b.at - st.at) * dir > 0.5 && st.major) between += stopCost(st);
    return runSeconds(tr, pa, pb, dir) + between + 2;
  }

  // -------------------------------------------------------------------------
  // Rider API
  // -------------------------------------------------------------------------

  request(req: RailRequest): RailRideStatus | null {
    this.cancel();
    const tr = this.trackOf(req.line);
    const stop = tr?.stops.find(s => s.id === req.station);
    if (!tr || !stop || !tr.stops.some(s => s.id === req.to)) return null;
    const cands = this.trains.filter(t => t.track === tr);
    let best: Train | null = null, bestEta = Infinity;
    for (const t of cands) {
      // the pickup makes a minor stop a stop for that train: estimate as if it were assigned
      const e = this.eta(t, stopPos(tr, stop), req.dir);
      if (e < bestEta) { bestEta = e; best = t; }
    }
    if (!best) return null;
    if (bestEta > LRV.dispatchIfOver) {
      const moved = this.bringIn(tr, stop, req.dir);
      if (moved) { best = moved; bestEta = this.eta(moved, stopPos(tr, stop), req.dir); }
    }
    this.req = req;
    this.retry = 1;
    this.riderTrain = best.index;
    best.pickup = { station: req.station, dir: req.dir };
    best.dropoff = req.to;
    this.status = {
      line: tr.id, car: best.index, phase: 'coming', eta: bestEta, station: null, arrivals: 0, lastStation: null, odometer: 0, turning: false, braking: false,
      nextStop: req.station, nextEta: bestEta, underground: false, tunnel: null, at: best.s, dir: req.dir, portalWait: false,
    };
    if (this.standingAt(best, stop, req.dir)) this.markHere(best);
    return this.status;
  }

  private standingAt(t: Train, stop: TrackStop, dir: 1 | -1): boolean {
    return t.station === stop.id && t.dir === dir && t.mode === 'dwell' && Math.abs(t.s - stopPos(t.track, stop)) < 0.3;
  }

  private markHere(t: Train) {
    if (!this.status) return;
    this.status.phase = 'here';
    this.status.station = t.station;
    t.timer = Math.max(t.timer, 2.5);
  }

  board() {
    const t = this.trains[this.riderTrain];
    if (!t || !this.status) return;
    t.rider = true;
    t.pickup = null;
    t.odometer = 0;
    t.arrivals = 0;
    t.timer = Math.max(t.timer, 1.6);
    this.status.phase = 'riding';
    this.events.push({ what: 'board', train: t.index, line: t.track.id, station: t.station });
  }

  cancel() {
    const t = this.trains[this.riderTrain];
    if (t) { t.rider = false; t.pickup = null; t.dropoff = null; t.requested.clear(); t.braking = false; t.portalOk = NaN; t.portalHeld = 0; t.holdingPortal = false; }
    this.req = null;
    this.riderTrain = -1;
    this.status = null;
  }

  rideStatus(): RailRideStatus | null { return this.status; }
  riderCarOf(line: string): Train | null {
    const t = this.trains[this.riderTrain];
    return t && t.track.id === line ? t : null;
  }

  /** 下一站下车: the train stops at the very next station ahead (minor included) and the ride ends there. */
  requestNextStop(): string | null {
    const t = this.trains[this.riderTrain];
    if (!t || !t.rider) return null;
    let best: TrackStop | null = null, bd = Infinity;
    for (const st of t.track.stops) {
      const d = (stopPos(t.track, st) - t.s) * t.dir;
      if (d > (t.mode === 'run' ? 0.05 : 0.5) && d < bd) { bd = d; best = st; }
    }
    if (!best) return null;
    t.requested.add(best.id);
    t.dropoff = best.id;
    return best.id;
  }

  /** Is the arc span [s − HALF, s + HALF] of a train at `s` wholly underground (past a mouth by ≥ 1 u)? */
  private isHidden(tr: LineTrack, s: number): boolean {
    const t = tunnelOf(tr, s);
    if (!t) return false;
    const lo = t.portalA ? t.fromAt + 1 : -Infinity, hi = t.portalB ? t.toAt - 1 : Infinity;
    return s - HALF > lo && s + HALF < hi;
  }

  /**
   * Bring an unseen train in so it stops at `stop` (direction `dir`) within 15 s: upstream by a ≈ 11 s run, never behind
   * the previous stopping stop; at a terminus pickup the train arrives at the terminus itself. Out of sight or
   * underground, away from the player, clear of the line's other train.
   */
  private bringIn(tr: LineTrack, stop: TrackStop, dir: 1 | -1): Train | null {
    const vis = this.opts.visible ?? (() => false);
    const viewer = this.opts.viewer?.();
    const cands = this.trains.filter(t => t.track === tr && !t.rider && (t.hidden || !vis(t.cars[0].x, t.cars[0].z)) && !(viewer && !t.hidden && Math.hypot(t.cars[0].x - viewer.x, t.cars[0].z - viewer.z) < 60));
    const unseen = (s: number) => {
      if (this.isHidden(tr, s)) return true;
      const p = trackPoint(tr, s, tmpA);
      return !vis(p.x, p.z) && !(viewer && Math.hypot(p.x - viewer.x, p.z - viewer.z) < 22);
    };
    // previous stop this train would stop at, upstream in `dir`
    let prev = dir > 0 ? HALF + 0.2 : tr.length - HALF - 0.2;
    for (const st of tr.stops) {
      const p = stopPos(tr, st);
      const d = (stopPos(tr, stop) - p) * dir;
      if (d > 0.5 && st.major && (p - prev) * dir > 0) prev = p;
    }
    const sp = stopPos(tr, stop);
    const room = Math.abs(sp - prev);
    for (const t of cands) {
      const clear = (s: number, d: 1 | -1) => this.trains.every(o => o === t || o.track !== tr || o.dir !== d || Math.abs(o.s - s) > TRAIN_LENGTH + LRV.gap);
      if (room < 12) {
        // a terminus pickup: the train arrives there and dwells, already facing the way out
        if (!unseen(sp) || !clear(sp, dir)) continue;
        this.place(t, sp, dir, 0, 'dwell', stop.id);
        t.timer = 1.5;
        this.events.push({ what: 'dispatch', train: t.index, line: tr.id, station: stop.id });
        return t;
      }
      for (const secs of DISPATCH_RUN) {
        let back = 16;
        while (back < room - 2 && runSeconds(tr, sp - dir * back, sp, dir) < secs) back += 4;
        back = Math.min(back, room - 2);
        const place = sp - dir * back;
        if (!unseen(place) || !clear(place, dir)) continue;
        this.place(t, place, dir, limitAt(tr, place), 'run', null);
        this.events.push({ what: 'dispatch', train: t.index, line: tr.id, station: stop.id });
        return t;
      }
    }
    return null;
  }

  private place(t: Train, s: number, dir: 1 | -1, v: number, mode: TrainMode, station: string | null) {
    t.s = s; t.dir = dir; t.v = v; t.mode = mode; t.timer = 0; t.station = station; t.lateral = 0; t.still = 0; t.approached = null;
    t.portalOk = NaN; t.portalHeld = 0; t.holdingPortal = false;
    this.updatePose(t);
  }

  private reassign() {
    const req = this.req, st = this.status, cur = this.trains[this.riderTrain];
    if (!req || !st || !cur) return;
    const tr = cur.track, stop = tr.stops.find(s => s.id === req.station)!;
    let best = cur, bestEta = this.eta(cur, stopPos(tr, stop), req.dir);
    for (const t of this.trains) {
      if (t.track !== tr || t === cur || t.rider) continue;
      const e = this.eta(t, stopPos(tr, stop), req.dir);
      if (e < bestEta - 3) { best = t; bestEta = e; }
    }
    if (bestEta > LRV.dispatchIfOver) {
      const moved = this.bringIn(tr, stop, req.dir);
      if (moved) { best = moved; bestEta = this.eta(moved, stopPos(tr, stop), req.dir); }
    }
    st.eta = bestEta;
    if (best === cur) return;
    cur.pickup = null; cur.dropoff = null;
    best.pickup = { station: req.station, dir: req.dir };
    best.dropoff = req.to;
    this.riderTrain = best.index;
    st.car = best.index;
    if (this.standingAt(best, stop, req.dir)) this.markHere(best);
  }

  // -------------------------------------------------------------------------
  // Step
  // -------------------------------------------------------------------------

  step(dt: number) {
    if (dt <= 0) return;
    this.time += dt;
    for (const t of this.trains) this.stepTrain(t, dt);
    for (const t of this.trains) this.stepLateral(t, dt);
    for (const t of this.trains) { this.updatePose(t); t.hidden = this.isHidden(t.track, t.s); }
    this.updateStatus(dt);
  }

  /** Arc distance ahead (in the train's direction) to the nearest obstacle: the same-direction train ahead, an occupied terminus. */
  private obstacle(t: Train): number {
    const tr = t.track;
    let d = Infinity;
    const end = t.dir > 0 ? tr.length - HALF - 0.2 : HALF + 0.2;
    for (const o of this.trains) {
      if (o === t || o.track !== tr) continue;
      const a = (o.s - t.s) * t.dir;
      if (o.dir === t.dir && a > 0.01) d = Math.min(d, a - TRAIN_LENGTH - LRV.gap);
      // one train at a time at a terminus: wait short of it while the other stands there
      if (Math.abs(o.s - end) < 1 && a > 0.01) d = Math.min(d, a - TRAIN_LENGTH - LRV.gap);
    }
    // the rider's train waits inside a mouth for the surface (portal hand-over)
    t.holdingPortal = false;
    if (t.rider && this.opts.portalReady) {
      const tun = tunnelOf(tr, t.s);
      const mouth = tun ? (t.dir > 0 ? tun.portalB && { at: tun.toAt, p: tun.portalB } : tun.portalA && { at: tun.fromAt, p: tun.portalA }) : null;
      if (mouth && mouth.at !== t.portalOk) {
        const toMouth = (mouth.at - t.s) * t.dir;
        if (toMouth > 0 && toMouth < LRV.portalWait + 40) {
          if (this.opts.portalReady(mouth.p) || t.portalHeld >= LRV.portalHold) t.portalOk = mouth.at;
          else { d = Math.min(d, toMouth - LRV.portalWait); t.holdingPortal = true; }
        }
      }
    }
    const viewer = this.opts.viewer?.();
    if (viewer?.onFoot && !t.hidden) {
      const lead = t.dir > 0 ? t.cars[0] : t.cars[1];
      const dx = viewer.x - lead.x, dz = viewer.z - lead.z;
      const fx = Math.sin(lead.heading), fz = Math.cos(lead.heading);
      const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (along > LRV.carLength / 2 && along < 18 && side < 1.4) {
        d = Math.min(d, CAR_OFF + along - LRV.carLength / 2 - 3);
        if (along < 12 && t.v > 1 && this.time - t.gongAt > 3) { t.gongAt = this.time; this.events.push({ what: 'gong', train: t.index, line: tr.id }); }
      }
    }
    return d;
  }

  private stepTrain(t: Train, dt: number) {
    const tr = t.track;
    const s0 = t.s;
    const underground = t.hidden;
    const stopReq = t.rider && !underground ? platformStop(tr.id) : null;
    if (stopReq && !t.braking) t.brakeRate = Math.max(LRV.decel, t.v / Math.max(0.05, stopReq.within - stopReq.since));
    t.braking = !!stopReq;
    if (t.mode === 'dwell') {
      t.v = 0;
      t.timer -= dt;
      if (t.timer <= 0) this.leave(t);
    } else {
      const next = this.nextStop(t);
      const target = next ? stopPos(tr, next) : t.dir > 0 ? tr.length - HALF - 0.2 : HALF + 0.2;
      const toStop = Math.max(0, (target - t.s) * t.dir);
      const obst = this.obstacle(t);
      // the virtual subway (hidden) brakes and pulls away harder; near a mouth the train is visible and runs as normal
      const acc = t.hidden ? LRV.tunnelAccel : LRV.accel, dec = t.hidden ? LRV.tunnelAccel : LRV.decel;
      let limit = Math.min(limitAt(tr, t.s), LRV.tunnelCruise, Math.sqrt(2 * dec * toStop));
      if (obst < Infinity) limit = Math.min(limit, Math.sqrt(2 * dec * Math.max(0, obst)));
      if (t.holdingPortal && t.v < 0.05) t.portalHeld += dt;
      if (stopReq) {
        t.v = Math.max(0, t.v - t.brakeRate * dt);
        t.mode = t.v <= 0.02 ? 'hold' : 'run';
      } else {
        if (t.mode === 'hold') t.mode = 'run';
        t.v = t.v < limit ? Math.min(limit, t.v + acc * dt) : Math.max(limit, t.v - dec * 2.5 * dt);
      }
      let step = t.v * dt;
      if (step >= toStop) step = toStop;
      const before = t.s;
      t.s += t.dir * step;
      if (t.rider) t.odometer += step;
      if (t.v > 0.02) t.station = null;
      this.portalEvents(t, before, t.s);
      if (next && t.approached !== next.id && toStop - step <= LRV.approach) {
        t.approached = next.id;
        this.events.push({ what: 'approach', train: t.index, line: tr.id, station: next.id, attraction: next.attractions[0] });
      }
      if (toStop - step < 0.02 && !stopReq) {
        // no stop left ahead (should not happen: termini are major): stand at the end and reverse there
        const end = next ?? t.track.stops.reduce((a, b) => (Math.abs(stopPos(tr, b) - target) < Math.abs(stopPos(tr, a) - target) ? b : a));
        this.arrive(t, end);
      }
    }
    t.still = Math.abs(t.s - s0) > 1e-4 ? 0 : t.still + dt;
  }

  /** The rider's train crossing a mouth: `portal-in` (the overlay starts), `portal-out` (the view cuts to the emerging LRV). */
  private portalEvents(t: Train, a: number, b: number) {
    if (!t.rider) return;
    for (const tun of t.track.tunnels) {
      for (const [at, p, inward] of [[tun.fromAt, tun.portalA, t.dir > 0], [tun.toAt, tun.portalB, t.dir < 0]] as const) {
        if (!p) continue;
        // inward: the centre passes 8 u inside; outward: the centre passes the mouth
        const mark = inward ? at + (t.dir > 0 ? 8 : -8) : at;
        if ((a - mark) * (b - mark) <= 0 && a !== b) this.events.push({ what: inward ? 'portal-in' : 'portal-out', train: t.index, line: t.track.id, portal: p });
      }
    }
  }

  private arrive(t: Train, stop: TrackStop) {
    const tr = t.track;
    t.s = stopPos(tr, stop);
    t.v = 0;
    t.mode = 'dwell';
    t.station = stop.id;
    t.timer = this.dwellOf(stop);
    t.requested.delete(stop.id);
    // a terminus: the other cab leads from here (so a rider waiting to ride back boards this train)
    if (atEnd(tr, t.s) && ((t.s < tr.length / 2 && t.dir < 0) || (t.s > tr.length / 2 && t.dir > 0))) {
      t.dir = -t.dir as 1 | -1;
      t.timer = LRV.terminus;
      this.events.push({ what: 'reverse', train: t.index, line: tr.id, station: stop.id });
    }
    if (t.rider) t.arrivals++;
    this.events.push({ what: 'arrive', train: t.index, line: tr.id, station: stop.id });
    if (!stop.underground) this.events.push({ what: 'door', train: t.index, line: tr.id, station: stop.id });
    const st = this.status;
    if (st && this.riderTrain === t.index) {
      if (!t.rider && t.pickup && t.pickup.station === stop.id && t.pickup.dir === t.dir) this.markHere(t);
      if (t.rider) {
        st.lastStation = stop.id;
        st.arrivals = t.arrivals;
        if (t.dropoff === stop.id) { st.phase = 'arrived'; t.timer = Math.max(t.timer, 3); }
      }
    }
  }

  private leave(t: Train) {
    if (this.status && this.riderTrain === t.index && this.status.phase === 'here') { t.timer = 0.3; return; }
    if (t.rider && !t.hidden && platformStop(t.track.id)) { t.timer = 0.3; return; }
    // same-direction train right ahead: wait
    if (this.trains.some(o => o !== t && o.track === t.track && o.dir === t.dir && (o.s - t.s) * t.dir > 0.01 && (o.s - t.s) * t.dir < TRAIN_LENGTH + LRV.gap)) { t.timer = 0.5; return; }
    t.mode = 'run';
    if (!t.hidden) this.events.push({ what: 'door', train: t.index, line: t.track.id, station: t.station });
    this.events.push({ what: 'depart', train: t.index, line: t.track.id, station: t.station });
  }

  /** Passing: opposite trains of a line near each other step aside (each 1.25 u to its right, as on double track). */
  private stepLateral(t: Train, dt: number) {
    let want = 0;
    // never beside the track within 20 u of a mouth (the hoods are one track wide)
    const nearMouth = t.track.tunnels.some(u => (u.portalA && Math.abs(t.s - u.fromAt) < 20) || (u.portalB && Math.abs(t.s - u.toAt) < 20));
    if (!nearMouth) for (const o of this.trains) {
      if (o === t || o.track !== t.track || o.dir === t.dir) continue;
      if (Math.abs(o.s - t.s) < TRAIN_LENGTH * 3) { want = LRV.passOffset; break; }
    }
    const k = 1.1 * dt;
    t.lateral += Math.max(-k, Math.min(k, want - t.lateral));
  }

  /** Both cars' poses: bogies on the track (height from `groundY` on the surface, else the path), pitch = grade. */
  updatePose(t: Train) {
    const tr = t.track;
    const g = this.opts.groundY;
    const hid = this.isHidden(tr, t.s);
    const travel = trackPoint(tr, t.s, tmpC).heading + (t.dir < 0 ? Math.PI : 0);
    const ox = -Math.cos(travel) * t.lateral, oz = Math.sin(travel) * t.lateral;
    for (let k = 0; k < 2; k++) {
      const face = k === 0 ? 1 : -1;
      const c = t.s + face * CAR_OFF;
      const f = trackPoint(tr, c + face * LRV.bogie, tmpA);
      const r = trackPoint(tr, c - face * LRV.bogie, tmpB);
      const yAt = (p: TrackPoint) => (hid || tunnelOf(tr, c) ? p.y : g?.(p.x, p.z) ?? p.y);
      const yf = yAt(f), yr = yAt(r);
      const pose = t.cars[k];
      const base = Math.hypot(f.x - r.x, f.z - r.z) || 1;
      pose.heading = Math.atan2(f.x - r.x, f.z - r.z);
      pose.pitch = Math.atan2(yf - yr, base);
      pose.x = (f.x + r.x) / 2 + ox;
      pose.z = (f.z + r.z) / 2 + oz;
      pose.y = (yf + yr) / 2;
      pose.roll = t.v > 0.5 && !hid ? Math.sin(this.time * 5.3 + t.index + k) * 0.003 : 0;
    }
  }

  /** The car the rider rides in (the one leading in the travel direction): its heading faces the travel direction. */
  leadCar(t: Train): CarPose { return t.dir > 0 ? t.cars[0] : t.cars[1]; }

  private updateStatus(dt: number) {
    const st = this.status;
    if (st?.phase === 'coming' && (this.retry -= dt) <= 0) { this.retry = 1; this.reassign(); }
    const t = this.trains[this.riderTrain];
    if (!st || !t) return;
    st.braking = t.braking;
    st.odometer = t.odometer;
    st.station = t.v < 0.02 ? t.station : null;
    st.at = t.s;
    st.dir = t.dir;
    st.portalWait = t.holdingPortal;
    const tun = tunnelOf(t.track, t.s);
    st.tunnel = tun;
    st.underground = !!tun && this.isHidden(t.track, t.s);
    if (st.phase === 'coming' && this.req) {
      const stop = t.track.stops.find(s => s.id === this.req!.station)!;
      st.eta = this.eta(t, stopPos(t.track, stop), this.req.dir);
      st.nextStop = stop.id; st.nextEta = st.eta;
    } else {
      const next = this.nextStop(t, t.mode === 'run' ? t.s : t.s + t.dir * 0.1);
      st.nextStop = next?.id ?? null;
      st.nextEta = next ? this.eta(t, stopPos(t.track, next), t.dir) : 0;
    }
  }

  /** Test helper: same-line trains overlapping on the same direction's track, or two at one terminus. */
  violations(): string[] {
    const out: string[] = [];
    for (let i = 0; i < this.trains.length; i++) for (let j = i + 1; j < this.trains.length; j++) {
      const a = this.trains[i], b = this.trains[j];
      if (a.track !== b.track) continue;
      const d = Math.abs(a.s - b.s);
      if ((a.dir === b.dir && d < TRAIN_LENGTH - 0.1) || (atEnd(a.track, a.s) && atEnd(b.track, b.s) && d < TRAIN_LENGTH - 0.1)) out.push(`${a.track.id}#${a.index} ${a.s.toFixed(1)}/${a.dir} vs #${b.index} ${b.s.toFixed(1)}/${b.dir}`);
    }
    return out;
  }
}
