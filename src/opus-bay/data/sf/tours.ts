import type { Bilingual } from '../../core/types';
import { CHAPTER_LINES, type GrandChapterId } from './tourLines';

/**
 * Wave 4 · lane C · W4-C4: the city tours. `SF_GRAND` = 环游旧金山 · 一日游 (plan sf-w4-plan.md §3.5): 5 chapters by
 * the sightseeing bus, the N, the M, the California cable car and on foot, from the Ferry Building back to it.
 *
 * Data + pure helpers (no runtime imports; tourLines is data). The tour engine (game/flow.ts, integration phase) walks
 * `chapters[].stops[]` in order: each stop says where it ends (`target`: an interactable id that
 * interactables.interactableById resolves — `sf:<landmark id>` (landmark card), `place:<place id>` (G1's place
 * resolver), `transit-<station id>` (a transit station) — and how you get there (`leg`): on foot (BAYBAY leads) or a
 * line leg (BAYBAY leads to the boarding station, boarding opens pre-filled "上车 · 坐到 …", she names the stop on the
 * approach). A `moment` plays on arrival (lane G's arrival card / photo / panorama).
 *
 * Station ids: lane T's data/sf/stationNames.ts (`loop-*` loop stops, `muni-*` Metro stations) and today's cable
 * stations (data/transit.ts `stationSlug`: `powell-california`, `california-drumm`). TOUR_GEO copies the positions and
 * arc positions this tour needs from lane T's published public/opus-bay/sf/v1/transit-w4.json (W4-T3, 2026-09-27; the
 * cable stations from transit.json), so the timing model runs synchronously; tests/opus-bay-sf-tours.test.ts checks
 * TOUR_GEO against the published file (± 1 u, ± 1 u of arc) so a re-bake shows up.
 *
 * TIMES are honest (plan §4 "every time shown is the time it really takes"), from `stopSeconds()`:
 *   walk = straight distance × 1.25 / 4.2 u/s · bus = arc / 9.45 u/s (the plan's 14-min lap) + 8 s per stop passed
 *   + 15 s wait · light rail = surface arc / 10 + underground arc / 25 (the subway overlay) + 4 s per major stop passed
 *   (3 s underground) + 3 s per portal cut + 10 s wait · cable car = arc / 9 × 1.25 + 4 s per dwell stop passed + 20 s
 *   wait · 直接到站 (express Metro legs > 400 u; the bus and the cable car ride in real time, with the narration) =
 *   12 s veil · moments: arrive 20 s, photo 25 s, panorama 45 s, deck 120 s.
 * Declared `minutes` / `expressMinutes` are that model rounded to 0.1 (tested within 0.15). The full tour models at
 * ≈ 26 min and the express at ≈ 17 min (plan §3.5: ≈ 25.5 / 18), chapter intros and outros not counted.
 */

// ---------------------------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------------------------

export type CityTourLeg =
  | { via: 'walk' }
  /** `from` / `to` = station ids on `line`; BAYBAY first leads to `from` */
  | { via: 'line'; line: string; from: string; to: string };

export type CityTourMoment = 'arrive' | 'photo' | 'panorama' | 'deck';

/** A line in a tour: a frozen tourLines id (recorded voice) or a plain bubble text. */
export type TourSay = string | Bilingual;

export interface CityTourStop {
  /** stable id (saves keep completed stop ids) */
  id: string;
  /** where the stop ends: `sf:<landmark>` / `place:<place>` / `transit-<station>` */
  target: string;
  leg: CityTourLeg;
  /** the attraction whose arrival moment / card this stop is (Attraction id) */
  attraction?: string;
  moment?: CityTourMoment;
  /** a city goal this stop completes honestly (data/sf/goals.ts CITY_GOAL + the wave-4 goals) */
  goal?: string;
  /** an SF postcard lying within ≈ 70 u of the stop (data/sf/postcards.ts id) */
  postcard?: string;
  /** a side trip the player may skip (not in the tour totals; "跳过这一站" is always there) */
  optional?: boolean;
  /** express version: 'skip' = not visited (a skipped ride merges into the next ride on the same line) */
  express?: 'skip';
  /** express version of a ride: get off here instead (the skipped stops after it are on the way) */
  expressTo?: string;
  lines: { lead?: TourSay; arrive: TourSay; done?: TourSay };
  /** honest minutes for this stop: its leg + its moment (stopSeconds / 60, rounded to 0.1) */
  minutes: number;
  /** the same in the express version (0 when skipped) */
  expressMinutes: number;
}

