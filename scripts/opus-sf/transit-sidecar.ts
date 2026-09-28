// Wave 4 · lane T (W4-T3): rebuild the transit data with the three wave-4 lines, without touching the chunks.
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/transit-sidecar.ts [--out <dir>] [--write-w4] [--publish]
//
// Same inputs as the build (opus-qa/sf-data: raw OSM railways + highways, the DEM → terrain lattice, the hero DISTRICT):
//   - the N Judah and M Ocean View from their OSM route relations (lib/metro.ts, W4-T1),
//   - the sightseeing loop baked on the car-legal street graph (lib/busLoop.ts, W4-T2),
//   - the published wave-2 lines (powell-hyde, powell-mason, california, f-line) copied byte for byte.
// Every line passes `transitLineProblems` and the frozen sf-data constraints (checkW4Lines) or nothing is written.
// Deterministic: the same inputs give the same bytes (no timestamps in the data).
//
// Outputs (always): <out>/transit.json (the full file: wave-2 + wave-4 lines), <out>/transit-w4.json (the three new
// lines only), <out>/report.txt. Default <out> = C:/Users/willy/opus-qa/w4/w4-t/sidecar.
//   --write-w4  also writes public/opus-bay/sf/v1/transit-w4.json (a NEW file the wave-4 modules and tests read during
//               the early phase; nothing at runtime imports it yet)
//   --publish   also overwrites public/opus-bay/sf/v1/transit.json (the runtime's file since the integration, W4-T3 / T4:
//               the manifest names it without a hash, the chunks are untouched). The published file carries `props` too.
//               Re-runs are idempotent: the wave-2 lines are taken from the published file by id, its source is cut at
//               "; wave 4:" before the wave-4 note is appended again.
import fs from 'node:fs';
import path from 'node:path';
import { type TransitFile, type TransitLine, transitLineProblems } from '../../src/opus-bay/world/sf/format';
import { METRO_STATIONS } from '../../src/opus-bay/data/sf/stationNames';
import { loadDem } from './lib/io';
import { Clearance, placeKiosk, placeOnStreet, placePole } from './lib/stopPlace';
import { createCityTerrain, landmarkWalkInputs } from '../../src/opus-bay/core/sfTerrain';
import { canStand, setCityTerrain } from '../../src/opus-bay/core/terrain';
import { SF_SITES } from '../../src/opus-bay/world/sf/landmarks/index';
import { sfDisk } from '../../tests/opus-bay-sf-disk';
import { buildTerrain } from './lib/terrain';
import { W4_SOURCE_NOTE, buildW4Lines } from './lib/transit';

const REPO = path.resolve(import.meta.dirname, '../..');
const PUBLISHED = path.join(REPO, 'public/opus-bay/sf/v1/transit.json');
const W4_FILE = path.join(REPO, 'public/opus-bay/sf/v1/transit-w4.json');
const arg = (name: string, def: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def; };
const flag = (name: string) => process.argv.includes(`--${name}`);

/** The wave-2 line ids (published before wave 4) and the frozen sf-data expectations for the wave-4 ids. */
export const WAVE2_IDS = ['powell-hyde', 'powell-mason', 'california', 'f-line'] as const;
export const W4_EXPECT: Record<string, { length: number; kind: TransitLine['kind']; loop: boolean }> = {
  'sf-loop': { length: 6522, kind: 'bus', loop: true },
  'n-judah': { length: 1580, kind: 'light-rail', loop: false },
  'm-ocean-view': { length: 2028, kind: 'light-rail', loop: false },
};

