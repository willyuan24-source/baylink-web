/**
 * Lane F city life (tests/opus-bay-sf-life.test.ts): F13 the hero-life pause; F11 the crowd and F12 the toy traffic on
 * the published city (Union Square, real walking graph and terrain), their obstacle and road-vehicle hooks, budgets.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { Obstacle } from '../src/opus-bay/actors/controller';
import { createCityTerrain, landmarkWalkInputs } from '../src/opus-bay/core/sfTerrain';
import { game } from '../src/opus-bay/core/store';
import { canStand, cityChunkEpoch, heightAt, setCityTerrain, surfaceAt } from '../src/opus-bay/core/terrain';
import { Life, personGeometry } from '../src/opus-bay/world/life';
import { CROWD, CrowdSim, personFarGeometry, type Walker } from '../src/opus-bay/world/sf/crowd';
import { SF_LANDMARKS } from '../src/opus-bay/world/sf/landmarks/index';
import {
  type RoadVehicle, type StreetProbe, StreetNet, centreLineDistance, collectRoadVehicles, onTransitStreet, predictApproach, registerRoadVehicles, registerTransitStreet,
} from '../src/opus-bay/world/sf/streetNet';
import { TRAFFIC, TrafficSim, trafficCarFarGeometry, trafficCarGeometry } from '../src/opus-bay/world/sf/traffic';
import { sfDisk } from './opus-bay-sf-disk';

/** Triangles the visible meshes of a group would draw (instanced meshes × their live count). */
function visibleTriangles(root: THREE.Object3D): { tris: number; meshes: string[] } {
  let tris = 0;
  const meshes: string[] = [];
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (!p.visible) return;
    const g = m.geometry;
    const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    const inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
    tris += n * inst;
    meshes.push(m.name);
  });
  return { tris, meshes };
}

test('F13: far from the hero slab the district life hides and stops; ferry 0 and the beam keep going', () => {
  game.set({ phase: 'free' } as never);
  const life = new Life([{ x: -30, y: 12, z: -160, length: 60, speed: 0.9 }]);
  const halo: boolean[] = [];
  life.halos = { count: 12, set: (i, _x, _y, _z, on) => { halo[i] = on; } };
  let far = false;
  life.heroFarSource = () => far;
  for (let i = 0; i < 10; i++) life.update(0.1, i * 0.1, 1);
  const near = visibleTriangles(life.group);
  assert.ok(near.meshes.includes('pedestrians') && near.meshes.includes('gulls') && near.meshes.includes('ferry-1'));
  assert.equal(life.paused, false);

  far = true;
  const peopleBefore = life.group.getObjectByName('pedestrians') as THREE.InstancedMesh;
  const m0 = new THREE.Matrix4(), m1 = new THREE.Matrix4();
  peopleBefore.getMatrixAt(0, m0);
  const ferry0 = life.group.getObjectByName('ferry-0') as THREE.Mesh;
  const f0 = new THREE.Vector3().setFromMatrixPosition(ferry0.matrix);
  for (let i = 10; i < 400; i++) life.update(0.1, i * 0.1, 1);
  assert.equal(life.paused, true);
  const paused = visibleTriangles(life.group);
  // ferry 0 (the arrival / rideable ferry) and the Alcatraz beam only
  assert.deepEqual(paused.meshes.sort(), ['ferry-0', 'lighthouse-beam']);
  assert.ok(near.tris - paused.tris > 10_000, `saves ${near.tris - paused.tris} triangles (near ${near.tris}, far ${paused.tris})`);
  // the paused life does not move; ferry 0 keeps its dock / harbour loop
  peopleBefore.getMatrixAt(0, m1);
  assert.ok(m0.equals(m1), 'pedestrians frozen while paused');
  const f1 = new THREE.Vector3().setFromMatrixPosition(ferry0.matrix);
  assert.ok(f0.distanceTo(f1) > 1, `ferry 0 moved ${f0.distanceTo(f1).toFixed(1)} u`);
  // night lights: ferry 0's stay on, ferry 1's and the sailboats' go off
  assert.ok(halo.slice(0, 4).every(Boolean));
  assert.ok(halo.slice(4).every(on => on === false));
  // the water shows ferry 0's wake only
  assert.equal(life.wakes.filter(w => w.w > 0 || w.x !== 0).length <= 1, true);

  // back near: everything shows again and moves on
  far = false;
  for (let i = 400; i < 404; i++) life.update(0.1, i * 0.1, 1);
  assert.equal(life.paused, false);
  const again = visibleTriangles(life.group);
  assert.ok(again.meshes.includes('pedestrians') && again.meshes.includes('ferry-1') && again.meshes.includes('carousel'));
  peopleBefore.getMatrixAt(0, m1);
  assert.ok(!m0.equals(m1), 'pedestrians walk again');
});

