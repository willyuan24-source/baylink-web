import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 4 · lane T: the Muni Metro lines (N Judah, M Ocean View) — station ids and names (data/sf/stationNames.ts), the
 * extracted data (public/opus-bay/sf/v1/transit-w4.json, written by scripts/opus-sf/transit-sidecar.ts: tunnels, portals,
 * underground heights, kiosks), and (below) the light-rail simulation, the LRV, stations, portals and the subway overlay.
 */

const { transitLineProblems, tunnelAt } = await import('../src/opus-bay/world/sf/format');
const names = await import('../src/opus-bay/data/sf/stationNames');
const { checkW4Lines } = await import('../scripts/opus-sf/transit-sidecar');
type TransitFile = import('../src/opus-bay/world/sf/format').TransitFile;
type TransitLine = import('../src/opus-bay/world/sf/format').TransitLine;

const FILE = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/transit-w4.json'), 'utf8')) as TransitFile;
const line = (id: string) => FILE.lines.find(l => l.id === id)!;
const N = line('n-judah'), M = line('m-ocean-view');
const pathY = (l: TransitLine, at: number) => {
  let cum = 0;
  for (let i = 3; i < l.path.length; i += 3) {
    const seg = Math.hypot(l.path[i] - l.path[i - 3], l.path[i + 2] - l.path[i - 1]);
    if (cum + seg >= at) { const t = seg ? (at - cum) / seg : 0; return l.path[i - 2] + (l.path[i + 1] - l.path[i - 2]) * t; }
    cum += seg;
  }
  return l.path[l.path.length - 2];
};

