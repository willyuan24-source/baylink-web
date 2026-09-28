// W5-F4 (lane F, plan sf-w5-plan.md §2 MF2 "the sweep") · the static walk sweep: every place the game sends the player
// to, judged on the published city in node (deterministic, minutes, no browser):
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/qa/sweep-static.mts [--only attraction,station] [--out dir]
//
// Targets (each with the lane that owns it): the attractions' trip ends and arrival anchors (N; the site behind it: L),
// every loop / Metro pole or kiosk, cable-car station kerb, F-line stop and ferry quay (T), the three walking routes'
// stops and via points (L), the GGB deck every 20 u (F: deck steering; L: the deck), R's event venues, E's coin trails
// and caches (ground ones), D's egg spots (ground ones), A's view spots, C's city postcards.
//
// For each target, on the city as the game streams it (the chunks within 48 u, the landmark sites' walk inputs):
//   stand   core/terrain canStand (0.4 u) at the point; else the nearest walkable spot within 3 u is used (`snap`)
//   reach   a nav path (actors/nav findPath) from the nearest node of the walk graph's main component ends within 1.1 u
//   walk    the real controller (actors/controller PlayerController, no obstacles) pushed 1.5 s in four directions — the
//           most open one first (actors/faceOpen openHeading: the way a landing faces), then 90° steps; per direction the
//           distance moved and whether the ground 3 u ahead is standable (a direction with open ground that does not
//           move ≥ 3 u is a SNAG: an invisible wall, a slope refusal, a blocker that is not drawn)
// Verdicts (worst first): OFF (not standable, nothing within 3 u) · BOXED (≤ 1 direction moves ≥ 3 u) · SNAG (a direction
// with open ground ahead does not move) · UNREACHABLE (no nav path reaches it) · CORRIDOR (2 directions move, the other
// two are closed by what is drawn: a deck, a pier, a path between walls — reported, not a failure) · ok. The plan's
// STUCK (MF2: fewer than 3 of 4 directions move ≥ 3 u) is BOXED + SNAG + CORRIDOR; the summary counts it too.
// Output: <out>/static.json (every target with its numbers), <out>/targets.json (the list the live walker replays),
// and a triage table by owner on stdout.
import fs from 'node:fs';
import path from 'node:path';
import { createCityTerrain } from '../../../src/opus-bay/core/sfTerrain';
import { canStand, heightAt, nearestWalkable, setCityTerrain } from '../../../src/opus-bay/core/terrain';
import { runtime } from '../../../src/opus-bay/core/runtime';
import { CitySites } from '../../../src/opus-bay/world/sf/sites';
import { demSample } from '../../../src/opus-bay/world/sf/format';
import { SF_LANDMARKS, landmarkToWorld } from '../../../src/opus-bay/world/sf/landmarks/index';
import { GGB } from '../../../src/opus-bay/world/sf/landmarks/golden-gate-bridge';
import { ATTRACTIONS, tripDestination } from '../../../src/opus-bay/data/sf/attractions';
import { SF_ROUTES } from '../../../src/opus-bay/data/sf/routes';
import { CITY_POSTCARDS } from '../../../src/opus-bay/data/sf/postcards';
import { FERRY_ROUTES } from '../../../src/opus-bay/data/ferry';
import { buildTransit, buildTransitW4, setFlineJson, setTransitData, setTransitW4, type TransitFileJson } from '../../../src/opus-bay/data/transit';
import { findPath } from '../../../src/opus-bay/actors/nav';
import { openHeading, openSpot } from '../../../src/opus-bay/actors/faceOpen';
import { PlayerController } from '../../../src/opus-bay/actors/controller';
import { sfDisk } from '../../../tests/opus-bay-sf-disk';

// flow / lineRides code touches window at import (the kerb spots): the same stand-in the node tests use
const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;

const args = process.argv.slice(2);
const argOf = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const ONLY = argOf('--only')?.split(',');
const OUT = path.resolve(argOf('--out') ?? 'C:/Users/willy/opus-qa/w5/sweep');
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------------------------------------------
// The city as the game streams it
// ---------------------------------------------------------------------------------------------------------------

const sf = sfDisk(), far = await sf.far();
const sites = new CitySites(), lms = sites.walkInputs();
const city = createCityTerrain(sf.manifest, { landmarks: lms });
city.setFar(far);
sites.onBase = (id, y) => { city.setLandmarkBase(id, y); };
sites.attach(null as never, (x, z) => demSample(far.dem, x, z));
setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
const ix = await sf.graphIndex();
const main = ix.mainComponent();