test('F13: district mode never pauses (no streamer)', () => {
  const life = new Life([]);
  for (let i = 0; i < 5; i++) life.update(0.1, i * 0.1, 0);
  assert.equal(life.paused, false);
});

// ---------------------------------------------------------------------------------------------------------------------
// F11 crowd · F12 toy traffic (on the published city around Union Square)
// ---------------------------------------------------------------------------------------------------------------------

const sf = sfDisk();
const LMS = landmarkWalkInputs(SF_LANDMARKS);
/** Geary St by Union Square (the player's spot in the QA shots) */
const SPOT = { x: 78, z: 222 };
const probe: StreetProbe = { surface: surfaceAt, stand: canStand, height: heightAt, epoch: (x, z) => cityChunkEpoch(Math.floor(x / 128), Math.floor(z / 128)) };
const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

async function withCity<T>(fn: (net: StreetNet) => T | Promise<T>): Promise<T> {
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, SPOT.x, SPOT.z, 300, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try { return await fn(new StreetNet(await sf.graphIndex(), probe)); } finally { setCityTerrain(null); }
}

/** A follow camera 12 u behind the player (to the south), the transit layer's rough view cone. */
function cone(focus: { x: number; z: number }) {
  return (x: number, z: number) => {
    const cx = focus.x, cz = focus.z + 12, dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
    if (d > 170) return false;
    if (d < 25) return true;
    return (dx * (focus.x - cx) + dz * (focus.z - cz)) / (d * 12) > 0.25;
  };
}

