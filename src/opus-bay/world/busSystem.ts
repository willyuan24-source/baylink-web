import { platformStop } from '../actors/platform';
import { type LineRideSystem, PERSON_CLEAR } from '../data/transit';
import { type LineTrack, type TrackPoint, type TrackStop, arcAhead, buildLineTrack, limitAt, normArc, runSeconds, trackPoint } from './lineTrack';
import type { TransitLine } from './sf/format';
import type { CarPose, RideStatus } from './transitLine';

/**
 * The sightseeing bus (wave 4 · lane T, plan §3.2), pure: no three.js, no DOM, so node tests drive it exactly as the
 * world does. Same rider / platform API as the cable cars (world/transitLine.ts `CableSystem`):
 *   request({ line, station, to }) → RideStatus (coming → here → riding → arrived), board(), cancel(), rideStatus(),
 *   riderCarOf(line), step(dt), events[], violations(); plus requestNextStop() (下一站下车) and the approach events.
 *
 * - One-way loop (clockwise), 3 buses spread by headway (≈ a third of the ≈ 14-min lap each).
 * - Speeds from the track profile (world/lineTrack.ts): 12 u/s on primary / secondary streets, 11 on tertiary, 9 on
 *   residential streets or grades > 0.12 (the baked `speeds` spans), the curve limit √(a_lat · R); accel / decel
 *   2.6 u/s² (as streetcar.ts). Every stop is a stop: dwell 8 s (doors open), a stopped rider's bus waits for boarding.
 * - Following: a bus keeps a 6 u gap behind the bus ahead (they never overlap: `violations()` stays empty).
 * - Interlocks (plan §3.2 "buses yield at the cable-car crossings"): `boxes` are arc spans of the bus track shared with
 *   another line (Bush × Powell, California St at Drumm, Hyde St at the Powell–Hyde terminus, the F-line median at the
 *   hero U-turn); the bus enters one only while `blocked()` is false, else it waits before it. `occupies(box)` lets
 *   the other system yield to a bus already inside (integration: CableSystem.free()).
 * - Waiting-rider dispatch: if no bus gets to the rider's stop within 20 s, an unseen bus (out of the camera's view,
 *   ≥ 22 u from the player, a clear gap on the road) is moved in upstream so it arrives within 15 s. (W5-T2) Where the
 *   stretch just before the stop is in view (the Ferry Building: the loop U-turns past the pole, the rider waited 155 s)
 *   placements farther back are tried (up to ≈ 31 s of running); after `waitRelax` s of waiting, one in view but ≥ 100 u
 *   from the player (the far look, ≥ 110 u from a camera behind them) is allowed: the rider's wait is capped (≈ 45 s).
 * - A rider's hop-off request (actors/platform.ts `platformStop(line)`) brakes the bus to 0 within the asked time and
 *   pulls it 0.6 u to the kerb; it holds until released.
 * - Poses: the body stands on its two axles (height from `groundY`, else the published path), pitch = grade, a little
 *   roll into curves; `approach` fires 60 u before each stop (lane C narrates, lane G biases the camera).
 */

export const BUS = {
  /** body (u): length, width, height (open top deck rail) */
  length: 7.8,
  width: 2.5,
  height: 3.7,
  /** half the wheelbase: pitch = grade over this base */
  axle: 2.5,
  accel: 2.6,
  decel: 2.6,
  /** lateral acceleration for the curve limit (u/s²) */
  aLat: 3.6,
  dwell: 8,
  count: 3,
  /** bumper gap kept behind the bus ahead (u) */
  gap: 6,
  /** a stopped rider waits: pick-up within this many seconds (an unseen bus is brought in when the wait is longer) */
  dispatchWithin: 15,
  dispatchIfOver: 20,
  /** (W5-T2) a brought-in bus farther back may take this long to arrive (s) */
  dispatchMax: 33,
  /** (W5-T2) after this long waiting (s), a bus may be brought in within view beyond the far LOD (relaxDistance u) */
  waitRelax: 12,
  relaxDistance: 100,
  /** (W5-T2) a bus coming for the rider that has not moved for this long (s) counts its stand in its ETA (a dispatch then) */
  stallCounts: 6,
  /** approach event distance before a stop (u) */
  approach: 60,
  /** pulled to the kerb for a hop-off (u, to the right) */
  kerbShift: 0.6,
  /** drawn within this camera distance; the far version beyond farLod */
  hideBeyond: 300,
  farLod: 110,
  /** rough time lost per intermediate stop besides the dwell (decel + accel) */
  stopPenalty: 3.5,
} as const;

