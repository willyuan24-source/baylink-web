/**
 * Wave 5 · lane E · W5-E2: where the coins lie — placed on our own published city, never by hand-typed coordinates
 * alone (the postcard rules of tests/opus-bay-w4-postcards.test.ts + the plan §3.4 table):
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/coins-place.mts            # place, check, print a report
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/coins-place.mts --write    # … and write economy/coinSpots.ts
 *   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/coins-place.mts --sources  # append missing fixed reward sources
 *                                                                                   # to economy/sources.ts (append-only)
 *   … --write --replace a,b   place these ids again even if they pass · --fresh   place everything again
 *   COINS_DEBUG=<trail id> …  print why each candidate spot of that trail was taken or refused
 *
 * A published spot that still passes every rule is KEPT where it is (players learn where the coins lie); only failing
 * ones are placed again.
 *
 * - TRAILS (≈ 60 × 5–8 coins, refilled every Bay day): each definition names an anchor (an attraction, a transit stop or
 *   a point) and a kind. `climb` finds the highest walking-graph node near the anchor and the lowest one 30–70 u of path
 *   below it, and lays the coins on the last stretch up to the top (stairways, crests, viewpoint paths); `pier` walks to
 *   the node with the most water round it (the pier end) and lays them on the way out; `path` follows the park / trail
 *   network (non-street edges first) away from the anchor; `stop` leads from a loop / Metro stop toward what it serves.
 *   Coins every 4 u (3.5 on a climb), sampled every 0.5 u along the graph path.
 * - CACHES (40, once per save): a small stack of coins in an odd corner — `top` (the highest standable point),
 *   `end` (a pier end), `nook` (a dead end of the path network), `spot` (a checked point) — or `air` (hanging over a
 *   roof / dome, reached by the pelican).
 * - RINGS (15 + the reserved first-flight slot of lane A, once per save): 8 coins on a vertical circle (radius 3.2 u)
 *   hanging over a landmark, flown through with the pelican: the circle's lowest coin sits ≥ 1.5 u over the glide's soft
 *   floor (ground / roofs / tall parts within 6 u, + 6) and its top ≤ 250 (the ceiling is 260).
 *
 * Every ground spot: standable (core/terrain canStand), not water, a walking-graph node within 12 u that joins the
 * network of the Ferry gate, ≥ 6.5 u from every card prompt (landmark POIs, place cards, attractions and their
 * arrivals, postcards), ≥ 3 u from any other coin, and — the mid-wave checkpoint's CP-5 — never BOXED, SNAG or
 * UNREACHABLE in lane F's walk sweep (the real controller pushed four ways; the game's path finder from the graph).
 * Spots in the Financial District / South Beach and Chinatown zones are flagged `dt` (downtown: held until lane V
 * publishes the measured headroom, plan MF9 / D15).
 *
 * APPEND-ONLY: a trail, cache or ring keeps its place in the list (its ledger bits: trail i owns bits 8i … 8i + 7 of
 * `play.t`, ring i bits 8i … 8i + 7 of `play.g.ring`, cache i bit i of `play.g.cache`); new ones are appended; a
 * definition that disappears keeps its slot as `retired`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { sfDisk } from '../../tests/opus-bay-sf-disk';

// --- headless canvas stub (world modules create label atlases at import time) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { createCityTerrain } = await import('../../src/opus-bay/core/sfTerrain');
const terrain = await import('../../src/opus-bay/core/terrain');
const { GRAPH_EDGE, demSample } = await import('../../src/opus-bay/world/sf/format');
const { CitySites } = await import('../../src/opus-bay/world/sf/sites');
const { runtime } = await import('../../src/opus-bay/core/runtime');
const { findPath } = await import('../../src/opus-bay/actors/nav');
const { openHeading } = await import('../../src/opus-bay/actors/faceOpen');
const { PlayerController } = await import('../../src/opus-bay/actors/controller');
const { findGraphPath } = await import('../../src/opus-bay/core/walkGraph');
const { project } = await import('../../src/opus-bay/core/geo');
const { landmarkTallStructures } = await import('../../src/opus-bay/world/sf/landmarks/context');
const { terrainGlideWorld, GLIDE } = await import('../../src/opus-bay/actors/glide');
const { heroTall, bayBridgeTall } = await import('../../src/opus-bay/actors/glideTall');
const { ATTRACTIONS } = await import('../../src/opus-bay/data/sf/attractions');
const { CITY_POIS } = await import('../../src/opus-bay/data/sf/cityPois');
const { PLACE_CARDS } = await import('../../src/opus-bay/data/sf/placeCards');
const { PLACE_CARDS_2 } = await import('../../src/opus-bay/data/sf/placeCards2');
const { CITY_POSTCARDS } = await import('../../src/opus-bay/data/sf/postcards');
const { DISTRICT_POSTCARDS } = await import('../../src/opus-bay/data/postcards');
const { DISTRICT } = await import('../../src/opus-bay/data/district');
const { SITE_ARRIVALS } = await import('../../src/opus-bay/data/sf/siteArrivals');

const ROOT = path.resolve(import.meta.dirname, '../..');

// ---------------------------------------------------------------------------------------------------------------
// The rules (the test imports these)
// ---------------------------------------------------------------------------------------------------------------

export const RULES = {
  /** caches from every card prompt (the postcard rule) */
  promptClear: 6.5,
  /**
   * trail coins from every card prompt: coins have no prompt (they are picked up by walking through them), and at
   * 0.14 u per metre the famous stairways are 7–20 u long with their card standing on them (the Tiled Steps lie
   * entirely within 7 u of theirs), so a trail keeps only clear of the prompt spot itself
   */
  trailPromptClear: 3.5,
  /** every coin from a trip end / landing spot (the attractions' arrivals, lane L's site arrivals: lane N's request) */
  arrivalClear: 4,
  /** a walking-graph node of the Ferry gate's network within this … */
  navReach: 12,
  /** … or a walk over standable ground of at most this many 1 u steps to one (piers, jetties) */
  walkReach: 90,
  /** between any two coins */
  coinGap: 3,
  /** caches from trail coins */
  cacheGap: 10,
  /** ring radius, pickup margin over the soft floor, top limit */
  ringR: 3.2,
  ringFloorMargin: 1.5,
  ringTop: 250,
  /** air caches float this far over the soft floor */
  airCacheLift: 1,
  trailMin: 5,
  trailMax: 8,
  /**
   * the walk check (W5-E, the mid-wave checkpoint's CP-5: lane F's sweep, scripts/opus-sf/qa/sweep-static.mts): the real
   * controller pushed `walkPushS` s in four directions (the most open one first, then 90° steps) must move ≥ `walkMove` u
   * in at least 2 of them (a pier or a stairway is a corridor: fine), never stop dead where the ground ahead is open (a
   * snag), and the game's own path finder must reach the spot from the walking graph (within `walkReachEnd` u)
   */
  walkPushS: 1.5,
  walkMove: 3,
  walkReachEnd: 1.1,
} as const;

export const DOWNTOWN_ZONES = ['financial-district-south-beach', 'chinatown'] as const;

export interface Prompt { id: string; x: number; z: number; /** a trip end / landing: every coin keeps RULES.arrivalClear */ arrival?: true }

/** Every card prompt the coins keep clear of (the postcard test's list + the postcards themselves). */
export function cardPrompts(): Prompt[] {
  return [
    ...CITY_POIS.map(p => ({ id: `poi ${p.id}`, ...p.position })),
    ...[...PLACE_CARDS, ...PLACE_CARDS_2].filter(c => c.lat !== undefined && c.lng !== undefined).map(c => ({ id: `card ${c.id}`, ...project(c.lat!, c.lng!) })),
    ...ATTRACTIONS.flatMap(a => [{ id: `attraction ${a.id}`, x: a.x, z: a.z }, ...(a.arrival ? [{ id: `arrival ${a.id}`, x: a.arrival.x, z: a.arrival.z, arrival: true as const }] : [])]),
    // lane L's site arrivals (lane N wires them as the attractions' trip ends and landings: its request to lane E)
    ...Object.entries(SITE_ARRIVALS).map(([id, a]) => ({ id: `site arrival ${id}`, x: a.x, z: a.z, arrival: true as const })),
    ...[...CITY_POSTCARDS, ...DISTRICT_POSTCARDS].map(c => ({ id: `postcard ${c.id}`, ...c.position })),
  ];
}

