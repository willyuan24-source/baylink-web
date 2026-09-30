import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * W7-K-review (docs/opus-bay/sf-w7-K.md, Review): lane K's transit clearing (actors/vehicles/transitClear.ts, guide.ts
 * setTransitAside, Fleet.tow) under the cases the lane's tests left out —
 * 1. a transit vehicle standing still (waiting for the player in front of it) is not "coming at" BAYBAY, and after a
 *    step aside she waits beside the rails until the vehicle has passed (before: her follow / framing spot lay on the
 *    rails — she walked back in and dashed off again, over and over);
 * 2. she never steps from one track onto the other in front of a car coming the other way;
 * 3. the player getting in during a tow's hop ends the tow (before: idle() never runs for a carried ride — the car was
 *    driven floating at the hop's height and, parked again, snapped back onto the old tow path);
 * 4. the aside hook lives with the city ride pool (set by register(), cleared by dispose()), so a second pool in the
 *    same page (the game left and entered again) still has it.
 */

// --- headless canvas stub (world modules create label atlases at import time), as tests/opus-bay-w7-k2-transit.test.ts
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const T = await import('../src/opus-bay/core/terrain');
const TC = await import('../src/opus-bay/actors/vehicles/transitClear');
const { GuideMover, setTransitAside } = await import('../src/opus-bay/actors/guide');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { Fleet } = await import('../src/opus-bay/actors/vehicles/fleet');
const { TERRAIN_WORLD } = await import('../src/opus-bay/actors/vehicles/collide');
const { registerRoadVehicles } = await import('../src/opus-bay/world/sf/streetNet');
type RoadVehicle = import('../src/opus-bay/world/sf/streetNet').RoadVehicle;

const DT = 1 / 30;
const car = (x: number, z: number, v: number, heading = 0): RoadVehicle => ({ x, z, heading, v, halfL: 2.7, halfW: 1.2, kind: 'cable-car', line: 'k-review' });

/** BAYBAY beside the player on the district plaza (walkable), the camera at `yaw`. */
function stage(yaw: number, lateral: number) {
  const G = runtime.guide, P = runtime.player;
  const spot = T.nearestWalkable({ x: -2, z: 8 }, 10)!;
  const mover = new GuideMover();
  mover.place();
  P.x = spot.x; P.z = spot.z; P.y = T.heightAt(spot.x, spot.z); P.moving = false;
  G.x = spot.x + lateral; G.z = spot.z - 1.5; G.y = P.y; G.state = 'follow'; G.target = null;
  runtime.camera.yaw = yaw;
  return { mover, P, G };
}

test('W7-K-review: a car standing still in front of the player (waiting for them) never sends BAYBAY off and back on the rails', () => {
  let list: RoadVehicle[] = [];
  setTransitAside((x, z) => TC.guideAside(x, z, list));
  try {
    const out: string[] = [];
    for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      for (const lateral of [0.6, -0.6, 1.5]) {
        const { mover, P } = stage(yaw, lateral);
        // heading +z, stopped 3 u short of the player (the transit's stop for the player: world/sf/roadViewer)
        list = [car(P.x, P.z - 3 - 2.7, 0)];
        let t = 1;
        for (let i = 0; i < 12 / DT; i++, t += DT) mover.step(DT, t, { playing: true, riding: false });
        out.push(`yaw ${yaw.toFixed(2)} lat ${lateral}: ${mover.asides}`);
        assert.ok(mover.asides <= 1, `a waiting car: ${mover.asides} steps aside in 12 s (${out.join('; ')})`);
      }
    }
  } finally { setTransitAside(null); }
});

test('W7-K-review: after a step aside BAYBAY waits beside the rails until the car has passed — one step, not a dance', () => {
  let list: RoadVehicle[] = [];
  setTransitAside((x, z) => TC.guideAside(x, z, list));
  try {
    const out: string[] = [];
    let worst = 0;
    for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      for (const lateral of [0.6, -0.6]) {
        const { mover, P, G } = stage(yaw, lateral);
        // a slow car (1.5 u/s) comes up the rails past the player, who stands on the centre line (a car that does not
        // stop: the list is fixed data here)
        const q = car(P.x, P.z - 25, 1.5);
        list = [q];
        let t = 1, inside = 0;
        for (let i = 0; i < 40 / DT; i++, t += DT) {
          q.z += q.v * DT;
          mover.step(DT, t, { playing: true, riding: false });
          // her disc against the car's body (a hit: the car drove through her)
          if (TC.pathSide(q, G.x, G.z, 0.42, 0) !== 0 && !mover.dashing) inside++;
        }
        assert.ok(q.z - q.halfL > P.z + 3, 'the car has passed');
        out.push(`yaw ${yaw.toFixed(2)} lat ${lateral}: ${mover.asides} asides, ${inside} frames under the car`);
        worst = Math.max(worst, mover.asides);
        assert.equal(inside, 0, `the car's body never went over her (${out.join('; ')})`);
      }
    }
    assert.ok(worst <= 2, `at most two steps aside while one slow car passed (${out.join('; ')})`);
  } finally { setTransitAside(null); }
});

