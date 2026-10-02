import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * The rideable ferry (lane F, wave 3, F8): the route table (data/ferry.ts), the loop over water with 3 u clearance
 * (district water grid + the published city), the pure ferry system (world/ferry.ts) and the ride Ferry Building →
 * Pier 41 through game/transit.ts, the open sun deck platform.
 */

// --- headless canvas stub (world modules create label atlases at import time) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

// (W9-P6) the line builder moved to data/ferryLine.ts (out of GameRoot's first load)
const D = { ...(await import('../src/opus-bay/data/ferry')), ...(await import('../src/opus-bay/data/ferryLine')) };
const T = await import('../src/opus-bay/data/transit');
const { FerrySystem, FERRY_ID, FERRY_PLATFORM } = await import('../src/opus-bay/world/ferry');
const { game } = await import('../src/opus-bay/core/store');
const { onEvent } = await import('../src/opus-bay/core/events');
const { flow } = await import('../src/opus-bay/game/flowStore');
const transit = await import('../src/opus-bay/game/transit');
const ride = await import('../src/opus-bay/game/ride');
const { FERRY } = D;
const DT = 1 / 30;
const ROUTE = D.FERRY_ROUTES.find(r => r.running)!;
const LINE = D.buildFerryLine(ROUTE);

test('routes: Ferry Building ⇄ Pier 41 runs; Sausalito is in the table as data; the loop passes both berths', () => {
  assert.deepEqual(ROUTE.terminals.map(t => t.id), ['ferry-building', 'pier-41']);
  for (const t of ROUTE.terminals) assert.ok(/^[a-z0-9-]{1,64}$/.test(t.id));
  const sau = D.FERRY_ROUTES.find(r => r.id === 'ferry-sausalito');
  assert.ok(sau && !sau.running && sau.terminals.some(t => t.id === 'sausalito'), 'Sausalito as data');
  assert.equal(LINE.stops.length, 2);
  for (const st of LINE.stops) {
    const t = ROUTE.terminals.find(x => x.id === st.terminal)!;
    const p = D.ferryPoint(LINE, st.u);
    assert.ok(Math.hypot(p.x - t.berth.x, p.z - t.berth.z) < 0.6, `${t.id} berth on the loop`);
  }
  assert.ok(LINE.length > 800 && LINE.length < 1500, `loop ${LINE.length.toFixed(0)} u`);
  assert.equal(D.ferryTerminal('pier-41')?.route.id, 'ferry');
  assert.equal(D.ferryTerminal('sausalito'), null, 'not running yet');
});

test('the loop stays over water: ≥ 3 u from land everywhere but the berth approaches, open water ≥ 3 u round the hull', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { isLand, isWater, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  for (let u = 0; u < LINE.length; u += 40) { const p = D.ferryPoint(LINE, u); await sf.attachAround(city, p.x, p.z, 30, lms); }
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    /** does any point of the hull outline grown by c touch `bad`? */
    const ring = (u: number, c: number, bad: (x: number, z: number) => boolean) => {
      const p = D.ferryPoint(LINE, u), fx = Math.sin(p.heading), fz = Math.cos(p.heading), reach = FERRY.beam / 2 + c, half = FERRY.length / 2 + c;
      for (let a = -half; a <= half; a += 0.5) for (const s of [-reach, reach]) if (bad(p.x + fx * a + fz * s, p.z + fz * a - fx * s)) return true;
      for (let s = -reach; s <= reach; s += 0.5) for (const a of [-half, half]) if (bad(p.x + fx * a + fz * s, p.z + fz * a - fx * s)) return true;
      return false;
    };
    const berthD = (u: number) => Math.min(...LINE.stops.map(s => Math.min(Math.abs(u - s.u), LINE.length - Math.abs(u - s.u))));
    const gate = LINE.stops.find(s => s.terminal === 'ferry-building')!.u;
    let checked = 0;
    for (let u = 0; u < LINE.length; u += 0.5) {
      const bd = berthD(u);
      const atGate = Math.min(Math.abs(u - gate), LINE.length - Math.abs(u - gate)) < 8; // the district's own Gate E berth
      if (atGate) continue;
      if (bd > 30) assert.ok(!ring(u, 3, isLand), `land within 3 u at u ${u}`);
      else assert.ok(!ring(u, 1, isLand), `land within 1 u of the berth approach at u ${u}`);
      if (bd > 40) assert.ok(!ring(u, 3, (x, z) => !isWater(x, z)), `not open water within 3 u at u ${u}`);
      checked++;
    }
    assert.ok(checked > 1500);
  } finally { setCityTerrain(null); }
});

