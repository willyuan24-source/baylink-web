import { FL, type FLine, cyclePoint, legAt, sAtU, uAtS } from '../../data/fline';
import { CABLE, type TransitData } from '../../data/transit';
import type { InterlockBox } from '../busSystem';
import type { FCar, StreetcarSystem } from '../flineSystem';
import type { BodyDims } from '../lineTrack';
import type { CableSystem } from '../transitLine';
import type { LineFleet } from './lineFleet';

/**
 * Wave 4 · lane T: how the sightseeing buses share the street with the cable cars and the city F-line (pure glue, used
 * by world/transitLayer.ts and tested in node exactly as the game runs it):
 *
 *   interlockLines(data, fline)      the other tracks the loop's interlock boxes are built against (busInterlocks): the
 *                                    cable lines on their extended arcs (turntable stubs included), the F-line's whole
 *                                    cycle on the cars' arc u (Market St both ways, the Castro balloon loop, the hero)
 *   boxBlocked(cable, fline, …)      is a vehicle of that line in its part of a box: a cable car's held span (block
 *                                    authority included), an F-line car's body on the cycle
 *   busAheadOfFCar(fleet, fline, car) an F-line car's view down its track: the edge of an F-line box part a bus
 *                                    occupies (the car waits there, as the bus waits at a box while a car is in it)
 *
 * The other direction: CableSystem.free() refuses a span through a box a bus occupies (world/transitLine.ts), and the
 * bus waits at a box while `blocked()` (world/busSystem.ts). A bus inside a box never stops for the box itself.
 *
 * (W5-bus, the owner's "the tour bus stands behind a car and never moves") The bus goes first where it can: a cable car
 * or streetcar leaves a shared stretch to a bus that would find it in there (BusSystem.boxDueIn against the time it
 * would need to be out again), cuts its stop inside one short while a bus waits (`busWaitsForFCar`, hurryDwell) — but
 * a streetcar another one in a part waits for never stands still for a bus (`neededByAPart`: the F-line's Market St
 * stem is single track between passing places; that wait deadlocked for good in node). Measured (node, the loop with
 * the cable cars and the F-line): bus waits at a box over 3 s 13 an hour, up to 26 s → 0–2 in two hours, ≤ 12 s. Left:
 * the 148 u of Market St where the loop runs on the streetcar stem itself — two streetcars meeting at a passing place
 * in there still hold a bus up to ≈ 45 s (a data fix: the loop in the kerb lane clear of the stem).
 */

export interface FLineHost { line: FLine; sys: Pick<StreetcarSystem, 'cars'> & Partial<Pick<StreetcarSystem, 'pendingHold' | 'waitsOn'>> }

export function interlockLines(data: Pick<TransitData, 'lines'>, fline: FLineHost | null): { id: string; path: number[]; tunnels: []; body: BodyDims }[] {
  // the cable cars' bodies, with their passing step-aside as the lateral allowance
  const out: { id: string; path: number[]; tunnels: []; body: BodyDims }[] = data.lines.map(l => ({ id: l.id, path: Array.from(l.xyz), tunnels: [], body: { halfL: CABLE.length / 2, halfW: CABLE.width / 2, margin: CABLE.passOffset } }));
  // the F-line's whole cycle, on the cars' own arc u (both lanes of Market St, the Castro balloon loop, the Pier 39
  // turnaround): a box part is then simply a stretch of u (the loop at Castro and 17th meets the bus's Castro St hairpin)
  if (fline) out.push({ id: 'f-line', path: Array.from(fline.line.xyz), tunnels: [], body: { halfL: FL.half, halfW: 1.05, margin: 0.2 } });
  return out;
}

/** Where arc `u` lies ahead of `a` on the F-line's cycle (0 … length). */
const aheadOn = (line: Pick<FLine, 'length'>, a: number, u: number) => ((((u - a) % line.length) + line.length) % line.length);

/** A moving car closer than this to a box part (u) could not stop short of it any more: it counts as in it. */
export const BOX_APPROACH = 14;

