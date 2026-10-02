/**
 * W9-C-review · the adversarial review of lane C (docs/opus-bay/sf-w9-C.md "Review (Ultra)").
 *
 * C-RV-2 (review 2026-10-01 R§5 #15: 「窗外是 X」 only when X is in view): W9-C7 drops the ride camera's look toward the
 * stop's attraction when no rise clears the houses, but the N's approach line 「窗外山坡上那片楼群，就是 UCSF」 still played
 * over the train's own rear shot. The line now waits for the look's verdict (actors/cityViews.ts rideLookClear records
 * it in cameraModes' lookBias) and is said only when the look was kept (data/sf/tourLines.ts viewLineGate).
 * C-RV-7 (b): the C key's far preset (24 u) is saved as it is (W9-C4 capped it to 20 with the wheel). C-RV-8: on touch the
 * greyed lean button says why in its label.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';

const T = await import('../src/opus-bay/core/terrain');
const CM = await import('../src/opus-bay/actors/cameraModes');
const { RideCamera, rideLookAt, lookBias } = CM;
const { loadCityViews } = await import('../src/opus-bay/actors/camera');
await loadCityViews();
const TL = await import('../src/opus-bay/data/sf/tourLines');

type Blk = import('../src/opus-bay/core/terrain').Blocker;
const SX = 7000, SZ = 7000, SR = 160;
function world(blockers: Blk[] = []) {
  const inside = (x: number, z: number) => Math.abs(x - SX) < SR && Math.abs(z - SZ) < SR;
  const overlap = (b: Blk, x: number, z: number, r: number) => (b.kind === 'circle' ? Math.hypot(x - b.x, z - b.z) < r + b.r : T.distanceToPolygon(x, z, b.polygon) < r);
  const hits = (x: number, z: number, r: number) => blockers.some(b => overlap(b, x, z, r));
  T.setCityTerrain({
    heightAt: (x, z) => (inside(x, z) ? 0 : null), surfaceCode: (x, z) => (inside(x, z) ? 1 : 0),
    kindAt: (x, z) => (inside(x, z) ? T.KIND.land : T.KIND.outside), standAt: () => 1,
    forEachBlockerNear: (x, z, r, fn) => { for (const b of blockers) if (overlap(b, x, z, r + 0.5)) fn(b); },
    hitsBlocker: hits, blockedAt: (x, z) => hits(x, z, 0.45),
  });
}
const houses = (top: number): Blk => ({ kind: 'polygon', polygon: [{ x: SX - 12, z: SZ - 30 }, { x: SX - 4, z: SZ - 30 }, { x: SX - 4, z: SZ + 30 }, { x: SX - 12, z: SZ + 30 }], top } as unknown as Blk);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const perf = () => performance.now() / 1000;

/** the approach: the look toward a point 100 u east starts; the line's gate is asked over the next frames */
async function approach(blockers: Blk[]) {
  world(blockers);
  CM.setCanopySourceForTests(() => null);
  try {
    const rc = new RideCamera(), pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 50 };
    const sub = { mode: 'transit' as const, x: SX, y: 1.4, z: SZ - 6, heading: 0, speed: 3, gradeAhead: 0, side: 1 as const, seated: false, occlude: true, kind: 'light-rail' as const };
    for (let i = 0; i < 30; i++) rc.update({ ...sub, z: sub.z + i * 0.05 }, 1 / 60, i / 60, pose);
    const at = perf();
    rideLookAt(SX + 100, SZ, 4);
    const before = TL.viewLineGate(lookBias, at - 0.1, at + 1.5, perf());
    await sleep(60);
    for (let i = 30; i < 40; i++) rc.update({ ...sub, z: sub.z + i * 0.05 }, 1 / 60, i / 60, pose);
    return { before, after: TL.viewLineGate(lookBias, at - 0.1, at + 1.5, perf()) };
  } finally { CM.setCanopySourceForTests(null); T.setCityTerrain(null); }
}