export type BusMode = 'run' | 'dwell' | 'hold';

/**
 * (W5-T2, plan MF2 "instrument the loop buses") What holds a bus back right now: 'run' nothing (it runs at its speed
 * profile), 'stop' braking into the stop it heads for, 'dwell' doors open at a stop, 'board' waiting at the pickup for its
 * rider, 'stop-ahead' ready to leave but a bus dwells right in front, 'bus-ahead' keeping the gap to the bus ahead, 'box'
 * waiting at an interlock box another line is in, 'road' behind a toy car / the player's vehicle in its lane, 'person'
 * short of someone on foot in its path, 'hop-off' the rider's hop-off brake. game/busWatch.ts logs the long ones.
 */
export type BusWhy = 'run' | 'stop' | 'dwell' | 'board' | 'stop-ahead' | 'bus-ahead' | 'box' | 'road' | 'person' | 'hop-off';

export interface Bus {
  index: number;
  s: number;
  v: number;
  mode: BusMode;
  /** dwell seconds left */
  timer: number;
  /** stop id while standing at one */
  station: string | null;
  /** index into track.stops of the stop the bus heads for / stands at */
  next: number;
  rider: boolean;
  pickup: string | null;
  dropoff: string | null;
  /** the rider rides a full lap (to = from): the dropoff counts only after ≥ one lap minus a stop */
  lapFrom: string | null;
  odometer: number;
  arrivals: number;
  braking: boolean;
  brakeRate: number;
  lateral: number;
  /** the stop the approach event last fired for */
  approached: string | null;
  /** interlock box the bus waits for (index into boxes, −1 = none) */
  waitBox: number;
  still: number;
  hornAt: number;
  /** seconds the bus has stood short of someone on foot in its path (game/transit.ts asks them to step aside) */
  held: number;
  /** (W5-T2) what holds it back now, and who: a box id, the road user's kind, `bus#<i>`, 'viewer' ('' = nothing) */
  why: BusWhy;
  whyOf: string;
  pose: CarPose;
}

export type BusEventWhat = 'arrive' | 'depart' | 'approach' | 'board' | 'door' | 'horn' | 'dispatch' | 'yield';
export interface BusEvent { what: BusEventWhat; bus: number; line: string; station?: string | null; attraction?: string }

export interface InterlockBox {
  id: string;
  /** arc span on the bus track (a0 < a1) */
  a0: number;
  a1: number;
  /** another vehicle is inside its part of the box right now */
  blocked: () => boolean;
  /**
   * The other line's part of the box (its transit.json path arcs, padded): what the other system checks before it moves a
   * vehicle in (integration: CableSystem.free() refuses a span overlapping [b0, b1] while `occupies(id)`).
   */
  other?: { line: string; b0: number; b1: number };
}

export interface BusOptions {
  groundY?: (x: number, z: number) => number | null;
  visible?: (x: number, z: number) => boolean;
  viewer?: () => { x: number; z: number; onFoot: boolean };
  count?: number;
  boxes?: InterlockBox[];
  /**
   * Integration (world/sf/lineFleet.ts): the distance (u) from a bus's centre to the nearest other road user in its lane
   * ahead (the toy traffic, the player's car / bike), ∞ / undefined if none. The bus keeps a car's gap behind it.
   * (W5-T2) `who.kind` is set to that road user's kind (the bus watch's reason).
   */
  roadAhead?: (b: Bus, who: { kind: string }) => number;
}

export interface BusRequest { line: string; station: string; to: string }

/** The rider's ride as the bus sees it: the cable-car RideStatus plus the next stop for the HUD. */
export interface BusRideStatus extends RideStatus {
  /** the next stop the bus will stop at, and the seconds to it (riding) */
  nextStop: string | null;
  nextEta: number;
}

const HALF = BUS.length / 2;
const tmpA: TrackPoint = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
const tmpB: TrackPoint = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
const tmpC: TrackPoint = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
const tmpP: TrackPoint = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** placements tried for a brought-in bus: seconds of running before the pickup (preferred first; W5-T2: then farther back) */
const DISPATCH_RUN = [11, 9, 13, 7, 5, 16, 19, 22, 25, 28, 31];

/** The bus track for a transit.json loop line (the profile of plan §3.2). */
export function busTrack(line: TransitLine & { speeds?: [number, number, number][] }): LineTrack {
  return buildLineTrack(line, { cruise: 11, aLat: BUS.aLat, accel: BUS.accel, decel: BUS.decel, minCurve: 3.5 });
}

