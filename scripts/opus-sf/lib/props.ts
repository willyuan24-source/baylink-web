// Step 6 (plan §4.6): street trees (DataSF Street Tree List, 1 in 4), park / wood fill, lamps on primary and
// secondary streets, benches / bike racks at stops and curated places, transit stop poles.
import fs from 'node:fs';
import path from 'node:path';
import { PROP_KINDS, ROAD_FLAG } from '../../../src/opus-bay/world/sf/format';
import type { AreaPoly } from './areas';
import { type Ring, SpatialHash, bbox, hash01, pointInRing, segDist2 } from './geom';
import { RAW, elements } from './io';
import { type Land } from './land';
import { type Chain, type SegIndex, nearestSeg } from './roads';
import { inSlab, projPt } from './world';

export interface Prop { kind: number; variant: number; x: number; z: number; rot: number }
const K = (k: (typeof PROP_KINDS)[number]) => PROP_KINDS.indexOf(k);

export class FootprintIndex {
  private hash = new SpatialHash(8);
  private rings: Ring[] = [];
  add(r: Ring) { const [a, b, c, d] = bbox(r); this.hash.insert(this.rings.length, a, b, c, d); this.rings.push(r); }
  inside(x: number, z: number, pad = 0): boolean {
    for (const i of this.hash.query(x - pad, z - pad, x + pad, z + pad)) {
      const r = this.rings[i];
      if (pointInRing(x, z, r)) return true;
      if (pad > 0) for (let k = 0; k < r.length; k += 2) { const j = (k + 2) % r.length; if (segDist2(x, z, r[k], r[k + 1], r[j], r[j + 1]) < pad * pad) return true; }
    }
    return false;
  }
}

const PALM = /phoenix|washingtonia|syagrus|trachycarpus|butia|palm/i;
const PINE = /pinus|cupressus|sequoia|cedrus|araucaria|hesperocyparis|cypress|pine|juniper|podocarpus|redwood/i;

