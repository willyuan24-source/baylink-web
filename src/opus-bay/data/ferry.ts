import type { Bilingual, Vec2 } from '../core/types';
import { DISTRICT, frameAt } from './district';

/**
 * Ferry routes (lane F, checkpoint F8), pure: a data-driven route table and the loop each boat runs. v1: the arrival
 * ferry (life ferry 0) becomes rideable after the arrival cinematic and runs Ferry Building ⇄ Pier 41 round one closed
 * loop: out of Gate E the way the district's harbour loop leaves it, along the city front outside the pier heads,
 * round Pier 39's end (clear of the K-Dock floats) into the channel, alongside the Wharf's waterfront promenade (the
 * Pier 41 landing), then west past the pier heads and back along the Bay to come into Gate E from the north as the
 * district's ferry does. Sausalito (C2's Marin board) is in the table as data (`running: false`) for a later boat.
 *
 * (wave 4, lane T, verify D2) The boat used to berth at the Pier 45 shed deck, whose only way ashore is walled in by the
 * sheds at the pier root in the published city: whoever landed there could not walk out. It now lies alongside the
 * promenade, and you wait / land on the promenade itself (connected to the whole city: tests/opus-bay-sf-ferry.test.ts).
 *
 *   FERRY                 boat constants (9 u/s, the deck, dwell)
 *   FERRY_ROUTES          the table: terminals (quay = where you wait, berth = where the boat stops), loop waypoints
 *   buildFerryLine(def)   → the smoothed closed loop (arc table, speed limits) and the terminal stops on it
 */

export const FERRY = {
  /** cruising speed (u/s) */
  speed: 9,
  acc: 1.2,
  dec: 1.4,
  /** lateral acceleration on curves (u/s²) and the slowest a curve limit goes */
  aLat: 1.6,
  vCurveMin: 2.5,
  /** slow ahead into and out of a berth (u/s) within `berthZone` u of it */
  berthSpeed: 3,
  berthZone: 22,
  /** dwell at a terminal (s); cut to `dwellRider` when a rider waits at the other end */
  dwell: 14,
  dwellRider: 4,
  /** hull (u): length, beam */
  length: 11.8,
  beam: 4.2,
  /** the open sun deck's floor above the boat origin */
  deckY: 2.05,
  /** gentle roll: amplitude (rad) and angular rate; bob (u) */
  roll: 0.02,
  rollRate: 0.9,
  bob: 0.05,
  /** a ride counts after this far on board (the plan's 150 u) */
  minRide: 150,
} as const;

export interface FerryTerminal {
  /** station id `[a-z0-9-]` */
  id: string;
  name: Bilingual;
  /** where a rider waits (the interactable) */
  quay: Vec2;
  /** where the boat stops (the loop passes through it) */
  berth: Vec2;
}

export interface FerryRouteDef {
  id: string;
  name: Bilingual;
  /** the boat serves this route in v1 */
  running: boolean;
  terminals: FerryTerminal[];
  /** closed loop through open water (control points, smoothed Catmull-Rom); includes each berth */
  loop: Vec2[];
  /**
   * (wave 8, lane A) the route runs a shuttle system of its own (world/sf/alcatrazFerry.ts: astern out of a slip, a
   * pivot, its own boat), not buildFerryLine's loop; `loop` then lists its paths' control points (open water and both
   * berths) for the checks that keep other traffic clear of the route (tests/opus-bay-w5-jets)
   */
  shuttle?: true;
}

/** Gate E: the district's ferry dock and the frame the district's own harbour loop leaves it by (world/life.ts). */
function gateE() {
  const dock = DISTRICT.ferryDock, fr = frameAt(42.5);
  const out = (d: number, along: number): Vec2 => ({ x: dock.x + fr.nx * d + fr.tx * along, z: dock.z + fr.nz * d + fr.tz * along });
  return { dock, out, heading: Math.atan2(-fr.tx, -fr.tz) };
}

const G = gateE();
/** alongside the Wharf promenade (its edge runs NNW here), the hull ≥ 3 u off the stones; the quay is on the promenade */
const PIER41_BERTH: Vec2 = { x: -194.9, z: 46.4 };
const PIER41_QUAY: Vec2 = { x: -186.5, z: 48.4 };

