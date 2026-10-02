import type { Bilingual } from '../core/types';
import type * as Transit from './transit';
import type { CableLine, CableStop, TransitData, TransitFileJson, TransitStation, Turntable } from './transit';

/**
 * W8-P3 (lane P; sf-w8-lead.md §3 row P: GameRoot ≤ 255 KB gzip) · the cable-car network builder, moved verbatim out of
 * `data/transit.ts`: it runs once per page, in city mode, when `loadTransit()` has fetched transit.json — so it is a lazy
 * chunk that `loadTransit` imports with the file (it was in GameRoot's chunk, ≈ 2 KB gzip, for every player and every
 * district visit). `data/transit.ts` keeps the `buildTransit(file)` export (bound to these functions once loaded; node
 * loads it at once: tests, scripts) and hands its own helpers in as `deps`: this module imports types only, so the
 * node-side load at `data/transit.ts`'s top level can never wait on itself.
 */
export interface BuildDeps {
  CABLE: Pick<typeof Transit.CABLE, 'stationMerge'>;
  CROSSING_STOP: number;
  pointAt: typeof Transit.pointAt;
  stationSlug: (name: string) => string;
  shortStationName: (name: string) => string;
  stationZh: (name: string) => string;
  turntableZh: (stationName: string) => string;
  glossName: (name: Bilingual) => Bilingual;
}

type P3 = [number, number, number];

function pointsOf(path: number[]): P3[] {
  const out: P3[] = [];
  for (let i = 0; i + 2 < path.length; i += 3) out.push([path[i], path[i + 1], path[i + 2]]);
  return out;
}

/** A smooth stub from `from` (tangent `dir`) to the turntable centre `to`: straight when nearly in line, else a quadratic curve. */
function stubPoints(from: P3, dir: { x: number; z: number }, to: { x: number; z: number }, y: number): P3[] {
  const tx = to.x - from[0], tz = to.z - from[2];
  const along = tx * dir.x + tz * dir.z, side = tx * dir.z - tz * dir.x;
  if (Math.abs(side) < 0.6 || along <= 0) return [[to.x, y, to.z]];
  const c = { x: from[0] + dir.x * along * 0.6, z: from[2] + dir.z * along * 0.6 };
  const out: P3[] = [];
  const steps = Math.max(4, Math.ceil(Math.hypot(tx, tz) / 1.2));
  for (let k = 1; k <= steps; k++) {
    const t = k / steps, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t;
    out.push([a * from[0] + b * c.x + d * to.x, from[1] + (y - from[1]) * t, a * from[2] + b * c.z + d * to.z]);
  }
  return out;
}

function cumulative(pts: P3[]): Float32Array {
  const cum = new Float32Array(pts.length);
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
  return cum;
}

const TURNTABLE_NAMES: Record<string, Bilingual> = {
  'powell-market': { zh: '鲍威尔街 · 市场街转车台', en: 'Powell & Market turntable' },
  'hyde-beach': { zh: '海德街 · 海滩街转车台', en: 'Hyde & Beach turntable' },
  'taylor-bay': { zh: '泰勒街 · 湾街转车台', en: 'Taylor & Bay turntable' },
};