export class BusSystem implements LineRideSystem {
  readonly buses: Bus[] = [];
  readonly events: BusEvent[] = [];
  readonly track: LineTrack;
  readonly boxes: InterlockBox[];
  private opts: BusOptions;
  private req: BusRequest | null = null;
  private riderBus = -1;
  private status: BusRideStatus | null = null;
  private retry = 0;
  /** (W5-T2) seconds the rider has waited for the current request */
  private waited = 0;
  /** simulated seconds */
  time = 0;

  constructor(track: LineTrack, opts: BusOptions = {}) {
    if (!track.loop) throw new Error(`${track.id}: the bus runs a loop`);
    this.track = track;
    this.opts = opts;
    this.boxes = opts.boxes ?? [];
    const count = opts.count ?? BUS.count;
    for (let k = 0; k < count; k++) {
      // spread by thirds of the lap, each dwelling at the stop nearest its share
      const want = (k / count) * track.length;
      let next = 0, bd = Infinity;
      track.stops.forEach((st, i) => { const d = Math.abs(arcAhead(track, want, st.at)); if (d < bd) { bd = d; next = i; } });
      const st = track.stops[next];
      const bus: Bus = {
        index: k, s: st.at, v: 0, mode: 'dwell', timer: 1 + k * 1.7, station: st.id, next, rider: false, pickup: null, dropoff: null,
        lapFrom: null, odometer: 0, arrivals: 0, braking: false, brakeRate: 0, lateral: 0, approached: st.id, waitBox: -1, still: 0, hornAt: -99, held: 0,
        why: 'dwell', whyOf: '', pose: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
      };
      this.buses.push(bus);
      this.updatePose(bus);
    }
  }

  get line(): string { return this.track.id; }
  /** data/transit.ts `LineRideSystem`: game/ride.ts reads `cars[status.car].pose` while riding (the car index = the bus). */
  get cars(): readonly Bus[] { return this.buses; }

  stopIndex(id: string): number { return this.track.stops.findIndex(s => s.id === id); }

  // -------------------------------------------------------------------------
  // Timing
  // -------------------------------------------------------------------------

  /** Seconds until `bus` stops at stop `idx` (dwell left, the run at the profile, 8 s + a penalty per stop between). */
  eta(bus: Bus, idx: number): number {
    const tr = this.track, stop = tr.stops[idx];
    if (bus.station === stop.id && (bus.mode === 'dwell' || bus.mode === 'hold')) return 0;
    let t = bus.mode === 'dwell' || bus.mode === 'hold' ? Math.max(0, bus.timer) : 0;
    let d = arcAhead(tr, bus.s, stop.at);
    // (W5-T1) a running bus a hair short of the stop it heads for is about to stop there (not a lap away), and it will
    // dwell at such a stop on the way: the ETA jumped by a lap / by the dwell in the last frames before an arrival
    const heading = (st: TrackStop) => bus.mode === 'run' && tr.stops[bus.next] === st;
    // a bus pulling away from this very stop is back only after a whole lap
    if (d < 0.05 && !heading(stop)) d = tr.length;
    t += d >= tr.length ? runSeconds(tr, bus.s, bus.s - 0.01) : runSeconds(tr, bus.s, stop.at);
    let between = 0;
    for (const st of tr.stops) {
      if (st === stop || st.id === bus.station) continue;
      const e = arcAhead(tr, bus.s, st.at);
      if ((e > 0.05 || heading(st)) && e < d) between++;
    }
    return t + between * (BUS.dwell + BUS.stopPenalty) + (bus.v < 1 && bus.mode === 'run' ? 1.5 : 0);
  }

  /** Seconds of a ride from stop `from` to stop `to` (the lap when they are the same stop): the trip planner's line leg. */
  rideSeconds(from: string, to: string): number {
    const tr = this.track, a = tr.stops[this.stopIndex(from)], b = tr.stops[this.stopIndex(to)];
    if (!a || !b) return 0;
    const lap = a === b;
    const d = lap ? tr.length : arcAhead(tr, a.at, b.at);
    let between = 0;
    for (const st of tr.stops) { const e = arcAhead(tr, a.at, st.at); if (e > 0.05 && e < d - 0.05) between++; }
    return (lap ? runSeconds(tr, a.at, a.at - 0.01) : runSeconds(tr, a.at, b.at)) + between * (BUS.dwell + BUS.stopPenalty) + 2;
  }

  // -------------------------------------------------------------------------
  // Rider API
  // -------------------------------------------------------------------------

