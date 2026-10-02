/**
 * W9-C · lane C's camera fixes (docs/opus-bay/sf-w9-C.md). Part a, W9-C1 (w8 S-P3): photo mode at Marina Green's
 * seawall framed the Parade of Ships at the frame's top edge — a lawn tree behind the camera made the roof / canopy lift
 * raise it 3.7 u, so the 0.04 pitch the parade's photo asks for became a 0.6 rad look down at the lawn. Photo mode now
 * pulls the camera in along its orbit instead (actors/cityViews.ts photoPullStep) and keeps its pitch.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

const T = await import('../src/opus-bay/core/terrain');
const { CityProps } = await import('../src/opus-bay/world/sf/props');
const CM = await import('../src/opus-bay/actors/cameraModes');
const camera = await import('../src/opus-bay/actors/camera');
const cityViews = await camera.loadCityViews();

type Blk = import('../src/opus-bay/core/terrain').Blocker;
const SX = 7000, SZ = 7000, SR = 160;
/** a flat city stand-in round (SX, SZ) with these blockers (the W7-K1 harness) */
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
function treeProps(pts: { x: number; z: number; y?: number }[]) {
  const props = new CityProps();
  props.setSource(3, { count: pts.length, kind: new Uint8Array(pts.length), variant: new Uint8Array(pts.length), xyzr: Float32Array.from(pts.flatMap(p => [p.x, p.y ?? 0, p.z, 0])) });
  return props;
}

test('W9-C1: photoPullFor — the full orbit when it is clear, else the farthest clear share in 0.05 steps, else the closest', () => {
  assert.equal(cityViews.photoPullFor(() => 0, 0.3), 1);
  assert.ok(Math.abs(cityViews.photoPullFor(k => (k > 0.72 ? 2 : 0), 0.3) - 0.7) < 1e-9);
  assert.equal(cityViews.photoPullFor(() => 1, 0.3), 0.3, 'nothing clear: the closest photo distance');
});

test('W9-C1 (w8 S-P3): photo mode keeps a low pitch with a street tree behind the camera — pulled in along the orbit, not lifted over the canopy; no tree: the full orbit', async () => {
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const { game } = await import('../src/opus-bay/core/store');
  const { view } = await import('../src/opus-bay/actors/view');
  world([]);
  const saved = game.get();
  game.set({ worldMode: 'city', phase: 'playing', photoMode: false } as never);
  const shoot = (props: InstanceType<typeof CityProps> | null) => {
    CM.setCanopySourceForTests(props ? () => props : null);
    const p = runtime.player;
    p.x = SX; p.z = SZ; p.y = 0; p.heading = Math.PI; p.pathTarget = null; p.locked = false;
    Object.assign(view, { x: SX, y: 0, z: SZ, ground: 0, vx: 0, vz: 0, ready: true });
    const cam = new THREE.PerspectiveCamera(42, 1440 / 900, 0.5, 4000);
    const rig = new camera.CameraController();
    for (let i = 0; i < 30; i++) rig.update(cam, 1 / 60, i / 60, 900, 1440);
    game.set({ photoMode: true } as never);
    rig.update(cam, 1 / 60, 0.5, 900, 1440);
    // the parade's face request: the camera behind the player (+z), pitch 0.04 (photo mode's lowest)
    rig.yaw = 0; rig.pitch = 0.04;
    for (let i = 0; i < 180; i++) rig.update(cam, 1 / 60, 0.5 + i / 60, 900, 1440);
    game.set({ photoMode: false } as never);
    rig.dispose();
    const t = rig.target.clone(), c = cam.position.clone();
    return { c, t, elev: Math.atan2(c.y - t.y, Math.hypot(c.x - t.x, c.z - t.z)), d: c.distanceTo(t) };
  };
  try {
    const open = shoot(null);
    // (the camera keeps 1.4 u over the ground: from the chest-high target that is ≈ 0.1 rad at 12 u)
    assert.ok(open.elev < 0.12 && Math.abs(open.d - 12) < 0.2, `no tree: the full 12 u orbit, level (${open.d.toFixed(2)} u, ${open.elev.toFixed(3)} rad)`);
    // a lawn tree where the camera stands (Marina Green: 1.5–3.9 u canopy round the camera's 1.6 u)
    const props = treeProps([{ x: SX, z: SZ + 11.5 }]);
    const shot = shoot(props);
    assert.ok(shot.elev < open.elev + 0.03, `the pitch stays the photo's: ${shot.elev.toFixed(3)} rad over the target vs ${open.elev.toFixed(3)} without the tree (before W9-C1: lifted over the canopy)`);
    assert.ok(shot.d < 10.5 && shot.d >= 3.4, `pulled in along the orbit: ${shot.d.toFixed(2)} u`);
    assert.ok(props.segmentCanopy(shot.t.x, shot.t.y, shot.t.z, shot.c.x, shot.c.y, shot.c.z) < 0, 'the line from the camera to the player misses the canopy');
  } finally { CM.setCanopySourceForTests(null); T.setCityTerrain(null); game.set(saved); }
});

test('W9-C4 (review explorer: a scroll out to the 30 u diorama view came back as the next session\'s camera): a wheel / pinch zoom is saved at most SAVE_DIST_MAX; a zoom within it is saved as is; photo mode saves nothing', async () => {
  const { game } = await import('../src/opus-bay/core/store');
  const saved = game.get().settings;
  const rig = new camera.CameraController() as unknown as { distance: number; persistDistance(photo: boolean): void };
  const persist = async (d: number, photo = false) => { rig.distance = d; rig.persistDistance(photo); await new Promise(r => setTimeout(r, 520)); return game.get().settings.cameraDistance; };
  try {
    assert.equal(camera.SAVE_DIST_MAX, 20);
    assert.equal(await persist(30), 20, 'zoomed out to 30 u: saved as 20 (before W9-C4: 30)');
    assert.equal(await persist(12.4), 12, 'within the cap: as is (rounded)');
    assert.equal(await persist(4), camera.DIST_MIN, 'never under DIST_MIN');
    assert.equal(await persist(28, true), camera.DIST_MIN, 'photo mode: nothing saved');
  } finally { game.set({ settings: saved } as never); }
});