export interface CityTourChapter {
  id: GrandChapterId;
  name: Bilingual;
  /** frozen tourLines ids of the chapter intro and outro */
  intro: string;
  outro: string;
  stops: CityTourStop[];
}

export interface CityTourDef {
  id: string;
  name: Bilingual;
  /** welcome-choice subtitle ("全城 5 章 · 约 26 分钟 · 随时下车") */
  subtitle: Bilingual;
  chapters: CityTourChapter[];
  /** total minutes of the non-optional stops (= Σ chapter minutes) and of the express version */
  minutes: number;
  expressMinutes: number;
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry the tour needs (city frame, u)
// ---------------------------------------------------------------------------------------------------------------

export interface TourStationGeo { at: number; x: number; z: number; major?: boolean; underground?: boolean }
export interface TourLineGeo {
  kind: 'bus' | 'light-rail' | 'cable-car';
  length: number;
  loop?: boolean;
  /** arc spans under ground (the subway overlay) */
  tunnels?: [number, number][];
  /** the stations a ride on this line can pass or stop at, keyed by station id */
  stations: Record<string, TourStationGeo>;
}

const st = (at: number, x: number, z: number, extra: Partial<TourStationGeo> = {}): TourStationGeo => ({ at, x, z, ...extra });

export const TOUR_GEO: Readonly<Record<string, TourLineGeo>> = {
  'sf-loop': {
    kind: 'bus', length: 6501.5, loop: true,
    stations: {
      'loop-ferry-building': st(0, 133, 10.1),
      'loop-pier-39': st(290.9, -152.8, 13),
      'loop-wharf-hyde': st(449.9, -225.4, 139.7),
      'loop-palace-of-fine-arts': st(834.6, -432.3, 395.9),
      'loop-golden-gate-bridge': st(1379.1, -685.5, 623.6),
      'loop-legion-of-honor': st(1939.3, -660.2, 1072.6),
      'loop-lands-end-sutro': st(2277.8, -702.1, 1230.8),
      'loop-ocean-beach-windmill': st(2459.3, -588.5, 1334.7),
      'loop-golden-gate-park': st(3135.8, -211.3, 932.9),
      'loop-haight-ashbury': st(3587.1, -38.4, 765.6),
      'loop-painted-ladies': st(3824.7, 24.5, 579.2),
      'loop-castro': st(4099.8, 133.5, 737.5),
      'loop-twin-peaks': st(4768, 155.2, 975.5),
      'loop-mission-dolores': st(5585.9, 191.6, 648),
      'loop-civic-center': st(5885.5, 85.6, 410.1),
      'loop-chinatown': st(6219.7, 92.1, 168.4),
    },
  },
  'n-judah': {
    kind: 'light-rail', length: 1580.1, tunnels: [[0, 516.1], [606.7, 787.0]],
    stations: {
      'muni-embarcadero': st(0, 126.2, 78.9, { major: true, underground: true }),
      'muni-montgomery': st(89.1, 127.5, 168, { major: true, underground: true }),
      'muni-powell': st(189.2, 128.9, 268.1, { major: true, underground: true }),
      'muni-civic-center': st(300.2, 130.3, 379.1, { major: true, underground: true }),
      'muni-van-ness': st(389.3, 131.7, 468.1, { major: true, underground: true }),
      'muni-duboce-church': st(543.2, 114.8, 613.5, { major: true }),
      'muni-duboce-park': st(597.5, 78.9, 654),
      'muni-carl-cole': st(804.2, -19.8, 833.7, { major: true }),
      'muni-carl-stanyan': st(839.1, -39.8, 862.3),
      'muni-carl-hillway': st(887, -67.2, 901.5, { major: true }),
      'muni-irving-2nd': st(920.5, -81.1, 929.3, { major: true }),
      'muni-irving-6th': st(971.3, -114.3, 967.7),
      'muni-9th-irving': st(1022.3, -133.5, 1006, { major: true }),
      'muni-judah-19th': st(1166.9, -202.7, 1114.3, { major: true }),
      'muni-judah-sunset': st(1400.8, -355.7, 1291.4, { major: true }),
      'muni-judah-la-playa': st(1580.1, -461.7, 1417, { major: true }),
    },
  },
  'm-ocean-view': {
    kind: 'light-rail', length: 2028.1, tunnels: [[0, 1164.2]],
    stations: {
      'muni-embarcadero': st(0, 126.2, 78.9, { major: true, underground: true }),
      'muni-montgomery': st(89.1, 127.5, 168, { major: true, underground: true }),
      'muni-powell': st(189.2, 128.9, 268.1, { major: true, underground: true }),
      'muni-civic-center': st(300.2, 130.3, 379.1, { major: true, underground: true }),
      'muni-van-ness': st(389.3, 131.7, 468.1, { major: true, underground: true }),
      'muni-church': st(569.3, 135, 648.2, { major: true, underground: true }),
      'muni-castro': st(661, 141.9, 748.2, { major: true, underground: true }),
      'muni-forest-hill': st(1040.8, 93.9, 1113.6, { major: true, underground: true }),
      'muni-west-portal': st(1171.6, 120.4, 1242.3, { major: true }),
      'muni-st-francis-circle': st(1282.2, 134.9, 1351.1, { major: true }),
      'muni-ocean-ave': st(1342.4, 152.1, 1408.7),
      'muni-19th-winston': st(1420, 195.2, 1471.5, { major: true }),
      'muni-19th-holloway': st(1509.5, 256.9, 1536.2, { major: true }),
      'muni-san-jose-geneva': st(2028.1, 511.7, 1299.3, { major: true }),
    },
  },
  california: {
    kind: 'cable-car', length: 319.85,
    stations: {
      'california-drumm': st(0, 128.45, 59.17, { major: true }),
      'california-front': st(30.54, 110.95, 84.19, { major: true }),
      'california-sansome': st(59.91, 94.14, 108.27, { major: true }),
      'california-kearny': st(100.58, 70.84, 141.61, { major: true }),
      'california-stockton': st(141.49, 47.38, 175.12, { major: true }),
      'powell-california': st(161.48, 33.68, 189.91, { major: true }),
    },
  },
};

/** Positions of the non-station targets the tour ends stops at (places.json / the landmark arrival spots / attractions.json). */
export const TOUR_TARGET_AT: Readonly<Record<string, { x: number; z: number }>> = {
  'place:osm-w164569681': { x: -700.86, z: 604.59 },      // Golden Gate Bridge Welcome Center
  'sf:fort-point': { x: -750.43, z: 595.06 },
  'sf:golden-gate-bridge': { x: -700.86, z: 604.59 },      // the deck walk starts at the Welcome Center
  'sf:sutro-baths': { x: -721.24, z: 1246.52 },
  'sf:dutch-windmill': { x: -580.69, z: 1311.93 },
  'place:japanese-tea-garden': { x: -242.97, z: 964.38 },
  'sf:painted-ladies': { x: -7.52, z: 586.51 },
  'place:stonestown-galleria': { x: 165.9, z: 1479.9 },
  'place:sf-state-university': { x: 198.2, z: 1555.6 },
  'sf:twin-peaks': { x: 128.86, z: 922.72 },               // Christmas Tree Point overlook
  'place:ferry-building': { x: 132.11, z: 19.31 },
};

// ---------------------------------------------------------------------------------------------------------------
// The timing model
// ---------------------------------------------------------------------------------------------------------------

export const TOUR_MODEL = {
  walkSpeed: 4.2, streetFactor: 1.25,
  bus: { speed: 9.45, dwell: 8, wait: 15 },
  rail: { surface: 10, underground: 25, dwell: 4, dwellUnder: 3, portal: 3, wait: 10 },
  cable: { speed: 9, factor: 1.25, dwell: 4, wait: 20 },
  /** 直接到站 in the express version: Metro legs over 400 u only (the bus and the cable car keep their narration) */
  veil: 12, veilOver: 400, veilKinds: ['light-rail'] as readonly TourLineGeo['kind'][],
  moment: { arrive: 20, photo: 25, panorama: 45, deck: 120 } as Record<CityTourMoment, number>,
} as const;

export interface XZ { x: number; z: number }
const dist = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);