export interface CityCtx {
  ix: Awaited<ReturnType<ReturnType<typeof sfDisk>['graphIndex']>>;
  home: number;
  prompts: Prompt[];
  /** attach the chunks around (x, z) (idempotent) */
  ensure(x: number, z: number, r?: number): Promise<void>;
  zoneOf(x: number, z: number): string | null;
  glide: ReturnType<typeof terrainGlideWorld>;
  done(): void;
}

/**
 * Load the published city the way the game streams it (and lane F's sweep judges it): the landmark sites' walk inputs
 * from CitySites (tops, sinks, their measured bases), chunks attached on demand.
 */
export async function loadCity(): Promise<CityCtx> {
  const sf = sfDisk();
  const far = await sf.far();
  const sites = new CitySites(), lms = sites.walkInputs();
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(far);
  sites.onBase = (id, y) => { city.setLandmarkBase(id, y); };
  sites.attach(null as never, (x, z) => demSample(far.dem, x, z));
  terrain.setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  const ix = await sf.graphIndex();
  const ferry = DISTRICT.anchors['ferry-gate'];
  const home = ix.component(ix.nearestNode(ferry.x, ferry.z, 60));
  const zg = far.zoneGrid;
  const zoneOf = (x: number, z: number) => {
    const i = Math.floor((x - zg.originX) / zg.step), j = Math.floor((z - zg.originZ) / zg.step);
    if (i < 0 || j < 0 || i >= zg.cols || j >= zg.rows) return null;
    const k = zg.idx[j * zg.cols + i];
    return k ? far.zones[k - 1].id : null;
  };
  const base = (l: { id: string; x: number; z: number; base: 'terrain' | number }) => {
    if (typeof l.base === 'number') return l.base;
    const b = (city as unknown as { landmarkBase?: (id: string) => number | null }).landmarkBase?.(l.id);
    return typeof b === 'number' && Number.isFinite(b) ? b : terrain.heightAt(l.x, l.z);
  };
  let tall: ReturnType<typeof heroTall> | null = null;
  const glide = terrainGlideWorld(() => {
    tall ??= [...heroTall(), ...landmarkTallStructures(base), ...bayBridgeTall()];
    return { roofAt: (x: number, z: number, r: number) => { let top = -Infinity; for (const t of tall!) if (Math.hypot(t.x - x, t.z - z) <= t.r + r && t.top > top) top = t.top; return top; } };
  });
  const attached = new Set<string>();
  return {
    ix, home, prompts: cardPrompts(), zoneOf, glide,
    async ensure(x, z, r = 24) {
      const k = `${Math.round(x / 16)}_${Math.round(z / 16)}_${r}`;
      if (attached.has(k)) return;
      attached.add(k);
      tall = null;
      await sf.attachAround(city, x, z, r, lms);
      terrain.setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
    },
    done() { terrain.setCityTerrain(null); },
  };
}

/**
 * Reachable on foot: a walking-graph node of the Ferry gate's network within RULES.navReach, or — for piers and
 * jetties the graph does not cover — a walk over standable ground (1 u steps, ≤ RULES.walkReach u) to within 4 u of one.
 */
export function reachable(ctx: CityCtx, x: number, z: number): boolean {
  const home = (i: number) => ctx.ix.component(i) === ctx.home;
  if (ctx.ix.nearestNode(x, z, RULES.navReach, home) >= 0) return true;
  if (!terrain.canStand(x, z)) return false;
  const key = (i: number, j: number) => `${i},${j}`;
  const seen = new Set<string>([key(0, 0)]);
  let front: [number, number][] = [[0, 0]];
  for (let step = 0; step < RULES.walkReach && front.length; step++) {
    const next: [number, number][] = [];
    for (const [i, j] of front) {
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const a = i + di, b = j + dj, k = key(a, b);
        if (seen.has(k)) continue;
        seen.add(k);
        const px = x + a, pz = z + b;
        if (!terrain.canStand(px, pz)) continue;
        if (ctx.ix.nearestNode(px, pz, 4, home) >= 0) return true;
        next.push([a, b]);
      }
    }
    front = next;
  }
  return false;
}

/**
 * What is wrong with a ground coin / cache spot (empty = fine). Call ctx.ensure(x, z) first. `clear` = the distance
 * kept from card prompts: RULES.promptClear (6.5, the postcard rule) for caches, RULES.trailPromptClear for trail coins.
 */
export function spotProblems(ctx: CityCtx, x: number, z: number, clear: number = RULES.promptClear): string[] {
  const out: string[] = [];
  if (!terrain.canStand(x, z)) out.push('not standable');
  if (terrain.isWater(x, z)) out.push('water');
  for (const p of ctx.prompts) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < (p.arrival ? Math.max(clear, RULES.arrivalClear) : clear)) { out.push(`${d.toFixed(1)} u from ${p.id}`); break; }
  }
  if (!out.length && !reachable(ctx, x, z)) out.push('not reachable on foot from the Ferry gate network');
  return out;
}

let probe: InstanceType<typeof PlayerController> | null = null;
/** The real controller pushed RULES.walkPushS s from (x, z) along `heading`: how far it got. */
function push(x: number, z: number, heading: number): number {
  const DT = 1 / 30, p = runtime.player;
  probe ??= new PlayerController();
  p.x = x; p.z = z; p.y = terrain.heightAt(x, z); p.heading = heading; p.pathTarget = null; p.locked = false;
  probe.sync();
  const dx = Math.sin(heading), dz = Math.cos(heading), yaw = Math.atan2(-dx, -dz);
  runtime.input.moveX = 0; runtime.input.moveY = 1; runtime.input.run = false; runtime.input.jump = false;
  for (let i = 0; i < RULES.walkPushS / DT; i++) probe.step({ dt: DT, now: i * DT, cameraYaw: yaw, frozen: false, riding: false });
  runtime.input.moveY = 0;
  return Math.hypot(p.x - x, p.z - z);
}

/**
 * What stops a player at a ground spot (empty = fine), lane F's sweep verdicts: BOXED (≤ 1 of 4 directions moves
 * RULES.walkMove u), SNAG (open ground ahead but the controller does not move), UNREACHABLE (the path finder from the
 * walking graph's main network ends > RULES.walkReachEnd u short). A corridor (a pier, a stairway: 2 directions) is fine.
 */
export async function walkProblems(ctx: CityCtx, x: number, z: number): Promise<string[]> {
  await ctx.ensure(x, z, 48);
  if (!terrain.canStand(x, z, 0.4)) return ['not standable for the walker'];
  const out: string[] = [];
  const first = openHeading(x, z, 0).heading;
  let moving = 0, snags = 0;
  for (let k = 0; k < 4; k++) {
    const h = first + (k * Math.PI) / 2, dx = Math.sin(h), dz = Math.cos(h);
    const moved = push(x, z, h);
    if (moved >= RULES.walkMove) moving++;
    else if ([1, 2, 3].every(d => terrain.canStand(x + dx * d, z + dz * d, 0.4))) snags++;
  }
  if (moving <= 1) out.push(`boxed (${moving} of 4 directions move ${RULES.walkMove} u)`);
  if (snags) out.push(`${snags} snag${snags > 1 ? 's' : ''} (open ground ahead, no move)`);
  const n = ctx.ix.nearestNode(x, z, 60, i => ctx.ix.component(i) === ctx.home);
  const res = n >= 0 ? findPath({ x: ctx.ix.x(n), z: ctx.ix.z(n) }, { x, z }, 8) : null;
  const e = res?.points[res.points.length - 1];
  const end = res ? (e ? Math.hypot(e.x - x, e.z - z) : 0) : Infinity;
  if (end > RULES.walkReachEnd) out.push(`the path finder ends ${Number.isFinite(end) ? `${end.toFixed(1)} u short` : 'nowhere'}`);
  return out;
}

