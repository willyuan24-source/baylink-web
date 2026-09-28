import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 4 · lane T, the integration review (W4-T-int-review): defects found in the lane's part a / b and fixed.
 *   R1  a cable-car station's prompt (where the player waits, where 直接到站 lands) clears every vehicle path there, not
 *       only its own track: the D3 spots stood in the sightseeing bus's path on California St and at Powell & Bush /
 *       Hyde & North Point, and on the F-line's rails at Powell & Market and California & Drumm
 *   R2  直接到站 to a city F-line station lands beside the tracks (its point is on the rails), a hero stop on its platform
 *   R3  直接到站 while the Metro train dwells at a station on the way goes to the destination (it used to put the rider at
 *       that station); 在这站下车 gets off at the station it was tapped at, even when the train moved on under the veil
 *   R4  a shared Market St station offers each destination once and the far ends of both lines (a cap per line left two
 *       identical rows per trunk stop and no Ocean Beach / Balboa Park on a phone at Powell)
 *   R5  the 直接到站 veil always lifts (it takes the pointer), even if the jump throws
 *   R6  every place a line ride puts the rider (the loop poles, the Metro kiosks / poles, the cable-car kerb spots, the
 *       F-line landings, the ferry quays) is joined to the street: 22 of the 60 wave-4 props stood in walled gaps behind
 *       the kerb (the Castro and Church kiosks, the La Playa pole …), so an underground arrival or 直接到站 left the rider
 *       with no way out
 */

// --- headless canvas / DOM stubs (world modules create label atlases at import time; the veil is one DOM element)
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
const veils: { removed: boolean }[] = [];
const fakeEl = () => {
  const el = { width: 0, height: 0, style: {} as Record<string, string>, textContent: '', removed: false, getContext: () => ctx2d, setAttribute: noop, appendChild: noop, remove() { el.removed = true; } };
  return el;
};
g.window ??= globalThis;
g.document ??= { createElement: fakeEl };
const doc = g.document as Record<string, unknown>;
doc.querySelector ??= () => null;
doc.body ??= { appendChild: (el: { removed: boolean }) => { veils.push(el); } };
g.requestAnimationFrame ??= (fn: () => void) => setTimeout(fn, 0);

const T = await import('../src/opus-bay/data/transit');
const { game } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { onEvent } = await import('../src/opus-bay/core/events');
const { flow } = await import('../src/opus-bay/game/flowStore');
const transit = await import('../src/opus-bay/game/transit');
const ride = await import('../src/opus-bay/game/ride');
const LR = await transit.loadLineRides();
const { LineFleet } = await import('../src/opus-bay/world/sf/lineFleet');
const { buildFLine } = await import('../src/opus-bay/data/fline');
const { DISTRICT } = await import('../src/opus-bay/data/district');
const { sfDisk } = await import('./opus-bay-sf-disk');
const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
const { canStand, setCityTerrain } = await import('../src/opus-bay/core/terrain');
const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
type TransitLine = import('../src/opus-bay/world/sf/format').TransitLine;
type GameEvent = import('../src/opus-bay/core/events').GameEvent;