/** Where a stop's target stands (null: unknown target). */
export function targetAt(target: string): XZ | null {
  if (TOUR_TARGET_AT[target]) return TOUR_TARGET_AT[target];
  if (target.startsWith('transit-')) {
    const id = target.slice('transit-'.length);
    for (const line of Object.values(TOUR_GEO)) if (line.stations[id]) return line.stations[id];
  }
  return null;
}

/** Arc distance of a ride from → to (loops go forward; double-ended lines either way), or null. */
export function rideArc(lineId: string, from: string, to: string): { arc: number; a: number; b: number; dir: 1 | -1 } | null {
  const line = TOUR_GEO[lineId];
  const A = line?.stations[from], B = line?.stations[to];
  if (!line || !A || !B || from === to) return null;
  if (line.loop) { const arc = ((B.at - A.at) % line.length + line.length) % line.length; return { arc, a: A.at, b: A.at + arc, dir: 1 }; }
  return { arc: Math.abs(B.at - A.at), a: Math.min(A.at, B.at), b: Math.max(A.at, B.at), dir: B.at > A.at ? 1 : -1 };
}

/** Seconds on board (no wait, no walk) for a ride; `veil` = the express version (直接到站 on Metro legs over 400 u). */
export function rideSeconds(lineId: string, from: string, to: string, veil = false): number {
  const line = TOUR_GEO[lineId], r = rideArc(lineId, from, to);
  if (!line || !r) return NaN;
  if (veil && r.arc > TOUR_MODEL.veilOver && TOUR_MODEL.veilKinds.includes(line.kind)) return TOUR_MODEL.veil;
  // stations strictly between the two ends (along the direction of travel)
  const passed = Object.entries(line.stations).filter(([id, s]) => {
    if (id === from || id === to) return false;
    if (line.loop) { const d = ((s.at - r.a) % line.length + line.length) % line.length; return d > 0 && d < r.arc; }
    return s.at > r.a && s.at < r.b;
  }).map(([, s]) => s);
  if (line.kind === 'bus') return r.arc / TOUR_MODEL.bus.speed + passed.length * TOUR_MODEL.bus.dwell;
  if (line.kind === 'cable-car') return (r.arc / TOUR_MODEL.cable.speed) * TOUR_MODEL.cable.factor + passed.filter(s => s.major).length * TOUR_MODEL.cable.dwell;
  // light rail: split the arc into underground / surface, count portal cuts, major stops
  let under = 0, portals = 0;
  for (const [t0, t1] of line.tunnels ?? []) {
    const lo = Math.max(r.a, t0), hi = Math.min(r.b, t1);
    if (hi > lo) { under += hi - lo; if (t0 > r.a && t0 < r.b) portals++; if (t1 > r.a && t1 < r.b) portals++; }
  }
  const surface = r.arc - under;
  const dwells = passed.filter(s => s.major).reduce((sum, s) => sum + (s.underground ? TOUR_MODEL.rail.dwellUnder : TOUR_MODEL.rail.dwell), 0);
  return surface / TOUR_MODEL.rail.surface + under / TOUR_MODEL.rail.underground + dwells + portals * TOUR_MODEL.rail.portal;
}