  request(req: BusRequest): BusRideStatus | null {
    this.cancel();
    if (req.line !== this.track.id) return null;
    const idx = this.stopIndex(req.station);
    if (idx < 0 || this.stopIndex(req.to) < 0) return null;
    let best: Bus | null = null, bestEta = Infinity;
    for (const b of this.buses) { const e = this.eta(b, idx); if (e < bestEta) { bestEta = e; best = b; } }
    if (!best) return null;
    if (bestEta > BUS.dispatchIfOver) {
      const moved = this.bringIn(idx);
      if (moved) { best = moved; bestEta = this.eta(moved, idx); }
    }
    this.req = req;
    this.retry = 1;
    this.waited = 0;
    this.riderBus = best.index;
    this.assign(best, req);
    this.status = { line: this.track.id, car: best.index, phase: 'coming', eta: bestEta, station: null, arrivals: 0, lastStation: null, odometer: 0, turning: false, braking: false, nextStop: req.station, nextEta: bestEta };
    if (best.station === req.station && best.mode === 'dwell') this.markHere(best);
    return this.status;
  }

  private assign(bus: Bus, req: BusRequest) {
    bus.pickup = req.station;
    bus.dropoff = req.to;
    bus.lapFrom = req.to === req.station ? req.station : null;
  }

  private markHere(bus: Bus) {
    if (!this.status) return;
    this.status.phase = 'here';
    this.status.station = bus.station;
    bus.timer = Math.max(bus.timer, 2.5);
  }

  board() {
    const bus = this.buses[this.riderBus];
    if (!bus || !this.status) return;
    bus.rider = true;
    bus.pickup = null;
    bus.odometer = 0;
    bus.arrivals = 0;
    bus.timer = Math.max(bus.timer, 1.6);
    this.status.phase = 'riding';
    this.events.push({ what: 'board', bus: bus.index, line: this.track.id, station: bus.station });
  }

  cancel() {
    const bus = this.buses[this.riderBus];
    if (bus) { bus.rider = false; bus.pickup = null; bus.dropoff = null; bus.lapFrom = null; bus.braking = false; }
    this.req = null;
    this.riderBus = -1;
    this.status = null;
  }

  rideStatus(): BusRideStatus | null { return this.status; }

  /**
   * (W5-T1) Seconds until the rider's bus stops at the rider's destination, from where it is now (its arc, the dwell left,
   * the stops between; a whole-lap ride counts the lap still to come), 0 once arrived, null when nobody rides.
   */
  rideLeft(): number | null {
    const b = this.buses[this.riderBus], st = this.status;
    if (!b || !st) return null;
    if (st.phase === 'arrived') return 0;
    if (!b.rider || !b.dropoff) return null;
    const idx = this.stopIndex(b.dropoff);
    if (idx < 0) return null;
    const tr = this.track, stop = tr.stops[idx];
    // a lap: while the bus still stands at (or has only just left) the stop it started from, the whole lap is ahead
    if (b.lapFrom && b.odometer < tr.length - 30 && (b.station === stop.id || arcAhead(tr, b.s, stop.at) > tr.length - 30)) {
      const wait = b.mode === 'dwell' || b.mode === 'hold' ? Math.max(0, b.timer) : 0;
      const d = b.station === stop.id ? tr.length : arcAhead(tr, b.s, stop.at);
      let between = 0;
      for (const q of tr.stops) { const e = arcAhead(tr, b.s, q.at); if (q !== stop && e > 0.05 && e < d) between++; }
      return wait + (d >= tr.length ? runSeconds(tr, b.s, b.s - 0.01) : runSeconds(tr, b.s, stop.at)) + between * (BUS.dwell + BUS.stopPenalty);
    }
    return this.eta(b, idx);
  }

  riderCarOf(line: string): Bus | null {
    const b = this.buses[this.riderBus];
    return b && line === this.track.id ? b : null;
  }

  /** 下一站下车: the rider gets off at the next stop (every loop stop is a stop; this sets the destination). */
  requestNextStop(): string | null {
    const bus = this.buses[this.riderBus];
    if (!bus || !bus.rider) return null;
    // running (or held between stops by a hop-off brake): the stop it heads for; dwelling: the one after it
    const st = bus.mode === 'dwell' ? this.track.stops[(bus.next + 1) % this.track.stops.length] : this.track.stops[bus.next];
    bus.dropoff = st.id;
    bus.lapFrom = null;
    return st.id;
  }

