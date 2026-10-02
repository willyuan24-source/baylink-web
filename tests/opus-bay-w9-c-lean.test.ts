/**
 * W9-C5 · the cable-car lean shot (review R§6 世界、镜头与美术: 「叮当车最好的"探身"侧拍藏在"行驶中按住 L"后面，在站台上按没有任何反馈」;
 * docs/opus-bay/sf-w9-C.md part c): the shot comes on its own for 3 s once per stretch between stops, 2 s after the car pulls
 * away (no shutter); the button says 按住 L 探身 and is disabled while the car stands; a held L at the stop leans out as the
 * car leaves.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';

const bell = await import('../src/opus-bay/play/bell');
const P = await import('../src/opus-bay/actors/platform');
const { rideCamInfo } = await import('../src/opus-bay/actors/cameraModes');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { game } = await import('../src/opus-bay/core/store');
const { flow } = await import('../src/opus-bay/game/flowStore');
const { onEvent } = await import('../src/opus-bay/core/events');

const DT = 1 / 60;
let z = 20;
function ride(spot: 'rail' | 'seat') {
  bell.__resetBell();
  const at = { x: 0, z: 0, heading: 0 };
  P.definePlatform('qa-cable9', { floor: 0.4, deck: { minX: -0.8, maxX: 0.8, minZ: -3, maxZ: 3 }, rail: at, seatLeft: at, seatRight: at, seatY: 0.4, railMirror: true, hangLean: 0.2, kind: 'cable-car' });
  z = 20;
  P.setPlatformPose('qa-cable9', { x: 10, y: 5, z, heading: 0, roll: 0 }, DT);
  P.rider.platform = 'qa-cable9'; P.rider.x = 1.1; P.rider.z = 0;
  rideCamInfo.side = 1;
  game.set({ phase: 'playing', photoMode: false, move: { mode: 'transit', line: 'qa-cable9', spot } } as never);
  flow.set({ ride: { stage: 'riding', from: 'a', to: 'b', line: 'qa-cable9', kind: 'cable-car' } } as never);
}

/** step `s` seconds with the car at `v` u/s; returns the seconds the lean shot was up */
function drive(s: number, v: number, scene: THREE.Object3D | null = null): number {
  let up = 0;
  for (let t = 0; t < s; t += DT) {
    z += v * DT;
    P.setPlatformPose('qa-cable9', { x: 10, y: 5, z, heading: 0, roll: 0 }, DT);
    bell.stepLean(DT, scene, null, 1.6);
    if (runtime.camera.shot) up += DT;
  }
  return up;
}
const done = () => { bell.__resetBell(); P.platforms.delete('qa-cable9'); P.rider.platform = null; runtime.camera.shot = null; flow.set({ ride: null } as never); game.set({ move: { mode: 'foot' } } as never); };

test('W9-C5: the lean shot comes on its own for 3 s, 2 s after the car pulls away — once a stretch, again after the next stop; seated too; no shutter', () => {
  const shutters: unknown[] = [];
  const off = onEvent(e => { if (e.type === 'shutter') shutters.push(e); });
  try {
    for (const spot of ['seat', 'rail'] as const) {
      ride(spot);
      assert.equal(drive(1.5, 0), 0, `${spot}: standing at the stop: nothing`);
      assert.equal(bell.carMoving(), false);
      assert.equal(drive(1.9, 3), 0, `${spot}: the first 2 s under way: nothing yet`);
      assert.equal(bell.carMoving(), true);
      const up = drive(4, 3);
      assert.ok(Math.abs(up - bell.AUTO_LEAN_S) < 0.1, `${spot}: up ${up.toFixed(2)} s`);
      assert.equal(drive(10, 3), 0, `${spot}: once a stretch`);
      drive(1, 0);
      assert.ok(Math.abs(drive(6, 3) - bell.AUTO_LEAN_S) < 0.1, `${spot}: again after the next stop`);
      assert.equal(runtime.camera.shot, null, 'handed back');
      done();
    }
    assert.equal(shutters.length, 0, 'the automatic lean takes no photo');
  } finally { off(); done(); }
});

test('W9-C5: reduced motion: no automatic lean; a held L at the stop waits and leans out as the car leaves (the shutter once)', () => {
  const shutters: unknown[] = [];
  const off = onEvent(e => { if (e.type === 'shutter') shutters.push(e); });
  const saved = game.get().settings;
  try {
    ride('rail');
    game.set({ settings: { ...saved, reducedMotion: true } } as never);
    drive(1, 0);
    assert.equal(drive(8, 3), 0, 'reduced motion: none');
    game.set({ settings: saved } as never);
    done(); ride('rail');
    const scene = new THREE.Scene(), body = new THREE.Object3D();
    body.name = 'opus-player'; scene.add(body);
    drive(0.5, 0, scene);
    bell.setLean(true, 'caption');
    assert.equal(drive(1, 0, scene), 0, 'held at the stop: nothing while the car stands');
    assert.ok(drive(2, 3, scene) > 1.8, 'leans out as the car pulls away');
    assert.equal(shutters.length, 1, 'the held lean\'s photo');
  } finally { off(); game.set({ settings: saved } as never); done(); }
});

test('W9-C5: the button says how (按住 L 探身 / Hold L to lean out) and is disabled while the car stands', () => {
  const src = fs.readFileSync('src/opus-bay/play/BellPad.tsx', 'utf8');
  assert.match(src, /t\('按住 L 探身', 'Hold L to lean out'\)/);
  assert.match(src, /t\('按住探身', 'Hold to lean out'\)/);
  assert.match(src, /disabled=\{!board \|\| !moving\}/);
  assert.match(src, /t\('车开起来才能探身', 'Lean out once the car is moving'\)/);
});
