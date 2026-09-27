import type { Bilingual } from '../core/types';
import { targetAt, TOUR_GEO, type CityTourDef, type XZ } from '../data/sf/tours';

/**
 * Wave 4 · lane C · W4-C4: the pure model of the Grand Tour recap (ui/TourRecap.tsx): the route sketch in the game
 * frame (x right, z down — the map's orientation, "北在左上"), the chapters with their done stops, the counts.
 * Lane P's recap map API (Footprints, W4-P13) replaces the sketch when it lands; the sketch keeps working without it.
 */

/** Line colours (plan §3.1 / §3.6): loop coral, N blue, M green, California cable plum, walks gold. */
export const RECAP_COLORS: Readonly<Record<string, string>> = {
  'sf-loop': '#e0563f', 'n-judah': '#2f6fb0', 'm-ocean-view': '#2f8f5b', california: '#7a5a8c', walk: '#c99a2e',
};

export interface RecapSegment { d: string; color: string; dashed: boolean; done: boolean }
export interface RecapDot { x: number; y: number; done: boolean; chapter: number; label: Bilingual | null }
export interface RecapChapter { id: string; name: Bilingual; done: number; total: number }
export interface TourRecapModel {
  /** SVG viewBox "minX minY w h" in the game frame (padding included) */
  viewBox: string;
  segments: RecapSegment[];
  dots: RecapDot[];
  chapters: RecapChapter[];
  done: number;
  total: number;
  /** every chapter finished (the "全城都能飞了" stamp) */
  complete: boolean;
}

const f1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The recap of `tour` with the stop ids in `completed`. Ride segments follow the line through its stations (the
 * TOUR_GEO stations between board and alight, a readable sketch, not the exact track); walks are straight dashes.
 */
export function tourRecapModel(tour: CityTourDef, completed: readonly string[], names: (stopId: string) => Bilingual | null = () => null): TourRecapModel {
  const done = new Set(completed);
  const segments: RecapSegment[] = [];
  const dots: RecapDot[] = [];
  const pts: XZ[] = [];
  let prev: XZ | null = targetAt('transit-loop-ferry-building');
  let total = 0, doneCount = 0;
  const chapters: RecapChapter[] = tour.chapters.map((c, ci) => {
    let cDone = 0;
    const stops = c.stops.filter(s => !s.optional);
    for (const s of stops) {
      const end = targetAt(s.target);
      if (!end) continue;
      const ok = done.has(s.id);
      total++; if (ok) { doneCount++; cDone++; }
      const path: XZ[] = [];
      if (s.leg.via === 'line') {
        const geo = TOUR_GEO[s.leg.line];
        const A = geo?.stations[s.leg.from], B = geo?.stations[s.leg.to];
        if (geo && A && B) {
          if (prev) path.push(prev);
          path.push(A);
          const between = Object.values(geo.stations).filter(st => {
            if (geo.loop) { const d = ((st.at - A.at) % geo.length + geo.length) % geo.length; const arc = ((B.at - A.at) % geo.length + geo.length) % geo.length; return d > 0 && d < arc; }
            return st.at > Math.min(A.at, B.at) && st.at < Math.max(A.at, B.at);
          }).sort((p, q) => {
            if (geo.loop) return ((p.at - A.at) % geo.length + geo.length) % geo.length - ((q.at - A.at) % geo.length + geo.length) % geo.length;
            return B.at > A.at ? p.at - q.at : q.at - p.at;
          });
          path.push(...between, B);
        }
        if (prev && path.length > 1) segments.push({ d: `M${f1(path[0].x)} ${f1(path[0].z)}L${f1(path[1].x)} ${f1(path[1].z)}`, color: RECAP_COLORS.walk, dashed: true, done: ok });
        const ride = prev ? path.slice(1) : path;
        if (ride.length > 1) segments.push({ d: ride.map((p, i) => `${i ? 'L' : 'M'}${f1(p.x)} ${f1(p.z)}`).join(''), color: RECAP_COLORS[s.leg.line] ?? '#888', dashed: false, done: ok });
      } else if (prev) {
        path.push(prev, end);
        segments.push({ d: `M${f1(prev.x)} ${f1(prev.z)}L${f1(end.x)} ${f1(end.z)}`, color: RECAP_COLORS.walk, dashed: true, done: ok });
      }
      pts.push(...path, end);
      if (s.moment || s.attraction) dots.push({ x: f1(end.x), y: f1(end.z), done: ok, chapter: ci, label: names(s.id) });
      prev = end;
    }
    return { id: c.id, name: c.name, done: cDone, total: stops.length };
  });
  const xs = pts.map(p => p.x), zs = pts.map(p => p.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const pad = Math.max(maxX - minX, maxZ - minZ) * 0.06;
  return {
    viewBox: `${f1(minX - pad)} ${f1(minZ - pad)} ${f1(maxX - minX + 2 * pad)} ${f1(maxZ - minZ + 2 * pad)}`,
    segments, dots, chapters, done: doneCount, total,
    complete: chapters.every(c => c.done >= c.total),
  };
}