  /** Is a bus inside interlock box `id` (its body overlapping the box span)? */
  occupies(id: string): boolean {
    const box = this.boxes.find(b => b.id === id);
    if (!box) return false;
    return this.buses.some(b => this.overlapsBox(b, box));
  }

  /**
   * (W5-T part c) Is a bus due at interlock box `id`: not in it yet, its nose within `within` u of the box's start? A
   * cable car outside the box's part then leaves the box to the bus (world/transitLine.ts free): the loop shares 70 u of
   * California St with the cable cars down to their Drumm terminus and 43 u of Hyde St with the Hyde St turntable, and
   * a car starting down there made the bus stand 23–46 s (a car's trip down, its reversal or turn, and back).
   */
  boxDue(id: string, within: number): boolean {
    const box = this.boxes.find(b => b.id === id);
    if (!box) return false;
    // (a bus standing at a stop on its way is due once it pulls out)
    return this.buses.some(b => b.mode !== 'dwell' && !this.overlapsBox(b, box) && arcAhead(this.track, b.s + HALF, box.a0) <= within);
  }

  private overlapsBox(b: Bus, box: InterlockBox): boolean {
    const tr = this.track;
    // the box, seen from the bus's rear: the bus [s − HALF, s + HALF] overlaps [a0, a1]
    const toStart = arcAhead(tr, b.s - HALF, box.a0), len = box.a1 - box.a0;
    return toStart <= BUS.length || toStart > tr.length - len;
  }

  /**
   * Bring an unseen bus in so it reaches stop `idx` within 15 s: placed moving at the profile speed, far enough upstream
   * for a ≈ 11 s run (never behind the previous stop), out of sight, away from the player, with a clear road ahead and
   * behind. The bus nearest to being useless (out of sight, not the rider's) is the one moved.
   */
  private bringIn(idx: number, relaxed = false): Bus | null {
    const tr = this.track, stop = tr.stops[idx];
    const prev = tr.stops[(idx - 1 + tr.stops.length) % tr.stops.length];
    const room = arcAhead(tr, prev.at, stop.at);
    const vis = this.opts.visible ?? (() => false);
    const viewer = this.opts.viewer?.();
    // (W5-T2) relaxed (the rider has waited WAIT_RELAX s): a spot in view is fine once it lies beyond the far LOD
    const hidden = (x: number, z: number) => !vis(x, z) || (relaxed && !!viewer && Math.hypot(x - viewer.x, z - viewer.z) >= BUS.relaxDistance);
    const cur = this.buses[this.riderBus];
    const now = cur ? this.eta(cur, idx) + (cur.mode === 'run' && cur.still > BUS.stallCounts ? cur.still : 0) : Infinity;
    for (const secs of DISPATCH_RUN) {
      // walk back from the stop until the unhindered run takes `secs`
      let back = 20;
      while (back < room - 2 && runSeconds(tr, stop.at - back, stop.at) < secs) back += 4;
      back = Math.min(back, room - 2);
      if (back < 12) continue;
      const place = normArc(tr, stop.at - back);
      const at = trackPoint(tr, place, tmpA);
      if (!hidden(at.x, at.z)) continue;
      if (viewer && Math.hypot(at.x - viewer.x, at.z - viewer.z) < 22) continue;
      const cands = this.buses.filter(b => !b.rider && hidden(b.pose.x, b.pose.z) && !(viewer && Math.hypot(b.pose.x - viewer.x, b.pose.z - viewer.z) < 60));
      for (const b of cands) {
        const clear = this.buses.every(o => o === b || Math.min(arcAhead(tr, place, o.s), arcAhead(tr, o.s, place)) > BUS.length + BUS.gap + 4);
        if (!clear) continue;
        // (W5-T2) never a placement that arrives later than the bus already coming (the farther spots are a fallback)
        const v0 = limitAt(tr, place), was = { s: b.s, v: b.v, mode: b.mode, timer: b.timer, station: b.station, next: b.next, lateral: b.lateral, still: b.still, approached: b.approached, waitBox: b.waitBox };
        b.s = place; b.v = v0; b.mode = 'run'; b.timer = 0; b.station = null; b.next = idx; b.lateral = 0; b.still = 0;
        b.approached = null; b.waitBox = -1;
        const e = this.eta(b, idx);
        if (e > BUS.dispatchMax || e >= now - 3) { Object.assign(b, was); continue; }
        this.updatePose(b);
        this.events.push({ what: 'dispatch', bus: b.index, line: tr.id, station: stop.id });
        return b;
      }
    }
    return null;
  }

