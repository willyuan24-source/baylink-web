import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { onEvent, type GameEvent } from '../src/opus-bay/core/events';
import { runtime } from '../src/opus-bay/core/runtime';
import { blockersNear, canStand, isWater } from '../src/opus-bay/core/terrain';
import { DISTRICT } from '../src/opus-bay/data/district';
import { BOX, Batch, M, resample, signedArea, splitGeometry } from '../src/opus-bay/world/builder';
import { bayClock, handAngles, isMarketDay, isMarketOpen } from '../src/opus-bay/world/clock';
import { K_DOCK_FLOATS, K_DOCK_LIONS, kDockSpots } from '../src/opus-bay/world/landmarks';
import { FERRY_ARRIVAL_SECONDS } from '../src/opus-bay/world/life';
import { TIME_PRESETS } from '../src/opus-bay/world/palette';
import { Floaters } from '../src/opus-bay/world/props';
import { DWELL_SECONDS, Streetcars } from '../src/opus-bay/world/streetcar';
import { waterGrid } from '../src/opus-bay/world/water';

const triCount = (g: THREE.BufferGeometry) => (g.getIndex()?.count ?? g.getAttribute('position').count) / 3;

test('Batch polygons face up and walls face outward regardless of winding', () => {
  for (const poly of [[{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }], [{ x: 0, z: 3 }, { x: 4, z: 3 }, { x: 4, z: 0 }, { x: 0, z: 0 }]]) {
    const b = new Batch().polygon(poly, 1, '#ffffff');
    const g = b.build();
    const p = g.getAttribute('position'), idx = g.getIndex()!;
    for (let i = 0; i < idx.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, idx.getX(i)), c = new THREE.Vector3().fromBufferAttribute(p, idx.getX(i + 1)), d = new THREE.Vector3().fromBufferAttribute(p, idx.getX(i + 2));
      const n = new THREE.Vector3().crossVectors(c.clone().sub(a), d.clone().sub(a));
      assert.ok(n.y > 0, 'triangle faces up');
    }
    const w = new Batch().walls(poly, 0, 2, '#ffffff').build();
    const wp = w.getAttribute('position'), wn = w.getAttribute('normal'), wi = w.getIndex()!;
    for (let i = 0; i < wi.count; i += 3) {
      const ids = [wi.getX(i), wi.getX(i + 1), wi.getX(i + 2)];
      const [a, c, d] = ids.map(k => new THREE.Vector3().fromBufferAttribute(wp, k));
      const geomN = new THREE.Vector3().crossVectors(c.clone().sub(a), d.clone().sub(a)).normalize();
      const centre = new THREE.Vector3(2, 1, 1.5), mid = a.clone().add(c).add(d).divideScalar(3);
      assert.ok(geomN.dot(mid.sub(centre)) > 0, 'wall faces outward');
      assert.ok(geomN.dot(new THREE.Vector3().fromBufferAttribute(wn, ids[0])) > 0.99, 'stored normal matches winding');
    }
  }
  assert.ok(signedArea([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }]) > 0);
});

test('splitGeometry keeps every triangle and every attribute', () => {
  const b = new Batch();
  for (let i = 0; i < 40; i++) b.add(BOX(), M(i * 30 - 600, 0, (i % 7) * 50 - 150, i, 2, 3, 2), '#abcdef', [1, 2, 3, 4]);
  const g = b.build();
  const before = triCount(g);
  const parts = splitGeometry(g, 96);
  assert.ok(parts.length > 4, 'several chunks');
  assert.equal(parts.reduce((s, p) => s + triCount(p), 0), before);
  for (const p of parts) {
    for (const name of ['position', 'normal', 'color', 'aInfo']) assert.ok(p.getAttribute(name), name);
    assert.ok(p.boundingSphere && p.boundingSphere.radius < 200, 'chunk bounds are local');
  }
});

test('resample keeps corners and bounds step length', () => {
  const pts = resample([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 5 }], 2);
  assert.deepEqual(pts[0], { x: 0, z: 0 });
  assert.ok(pts.some(p => p.x === 10 && p.z === 0), 'corner kept');
  for (let i = 1; i < pts.length; i++) assert.ok(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) <= 2 + 1e-9);
});