export interface RingGeom { x: number; y: number; z: number; yaw: number; r: number }
/** The eight coin positions of a ring (a vertical circle across the flight direction `yaw`). */
export function ringCoins(r: RingGeom): { x: number; y: number; z: number }[] {
  const ax = Math.cos(r.yaw), az = -Math.sin(r.yaw);
  return Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return { x: r.x + ax * Math.cos(a) * r.r, y: r.y + Math.sin(a) * r.r, z: r.z + az * Math.cos(a) * r.r };
  });
}

/** What is wrong with an air ring / air cache (empty = fine): every coin ≥ margin over the soft floor, ≤ the top. */
export function airProblems(ctx: CityCtx, coins: { x: number; y: number; z: number }[]): string[] {
  const out: string[] = [];
  for (const c of coins) {
    if (!terrain.inWorld(c.x, c.z)) { out.push('outside the model'); break; }
    const floor = Math.max(ctx.glide.heightAt(c.x, c.z), ctx.glide.roofAt(c.x, c.z, GLIDE.floorR)) + GLIDE.floorClear;
    if (c.y < floor + RULES.ringFloorMargin - 1e-6) { out.push(`coin at y ${c.y.toFixed(1)} under the soft floor ${floor.toFixed(1)} + ${RULES.ringFloorMargin}`); break; }
    if (c.y > RULES.ringTop) { out.push(`coin at y ${c.y.toFixed(1)} over ${RULES.ringTop}`); break; }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The definitions
// ---------------------------------------------------------------------------------------------------------------

type Anchor = string | readonly [number, number];
export type TrailKind = 'steps' | 'climb' | 'pier' | 'path' | 'stop';
/**
 * A trail: `at` the anchor, `r` the search radius, `n` coins (5–8), `to` an end to walk to, `line` an explicit polyline
 * (overrides the graph search), `rev` lay the coins from the far end back, `gap` their spacing, `skip` the first u left bare.
 */
interface TrailDef { id: string; kind: TrailKind; at: Anchor; to?: Anchor; line?: readonly (readonly [number, number])[]; rev?: boolean; r?: number; n?: number; gap?: number; skip?: number; why: string }
interface CacheDef { id: string; kind: 'top' | 'end' | 'nook' | 'spot' | 'air'; at: Anchor; r?: number; why: string }
interface RingDef { id: string; at: Anchor; yaw?: number; lift?: number; why: string }

/** ≈ 60 trails: stairways and crests, pier ends, park paths, loop and Metro stops (plan §3.4). */
export const TRAIL_DEFS: readonly TrailDef[] = [
  // stairways and crests (the coins lead up to the top)
  { id: 'filbert-steps', kind: 'climb', at: [-24.4, 28.9], to: [-54.1, 54.6], n: 8, why: 'the Filbert Steps from Levi\'s Plaza up to Coit' },
  { id: 'lyon-street-steps', kind: 'steps', at: 'lyon-street-steps', r: 40, n: 7, why: 'the Lyon Street Steps' },
  { id: 'tiled-steps', kind: 'steps', at: 'tiled-steps-16th-avenue', r: 30, n: 8, why: 'the 16th Avenue Tiled Steps and on up Grand View' },
  { id: 'hidden-garden-steps', kind: 'steps', at: 'hidden-garden-steps', r: 30, n: 5, gap: 3, why: 'the Hidden Garden Steps' },
  { id: 'macondray-lane', kind: 'path', at: 'macondray-lane', r: 50, why: 'Macondray Lane' },
  // 'ina-coolbrith' is RETIRED (CP-5): the park's top terrace is boxed in and its paths hold only 3–4 coins that the
  // walker can leave; its slot stays (append-only), its coins moved to 'fort-mason-meadow' at the end of the list
  { id: 'lombard-steps', kind: 'steps', at: 'lombard-crooked', r: 40, why: 'the steps beside the crooked block' },
  { id: 'twin-peaks', kind: 'climb', at: 'twin-peaks', r: 80, n: 8, why: 'up to the Twin Peaks lookout' },
  { id: 'bernal-summit', kind: 'climb', at: 'bernal-heights-park', r: 80, n: 7, why: 'Bernal Heights to the summit' },
  { id: 'mount-davidson', kind: 'climb', at: 'mount-davidson', r: 80, n: 7, why: 'Mount Davidson, the top of SF' },
  { id: 'corona-heights', kind: 'climb', at: 'corona-heights-randall-museum', r: 60, why: 'Corona Heights' },
  { id: 'buena-vista-park', kind: 'climb', at: 'buena-vista-park', r: 70, why: 'Buena Vista Park' },
  { id: 'alta-plaza', kind: 'climb', at: 'alta-plaza-park', r: 60, why: 'Alta Plaza\'s terraces' },
  { id: 'lafayette-park', kind: 'climb', at: 'lafayette-park', r: 60, why: 'Lafayette Park' },
  { id: 'dolores-park', kind: 'climb', at: 'dolores-park', r: 70, why: 'the top of Dolores Park' },
  { id: 'sutro-heights', kind: 'climb', at: 'sutro-heights-park', r: 50, why: 'Sutro Heights' },
  { id: 'mclaren-park', kind: 'climb', at: 'mclaren-park', r: 80, why: 'McLaren Park' },
  { id: 'glen-canyon', kind: 'path', at: 'glen-canyon-park', r: 70, why: 'Glen Canyon' },
  { id: 'mount-sutro', kind: 'path', at: 'mount-sutro-open-space', r: 70, why: 'the Mount Sutro forest trail' },
  // pier ends and jetties (explicit lines where the walking graph does not go)
  { id: 'pier-39', kind: 'pier', at: [-161.1, 15.0], line: [[-163, 12], [-172, 7], [-181, 2], [-190, -3], [-196, -8]], why: 'out along PIER 39' },
  // (CP-5: the municipal pier and the Wave Organ jetty's far part are off the walking network — the path finder cannot
  // reach them —, so their slots now lead along the shore to the pier's foot and out to where the jetty walk ends)
  { id: 'municipal-pier', kind: 'path', at: [-288, 175], r: 45, n: 6, why: 'Aquatic Park\'s promenade to the municipal pier\'s foot' },
  { id: 'pier-7', kind: 'pier', at: [69.6, -5.4], r: 60, n: 7, why: 'Pier 7' },
  { id: 'pier-14', kind: 'pier', at: [157.0, -21.0], r: 50, why: 'Pier 14 by the Ferry Building' },
  { id: 'wave-organ-jetty', kind: 'path', at: 'wave-organ', r: 60, n: 6, why: 'Yacht Road out toward the Wave Organ' },
  { id: 'crane-cove', kind: 'pier', at: 'crane-cove-park', r: 70, why: 'Crane Cove Park' },
  { id: 'herons-head', kind: 'pier', at: 'herons-head-park', r: 90, n: 8, why: 'Heron\'s Head spit' },
  // park paths, promenades and beaches
  { id: 'blue-heron-lake', kind: 'path', at: 'blue-heron-lake', r: 70, n: 8, why: 'round Blue Heron Lake' },
  { id: 'lands-end-trail', kind: 'path', at: 'lands-end', r: 90, n: 8, why: 'the Lands End trail' },
  { id: 'crissy-promenade', kind: 'path', at: 'crissy-field', r: 90, n: 8, why: 'the Crissy Field promenade' },
  { id: 'marina-green', kind: 'path', at: 'marina-green', r: 80, why: 'Marina Green' },
  { id: 'tunnel-tops', kind: 'path', at: 'presidio-tunnel-tops', r: 60, why: 'Presidio Tunnel Tops' },
  { id: 'conservatory-lawn', kind: 'path', at: 'conservatory-of-flowers', r: 60, why: 'the Conservatory of Flowers\' lawn' },
  { id: 'hippie-hill', kind: 'path', at: 'hippie-hill', r: 50, why: 'Hippie Hill' },
  { id: 'alamo-square', kind: 'path', at: 'alamo-square-painted-ladies', r: 60, why: 'Alamo Square' },
  { id: 'stern-grove', kind: 'path', at: 'stern-grove', r: 80, why: 'Stern Grove' },
  { id: 'lake-merced', kind: 'path', at: 'lake-merced', r: 90, why: 'the Lake Merced path' },
  { id: 'dutch-windmill', kind: 'path', at: 'dutch-windmill', r: 60, why: 'the windmill and tulip garden' },
  { id: 'ocean-beach', kind: 'path', at: 'ocean-beach', r: 80, n: 8, why: 'along Ocean Beach' },
  { id: 'sunset-dunes', kind: 'path', at: 'sunset-dunes', r: 80, why: 'Sunset Dunes park' },
  { id: 'fort-funston', kind: 'path', at: 'fort-funston', r: 90, why: 'Fort Funston\'s bluff' },
  { id: 'india-basin', kind: 'path', at: 'india-basin-waterfront-park', r: 70, why: 'India Basin shoreline' },
  { id: 'visitacion-greenway', kind: 'path', at: 'visitacion-valley-greenway', r: 70, why: 'the Visitacion Valley Greenway' },
  { id: 'mountain-lake', kind: 'path', at: 'mountain-lake-park', r: 70, why: 'Mountain Lake' },
  { id: 'baker-beach', kind: 'path', at: 'baker-beach', r: 80, why: 'Baker Beach' },
  { id: 'candlestick', kind: 'path', at: 'candlestick-point-sra', r: 90, why: 'Candlestick Point' },
  { id: 'bison-paddock', kind: 'path', at: 'bison-paddock', r: 60, why: 'by the bison paddock' },
  { id: 'koret-playground', kind: 'path', at: 'koret-carousel', r: 50, why: 'toward the Koret carousel' },
  { id: 'yerba-buena', kind: 'path', at: 'yerba-buena-gardens', r: 50, why: 'Yerba Buena Gardens' },
  // loop and Metro stops (the coins lead from the stop toward what it serves)
  { id: 'stop-palace', kind: 'stop', at: 'loop-palace-of-fine-arts', to: 'palace-of-fine-arts', n: 5, why: 'sightseeing stop: Palace of Fine Arts' },
  { id: 'stop-ggb', kind: 'stop', at: 'loop-golden-gate-bridge', to: 'golden-gate-bridge', n: 6, why: 'sightseeing stop: Golden Gate Bridge' },
  { id: 'stop-haight', kind: 'stop', at: 'loop-haight-ashbury', to: 'buena-vista-park', n: 5, why: 'sightseeing stop: Haight-Ashbury' },
  { id: 'stop-painted-ladies', kind: 'stop', at: 'loop-painted-ladies', to: 'alamo-square-painted-ladies', n: 5, why: 'sightseeing stop: Painted Ladies' },
  { id: 'stop-castro', kind: 'stop', at: 'loop-castro', to: [150, 790], n: 5, why: 'sightseeing stop: Castro, up Castro Street' },
  { id: 'stop-mission-dolores', kind: 'stop', at: 'loop-mission-dolores', to: 'dolores-park', n: 6, why: 'sightseeing stop: Mission Dolores' },
  { id: 'stop-la-playa', kind: 'stop', at: 'muni-judah-la-playa', to: 'ocean-beach', n: 6, why: 'N Judah terminal → Ocean Beach' },
  { id: 'stop-west-portal', kind: 'stop', at: 'muni-west-portal', to: [100, 1285], n: 5, why: 'M West Portal, down West Portal Avenue' },
  { id: 'stop-sf-state', kind: 'stop', at: 'muni-19th-holloway', to: 'sf-state-university', n: 6, why: 'M 19th Ave & Holloway → SF State' },
  { id: 'stop-carl-cole', kind: 'stop', at: 'muni-carl-cole', to: 'haight-ashbury', n: 5, why: 'N Carl & Cole' },
  { id: 'stop-9th-irving', kind: 'stop', at: 'muni-9th-irving', to: 'irving-street', n: 5, why: 'N 9th & Irving' },
  { id: 'stop-duboce-park', kind: 'stop', at: 'muni-duboce-park', to: 'corona-heights-randall-museum', n: 5, why: 'N Duboce Park' },
  // appended after W5-E2 (CP-5)
  { id: 'fort-mason-meadow', kind: 'path', at: 'fort-mason-center', r: 60, n: 6, why: 'the Great Meadow paths above Fort Mason (replaces the retired Ina Coolbrith trail)' },
];

/** 40 caches: hilltops, pier ends, nooks, the signature corners' streets (lane L), two over roofs / domes (glide). */
export const CACHE_DEFS: readonly CacheDef[] = [
  { id: 'grand-view-top', kind: 'top', at: 'grand-view-park', r: 40, why: 'Grand View Park summit' },
  { id: 'corona-top', kind: 'top', at: 'corona-heights-randall-museum', r: 25, why: 'Corona Heights rocks' },
  { id: 'bernal-top', kind: 'top', at: 'bernal-heights-park', r: 70, why: 'Bernal Heights summit' },
  { id: 'davidson-top', kind: 'top', at: 'mount-davidson', r: 70, why: 'Mount Davidson summit' },
  { id: 'buena-vista-top', kind: 'top', at: 'buena-vista-park', r: 60, why: 'Buena Vista summit' },
  { id: 'mclaren-top', kind: 'top', at: 'mclaren-park', r: 80, why: 'McLaren Park\'s hilltop' },
  { id: 'strawberry-hill', kind: 'top', at: 'blue-heron-lake', r: 40, why: 'Strawberry Hill in the lake' },
  { id: 'sutro-heights-top', kind: 'top', at: 'sutro-heights-park', r: 40, why: 'Sutro Heights parapet' },
  { id: 'mount-sutro-top', kind: 'top', at: 'mount-sutro-open-space', r: 70, why: 'Mount Sutro' },
  { id: 'pier-39-end', kind: 'spot', at: [-199, -18], r: 8, why: 'the far end of PIER 39' },
  { id: 'municipal-pier-end', kind: 'end', at: [-288, 175], r: 40, why: 'the municipal pier\'s foot at Aquatic Park (CP-5: the tip is off the walking network)' },
  { id: 'lands-end-overlook', kind: 'nook', at: 'lands-end', r: 60, why: 'a Lands End overlook' },
  { id: 'fort-mason-meadow', kind: 'top', at: 'fort-mason-center', r: 50, why: 'above Fort Mason' },
  { id: 'crane-cove-end', kind: 'end', at: 'crane-cove-park', r: 70, why: 'Crane Cove\'s slipway' },
  { id: 'herons-head-tip', kind: 'end', at: 'herons-head-park', r: 100, why: 'Heron\'s Head tip' },
  { id: 'fort-point-wharf', kind: 'end', at: 'fort-point', r: 60, why: 'the wharf by Fort Point' },
  { id: 'candlestick-point', kind: 'end', at: 'candlestick-point-sra', r: 100, why: 'Candlestick Point' },
  { id: 'sutro-baths-ruins', kind: 'nook', at: 'sutro-baths', r: 50, why: 'the Sutro Baths ruins' },
  { id: 'seward-slides-top', kind: 'nook', at: 'seward-street-slides', r: 40, why: 'the top of the Seward slides' },
  { id: 'china-beach', kind: 'nook', at: 'china-beach', r: 50, why: 'China Beach' },
  { id: 'baker-beach-north', kind: 'nook', at: 'baker-beach', r: 90, why: 'the north end of Baker Beach' },
  { id: 'murphy-windmill', kind: 'nook', at: 'murphy-windmill', r: 40, why: 'behind the Murphy Windmill' },
  { id: 'lake-merced-nook', kind: 'nook', at: 'lake-merced', r: 90, why: 'a Lake Merced nook' },
  { id: 'stern-grove-nook', kind: 'nook', at: 'stern-grove', r: 70, why: 'a Stern Grove nook' },
  { id: 'glen-canyon-nook', kind: 'nook', at: 'glen-canyon-park', r: 70, why: 'deep in Glen Canyon' },
  { id: 'fort-funston-top', kind: 'top', at: 'fort-funston', r: 60, why: 'Fort Funston\'s bluff' },
  { id: 'palace-lagoon', kind: 'nook', at: 'palace-of-fine-arts', r: 60, why: 'by the Palace lagoon' },
  { id: 'mountain-lake-nook', kind: 'nook', at: 'mountain-lake-park', r: 60, why: 'Mountain Lake' },
  { id: 'presidio-nook', kind: 'nook', at: 'presidio', r: 80, why: 'a Presidio trail' },
  { id: 'india-basin', kind: 'spot', at: 'india-basin-waterfront-park', r: 30, why: 'India Basin' },
  { id: 'balmy-alley', kind: 'spot', at: 'balmy-alley', r: 30, why: 'Balmy Alley' },
  { id: 'clarion-alley', kind: 'spot', at: 'clarion-alley', r: 30, why: 'Clarion Alley' },
  // the signature corners' streets (lane L: "one coin cache (E)" per corner)
  { id: 'irving-street', kind: 'spot', at: 'irving-street', r: 40, why: 'Irving Street corner' },
  { id: 'clement-street', kind: 'spot', at: 'clement-street', r: 40, why: 'Clement Street corner' },
  { id: 'calle-24', kind: 'spot', at: 'calle-24', r: 40, why: '24th Street corner' },
  { id: 'third-street', kind: 'spot', at: 'bayview-opera-house', r: 40, why: '3rd Street, Bayview' },
  { id: 'noe-valley', kind: 'spot', at: 'noe-valley-town-square', r: 40, why: 'Noe Valley Town Square' },
  { id: 'japantown', kind: 'spot', at: 'japantown-peace-pagoda', r: 40, why: 'Japantown' },
  // over roofs and domes: reached with the pelican
  { id: 'palace-rotunda', kind: 'air', at: 'palace-of-fine-arts', why: 'over the Palace of Fine Arts rotunda' },
  { id: 'painted-ladies-roof', kind: 'air', at: [-2, 598], why: 'over the Painted Ladies\' roofs' },
  // appended in part c: lane L's corners 5–8 (its request: one cache per corner street, at the spots it measured)
  { id: 'haight', kind: 'spot', at: [-38.0, 754.9], r: 24, why: 'Haight Street\'s west sidewalk, across from the busker (lane L\'s corner)' },
  { id: 'castro', kind: 'spot', at: [149.7, 748.0], r: 8, why: 'Castro Street\'s west sidewalk between two bays (lane L\'s corner)' },
];

/** 15 rings over landmarks (+ slot 0 reserved for lane A's first flight: `ring:first-flight:1` … `:8`). */
export const RING_DEFS: readonly RingDef[] = [
  { id: 'coit', at: 'coit-tower', why: 'over Coit Tower' },
  { id: 'transamerica', at: 'transamerica-pyramid', why: 'over the Transamerica Pyramid' },
  { id: 'salesforce', at: 'salesforce-tower', why: 'over Salesforce Tower' },
  { id: 'ferry-clock', at: [133.0, -4.9], why: 'over the Ferry Building clock tower' },
  { id: 'sutro-tower', at: 'sutro-tower', why: 'over Sutro Tower' },
  { id: 'painted-ladies', at: [-2, 598], why: 'over the Painted Ladies row' },
  { id: 'city-hall', at: 'city-hall', why: 'over the City Hall dome' },
  { id: 'ggb-south-tower', at: [-796.12, 564.38], why: 'over the Golden Gate Bridge\'s south tower' },
  { id: 'ggb-mid-span', at: [-866, 509], yaw: 0.977, lift: 6, why: 'over the middle of the Golden Gate Bridge, across the deck' },
  { id: 'palace-of-fine-arts', at: 'palace-of-fine-arts', why: 'over the Palace of Fine Arts' },
  { id: 'alcatraz', at: 'alcatraz', why: 'over Alcatraz' },
  { id: 'de-young-tower', at: 'de-young-tower', why: 'over the de Young tower' },
  { id: 'lombard', at: 'lombard-crooked', why: 'over the crooked block' },
  { id: 'twin-peaks', at: 'twin-peaks', lift: 6, why: 'over Twin Peaks' },
  { id: 'st-ignatius', at: 'st-ignatius-church', why: 'over the St. Ignatius towers' },
];

// ---------------------------------------------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------------------------------------------

type Pt = { x: number; z: number };
const EDGE_STREET = GRAPH_EDGE.indexOf('street'), EDGE_STEPS = GRAPH_EDGE.indexOf('steps');
const r1 = (v: number) => Math.round(v * 10) / 10;

/** An anchor as a point: an attraction's arrival spot (its centre with `centre`), a transit stop, or the point itself. */
function resolveAnchor(a: Anchor, centre = false): Pt {
  if (typeof a !== 'string') return { x: a[0], z: a[1] };
  const at = ATTRACTIONS.find(x => x.id === a);
  if (at) return at.arrival && !centre ? { x: at.arrival.x, z: at.arrival.z } : { x: at.x, z: at.z };
  const transit = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/opus-bay/sf/v1/transit.json'), 'utf8')) as { lines: { stops: { id: string; x: number; z: number }[] }[] };
  for (const l of transit.lines) for (const s of l.stops) if (s.id === a) return { x: s.x, z: s.z };
  throw new Error(`unknown anchor ${a}`);
}

/** Dijkstra over the graph from `start`, staying within `r` of `centre`; `paths` = non-street edges only. */
function explore(ctx: CityCtx, start: number, centre: Pt, r: number, paths: boolean) {
  const { ix } = ctx, gr = ix.graph;
  const dist = new Map<number, number>([[start, 0]]), parent = new Map<number, number>();
  const open: [number, number][] = [[0, start]];
  while (open.length) {
    open.sort((a, b) => b[0] - a[0]);
    const [d, u] = open.pop()!;
    if (d > (dist.get(u) ?? Infinity)) continue;
    for (let e = gr.offsets[u]; e < gr.offsets[u + 1]; e++) {
      if (paths && gr.kind[e] === EDGE_STREET) continue;
      const v = gr.targets[e];
      if (Math.hypot(ix.x(v) - centre.x, ix.z(v) - centre.z) > r) continue;
      const nd = d + Math.hypot(ix.x(v) - ix.x(u), ix.z(v) - ix.z(u));
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); parent.set(v, u); open.push([nd, v]); }
    }
  }
  const pathTo = (v: number) => { const out = [v]; while (parent.has(out[out.length - 1])) out.push(parent.get(out[out.length - 1])!); return out.reverse(); };
  return { dist, pathTo };
}