const TRANSIT = JSON.parse(fs.readFileSync(path.join(sf.root, 'v1', 'transit.json'), 'utf8')) as TransitFileJson;
setFlineJson(TRANSIT.lines.find(l => l.id === 'f-line') ?? null);
setTransitW4(buildTransitW4(TRANSIT));
const transitData = buildTransit(TRANSIT);
setTransitData(transitData);
const { stationBoardSpot, flineLandingSpot } = await import('../../../src/opus-bay/game/lineRides');

// ---------------------------------------------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------------------------------------------

type Owner = 'N' | 'L' | 'T' | 'R' | 'E' | 'D' | 'A' | 'C' | 'F';
type Kind = 'trip-end' | 'arrival' | 'station' | 'route' | 'deck' | 'venue' | 'coin' | 'cache' | 'egg' | 'view' | 'postcard';
export interface SweepTarget { id: string; kind: Kind; owner: Owner; x: number; z: number; tier?: number; name?: string; sx?: number; sz?: number }

const targets: SweepTarget[] = [];
const add = (t: SweepTarget) => { if (Number.isFinite(t.x) && Number.isFinite(t.z)) targets.push({ ...t, x: +t.x.toFixed(2), z: +t.z.toFixed(2) }); };

for (const a of ATTRACTIONS) {
  const d = tripDestination(a);
  add({ id: `trip:${a.id}`, kind: 'trip-end', owner: 'N', x: d.x, z: d.z, tier: a.rank, name: a.name.en });
  if (a.arrival && Math.hypot(a.arrival.x - d.x, a.arrival.z - d.z) > 2) add({ id: `arrival:${a.id}`, kind: 'arrival', owner: 'N', x: a.arrival.x, z: a.arrival.z, tier: a.rank, name: a.name.en });
}
// stations: the loop / Metro poles and kiosks (where you board and get off), cable-car kerbs, F-line stops, ferry quays
for (const l of TRANSIT.lines) {
  for (const s of l.stops) {
    if (l.kind === 'bus' || l.kind === 'light-rail') {
      const prop = TRANSIT.props?.[s.id];
      add({ id: `stop:${l.id}:${s.id}`, kind: 'station', owner: 'T', x: prop ? prop[0] : s.x, z: prop ? prop[1] : s.z, name: s.name.en });
    } else if (l.kind === 'streetcar') {
      const spot = flineLandingSpot({ id: s.id, x: s.x, z: s.z });
      add({ id: `fline:${s.id}`, kind: 'station', owner: 'T', x: spot.x, z: spot.z, name: s.name.en });
    }
  }
}
for (const st of transitData.stations) { const spot = stationBoardSpot(st); add({ id: `cable:${st.id}`, kind: 'station', owner: 'T', x: spot.x, z: spot.z, name: st.name.en }); }
for (const r of FERRY_ROUTES) for (const t of r.terminals) if (!targets.some(q => q.id === `ferry:${t.id}`)) add({ id: `ferry:${t.id}`, kind: 'station', owner: 'T', x: t.quay.x, z: t.quay.z, name: t.name.en });
// the three walking routes: stops and via points
for (const r of SF_ROUTES) for (const s of r.stops) {
  add({ id: `route:${s.id}`, kind: 'route', owner: 'L', x: s.x, z: s.z, name: s.name.en });
  s.via?.forEach(([x, z], i) => add({ id: `route:${s.id}:via${i + 1}`, kind: 'route', owner: 'L', x, z }));
}
// the Golden Gate Bridge deck, south end to north end, every 20 u on its centre line
const ggb = SF_LANDMARKS.find(l => l.id === 'golden-gate-bridge');
if (ggb) for (let lx = GGB.END_S + 10; lx <= GGB.END_N - 10; lx += 20) { const w = landmarkToWorld(ggb, { x: lx, z: 0 }); add({ id: `deck:ggb:${lx}`, kind: 'deck', owner: 'F', x: w.x, z: w.z }); }
// the new lanes' spots (their modules are data: imported here, never by the game's main graph)
try {
  const { EVENT_VENUES } = await import('../../../src/opus-bay/realsf/eventVenues');
  for (const v of EVENT_VENUES) add({ id: `venue:${v.id}`, kind: 'venue', owner: 'R', x: v.x, z: v.z, name: v.name.en });
} catch (e) { console.warn('[sweep] no event venues yet', String(e).slice(0, 120)); }
try {
  const { COIN_TRAILS, COIN_CACHES } = await import('../../../src/opus-bay/economy/coinSpots');
  // (p = x, y, z per coin)
  for (const t of COIN_TRAILS) { if (t.retired) continue; for (let i = 0; i + 2 < t.p.length; i += 3) add({ id: `coin:${t.id}:${i / 3 + 1}`, kind: 'coin', owner: 'E', x: t.p[i], z: t.p[i + 2] }); }
  for (const c of COIN_CACHES) if (!c.air && !c.retired) add({ id: `cache:${c.id}`, kind: 'cache', owner: 'E', x: c.x, z: c.z });
} catch (e) { console.warn('[sweep] no coin spots yet', String(e).slice(0, 120)); }
try {
  const reg = await import('../../../src/opus-bay/eggs/registry');
  const { eggSpots } = reg;
  // (every batch: ALL_EGGS once lane D has more than one list)
  const eggs = (reg as { ALL_EGGS?: typeof reg.EGGS }).ALL_EGGS ?? reg.EGGS;
  for (const e of eggs) if (e.kind === 'ground') eggSpots(e).forEach((p, i) => add({ id: `egg:${e.id}${i ? `:${i + 1}` : ''}`, kind: 'egg', owner: 'D', x: p.x, z: p.z, name: e.name.en }));
} catch (e) { console.warn('[sweep] no eggs yet', String(e).slice(0, 120)); }
try {
  const { VIEW_SPOTS } = await import('../../../src/opus-bay/play/viewSpots');
  for (const v of VIEW_SPOTS) if (!v.retired) add({ id: `view:${v.id}`, kind: 'view', owner: 'A', x: v.x, z: v.z, name: v.name.en });
} catch (e) { console.warn('[sweep] no view spots yet', String(e).slice(0, 120)); }
for (const c of CITY_POSTCARDS) add({ id: `postcard:${c.id}`, kind: 'postcard', owner: 'C', x: c.position.x, z: c.position.z, name: c.title.en });