/** The frozen sf-data test's rules for the wave-4 lines (tests/opus-bay-sf-data.test.ts), as a list of problems. */
export function checkW4Lines(lines: TransitLine[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    out.push(...transitLineProblems(l));
    const w = W4_EXPECT[l.id];
    if (!w) { out.push(`${l.id}: not a wave-4 line`); continue; }
    if (l.kind !== w.kind) out.push(`${l.id}: kind ${l.kind}`);
    if ((l.loop === true) !== w.loop) out.push(`${l.id}: loop ${l.loop}`);
    if (!(Math.abs(l.length - w.length) < w.length * 0.2)) out.push(`${l.id}: length ${l.length} outside ${w.length} ± 20 %`);
    if (!l.short) out.push(`${l.id}: no short name`);
    if (l.stops.length < 10) out.push(`${l.id}: ${l.stops.length} stops`);
    for (let i = 1; i < l.path.length; i += 3) if (!(l.path[i] >= -30 && l.path[i] < 60)) { out.push(`${l.id}: y ${l.path[i]}`); break; }
    if (l.kind === 'light-rail') {
      if (!l.doubleEnded) out.push(`${l.id}: not double-ended`);
      if (!(l.tunnels?.length && l.tunnels[0].fromAt <= 1)) out.push(`${l.id}: does not start underground`);
      if (!/openstreetmap\.org\/relation\//.test(l.sourceUrl)) out.push(`${l.id}: source ${l.sourceUrl}`);
    } else {
      if (l.tunnels?.length) out.push(`${l.id}: the loop has tunnels`);
      if (!/^https:\/\//.test(l.sourceUrl)) out.push(`${l.id}: source ${l.sourceUrl}`);
    }
  }
  return out;
}

/** Arc → point + heading on a transit.json path (clamped; loops wrap). */
function pathSampler(l: TransitLine): (s: number) => { x: number; z: number; heading: number } {
  const n = l.path.length / 3, cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(l.path[i * 3] - l.path[i * 3 - 3], l.path[i * 3 + 2] - l.path[i * 3 - 1]));
  const L = cum[n - 1];
  return (s0: number) => {
    const s = l.loop ? ((s0 % L) + L) % L : Math.max(0, Math.min(L, s0));
    let i = 1;
    while (i < n - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    const ax = l.path[i * 3 - 3], az = l.path[i * 3 - 1], bx = l.path[i * 3], bz = l.path[i * 3 + 2];
    return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, heading: Math.atan2(bx - ax, bz - az) };
  };
}

/**
 * Stand every stop prop where the built city has room (lib/stopPlace.ts on the published chunks + the hero): loop poles
 * just outside the road right of the bus (hero stops keep their promenade-kerb poles), surface Metro poles outside the
 * road clear of a passing train, kiosks on a free patch of sidewalk / plaza near the station. Returns stop id → [x, z].
 * (Early phase: written as the file's `props` beside the unchanged stop x, z, which lane C's TOUR_GEO pins; at the
 * integration T moves stop x, z onto the props in the same commit as C's TOUR_GEO follow-up.)
 */
/** A prop's spot is joined to the street when the walkable ground from it reaches this far (u). */
export const JOIN_REACH = 24;

/**
 * (integration review) Is (x, z) ground the player can stand on and walk away from? The game's own walk terrain (the
 * published chunks rasterised with the city's sites, as the streamer does: tests/opus-bay-sf-disk.ts) flooded from the
 * spot in 0.5 u steps with the player's radius must reach JOIN_REACH u. 21 of the 60 wave-4 props (the Castro and
 * Church kiosks, the La Playa pole, the Palace of Fine Arts / Haight / Painted Ladies poles …) stood in walled gaps
 * behind the kerb: 直接到站 and an underground arrival put the rider there with no way out.
 */
export async function walkJoined(points: { x: number; z: number }[]): Promise<(x: number, z: number) => boolean> {
  const sf = sfDisk(path.join(REPO, 'public/opus-bay/sf'));
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  for (const p of points) await sf.attachAround(city, p.x, p.z, 60, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  return (x0, z0) => {
    if (!canStand(x0, z0, 0.45)) return false;
    const step = 0.5, key = (i: number, j: number) => (i + 1000) * 4000 + (j + 1000);
    const seen = new Set<number>([key(0, 0)]), stack: [number, number][] = [[0, 0]];
    while (stack.length) {
      const [i, j] = stack.pop()!;
      if (Math.hypot(i * step, j * step) >= JOIN_REACH) return true;
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        const k = key(a, b);
        if (seen.has(k)) continue;
        seen.add(k);
        if (canStand(x0 + a * step, z0 + b * step, 0.45)) stack.push([a, b]);
      }
    }
    return false;
  };
}

/** A pole on the roadway stands this far from a vehicle path at least (u): the bus's half width 1.25 + its 0.6 kerb pull + the pole + room (and sf-metro's 2.5 u for a passing train). */
const POLE_CLEAR = 2.6;

/** The vehicles' centrelines as x, y, z triples (a line's tunnels left out: nothing runs on the surface there). */
function surfacePaths(lines: readonly TransitLine[]): number[][] {
  const out: number[][] = [];
  for (const l of lines) {
    let cur: number[] = [], at = 0;
    for (let i = 0; i + 2 < l.path.length; i += 3) {
      if (i) at += Math.hypot(l.path[i] - l.path[i - 3], l.path[i + 2] - l.path[i - 1]);
      if (l.tunnels?.some(t => at > t.fromAt && at < t.toAt)) { if (cur.length > 3) out.push(cur); cur = []; continue; }
      cur.push(l.path[i], l.path[i + 1], l.path[i + 2]);
    }
    if (cur.length > 3) out.push(cur);
  }
  return out;
}

async function placeStops(lines: TransitLine[], metroRaw: Map<string, { x: number; z: number }>, log: (s: string) => void, others: readonly TransitLine[] = []): Promise<Record<string, [number, number]>> {
  const props: Record<string, [number, number]> = {};
  const c = new Clearance(path.join(REPO, 'public/opus-bay/sf/v1/c'));
  await c.prepare(lines.flatMap(l => l.stops.map(s => ({ x: s.x, z: s.z }))));
  const walk = await walkJoined(lines.flatMap(l => l.stops.map(s => ({ x: s.x, z: s.z }))));
  // (review) judged where the prop is published (rounded to 0.01 u) and firm round it: a spot on a raster edge passed
  // unrounded and was not standable once rounded (San Jose & Niagara)
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const FIRM = [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]];
  const joined = (x: number, z: number) => { const a = r2(x), b = r2(z); return FIRM.every(([dx, dz]) => canStand(a + dx, b + dz, 0.45)) && walk(a, b); };
  const paths = surfacePaths([...lines, ...others]);
  const done = new Map<string, { x: number; z: number }>();
  for (const l of lines) {
    const at = pathSampler(l);
    for (const s of l.stops) {
      if (done.has(s.id)) continue;
      const round2 = (v: number) => Math.round(v * 100) / 100;
      let spot: { x: number; z: number } | null;
      // (integration review) every prop on ground joined to the street (`joined`); where the buildings stand at the kerb,
      // on the roadway's edge clear of the vehicles (placeOnStreet)
      if (l.kind === 'bus') {
        if (s.id === 'loop-ferry-building' || s.id === 'loop-pier-39') continue;
        spot = placePole(c, at, s.at, 1, 0.3, 1.6, joined) ?? placeOnStreet(c, s.x, s.z, 0.3, POLE_CLEAR, paths, joined);
      } else if (METRO_STATIONS.find(m => m.id === s.id)?.underground) {
        const o = metroRaw.get(s.id) ?? { x: s.x, z: s.z };
        spot = placeKiosk(c, o.x, o.z, 1.45, 30, joined) ?? placeKiosk(c, o.x, o.z, 1.3, 48, joined) ?? placeOnStreet(c, o.x, o.z, 1.3, POLE_CLEAR + 1, paths, joined, 20, 0.8);
      } else {
        spot = placePole(c, at, s.at, 1, 0.3, 2.7, joined) ?? placePole(c, at, s.at, -1, 0.3, 2.7, joined) ?? placeOnStreet(c, s.x, s.z, 0.3, POLE_CLEAR, paths, joined);
      }
      if (!spot) { log(`place: no room for ${s.id} (kept at ${s.x}, ${s.z})`); spot = { x: s.x, z: s.z }; }
      const moved = Math.hypot(spot.x - s.x, spot.z - s.z);
      if (moved > 8) log(`place: ${s.id} stands ${moved.toFixed(1)} u from its stop point, at (${spot.x.toFixed(1)}, ${spot.z.toFixed(1)})`);
      props[s.id] = [round2(spot.x), round2(spot.z)];
      done.set(s.id, spot);
    }
  }
  // the hero stops keep their promenade-kerb poles
  for (const l of lines) for (const s of l.stops) if (!props[s.id]) props[s.id] = [s.x, s.z];
  return props;
}

