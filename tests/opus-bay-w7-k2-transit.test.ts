import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * W7-K2 · the transit never drives through the player's parked, empty ride nor through BAYBAY on foot (lane B's wave-6
 * requests to K1; docs/opus-bay/sf-w7-K.md part b). The ride is towed to the kerb (actors/vehicles/transitClear +
 * Fleet.tow); BAYBAY steps off the rails (actors/guide.ts setTransitAside). Played on lane F's CableSystem stepped in
 * node over the published city (the Powell–Hyde), the vehicles as world/transitLayer publishes them.
 */

// --- headless canvas stub (world modules create label atlases at import time), as tests/opus-bay-w6-k2-pause.test.ts
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const TD = await import('../src/opus-bay/data/transit');
const { CableSystem, setActiveCableSystem } = await import('../src/opus-bay/world/transitLine');
const T = await import('../src/opus-bay/core/terrain');
const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
const { sfDisk } = await import('./opus-bay-sf-disk');
const { Fleet } = await import('../src/opus-bay/actors/vehicles/fleet');
const { TERRAIN_WORLD, poseCheck } = await import('../src/opus-bay/actors/vehicles/collide');
const TC = await import('../src/opus-bay/actors/vehicles/transitClear');
const { centreLineDistance } = await import('../src/opus-bay/world/sf/streetNet');
type RoadVehicle = import('../src/opus-bay/world/sf/streetNet').RoadVehicle;

const FILE = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const DATA = TD.buildTransit(FILE);
const DT = 1 / 30;
const LINE = 'powell-hyde';
const sf = sfDisk();
const LMS = landmarkWalkInputs(SF_LANDMARKS);

/** the cable cars as world/transitLayer's roadVehicles publishes them */
function cableVehicles(sys: InstanceType<typeof CableSystem>): RoadVehicle[] {
  return sys.cars.filter(c => !c.parked).map(c => ({ x: c.pose.x, z: c.pose.z, heading: c.pose.heading, v: c.mode === 'turn' ? 0 : Math.abs(c.v), halfL: TD.CABLE.length / 2, halfW: TD.CABLE.width / 2, kind: 'cable-car' as const, line: c.line.id }));
}

/** A Powell–Hyde car's pose 12 s from now on a fresh system (the systems are deterministic): where to park across its rails. */
function aheadOfACar(): { car: number; x: number; z: number; heading: number } {
  const sys = new CableSystem(DATA);
  for (let i = 0; i < 60 / DT; i++) sys.step(DT);      // let the cars spread out and run
  const k = sys.cars.findIndex(c => c.line.id === LINE && !c.parked && c.v > 2);
  assert.ok(k >= 0, 'a running Powell–Hyde car');
  for (let i = 0; i < 12 / DT; i++) sys.step(DT);
  const p = sys.cars[k].pose;
  return { car: k, x: p.x, z: p.z, heading: p.heading };
}

async function cityAt(x: number, z: number) {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, x, z, 140, LMS);
  T.setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
}

test('W7-K2: a cable car coming at the player\'s parked, empty toy car tows it to the kerb (a hop, parallel to the rails) instead of driving through it', async t => {
  TD.setTransitData(DATA);
  const spot = aheadOfACar();
  await cityAt(spot.x, spot.z);
  try {
    const run = (tow: boolean) => {
      const sys = new CableSystem(DATA);
      setActiveCableSystem(sys);
      for (let i = 0; i < 60 / DT; i++) sys.step(DT);
      const fleet = new Fleet();
      const ride = fleet.add({ id: 'k2-test-car', kind: 'car', x: spot.x, z: spot.z, heading: spot.heading + Math.PI / 2, name: { zh: '玩具车', en: 'Toy car' } });
      ride.displaced = true;                       // the player drove it here and got out
      const car = sys.cars[spot.car];
      const start = { x: ride.sim.x, z: ride.sim.z };
      let minGap = Infinity, towedAt = -1;
      TC.resetTransitClear();
      for (let i = 0; i < 25 / DT; i++) {
        sys.step(DT);
        const list = cableVehicles(sys);
        if (tow && TC.clearTransitPaths(fleet, DT, list) && towedAt < 0) towedAt = i * DT;
        fleet.idle(ride, DT, { x: 9999, z: 9999 }, true);
        // the car's body vs the ride (after its hop): centre-line distance less the two half widths
        const q = list.find(v => Math.hypot(v.x - car.pose.x, v.z - car.pose.z) < 0.01)!;
        if (!ride.tow) minGap = Math.min(minGap, centreLineDistance(ride.sim.x, ride.sim.z, q) - q.halfW - ride.width / 2);
      }
      return { ride, start, minGap, towedAt };
    };
    const before = run(false);
    assert.ok(before.minGap < 0, `control: without the tow the cable car's body goes over the parked car (gap ${before.minGap.toFixed(2)})`);
    const after = run(true);
    assert.ok(after.towedAt >= 0, 'towed');
    assert.ok(after.minGap > 0.2, `the cable car passed beside it (gap ${after.minGap.toFixed(2)} u)`);
    const moved = Math.hypot(after.ride.sim.x - after.start.x, after.ride.sim.z - after.start.z);
    assert.ok(moved > 1 && moved < 9, `hopped to the kerb (${moved.toFixed(2)} u)`);
    assert.ok(poseCheck(TERRAIN_WORLD, after.ride.sim.spec, after.ride.sim.x, after.ride.sim.z, after.ride.sim.heading).ok, 'where it stands fits');
    assert.equal(after.ride.hopY ?? 0, 0, 'landed');
    // parallel to the rails (either way round)
    const d = Math.abs(Math.sin(after.ride.sim.heading - spot.heading));
    t.diagnostic(`control gap ${before.minGap.toFixed(2)} u · towed at ${after.towedAt.toFixed(1)} s · moved ${moved.toFixed(2)} u · gap after ${after.minGap.toFixed(2)} u`);
    assert.ok(d < 0.2, `parallel to the car (${d.toFixed(2)})`);
  } finally { T.setCityTerrain(null); setActiveCableSystem(null as never); }
});