test('water grid stays inside the slab (outside vertices snap onto the edge)', () => {
  const g = waterGrid(DISTRICT.slab, 3.5, DISTRICT.waterLevel, null);
  const p = g.getAttribute('position');
  const slab = DISTRICT.slab;
  const inside = (x: number, z: number) => {
    let ins = false;
    for (let i = 0, j = slab.length - 1; i < slab.length; j = i++) {
      const a = slab[i], b = slab[j];
      if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) ins = !ins;
    }
    return ins;
  };
  let edge = 0;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    if (!inside(x, z)) {
      // on the boundary (within float tolerance)
      let d = Infinity;
      for (let k = 0; k < slab.length; k++) {
        const a = slab[k], b = slab[(k + 1) % slab.length];
        const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
        d = Math.min(d, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
      }
      assert.ok(d < 1e-3, `vertex ${x},${z} outside the slab`);
      edge++;
    }
  }
  assert.ok(edge > 0, 'edge vertices were snapped');
  assert.ok(triCount(g) < 30000, 'water stays cheap');
});

test('market days follow the Bay Area clock (Tue / Thu / Sat)', () => {
  // 2026-09-26 is a Saturday; 18:00 UTC = 11:00 in San Francisco
  assert.equal(isMarketDay(new Date('2026-09-26T18:00:00Z')), true);
  assert.equal(isMarketDay(new Date('2026-09-25T18:00:00Z')), false); // Friday
  assert.equal(isMarketDay(new Date('2026-09-29T18:00:00Z')), true); // Tuesday
  // Friday 2026-09-25 23:30 PDT is already Saturday in UTC — still Friday in the Bay
  assert.equal(isMarketDay(new Date('2026-09-26T06:30:00Z')), false);
  const c = bayClock(new Date('2026-09-26T18:05:00Z'));
  assert.equal(c.hour, 11);
  assert.equal(c.minute, 5);
  // stalls are staffed Tue/Thu 10:00–14:00, Sat 8:00–14:00 (matches game/flow marketOpenNow)
  assert.equal(isMarketOpen(new Date('2026-09-29T16:30:00Z')), false); // Tue 09:30
  assert.equal(isMarketOpen(new Date('2026-09-29T17:30:00Z')), true); // Tue 10:30
  assert.equal(isMarketOpen(new Date('2026-09-26T18:00:00Z')), true); // Sat 11:00
  assert.equal(isMarketOpen(new Date('2026-09-26T14:30:00Z')), false); // Sat 07:30
  assert.equal(isMarketOpen(new Date('2026-09-26T21:30:00Z')), false); // Sat 14:30
  assert.equal(isMarketOpen(new Date('2026-09-25T18:00:00Z')), false); // Fri 11:00
  const a = handAngles(15, 30);
  assert.ok(Math.abs(a.minute - Math.PI) < 1e-9 && Math.abs(a.hour - (3.5 / 12) * Math.PI * 2) < 1e-9);
});

test('time-of-day presets are complete and the golden sun sits behind the default camera (+z)', () => {
  for (const [name, p] of Object.entries(TIME_PRESETS)) {
    assert.ok(p.sunDir[1] > 0.1, `${name} sun above the horizon`);
    assert.ok(p.fogDensity > 0 && p.fogDensity < 0.003, `${name} fog`);
  }
  assert.ok(TIME_PRESETS.golden.sunDir[2] > 0.5, 'golden sun from the city side (real west)');
  assert.equal(TIME_PRESETS.night.night, 1);
  assert.equal(FERRY_ARRIVAL_SECONDS, 3);
});