  /** Once a second while the rider waits: hand the pickup to a bus that now gets there clearly sooner, or dispatch. */
  private reassign() {
    const req = this.req, st = this.status, cur = this.buses[this.riderBus];
    if (!req || !st || !cur) return;
    const idx = this.stopIndex(req.station);
    // (W5-T2) a bus coming for the rider that stands still (held up on the way) is not "19 s away" for good: its stand
    // counts, so another bus takes over or one is brought in (Lands End: quoted 19 s, the rider waited > 50 s)
    const stood = cur.mode === 'run' && cur.still > BUS.stallCounts ? cur.still : 0;
    let best = cur, bestEta = this.eta(cur, idx) + stood;
    for (const b of this.buses) {
      if (b === cur || b.rider) continue;
      const e = this.eta(b, idx);
      if (e < bestEta - 3) { best = b; bestEta = e; }
    }
    if (bestEta > BUS.dispatchIfOver) {
      const moved = this.bringIn(idx, this.waited >= BUS.waitRelax);
      if (moved) { best = moved; bestEta = this.eta(moved, idx); }
    }
    st.eta = bestEta;
    if (best === cur) return;
    cur.pickup = null; cur.dropoff = null; cur.lapFrom = null;
    this.assign(best, req);
    this.riderBus = best.index;
    st.car = best.index;
    if (best.station === req.station && best.mode === 'dwell') this.markHere(best);
  }

  // -------------------------------------------------------------------------
  // Step
  // -------------------------------------------------------------------------

  step(dt: number) {
    if (dt <= 0) return;
    this.time += dt;
    for (const b of this.buses) this.stepBus(b, dt);
    for (const b of this.buses) this.updatePose(b);
    this.updateStatus(dt);
  }

  /** set by obstacle(): the person on foot is what the bus stops short of */
  private viewerBinds = false;
  /** set by obstacle(): what the nearest obstacle is (W5-T2) */
  private obWhy: BusWhy = 'run';
  private obOf = '';
  private readonly roadWho = { kind: '' };

  /**
   * Distance from the bus centre to the nearest obstacle ahead (the bus ahead's tail, a blocked box, a person), ∞ if none.
   * `toStop`: the arc to the stop it will rest at (verify D3: someone past its nose there is not in its way).
   */
  private obstacle(b: Bus, toStop = Infinity): number {
    const tr = this.track;
    let d = Infinity;
    this.obWhy = 'run'; this.obOf = '';
    for (const o of this.buses) {
      if (o === b) continue;
      const a = arcAhead(tr, b.s, o.s);
      if (a > 0.01 && a < 200 && a - BUS.length - BUS.gap < d) { d = a - BUS.length - BUS.gap; this.obWhy = 'bus-ahead'; this.obOf = `bus#${o.index}`; }
    }
    b.waitBox = -1;
    for (let i = 0; i < this.boxes.length; i++) {
      const box = this.boxes[i];
      if (this.overlapsBox(b, box)) continue;
      const a = arcAhead(tr, b.s + HALF, box.a0);
      if (a > 60) continue;
      if (box.blocked()) { b.waitBox = i; if (a - 1 < d) { d = a - 1; this.obWhy = 'box'; this.obOf = box.id; } }
    }
    this.roadWho.kind = '';
    const road = this.opts.roadAhead?.(b, this.roadWho);
    if (road !== undefined && road < Infinity && road - HALF - 2.2 < d) { d = road - HALF - 2.2; this.obWhy = 'road'; this.obOf = this.roadWho.kind; }
    const viewer = this.opts.viewer?.();
    this.viewerBinds = false;
    if (viewer?.onFoot) {
      const ahead = this.onRoadAhead(b, viewer.x, viewer.z);
      if (ahead !== null && ahead - toStop < PERSON_CLEAR) {
        if (ahead - 3 <= d) { this.viewerBinds = true; this.obWhy = 'person'; this.obOf = 'viewer'; }
        d = Math.min(d, ahead - 3);
        if (ahead < 12 && b.v > 1 && this.time - b.hornAt > 4) { b.hornAt = this.time; this.events.push({ what: 'horn', bus: b.index, line: tr.id }); }
      }
    }
    return d;
  }

  /** Longest a bus has stood short of the person on foot (s): game/transit.ts asks them to step aside. */
  viewerHeld(): number {
    let t = 0;
    for (const b of this.buses) if (b.held > t) t = b.held;
    return t;
  }