test('verify D2: the Pier 41 quay stands on walkable ground joined to the city (the Pier 45 shed deck was a walled pocket); the berth lies beside it', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  const q = D.ferryTerminal('pier-41')!.terminal;
  await sf.attachAround(city, q.quay.x, q.quay.z, 170, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    assert.ok(canStand(q.quay.x, q.quay.z, 0.45), 'the Pier 41 quay is walkable');
    assert.ok(Math.hypot(q.quay.x - q.berth.x, q.quay.z - q.berth.z) < 12, 'the boat lies beside the quay');
    // flood the walkable ground from the quay (0.75 u steps within 150 u): the old landing's region was 605 cells
    const step = 0.75, R = 150, seen = new Set<number>(), key = (i: number, j: number) => (i + 1000) * 4000 + (j + 1000);
    const stack: [number, number][] = [[0, 0]];
    seen.add(key(0, 0));
    let n = 0, far = 0;
    while (stack.length) {
      const [i, j] = stack.pop()!;
      n++;
      far = Math.max(far, Math.hypot(i * step, j * step));
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        const k = key(a, b);
        if (seen.has(k) || Math.abs(a * step) > R || Math.abs(b * step) > R) continue;
        seen.add(k);
        if (canStand(q.quay.x + a * step, q.quay.z + b * step, 0.45)) stack.push([a, b]);
      }
    }
    assert.ok(n > 10000 && far > 140, `walkable region from the quay: ${n} cells, reaching ${far.toFixed(0)} u`);
  } finally { setCityTerrain(null); }
});

test('ferry: starts at Gate E, runs 9 u/s, slows into both berths, turns round quickly for a waiting rider', () => {
  const sys = new FerrySystem(LINE);
  assert.equal(LINE.stops[sys.boat.at].terminal, 'ferry-building');
  let vmax = 0;
  const arrivals: string[] = [];
  for (let i = 0; i < 30 * 600; i++) {
    sys.step(DT);
    vmax = Math.max(vmax, sys.boat.v);
    for (const e of sys.events) if (e.what === 'arrive' && e.station) arrivals.push(e.station);
    sys.events.length = 0;
  }
  assert.ok(vmax <= FERRY.speed + 1e-6 && vmax > FERRY.speed - 0.5, `top speed ${vmax.toFixed(2)}`);
  assert.ok(arrivals.length >= 6, `${arrivals.length} arrivals in 10 min`);
  for (let i = 1; i < arrivals.length; i++) assert.notEqual(arrivals[i], arrivals[i - 1], 'alternates between the terminals');
  // at the berth it moves at slow ahead
  const berthU = LINE.stops[0].u;
  for (let d = 1; d < 4; d += 1) { const p = D.ferryPoint(LINE, berthU - d); assert.ok(LINE.vlim[p.i] <= FERRY.berthSpeed + 1, 'slow ahead into the berth'); }
});