const waitOf = (lineId: string) => {
  const kind = TOUR_GEO[lineId]?.kind;
  return kind === 'bus' ? TOUR_MODEL.bus.wait : kind === 'cable-car' ? TOUR_MODEL.cable.wait : TOUR_MODEL.rail.wait;
};
const walkSeconds = (a: XZ, b: XZ) => (dist(a, b) * TOUR_MODEL.streetFactor) / TOUR_MODEL.walkSpeed;

/**
 * Seconds a stop takes from `prev` (the previous stop's end point): the walk to the boarding station and the wait
 * (line legs), the ride, the walk (walk legs), and the moment. `ride` overrides the ride's end points (express merges);
 * `stayOnBoard` = the rider did not get off before (no walk to the station, no wait: a merged ride continues).
 */
export function stopSeconds(stop: CityTourStop, prev: XZ, opts: { express?: boolean; from?: string; to?: string; stayOnBoard?: boolean } = {}): number {
  const end = targetAt(stop.target);
  if (!end) return NaN;
  let s = 0;
  if (stop.leg.via === 'walk') s += walkSeconds(prev, end);
  else {
    const from = opts.from ?? stop.leg.from, to = opts.to ?? stop.leg.to;
    const board = TOUR_GEO[stop.leg.line]?.stations[from];
    if (!board) return NaN;
    if (!opts.stayOnBoard) s += walkSeconds(prev, board) + waitOf(stop.leg.line);
    s += rideSeconds(stop.leg.line, from, to, !!opts.express);
  }
  if (stop.moment) s += TOUR_MODEL.moment[stop.moment];
  return s;
}

// ---------------------------------------------------------------------------------------------------------------
// 环游旧金山 · 一日游 (sf-grand)
// ---------------------------------------------------------------------------------------------------------------

