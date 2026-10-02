import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

/**
 * W7-K1 · the street trees in the cameras' ray tests (docs/opus-bay/sf-w7-K.md part a): lane K1's Hyde St open item
 * (seated on the Powell–Hyde a canopy stood between the ride camera and the rider at 3 of 4 spots on a phone) and lane
 * B's review shot (the follow camera inside a street tree at Powell & Sacramento).
 */

const T = await import('../src/opus-bay/core/terrain');
const { CityProps, CANOPY_SHAPE } = await import('../src/opus-bay/world/sf/props');
const CM = await import('../src/opus-bay/actors/cameraModes');
const { RideCamera } = CM;
// (red on the tree before W7-K1: no canopy source to set — the cameras never saw a tree)
const setCanopies = (CM as unknown as { setCanopySourceForTests?: (fn: (() => unknown) | null) => void }).setCanopySourceForTests;

type Blk = import('../src/opus-bay/core/terrain').Blocker;
const SX = 7000, SZ = 7000, SR = 160;
/** a flat city stand-in round (SX, SZ) with these blockers (lane K1's harness) */
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
/** CityProps with one chunk of round trees (kind 0) at these points (y = the ground under each) */
function treeProps(pts: { x: number; z: number; y?: number; variant?: number }[]) {
  const props = new CityProps();
  props.setSource(3, {
    count: pts.length, kind: new Uint8Array(pts.length), variant: Uint8Array.from(pts.map(p => p.variant ?? 0)),
    xyzr: Float32Array.from(pts.flatMap(p => [p.x, p.y ?? 0, p.z, 0])),
  });
  return props;
}

test('W7-K1: CityProps answers the street trees near a point and the first canopy on a segment (the drawn scale); a line over the trees or one starting under a canopy is clear', () => {
  const props = treeProps([{ x: 10, z: 0 }, { x: 40, z: 0, variant: 1 }, { x: 200, z: 0 }]);
  const seen: { x: number; r: number; y0: number; y1: number }[] = [];
  props.treesNear(10, 0, 1, c => seen.push({ x: c.x, r: c.r, y0: c.y0, y1: c.y1 }));
  assert.equal(seen.length, 1, 'only the tree at x 10');
  const s = seen[0].r / CANOPY_SHAPE.round.r;
  assert.ok(s > 0.89 && s < 1.16, `a variant-0 tree's scale ${s.toFixed(3)} (0.9 … 1.15)`);
  assert.ok(Math.abs(seen[0].y0 - (CANOPY_SHAPE.round.y0 * s - 0.02)) < 1e-4 && Math.abs(seen[0].y1 - (CANOPY_SHAPE.round.y1 * s - 0.02)) < 1e-4, 'band on the ground');
  let n = 0;
  props.treesNear(100, 0, 100, () => n++);
  assert.equal(n, 3, 'a wide disc meets all three');
  // a level line at canopy height through the first tree: enters at its disc
  const t = props.segmentCanopy(0, 2.5, 0, 20, 2.5, 0);
  assert.ok(Math.abs(t * 20 - (10 - seen[0].r)) < 1e-3, `enters at ${(t * 20).toFixed(3)} u`);
  assert.equal(props.segmentCanopy(0, 6, 0, 20, 6, 0), -1, 'over the canopy');
  assert.equal(props.segmentCanopy(0, 0.5, 0, 20, 0.5, 0), -1, 'under the canopy (the trunk is thin)');
  assert.equal(props.segmentCanopy(9.5, 2.5, 0, 9.5, 2.5, 20, 1.5), -1, 'starting under the canopy: left to the dither');
  assert.ok(props.segmentCanopy(9.5, 2.5, 0, 9.5, 2.5, 20) >= 0, '…unless skip is 0');
  // the view cone from b: a canopy 1 u off the line halfway to the camera fills part of the frame round the subject
  const off = seen[0].r + 1;
  assert.equal(props.segmentCanopy(10 + off, 2.5, -10, 10 + off, 2.5, 10), -1, 'off the line');
  const tc = props.segmentCanopy(10 + off, 2.5, -10, 10 + off, 2.5, 10, 0, 0.22);
  // (the answer: how far out the camera may stand with the canopy outside its cone — halfway + (e − r)/cone)
  assert.ok(Math.abs(tc - (0.5 + 1 / (0.22 * 20))) < 0.01, `inside the cone from b (${tc.toFixed(3)})`);
  assert.equal(props.segmentCanopy(10 + off, 2.5, -10, 10 + off, 2.5, 10, 0, 0.05), -1, 'a narrow cone misses it');
  assert.equal(props.segmentCanopy(10 + off, 2.5, 10, 10 + off, 2.5, 30, 0, 0.22), -1, 'beyond the subject (not between it and the camera): out of the view');
  // the lift that clears the canopy: a camera inside it rises above its top
  // (the line rises from the target: it must clear the canopy's near edge, lo = where it enters the disc)
  const lift = props.canopyLift(0, 1.5, 0, 10, 2.5, 0, 0.35, 0.6), lo = (10 - seen[0].r) / 10;
  assert.ok(Math.abs(lift - ((seen[0].y1 + 0.6 - 1.5) / lo - 1)) < 1e-3, `lift ${lift.toFixed(3)}`);
  assert.ok(2.5 + lift >= seen[0].y1 + 0.6, 'the camera itself over the top');
  assert.equal(props.canopyLift(0, 1.5, 0, 10, 8, 0, 0.35, 0.6), 0, 'already over it');
  assert.equal(props.canopyLift(0, 0.4, 0, 10, 0.6, 0, 0.35, 0.6), 0, 'under it all the way across: nothing to clear');
  // a chunk leaving takes its trees
  props.setSource(3, null);
  n = 0; props.treesNear(100, 0, 500, () => n++);
  assert.equal(n, 0);
});