function waterScore(x: number, z: number): number {
  let n = 0;
  for (const rr of [4, 7]) for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; if (terrain.isWater(x + Math.cos(a) * rr, z + Math.sin(a) * rr)) n++; }
  return n;
}

/** Sample a node path as a polyline every `step` u (from its start). */
function sample(ctx: CityCtx, nodes: number[], step = 0.5): Pt[] {
  const pts = nodes.map(i => ctx.ix.pos(i));
  const out: Pt[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z);
    for (let s = 0; s < L; s += step) out.push({ x: a.x + ((b.x - a.x) * s) / L, z: a.z + ((b.z - a.z) * s) / L });
  }
  if (pts.length) out.push(pts[pts.length - 1]);
  return out;
}

interface Placed { x: number; y: number; z: number }
interface TrailOut { id: string; kind: TrailKind; pts: Placed[]; dt: boolean; problems: string[] }
interface CacheOut { id: string; kind: CacheDef['kind']; x: number; y: number; z: number; air: boolean; dt: boolean; problems: string[] }
interface RingOut { id: string; x: number; y: number; z: number; yaw: number; r: number; dt: boolean; problems: string[] }

const isDowntown = (ctx: CityCtx, x: number, z: number) => (DOWNTOWN_ZONES as readonly string[]).includes(ctx.zoneOf(x, z) ?? '');