export const GRAND_TOUR_ID = 'sf-grand';
const bi = (zh: string, en: string): Bilingual => ({ zh, en });
const walk = { via: 'walk' } as const;
const loop = (from: string, to: string): CityTourLeg => ({ via: 'line', line: 'sf-loop', from: `loop-${from}`, to: `loop-${to}` });
const muni = (line: 'n-judah' | 'm-ocean-view', from: string, to: string): CityTourLeg => ({ via: 'line', line, from: `muni-${from}`, to: `muni-${to}` });

const chapter = (id: GrandChapterId, name: Bilingual, stops: CityTourStop[]): CityTourChapter => ({
  id, name, intro: CHAPTER_LINES[id].intro.id, outro: CHAPTER_LINES[id].outro.id, stops,
});

const CHAPTERS: CityTourChapter[] = [
  chapter('bay', bi('海湾', 'The Bay'), [
    {
      id: 'bay-start', target: 'transit-loop-ferry-building', leg: walk,
      lines: { arrive: bi('观光巴士就在渡轮大厦门口上车，车来了我们就上！', 'The sightseeing bus stops right outside the Ferry Building — hop on when it comes!') },
      minutes: 0.0, expressMinutes: 0.0,
    },
    {
      id: 'bay-ride-ggb', target: 'transit-loop-golden-gate-bridge', leg: loop('ferry-building', 'golden-gate-bridge'),
      goal: 'sightseeing',
      lines: { lead: bi('坐上层前排，风景最好！沿路我给你讲。', 'Front row on the top deck — best view! I\'ll tell you about the sights.'), arrive: 'loop-golden-gate-bridge-arrive' },
      minutes: 3.1, expressMinutes: 3.1,
    },
    {
      id: 'bay-vista', target: 'place:osm-w164569681', leg: walk, attraction: 'golden-gate-bridge', moment: 'arrive',
      postcard: 'sf-golden-gate-fog',
      lines: { lead: bi('下车！游客中心旁边就能看到大桥南塔。', 'Off we get! The south tower is right by the Welcome Center.'), arrive: bi('这就是金门大桥，1937 年通车！', 'The Golden Gate Bridge — open since 1937!') },
      minutes: 0.5, expressMinutes: 0.5,
    },
    {
      id: 'bay-fort-point', target: 'sf:fort-point', leg: walk, moment: 'photo', optional: true, express: 'skip',
      lines: { lead: bi('往下看，桥下那座砖砌堡垒就是 Fort Point 炮台。', 'Look down — the brick fort under the bridge is Fort Point.'), arrive: bi('大桥的钢拱就是为了保住它才这样设计的。', 'The bridge\'s steel arch was designed to leave this fort standing.') },
      minutes: 0.7, expressMinutes: 0.0,
    },
    {
      id: 'bay-deck', target: 'sf:golden-gate-bridge', leg: walk, moment: 'deck', goal: 'golden-gate', optional: true, express: 'skip',
      lines: { lead: bi('想走上桥吗？走东侧人行道，从南塔走到北塔。', 'Fancy walking the bridge? Take the east sidewalk from the south tower to the north.'), arrive: bi('走过金门大桥啦！', 'You crossed the Golden Gate Bridge!') },
      minutes: 2.0, expressMinutes: 0.0,
    },
  ]),
  chapter('coast', bi('海岸', 'The Coast'), [
    {
      id: 'coast-ride-lands-end', target: 'transit-loop-lands-end-sutro', leg: loop('golden-gate-bridge', 'lands-end-sutro'),
      expressTo: 'loop-ocean-beach-windmill',
      lines: { lead: bi('回车站，下一班车往海边开！', 'Back to the stop — the next bus heads for the coast!'), arrive: 'loop-lands-end-sutro-arrive' },
      minutes: 2.1, expressMinutes: 2.5,
    },
    {
      id: 'coast-sutro', target: 'sf:sutro-baths', leg: walk, attraction: 'sutro-baths', moment: 'arrive', express: 'skip',
      lines: { lead: 'loop-lands-end-sutro-tip', arrive: bi('这些混凝土墙，是当年巨大海水浴场留下的。', 'These concrete walls are all that\'s left of a huge saltwater bathhouse.') },
      minutes: 0.5, expressMinutes: 0.0,
    },
    {
      id: 'coast-ride-windmill', target: 'transit-loop-ocean-beach-windmill', leg: loop('lands-end-sutro', 'ocean-beach-windmill'), express: 'skip',
      lines: { lead: bi('再坐一站，就到海洋海滩！', 'One more stop to Ocean Beach!'), arrive: 'loop-ocean-beach-windmill-arrive' },
      minutes: 0.7, expressMinutes: 0.0,
    },
    {
      id: 'coast-windmill', target: 'sf:dutch-windmill', leg: walk, attraction: 'dutch-windmill', moment: 'photo', postcard: 'sf-windmill', express: 'skip',
      lines: { lead: 'loop-ocean-beach-windmill-tip', arrive: bi('风车底下拍一张！', 'A photo under the windmill!') },
      minutes: 0.5, expressMinutes: 0.0,
    },
    {
      id: 'coast-walk-n', target: 'transit-muni-judah-la-playa', leg: walk, attraction: 'ocean-beach', postcard: 'sf-ocean-beach',
      lines: { lead: bi('跟我来，N 线的终点站就在南边！', 'Follow me — the N line\'s last stop is just south!'), arrive: bi('这就是 N 线终点，我们坐它穿过日落区。', 'This is the end of the N — we\'ll ride it across the Sunset.') },
      minutes: 0.8, expressMinutes: 0.7,
    },
  ]),
  chapter('sunset-n', bi('N 线穿越日落区', 'The Sunset by N'), [
    {
      id: 'n-ride-9th-irving', target: 'transit-muni-9th-irving', leg: muni('n-judah', 'judah-la-playa', '9th-irving'), express: 'skip',
      lines: { lead: 'metro-board-n', arrive: 'metro-9th-irving' },
      minutes: 1.2, expressMinutes: 0.0,
    },
    {
      id: 'n-tea-garden', target: 'place:japanese-tea-garden', leg: walk, attraction: 'japanese-tea-garden', moment: 'arrive', express: 'skip',
      lines: { lead: bi('走过加州科学院，就到日本茶园！', 'Past the Cal Academy to the Japanese Tea Garden!'), arrive: 'arrive-japanese-tea-garden' },
      minutes: 0.9, expressMinutes: 0.0,
    },
    {
      id: 'n-ride-duboce', target: 'transit-muni-duboce-church', leg: muni('n-judah', '9th-irving', 'duboce-church'),
      lines: { lead: bi('回 N 线，往城里坐，窗外看 UCSF！', 'Back on the N into town — watch for UCSF out the window!'), arrive: 'metro-duboce-portal' },
      minutes: 1.7, expressMinutes: 0.4,
    },
    {
      id: 'n-painted-ladies', target: 'sf:painted-ladies', leg: walk, attraction: 'alamo-square-painted-ladies', moment: 'photo', goal: 'painted-ladies', postcard: 'sf-painted-ladies', express: 'skip',
      lines: { lead: bi('走上阿拉莫广场，给彩绘女士拍张照！', 'Up to Alamo Square for a photo of the Painted Ladies!'), arrive: 'loop-painted-ladies-arrive' },
      minutes: 1.0, expressMinutes: 0.0,
    },
    {
      id: 'n-walk-church', target: 'transit-muni-church', leg: walk,
      lines: { lead: bi('去教堂街站换 M 线，从地铁口下去。', 'To Church station for the M — down the stairs at the kiosk.'), arrive: bi('这里就是教堂街站，下一章坐 M 线！', 'Church station — next chapter, the M!') },
      minutes: 0.8, expressMinutes: 0.2,
    },
  ]),
  chapter('south-m', bi('M 线去石镇和州大', 'Stonestown & SF State'), [
    {
      id: 'm-ride-winston', target: 'transit-muni-19th-winston', leg: muni('m-ocean-view', 'church', '19th-winston'),
      expressTo: 'muni-19th-holloway', goal: 'metro',
      lines: { lead: 'metro-board-m', arrive: 'metro-stonestown-next' },
      minutes: 1.3, expressMinutes: 0.4,
    },
    {
      id: 'm-stonestown', target: 'place:stonestown-galleria', leg: walk, attraction: 'stonestown-galleria', moment: 'arrive', express: 'skip',
      lines: { arrive: 'arrive-stonestown-galleria' },
      minutes: 0.5, expressMinutes: 0.0,
    },
    {
      id: 'm-sfsu', target: 'place:sf-state-university', leg: walk, attraction: 'sf-state-university', moment: 'arrive', goal: 'campuses',
      lines: { lead: bi('顺着 19 大道往南走，州立大学就在前面。', 'Down 19th Avenue — SF State is just ahead.'), arrive: 'arrive-sf-state-university' },
      minutes: 0.7, expressMinutes: 0.6,
    },
    {
      id: 'm-ride-castro', target: 'transit-muni-castro', leg: muni('m-ocean-view', '19th-holloway', 'castro'),
      lines: { lead: bi('从 Holloway 站坐 M 线回城，到卡斯特罗下车。', 'Back on the M at Holloway, off at the Castro.'), arrive: bi('卡斯特罗站到了，上去就是彩虹旗！', 'Castro station — the rainbow flag is right upstairs!') },
      minutes: 1.7, expressMinutes: 0.7,
    },
  ]),
  chapter('peaks-downtown', bi('双峰与市中心', 'Twin Peaks & Downtown'), [
    {
      id: 'peaks-ride-twin-peaks', target: 'transit-loop-twin-peaks', leg: loop('castro', 'twin-peaks'),
      lines: { lead: bi('观光巴士就在卡斯特罗站上面，我们上山！', 'The bus stops right above the Castro station — up the hill we go!'), arrive: 'loop-twin-peaks-arrive' },
      minutes: 1.5, expressMinutes: 1.5,
    },
    {
      id: 'peaks-overlook', target: 'sf:twin-peaks', leg: walk, attraction: 'twin-peaks', moment: 'panorama', goal: 'twin-peaks', postcard: 'sf-twin-peaks-view',
      lines: { lead: 'loop-twin-peaks-tip', arrive: bi('我指给你看！今天去过的地方都在下面。', 'Let me show you! Everywhere we went today is down there.') },
      minutes: 1.0, expressMinutes: 1.0,
    },
    {
      id: 'peaks-ride-chinatown', target: 'transit-loop-chinatown', leg: loop('twin-peaks', 'chinatown'),
      lines: { lead: bi('下山！经过多洛雷斯传教站和市政厅，去唐人街。', 'Downhill! Past Mission Dolores and City Hall to Chinatown.'), arrive: 'loop-chinatown-arrive' },
      minutes: 3.4, expressMinutes: 3.4,
    },
    {
      id: 'peaks-cable-hill', target: 'transit-powell-california', leg: walk, moment: 'photo', postcard: 'sf-cable-car-hill',
      lines: { lead: bi('往坡上走到加州街和鲍威尔街路口，叮当车在那儿交叉。', 'Up the hill to California & Powell, where the cable lines cross.'), arrive: bi('这个路口，两条叮当车线在这儿十字交叉！', 'Right here, two cable-car lines cross each other!') },
      minutes: 0.7, expressMinutes: 0.7,
    },
    {
      id: 'peaks-cable-ride', target: 'transit-california-drumm', leg: { via: 'line', line: 'california', from: 'powell-california', to: 'california-drumm' }, goal: 'cable-car',
      lines: { lead: bi('坐加州街叮当车下山，抓紧扶杆！', 'Down California St by cable car — hold on tight!'), arrive: bi('终点 Drumm 街，渡轮大厦就在前面！', 'End of the line at Drumm — the Ferry Building is just ahead!') },
      minutes: 1.0, expressMinutes: 1.0,
    },
    {
      id: 'peaks-ferry', target: 'place:ferry-building', leg: walk, attraction: 'ferry-building-marketplace', moment: 'arrive',
      lines: { arrive: bi('回到渡轮大厦，一圈旧金山转完啦！', 'Back at the Ferry Building — we\'ve been all round San Francisco!') },
      minutes: 0.5, expressMinutes: 0.5,
    },
  ]),
];