test('C-RV-2: the UCSF window line is a view line; the other N / M lines are not', () => {
  assert.ok(TL.VIEW_LINES.has(TL.METRO_LINES['ucsf-window'].id));
  for (const k of ['board-n', '9th-irving', 'carl-cole', 'stonestown-next'] as const) assert.ok(!TL.VIEW_LINES.has(TL.METRO_LINES[k].id), k);
  const n = TL.metroNarration({ what: 'approach', line: 'n-judah', station: 'muni-carl-hillway', dir: 1 });
  assert.ok(n && TL.VIEW_LINES.has(n.id), 'the approach at Carl & Hillway asks for the view');
});

test('C-RV-2: viewLineGate — waits for the verdict on this look, says it when kept, drops it when dropped or never judged', () => {
  assert.equal(TL.viewLineGate({ t0: 10, checked: 10, kept: true }, 9.9, 11.5, 10.2), 'say');
  assert.equal(TL.viewLineGate({ t0: 10, checked: 10, kept: false }, 9.9, 11.5, 10.2), 'drop');
  // (an older look's verdict does not count; not judged yet: wait, then drop at the deadline)
  assert.equal(TL.viewLineGate({ t0: 10, checked: 4, kept: true }, 9.9, 11.5, 10.2), 'wait');
  assert.equal(TL.viewLineGate({ t0: 4, checked: 4, kept: true }, 9.9, 11.5, 10.2), 'wait');
  assert.equal(TL.viewLineGate({ t0: 4, checked: 4, kept: true }, 9.9, 11.5, 11.6), 'drop');
});

test('C-RV-2: an open street — the look is kept, so 「窗外…UCSF」 is said', async () => {
  const r = await approach([]);
  assert.equal(r.before, 'wait', 'not before the camera has judged the look');
  assert.equal(r.after, 'say');
});

test('C-RV-2: tall houses on the look\'s side — the look is dropped (W9-C7), so the line is not said over the rear shot', async () => {
  const r = await approach([houses(14)]);
  assert.equal(r.after, 'drop');
});

test('C-RV-2: cityMoments holds the view line for the gate instead of offering it at once', () => {
  const src = fs.readFileSync('src/opus-bay/game/cityMoments.ts', 'utf8');
  assert.match(src, /VIEW_LINES\.has\(say\.key\)\) viewWait = /);
  assert.match(src, /viewLineGate\(lookBias, viewWait\.since, viewWait\.until, now\)/);
});

test('C-RV-7 (b): the C key\'s far preset (24 u) is saved as 24; a wheel zoom to 30 still saves 20 (W9-C4)', async () => {
  const camera = await import('../src/opus-bay/actors/camera');
  const { game } = await import('../src/opus-bay/core/store');
  const saved = game.get().settings;
  const rig = new camera.CameraController() as unknown as { distance: number; persistDistance(photo: boolean, cap?: number): void };
  const wait = () => new Promise(r => setTimeout(r, 520));
  try {
    rig.distance = 24; rig.persistDistance(false, camera.DIST_MAX); await wait();
    assert.equal(game.get().settings.cameraDistance, 24, 'the far preset: as is (before: 20)');
    rig.distance = 30; rig.persistDistance(false); await wait();
    assert.equal(game.get().settings.cameraDistance, camera.SAVE_DIST_MAX, 'a scroll: capped');
    const src = fs.readFileSync('src/opus-bay/actors/camera.ts', 'utf8');
    assert.match(src, /this\.distance = \[15, 9, 24\]\[this\.footPreset\]; this\.persistDistance\(false, DIST_MAX\);/);
  } finally { game.set({ settings: saved } as never); }
});

test('C-RV-8: on touch the greyed lean button shows why in its label (a disabled button\'s title never shows on a phone)', () => {
  const src = fs.readFileSync('src/opus-bay/play/BellPad.tsx', 'utf8');
  assert.match(src, /keys \? t\('按住 L 探身', 'Hold L to lean out'\) : why \?\? t\('按住探身', 'Hold to lean out'\)/);
  assert.match(src, /const why = !board \? t\('站到踏板上才能探身', 'Stand on the running board first'\) : !moving \? t\('车开起来才能探身', 'Lean out once the car is moving'\) : undefined;/);
});