// coin trails are dense (8 per trail): judge every trail's ends and middle only
const judged = targets.filter(t => !ONLY || ONLY.includes(t.kind)).filter(t => {
  if (t.kind !== 'coin') return true;
  const m = /:(\d+)$/.exec(t.id);
  const n = m ? Number(m[1]) : 0, trail = t.id.replace(/:\d+$/, '');
  const count = targets.filter(q => q.id.startsWith(`${trail}:`)).length;
  return n === 1 || n === count || n === Math.ceil(count / 2);
});

// ---------------------------------------------------------------------------------------------------------------
// Judging
// ---------------------------------------------------------------------------------------------------------------

const DT = 1 / 30, PUSH_S = 1.5, MOVE_MIN = 3, AHEAD = [1, 2, 3];
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const c = new PlayerController();

function push(from: { x: number; z: number }, heading: number): { moved: number; open: boolean } {
  const p = runtime.player;
  p.x = from.x; p.z = from.z; p.y = heightAt(from.x, from.z); p.heading = heading; p.pathTarget = null; p.locked = false;
  c.sync();
  const dx = Math.sin(heading), dz = Math.cos(heading), yaw = Math.atan2(-dx, -dz);
  runtime.input.moveX = 0; runtime.input.moveY = 1; runtime.input.run = false; runtime.input.jump = false;
  for (let i = 0; i < PUSH_S / DT; i++) c.step({ dt: DT, now: i * DT, cameraYaw: yaw, frozen: false, riding: false });
  runtime.input.moveY = 0;
  const open = AHEAD.every(d => canStand(from.x + dx * d, from.z + dz * d, 0.4));
  return { moved: +Math.hypot(p.x - from.x, p.z - from.z).toFixed(2), open };
}

interface Result extends SweepTarget {
  verdict: 'ok' | 'CORRIDOR' | 'BOXED' | 'SNAG' | 'UNREACHABLE' | 'OFF';
  /** plan MF2's definition: fewer than 3 of 4 directions move ≥ 3 u */
  planStuck: boolean;
  stand: boolean; snap: number | null; reach: number | null;
  dirs: { heading: number; moved: number; open: boolean }[];
  moving: number; snags: number;
  /** a loop / Metro stop: the set-down spot's distance from the pole (openSpot) */
  setDown?: number;
}