const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 10) / 10;

export const SF_GRAND: CityTourDef = {
  id: GRAND_TOUR_ID,
  name: bi('环游旧金山 · 一日游', 'San Francisco Grand Tour'),
  subtitle: bi('全城 5 章 · 约 26 分钟 · 随时下车', 'The whole city in 5 chapters · about 26 min · hop off anytime'),
  chapters: CHAPTERS,
  minutes: sum(CHAPTERS.flatMap(c => c.stops.filter(s => !s.optional).map(s => s.minutes))),
  expressMinutes: sum(CHAPTERS.flatMap(c => c.stops.map(s => s.expressMinutes))),
};

export const CITY_TOURS: readonly CityTourDef[] = [SF_GRAND];
export const cityTour = (id: string): CityTourDef | undefined => CITY_TOURS.find(t => t.id === id);

// ---------------------------------------------------------------------------------------------------------------
// Walking a tour
// ---------------------------------------------------------------------------------------------------------------

export interface FlatStop { stop: CityTourStop; chapter: number; index: number }

/** The stops in play order (express: the skipped ones dropped), with their chapter index and flat index. */
export function tourStops(def: CityTourDef, opts: { express?: boolean; optional?: boolean } = {}): FlatStop[] {
  const out: FlatStop[] = [];
  def.chapters.forEach((c, chapter) => c.stops.forEach(stop => {
    if (opts.express && stop.express === 'skip') return;
    if (stop.optional && !opts.optional) return;
    out.push({ stop, chapter, index: out.length });
  }));
  return out;
}