test('ride: Gate E → Pier 41 on the open sun deck; it counts once; the label and the deck', () => {
  const sys = new FerrySystem(LINE);
  T.setActiveFerrySystem(sys);
  const events: string[] = [];
  const off = onEvent(e => { if (e.type === 'transit' && e.kind === 'ferry') events.push(`${e.what}${e.real ? ':real' : ''}`); });
  try {
    game.set({ phase: 'playing', worldMode: 'city' });
    const items = transit.transitInteractables();
    assert.deepEqual(items.filter(it => it.refId === 'ferry-building' || it.refId === 'pier-41').map(it => it.refId).sort(), ['ferry-building', 'pier-41']);
    transit.rideFerry('ferry-building', 'pier-41');
    assert.deepEqual(game.get().move, { mode: 'transit', line: FERRY_ID, spot: 'deck' });
    assert.equal(flow.get().ride?.kind, 'ferry');
    const label = transit.rideLabel({ stage: 'waiting', from: 'ferry-building', to: 'pier-41', line: FERRY_ID, kind: 'ferry' });
    assert.equal(label.icon, 'ferry');
    assert.equal(label.dest?.en, 'Pier 41');
    let t = 0;
    const step = (n: number, until?: () => boolean) => { for (let i = 0; i < n; i++) { sys.step(DT); transit.stepTransit(DT); t += DT; if (until?.()) return true; } return false; };
    assert.ok(step(30 * 30, () => ride.currentRide()?.mode === 'follow'), 'boards at Gate E');
    t = 0;
    assert.ok(step(30 * 300, () => ride.currentRide() === null), 'arrives at Pier 41');
    assert.ok(t < 150, `Gate E → Pier 41 in ${t.toFixed(0)} s`);
    assert.equal(transit.rideLog()[FERRY_ID], 1);
    assert.ok(game.get().goalsDone.includes('ferry'));
    assert.equal(events.filter(e => e === 'ride:real').length, 1);
    assert.equal(game.get().move.mode, 'foot');
  } finally {
    off();
    T.setActiveFerrySystem(null);
    ride.endRide();
    game.set({ riding: null, worldMode: 'district' });
    flow.set({ ride: null });
  }
  // the platform: the open sun deck (planks at y 2.0–2.04 in world/life.ts ferryGeometry(…, true)), inside the rails
  assert.equal(FERRY_PLATFORM.kind, 'ferry');
  assert.ok(Math.abs(FERRY_PLATFORM.floor - 2.05) < 0.02);
  const d = FERRY_PLATFORM.decks[0];
  assert.ok(d.minX > -1.82 && d.maxX < 1.82 && d.minZ > -4.4 && d.maxZ < 1.5, 'inside the railings, behind the wheelhouse');
});

test('review: a waiting rider stays on the quay; leaving the ferry out on the Bay puts the rider on the next quay', async () => {
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const { canStand } = await import('../src/opus-bay/core/terrain');
  const { teleportPlayer } = await import('../src/opus-bay/game/flow');
  const sys = new FerrySystem(LINE);
  T.setActiveFerrySystem(sys);
  const p = runtime.player;
  try {
    game.set({ phase: 'playing', worldMode: 'city' });
    const step = (n: number, until: () => boolean) => { for (let i = 0; i < n; i++) { sys.step(DT); transit.stepTransit(DT); if (until()) return true; } return false; };
    // (1) waiting at Pier 41 while the boat lies at Gate E: a hop-off from outside (a trip starting) leaves the rider there
    // (it used to send them to the terminal the boat lay at)
    transit.rideFerry('pier-41', 'ferry-building');
    assert.equal(ride.currentRide()?.mode, 'wait');
    const quay41 = D.ferryTerminal('pier-41')!.terminal.quay;
    teleportPlayer(quay41);
    transit.hopOffRide();
    assert.equal(ride.currentRide(), null);
    assert.ok(Math.hypot(p.x - quay41.x, p.z - quay41.z) < 1e-6, `not sent to a terminal (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
    // (2) Pier 41 → Gate E, the ride ended far out on the Bay (u 800–860: nothing walkable within 60 u there): E2's
    // alight keeps F's spot (actors/moveSystem 'transit-alight'), so it must be solid ground on the next quay
    transit.rideFerry('pier-41', 'ferry-building');
    assert.ok(step(30 * 200, () => ride.currentRide()?.mode === 'follow'), 'boards at Pier 41');
    assert.ok(step(30 * 200, () => sys.boat.u > 800 && sys.boat.u < 860), 'out on the Bay');
    teleportPlayer({ x: sys.boat.pose.x, z: sys.boat.pose.z });
    transit.hopOffRide();
    assert.ok(canStand(p.x, p.z, 0.45), 'on solid ground');
    const gate = D.ferryTerminal('ferry-building')!.terminal.quay;
    assert.ok(Math.hypot(p.x - gate.x, p.z - gate.z) < 17, `on the Gate E quay (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
  } finally {
    T.setActiveFerrySystem(null);
    ride.endRide();
    game.set({ riding: null, worldMode: 'district' });
    flow.set({ ride: null });
  }
});