export function buildProps(opts: {
  land: Land; streets: SegIndex; footprints: FootprintIndex; chains: Chain[]; areas: AreaPoly[];
  anchors: { x: number; z: number }[]; stops: { x: number; z: number; rot: number }[]; log: (s: string) => void;
}): Prop[] {
  const { land, streets, footprints, chains, areas, anchors, stops, log } = opts;
  const out: Prop[] = [];
  const ok = (x: number, z: number, pad: number) => land.grid.at(x, z) === 1 && !inSlab(x, z) && !footprints.inside(x, z, pad);
  const count: Record<string, number> = {};
  const add = (kind: number, variant: number, x: number, z: number, rot: number) => { out.push({ kind, variant, x, z, rot }); count[PROP_KINDS[kind]] = (count[PROP_KINDS[kind]] ?? 0) + 1; };

  // street trees: DataSF (PDDL), every 4th tree id; crown clear of the roadway (moved to the curb band) and of junctions
  const trees = JSON.parse(fs.readFileSync(path.join(RAW, 'datasf-street-trees.json'), 'utf8')) as { rows: { treeid: string; species?: string; latitude?: string; longitude?: string; mapdbh?: string }[] };
  let moved = 0, vetoed = 0;
  for (const r of trees.rows) {
    const id = Number(r.treeid);
    if (!r.latitude || !r.longitude || id % 4 !== 0) continue;
    let [x, z] = projPt(Number(r.latitude), Number(r.longitude));
    const s = nearestSeg(streets, x, z, 8);
    if (s) {
      const hw = streets.width[s.i] / 2;
      if (s.d < hw - 0.9) {
        const ax = streets.seg[s.i * 4], az = streets.seg[s.i * 4 + 1];
        const side = (z - az) * s.dx - (x - ax) * s.dz >= 0 ? 1 : -1;
        const nx = -s.dz * side, nz = s.dx * side, shift = hw - 0.6 - s.d;
        x += nx * shift; z += nz * shift; moved++;
        const s2 = nearestSeg(streets, x, z, 6);
        if (s2 && s2.i !== s.i && s2.d < streets.width[s2.i] / 2 - 0.3) { vetoed++; continue; }
      }
    }
    if (!ok(x, z, 0.4)) { vetoed++; continue; }
    const sp = r.species ?? '';
    const dbh = Number(r.mapdbh ?? '0');
    if (PALM.test(sp)) add(K('palm'), 0, x, z, hash01(id, 3) * Math.PI * 2);
    else if (PINE.test(sp)) add(K('pine'), /pinus|pine/i.test(sp) ? 1 : 0, x, z, hash01(id, 3) * Math.PI * 2);
    else add(K('tree'), dbh > 20 ? 1 : dbh > 0 && dbh < 6 ? 2 : 0, x, z, hash01(id, 3) * Math.PI * 2);
  }
  log(`props: street trees ${count.tree ?? 0} + palms ${count.palm ?? 0} + conifers ${count.pine ?? 0} (1 in 4; ${moved} moved to the curb band, ${vetoed} vetoed)`);

  // woods and parks: jittered grid fill (woods 1 per 30 u², parks 1 per 140 u²), clear of paths and buildings
  let fill = 0;
  for (const a of areas) {
    if (a.cls !== 'forest' && a.cls !== 'park') continue;
    const step = a.cls === 'forest' ? Math.sqrt(30) : Math.sqrt(140);
    const [x0, z0, x1, z1] = bbox(a.rings[0]);
    for (let z = z0 + step / 2; z < z1; z += step) for (let x = x0 + step / 2; x < x1; x += step) {
      const jx = x + (hash01(Math.round(x * 10), Math.round(z * 10)) - 0.5) * step * 0.8, jz = z + (hash01(Math.round(z * 10), Math.round(x * 10)) - 0.5) * step * 0.8;
      if (!pointInRing(jx, jz, a.rings[0]) || a.rings.slice(1).some(h => pointInRing(jx, jz, h))) continue;
      const s = nearestSeg(streets, jx, jz, 4);
      if (s && s.d < streets.width[s.i] / 2 + 0.6) continue;
      if (!ok(jx, jz, 0.8)) continue;
      const h = hash01(Math.round(jx * 7), Math.round(jz * 7));
      if (a.cls === 'forest' || h < 0.35) add(K('pine'), h < 0.5 ? 0 : 1, jx, jz, h * 6.283); else add(K('tree'), h < 0.8 ? 0 : 1, jx, jz, h * 6.283);
      fill++;
    }
  }
  log(`props: ${fill} park / wood trees`);

  // lamps: every 9 u on both sides of primary / secondary streets (curb band), not on viaducts
  let lamps = 0;
  for (const c of chains) {
    if ((c.code !== 2 && c.code !== 3) || c.flags & ROAD_FLAG.deckOnly) continue;
    const p = c.xyz, off = c.width / 2 - 0.35;
    let carry = 4.5;
    for (let k = 3; k < p.length; k += 3) {
      const ax = p[k - 3], az = p[k - 1], bx = p[k], bz = p[k + 2];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 1e-6) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      let t = carry;
      for (; t < L; t += 9) {
        const x = ax + dx * t, z = az + dz * t;
        for (const side of [-1, 1]) {
          const lx = x - dz * off * side, lz = z + dx * off * side;
          const s = nearestSeg(streets, lx, lz, 5);
          if (s && s.d < streets.width[s.i] / 2 - 0.6) continue; // inside a crossing street
          if (!ok(lx, lz, 0.3)) continue;
          add(K('lamp'), 0, lx, lz, Math.atan2(dz * side, -dx * side)); lamps++;
        }
      }
      carry = t - L;
    }
  }
  // transit stop poles, a bench and a bike rack beside each; benches + racks at curated places
  const near = (x: number, z: number, list: Prop[], r: number) => list.some(p => Math.abs(p.x - x) < r && Math.abs(p.z - z) < r);
  const extras: Prop[] = [];
  for (const s of stops) {
    if (!ok(s.x, s.z, 0.2)) continue;
    add(K('stop'), 0, s.x, s.z, s.rot);
    const bx = s.x + Math.sin(s.rot) * 1.4, bz = s.z + Math.cos(s.rot) * 1.4;
    if (ok(bx, bz, 0.4) && !near(bx, bz, extras, 1)) { add(K('bench'), 0, bx, bz, s.rot); extras.push(out[out.length - 1]); }
  }
  for (const a of anchors) {
    for (const [dx, dz, kind] of [[2.2, 0.8, 'bench'], [-2.2, 0.8, 'bench'], [0.6, -2.4, 'bike-rack']] as const) {
      const x = a.x + dx, z = a.z + dz;
      if (!ok(x, z, 0.5) || near(x, z, extras, 1.2)) continue;
      add(K(kind), 0, x, z, Math.atan2(a.x - x, a.z - z)); extras.push(out[out.length - 1]);
    }
  }
  log(`props: ${lamps} lamps; ${JSON.stringify(count)}`);
  return out;
}

/** Tram / cable-car stop nodes (railway=tram_stop), with a heading along the nearest track. */
export function tramStops(): { lat: number; lon: number; id: number; name: string }[] {
  const out: { lat: number; lon: number; id: number; name: string }[] = [];
  for (const e of elements('railways')) if (e.type === 'node' && e.tags?.railway === 'tram_stop' && e.lat !== undefined) out.push({ lat: e.lat, lon: e.lon!, id: e.id, name: e.tags.name ?? '' });
  return out;
}