test('station ids: stable, prefixed, unique, [a-z0-9-], zh + en names; OSM names map one way', () => {
  const ids = names.W4_STATION_IDS;
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^(loop|muni)-[a-z0-9-]{2,60}$/);
  assert.equal(names.LOOP_STOPS.length, 16);
  assert.deepEqual(names.LOOP_STOPS.slice(0, 3).map(s => s.id), ['loop-ferry-building', 'loop-pier-39', 'loop-wharf-hyde']);
  for (const s of [...names.LOOP_STOPS, ...names.METRO_STATIONS]) {
    assert.ok(s.name.zh && s.name.en, s.id);
    assert.ok([...s.name.zh].length <= 24, `${s.id} zh name fits a phone banner`);
  }
  const seen = new Set<string>();
  for (const s of names.METRO_STATIONS) for (const o of s.osm) { assert.ok(!seen.has(o), `OSM name ${o} maps once`); seen.add(o); }
  assert.equal(names.metroStationForOsm('Castro')?.id, 'muni-castro');
  assert.equal(names.metroStationForOsm('Nowhere'), null);
  // every attraction list points at stations that exist
  for (const id of Object.keys(names.STOP_ATTRACTIONS)) assert.ok(ids.includes(id), id);
  for (const l of Object.values(names.W4_LINES)) { assert.ok(l.short.length >= 1 && l.short.length <= 4); assert.match(l.color, /^#[0-9a-f]{6}$/); }
});

test('the plan §3.3 stops of interest carry their zh glosses', () => {
  const want: Record<string, string> = {
    'muni-embarcadero': '内河码头', 'muni-montgomery': '蒙哥马利', 'muni-powell': '鲍威尔', 'muni-civic-center': '市政中心',
    'muni-duboce-church': '杜博斯', 'muni-carl-cole': '海特区', 'muni-carl-stanyan': '金门公园东', 'muni-carl-hillway': 'UCSF',
    'muni-irving-2nd': '帕纳萨斯', 'muni-9th-irving': '金门公园', 'muni-judah-la-playa': '海洋海滩', 'muni-church': '教堂街',
    'muni-castro': '卡斯特罗', 'muni-forest-hill': '森林山', 'muni-west-portal': '西门', 'muni-st-francis-circle': '圣弗朗西斯',
    'muni-19th-winston': '石镇', 'muni-19th-holloway': '州立大学',
  };
  for (const [id, gloss] of Object.entries(want)) assert.ok(names.w4StationName(id)!.zh.includes(gloss), `${id} zh has ${gloss}`);
  assert.equal(names.w4StationName('muni-van-ness')!.en, 'Van Ness');
});

test('transit-w4.json: the three lines pass transitLineProblems and the frozen sf-data rules', () => {
  assert.deepEqual(FILE.lines.map(l => l.id), ['sf-loop', 'n-judah', 'm-ocean-view']);
  for (const l of FILE.lines) assert.deepEqual(transitLineProblems(l), [], l.id);
  assert.deepEqual(checkW4Lines(FILE.lines), []);
});

test('N Judah: cut at Embarcadero, Market St subway to the Duboce portal, the Sunset Tunnel, surface to La Playa', () => {
  assert.ok(Math.abs(N.length - 1580) < 1580 * 0.05, `N ${N.length} u`);
  assert.equal(N.stops[0].id, 'muni-embarcadero');
  assert.equal(N.stops[0].at, 0);
  assert.equal(N.stops[N.stops.length - 1].id, 'muni-judah-la-playa');
  assert.equal(N.stops[N.stops.length - 1].at, N.length);
  assert.equal(N.tunnels!.length, 2);
  const [sub, sunset] = N.tunnels!;
  assert.equal(sub.fromAt, 0);
  assert.equal(sub.portalA, null);
  assert.equal(sub.portalB!.name!.en, 'Duboce portal');
  assert.deepEqual(sub.stations, ['muni-embarcadero', 'muni-montgomery', 'muni-powell', 'muni-civic-center', 'muni-van-ness']);
  assert.ok(Math.abs(sub.toAt - 516) < 25, `subway ${sub.toAt} u`);
  assert.equal(sunset.portalA!.name!.en, 'Sunset Tunnel east portal');
  assert.equal(sunset.portalB!.name!.en, 'Sunset Tunnel west portal');
  assert.ok(Math.abs(sunset.toAt - sunset.fromAt - 180) < 15, `Sunset Tunnel ${sunset.toAt - sunset.fromAt} u (1,290 m real)`);
  assert.deepEqual(sunset.stations, []);
  assert.equal(tunnelAt(N, 100), sub);
  assert.equal(tunnelAt(N, 700), sunset);
  assert.equal(tunnelAt(N, 1200), null);
  for (const id of ['muni-duboce-church', 'muni-carl-cole', 'muni-irving-2nd', 'muni-9th-irving']) assert.ok(N.stops.some(s => s.id === id && s.major), `${id} major`);
});

test('M Ocean View: one bore Embarcadero → West Portal (8 stations), surface to Stonestown, SF State and Balboa Park', () => {
  assert.ok(Math.abs(M.length - 2028) < 2028 * 0.05, `M ${M.length} u`);
  assert.equal(M.tunnels!.length, 1);
  const t = M.tunnels![0];
  assert.equal(t.portalA, null);
  assert.equal(t.portalB!.name!.en, 'West Portal');
  assert.deepEqual(t.stations, ['muni-embarcadero', 'muni-montgomery', 'muni-powell', 'muni-civic-center', 'muni-van-ness', 'muni-church', 'muni-castro', 'muni-forest-hill']);
  assert.equal(M.stops[M.stops.length - 1].id, 'muni-san-jose-geneva');
  const winston = M.stops.find(s => s.id === 'muni-19th-winston')!, holloway = M.stops.find(s => s.id === 'muni-19th-holloway')!;
  assert.ok(winston.major && holloway.major);
  assert.deepEqual(winston.attractions, ['stonestown-galleria']);
  assert.equal(holloway.attractions![0], 'sf-state-university');
  // the shared Market St stations sit at the same arc on both lines
  for (const id of ['muni-montgomery', 'muni-powell', 'muni-civic-center', 'muni-van-ness']) {
    assert.ok(Math.abs(N.stops.find(s => s.id === id)!.at - M.stops.find(s => s.id === id)!.at) < 1, id);
  }
});

test('heights: surface from the terrain, underground interpolated (never above the mouths, ≥ −20), mouths at street level', () => {
  for (const l of [N, M]) {
    for (let i = 1; i < l.path.length; i += 3) assert.ok(l.path[i] >= -20 && l.path[i] <= 55, `${l.id} y ${l.path[i]}`);
    for (const t of l.tunnels!) {
      for (const [p, at] of [[t.portalA, t.fromAt], [t.portalB, t.toAt]] as const) {
        if (!p) continue;
        assert.ok(Math.abs(pathY(l, at) - p.y) < 0.3, `${l.id} mouth at ${at}: path ${pathY(l, at)} vs portal ${p.y}`);
        // 20 u inside the mouth the track is at least a train height below the portal
        const inside = p === t.portalA ? at + 20 : at - 20;
        assert.ok(pathY(l, inside) < p.y - 1.8, `${l.id} dives into the portal at ${at}`);
      }
      // the whole bore stays below the chord between its ends + nothing climbs over the hills
      const mid = (t.fromAt + t.toAt) / 2;
      assert.ok(pathY(l, mid) < 25, `${l.id} bore at ${mid}: ${pathY(l, mid)}`);
    }
  }
});

test('kiosks: underground stations are boarded on the Market St sidewalk, surface stops stand clear of the portals', () => {
  const ptsOf = (l: TransitLine) => { const o: [number, number][] = []; for (let i = 0; i < l.path.length; i += 3) o.push([l.path[i], l.path[i + 2]]); return o; };
  const distTo = (pts: [number, number][], x: number, z: number) => {
    let d = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return d;
  };
  for (const l of [N, M]) {
    const pts = ptsOf(l);
    for (const s of l.stops) {
      const ug = names.metroStation(s.id)?.underground;
      const d = distTo(pts, s.x, s.z);
      if (ug) assert.ok(d > 2.5 && d < 12, `${l.id} ${s.id} kiosk ${d.toFixed(1)} u off the track`);
      else assert.ok(d < 6, `${l.id} ${s.id} stop ${d.toFixed(1)} u from the track`);
      if (!ug) for (const t of l.tunnels!) assert.ok(s.at <= t.fromAt - 7 || s.at >= t.toAt + 7 || (t.fromAt === 0 && s.at === 0), `${l.id} ${s.id} at ${s.at} clear of the tunnel [${t.fromAt}, ${t.toAt}]`);
    }
  }
});

// ---------------------------------------------------------------------------
// The light-rail simulation (world/lightRail.ts)
// ---------------------------------------------------------------------------

const platform = await import('../src/opus-bay/actors/platform');
const { LRV, LightRailSystem, TRAIN_LENGTH, railTrack } = await import('../src/opus-bay/world/lightRail');
const { runSeconds } = await import('../src/opus-bay/world/lineTrack');
const TN = railTrack(N), TM = railTrack(M);
type Rail = InstanceType<typeof LightRailSystem>;
const run = (sys: Rail, secs: number, dt = 1 / 20, each?: () => void) => { for (let t = 0; t < secs; t += dt) { sys.step(dt); each?.(); } };
const until = (sys: Rail, cond: () => boolean, max: number, dt = 1 / 20) => { let t = 0; while (!cond() && t < max) { sys.step(dt); t += dt; } return t; };

test('light rail: 10 simulated minutes on N + M (2 trains each): no block violations, dwells 4 s surface / 3 s underground, reversals, hidden underground', () => {
  const sys = new LightRailSystem([TN, TM]);
  assert.equal(sys.trains.length, 4);
  let bad: string[] = [];
  const since = new Map<number, { t: number; st: string }>(), dwellSurface: number[] = [], dwellUnder: number[] = [];
  let reversals = 0, hiddenSeen = 0;
  run(sys, 600, 1 / 20, () => {
    const v = sys.violations();
    if (v.length) bad = v;
    for (const tr of sys.trains) if (tr.hidden) hiddenSeen++;
    for (const e of sys.events) {
      if (e.what === 'arrive') since.set(e.train, { t: sys.time, st: e.station! });
      if (e.what === 'reverse') reversals++;
      if (e.what === 'depart' && since.has(e.train)) {
        const a = since.get(e.train)!, track = sys.trains[e.train].track, stop = track.stops.find(s => s.id === a.st)!;
        const end = stop.at < 0.5 || stop.at > track.length - 0.5;
        if (!end) (stop.underground ? dwellUnder : dwellSurface).push(sys.time - a.t);
      }
    }
    sys.events.length = 0;
  });
  assert.deepEqual(bad, []);
  assert.ok(reversals >= 4, `reversals ${reversals}`);
  assert.ok(hiddenSeen > 0, 'trains run hidden underground');
  assert.ok(dwellSurface.length > 5 && dwellSurface.every(d => d >= LRV.dwell - 0.1 && d < LRV.dwell + 3), `surface dwells ${dwellSurface.map(d => d.toFixed(1))}`);
  assert.ok(dwellUnder.length > 5 && dwellUnder.every(d => d >= LRV.dwellUnderground - 0.1 && d < LRV.dwellUnderground + 3), `underground dwells ${dwellUnder.map(d => d.toFixed(1))}`);
  for (const t of sys.trains) assert.ok(t.still < 40, `${t.track.id}#${t.index} stuck ${t.still.toFixed(1)} s`);
  // end to end (plan §3.1: N ≈ 2.8 min, M ≈ 3.1 min with the compressed subway)
  const endToEnd = (tr: typeof TN) => runSeconds(tr, 0, tr.length) + tr.stops.filter(s => s.major && s.at > 0.5 && s.at < tr.length - 0.5).length * (LRV.dwell + LRV.stopPenalty);
  assert.ok(endToEnd(TN) > 120 && endToEnd(TN) < 260, `N ${endToEnd(TN).toFixed(0)} s`);
  assert.ok(endToEnd(TM) > 150 && endToEnd(TM) < 300, `M ${endToEnd(TM).toFixed(0)} s`);
  // the subway is compressed: Embarcadero → Church ≈ 35 s
  const church = TM.stops.find(s => s.id === 'muni-church')!;
  const t0 = runSeconds(TM, 0, church.at) + 4 * (LRV.dwellUnderground + LRV.stopPenalty);
  assert.ok(t0 > 20 && t0 < 50, `Embarcadero → Church ${t0.toFixed(0)} s`);
});

test('light rail: rider at an underground kiosk (Castro) → 19th & Winston: dispatch ≤ 15 s, overlay, portal hand-over, emerging, arrival', () => {
  let ready = false;
  const sys = new LightRailSystem([TN, TM], { portalReady: () => ready });
  run(sys, 5);
  const st = sys.request({ line: 'm-ocean-view', station: 'muni-castro', dir: 1, to: 'muni-19th-winston' })!;
  assert.ok(st);
  const waited = until(sys, () => sys.rideStatus()!.phase !== 'coming', 40);
  assert.equal(sys.rideStatus()!.phase, 'here');
  assert.ok(waited <= 15.5, `picked up after ${waited.toFixed(1)} s`);
  sys.board();
  const train = sys.riderCarOf('m-ocean-view')!;
  const events: string[] = [];
  let underground = false, heldAt = -1;
  let t = until(sys, () => {
    for (const e of sys.events) if (e.train === train.index) events.push(e.what);
    sys.events.length = 0;
    if (sys.rideStatus()!.underground) underground = true;
    if (sys.rideStatus()!.portalWait && heldAt < 0) heldAt = sys.time;
    // the surface streams in 3 s after the train starts waiting at the mouth
    if (heldAt >= 0 && sys.time - heldAt > 3) ready = true;
    return sys.rideStatus()!.phase === 'arrived';
  }, 300);
  assert.equal(sys.rideStatus()!.lastStation, 'muni-19th-winston');
  assert.ok(underground, 'the overlay showed (underground)');
  assert.ok(heldAt > 0, 'waited inside West Portal for the surface');
  assert.ok(events.includes('portal-out'), `emerged: ${events.join(' ')}`);
  assert.ok(events.includes('approach'));
  const est = sys.rideSeconds('m-ocean-view', 'muni-castro', 'muni-19th-winston');
  t -= 3 + 1.6;
  assert.ok(Math.abs(t - est) < est * 0.15 + 4, `rode ${t.toFixed(1)} s vs ${est.toFixed(1)} s estimated`);
  assert.ok(!train.hidden, 'on the surface at Winston');
});

test('light rail: the portal wait is capped at 8 s when the surface never reports ready', () => {
  const sys = new LightRailSystem([TN], { portalReady: () => false });
  sys.request({ line: 'n-judah', station: 'muni-van-ness', dir: 1, to: 'muni-carl-cole' });
  until(sys, () => sys.rideStatus()!.phase !== 'coming', 40);
  sys.board();
  let held = 0;
  const t = until(sys, () => { if (sys.rideStatus()!.portalWait) held += 1 / 20; return sys.rideStatus()!.phase === 'arrived'; }, 200);
  assert.equal(sys.rideStatus()!.phase, 'arrived', `arrived after ${t.toFixed(0)} s`);
  assert.ok(held > 5 && held <= 2 * (LRV.portalHold + 1.5), `held ${held.toFixed(1)} s in total at the two mouths`);
});

test('light rail: minor stops only on request; 下一站下车; hop-off ignored underground, honoured on the surface', () => {
  const sys = new LightRailSystem([TN]);
  // a rider waiting at a minor stop is served there
  sys.request({ line: 'n-judah', station: 'muni-judah-28th', dir: -1, to: 'muni-judah-19th' });
  const w = until(sys, () => sys.rideStatus()!.phase !== 'coming', 40);
  assert.equal(sys.rideStatus()!.phase, 'here', `minor stop served after ${w.toFixed(1)} s`);
  sys.board();
  sys.events.length = 0;
  const train = sys.riderCarOf('n-judah')!;
  // passing minor stops: 25th, 23rd are not stopped at (the ride goes to 19th)
  const arrivals: string[] = [];
  until(sys, () => { for (const e of sys.events) if (e.what === 'arrive' && e.train === train.index) arrivals.push(e.station!); sys.events.length = 0; return sys.rideStatus()!.phase === 'arrived'; }, 120);
  assert.deepEqual(arrivals, ['muni-judah-19th']);
  sys.cancel();
  // 下一站下车 on a surface ride stops at the very next station, minor or not
  sys.request({ line: 'n-judah', station: 'muni-9th-irving', dir: 1, to: 'muni-judah-la-playa' });
  until(sys, () => sys.rideStatus()!.phase !== 'coming', 40);
  sys.board();
  until(sys, () => sys.riderCarOf('n-judah')!.mode === 'run' && sys.riderCarOf('n-judah')!.v > 3, 30);
  const next = sys.requestNextStop();
  assert.equal(next, 'muni-judah-9th');
  until(sys, () => sys.rideStatus()!.phase === 'arrived', 60);
  assert.equal(sys.rideStatus()!.lastStation, 'muni-judah-9th');
  sys.cancel();
  // underground the hop-off brake is ignored
  sys.request({ line: 'n-judah', station: 'muni-embarcadero', dir: 1, to: 'muni-van-ness' });
  until(sys, () => sys.rideStatus()!.phase !== 'coming', 40);
  sys.board();
  until(sys, () => sys.rideStatus()!.underground && sys.riderCarOf('n-judah')!.v > 10, 30);
  assert.ok(sys.rideStatus()!.underground);
  platform.requestPlatformStop('n-judah', 1);
  run(sys, 2);
  assert.ok(sys.riderCarOf('n-judah')!.v > 5 || sys.riderCarOf('n-judah')!.mode === 'dwell', 'no braking in the tunnel');
  platform.releasePlatformStop('n-judah');
});

test('light rail: termini reverse (double-ended) and serve a rider waiting to ride back; one train at a terminus', () => {
  const sys = new LightRailSystem([TN]);
  sys.request({ line: 'n-judah', station: 'muni-judah-la-playa', dir: -1, to: 'muni-judah-sunset' });
  const w = until(sys, () => sys.rideStatus()!.phase !== 'coming', 60);
  assert.equal(sys.rideStatus()!.phase, 'here', `served at the terminus after ${w.toFixed(1)} s`);
  const tr = sys.riderCarOf('n-judah')!;
  assert.equal(tr.dir, -1);
  assert.ok(Math.abs(tr.s - (TN.length - TRAIN_LENGTH / 2 - 0.2)) < 0.5, 'the train stands a half train short of the track end');
  // the pose: the lead car faces the travel direction, the two cars ≈ a train length long
  const lead = sys.leadCar(tr), other = tr.cars[tr.dir > 0 ? 1 : 0];
  const span = Math.hypot(lead.x - other.x, lead.z - other.z);
  assert.ok(Math.abs(span - (TRAIN_LENGTH - LRV.carLength)) < 0.6, `car centres ${span.toFixed(2)} u apart`);
  const fwd = { x: Math.sin(lead.heading), z: Math.cos(lead.heading) };
  assert.ok((lead.x - other.x) * fwd.x + (lead.z - other.z) * fwd.z > 0, 'the lead car is in front');
  sys.board();
  until(sys, () => sys.rideStatus()!.phase === 'arrived', 90);
  assert.equal(sys.rideStatus()!.lastStation, 'muni-judah-sunset');
});

// ---------------------------------------------------------------------------
// The LRV, the portals, the subway overlay strip, the line sounds (world/sf/lrv.ts, portals.ts, ui/subwayStrip.ts, audio/lines.ts)
// ---------------------------------------------------------------------------

const lrv = await import('../src/opus-bay/world/sf/lrv');
const portals = await import('../src/opus-bay/world/sf/portals');
const strip = await import('../src/opus-bay/ui/subwayStrip');
const lines = await import('../src/opus-bay/audio/lines');
const triCount = (geo: { getIndex(): { count: number } | null }) => geo.getIndex()!.count / 3;

test('LRV: ≤ 500 triangles a car (≤ 1k a two-car train), far ≤ 120; one geometry per line colour; the platform (lead car)', () => {
  for (const c of ['#2f6fb0', '#2f8f5b']) {
    const near = lrv.lrvCarGeometry(c), far = lrv.lrvCarFarGeometry(c);
    assert.ok(triCount(near) * 2 <= 1000, `train ${triCount(near) * 2} tris`);
    assert.ok(triCount(far) <= 120, `far car ${triCount(far)} tris`);
    near.computeBoundingBox();
    const bb = near.boundingBox!;
    assert.ok(bb.max.z - bb.min.z <= LRV.carLength + 0.2, 'car length');
    assert.ok(bb.max.x - bb.min.x <= LRV.width + 0.2, 'car width');
  }
  const P = lrv.LRV_PLATFORM;
  assert.equal(P.kind, 'light-rail');
  assert.ok(P.floor > 0.5 && P.floor < 1.2);
  assert.ok(P.seatLeft.x > 0 && P.seatRight.x < 0 && Math.abs(P.seatLeft.heading + Math.PI / 2) < 1e-9, 'side benches face the aisle');
});

test('portals: the four named mouths, heading into the tunnel along the track, ≤ 800 triangles, walk blockers around the hood', () => {
  const ps = portals.portalPlacements([N, M]);
  assert.deepEqual(ps.map(p => p.id).sort(), ['duboce', 'sunset-east', 'sunset-west', 'west-portal']);
  for (const p of ps) {
    assert.ok(triCount(portals.portalGeometry(p.id)) <= 800, `${p.id} tris`);
    // a point 10 u ahead of the mouth along the heading lies inside the tunnel span of its line
    const l = p.line === 'n-judah' ? N : M;
    const inside = { x: p.x + Math.sin(p.heading) * 10, z: p.z + Math.cos(p.heading) * 10 };
    let best = { d: Infinity, at: 0 }, cum = 0;
    for (let i = 3; i < l.path.length; i += 3) {
      const ax = l.path[i - 3], az = l.path[i - 1], bx = l.path[i], bz = l.path[i + 2];
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, t = Math.max(0, Math.min(1, ((inside.x - ax) * dx + (inside.z - az) * dz) / (L * L)));
      const d = Math.hypot(inside.x - ax - dx * t, inside.z - az - dz * t);
      if (d < best.d) best = { d, at: cum + t * L };
      cum += L;
    }
    assert.ok(tunnelAt(l, best.at), `${p.id}: +z points into the tunnel (arc ${best.at.toFixed(0)})`);
    const blockers = portals.portalBlockers(p);
    assert.equal(blockers.length, 3);
    for (const b of blockers) assert.equal(b.length, 4);
  }
  assert.equal(ps.find(p => p.id === 'sunset-west')!.name.zh, '日落隧道西口');
});

test('subway overlay strip: dot and ticks in travel order, labels never overlap at 390 / 375 / 1440 px, current + next + exit always shown', () => {
  const t = N.tunnels![0];
  const stations = N.stops.filter(s => s.at <= t.toAt + 1).map(s => ({ id: s.id, name: s.name, at: s.at }));
  for (const width of [390 - 32, 375 - 32, 1440 - 32]) {
    for (const zh of [true, false]) {
      for (const [at, dir] of [[150, 1], [300.21, 1], [450, 1], [100, -1]] as const) {
        const next = stations.filter(s => (s.at - at) * dir > 0.5).sort((a, b) => (a.at - b.at) * dir)[0]?.id ?? null;
        const lay = strip.stripLayout({ stations, fromAt: t.fromAt, toAt: t.toAt, at, dir, portalA: null, portalB: t.portalB!.name, stopped: null, next, width }, zh);
        assert.ok(lay.dot >= 0 && lay.dot <= 1);
        for (const row of ['above', 'below'] as const) {
          const ls = lay.labels.filter(l => l.row === row).sort((a, b) => a.left - b.left);
          for (let i = 1; i < ls.length; i++) assert.ok(ls[i].left >= ls[i - 1].left + ls[i - 1].w, `${width}px ${zh ? 'zh' : 'en'} at ${at}: ${ls[i - 1].id} / ${ls[i].id} overlap`);
          for (const l of ls) assert.ok(l.left >= 0 && l.left + l.w <= width + 0.5, `${l.id} inside the strip`);
        }
        if (next) assert.ok(lay.labels.some(l => l.id === next), `next ${next} labelled at ${width}px`);
        if (dir > 0) assert.ok(lay.labels.some(l => l.kind === 'portal'), 'the Duboce mouth ahead is labelled');
        // travel order: ahead stations to the right of the dot
        for (const k of lay.ticks) if (k.state === 'ahead' || k.state === 'next') assert.ok(k.x >= lay.dot - 1e-6, `${k.id} ahead of the dot`);
      }
    }
  }
});

test('line sounds: every one-shot builds a voice, the loops start / stop without throwing (fake engine)', () => {
  const calls: string[] = [];
  const param = () => ({ value: 0, setTargetAtTime: () => undefined });
  const node = () => ({ connect: (n: unknown) => n ?? node(), disconnect: () => undefined, start: () => undefined, stop: () => undefined, frequency: param(), gain: param(), Q: param(), type: '' });
  const ctx = { currentTime: 0, createOscillator: node, createBiquadFilter: node, createGain: node };
  const e = {
    ctx, buses: { sfx: { input: node() }, ambience: { input: node() } },
    voice: (o: { name: string }) => { calls.push(o.name); return { input: node() }; },
    tone: () => node(), noiseBurst: () => node(), loopNoise: () => node(),
  } as unknown as Parameters<typeof lines.busAirBrake>[0];
  lines.busAirBrake(e); lines.doorChime(e, true); lines.doorChime(e, false); lines.stopBell(e); lines.lrvGong(e, 0.5); lines.stationChime(e); lines.portalWhoosh(e, true);
  assert.deepEqual(calls, ['bus-air-brake', 'door-chime', 'door-chime', 'stop-bell', 'lrv-gong', 'station-chime', 'portal-whoosh']);
  const loops = new lines.LineLoops(e);
  loops.update({ bus: true, busSpeed: 12, lrv: true, lrvSpeed: 8, tunnel: true });
  loops.update({ bus: false, busSpeed: 0, lrv: false, lrvSpeed: 0, tunnel: false });
  loops.dispose();
});

// ---------------------------------------------------------------------------
// Metro boarding choices and the ride banner (game/lineChoices.ts)
// ---------------------------------------------------------------------------

const choices = await import('../src/opus-bay/game/lineChoices');

test('Metro boarding: the next stop each way, termini, ★ stops, ≤ 6 rides on a phone; banner underground says no hop-off', () => {
  const sys = new LightRailSystem([TN, TM]);
  const rs = (line: string, a: string, b: string) => sys.rideSeconds(line, a, b);
  const c = choices.lineChoices(M, 'muni-castro', { rideSeconds: rs, max: 6 });
  const rides = c.filter(x => x.kind === 'ride');
  assert.ok(rides.length <= 6);
  assert.deepEqual(rides.slice(0, 2).map(x => x.to), ['muni-forest-hill', 'muni-church']);
  assert.ok(rides.some(x => x.to === 'muni-san-jose-geneva') && rides.some(x => x.to === 'muni-embarcadero'), 'both termini');
  assert.ok(rides.some(x => x.to === 'muni-19th-winston' && x.star), 'Stonestown ★');
  assert.equal(c[c.length - 1].kind, 'cancel');
  assert.equal(c[c.length - 2].kind, 'map');
  for (const r of rides) assert.equal(r.dir, M.stops.find(s => s.id === r.to)!.at > M.stops.find(s => s.id === 'muni-castro')!.at ? 1 : -1);
  const winston = rides.find(x => x.to === 'muni-19th-winston')!;
  assert.ok(winston.seconds! > 30 && winston.seconds! < 120, `Castro → Winston ${winston.seconds!.toFixed(0)} s`);
  const ug = choices.lineRideLabel(M, { phase: 'riding', eta: 0, nextStop: 'muni-forest-hill', nextEta: 16, underground: true }, 'muni-19th-winston');
  assert.equal(ug.title.zh, 'M 线 · 开往 19th & Winston · 石镇 · 下一站 森林山站');
  assert.equal(ug.icon, 'metro');
  assert.ok(!ug.canHopOff);
  assert.equal(ug.hopOffNote!.zh, '隧道里不能下车');
});