// ---------------------------------------------------------------------------------------------------------------
// W5-T (part c, checkpoint CP-3): the stops you can walk away from
// ---------------------------------------------------------------------------------------------------------------

/** A prop's spot must let the player walk off ≥ OPEN_MOVE u in at least OPEN_DIRS of four directions (plan MF2: 3 u). */
export const OPEN_MOVE = 3.5;
/** (live walker) a new spot passes for any camera with this much (u): the keys turn the player first, and the live pushes
 * came out 0.5–1 u shorter than the node ones in the directions the player had to turn round for */
export const OPEN_MOVE_ANY = 4.2;
export const OPEN_DIRS = 3;

/**
 * (W5-T part c) The sweep's judge (scripts/opus-sf/qa/sweep-static.mts, plan MF2) as a placement rule: on the city the
 * game streams (the published chunks, the landmark sites with their bases), a spot passes when a nav path from the walk
 * graph's main component ends within 1.1 u of it and the real controller, pushed 1.5 s in four directions (the most open
 * one first, then 90° steps: the sweep's order; and again from 45° on, since the live walker's directions follow the
 * camera) moves ≥ 3 u in at least OPEN_DIRS of them. The wave-4 flood (walkJoined) let 17 props through in a gap between
 * two houses behind the kerb (joined to the street by a 2 u alley): the live sweep could not walk out of them (N Judah
 * 10, M 7), and 13 more stood where only two ways led off (the sweep's CORRIDOR).
 */