test('streetcars shuttle the F-line, dwell at every stop and ring the bell when leaving', () => {
  const cars = new Streetcars();
  const seen = new Set<string>();
  let bells = 0;
  const off = onEvent((e: GameEvent) => { if (e.type === 'streetcar-bell') bells++; });
  const stop = DISTRICT.streetcar.stops.find(s => s.id === 'green')!;
  const anchor = DISTRICT.anchors['streetcar-green'];
  runtime.player.x = anchor.x; runtime.player.z = anchor.z;
  let dwellFrames = 0;
  let minGap = Infinity;
  const dt = 1 / 30;
  for (let i = 0; i < 30 * 200; i++) {
    cars.update(dt, i * dt);
    const sc = runtime.streetcar;
    assert.ok(sc.t >= 0 && sc.t <= 1, 't in range');
    assert.ok(Number.isFinite(sc.x) && Number.isFinite(sc.z));
    const [c0, c1] = cars.positions();
    assert.ok(Number.isFinite(c0.x) && Number.isFinite(c1.x));
    minGap = Math.min(minGap, Math.hypot(c0.x - c1.x, c0.z - c1.z));
    if (sc.atStop) dwellFrames++;
    for (const car of (cars as unknown as { cars: { atStop: string | null }[] }).cars) if (car.atStop) seen.add(car.atStop);
  }
  off();
  for (const s of DISTRICT.streetcar.stops) assert.ok(seen.has(s.id), `dwelled at ${s.id}`);
  assert.ok(bells > 0, 'bell rang near the player');
  assert.ok(minGap > 2.4, `cars never drive through each other (min centre gap ${minGap.toFixed(2)})`);
  assert.ok(dwellFrames * dt >= DWELL_SECONDS, 'dwell time observed');
  assert.ok(stop.at > 0 && stop.at < 1);
  cars.dispose();
});

test('pushable cones slide away from the player, emit a bump and never tunnel into blockers', () => {
  const f = new Floaters(DISTRICT.props);
  const cone = DISTRICT.props.find(p => p.kind === 'cone')!;
  const bumps: GameEvent[] = [];
  const off = onEvent(e => { if (e.type === 'bump') bumps.push(e); });
  runtime.player.x = cone.x - 0.3; runtime.player.z = cone.z; runtime.player.speed = 4;
  runtime.guide.x = 9999; runtime.guide.z = 9999;
  for (let i = 0; i < 60; i++) f.update(1 / 60, 10 + i / 60);
  off();
  const body = (f as unknown as { bodies: { kind: string; x: number; z: number }[] }).bodies.find(b => b.kind === 'cone')!;
  assert.ok(Math.hypot(body.x - cone.x, body.z - cone.z) > 0.2, 'cone moved');
  assert.ok(body.x > cone.x, 'pushed away from the player');
  assert.ok(bumps.length >= 1 && bumps[0].type === 'bump' && bumps[0].kind === 'cone');
  assert.ok(canStand(body.x, body.z, 0.1), 'cone still on walkable ground');
  f.dispose();
});

test('K-Dock floats sit on open water west of Pier 39, off the walkable deck, with uneven heaps of sea lions', () => {
  const spots = kDockSpots();
  assert.equal(spots.length, K_DOCK_LIONS.reduce((a, b) => a + b, 0));
  assert.equal(K_DOCK_LIONS.length, K_DOCK_FLOATS.length);
  assert.ok(K_DOCK_LIONS.includes(0), 'one empty float');
  assert.ok(K_DOCK_LIONS.filter(n => n >= 5).length >= 2, 'two big piles');
  // organic layout: not a grid (sizes and yaws vary)
  assert.ok(new Set(K_DOCK_FLOATS.map(f => f[2])).size > 4 && new Set(K_DOCK_FLOATS.map(f => f[4])).size > 4);
  for (const s of spots) assert.ok(s.s >= 0.85 && s.s <= 1.15, 'lion scale 0.85–1.15');
  for (const s of spots) {
    assert.ok(isWater(s.x, s.z), `float spot ${s.x.toFixed(1)},${s.z.toFixed(1)} is water`);
    assert.ok(!canStand(s.x, s.z, 0.2), 'not walkable');
    assert.equal(blockersNear(s.x, s.z, 0.1).length, 0);
    assert.ok(s.y > DISTRICT.waterLevel, 'above the water');
  }
  const view = DISTRICT.anchors['sea-lion-viewpoint'];
  const nearest = Math.min(...spots.map(s => Math.hypot(s.x - view.x, s.z - view.z)));
  assert.ok(nearest < 14, 'visible from the sea-lion viewpoint');
});