/**
 * Is a vehicle of `line` in (or about to enter) its part [b0, b1] of an interlock box? A car's body, widened ahead by
 * BOX_APPROACH while it moves (it could not stop short: the braking distance from full cable / streetcar speed). Cars
 * further out stop at the part's edge by themselves while a bus is in the box (CableSystem boxAhead, flineSystem
 * roadAhead), so a cable car's block authority over a long block no longer holds the bus back for the whole block (it
 * did: ≈ 60 s at California & Drumm).
 */
export function boxBlocked(cable: Pick<CableSystem, 'cars'>, fline: FLineHost | null, line: string, b0: number, b1: number): boolean {
  if (line === 'f-line') {
    if (!fline) return false;
    // a car's centre in the part [b0, b1] of the cycle (+ the approach ahead while moving). (W5-bus) The part is already
    // the car-centre span where the two bodies touch (lineTrack bodySpans), padded 3 u each way (busInterlocks): with
    // the car's half length on top, a streetcar waiting at the Market St passing place 2 u past the part held the bus
    // 17–37 s while it waited for the outbound car's run through the single track
    for (const c of fline.sys.cars) {
      const ahead = Math.abs(c.v) > 0.5 ? BOX_APPROACH : 0;
      if (aheadOn(fline.line, b0 - ahead, c.u) < b1 - b0 + ahead) return true;
    }
    return false;
  }
  const half = CABLE.length / 2 + 0.3;
  for (const c of cable.cars) {
    if (c.line.id !== line || c.parked) continue;
    const ahead = c.mode === 'run' && c.v > 0.5 ? BOX_APPROACH * c.dir : 0;
    const a = Math.min(c.s - half, c.s - half + ahead), b = Math.max(c.s + half, c.s + half + ahead);
    if (b > b0 && a < b1) return true;
  }
  return false;
}

/**
 * (W5-bus) A streetcar leaves a box part to a bus arriving before it would be out of the part again (plus this, s) …
 * for at most F_YIELD_MAX s (a bus held up on its way never keeps a car for long); a car already too close to stop
 * short of the part goes on, and none yields while another streetcar in or by a part waits for it (a single-track
 * block). A bus waiting at the box (or within 30 u of it) reserves the stretch: no car goes in any more but one a car
 * inside it waits for, and those inside drain out (it waited 43 s on Market St while one car after another went in).
 */
const F_BOX_MARGIN = 4;
/** (W5-bus) what a single-track block wait inside a part is counted as (s) */
const F_BLOCK_WAIT = 20;
const F_YIELD_MAX = 40;
/** the part-clearing estimate never counts a streetcar faster than this (u/s: a car pulling away from its stop) */
const F_RUN = 9;
const _cp = { x: 0, y: 0, z: 0, heading: 0, i: 0, t: 0 };

/** (W5-bus) Seconds a streetcar takes from cycle position u0 to u0 + d at its speed limits (vertex vlim, ≤ F_RUN). */
function fRunSeconds(L: FLine, u0: number, d: number): number {
  let t = 0;
  for (let a = 0; a < d; a += 2) {
    const i = cyclePoint(L, u0 + a, _cp).i;
    t += Math.min(2, d - a) / Math.max(2, Math.min(F_RUN, L.vlim[i], L.vlim[(i + 1) % L.vlim.length]));
  }
  return t;
}

/** (W5-bus) per streetcar: the box it leaves to a bus now and since when (the bus system's clock) */
const CHAIN: boolean[] = [];
const fYield = new WeakMap<object, { box: string; since: number }>();
/** (deadlock-review) how far ahead of a car's front (u) a box part is looked at: its passing place before the part too */
const F_LOOK = 110;

/**
 * (deadlock-review) Per box part (its `other` record): the cycle u of the passing place a streetcar leaving the part to a
 * bus waits at — the hold point (world/flineSystem.ts nextNeed) of the single-track block the part's first edge lies in
 * — or NaN (the edge off the single track, or no passing place before it). Standing at the edge itself the car held
 * that block; a car in the part coming the other way (or leaving it) needed the block, so the waiting car went in after
 * all (`neededByAPart`) and the bus waited out its run through the whole part: 38–41 s on Market St (node, the loop
 * ridden for hours; the leftover the W5-bus proof bounded at 60 s).
 */