export async function openJudge(points: { x: number; z: number }[]): Promise<{ judge: (x: number, z: number, turns?: number) => OpenJudged }> {
  const { CitySites } = await import('../../src/opus-bay/world/sf/sites');
  const { demSample } = await import('../../src/opus-bay/world/sf/format');
  const { heightAt } = await import('../../src/opus-bay/core/terrain');
  const { runtime } = await import('../../src/opus-bay/core/runtime');
  const { findPath } = await import('../../src/opus-bay/actors/nav');
  const { openHeading } = await import('../../src/opus-bay/actors/faceOpen');
  const { PlayerController } = await import('../../src/opus-bay/actors/controller');
  const sf = sfDisk(path.join(REPO, 'public/opus-bay/sf'));
  const far = await sf.far();
  const sites = new CitySites(), lms = sites.walkInputs();
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(far);
  sites.onBase = (id, y) => { city.setLandmarkBase(id, y); };
  sites.attach(null as never, (x, z) => demSample(far.dem, x, z));
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  for (const p of points) await sf.attachAround(city, p.x, p.z, 60, lms);
  const ix = await sf.graphIndex(), main = ix.mainComponent();
  const DT = 1 / 30, PUSH_S = 1.5, wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  const c = new PlayerController();
  const push = (x: number, z: number, heading: number) => {
    const p = runtime.player;
    p.x = x; p.z = z; p.y = heightAt(x, z); p.heading = heading; p.pathTarget = null; p.locked = false;
    c.sync();
    const dx = Math.sin(heading), dz = Math.cos(heading), yaw = Math.atan2(-dx, -dz);
    runtime.input.moveX = 0; runtime.input.moveY = 1; runtime.input.run = false; runtime.input.jump = false;
    for (let i = 0; i < PUSH_S / DT; i++) c.step({ dt: DT, now: i * DT, cameraYaw: yaw, frozen: false, riding: false });
    runtime.input.moveY = 0;
    return +Math.hypot(p.x - x, p.z - z).toFixed(2);
  };
  const judge = (x: number, z: number, turns = 0): OpenJudged => {
    let reach: number | null = null;
    const n = ix.nearestNode(x, z, 60, k => ix.component(k) === main);
    if (n >= 0) {
      const res = findPath({ x: ix.x(n), z: ix.z(n) }, { x, z }, 8);
      const e = res?.points[res.points.length - 1];
      reach = res ? (e ? +Math.hypot(e.x - x, e.z - z).toFixed(2) : 0) : null;
    }
    const first = openHeading(x, z, 0).heading;
    const set = (turn: number) => [0, 1, 2, 3].map(k => push(x, z, wrap(first + turn + (k * Math.PI) / 2)));
    const moves = set(0);
    // the other sets: 45° (turns 1), or 22.5°, 45°, 67.5° (turns 3: any camera, as the live walker's keys follow it)
    const turned = turns >= 3 ? [1, 2, 3].map(k => set((k * Math.PI) / 8)) : turns >= 1 ? [set(Math.PI / 4)] : [];
    return { reach, moves, turned };
  };
  return { judge };
}

