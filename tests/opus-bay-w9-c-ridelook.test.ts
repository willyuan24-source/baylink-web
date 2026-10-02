/**
 * W9-C7 · the ride camera's look-at bias never parks the camera in the houses (review 2026-10-01 R§5 #15: on the N at
 * Carl & Arguello BAYBAY said 「窗外…UCSF」 with the camera against a house front, explorer 59-n-d; at Carl & Cole by the
 * Sunset Tunnel's portal it sat in a building, verify-explorer 35-nj-a). A look (W4-G9 rideLookAt: the stop's attraction,
 * a portal) whose camera would stand in a building rises over it toward the point; when no rise clears it, the look is
 * dropped and the line's own shot stays.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

const T = await import('../src/opus-bay/core/terrain');
const CM = await import('../src/opus-bay/actors/cameraModes');
const { RideCamera, rideLookAt } = CM;
// (the check lives in the city camera chunk, actors/cityViews.ts, loaded by camera.ts in city mode)
const { loadCityViews } = await import('../src/opus-bay/actors/camera');
await loadCityViews();

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
/** a row of houses west of the line (x −12 … −4 from it, 50 u long), this tall */
const houses = (top: number): Blk => ({ kind: 'polygon', polygon: [{ x: SX - 12, z: SZ - 30 }, { x: SX - 4, z: SZ - 30 }, { x: SX - 4, z: SZ + 30 }, { x: SX - 12, z: SZ + 30 }], top } as unknown as Blk);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** ride the Metro north past the houses for 1.5 s while a look toward a point 100 u east is on; the pose at the end */
async function ride(blockers: Blk[]) {
  world(blockers);
  CM.setCanopySourceForTests(() => null);
  try {
    const rc = new RideCamera(), pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 50 };
    const sub = { mode: 'transit' as const, x: SX, y: 1.4, z: SZ - 6, heading: 0, speed: 3, gradeAhead: 0, side: 1 as const, seated: false, occlude: true, kind: 'light-rail' as const };
    for (let i = 0; i < 30; i++) rc.update({ ...sub, z: sub.z + i * 0.05 }, 1 / 60, i / 60, pose);
    // (the bias eases in over 0.8 s of the performance clock)
    rideLookAt(SX + 100, SZ, 4);
    await sleep(900);
    for (let i = 30; i < 120; i++) rc.update({ ...sub, z: sub.z + i * 0.05 }, 1 / 60, i / 60, pose);
    return { pos: pose.pos.clone(), target: pose.target.clone(), d: pose.pos.distanceTo(pose.target) };
  } finally { CM.setCanopySourceForTests(null); T.setCityTerrain(null); }
}

test('W9-C7: an open street — the look swings the camera round the rider, away from the point (W4-G9 as before)', async () => {
  const r = await ride([]);
  assert.ok(r.pos.x < SX - 8, `west of the rider, looking east toward the point (x ${(r.pos.x - SX).toFixed(1)})`);
  assert.ok(r.d > 12, `at its distance (${r.d.toFixed(1)} u)`);
});

test('W9-C7: low houses where the look puts the camera — it rises over their roofs instead of pulling in to their wall', async () => {
  const r = await ride([houses(6)]);
  assert.ok(r.pos.x < SX - 4, `still the look's side (x ${(r.pos.x - SX).toFixed(1)})`);
  assert.ok(r.d > 10, `not pulled in to the wall (${r.d.toFixed(1)} u; before W9-C7 ≈ 4–5)`);
  assert.ok(r.pos.y > 6.3, `over the roofs (y ${r.pos.y.toFixed(1)})`);
});

test('W9-C7: tall houses no rise clears — the look is dropped: the Metro\'s own shot from behind, at its distance, out of the houses', async () => {
  const r = await ride([houses(14)]);
  assert.ok(r.pos.x > SX - 4, `not in the houses (x ${(r.pos.x - SX).toFixed(1)})`);
  assert.ok(r.d > 12, `at its distance (${r.d.toFixed(1)} u; before W9-C7 the pull-in parked it ≈ 4 u off the rider against the house front)`);
  assert.ok(r.pos.z < r.target.z - 8, 'behind the train, along the street');
});