test('F11 crowd: 64 walkers on the sidewalks round the player, on the roadway only to cross, most of them near', async () => {
  await withCity(net => {
    const focus = { ...SPOT };
    const crowd = new CrowdSim(net, { focus: () => focus, avoid: () => {}, visible: cone(focus), vehicles: () => [] }, { seed: 7 });
    const dt = 1 / 30;
    let samples = 0, standable = 0, onRoad = 0, roadWalking = 0, heightOff = 0, near = 0, ms = 0;
    for (let i = 0; i < 30 * 60; i++) {
      const t0 = performance.now();
      crowd.step(dt);
      ms += performance.now() - t0;
      if (i < 90 || i % 15) continue;
      for (const w of crowd.walkers) {
        if (!w.on) continue;
        samples++;
        const d = Math.hypot(w.x - focus.x, w.z - focus.z);
        assert.ok(d <= CROWD.radius + 14, `walker within the crowd radius (${d.toFixed(1)} u)`);
        if (d < 30) near++;
        if (canStand(w.x, w.z, 0.15)) standable++;
        if (surfaceAt(w.x, w.z) === 'road') { onRoad++; if (w.mode === 'walk' && w.hopT < 0) roadWalking++; }
        if (Math.abs(w.y - heightAt(w.x, w.z)) > 0.05) heightOff++;
      }
    }
    assert.equal(crowd.active, CROWD.count.high, 'the whole crowd is out');
    assert.ok(standable / samples > 0.93, `walkers on standable ground: ${(100 * standable / samples).toFixed(1)} %`);
    // downtown a walker crosses a street every block or so: about a fifth to a quarter of the time on the roadway
    assert.ok(onRoad / samples < 0.3, `on the roadway (crossing): ${(100 * onRoad / samples).toFixed(1)} %`);
    assert.ok(roadWalking / samples < 0.06, `walking along the roadway: ${(100 * roadWalking / samples).toFixed(1)} %`);
    assert.equal(heightOff, 0, 'walkers stand on the ground');
    assert.ok(near / samples > 0.3, `share within 30 u of the player: ${(100 * near / samples).toFixed(0)} %`);
    assert.ok(crowd.stats.crossings > 50, `corners crossed: ${crowd.stats.crossings}`);
    assert.ok(ms / (30 * 60) < 2, `step ${(ms / 1800).toFixed(3)} ms`);
    // a jump of the focus (fast travel) refills round the new spot
    focus.x += 150;
    for (let i = 0; i < 30 * 3; i++) crowd.step(dt);
    assert.equal(crowd.stats.refills, 2);
    for (const w of crowd.walkers) if (w.on) assert.ok(Math.hypot(w.x - focus.x, w.z - focus.z) <= CROWD.radius + 14);
    // night: fewer walkers
    const nightCrowd = new CrowdSim(net, { focus: () => focus, avoid: () => {}, visible: () => false, vehicles: () => [], night: () => 1 }, { seed: 3 });
    for (let i = 0; i < 30 * 4; i++) nightCrowd.step(dt);
    assert.equal(nightCrowd.active, Math.round(CROWD.count.high * CROWD.night));
  });
});

test('F11 crowd: sightseers on landmark plaza spots (lane D2) stand one to a spot, facing the sight', async () => {
  const { landmarkPlazaSpots } = await import('../src/opus-bay/world/sf/landmarks/context');
  const { sfLandmark } = await import('../src/opus-bay/world/sf/landmarks/index');
  const spots = landmarkPlazaSpots().filter(s => s.id === 'dragon-gate');
  assert.ok(spots.length >= 2, 'the Dragon Gate has plaza spots');
  const gate = sfLandmark('dragon-gate')!;
  await withCity(net => {
    const focus = { x: gate.x, z: gate.z + 10 };
    const crowd = new CrowdSim(net, {
      focus: () => focus, avoid: () => {}, visible: () => false, vehicles: () => [],
      standSpots: () => spots.map(s => ({ x: s.x, z: s.z, r: 0.6, exact: true, face: { x: gate.x, z: gate.z } })),
    }, { seed: 21 });
    for (let i = 0; i < 30 * 5; i++) crowd.step(1 / 30);
    const standers = crowd.walkers.filter(w => w.on && w.mode === 'stand');
    assert.ok(standers.length >= 1, `standers ${standers.length}`);
    for (const w of standers) {
      assert.ok(spots.some(p => Math.hypot(p.x - w.x, p.z - w.z) <= 0.61), 'on a plaza spot');
      const toGate = Math.atan2(gate.x - w.x, gate.z - w.z), off = Math.abs(Math.atan2(Math.sin(w.face - toGate), Math.cos(w.face - toGate)));
      assert.ok(off <= 0.61, `facing the gate (${off.toFixed(2)} rad off)`);
    }
    for (const s of spots) assert.ok(standers.filter(w => Math.abs(w.x - s.x) < 1 && Math.abs(w.z - s.z) < 1).length <= 1, 'one to a spot');
  });
});

