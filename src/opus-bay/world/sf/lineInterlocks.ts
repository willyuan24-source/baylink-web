import { FL, type FLine } from '../../data/fline';
import { CABLE, type TransitData } from '../../data/transit';
import type { StreetcarSystem } from '../flineSystem';
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
 */

export interface FLineHost { line: FLine; sys: Pick<StreetcarSystem, 'cars'> }

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

/** Is a vehicle of `line` in its part [b0, b1] of an interlock box? */
export function boxBlocked(cable: Pick<CableSystem, 'cars' | 'span'>, fline: FLineHost | null, line: string, b0: number, b1: number): boolean {
  if (line === 'f-line') {
    if (!fline) return false;
    // a car's body [u − half, u + half] overlaps the part [b0, b1] of the cycle
    for (const c of fline.sys.cars) if (aheadOn(fline.line, b0 - FL.half, c.u) < b1 - b0 + 2 * FL.half) return true;
    return false;
  }
  for (const c of cable.cars) {
    if (c.line.id !== line) continue;
    const [a, b] = cable.span(c);
    if (b > b0 && a < b1) return true;
  }
  return false;
}

/**
 * An F-line car's view down its track (flineSystem `roadAhead`, u from the car's centre): the edge of an interlock box
 * part a bus occupies (the front stops 0.5 u short of it: roadGap = road − half − 1.5), ∞ if none ahead.
 */
export function busAheadOfFCar(fleet: Pick<LineFleet, 'bus'>, fline: FLineHost, car: { u: number }): number {
  // (only the boxes: every place a bus and a car could touch is one, built from both bodies. A plain "bus ahead" test
  // deadlocked at the Castro hairpin: the car stopped for a bus that was waiting at the box for that very car.)
  let best = Infinity;
  // cars always run forward on the cycle: a part ahead of the car's front, not yet entered
  for (const box of fleet.bus.boxes) {
    const o = box.other;
    if (!o || o.line !== 'f-line') continue;
    const toEdge = aheadOn(fline.line, car.u + FL.half, o.b0);
    if (toEdge > 60 || aheadOn(fline.line, o.b0, car.u + FL.half) < o.b1 - o.b0) continue;
    if (fleet.bus.occupies(box.id)) best = Math.min(best, toEdge + FL.half + 1);
  }
  return best;
}
