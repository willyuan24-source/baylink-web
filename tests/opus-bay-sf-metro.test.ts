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