test('F11 crowd: a vehicle about to reach a walker makes them hop aside off its path; a passing car does not', async () => {
  await withCity(net => {
    const focus = { ...SPOT };
    let vehicles: RoadVehicle[] = [];
    const hops: { w: Walker; q: RoadVehicle }[] = [];
    const crowd = new CrowdSim(net, { focus: () => focus, avoid: () => {}, visible: () => false, vehicles: () => vehicles, onHop: (w, q) => hops.push({ w, q }) }, { seed: 11 });
    for (let i = 0; i < 60; i++) crowd.step(1 / 30);
    // aim a cable car at a walker: from 12 u away, 9 u/s, straight at them
    const w = crowd.walkers.find(x => x.on && x.mode === 'walk')!;
    w.v = 0.01;
    const heading = 0.7, q: RoadVehicle = { x: w.x - Math.sin(heading) * 12, z: w.z - Math.cos(heading) * 12, heading, v: 9, halfL: 2.8, halfW: 1, kind: 'cable-car', line: 'powell-hyde' };
    vehicles = [q];
    const x0 = w.x, z0 = w.z;
    let minClear = Infinity;
    for (let i = 0; i < 60; i++) {
      q.x += Math.sin(heading) * q.v / 30; q.z += Math.cos(heading) * q.v / 30;
      crowd.step(1 / 30);
      if (w.on) minClear = Math.min(minClear, centreLineDistance(w.x, w.z, q) - q.halfW);
    }
    assert.ok(hops.some(h => h.w === w && h.q === q), 'the walker hopped for the cable car');
    assert.ok(Math.hypot(w.x - x0, w.z - z0) > 0.8, 'moved aside');
    assert.ok(minClear > 0, `never under the car (clearance ${minClear.toFixed(2)} u)`);
    // a car driving along the street past a sidewalk walker (parallel, 1.6 u from its centre line) is no threat
    const v = crowd.walkers.find(x => x.on && x.mode === 'walk' && x !== w && x.hopT < 0 && x.hopCool <= 0)!;
    const hd = v.heading, nx = Math.cos(hd), nz = -Math.sin(hd);
    const car: RoadVehicle = { x: v.x - Math.sin(hd) * 10 + nx * 1.6, z: v.z - Math.cos(hd) * 10 + nz * 1.6, heading: hd, v: 8, halfL: 1.05, halfW: 0.54, kind: 'traffic', line: 'traffic' };
    assert.ok(predictApproach(v.x, v.z, Math.sin(hd) * v.v, Math.cos(hd) * v.v, car, 3).d > 1.2, 'the parallel approach stays wide');
    const hopsOfV = () => hops.filter(h => h.w === v).length;
    const before = hopsOfV();
    vehicles = [car];
    v.v = 0.01;
    for (let i = 0; i < 45; i++) { car.x += Math.sin(hd) * 8 / 30; car.z += Math.cos(hd) * 8 / 30; crowd.step(1 / 30); }
    assert.equal(hopsOfV(), before, 'no hop for a car passing by');
    // walkers are soft obstacles ('crowd': a vehicle stops with a "whoa")
    const u = crowd.walkers.find(x => x.on && x.grow >= 0.5)!;
    const out: Obstacle[] = [];
    crowd.obstacles(out, u.x, u.z, 3);
    assert.ok(out.some(o => o.kind === 'crowd' && Math.hypot(o.x - u.x, o.z - u.z) < 1e-6 && o.r === CROWD.r));
  });
});