const PUB = path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1');
const FILE = JSON.parse(fs.readFileSync(path.join(PUB, 'transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const DATA = T.buildTransit(FILE);
const W4 = T.buildTransitW4(FILE)!;
const FJSON = FILE.lines.find(l => l.id === 'f-line')!;
const DT = 1 / 30;
const sf = sfDisk();
// the walk inputs of every site the city draws (the 24 landmarks and the wave-4 sites), as world/sf/sites.ts sends them
const LMS = landmarkWalkInputs(SF_SITES);

async function withCityAround(points: { x: number; z: number }[], r: number, fn: () => void | Promise<void>) {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  for (const p of points) await sf.attachAround(city, p.x, p.z, r, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try { await fn(); } finally { setCityTerrain(null); }
}

/** How far the player can walk from (x0, z0): a flood of standable ground in 0.5 u steps within a box of ±`box` u. */
function walkReach(x0: number, z0: number, box = 26): number {
  if (!canStand(x0, z0, 0.45)) return 0;
  const step = 0.5, key = (i: number, j: number) => (i + 1000) * 4000 + (j + 1000), seen = new Set<number>([key(0, 0)]);
  const stack: [number, number][] = [[0, 0]];
  let far = 0;
  while (stack.length) {
    const [i, j] = stack.pop()!;
    far = Math.max(far, Math.hypot(i, j) * step);
    if (far >= box - 1) return far;
    for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      const k = key(a, b);
      if (seen.has(k) || Math.abs(a * step) > box || Math.abs(b * step) > box) continue;
      seen.add(k);
      if (canStand(x0 + a * step, z0 + b * step, 0.45)) stack.push([a, b]);
    }
  }
  return far;
}
const JOINED = 20;

function install() {
  T.setTransitW4(W4);
  T.setFlineJson(FJSON);
  T.setTransitData(DATA);
}

/** Distance from (x, z) to a published path (x, y, z triples), its tunnels left out (independent of the game's helper). */
function pathDistance(line: { path: number[]; tunnels?: { fromAt: number; toAt: number }[] }, x: number, z: number): number {
  let best = Infinity, at = 0;
  const p = line.path;
  for (let i = 3; i + 2 < p.length; i += 3) {
    const ax = p[i - 3], az = p[i - 1], bx = p[i], bz = p[i + 2], L = Math.hypot(bx - ax, bz - az);
    const mid = at + L / 2;
    at += L;
    if (line.tunnels?.some(t => mid >= t.fromAt && mid <= t.toAt)) continue;
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    best = Math.min(best, Math.hypot(x - ax - dx * k, z - az - dz * k));
  }
  return best;
}
/** Every vehicle path's distance from (x, z): each published line and the hero F-line (the district's streetcar track). */
function vehiclePathDistances(x: number, z: number): [string, number][] {
  const out: [string, number][] = FILE.lines.map(l => [l.id, pathDistance(l as unknown as TransitLine, x, z)]);
  const hero = DISTRICT.streetcar.path;
  let h = Infinity;
  for (let i = 1; i < hero.length; i++) {
    const a = hero[i - 1], b = hero[i], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
    h = Math.min(h, Math.hypot(x - a.x - dx * k, z - a.z - dz * k));
  }
  out.push(['hero-streetcar', h]);
  return out;
}

test('review R1: every cable-car station prompt stands clear of every vehicle path (its track, the bus loop, the F-line, the other lines) on ground joined to the street', async () => {
  install();
  assert.equal(DATA.stations.length, 56);
  // the D3 spots that stood in another vehicle's path (the review's in-game numbers): the fix must clear them all
  const before: Record<string, string> = { 'powell-market': 'f-line', 'powell-bush': 'sf-loop', 'hyde-north-point': 'sf-loop', 'california-drumm': 'f-line', 'california-davis': 'sf-loop', 'california-front': 'sf-loop', 'california-battery': 'sf-loop', 'california-sansome': 'sf-loop' };
  await withCityAround(DATA.stations, 20, () => {
    const prev = game.get();
    game.set({ worldMode: 'city' } as never);
    try {
      for (const st of DATA.stations) LR.stationBoardSpot(st, true);
      const items = transit.transitInteractables();
      const narrow: string[] = [];
      for (const st of DATA.stations) {
        const it = items.find(i => i.id === `transit-${st.id}`)!;
        assert.ok(it, st.id);
        assert.ok(canStand(it.x, it.z, 0.45), `${st.id}: on walkable ground`);
        assert.ok(walkReach(it.x, it.z) >= JOINED, `${st.id}: joined to the street (${it.x.toFixed(1)}, ${it.z.toFixed(1)})`);
        const tt = DATA.turntables.find(t => Math.hypot(t.x - st.x, t.z - st.z) < 6);
        if (tt) assert.ok(Math.hypot(it.x - tt.x, it.z - tt.z) >= 5, `${st.id}: clear of the turntable`);
        assert.ok(Math.hypot(it.x - st.x, it.z - st.z) <= 9.1 + (tt ? 5 : 0), `${st.id}: still at the station`);
        // no vehicle stops for someone waiting there (KERB_MIN), and KERB_OFF clear wherever the street has room
        for (const [line, d] of vehiclePathDistances(it.x, it.z)) {
          assert.ok(d >= LR.KERB_MIN - 1e-6, `${st.id}: ${d.toFixed(2)} u from ${line} (at ${it.x.toFixed(1)}, ${it.z.toFixed(1)})`);
          if (d < LR.KERB_OFF && !narrow.includes(st.id)) narrow.push(st.id);
        }
      }
      // the spots that stood in another vehicle's path: clear of it now (Powell & Bush: the cable track and the bus loop
      // cross a street with buildings at the kerb, the best there is ≥ KERB_MIN)
      for (const [id, line] of Object.entries(before)) {
        const it = items.find(i => i.id === `transit-${id}`)!;
        const d = vehiclePathDistances(it.x, it.z).find(e => e[0] === line)![1];
        assert.ok(d >= (id === 'powell-bush' ? LR.KERB_MIN : LR.KERB_OFF) - 1e-6, `${id}: ${d.toFixed(2)} u from ${line}`);
      }
      assert.ok(narrow.length <= 2, `only the narrowest streets below KERB_OFF: ${narrow.join(', ')}`);
    } finally { game.set({ worldMode: prev.worldMode } as never); }
  });
});

test('review R2: 直接到站 to a city F-line station lands beside the tracks (a hero stop: its platform), never on the rails', async () => {
  install();
  const line = buildFLine(FJSON, DISTRICT.streetcar)!;
  const city = line.stations.filter(s => !s.hero);
  assert.ok(city.length >= 5 && line.stations.some(s => s.hero));
  await withCityAround(city, 20, () => {
    for (const st of city) {
      const at = LR.flineLandingSpot(st);
      assert.ok(canStand(at.x, at.z, 0.45), `${st.id}: walkable`);
      assert.ok(walkReach(at.x, at.z) >= JOINED, `${st.id}: joined to the street`);
      assert.ok(Math.hypot(at.x - st.x, at.z - st.z) <= 9.1, `${st.id}: at the station`);
      for (const [l, d] of vehiclePathDistances(at.x, at.z)) assert.ok(d >= LR.KERB_OFF - 1e-6, `${st.id}: ${d.toFixed(2)} u from ${l}`);
    }
  });
  for (const st of line.stations.filter(s => s.hero)) {
    const at = LR.flineLandingSpot(st), platform = DISTRICT.anchors[`streetcar-${st.id}`];
    if (platform) assert.deepEqual(at, { x: platform.x, z: platform.z }, `${st.id}: the hero platform`);
  }
});

function metroFleet() {
  install();
  const fleet = new LineFleet({ loop: W4.loop as TransitLine & { speeds?: [number, number, number][] }, metro: W4.metro, props: W4.props, extra: [] });
  T.setActiveLineFleet(fleet);
  const step = (seconds: number, until?: () => boolean) => {
    for (let t = 0; t < seconds; t += DT) {
      fleet.update(DT, runtime.player, runtime.player);
      transit.stepTransit(DT);
      if (until?.()) return true;
    }
    return false;
  };
  return { fleet, step };
}
const settle = () => new Promise(r => setTimeout(r, 600));
const M = W4.metro.find(l => l.id === 'm-ocean-view')!;
const kioskOf = (id: string) => T.boardAt(W4, M.stops.find(s => s.id === id)!);

test('review R3: 直接到站 while the Metro train dwells at a station on the way goes to the destination, not that station', async () => {
  const { fleet, step } = metroFleet();
  const prev = game.get();
  try {
    game.set({ phase: 'playing', worldMode: 'city', toasts: [] } as never);
    const kiosk = kioskOf('muni-embarcadero');
    runtime.player.x = kiosk.x; runtime.player.z = kiosk.z;
    LR.rideLine('m-ocean-view', 'muni-embarcadero', 'muni-castro');
    assert.ok(step(60, () => ride.currentRide()?.mode === 'follow'), 'boarded');
    assert.ok(step(90, () => { const st = LR.w4Status(); return !!st?.underground && !!st.station && st.station !== 'muni-embarcadero'; }), 'dwelling under ground at a station on the way');
    const at = LR.w4Status()!.station!;
    const label = transit.rideLabel(flow.get().ride!);
    assert.equal(label.canHopOff, false, 'no hop-off under ground (the overlay offers 在这站下车 / 直接到站)');
    transit.finishRide();
    await settle();
    assert.equal(ride.currentRide(), null, 'off the train');
    const castro = kioskOf('muni-castro'), there = kioskOf(at);
    const p = runtime.player;
    assert.ok(Math.hypot(p.x - castro.x, p.z - castro.z) < 12.5, `at the Castro kiosk, not ${at} (${p.x.toFixed(1)}, ${p.z.toFixed(1)}; ${at} kiosk ${there.x.toFixed(1)}, ${there.z.toFixed(1)})`);
    assert.ok(game.get().toasts.some(t => /Castro|卡斯特罗/.test(t.text)), 'arrival at the Castro said');
  } finally {
    transit.cancelRide(); T.setActiveLineFleet(null); fleet.dispose();
    game.set({ phase: prev.phase, worldMode: prev.worldMode, move: prev.move, toasts: [] } as never);
    flow.set({ ride: null });
  }
});

test('review R3: 在这站下车 gets off at the station it was tapped at, even when the train leaves it under the veil; the ride counted names that station', async () => {
  const { fleet, step } = metroFleet();
  const prev = game.get();
  const events: GameEvent[] = [];
  const offEv = onEvent(e => { if (e.type === 'transit' && e.what === 'ride') events.push(e); });
  try {
    game.set({ phase: 'playing', worldMode: 'city', toasts: [] } as never);
    const kiosk = kioskOf('muni-embarcadero');
    runtime.player.x = kiosk.x; runtime.player.z = kiosk.z;
    LR.rideLine('m-ocean-view', 'muni-embarcadero', 'muni-castro');
    assert.ok(step(60, () => ride.currentRide()?.mode === 'follow'), 'boarded');
    assert.ok(step(120, () => { const st = LR.w4Status(); return !!st?.underground && (st.station === 'muni-civic-center'); }), 'dwelling at Civic Center');
    transit.alightHere();
    assert.ok(ride.currentRide(), 'under the veil (the kiosk is far from where the rider is held)');
    // the train pulls out while the kiosk streams in
    assert.ok(step(20, () => LR.w4Status()?.station === null), 'the train left Civic Center');
    await settle();
    assert.equal(ride.currentRide(), null);
    const cc = kioskOf('muni-civic-center');
    assert.ok(Math.hypot(runtime.player.x - cc.x, runtime.player.z - cc.z) < 12.5, `at the Civic Center kiosk (${runtime.player.x.toFixed(1)}, ${runtime.player.z.toFixed(1)})`);
    assert.ok(game.get().toasts.some(t => /Civic Center|市政中心/.test(t.text)), 'arrival at Civic Center said');
    for (const e of events) assert.ok(e.type === 'transit' && e.station !== 'muni-castro', 'no ride credited to the Castro');
  } finally {
    offEv(); transit.cancelRide(); T.setActiveLineFleet(null); fleet.dispose();
    game.set({ phase: prev.phase, worldMode: prev.worldMode, move: prev.move, toasts: [] } as never);
    flow.set({ ride: null });
  }
});

test('review R4 (+ W5-T5): a shared Market St station offers each destination once, both lines, the Metro goal ends (the M to Stonestown / SF State fits on a phone) and on a desktop the far ends', () => {
  const { fleet } = metroFleet();
  const device = runtime.input.device;
  try {
    for (const dev of ['touch', 'keyboard'] as const) {
      runtime.input.device = dev;
      const max = dev === 'touch' ? 6 : 8;
      for (const station of ['muni-embarcadero', 'muni-montgomery', 'muni-powell', 'muni-civic-center', 'muni-van-ness']) {
        const rows = LR.stationChoices(station).filter(c => c.kind === 'ride');
        const to = rows.map(r => r.to);
        assert.ok(rows.length <= max && rows.length >= Math.min(max, 5), `${station} (${dev}): ${rows.length} rows`);
        assert.equal(new Set(to).size, to.length, `${station} (${dev}): a destination once (${to.join(', ')})`);
        assert.ok(rows.some(r => r.line === 'n-judah') && rows.some(r => r.line === 'm-ocean-view'), `${station} (${dev}): both lines`);
        assert.ok(to.includes('muni-judah-la-playa'), `${station} (${dev}): the N to Ocean Beach (${to.join(', ')})`);
        // (W5-T5) the Metro goal's M ends on every device: Stonestown (19th & Winston) and SF State (19th & Holloway)
        assert.ok(to.includes('muni-19th-winston') && to.includes('muni-19th-holloway'), `${station} (${dev}): the M to Stonestown and SF State (${to.join(', ')})`);
        if (dev === 'keyboard') assert.ok(to.includes('muni-san-jose-geneva'), `${station} (${dev}): the M to Balboa Park (${to.join(', ')})`);
      }
      // a one-line station keeps its own rows (the loop: the next 3 stops + the lap)
      const loop = LR.stationChoices('loop-castro').filter(c => c.kind === 'ride' || c.kind === 'lap');
      assert.deepEqual(loop.map(c => c.to), ['loop-twin-peaks', 'loop-mission-dolores', 'loop-civic-center', 'loop-castro']);
    }
  } finally { runtime.input.device = device; T.setActiveLineFleet(null); fleet.dispose(); }
});

test('review R5: the 直接到站 veil lifts even when the jump throws', async () => {
  const before = veils.length;
  const logged: unknown[] = [];
  const error = console.error;
  console.error = (...a: unknown[]) => { logged.push(a); };
  try {
    LR.veiledSkip({ x: 0, z: 0 }, { zh: '某站', en: 'Somewhere' }, () => { throw new Error('world gone'); });
    assert.equal(veils.length, before + 1);
    await new Promise(r => setTimeout(r, 1200));
    assert.ok(veils[before].removed, 'the veil is gone');
    assert.equal(logged.length, 1, 'the error is reported');
  } finally { console.error = error; }
});

test('review R6: every wave-4 pole / kiosk and both ferry quays stand on ground joined to the street (a rider put there can walk away)', async () => {
  install();
  const props: { id: string; x: number; z: number }[] = [];
  for (const l of W4.lines) for (const s of l.stops) if (!props.some(p => p.id === s.id)) props.push({ id: s.id, ...T.boardAt(W4, s) });
  assert.equal(props.length, 66);
  for (const t of T.FERRY_ROUTES.find(r => r.running)!.terminals) props.push({ id: `ferry:${t.id}`, x: t.quay.x, z: t.quay.z });
  await withCityAround(props, 32, () => {
    const walled = props.filter(p => walkReach(p.x, p.z) < JOINED).map(p => `${p.id} (${p.x}, ${p.z}): ${walkReach(p.x, p.z).toFixed(1)} u`);
    assert.deepEqual(walled, [], 'walled in');
  });
});