  /**
   * Arc distance ahead of the bus's nose to a person standing in its path (within 1.5 u of the track ahead), or null.
   * (W5-T part c) Measured along the track, not down the bus's heading: on a bend a straight ray from the nose passed
   * someone standing beside the road (off at the Golden Gate Bridge stop, by its pole) and the bus waited for them 22 s.
   */
  private onRoadAhead(b: Bus, x: number, z: number): number | null {
    const dx = x - b.pose.x, dz = z - b.pose.z;
    if (dx * dx + dz * dz > 20 * 20) return null;
    for (let a = 0; a <= 18 - HALF; a += 0.5) {
      const p = trackPoint(this.track, b.s + HALF + a, tmpP);
      if (Math.hypot(x - p.x, z - p.z) < 1.5) return a;
    }
    return null;
  }

  private stepBus(b: Bus, dt: number) {
    const tr = this.track;
    const s0 = b.s;
    const stopReq = b.rider ? platformStop(tr.id) : null;
    if (stopReq && !b.braking) b.brakeRate = Math.max(BUS.decel, b.v / Math.max(0.05, stopReq.within - stopReq.since));
    b.braking = !!stopReq;
    const kerb = stopReq ? BUS.kerbShift : 0;
    b.lateral += Math.max(-0.8 * dt, Math.min(0.8 * dt, kerb - b.lateral));
    if (b.mode === 'dwell') {
      b.v = 0;
      b.timer -= dt;
      if (b.why !== 'board' && b.why !== 'stop-ahead' && b.why !== 'hop-off') { b.why = 'dwell'; b.whyOf = b.station ?? ''; }
      if (b.timer <= 0) this.leave(b);
    } else {
      const stop = tr.stops[b.next];
      const toStop = Math.max(0, arcAhead(tr, b.s, stop.at));
      const obst = this.obstacle(b, toStop);
      const profile = limitAt(tr, b.s), braking = Math.sqrt(2 * BUS.decel * toStop);
      let limit = Math.min(profile, braking);
      // (W5-T2) the reason: the nearest obstacle when it is what limits the speed, else the stop ahead, else nothing
      b.why = braking < profile ? 'stop' : 'run'; b.whyOf = braking < profile ? stop.id : '';
      if (obst < Infinity) {
        const ob = Math.sqrt(2 * BUS.decel * Math.max(0, obst));
        if (ob <= limit + 1e-6) { b.why = this.obWhy; b.whyOf = this.obOf; }
        limit = Math.min(limit, ob);
      }
      if (stopReq) b.why = 'hop-off';
      if (stopReq) {
        b.v = Math.max(0, b.v - b.brakeRate * dt);
        b.mode = b.v <= 0.02 ? 'hold' : 'run';
      } else {
        if (b.mode === 'hold') b.mode = 'run';
        b.v = b.v < limit ? Math.min(limit, b.v + BUS.accel * dt) : Math.max(limit, b.v - BUS.decel * 2.5 * dt);
      }
      let step = b.v * dt;
      if (step >= toStop) step = toStop;
      b.s = normArc(tr, b.s + step);
      if (b.rider) b.odometer += step;
      if (b.v > 0.02) b.station = null;
      // the approach event, 60 u before the stop
      if (b.approached !== stop.id && toStop - step <= BUS.approach) {
        b.approached = stop.id;
        this.events.push({ what: 'approach', bus: b.index, line: tr.id, station: stop.id, attraction: stop.attractions[0] });
      }
      if (toStop - step < 0.02 && !stopReq) this.arrive(b, stop);
    }
    b.held = b.mode !== 'dwell' && this.viewerBinds && b.v < 0.3 ? b.held + dt : 0;
    this.viewerBinds = false;
    b.still = Math.abs(b.s - s0) > 1e-4 ? 0 : b.still + dt;
  }

  private arrive(b: Bus, stop: TrackStop) {
    b.s = stop.at;
    b.v = 0;
    b.mode = 'dwell';
    b.station = stop.id;
    b.timer = BUS.dwell;
    if (b.rider) b.arrivals++;
    this.events.push({ what: 'arrive', bus: b.index, line: this.track.id, station: stop.id });
    this.events.push({ what: 'door', bus: b.index, line: this.track.id, station: stop.id });
    const st = this.status;
    if (st && this.riderBus === b.index) {
      if (!b.rider && b.pickup === stop.id) this.markHere(b);
      if (b.rider) {
        st.lastStation = stop.id;
        st.arrivals = b.arrivals;
        const lapDone = !b.lapFrom || b.odometer > this.track.length - 30;
        if (b.dropoff === stop.id && lapDone) { st.phase = 'arrived'; b.timer = Math.max(b.timer, 3); }
      }
    }
  }