test('W7-K-review: she steps to the side of the track that has no car coming the other way', () => {
  const spot = T.nearestWalkable({ x: -2, z: 8 }, 10)!;
  // two tracks 3.2 u apart: an up car on x0 coming at her, a down car on x0 + 3.2 coming the other way
  const x0 = spot.x;
  const up = car(x0, spot.z - 10, 5, 0), down = car(x0 + 3.2, spot.z + 10, 5, Math.PI);
  // she stands just right of the up track's centre line (toward the down track)
  const to = TC.guideAside(x0 + 0.3, spot.z, [up, down]);
  assert.ok(to, 'somewhere to go');
  assert.equal(TC.pathSide(down, to.x, to.z, 0.42, TC.ASIDE_REACH + 5 * TC.LEAD_S), 0, `not onto the down track (to x ${(to.x - x0).toFixed(2)})`);
  assert.equal(TC.pathSide(up, to.x, to.z, 0.42, TC.ASIDE_REACH + 5 * TC.LEAD_S), 0, 'off the up track');
});

test('W7-K-review: getting in during a tow\'s hop ends the tow — no floating drive, no snap back when parked again', () => {
  const fleet = new Fleet();
  const ride = fleet.rides.find(r => r.kind === 'car')!;
  const x0 = ride.sim.x, z0 = ride.sim.z;
  ride.displaced = true;
  fleet.tow(ride, x0 + 3, z0, ride.sim.heading);
  for (let i = 0; i < 6; i++) { fleet.idle(ride, DT, { x: 9999, z: 9999 }, true); fleet.pose(ride, DT); }
  assert.ok(ride.tow && (ride.hopY ?? 0) > 0.1, 'mid-hop');
  // the player gets in (moveSystem.tryEnter: occupied; a carried ride is posed every frame, idle() skips it)
  ride.occupied = true;
  fleet.pose(ride, DT);
  assert.equal(ride.tow ?? null, null, 'the tow ended');
  assert.equal(ride.hopY ?? 0, 0, 'no hop height left');
  assert.ok(Math.abs(ride.rig.mesh.position.y - ride.sim.y) < 1e-6, 'drawn on its wheels');
  // driven on and parked: idle leaves it where it stands
  const nx = ride.sim.x + 1, nz = ride.sim.z + 1;
  ride.sim.place(nx, nz, ride.sim.heading, TERRAIN_WORLD);
  ride.occupied = false;
  for (let i = 0; i < 30; i++) fleet.idle(ride, DT, { x: 9999, z: 9999 }, true);
  const moved = Math.hypot(ride.sim.x - nx, ride.sim.z - nz);
  assert.ok(moved < 0.05, `parked where it was left (moved ${moved.toFixed(2)} u)`);
});

test('W7-K-review: a second city ride pool in the same page still has BAYBAY step aside (the hook is set by register(), cleared by dispose())', async () => {
  const { CityBikePool } = await import('../src/opus-bay/actors/vehicles/cityBikes');
  const fleet = new Fleet();
  const a = new CityBikePool(fleet);
  a.register();
  a.dispose();                                  // the game left (actors/moveSystem.ts dispose)
  const b = new CityBikePool(fleet);            // and entered again: the module is cached, its top level does not re-run
  b.register();
  const { mover, G } = stage(0, 0.6);
  const q = car(G.x, G.z - 8, 5);
  const off = registerRoadVehicles(out => { out.push(q); });
  try {
    let t = 1;
    for (let i = 0; i < 30; i++, t += DT) mover.step(DT, t, { playing: true, riding: false });
    assert.ok(mover.asides >= 1, 'she stepped aside');
  } finally { off(); b.dispose(); }
});