const results: Result[] = [];
const t0 = Date.now();
for (const [i, t] of judged.entries()) {
  await sf.attachAround(city, t.x, t.z, 48, lms);
  const stand = canStand(t.x, t.z, 0.4);
  let at = stand ? { x: t.x, z: t.z } : nearestWalkable({ x: t.x, z: t.z }, 3);
  const snap = at ? +Math.hypot(at.x - t.x, at.z - t.z).toFixed(2) : null;
  // (W5-F11) a loop / Metro stop: the game sets a rider down where the ground is open round the pole or kiosk
  // (actors/moveSystem, the ride's end: actors/faceOpen openSpot) — judge that spot; setDown = how far from the pole
  let setDown: number | undefined;
  if (at && t.id.startsWith('stop:')) {
    const o = openSpot(at.x, at.z);
    if (o) { setDown = +Math.hypot(o.x - t.x, o.z - t.z).toFixed(2); at = o; t.sx = +o.x.toFixed(2); t.sz = +o.z.toFixed(2); }
  }
  let reach: number | null = null;
  const dirs: Result['dirs'] = [];
  if (at) {
    const n = ix.nearestNode(at.x, at.z, 60, k => ix.component(k) === main);
    if (n >= 0) {
      const res = findPath({ x: ix.x(n), z: ix.z(n) }, at, 8);
      const e = res?.points[res.points.length - 1];
      reach = res ? (e ? +Math.hypot(e.x - at.x, e.z - at.z).toFixed(2) : 0) : null;
    }
    const first = openHeading(at.x, at.z, 0).heading;
    for (let k = 0; k < 4; k++) { const h = wrap(first + (k * Math.PI) / 2); dirs.push({ heading: +h.toFixed(3), ...push(at, h) }); }
  }
  const moving = dirs.filter(d => d.moved >= MOVE_MIN).length;
  const snags = dirs.filter(d => d.open && d.moved < MOVE_MIN).length;
  const verdict: Result['verdict'] = !at ? 'OFF' : moving <= 1 ? 'BOXED' : snags ? 'SNAG' : reach === null || reach > 1.1 ? 'UNREACHABLE' : moving < 3 ? 'CORRIDOR' : 'ok';
  results.push({ ...t, verdict, planStuck: !at || moving < 3, stand, snap, reach, dirs, moving, snags, ...(setDown !== undefined ? { setDown } : {}) });
  if ((i + 1) % 50 === 0) console.error(`[sweep] ${i + 1} / ${judged.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

// ---------------------------------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------------------------------

const count = (v: Result['verdict']) => results.filter(r => r.verdict === v).length;
const summary = { at: new Date().toISOString(), city: sf.version, targets: results.length, ok: count('ok'), CORRIDOR: count('CORRIDOR'), BOXED: count('BOXED'), SNAG: count('SNAG'), UNREACHABLE: count('UNREACHABLE'), OFF: count('OFF'), planStuck: results.filter(r => r.planStuck).length, seconds: Math.round((Date.now() - t0) / 1000) };
fs.writeFileSync(path.join(OUT, 'static.json'), JSON.stringify({ summary, results }, null, 1));
fs.writeFileSync(path.join(OUT, 'targets.json'), JSON.stringify(targets, null, 1));
console.log(JSON.stringify(summary));
const owners = [...new Set(results.map(r => r.owner))].sort();
console.log('\n| owner | kind | targets | OFF | BOXED | SNAG | UNREACHABLE | CORRIDOR |\n|---|---|---|---|---|---|---|---|');
for (const o of owners) for (const k of [...new Set(results.filter(r => r.owner === o).map(r => r.kind))]) {
  const rs = results.filter(r => r.owner === o && r.kind === k), n = (v: Result['verdict']) => rs.filter(r => r.verdict === v).length;
  console.log(`| ${o} | ${k} | ${rs.length} | ${n('OFF')} | ${n('BOXED')} | ${n('SNAG')} | ${n('UNREACHABLE')} | ${n('CORRIDOR')} |`);
}
console.log('\nfailures:');
const order = ['OFF', 'BOXED', 'SNAG', 'UNREACHABLE', 'CORRIDOR'];
for (const r of results.filter(q => q.verdict !== 'ok').sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict) || a.owner.localeCompare(b.owner))) {
  console.log(`${r.verdict.padEnd(11)} ${r.owner} ${r.id.padEnd(46)} ${`${r.x}, ${r.z}`.padEnd(18)} moves ${r.moving}/4 snags ${r.snags} reach ${r.reach ?? '—'} snap ${r.snap ?? '—'} [${r.dirs.map(d => `${d.moved}${d.open ? '' : '·'}`).join(' ')}]${r.tier ? ` T${r.tier}` : ''}`);
}