test('W7-K1: riding a city line past kerb trees, the ride camera\'s line to the rider misses the canopies (standing and seated), and it returns to the side-on shot once the street is clear', () => {
  // an open street (no house near), round trees every 8 u on the camera's kerb 5 u off the car's axis for 70 u
  const trees = [] as { x: number; z: number }[];
  for (let z = SZ; z <= SZ + 70; z += 8) trees.push({ x: SX + 5, z });
  const props = treeProps(trees);
  world([]);
  setCanopies?.(() => props);
  try {
    for (const seated of [false, true]) {
      const sub = { mode: 'transit' as const, x: SX + 1.3, y: seated ? 1.3 : 1.75, z: SZ - 10, heading: 0, speed: 4, gradeAhead: 0, side: 1 as const, seated, occlude: true, kind: 'cable-car' as const };
      const rc = new RideCamera(), pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 46 };
      let frames = 0, blocked = 0;
      for (let i = 0; i < 2400; i++) {
        const z = sub.z + i * 0.066; // 4 u/s
        rc.update({ ...sub, z }, 1 / 60, i / 60, pose);
        if (z > SZ + 8 && z < SZ + 62) {
          frames++;
          // the rider's chest → the camera (the pull-in may bring it in front of a canopy: that counts as clear)
          if (props.segmentCanopy(sub.x, sub.y + 0.3, z, pose.pos.x, pose.pos.y, pose.pos.z, 1.5, CM.CANOPY_CONE ?? 0.22) >= 0) blocked++;
        }
      }
      assert.ok(blocked / frames < 0.08, `${seated ? 'seated' : 'standing'}: a canopy between the camera and the rider in ${blocked} of ${frames} frames`);
      // 2400 frames = 158 u: the last 90 u are open — back to the side-on shot
      assert.ok(rc.swing < 0.05, `side-on again past the trees (swing ${rc.swing.toFixed(2)})`);
    }
  } finally { setCanopies?.(null); T.setCityTerrain(null); }
});