async function placeTrail(ctx: CityCtx, def: TrailDef, taken: Placed[]): Promise<TrailOut> {
  const at = resolveAnchor(def.at), r = def.r ?? 70, want = Math.min(RULES.trailMax, def.n ?? 6);
  await ctx.ensure(at.x, at.z, r + 24);
  const { ix } = ctx, gr = ix.graph;
  const fail = (why: string): TrailOut => ({ id: def.id, kind: def.kind, pts: [], dt: false, problems: [why] });
  const home = (i: number) => ix.component(i) === ctx.home;
  const hasPath = (i: number) => { for (let e = gr.offsets[i]; e < gr.offsets[i + 1]; e++) if (gr.kind[e] !== EDGE_STREET) return true; return false; };
  let line: Pt[] | null = null, fromEnd = def.rev ?? false;
  if (def.line) {
    // an explicit polyline (piers and jetties the walking graph does not cover), checked like any other spot
    line = [];
    for (let i = 0; i + 1 < def.line.length; i++) {
      const [x0, z0] = def.line[i], [x1, z1] = def.line[i + 1], L = Math.hypot(x1 - x0, z1 - z0);
      for (let s = 0; s < L; s += 0.5) line.push({ x: x0 + ((x1 - x0) * s) / L, z: z0 + ((z1 - z0) * s) / L });
    }
    const [xe, ze] = def.line[def.line.length - 1];
    line.push({ x: xe, z: ze });
  } else {
    let nodes: number[] | null = null;
    const startNode = def.kind === 'climb' || def.kind === 'path' ? ix.nearestNode(at.x, at.z, 40, i => home(i) && hasPath(i)) : -1;
    const start = startNode >= 0 ? startNode : ix.nearestNode(at.x, at.z, 40, home);
    if (start < 0) return fail('no graph node near the anchor');
    if (def.to) {
      const to = resolveAnchor(def.to);
      await ctx.ensure(to.x, to.z, 40);
      const end = ix.nearestNode(to.x, to.z, 40, home);
      const p = (def.kind === 'stop' ? null : findGraphPath(ix, start, end, { edgeAccept: e => gr.kind[e] !== EDGE_STREET })) ?? findGraphPath(ix, start, end);
      nodes = p?.nodes ?? null;
      if (def.rev === undefined) fromEnd = def.kind === 'climb' || def.kind === 'pier';
    } else if (def.kind === 'steps') {
      // the flight of steps nearest the anchor, from a little below its foot to a little above its head
      let seed = -1, best = Infinity;
      ix.forNodesNear(at.x, at.z, r, (i, d2) => { if (!home(i)) return; for (let e = gr.offsets[i]; e < gr.offsets[i + 1]; e++) if (gr.kind[e] === EDGE_STEPS && d2 < best) { best = d2; seed = i; } });
      if (seed < 0) return fail('no steps near the anchor');
      const run = new Set<number>([seed]), stack = [seed];
      while (stack.length) {
        const u = stack.pop()!;
        for (let e = gr.offsets[u]; e < gr.offsets[u + 1]; e++) {
          const v = gr.targets[e];
          if (gr.kind[e] === EDGE_STEPS && !run.has(v) && Math.hypot(ix.x(v) - at.x, ix.z(v) - at.z) <= r) { run.add(v); stack.push(v); }
        }
      }
      let lo = seed, hi = seed;
      for (const v of run) { if (ix.y(v) < ix.y(lo)) lo = v; if (ix.y(v) > ix.y(hi)) hi = v; }
      // carry on uphill from the head (the highest node within 25 u of path) and start 10 u of path below the foot
      const up = explore(ctx, hi, at, r, false);
      let top = hi;
      for (const [v, d] of up.dist) if (d <= 25 && ix.y(v) > ix.y(top)) top = v;
      const down = explore(ctx, lo, at, r, false);
      let foot = lo;
      for (const [v, d] of down.dist) if (d <= 10 && ix.y(v) < ix.y(foot)) foot = v;
      nodes = findGraphPath(ix, foot, top)?.nodes ?? null;
      fromEnd = false;
    } else if (def.kind === 'climb') {
      let paths = true;
      let ex = explore(ctx, start, at, r, true);
      if (ex.dist.size < 8) { paths = false; ex = explore(ctx, start, at, r, false); }
      let top = start;
      for (const v of ex.dist.keys()) if (ix.y(v) > ix.y(top)) top = v;
      const fromTop = explore(ctx, top, at, r, paths);
      let bottom = -1;
      for (const [v, d] of fromTop.dist) if (d >= 20 && d <= 70 && (bottom < 0 || ix.y(v) < ix.y(bottom))) bottom = v;
      if (bottom < 0) for (const [v] of fromTop.dist) if (bottom < 0 || ix.y(v) < ix.y(bottom)) bottom = v;
      nodes = fromTop.pathTo(bottom).reverse();
      fromEnd = true;
    } else if (def.kind === 'pier') {
      const ex = explore(ctx, start, at, r, false);
      let end = start, bestScore = -1;
      for (const [v, d] of ex.dist) {
        const s = waterScore(ix.x(v), ix.z(v)) * 1000 + d;
        if (s > bestScore) { bestScore = s; end = v; }
      }
      nodes = ex.pathTo(end);
      fromEnd = true;
    } else {
      let ex = explore(ctx, start, at, r, true);
      if (ex.dist.size < 8) ex = explore(ctx, start, at, r, false);
      let end = start, far = -1;
      for (const [v, d] of ex.dist) if (d > far) { far = d; end = v; }
      nodes = ex.pathTo(end);
    }
    if (!nodes || nodes.length < 2) return fail('no path');
    line = sample(ctx, nodes);
  }
  if (fromEnd) line = line.reverse();
  const spacing = def.gap ?? (def.kind === 'climb' || def.kind === 'steps' ? 3.5 : 4);
  const pts: Placed[] = [];
  let last: Pt | null = null, walked = 0;
  for (let i = 0; i < line.length && pts.length < want; i++) {
    const p = line[i];
    if (i > 0) walked += Math.hypot(p.x - line[i - 1].x, p.z - line[i - 1].z);
    if (walked < (def.skip ?? (def.line ? 0 : 3))) continue;
    if (last && Math.hypot(p.x - last.x, p.z - last.z) < spacing) continue;
    await ctx.ensure(p.x, p.z);
    const q = { x: r1(p.x), z: r1(p.z) };
    const why = (s: string) => { if (process.env.COINS_DEBUG === def.id) console.log(`  (${q.x}, ${q.z}) walked ${walked.toFixed(1)}: ${s}`); };
    const pr = spotProblems(ctx, q.x, q.z, RULES.trailPromptClear);
    if (pr.length) { why(pr.join(', ')); continue; }
    if ([...taken, ...pts].some(o => Math.hypot(o.x - q.x, o.z - q.z) < RULES.coinGap)) { why('near another coin'); continue; }
    const wp = await walkProblems(ctx, q.x, q.z);
    if (wp.length) { why(wp.join(', ')); continue; }
    why('coin');
    pts.push({ x: q.x, y: r1(terrain.heightAt(q.x, q.z)), z: q.z });
    last = p;
  }
  if (fromEnd) pts.reverse();
  const problems = pts.length < RULES.trailMin ? [`only ${pts.length} coins`] : [];
  // a rounded spot is checked again (0.05 u can matter at a wall)
  for (const p of pts) {
    await ctx.ensure(p.x, p.z);
    const pr = [...spotProblems(ctx, p.x, p.z, RULES.trailPromptClear), ...await walkProblems(ctx, p.x, p.z)];
    if (pr.length) problems.push(`(${p.x}, ${p.z}): ${pr.join(', ')}`);
  }
  return { id: def.id, kind: def.kind, pts, dt: pts.some(p => isDowntown(ctx, p.x, p.z)), problems };
}