/** Minutes of one chapter (non-optional stops; express = the express minutes). */
export const chapterMinutes = (c: CityTourChapter, express = false) => sum(c.stops.filter(s => !s.optional).map(s => (express ? s.expressMinutes : s.minutes)));

/** The ride a line stop really takes in the express version: its own board, and `expressTo` or its own alight. */
export function expressRide(def: CityTourDef, stopId: string): { line: string; from: string; to: string } | null {
  const flat = tourStops(def, { optional: true });
  const i = flat.findIndex(f => f.stop.id === stopId);
  const stop = flat[i]?.stop;
  if (!stop || stop.leg.via !== 'line' || stop.express === 'skip') return null;
  // a skipped ride right before on the same line (you stayed on board): the ride starts where that one started
  let from = stop.leg.from;
  for (let k = i - 1; k >= 0; k--) {
    const p = flat[k].stop;
    if (p.express !== 'skip') break;
    if (p.leg.via === 'line' && p.leg.line === stop.leg.line) from = p.leg.from;
  }
  return { line: stop.leg.line, from, to: stop.expressTo ?? stop.leg.to };
}

/** "继续一日游 · 第 3 章" resume label, or the start label when nothing is done. */
export function tourResumeLabel(def: CityTourDef, progress: TourProgress | undefined): Bilingual {
  if (!progress || (progress.chapter === 0 && progress.completed.length === 0)) return { zh: `${def.name.zh}（约 ${Math.round(def.minutes)} 分钟）`, en: `${def.name.en} (about ${Math.round(def.minutes)} min)` };
  const n = Math.min(def.chapters.length, progress.chapter + 1);
  return { zh: `继续${def.name.zh.split(' · ').pop()} · 第 ${n} 章`, en: `Resume the ${def.name.en} · chapter ${n}` };
}

