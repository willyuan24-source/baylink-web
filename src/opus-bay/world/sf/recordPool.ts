import type { RoadVehicle } from './streetNet';

/**
 * (wave 4, verify F4) Reusable records for a source that pushes into consumer arrays every frame (the obstacle sources of
 * actors/view.ts, the road-vehicle sources of world/sf/streetNet.ts): one pool per consumer array. A consumer clears its array before each
 * query, so the records of its previous query are free again; no garbage each frame.
 *   const pool = new RecordPool(() => ({ x: 0, z: 0, r: 0, kind: '' }));
 *   pool.begin(out); … const o = pool.next(); o.x = …; out.push(o);
 */
export class RecordPool<T> {
  private readonly pools = new WeakMap<object, T[]>();
  private cur: T[] = [];
  private n = 0;
  private readonly make: () => T;
  constructor(make: () => T) { this.make = make; }
  /** start a query that fills `out` */
  begin(out: object): this {
    let p = this.pools.get(out);
    if (!p) this.pools.set(out, (p = []));
    this.cur = p;
    this.n = 0;
    return this;
  }
  /** the next record of this query (set every field, then push it) */
  next(): T {
    let r = this.cur[this.n];
    if (!r) { r = this.make(); this.cur[this.n] = r; }
    this.n++;
    return r;
  }
}
/** A pool of walker-obstacle records ({ x, z, r, kind }). */
export const obstaclePool = () => new RecordPool(() => ({ x: 0, z: 0, r: 0, kind: '' }));
/** A pool of road-vehicle records (world/sf/streetNet.ts RoadVehicle). */
export const vehiclePool = () => new RecordPool<RoadVehicle>(() => ({ x: 0, z: 0, heading: 0, v: 0, halfL: 0, halfW: 0, kind: 'traffic', line: '' }));
/** Fill a pooled road-vehicle record. */
export function setVehicle(o: RoadVehicle, x: number, z: number, heading: number, v: number, halfL: number, halfW: number, kind: RoadVehicle['kind'], line: string): RoadVehicle {
  o.x = x; o.z = z; o.heading = heading; o.v = v; o.halfL = halfL; o.halfW = halfW; o.kind = kind; o.line = line;
  return o;
}