const holdOf = new WeakMap<object, number>();
function holdBefore(L: FLine, part: { b0: number }): number {
  const hit = holdOf.get(part);
  if (hit !== undefined) return hit;
  let hu = NaN;
  const leg = legAt(L, part.b0), s = sAtU(L, part.b0), b = L.bounds, m = b.length - 1;
  if ((leg === 1 || leg === 3) && s > 0 && s < L.sJoin) {
    // leg 1 runs toward Castro (s falling): the first passing place above the edge; leg 3 the last one below it
    let hs = NaN;
    if (leg === 1) { for (let j = 1; j < m; j++) if (b[j] > s + 0.5) { hs = b[j]; break; } }
    else for (let j = m - 1; j >= 1; j--) if (b[j] < s - 0.5) { hs = b[j]; break; }
    if (!Number.isNaN(hs)) hu = uAtS(L, leg, hs);
  }
  holdOf.set(part, hu);
  return hu;
}

/** (deadlock-review) Does a bus wait at this box? (a plain loop: it runs for every streetcar every frame) */
function busWaitsAt(fleet: Pick<LineFleet, 'bus'>, box: InterlockBox): boolean {
  const bus = fleet.bus;
  for (let i = 0; i < bus.buses.length; i++) { const b = bus.buses[i]; if (b.why === 'box' && bus.boxes[b.waitBox] === box) return true; }
  return false;
}

/**
 * An F-line car's view down its track (flineSystem `roadAhead`, u from the car's centre): the edge of an interlock box
 * part a bus occupies (the front stops 0.5 u short of it: roadGap = road − half − 1.5), ∞ if none ahead. (W5-bus) Also
 * the edge of a part a bus will reach before the car could be out of it again (its run through the part and a stop's
 * wait there), or that a bus waits at: the rider's car (and the one fetching them) excepted, and only while the car
 * can still stop short — a bus stood 11–17 s on Market St at Castro while a streetcar dwelt at its stop in the part.
 */
export function busAheadOfFCar(fleet: Pick<LineFleet, 'bus'>, fline: FLineHost, car: { u: number; v?: number; rider?: boolean; pickup?: number }): number {
  // (only the boxes: every place a bus and a car could touch is one, built from both bodies. A plain "bus ahead" test
  // deadlocked at the Castro hairpin: the car stopped for a bus that was waiting at the box for that very car.)
  let best = Infinity;
  const L = fline.line, v = car.v ?? 0;
  // (deadlock-review) the room a moving car needs to stop (a car standing where it would wait stays)
  const stopping = v > 0.3 ? (v * v) / (2 * FL.dec) + 1 : 0;
  const now = fleet.bus.time;
  const y = fYield.get(car);
  let yielding: string | null = null;
  // never while a streetcar in (or by) any part — one a bus may wait for — waits for this one, directly or through
  // others (its next single-track block: Market St between its passing places): the bus would wait for that one, it
  // for this one, and this one for the bus
  const needed = neededByAPart(fleet, fline, car);
  // cars always run forward on the cycle: a part ahead of the car's front, not yet entered
  for (const box of fleet.bus.boxes) {
    const o = box.other;
    if (!o || o.line !== 'f-line') continue;
    const toEdge = aheadOn(L, car.u + FL.half, o.b0);
    if (toEdge > F_LOOK || aheadOn(L, o.b0, car.u + FL.half) < o.b1 - o.b0) continue;
    if (fleet.bus.occupies(box.id)) { best = Math.min(best, toEdge + FL.half + 1); continue; }
    // (deadlock-review) where it waits (centre, u from here): at the passing place before the part's single-track block
    // (it never takes that block while it waits: flineSystem takes none past where the road stops a car), else with
    // its front 0.5 u short of the edge
    const hu = holdBefore(L, o), hd = Number.isNaN(hu) ? NaN : aheadOn(L, car.u, hu);
    const stopD = !Number.isNaN(hd) && hd <= toEdge + FL.half ? hd : toEdge - 0.5;
    if (car.rider || (car.pickup ?? -1) >= 0 || (!y && stopD < stopping)) continue;
    // a bus waiting at the box (or about to reach it): the stretch is the bus's — nobody new goes in but a car one
    // inside waits for (it could never leave, and the bus waits for it); the ones inside drain out
    const reserved = busWaitsAt(fleet, box) || fleet.bus.boxDue(box.id, 30);
    if (needed) continue;
    if (!reserved) {
      // the car's time in the part: its run through it (its body clear) and a stop's wait in it
      let clear = fRunSeconds(L, car.u, toEdge + o.b1 - o.b0 + 2 * FL.half) + 2;
      for (const st of L.stops) if (st.dwell && aheadOn(L, o.b0, st.u) < o.b1 - o.b0) clear += st.wait;
      // a block it cannot take yet, held for inside the part: it would stand there (an opposite car's run through)
      const hold = fline.sys.pendingHold?.(car as FCar) ?? NaN;
      if (!Number.isNaN(hold) && aheadOn(L, o.b0 - FL.half, hold) < o.b1 - o.b0 + 2 * FL.half) clear += F_BLOCK_WAIT;
      if (fleet.bus.boxDueIn(box.id) >= clear + F_BOX_MARGIN) continue;
      const since = y && y.box === box.id ? y.since : now;
      if (now - since > F_YIELD_MAX) continue;
    }
    yielding = box.id;
    if (!y || y.box !== box.id) fYield.set(car, { box: box.id, since: now });
    best = Math.min(best, stopD + FL.half + 1.5);
  }
  if (!yielding && y) fYield.delete(car);
  return best;
}