export interface OpenJudged { reach: number | null; moves: number[]; turned: number[][] }

/** The sweep's verdict on a judged spot (plan MF2: reached, and ≥ 3 of 4 directions move ≥ `min` u); `turned` also asks it of every turned set. */
export function openPass(j: OpenJudged, min: number, turned = 0): boolean {
  const ok = (m: number[], at: number) => m.filter(v => v >= at).length >= OPEN_DIRS;
  return j.reach !== null && j.reach <= 1.1 && ok(j.moves, min) && (!turned || j.turned.every(m => ok(m, turned)));
}

/**
 * `--fix-props` (W5-T part c): keep the published lines byte for byte and every prop that passes openJudge; stand the
 * others again with the wave-4 rules (placePole / placeKiosk / placeOnStreet, firm ground, clear of the vehicles and the
 * furniture) plus openJudge. Writes transit.json and transit-w4.json to <out>, and in place with --publish.
 */
async function fixProps(OUT: string, log: (s: string) => void) {
  const published = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8')) as TransitFile & { props: Record<string, [number, number]> };
  const w4 = published.lines.filter(l => l.id in W4_EXPECT);
  const wave2 = published.lines.filter(l => (WAVE2_IDS as readonly string[]).includes(l.id));
  const props = { ...published.props };
  const pts = w4.flatMap(l => l.stops.flatMap(s => [{ x: s.x, z: s.z }, ...(props[s.id] ? [{ x: props[s.id][0], z: props[s.id][1] }] : [])]));
  const { judge } = await openJudge(pts);
  const c = new Clearance(path.join(REPO, 'public/opus-bay/sf/v1/c'));
  await c.prepare(pts);
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const FIRM = [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]];
  const firm = (a: number, b: number) => canStand(a, b, 0.45) && FIRM.every(([dx, dz]) => canStand(a + dx, b + dz, 0.45));
  // a new spot: the sweep's rule with a margin (OPEN_MOVE) for any camera (four turned sets); else for two (0°, 45°)
  const strong = (x: number, z: number) => { const a = r2(x), b = r2(z); return firm(a, b) && openPass(judge(a, b, 3), OPEN_MOVE_ANY, OPEN_MOVE_ANY); };
  const plain = (x: number, z: number) => { const a = r2(x), b = r2(z); return firm(a, b) && openPass(judge(a, b, 1), OPEN_MOVE, 3); };
  const only = arg('only', '').split(',').filter(Boolean);
  const paths = surfacePaths([...w4, ...wave2]);
  const toPath = (l: TransitLine, x: number, z: number) => {
    let d = Infinity;
    for (let i = 3; i + 2 < l.path.length; i += 3) {
      const ax = l.path[i - 3], az = l.path[i - 1], dx = l.path[i] - ax, dz = l.path[i + 2] - az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return d;
  };
  const done = new Set<string>();
  let moved = 0;
  for (const l of w4) {
    const at = pathSampler(l);
    for (const s of l.stops) {
      if (done.has(s.id) || (only.length && !only.includes(s.id))) continue;
      done.add(s.id);
      const p = props[s.id];
      if (!p || (l.kind === 'bus' && (s.id === 'loop-ferry-building' || s.id === 'loop-pier-39'))) continue;
      // a prop the sweep passes stays where it is (the fewest moved poles)
      const before = judge(p[0], p[1]);
      if (openPass(before, 3)) continue;
      // one the sweep calls a CORRIDOR (two ways lead off: a sidewalk between a wall and a kerb it cannot step down)
      // moves only a few steps; a kiosk 200 m from its station would be worse than a corridor
      const corridor = before.reach !== null && before.reach <= 1.1 && before.moves.filter(m => m >= 3).length === 2;
      const kiosk = !!METRO_STATIONS.find(m => m.id === s.id)?.underground;
      // the tests' rules (sf-metro, sf-bus, sf-lines-int): a surface pole 2.5–7.5 u from its track, a kiosk < 36 u
      // from it and < 50 u from the stop point
      const fits = (x: number, z: number) => {
        const d = toPath(l, x, z);
        if (kiosk ? d > 34 || Math.hypot(x - s.x, z - s.z) > 45 : d < 2.6 || d > 7.2) return false;
        if (l.kind === 'bus') {
          // the loop's poles stand at the kerb right of the bus (sf-bus: 1.5–7.5 u right of the lane, measured there)
          const q0 = at(s.at), q = at(s.at + ((x - q0.x) * Math.sin(q0.heading) + (z - q0.z) * Math.cos(q0.heading)));
          const side = (x - q.x) * -Math.cos(q.heading) + (z - q.z) * Math.sin(q.heading);
          if (!(side > 1.6 && side < 7.2)) return false;
        }
        return !corridor || Math.hypot(x - p[0], z - p[1]) <= 8;
      };
      const place = (rule: (x: number, z: number) => boolean) => {
        const ok = (x: number, z: number) => fits(x, z) && rule(x, z);
        if (l.kind === 'bus') return placePole(c, at, s.at, 1, 0.3, 1.6, ok) ?? placeOnStreet(c, s.x, s.z, 0.3, POLE_CLEAR, paths, ok);
        if (kiosk) return placeKiosk(c, s.x, s.z, 1.45, 30, ok) ?? placeKiosk(c, s.x, s.z, 1.3, 48, ok) ?? placeOnStreet(c, s.x, s.z, 1.3, POLE_CLEAR + 1, paths, ok, 20, 0.8);
        // (9th & Irving: the N turns in a 5 u street between the houses) last, a spot on the street up to 24 u away
        return placePole(c, at, s.at, 1, 0.3, 2.7, ok) ?? placePole(c, at, s.at, -1, 0.3, 2.7, ok) ?? placeOnStreet(c, s.x, s.z, 0.3, POLE_CLEAR, paths, ok) ?? placeOnStreet(c, s.x, s.z, 0.3, POLE_CLEAR, paths, ok, 24);
      };
      // (Carl & Stanyan: Carl St is a 5 u street with the houses at the kerb) last, a spot against a house front: the
      // player may stand on it, but not a quarter unit nearer the wall
      const soft = (x: number, z: number) => { const a = r2(x), b = r2(z); return canStand(a, b, 0.45) && openPass(judge(a, b), OPEN_MOVE); };
      const spot = place(strong) ?? place(plain) ?? (kiosk || l.kind === 'bus' ? null : placeOnStreet(c, s.x, s.z, 0.3, POLE_CLEAR, paths, (x, z) => fits(x, z) && soft(x, z)));
      if (!spot) { log(`fix: ${s.id} (${l.id}) still no open spot: kept at ${p} ${JSON.stringify(before)}`); continue; }
      const q: [number, number] = [r2(spot.x), r2(spot.z)];
      const after = judge(q[0], q[1], 3);
      log(`fix: ${s.id} (${l.id}) ${p} → ${q} (${Math.hypot(q[0] - p[0], q[1] - p[1]).toFixed(1)} u) before ${JSON.stringify(before)} after ${JSON.stringify(after)}`);
      props[s.id] = q;
      moved++;
    }
  }
  const full = { ...published, props };
  const onlyW4 = { version: published.version, source: published.source, lines: w4, props };
  const fullJson = JSON.stringify(full), w4Json = JSON.stringify(onlyW4);
  if (JSON.stringify(JSON.parse(fullJson).lines) !== JSON.stringify(published.lines)) throw new Error('lines changed');
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'transit.json'), fullJson);
  fs.writeFileSync(path.join(OUT, 'transit-w4.json'), w4Json);
  log(`fix: ${moved} props moved → ${OUT}`);
  if (flag('publish')) { fs.writeFileSync(PUBLISHED, fullJson); fs.writeFileSync(W4_FILE, w4Json); log(`published ${PUBLISHED} and ${W4_FILE}`); }
}