async function placeCache(ctx: CityCtx, def: CacheDef, coins: Placed[], caches: CacheOut[]): Promise<CacheOut> {
  const at = resolveAnchor(def.at, def.kind === 'air'), r = def.r ?? 40;
  await ctx.ensure(at.x, at.z, r + 24);
  const { ix } = ctx;
  const base = { id: def.id, kind: def.kind, air: false };
  if (def.kind === 'air') {
    const floor = Math.max(ctx.glide.heightAt(at.x, at.z), ctx.glide.roofAt(at.x, at.z, GLIDE.floorR)) + GLIDE.floorClear;
    const p = { x: r1(at.x), y: r1(floor + RULES.ringFloorMargin + RULES.airCacheLift), z: r1(at.z) };
    return { ...base, ...p, air: true, dt: isDowntown(ctx, p.x, p.z), problems: airProblems(ctx, [p]) };
  }
  const ok = (x: number, z: number) => !spotProblems(ctx, x, z).length && !coins.some(q => Math.hypot(q.x - x, q.z - z) < RULES.cacheGap) && !caches.some(q => Math.hypot(q.x - x, q.z - z) < 30);
  const cands: { x: number; z: number; score: number }[] = [];
  const startNode = ix.nearestNode(at.x, at.z, 40, i => ix.component(i) === ctx.home);
  if (def.kind === 'spot') {
    for (let rr = 0; rr <= r; rr += 1) for (let k = 0; k < Math.max(1, Math.round(rr * 2)); k++) {
      const a = (k / Math.max(1, Math.round(rr * 2))) * Math.PI * 2, x = at.x + Math.cos(a) * rr, z = at.z + Math.sin(a) * rr;
      cands.push({ x, z, score: -rr });
    }
  } else if (startNode >= 0) {
    const ex = explore(ctx, startNode, at, r, def.kind === 'nook');
    const gr = ix.graph;
    for (const [v, d] of ex.dist) {
      const x = ix.x(v), z = ix.z(v);
      if (def.kind === 'top') cands.push({ x, z, score: ix.y(v) });
      else if (def.kind === 'end') cands.push({ x, z, score: waterScore(x, z) * 1000 + d });
      else {
        let deg = 0;
        for (let e = gr.offsets[v]; e < gr.offsets[v + 1]; e++) if (gr.kind[e] !== EDGE_STREET) deg++;
        cands.push({ x, z, score: (deg === 1 ? 1000 : 0) + d });
      }
    }
  }
  cands.sort((a, b) => b.score - a.score);
  for (const c of cands.slice(0, 400)) {
    await ctx.ensure(c.x, c.z);
    // the node itself, else the nearest good point within 3 u of it; a spot the walker cannot leave → the next candidate
    let p: Placed | null = null;
    for (let rr = 0; rr <= 3 && !p; rr += 0.5) {
      for (let k = 0; k < (rr ? 12 : 1); k++) {
        const a = (k / 12) * Math.PI * 2, x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr;
        if (!ok(x, z) || !ok(r1(x), r1(z))) continue;
        p = { x: r1(x), y: r1(terrain.heightAt(x, z)), z: r1(z) };
        break;
      }
    }
    if (!p || (await walkProblems(ctx, p.x, p.z)).length) continue;
    return { ...base, ...p, dt: isDowntown(ctx, p.x, p.z), problems: [] };
  }
  return { ...base, x: at.x, y: 0, z: at.z, dt: false, problems: ['no good spot'] };
}