/**
 * (W5-bus) Is streetcar `car` one a car in (or by) a box part waits for — directly, or through the cars those wait for
 * (their next single-track blocks)? Then it must never stand still for a bus: a bus waiting for that car would wait for
 * good (a 391 s deadlock on Market St in node before this).
 */
function neededByAPart(fleet: Pick<LineFleet, 'bus'>, fline: FLineHost, car: object): boolean {
  const sys = fline.sys, waitsOn = sys.waitsOn;
  if (!waitsOn) return false;
  const L = fline.line, cars = sys.cars, boxes = fleet.bus.boxes;
  // (deadlock-review) one flag per car, plain loops: it runs for each streetcar every frame (the Set, its iterator and
  // a closure per car were garbage every frame)
  const chain = CHAIN;
  let n = 0, self = false;
  for (let i = 0; i < cars.length; i++) {
    const o = cars[i];
    let near = false;
    for (let j = 0; j < boxes.length && !near; j++) {
      const p = boxes[j].other;
      if (p && p.line === 'f-line' && aheadOn(L, p.b0 - BOX_APPROACH, o.u) < p.b1 - p.b0 + BOX_APPROACH + FL.half) near = true;
    }
    chain[i] = near;
    if (near) { n++; if (o === car) self = true; }
  }
  if (self && n === 1) return false;
  // what the cars in the parts wait for, and what those wait for …
  for (let grew = true; grew;) {
    grew = false;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (chain[i] && c !== car) continue;
      let waited = false;
      for (let j = 0; j < cars.length && !waited; j++) if (chain[j] && j !== i && waitsOn.call(sys, cars[j], c)) waited = true;
      if (!waited) continue;
      if (c === car) return true;
      chain[i] = true;
      grew = true;
    }
  }
  return false;
}

/**
 * (W5-bus) Does a bus wait at (or stand just short of) an interlock box whose part this streetcar stands in? Then the
 * car's stop there is cut to a second (flineSystem `hurryDwell`), as the cable cars' (world/transitLine.ts HURRY_DWELL).
 */
export function busWaitsForFCar(fleet: Pick<LineFleet, 'bus'>, fline: FLineHost, car: { u: number }): boolean {
  for (const box of fleet.bus.boxes) {
    const o = box.other;
    if (!o || o.line !== 'f-line') continue;
    if (aheadOn(fline.line, o.b0 - FL.half, car.u) > o.b1 - o.b0 + 2 * FL.half) continue;
    if (fleet.bus.boxDue(box.id, 24)) return true;
  }
  return false;
}