test('F12 traffic: 24 toy cars on the right-hand lane of real streets, queues 4 u apart, one car per junction, none along transit', async () => {
  await withCity(net => {
    const focus = { ...SPOT };
    // Powell St carries the cable cars: the traffic keeps off it
    const offTransit = registerTransitStreet([96.5, 0, 150, 96.5, 0, 330]);
    try {
      assert.ok(onTransitStreet(96.5, 240, 0, 1) && !onTransitStreet(96.5, 240, 1, 0) && !onTransitStreet(120, 240, 0, 1));
      const people: { x: number; z: number; r: number }[] = [];
      const sim = new TrafficSim(net, { focus: () => focus, visible: cone(focus), vehicles: () => [], people: out => { out.push(...people); }, transitStreet: onTransitStreet }, { seed: 5 });
      const dt = 1 / 30;
      let samples = 0, onRoad = 0, moving = 0, ms = 0, maxV = 0, doubleHeld = 0;
      for (let i = 0; i < 30 * 90; i++) {
        const t0 = performance.now();
        sim.step(dt);
        ms += performance.now() - t0;
        if (i < 60) continue;
        const held = new Map<number, number>();
        for (const c of sim.cars) if (c.on && c.node >= 0) held.set(c.node, (held.get(c.node) ?? 0) + 1);
        for (const n of held.values()) if (n > 1) doubleHeld++;
        if (i % 10) continue;
        for (const c of sim.cars) {
          if (!c.on) continue;
          samples++;
          maxV = Math.max(maxV, c.v);
          if (c.v > 0.5) moving++;
          if (surfaceAt(c.x, c.z) === 'road') onRoad++;
          assert.ok(Math.hypot(c.x - focus.x, c.z - focus.z) <= TRAFFIC.radius + 25);
          const e = net.edge(c.e)!;
          assert.ok(!onTransitStreet((e.ax + e.bx) / 2, (e.az + e.bz) / 2, e.dx, e.dz), 'no car along a transit street');
          // the right-hand lane: right of the edge's centre line
          if (c.mode === 'lane') { const off = (c.x - e.ax) * e.nx + (c.z - e.az) * e.nz; assert.ok(off < -0.5, `right of the centre line (${off.toFixed(2)})`); }
        }
        // the queue gap: two stopped cars one behind the other in a lane keep ≈ 4 u centre to centre
        for (const a of sim.cars) for (const b of sim.cars) {
          if (a === b || !a.on || !b.on || a.e !== b.e || a.mode !== 'lane' || b.mode !== 'lane' || b.s <= a.s) continue;
          if (a.v < 0.05 && b.v < 0.05) assert.ok(b.s - a.s > TRAFFIC.gap - 0.6, `queue gap ${(b.s - a.s).toFixed(2)} u`);
        }
      }
      assert.equal(sim.active, TRAFFIC.count.high);
      assert.ok(onRoad / samples > 0.95, `cars on the roadway: ${(100 * onRoad / samples).toFixed(1)} %`);
      assert.ok(moving / samples > 0.6, `cars moving: ${(100 * moving / samples).toFixed(0)} %`);
      assert.ok(maxV <= TRAFFIC.speed[1] + 1e-6 && maxV > TRAFFIC.speed[0], `top speed ${maxV.toFixed(2)}`);
      assert.equal(doubleHeld, 0, 'never two cars in one junction box');
      // (lanes of two streets forking at a shallow angle can brush for a few frames)
      assert.ok(sim.stats.overlaps < 20, `cars side by side inside each other: ${sim.stats.overlaps} car-frames of 64,800`);
      assert.ok(sim.stats.turns > 100, `turns through junctions: ${sim.stats.turns}`);
      assert.ok(ms / 2700 < 2, `step ${(ms / 2700).toFixed(3)} ms`);

      // a person on the roadway ahead of a moving car: it stops short of them
      // (near the player, so it is not recycled meanwhile)
      const pick = () => sim.cars.find(k => k.on && k.mode === 'lane' && k.v > 2.5 && sim.span(net.edge(k.e)!)[1] - k.s > 8 && Math.hypot(k.x - focus.x, k.z - focus.z) < 60);
      let c = pick();
      for (let i = 0; i < 30 * 20 && !c; i++) { sim.step(dt); c = pick(); }
      assert.ok(c, 'a car on a longer stretch');
      const e = net.edge(c.e)!;
      const person = { x: c.x + e.dx * 7, z: c.z + e.dz * 7, r: 0.45 };
      people.push(person);
      const id = { e: c.e };
      for (let i = 0; i < 30 * 4; i++) sim.step(dt);
      assert.equal(c.e, id.e, 'the same car, still on its street');
      const gap = Math.hypot(person.x - c.x, person.z - c.z) - 1.05 - person.r;
      assert.ok(c.v < 0.05, `stopped for the person (v ${c.v.toFixed(2)})`);
      assert.ok(gap > 0.6, `short of them (${gap.toFixed(2)} u)`);
      // two soft obstacle discs per car ('traffic': a soft bump for the player's vehicle and the walker)
      const out: Obstacle[] = [];
      sim.obstacles(out, c.x, c.z, 2);
      assert.equal(out.filter(o => o.kind === 'traffic' && Math.hypot(o.x - c.x, o.z - c.z) < 0.6).length, 2);
    } finally { offTransit(); }
  });
});