async function placeRing(ctx: CityCtx, def: RingDef): Promise<RingOut> {
  const at = resolveAnchor(def.at, true);
  await ctx.ensure(at.x, at.z, 40);
  const yaw = def.yaw ?? 0, R = RULES.ringR;
  // the lowest centre whose eight coins all clear the soft floor (+ margin), then `lift` more
  let floor = -Infinity;
  for (const c of ringCoins({ x: at.x, y: 0, z: at.z, yaw, r: R })) {
    floor = Math.max(floor, Math.max(ctx.glide.heightAt(c.x, c.z), ctx.glide.roofAt(c.x, c.z, GLIDE.floorR)) + GLIDE.floorClear);
  }
  const y = r1(floor + RULES.ringFloorMargin + R + 0.1 + (def.lift ?? 2));
  const ring = { x: r1(at.x), y, z: r1(at.z), yaw, r: R };
  return { id: def.id, ...ring, dt: isDowntown(ctx, ring.x, ring.z), problems: airProblems(ctx, ringCoins(ring)) };
}

// ---------------------------------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------------------------------

const SPOTS_FILE = path.join(ROOT, 'src/opus-bay/economy/coinSpots.ts');

/** the order already published (append-only), or [] before the first write */
async function publishedOrder(): Promise<{ trails: string[]; caches: string[]; rings: string[] }> {
  if (!fs.existsSync(SPOTS_FILE)) return { trails: [], caches: [], rings: [] };
  const m = await import('../../src/opus-bay/economy/coinSpots');
  return { trails: m.COIN_TRAILS.map(t => t.id), caches: m.COIN_CACHES.map(c => c.id), rings: m.COIN_RINGS.map(r => r.id) };
}

function ordered<T extends { id: string }>(published: string[], items: T[], retired: (id: string) => T): T[] {
  const byId = new Map(items.map(i => [i.id, i]));
  const out = published.map(id => byId.get(id) ?? retired(id));
  for (const i of items) if (!published.includes(i.id)) out.push(i);
  return out;
}

function writeSpots(trails: TrailOut[], caches: CacheOut[], rings: RingOut[], stamp: string) {
  const num = (v: number) => String(v);
  const lines: string[] = [];
  lines.push(`/**
 * Wave 5 · lane E · W5-E2: where the coins lie. GENERATED by scripts/opus-sf/coins-place.mts (${stamp}) from the
 * published city — do not edit by hand; change the definitions there and run it with --write.
 *
 * APPEND-ONLY (the ledger's bits): trail i owns bits 8i … 8i + 7 of save v2 \`play.t\` (trail:<id>:<1-8>), ring i bits
 * 8i … 8i + 7 of \`play.g.ring\` (ring:<id>:<1-8>), cache i bit i of \`play.g.cache\` (cache:<id>). An entry never moves;
 * a retired one keeps its slot with no coins. Ring 0 is lane A's first flight (its coins are A's; the ids are here).
 *
 * p = x, y, z per coin (y = the ground there); dt = downtown (Financial District / South Beach, Chinatown): held until
 * lane V's measured headroom (plan MF9 / D15). Rings: 8 coins on a vertical circle of radius r across the flight
 * direction yaw (economy/coins.ts ringCoinPositions).
 */
export type TrailKind = 'steps' | 'climb' | 'pier' | 'path' | 'stop';
export interface CoinTrail { id: string; kind: TrailKind; p: readonly number[]; dt?: 1; retired?: 1 }
export interface CoinCache { id: string; x: number; y: number; z: number; air?: 1; dt?: 1; retired?: 1 }
export interface CoinRing { id: string; x: number; y: number; z: number; yaw: number; r: number; dt?: 1; reserved?: 1; retired?: 1 }

/** coins per trail / ring slot (the ledger bits per entry) */
export const SLOT_COINS = 8;
`);
  lines.push('export const COIN_TRAILS: readonly CoinTrail[] = [');
  for (const t of trails) lines.push(`  { id: '${t.id}', kind: '${t.kind}', p: [${t.pts.flatMap(p => [p.x, p.y, p.z]).map(num).join(', ')}]${t.dt ? ', dt: 1' : ''}${t.pts.length ? '' : ', retired: 1'} },`);
  lines.push('];', '', 'export const COIN_CACHES: readonly CoinCache[] = [');
  for (const c of caches) lines.push(`  { id: '${c.id}', x: ${c.x}, y: ${c.y}, z: ${c.z}${c.air ? ', air: 1' : ''}${c.dt ? ', dt: 1' : ''}${c.problems.length ? ', retired: 1' : ''} },`);
  lines.push('];', '', 'export const COIN_RINGS: readonly CoinRing[] = [');
  for (const r of rings) lines.push(`  { id: '${r.id}', x: ${r.x}, y: ${r.y}, z: ${r.z}, yaw: ${r.yaw}, r: ${r.r}${r.dt ? ', dt: 1' : ''}${r.id === 'first-flight' ? ', reserved: 1' : ''}${r.problems.length ? ', retired: 1' : ''} },`);
  lines.push('];', '');
  lines.push(`/** The ledger's id lists (economy/ledger registerRewardIds): \`<entry>:<n>\`, n = 1 … 8 for every slot. */
export const trailCoinIds = (): string[] => COIN_TRAILS.flatMap(t => Array.from({ length: SLOT_COINS }, (_, i) => \`\${t.id}:\${i + 1}\`));
export const ringCoinIds = (): string[] => COIN_RINGS.flatMap(r => Array.from({ length: SLOT_COINS }, (_, i) => \`\${r.id}:\${i + 1}\`));
export const cacheIds = (): string[] => COIN_CACHES.map(c => c.id);
`);
  fs.writeFileSync(SPOTS_FILE, lines.join('\n'));
}