// ---------------------------------------------------------------------------------------------------------------
// Save v2 `tours` (plan §3.6): per tour id { chapter, stop, completed[] }; decoded as untrusted input
// ---------------------------------------------------------------------------------------------------------------

export interface TourProgress {
  /** 0-based chapter index */
  chapter: number;
  /** 0-based index of the current stop inside the chapter */
  stop: number;
  /** completed stop ids (CityTourStop.id), in order */
  completed: string[];
  express?: boolean;
}

export const TOUR_SAVE_MAX_IDS = 8;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

/**
 * Decode the save's `tours` field: at most 8 tour ids (kebab-case, ≤ 40 chars); chapter / stop clamped to the known
 * tour (an unknown id keeps clamped numbers ≤ 32); completed = unique known stop ids (unknown tour: well-formed ids,
 * ≤ 64). Anything malformed is dropped, never thrown.
 */
export function decodeTourSaves(raw: unknown, tours: readonly CityTourDef[] = CITY_TOURS): Record<string, TourProgress> {
  const out: Record<string, TourProgress> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= TOUR_SAVE_MAX_IDS) break;
    if (!ID_RE.test(id) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
    const v = value as Record<string, unknown>;
    const def = tours.find(t => t.id === id);
    const int = (x: unknown, max: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(max, Math.floor(x))) : 0);
    const chapter = int(v.chapter, def ? def.chapters.length - 1 : 32);
    const stop = int(v.stop, def ? Math.max(0, def.chapters[chapter].stops.length - 1) : 32);
    const known = def ? new Set(def.chapters.flatMap(c => c.stops.map(s => s.id))) : null;
    const completed = Array.isArray(v.completed)
      ? [...new Set(v.completed.filter((s): s is string => typeof s === 'string' && ID_RE.test(s) && (!known || known.has(s))))].slice(0, 64)
      : [];
    out[id] = { chapter, stop, completed, ...(v.express === true ? { express: true } : {}) };
  }
  return out;
}