/** Build the cable-car network from transit.json (the F-line entry is left to world/streetcar.ts). */
export function buildTransit(file: TransitFileJson, deps: BuildDeps): TransitData {
  const { CABLE, CROSSING_STOP, pointAt, stationSlug, shortStationName, stationZh, turntableZh, glossName } = deps;
  const cableJson = file.lines.filter(l => l.kind === 'cable-car');
  const turntables: Turntable[] = [];
  const turntableAt = (x: number, z: number, line: string, stub: number, stationName: string): Turntable => {
    let t = turntables.find(tt => Math.hypot(tt.x - x, tt.z - z) < 1);
    if (!t) {
      const id = stationSlug(stationName);
      t = { id, name: TURNTABLE_NAMES[id] ?? { zh: turntableZh(stationName), en: `${shortStationName(stationName)} turntable` }, x, z, lines: [], landmark: id === 'powell-market', stub };
      turntables.push(t);
    }
    if (!t.lines.includes(line)) t.lines.push(line);
    return t;
  };

  const lines: CableLine[] = cableJson.map(j => {
    const pts = pointsOf(j.path);
    const n = pts.length;
    const dirOf = (a: P3, b: P3) => { const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1; return { x: dx / L, z: dz / L }; };
    let head: P3[] = [], tail: P3[] = [];
    let ttStart: Turntable | null = null, ttEnd: Turntable | null = null;
    const first = j.stops[0], last = j.stops[j.stops.length - 1];
    for (const tt of j.turntables) {
      const dStart = Math.hypot(tt.x - pts[0][0], tt.z - pts[0][2]), dEnd = Math.hypot(tt.x - pts[n - 1][0], tt.z - pts[n - 1][2]);
      if (dStart <= dEnd && dStart < 20) {
        ttStart = turntableAt(tt.x, tt.z, j.id, dStart, first.name.en);
        head = stubPoints(pts[0], dirOf(pts[1], pts[0]), tt, pts[0][1]).reverse();
      } else if (dEnd < 20) {
        ttEnd = turntableAt(tt.x, tt.z, j.id, dEnd, last.name.en);
        tail = stubPoints(pts[n - 1], dirOf(pts[n - 2], pts[n - 1]), tt, pts[n - 1][1]);
      }
    }
    // (the head stub runs from the path start out to the disc; reversed, it leads from the disc centre to the start)
    const all: P3[] = [...head, ...pts, ...tail];
    const cum = cumulative(all);
    const s0 = head.length ? cum[head.length] : 0;
    const length = cum[cum.length - 1];
    const xyz = new Float32Array(all.length * 3);
    all.forEach((p, i) => { xyz[i * 3] = p[0]; xyz[i * 3 + 1] = p[1]; xyz[i * 3 + 2] = p[2]; });
    const stops: CableStop[] = j.stops.map((st, i) => {
      const terminus = i === 0 || i === j.stops.length - 1;
      // termini with a turntable sit on the disc centre
      const at = i === 0 && ttStart ? 0 : i === j.stops.length - 1 && ttEnd ? length : st.at + s0;
      return { station: '', at, dwell: terminus || i % 2 === 0, terminus, near: 0 };
    });
    return {
      id: j.id, kind: 'cable-car', name: glossName(j.name), color: j.color, sourceUrl: j.sourceUrl, doubleEnded: j.doubleEnded,
      xyz, cum, length, osmLength: j.length, s0, stops, turntableStart: ttStart, turntableEnd: ttEnd,
      heroSpans: j.heroSpans.map(([a, b]) => [a + s0, b + s0] as [number, number]),
      crossings: [], shared: [],
    };
  });

  // stations: stops within CABLE.stationMerge u merge (across lines too), ids from the street names
  const stations: TransitStation[] = [];
  const used = new Set<string>();
  lines.forEach((line, li) => {
    const json = cableJson[li];
    json.stops.forEach((st, i) => {
      const stop = line.stops[i];
      let station = stations.find(s => Math.hypot(s.x - st.x, s.z - st.z) < CABLE.stationMerge);
      if (!station) {
        let id = stationSlug(st.name.en), k = 2;
        while (used.has(id)) id = `${stationSlug(st.name.en)}-${k++}`;
        used.add(id);
        const short = shortStationName(st.name.en);
        // (W6-B) the zh name in Chinese (it was the English short name: "California & Van Ness" on the zh map)
        station = { id, name: { zh: stationZh(st.name.en), en: short }, x: st.x, z: st.z, lines: [] };
        stations.push(station);
      }
      if (!station.lines.some(l => l.line === line.id)) station.lines.push({ line: line.id, at: stop.at, dwell: stop.dwell });
      stop.station = station.id;
    });
  });

  // shared track: two lines whose paths coincide from the start (the Powell lines up to Powell & Jackson)
  for (const a of lines) for (const b of lines) {
    if (a === b) continue;
    let until = 0;
    const p = { x: 0, y: 0, z: 0, heading: 0, grade: 0 }, q = { ...p };
    for (let s = 0; s <= Math.min(a.length, b.length); s += 0.5) {
      pointAt(a, s, p); pointAt(b, s, q);
      if (Math.hypot(p.x - q.x, p.z - q.z) > 0.3) break;
      until = s;
    }
    if (until > 10) a.shared.push({ line: b.id, until });
  }

  // crossings between lines that do not share the track there (Powell × California)
  for (const a of lines) for (const b of lines) {
    if (a === b) continue;
    for (let i = 1; i < a.cum.length; i++) {
      const ax = a.xyz[i * 3 - 3], az = a.xyz[i * 3 - 1], bx = a.xyz[i * 3], bz = a.xyz[i * 3 + 2];
      for (let k = 1; k < b.cum.length; k++) {
        const cx = b.xyz[k * 3 - 3], cz = b.xyz[k * 3 - 1], dx = b.xyz[k * 3], dz = b.xyz[k * 3 + 2];
        const den = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
        if (Math.abs(den) < 1e-9) continue;
        const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / den;
        const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / den;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue;
        const at = a.cum[i - 1] + (a.cum[i] - a.cum[i - 1]) * t, otherAt = b.cum[k - 1] + (b.cum[k] - b.cum[k - 1]) * u;
        if (a.shared.some(sh => sh.line === b.id && at <= sh.until + 1)) continue;
        if (!a.crossings.some(c => c.line === b.id && Math.abs(c.at - at) < 2)) a.crossings.push({ line: b.id, at, otherAt });
      }
    }
  }
  // a station within 10 u of a crossing becomes a dwell stop on the near side of it
  for (const line of lines) {
    for (const c of line.crossings) {
      const stop = line.stops.filter(st => !st.terminus).sort((p, q) => Math.abs(p.at - c.at) - Math.abs(q.at - c.at))[0];
      if (stop && Math.abs(stop.at - c.at) < 10) { stop.dwell = true; stop.at = c.at; stop.near = CROSSING_STOP; }
    }
    for (const st of line.stops) {
      const station = stations.find(s => s.id === st.station);
      const entry = station?.lines.find(l => l.line === line.id);
      if (entry) { entry.at = st.at; entry.dwell = st.dwell; }
    }
  }
  return { version: file.version, source: file.source, lines, stations, turntables };
}