// --- wave 8 (lane A): the Alcatraz ferry, Pier 33 (Alcatraz Landing) ⇄ the island's dock ---------------------------------
//
// Alcatraz City Cruises: "All tours depart from Pier 33, Alcatraz Landing, located along San Francisco's scenic
// Embarcadero" (https://alcatrazcitycruises.com/plan-your-visit/directions/, read 2026-09-30). The boats lie in the slip
// between Pier 31 and Pier 33: OSM's floating pier "San Francisco Pier 33" (way 740486822, network Alcatraz Cruises) and
// its stop "Ferry Alcatraz" (node 3202359193, 37.8069704, −122.4041590 — https://www.openstreetmap.org/node/3202359193,
// read 2026-09-30). In the hand-made hero slab that slip is the water between the district's PIER 31 and PIER 33 decks
// (data/district.ts PIER_SPECS), 7–14 u wide: the toy boat lies there bow toward the shore, backs out past the pier heads
// and turns (world/sf/alcatrazFerry.ts). The island end lies alongside the ferry float (Alcatraz Ferry Terminal, OSM way
// 27999864; FLOAT in world/sf/landmarks/alcatraz.ts).

/** the Alcatraz route's ride line = its route id = its platform id */
export const ALCA_FERRY_ID = 'ferry-alcatraz';
/** Alcatraz's landmark origin (world/sf/landmarks/alcatrazGround.ts ALCA_X / ALCA_Z; a test keeps them equal) */
export const ALCA_ORIGIN: Vec2 = { x: -467.86, z: -58.25 };
const AL = (x: number, z: number): Vec2 => ({ x: +(ALCA_ORIGIN.x + x).toFixed(2), z: +(ALCA_ORIGIN.z + z).toFixed(2) });
/**
 * The two terminals: the Pier 33 berth in the slip (boat centre; bow toward the shore, 2.9 u off the pier33-front
 * plaza's edge) and the quay on that plaza (east of the telescope); the island berth alongside the float's water side
 * (local 18.65, −21.31: the float's half width + the half beam + 0.25) and the quay on the dock apron by the float.
 */
export const ALCA_TERMINALS = {
  pier33: { id: 'pier-33', name: { zh: '恶魔岛渡轮码头 · 33 号码头', en: 'Pier 33 · Alcatraz Landing' }, quay: { x: -94.0, z: -21.8 }, berth: { x: -94.1, z: -32.6 } },
  island: { id: 'alcatraz-dock', name: { zh: '恶魔岛码头', en: 'Alcatraz dock' }, quay: AL(15.6, -16.6), berth: AL(18.65, -21.31) },
} as const satisfies Record<string, FerryTerminal>;
/** where the boat turns after backing out of the slip (past the pier heads, on the slip's axis) */
export const ALCA_PIVOT: Vec2 = { x: -103.9, z: -60.95 };
/**
 * The outbound path: from the pivot on along the slip's axis (north-north-west) across the waterfront's ferry tracks —
 * west of the little sailboat loop off Pier 35 (life.ts, its west tip at x −104) — to a lane north of all the other
 * boats, west to the island, round its south-west in a U-turn and east alongside the float (the boat lies heading east).
 */
export const ALCA_OUT: readonly Vec2[] = [
  ALCA_PIVOT, { x: -108.47, z: -74.18 }, { x: -112.39, z: -85.52 }, { x: -116.0, z: -95.9 }, { x: -120.5, z: -107 }, { x: -129, z: -120 },
  { x: -148, z: -129 }, { x: -250, z: -131 }, { x: -380, z: -129 }, { x: -460, z: -128 }, AL(-10, -68), AL(-36, -60), AL(-50, -46), AL(-52, -31),
  AL(-40, -22.5), AL(-14, -21.3), AL(5, -21.3), ALCA_TERMINALS.island.berth,
];
/** The return path: east from the float, a lane north of the ambient ferries, south down the slip's axis, into the slip. */
export const ALCA_BACK: readonly Vec2[] = [
  ALCA_TERMINALS.island.berth, AL(31.86, -22.65), AL(52.86, -27.75), { x: -380, z: -100 }, { x: -300, z: -117 }, { x: -190, z: -121 },
  { x: -146, z: -119 }, { x: -126, z: -112 }, { x: -117.62, z: -100.65 }, { x: -112.39, z: -85.52 }, { x: -107.17, z: -70.4 }, ALCA_PIVOT,
  ALCA_TERMINALS.pier33.berth,
];
/** The crossing of the waterfront's ferry tracks: the stretch of the slip's axis both paths share (pivot → lane north). */
export const ALCA_CROSSING: readonly [Vec2, Vec2] = [ALCA_PIVOT, { x: -120.5, z: -107 }];