  private leave(b: Bus) {
    // a rider still boarding / the bus waiting for its rider: hold
    if (this.status && this.riderBus === b.index && this.status.phase === 'here') { b.timer = 0.3; b.why = 'board'; b.whyOf = b.station ?? ''; return; }
    if (b.rider && platformStop(this.track.id)) { b.timer = 0.3; b.why = 'hop-off'; b.whyOf = ''; return; }
    // the stop ahead must be clear before pulling out (a bus dwelling right in front)
    const tr = this.track;
    const front = this.buses.find(o => o !== b && arcAhead(tr, b.s, o.s) > 0.01 && arcAhead(tr, b.s, o.s) < BUS.length + BUS.gap);
    if (front) { b.timer = 0.5; b.why = 'stop-ahead'; b.whyOf = `bus#${front.index}`; return; }
    b.why = 'run'; b.whyOf = '';
    b.mode = 'run';
    b.next = (tr.stops.findIndex(s => s.id === b.station) + 1) % tr.stops.length;
    if (b.station === null) b.next = this.nextStopAhead(b.s);
    this.events.push({ what: 'door', bus: b.index, line: tr.id, station: b.station });
    this.events.push({ what: 'depart', bus: b.index, line: tr.id, station: b.station });
  }

  private nextStopAhead(s: number): number {
    const tr = this.track;
    let best = 0, bd = Infinity;
    tr.stops.forEach((st, i) => { const d = arcAhead(tr, s, st.at); if (d > 0.05 && d < bd) { bd = d; best = i; } });
    return best;
  }

  /** Recompute a bus's world pose (axles on the road, pitch = grade, kerb shift, a little roll into curves). */
  updatePose(b: Bus) {
    const tr = this.track, pose = b.pose;
    const g = this.opts.groundY;
    const f = trackPoint(tr, b.s + BUS.axle, tmpA);
    const r = trackPoint(tr, b.s - BUS.axle, tmpB);
    const c = trackPoint(tr, b.s, tmpC);
    const yf = g ? g(f.x, f.z) ?? f.y : f.y, yr = g ? g(r.x, r.z) ?? r.y : r.y;
    const heading = Math.atan2(f.x - r.x, f.z - r.z);
    const base = Math.hypot(f.x - r.x, f.z - r.z) || 1;
    pose.heading = Number.isFinite(heading) && base > 0.5 ? heading : c.heading;
    pose.pitch = Math.atan2(yf - yr, base);
    pose.x = c.x - Math.cos(pose.heading) * b.lateral;
    pose.z = c.z + Math.sin(pose.heading) * b.lateral;
    pose.y = (yf + yr) / 2;
    // lean out of the curve: curvature from the heading change over the wheelbase
    const k = wrapAngle(trackPoint(tr, b.s + 3, tmpA).heading - trackPoint(tr, b.s - 3, tmpB).heading) / 6;
    pose.roll = Math.max(-0.05, Math.min(0.05, b.v * b.v * k * 0.012));
  }

  private updateStatus(dt: number) {
    const st = this.status;
    if (st?.phase === 'coming') this.waited += dt;
    if (st?.phase === 'coming' && (this.retry -= dt) <= 0) { this.retry = 1; this.reassign(); }
    const b = this.buses[this.riderBus];
    if (!st || !b) return;
    st.braking = b.braking;
    st.odometer = b.odometer;
    st.station = b.v < 0.02 ? b.station : null;
    if (st.phase === 'coming' && this.req) st.eta = this.eta(b, this.stopIndex(this.req.station));
    const nextIdx = b.mode === 'run' ? b.next : this.nextStopAhead(b.s);
    st.nextStop = st.phase === 'coming' ? this.req?.station ?? null : this.track.stops[nextIdx]?.id ?? null;
    st.nextEta = st.phase === 'coming' ? st.eta : this.eta(b, nextIdx);
  }

  /** Test helper: buses whose bodies overlap (arc distance < a body length) and buses inside a blocked box they entered while it was blocked. */
  violations(): string[] {
    const out: string[] = [];
    const tr = this.track;
    for (let i = 0; i < this.buses.length; i++) for (let j = i + 1; j < this.buses.length; j++) {
      const a = this.buses[i], b = this.buses[j];
      const d = Math.min(arcAhead(tr, a.s, b.s), arcAhead(tr, b.s, a.s));
      if (d < BUS.length - 0.1) out.push(`bus#${a.index} ${a.s.toFixed(1)} vs bus#${b.index} ${b.s.toFixed(1)}`);
    }
    return out;
  }
}