test('F12 traffic yields to transit: a cable car standing in a junction box keeps the cars at their stop lines', async () => {
  await withCity(net => {
    const focus = { ...SPOT };
    let vehicles: RoadVehicle[] = [];
    const sim = new TrafficSim(net, { focus: () => focus, visible: () => false, vehicles: () => vehicles, people: () => {} }, { seed: 9 });
    for (let i = 0; i < 30 * 20; i++) sim.step(1 / 30);
    const boxes = new Set<number>();
    for (const c of sim.cars) if (c.on && c.mode === 'lane') { const e = net.edge(c.e)!; if (net.degree(e.v) >= 3) boxes.add(e.v); }
    const boxKeys = new Set([...boxes].map(n => sim.boxOf(n)));
    vehicles = [...boxes].map(n => ({ x: net.ix.x(n), z: net.ix.z(n), heading: 0, v: 0, halfL: 2.8, halfW: 1, kind: 'cable-car' as const, line: 'powell-hyde' }));
    const entered = new Set<number>();
    const already = new Set(sim.cars.filter(c => c.on && c.node >= 0).map(c => c.id));
    for (let i = 0; i < 30 * 10; i++) {
      sim.step(1 / 30);
      for (const c of sim.cars) if (c.on && c.node >= 0 && boxKeys.has(c.node) && !already.has(c.id)) entered.add(c.id);
    }
    assert.equal(entered.size, 0, `cars that entered a junction a cable car stands in: ${entered.size}`);
  });
});

test('F11 / F12 hooks and budgets: the road-vehicle registry; figures and cars within their triangle budgets', () => {
  const out: RoadVehicle[] = [];
  const off = registerRoadVehicles(o => { o.push({ x: 1, z: 2, heading: 0, v: 3, halfL: 1, halfW: 0.5, kind: 'traffic', line: 'traffic' }); });
  assert.equal(collectRoadVehicles(out).length, 1);
  off();
  assert.equal(collectRoadVehicles(out).length, 0);
  // near figure = the promenade walker; the far one and the cars stay small (checkpoint F14: vehicles + transit ≤ 20k
  // triangles; 24 cars at most ≈ 8 near with shadows ≈ 4.2k + 16 far ≈ 0.8k)
  assert.ok(tris(personGeometry()) <= 400, `near figure ${tris(personGeometry())}`);
  assert.ok(tris(personFarGeometry()) <= 100, `far figure ${tris(personFarGeometry())}`);
  assert.ok(tris(trafficCarGeometry()) <= 300, `car ${tris(trafficCarGeometry())}`);
  assert.ok(tris(trafficCarFarGeometry()) <= 60, `far car ${tris(trafficCarFarGeometry())}`);
  const size = new THREE.Box3().setFromBufferAttribute(trafficCarGeometry().getAttribute('position') as THREE.BufferAttribute).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.z - TRAFFIC.length) < 0.1 && Math.abs(size.x - TRAFFIC.width) < 0.05, `car ${size.x.toFixed(2)} × ${size.z.toFixed(2)} (lamps proud of the body)`);
  assert.equal(CROWD.count.high, 64);
  assert.equal(TRAFFIC.count.high, 24);
  assert.deepEqual([TRAFFIC.speed[0], TRAFFIC.speed[1], TRAFFIC.gap, TRAFFIC.radius, CROWD.radius, CROWD.hopWithin], [5, 9, 4, 220, 90, 1.2]);
});