export const FERRY_ROUTES: FerryRouteDef[] = [
  {
    id: 'ferry',
    name: { zh: '渡轮 · 渡轮大厦 ⇄ 41 号码头', en: 'Ferry · Ferry Building ⇄ Pier 41' },
    running: true,
    terminals: [
      { id: 'ferry-building', name: { zh: '渡轮大厦 · E 号登船口', en: 'Ferry Building · Gate E' }, quay: DISTRICT.anchors['ferry-gate'] ?? { x: 157, z: -21 }, berth: G.dock },
      { id: 'pier-41', name: { zh: '41 号码头', en: 'Pier 41' }, quay: PIER41_QUAY, berth: PIER41_BERTH },
    ],
    loop: [
      G.dock, G.out(8, -6), G.out(24, 10),
      { x: 110, z: -76 }, { x: 0, z: -80 }, { x: -100, z: -72 }, { x: -165, z: -66 }, { x: -212, z: -48 }, { x: -232, z: -20 },
      { x: -236, z: 12 }, { x: -228, z: 27 }, { x: -207, z: 29 }, { x: -191, z: 36.5 },
      PIER41_BERTH,
      { x: -201.6, z: 55.6 }, { x: -214, z: 57.4 }, { x: -234, z: 57.6 }, { x: -268, z: 59.2 }, { x: -286, z: 50 }, { x: -294, z: 28 }, { x: -280, z: -6 }, { x: -246, z: -52 }, { x: -180, z: -84 },
      { x: -60, z: -88 }, { x: 60, z: -86 }, G.out(22, 30), G.out(8, 18),
    ],
  },
  {
    // v1: data only (C2's Marin board is in; a second boat runs it later). Ferry Building → Sausalito ferry landing.
    id: 'ferry-sausalito',
    name: { zh: '渡轮 · 渡轮大厦 ⇄ 索萨利托', en: 'Ferry · Ferry Building ⇄ Sausalito' },
    running: false,
    terminals: [
      { id: 'ferry-building', name: { zh: '渡轮大厦 · E 号登船口', en: 'Ferry Building · Gate E' }, quay: DISTRICT.anchors['ferry-gate'] ?? { x: 157, z: -21 }, berth: G.dock },
      { id: 'sausalito', name: { zh: '索萨利托', en: 'Sausalito' }, quay: { x: -1262, z: 116 }, berth: { x: -1258, z: 106 } },
    ],
    loop: [
      G.dock, G.out(8, -6), G.out(24, 10), { x: 110, z: -80 }, { x: -120, z: -95 }, { x: -330, z: -110 }, { x: -600, z: -60 },
      { x: -900, z: 40 }, { x: -1150, z: 90 }, { x: -1258, z: 106 }, { x: -1240, z: 70 }, { x: -1000, z: 0 }, { x: -620, z: -120 },
      { x: -300, z: -130 }, { x: -60, z: -100 }, { x: 60, z: -90 }, G.out(22, 30), G.out(8, 18),
    ],
  },
  {
    // wave 8 (lane A): city mode, its own boat and shuttle (world/sf/alcatrazFerry.ts); by day, on the real timetable's hours
    id: ALCA_FERRY_ID,
    name: { zh: '渡轮 · 33 号码头 ⇄ 恶魔岛', en: 'Ferry · Pier 33 ⇄ Alcatraz' },
    running: true,
    shuttle: true,
    terminals: [ALCA_TERMINALS.pier33, ALCA_TERMINALS.island],
    loop: [...ALCA_OUT, ...ALCA_BACK.slice(1, -1)],
  },
];