test('W7-K1: the ride camera\'s swing is held while the side is blocked now and then (no easing back at every gap between two trees); K1\'s open street stays side-on', () => {
  // one tree every 16 u: the side-on line meets a canopy about a third of the way past each
  const trees = [] as { x: number; z: number }[];
  for (let z = SZ; z <= SZ + 80; z += 16) trees.push({ x: SX + 5, z });
  const props = treeProps(trees);
  world([]);
  setCanopies?.(() => props);
  try {
    const sub = { mode: 'transit' as const, x: SX + 1.3, y: 1.75, z: SZ - 4, heading: 0, speed: 4, gradeAhead: 0, side: 1 as const, seated: false, occlude: true, kind: 'cable-car' as const };
    const rc = new RideCamera(), pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 46 };
    let swungAt = -1, minAfter = 1;
    for (let i = 0; i < 1100; i++) {
      const z = sub.z + i * 0.066;
      rc.update({ ...sub, z }, 1 / 60, i / 60, pose);
      if (swungAt < 0 && rc.swing > 0.5) swungAt = z;
      if (swungAt >= 0 && z < SZ + 84) minAfter = Math.min(minAfter, rc.swing);
    }
    assert.ok(swungAt >= 0, 'the trees swung the shot');
    assert.ok(minAfter > 0.5, `held along the row (min swing ${minAfter.toFixed(2)} after the first swing)`);
  } finally { setCanopies?.(null); T.setCityTerrain(null); }
  // no source (the district): the shot is K1's
  const rc = new RideCamera(), pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 46 };
  world([]);
  try {
    for (let i = 0; i < 180; i++) rc.update({ mode: 'transit', x: SX + 1.3, y: 1.4, z: SZ + i * 0.066, heading: 0, speed: 4, gradeAhead: 0, side: 1, seated: false, occlude: true, kind: 'cable-car' }, 1 / 60, i / 60, pose);
    assert.ok(rc.swing < 0.05 && pose.pos.x - SX > 5, 'side-on');
  } finally { T.setCityTerrain(null); }
});

test('W7-K1 (lane B\'s review: the phone\'s waiting shot stood inside a street tree at Powell & Sacramento): the follow camera rises over a canopy it would stand in', async () => {
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const { game } = await import('../src/opus-bay/core/store');
  const { view } = await import('../src/opus-bay/actors/view');
  const { CameraController, loadCityViews } = await import('../src/opus-bay/actors/camera');
  // (W9-C1: the roof / canopy lift's maths moved to the city camera data, actors/cityViews.ts — loaded in city mode)
  await loadCityViews();
  world([]);
  const saved = game.get();
  game.set({ worldMode: 'city', phase: 'playing' } as never);
  const settle = (props: InstanceType<typeof CityProps> | null) => {
    setCanopies?.(props ? () => props : null);
    const p = runtime.player;
    p.x = SX; p.z = SZ; p.y = 0; p.heading = 0; p.pathTarget = null; p.locked = false;
    Object.assign(view, { x: SX, y: 0, z: SZ, ground: 0, vx: 0, vz: 0, ready: true });
    const cam = new THREE.PerspectiveCamera(42, 390 / 844, 0.5, 4000);
    const rig = new CameraController();
    for (let i = 0; i < 120; i++) rig.update(cam, 1 / 60, i / 60, 844, 390);
    rig.dispose();
    return cam.position.clone();
  };
  try {
    const open = settle(null);
    // a street tree right where the camera stands, its canopy round the camera's height (a slope uphill of the player)
    const props = treeProps([{ x: open.x, z: open.z, y: open.y - 2.4 }]);
    let top = -Infinity;
    props.treesNear(open.x, open.z, 0.1, c => { top = c.y1; });
    assert.ok(open.y < top, `without the fix the camera is in the canopy (y ${open.y.toFixed(2)}, top ${top.toFixed(2)})`);
    const lifted = settle(props);
    assert.ok(lifted.y >= top + 0.45, `over the canopy: y ${lifted.y.toFixed(2)} vs top ${top.toFixed(2)}`);
    assert.ok(Math.hypot(lifted.x - open.x, lifted.z - open.z) < 0.5, 'the same yaw (only lifted)');
    // no tree: unchanged
    const again = settle(null);
    assert.ok(again.distanceTo(open) < 1e-6, 'no canopy source: the same pose');
  } finally { setCanopies?.(null); T.setCityTerrain(null); game.set(saved); }
});