test('W7-K2: the tow leaves an occupied ride, a ride at its own spot and one out of reach alone; a far vehicle waits until it is within TOW_REACH', () => {
  const fleet = new Fleet();
  const ride = fleet.rides.find(r => r.kind === 'car')!;
  const q = (dx: number): RoadVehicle => ({ x: ride.sim.x - Math.sin(ride.sim.heading) * dx, z: ride.sim.z - Math.cos(ride.sim.heading) * dx, heading: ride.sim.heading, v: 4, halfL: 2.7, halfW: 1, kind: 'cable-car', line: LINE });
  let tows = 0;
  const f = fleet as unknown as { tow: (...a: unknown[]) => void };
  const real = f.tow.bind(fleet);
  f.tow = (...a: unknown[]) => { tows++; real(...a); };
  const check = (list: RoadVehicle[]) => { TC.resetTransitClear(); TC.clearTransitPaths(fleet, 0.01, list); };
  ride.displaced = false;
  check([q(6)]);
  assert.equal(tows, 0, 'at its own spot (never driven off): left');
  ride.displaced = true; ride.occupied = true;
  check([q(6)]);
  assert.equal(tows, 0, 'occupied: the transit stops for the player (roadViewer), no tow');
  ride.occupied = false;
  check([q(30)]);
  assert.equal(tows, 0, 'a car 30 u off at 4 u/s: not yet (reach 10 + 4 · LEAD_S)');
  check([{ ...q(6), kind: 'traffic' }, { ...q(6), kind: 'player' }]);
  assert.equal(tows, 0, 'the toy traffic and the player\'s own ride never tow');
  // (the district's toy car spot is on the plaza: a tow finds room beside the "rails" or finds nothing — either is fine)
  check([q(6)]);
  assert.ok(tows <= 1);
});

test('W7-K2: BAYBAY on foot steps off the rails when a transit vehicle comes at her — to her side of it, beyond its body — and not for traffic or one going away', async () => {
  const { GuideMover, setTransitAside } = await import('../src/opus-bay/actors/guide');
  const { runtime } = await import('../src/opus-bay/core/runtime');
  // the district plaza (walkable): a pretend cable car coming down the promenade at her
  const G = runtime.guide, P = runtime.player;
  const ferry = { x: -2, z: 8 };
  const spot = T.nearestWalkable(ferry, 10)!;
  let list: RoadVehicle[] = [];
  setTransitAside((x, z) => TC.guideAside(x, z, list));
  try {
    const mover = new GuideMover();
    mover.place();
    G.x = spot.x; G.z = spot.z; G.y = T.heightAt(spot.x, spot.z); G.state = 'follow'; G.target = null;
    P.x = spot.x + 3; P.z = spot.z; P.y = G.y;
    const heading = 0;
    const car = (dz: number): RoadVehicle => ({ x: G.x, z: G.z - dz, heading, v: 5, halfL: 2.7, halfW: 1, kind: 'cable-car', line: LINE });
    // going away (she is behind it): nothing
    list = [{ ...car(-8), heading: 0 }];
    list[0].z = G.z + 8;
    const x0 = G.x, z0 = G.z;
    for (let i = 0; i < 10; i++) mover.step(DT, i * DT, { playing: true, riding: false });
    assert.equal(mover.asides, 0, 'a car going away: she stays');
    // the toy traffic: nothing (it waits for people itself)
    list = [{ ...car(8), kind: 'traffic' }];
    for (let i = 10; i < 20; i++) mover.step(DT, i * DT, { playing: true, riding: false });
    assert.equal(mover.asides, 0, 'traffic: she stays');
    // a cable car 8 u off, coming at her: she steps aside, out of its path, within a second
    G.x = x0; G.z = z0;
    list = [car(8)];
    let t = 1;
    for (let i = 0; i < 40; i++, t += DT) mover.step(DT, t, { playing: true, riding: false });
    assert.ok(mover.asides >= 1, 'stepped aside');
    assert.equal(TC.pathSide(list[0], G.x, G.z, 0.42, TC.ASIDE_REACH + 5 * TC.LEAD_S), 0, `out of its path (${(G.x - list[0].x).toFixed(2)} u to the side)`);
    assert.ok(Math.abs(G.x - list[0].x) < 3.5, 'just beside it, not far off');
    // riding (the player in a vehicle, BAYBAY in her seat): never
    const n = mover.asides;
    G.x = x0; G.z = z0;
    for (let i = 0; i < 10; i++, t += DT) mover.step(DT, t, { playing: true, riding: true });
    assert.equal(mover.asides, n, 'riding: no step');
  } finally { setTransitAside(null); }
});