export interface FerryStop { terminal: string; u: number }
export interface FerryLine {
  id: string;
  name: Bilingual;
  /** the loop: x, z pairs; cum has n + 1 entries (the last closes back to vertex 0) */
  xz: Float32Array;
  cum: Float32Array;
  length: number;
  /** speed limit per vertex */
  vlim: Float32Array;
  stops: FerryStop[];
  terminals: FerryTerminal[];
}

/** Closed Catmull-Rom through the control points, `per` samples a segment. */
function catmullLoop(src: Vec2[], per = 10): Vec2[] {
  const n = src.length, out: Vec2[] = [];
  const get = (i: number) => src[(i + n) % n];
  for (let i = 0; i < n; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  return out;
}

/** Point on a ferry loop at u (wraps): position and heading of travel. */
export function ferryPoint(line: Pick<FerryLine, 'xz' | 'cum' | 'length'>, u: number): { x: number; z: number; heading: number; i: number } {
  const L = line.length, uu = ((u % L) + L) % L, cum = line.cum, n = line.xz.length / 2;
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= uu) lo = mid; else hi = mid; }
  const j = (lo + 1) % n, t = (uu - cum[lo]) / (cum[lo + 1] - cum[lo] || 1), a = line.xz;
  return { x: a[lo * 2] + (a[j * 2] - a[lo * 2]) * t, z: a[lo * 2 + 1] + (a[j * 2 + 1] - a[lo * 2 + 1]) * t, heading: Math.atan2(a[j * 2] - a[lo * 2], a[j * 2 + 1] - a[lo * 2 + 1]), i: lo };
}

/** Build a route's smoothed loop, its speed limits (curves, slow ahead near berths) and the terminal stops on it. */
export function buildFerryLine(def: FerryRouteDef): FerryLine {
  const pts = catmullLoop(def.loop);
  const n = pts.length;
  const xz = new Float32Array(n * 2), cum = new Float32Array(n + 1);
  pts.forEach((p, i) => {
    xz[i * 2] = p.x; xz[i * 2 + 1] = p.z;
    const q = pts[(i + 1) % n];
    cum[i + 1] = cum[i] + Math.hypot(q.x - p.x, q.z - p.z);
  });
  const length = cum[n];
  const line = { xz, cum, length };
  const stops: FerryStop[] = def.terminals.map(t => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) { const d = Math.hypot(pts[i].x - t.berth.x, pts[i].z - t.berth.z); if (d < bd) { bd = d; best = i; } }
    return { terminal: t.id, u: cum[best] };
  });
  const vlim = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = ferryPoint(line, cum[i] - FERRY.length / 2), b = ferryPoint(line, cum[i] + FERRY.length / 2), p = ferryPoint(line, cum[i]);
    let dh = Math.atan2(b.x - p.x, b.z - p.z) - Math.atan2(p.x - a.x, p.z - a.z);
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    const k = Math.abs(dh) / FERRY.length;
    let v = k > 1e-4 ? Math.max(FERRY.vCurveMin, Math.min(FERRY.speed, Math.sqrt(FERRY.aLat / k))) : FERRY.speed;
    for (const st of stops) {
      const d = Math.min(Math.abs(cum[i] - st.u), length - Math.abs(cum[i] - st.u));
      if (d < FERRY.berthZone) v = Math.min(v, FERRY.berthSpeed + (FERRY.speed - FERRY.berthSpeed) * (d / FERRY.berthZone) ** 2);
    }
    vlim[i] = v;
  }
  stops.sort((a, b) => a.u - b.u);
  return { id: def.id, name: def.name, xz, cum, length, vlim, stops, terminals: def.terminals };
}

/** The route and terminal of a ferry station id. */
export function ferryTerminal(id: string): { route: FerryRouteDef; terminal: FerryTerminal } | null {
  for (const route of FERRY_ROUTES) {
    if (!route.running) continue;
    const terminal = route.terminals.find(t => t.id === id);
    if (terminal) return { route, terminal };
  }
  return null;
}

/** The berth heading at Gate E (the district's ferry lies alongside, bow toward the Ferry Building's south end). */
export const GATE_E_HEADING = G.heading;
