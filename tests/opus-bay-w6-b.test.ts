import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * W6-B — the skipped adversarial review of W5-bus (docs/opus-bay/sf-w6-B.md "## Review"): the defects it found, each
 * red on the tree before its fix.
 */

// --- headless canvas / DOM stubs (world modules create label atlases at import time), as tests/opus-bay-w5-deadlock.test.ts
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
const el = () => ({ width: 0, height: 0, style: {} as Record<string, string>, textContent: '', getContext: () => ctx2d, setAttribute: noop, remove: noop, appendChild: noop });
g.document ??= { createElement: el, querySelector: () => null, body: el() };
g.requestAnimationFrame ??= (fn: () => void) => setTimeout(fn, 0);

const T = await import('../src/opus-bay/data/transit');
const { FL, cyclePoint } = await import('../src/opus-bay/data/fline');
const { BUS } = await import('../src/opus-bay/world/busSystem');
const LT = await import('../src/opus-bay/world/lineTrack');
const { game } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');

const PUB = path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1');
const FILE = JSON.parse(fs.readFileSync(path.join(PUB, 'transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const DATA = T.buildTransit(FILE);
const W4 = T.buildTransitW4(FILE)!;
const FLINE_JSON = FILE.lines.find(l => l.id === 'f-line') ?? null;

/** Park the player's toy car (occupied) at (x, z) across heading `hd`, standing. */
function sitInCar(x: number, z: number, hd: number) {
  Object.assign(runtime.vehicle, { id: 'qa-car', kind: 'car', occupied: true, x, y: 0, z, heading: hd, speed: 0 });
  runtime.player.x = x; runtime.player.z = z;
  runtime.move.mode = 'car';
  game.set({ move: { mode: 'car' } } as never);
}
function onFoot() {
  Object.assign(runtime.vehicle, { id: null, kind: null, occupied: false, speed: 0 });
  runtime.move.mode = 'foot';
  game.set({ move: { mode: 'foot' } } as never);
}

test('W6-B1 the transit stops short of the player sitting in their toy car across its path — the loop bus, a streetcar and a cable car drove straight through it (only a player on foot counted)', async () => {
  const { TransitLayer } = await import('../src/opus-bay/world/transitLayer');
  const { roadViewer } = await import('../src/opus-bay/world/sf/roadViewer');
  T.setTransitW4(W4);
  T.setFlineJson(FLINE_JSON);
  T.setTransitData(DATA);
  game.set({ phase: 'playing', worldMode: 'city' } as never);
  onFoot();
  // the helper: on foot → the player; in the bike / toy car → the vehicle's pose; riding transit → nobody on the road
  runtime.player.x = 1; runtime.player.z = 2;
  assert.deepEqual(roadViewer(), { x: 1, z: 2, onFoot: true });
  runtime.move.mode = 'transit';
  assert.equal(roadViewer().onFoot, false);
  Object.assign(runtime.vehicle, { kind: 'bike', occupied: true, x: 5, z: 6 });
  assert.deepEqual(roadViewer(), { x: 5, z: 6, onFoot: true });
  onFoot();

  const layer = new TransitLayer(DATA);
  try {
    const lines = layer.lines!, fl = layer.fline!;
    assert.ok(lines && fl, 'the loop fleet and the F-line are up');
    const DT = 1 / 20;
    let t = 0;
    const run = (secs: number, each?: () => void) => { for (let k = 0; k < secs / DT; k++) { layer.update(DT, t); t += DT; each?.(); } };
    run(20);

    // --- the loop bus: a running bus, the car standing across its road 16 u past its nose
    const tr = lines.bus.track;
    const bus = lines.bus.buses.find(b => b.mode === 'run' && b.v > 4) ?? (run(30), lines.bus.buses.find(b => b.mode === 'run' && b.v > 2));
    assert.ok(bus, 'a bus on the move');
    const sCar = bus.s + BUS.length / 2 + 16;
    const pb = LT.trackPoint(tr, sCar);
    sitInCar(pb.x, pb.z, pb.heading + Math.PI / 2);
    let busGap = Infinity;
    run(12, () => { busGap = Math.min(busGap, LT.arcAhead(tr, bus.s + BUS.length / 2, sCar)); });
    assert.ok(busGap > 0.5 && busGap < 16, `the bus's nose came within ${busGap.toFixed(2)} u of the player's car (it must stop short, not drive through)`);
    onFoot();
    run(10);

    // --- a streetcar: the car across its track 16 u past its front
    const L = fl.line;
    const car = fl.sys.cars.find(c => c.mode === 'run' && c.v > 3) ?? (run(30), fl.sys.cars.find(c => c.mode === 'run' && c.v > 1));
    assert.ok(car, 'a streetcar on the move');
    const uCar = car.u + FL.half + 16;
    const pf = cyclePoint(L, uCar);
    sitInCar(pf.x, pf.z, pf.heading + Math.PI / 2);
    let fGap = Infinity;
    const ahead = (a: number, b: number) => { const d = (((b - a) % L.length) + L.length) % L.length; return d > L.length / 2 ? d - L.length : d; };
    run(12, () => { fGap = Math.min(fGap, ahead(car.u + FL.half, uCar)); });
    assert.ok(fGap > 0.5, `the streetcar's front came within ${fGap.toFixed(2)} u of the player's car`);
    onFoot();
    run(10);

    // --- a cable car: the car across its track 14 u past its nose
    const cc = layer.sys.cars.find(c => c.mode === 'run' && Math.abs(c.v) > 2 && !c.parked) ?? (run(40), layer.sys.cars.find(c => c.mode === 'run' && Math.abs(c.v) > 1 && !c.parked));
    assert.ok(cc, 'a cable car on the move');
    const half = 4.4;
    const sC = cc.s + cc.dir * (half + 14);
    const pc = T.pointAt(cc.line, sC);
    sitInCar(pc.x, pc.z, 0);
    let cGap = Infinity;
    run(12, () => { cGap = Math.min(cGap, (sC - (cc.s + cc.dir * half)) * cc.dir); });
    assert.ok(cGap > 0.5, `the cable car's nose came within ${cGap.toFixed(2)} u of the player's car`);
  } finally {
    onFoot();
    layer.dispose?.();
    T.setActiveLineFleet(null);
  }
});

test('W6-B3 the M no longer stops at San Jose & Mt Vernon (SFMTA: a permanent removal from 28 Sep 2024): gone from the published files and their props; an older file carrying it is filtered; riders use San Jose & Niagara / Geneva', () => {
  for (const f of ['transit.json', 'transit-w4.json']) {
    const file = JSON.parse(fs.readFileSync(path.join(PUB, f), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson & { props?: Record<string, unknown> };
    const m = file.lines.find(l => l.id === 'm-ocean-view')!;
    const ids = m.stops.map(s => s.id);
    assert.ok(!ids.includes('muni-san-jose-mt-vernon'), `${f}: the retired stop is still there`);
    assert.ok(ids.includes('muni-san-jose-niagara') && ids.includes('muni-san-jose-geneva'), `${f}: the stops riders use instead`);
    assert.ok(!('muni-san-jose-mt-vernon' in (file.props ?? {})), `${f}: its pole is still placed`);
  }
  assert.ok(T.RETIRED_STOPS.has('muni-san-jose-mt-vernon'));
  // an older transit file (the stop still in it) loses it when built
  const old = JSON.parse(JSON.stringify(FILE)) as typeof FILE;
  const m = old.lines.find(l => l.id === 'm-ocean-view')!;
  m.stops.splice(m.stops.findIndex(s => s.id === 'muni-san-jose-niagara'), 0, { ...m.stops.find(s => s.id === 'muni-san-jose-niagara')!, id: 'muni-san-jose-mt-vernon' });
  const w4 = T.buildTransitW4(old)!;
  assert.ok(!w4.metro.find(l => l.id === 'm-ocean-view')!.stops.some(s => s.id === 'muni-san-jose-mt-vernon'));
  assert.equal(w4.metro.find(l => l.id === 'm-ocean-view')!.stops.length, m.stops.length - 1);
});

test('W6-B5 every cable-car station has a Chinese name in zh (the zh map said "California & Van Ness"); the English stays the short street pair', () => {
  const cvn = DATA.stations.find(s => s.name.en === 'California & Van Ness')!;
  assert.equal(cvn.name.zh, '加州街 · 范尼斯大道');
  assert.equal(DATA.stations.find(s => s.name.en === 'Powell & Market')!.name.zh, '鲍威尔街 · 市场街');
  assert.equal(DATA.stations.find(s => s.name.en === 'Hyde & Beach')!.name.zh, '海德街 · 海滩街');
  const latin = DATA.stations.filter(s => /[A-Za-z]/.test(s.name.zh)).map(s => s.name.en);
  assert.deepEqual(latin, [], 'no English left in a zh station name');
  for (const s of DATA.stations) assert.ok(!/[一-龥]/.test(s.name.en), `${s.id}: the English name stays English`);
  // an unknown street keeps the whole short English name, never half and half
  assert.equal(T.stationZh('Powell Street & Nowhere Street'), 'Powell & Nowhere');
});

test('W6-B6 ferry:sausalito — the Sausalito route is data for a later boat (running: false): no quay of it is offered, found or swept (the W5 sweep\'s OFF target is waived by name)', () => {
  const route = T.FERRY_ROUTES.find(r => r.id === 'ferry-sausalito')!;
  assert.equal(route.running, false);
  assert.equal(T.ferryTerminal('sausalito'), null, 'no ride goes there');
  assert.ok(T.ferryTerminal('ferry-building') && T.ferryTerminal('pier-41'));
  const sweep = fs.readFileSync(path.resolve(import.meta.dirname, '../scripts/opus-sf/qa/sweep-static.mts'), 'utf8');
  assert.match(sweep, /for \(const r of FERRY_ROUTES\) if \(r\.running\) for \(const t of r\.terminals\)/, 'the static sweep takes the running routes\' quays only');
});