async function main() {
  const t0 = Date.now();
  if (flag('fix-props')) {
    const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
    await fixProps(path.resolve(arg('out', 'C:/Users/willy/opus-qa/w5/w5-t/sidecar')), log);
    return;
  }
  const OUT = path.resolve(arg('out', 'C:/Users/willy/opus-qa/w4/w4-t/sidecar'));
  const lines: string[] = [];
  const log = (s: string) => { const l = `[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`; console.log(l); lines.push(l); };
  const published = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8')) as TransitFile;
  const wave2 = published.lines.filter(l => (WAVE2_IDS as readonly string[]).includes(l.id));
  if (wave2.length !== WAVE2_IDS.length) throw new Error(`published transit.json lacks a wave-2 line (${wave2.map(l => l.id)})`);
  const terrain = buildTerrain(loadDem(), log);
  // the same lines a full build appends (lib/transit.ts buildW4Lines: the loop with its speed spans, N, M)
  const w4 = buildW4Lines(terrain, log);
  // the OSM station positions (under Market St) before the kiosks move
  const metroRaw = new Map<string, { x: number; z: number }>();
  for (const l of w4) if (l.kind === 'light-rail') for (const st of l.stops) if (!metroRaw.has(st.id)) metroRaw.set(st.id, { x: st.x, z: st.z });
  const props = await placeStops(w4, metroRaw, log, wave2);
  const problems = checkW4Lines(w4);
  if (problems.length) { for (const p of problems) console.error(`PROBLEM ${p}`); throw new Error(`${problems.length} problems: nothing written`); }
  const source = `${published.source.split('; wave 4:')[0]}; ${W4_SOURCE_NOTE}`;
  // `props`: where each wave-4 stop's pole / kiosk stands (an additive field; data/transit.ts reads it)
  const full = { version: published.version, source, lines: [...wave2, ...w4], props } as TransitFile & { props: Record<string, [number, number]> };
  const onlyW4 = { version: published.version, source, lines: w4, props } as TransitFile & { props: Record<string, [number, number]> };
  fs.mkdirSync(OUT, { recursive: true });
  const fullJson = JSON.stringify(full), w4Json = JSON.stringify(onlyW4);
  // the wave-2 lines must come out byte-identical (copied, never rebuilt)
  for (const l of wave2) if (JSON.stringify(l) !== JSON.stringify(published.lines.find(p => p.id === l.id))) throw new Error(`${l.id} changed`);
  fs.writeFileSync(path.join(OUT, 'transit.json'), fullJson);
  fs.writeFileSync(path.join(OUT, 'transit-w4.json'), w4Json);
  for (const l of w4) log(`${l.id}: ${l.kind}, ${l.length} u, ${l.stops.length} stops, ${l.path.length / 3} vertices, tunnels ${JSON.stringify((l.tunnels ?? []).map(u => [u.fromAt, u.toAt]))}`);
  log(`transit.json ${(fullJson.length / 1024).toFixed(1)} KB (published ${(fs.statSync(PUBLISHED).size / 1024).toFixed(1)} KB); transit-w4.json ${(w4Json.length / 1024).toFixed(1)} KB → ${OUT}`);
  if (flag('write-w4')) { fs.writeFileSync(W4_FILE, w4Json); log(`wrote ${W4_FILE}`); }
  if (flag('publish')) { fs.writeFileSync(PUBLISHED, fullJson); log(`published ${PUBLISHED}`); }
  fs.writeFileSync(path.join(OUT, 'report.txt'), `${lines.join('\n')}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) await main();