/** --sources: append the fixed reward sources that economy/sources.ts does not list yet (never reorders). */
async function appendSources() {
  const { FIXED_SOURCES } = await import('../../src/opus-bay/economy/sources');
  const { CITY_POSTCARD_IDS } = await import('../../src/opus-bay/data/sf/postcards');
  const { POSTCARD_IDS } = await import('../../src/opus-bay/data/postcards');
  const { CITY_GOAL } = await import('../../src/opus-bay/data/sf/goals');
  const { RESIDENTS } = await import('../../src/opus-bay/data/sf/residents');
  const want = ['pelican:unlock', 'goal:pelican', ...Object.values(CITY_GOAL).map(v => `goal:${v}`), ...RESIDENTS.map(r => `favour:${r.key}`), ...[...CITY_POSTCARD_IDS, ...POSTCARD_IDS].map(p => `postcard:${p}`), ...ATTRACTIONS.map(a => `arrive:${a.id}`)];
  const missing = want.filter(s => !FIXED_SOURCES.includes(s));
  if (!missing.length) { console.log('economy/sources.ts lists every fixed source'); return; }
  const file = path.join(ROOT, 'src/opus-bay/economy/sources.ts');
  const text = fs.readFileSync(file, 'utf8');
  const next = text.replace(/'\n\)\.split\(' '\);/, `' +\n  '${missing.join(' ')}'\n).split(' ');`);
  if (next === text) throw new Error('could not find the end of FIXED_SOURCES');
  fs.writeFileSync(file, next);
  console.log(`appended ${missing.length}: ${missing.join(' ')}`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--sources')) { await appendSources(); return; }
  const t0 = Date.now();
  const ctx = await loadCity();
  try {
    // a published spot that still passes every rule stays where it is (players learn where the coins lie); only the
    // failing ones, and the ids named by --replace a,b,c, are placed again
    const pub = fs.existsSync(SPOTS_FILE) && !args.has('--fresh') ? await import('../../src/opus-bay/economy/coinSpots') : null;
    const replaceAt = process.argv.indexOf('--replace');
    const force = new Set(replaceAt > 0 ? process.argv[replaceAt + 1].split(',') : []);
    const keptTrail = async (def: TrailDef, taken: Placed[]): Promise<TrailOut | null> => {
      const e = pub?.COIN_TRAILS.find(t => t.id === def.id);
      if (!e || e.retired || force.has(def.id) || e.p.length / 3 < RULES.trailMin) return null;
      const pts: Placed[] = [];
      for (let i = 0; i < e.p.length; i += 3) {
        const p = { x: e.p[i], y: e.p[i + 1], z: e.p[i + 2] };
        await ctx.ensure(p.x, p.z);
        if (spotProblems(ctx, p.x, p.z, RULES.trailPromptClear).length || taken.some(o => Math.hypot(o.x - p.x, o.z - p.z) < RULES.coinGap)) return null;
        if ((await walkProblems(ctx, p.x, p.z)).length) return null;
        pts.push(p);
      }
      return { id: def.id, kind: def.kind, pts, dt: pts.some(p => isDowntown(ctx, p.x, p.z)), problems: [] };
    };
    const keptCache = async (def: CacheDef, coins: Placed[], caches: CacheOut[]): Promise<CacheOut | null> => {
      const e = pub?.COIN_CACHES.find(c => c.id === def.id);
      if (!e || e.retired || force.has(def.id) || !!e.air !== (def.kind === 'air')) return null;
      await ctx.ensure(e.x, e.z);
      if (e.air ? airProblems(ctx, [e]).length : spotProblems(ctx, e.x, e.z).length || coins.some(q => Math.hypot(q.x - e.x, q.z - e.z) < RULES.cacheGap) || caches.some(q => Math.hypot(q.x - e.x, q.z - e.z) < 30) || (await walkProblems(ctx, e.x, e.z)).length) return null;
      return { id: def.id, kind: def.kind, x: e.x, y: e.y, z: e.z, air: !!e.air, dt: isDowntown(ctx, e.x, e.z), problems: [] };
    };
    const keptRing = async (def: RingDef): Promise<RingOut | null> => {
      const e = pub?.COIN_RINGS.find(r => r.id === def.id);
      if (!e || e.retired || force.has(def.id)) return null;
      await ctx.ensure(e.x, e.z, 40);
      return airProblems(ctx, ringCoins(e)).length ? null : { id: def.id, x: e.x, y: e.y, z: e.z, yaw: e.yaw, r: e.r, dt: isDowntown(ctx, e.x, e.z), problems: [] };
    };
    const trails: TrailOut[] = [];
    const taken: Placed[] = [];
    for (const def of TRAIL_DEFS) {
      const kept = await keptTrail(def, taken);
      const t = kept ?? await placeTrail(ctx, def, taken);
      trails.push(t);
      taken.push(...t.pts);
      console.log(`${t.problems.length ? '✗' : '✓'} trail ${def.id.padEnd(22)} ${def.kind.padEnd(5)} ${String(t.pts.length)} coins${t.dt ? ' (downtown)' : ''}${t.pts[0] ? ` from (${t.pts[0].x}, ${t.pts[0].z}) to (${t.pts.at(-1)!.x}, ${t.pts.at(-1)!.z}) rise ${(t.pts.at(-1)!.y - t.pts[0].y).toFixed(1)}` : ''} ${kept ? 'kept' : pub ? 'PLACED' : ''} ${t.problems.join('; ')}`);
    }
    const caches: CacheOut[] = [];
    for (const def of CACHE_DEFS) {
      const kept = await keptCache(def, taken, caches);
      const c = kept ?? await placeCache(ctx, def, taken, caches);
      caches.push(c);
      console.log(`${c.problems.length ? '✗' : '✓'} cache ${def.id.padEnd(22)} ${def.kind.padEnd(4)} (${c.x}, ${c.y}, ${c.z})${c.dt ? ' (downtown)' : ''} ${kept ? 'kept' : pub ? 'PLACED' : ''} ${c.problems.join('; ')}`);
    }
    const rings: RingOut[] = [{ id: 'first-flight', x: -50, y: 60, z: 51, yaw: 0, r: RULES.ringR, dt: false, problems: [] }];
    for (const def of RING_DEFS) {
      const kept = await keptRing(def);
      const r = kept ?? await placeRing(ctx, def);
      rings.push(r);
      console.log(`${r.problems.length ? '✗' : '✓'} ring ${def.id.padEnd(22)} (${r.x}, ${r.y}, ${r.z})${r.dt ? ' (downtown)' : ''} ${kept ? 'kept' : pub ? 'PLACED' : ''} ${r.problems.join('; ')}`);
    }
    const good = trails.filter(t => !t.problems.length);
    const coins = good.reduce((n, t) => n + t.pts.length, 0);
    console.log(`\n${good.length} / ${trails.length} trails (${coins} coins, ${good.filter(t => t.dt).length} downtown) · ${caches.filter(c => !c.problems.length).length} / ${caches.length} caches · ${rings.filter(r => !r.problems.length).length - 1} / ${rings.length - 1} rings · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    const reportAt = process.argv.indexOf('--report');
    if (reportAt > 0) fs.writeFileSync(process.argv[reportAt + 1], JSON.stringify([...trails.flatMap(tr => tr.pts.map(p => ({ ...p, id: tr.id }))), ...caches.map(c => ({ x: c.x, z: c.z, id: c.id, c: 'cache' }))]));
    if (args.has('--write')) {
      const pub = await publishedOrder();
      const ts = ordered(pub.trails, good, id => ({ id, kind: 'path' as const, pts: [], dt: false, problems: [] }));
      const cs = ordered(pub.caches, caches.filter(c => !c.problems.length), id => ({ id, kind: 'spot' as const, x: 0, y: 0, z: 0, air: false, dt: false, problems: ['retired'] }));
      const rs = ordered(pub.rings, rings.filter(r => !r.problems.length), id => ({ id, x: 0, y: 0, z: 0, yaw: 0, r: 0, dt: false, problems: ['retired'] }));
      writeSpots(ts, cs, rs, `${new Date().toISOString().slice(0, 10)}, city ${JSON.parse(fs.readFileSync(path.join(ROOT, 'public/opus-bay/sf/current.json'), 'utf8')).version}`);
      console.log(`wrote ${path.relative(ROOT, SPOTS_FILE)}`);
    }
  } finally { ctx.done(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) await main();
