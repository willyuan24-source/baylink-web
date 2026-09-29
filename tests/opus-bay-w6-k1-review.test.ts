import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * W6-K1 review (docs/opus-bay/sf-w6-K1.md "## Review"): defects found in lane K1's commits while playing them.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const T = await import('../src/opus-bay/core/terrain');

test('W6-K1 review: SEATED on a narrow street the swung cable-car shot stays level with the bench and short of straight behind (from above, the roof hid the sitter)', async () => {
  const THREE = await import('three');
  const { RideCamera, SEAT_SWING_MAX } = await import('../src/opus-bay/actors/cameraModes');
  const SX = 7000, SZ = 7000, SR = 80;
  type Blk = import('../src/opus-bay/core/terrain').Blocker;
  const rect = (x0: number, z0: number, x1: number, z1: number, top: number): Blk => ({ kind: 'polygon', polygon: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }], top });
  const world = (blockers: Blk[]) => {
    const inside = (x: number, z: number) => Math.abs(x - SX) < SR && Math.abs(z - SZ) < SR;
    const overlap = (b: Blk, x: number, z: number, r: number) => (b.kind === 'circle' ? Math.hypot(x - b.x, z - b.z) < r + b.r : T.distanceToPolygon(x, z, b.polygon) < r);
    const hits = (x: number, z: number, r: number) => blockers.some(b => overlap(b, x, z, r));
    T.setCityTerrain({
      heightAt: (x, z) => (inside(x, z) ? 0 : null), surfaceCode: (x, z) => (inside(x, z) ? 1 : 0),
      kindAt: (x, z) => (inside(x, z) ? T.KIND.land : T.KIND.outside), standAt: () => 1,
      forEachBlockerNear: (x, z, r, fn) => { for (const b of blockers) if (overlap(b, x, z, r + 0.5)) fn(b); },
      hitsBlocker: hits, blockedAt: (x, z) => hits(x, z, 0.45),
    });
  };
  // the car runs up the street's middle along +z (heading 0); the sitter on the outward bench, 1.3 u to the side
  const base = { mode: 'transit' as const, x: SX + 1.3, y: 0.9, z: SZ, heading: 0, speed: 4, gradeAhead: 0, side: 1 as const, occlude: true, kind: 'cable-car' as const };
  const run = (seated: boolean) => {
    const rc = new RideCamera(), pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 46 };
    for (let i = 0; i < 180; i++) rc.update({ ...base, seated, z: base.z + i * 0.066 }, 1 / 60, i / 60, pose);
    const dx = pose.pos.x - pose.target.x, dz = pose.pos.z - pose.target.z;
    return { rc, pose, elev: Math.atan2(pose.pos.y - pose.target.y, Math.hypot(dx, dz)) };
  };
  const inWall = (x: number) => x > SX + 3.6 || x < SX - 3.6;
  try {
    // Hyde St: houses wall to wall 3.6 u either side of the car's axis, 12 u tall
    world([rect(SX + 3.6, SZ - 70, SX + 30, SZ + 70, 12), rect(SX - 30, SZ - 70, SX - 3.6, SZ + 70, 12)]);
    const seat = run(true);
    assert.ok(seat.elev < 0.15, `seated: the shot stays level with the bench (elevation ${seat.elev.toFixed(2)} rad; the roof hides the sitter from above)`);
    assert.ok(seat.rc.swing > 0.3 && seat.rc.swing <= SEAT_SWING_MAX + 1e-6, `seated: swung to the rear quarter, not straight behind (${seat.rc.swing.toFixed(2)})`);
    assert.ok(!inWall(seat.pose.pos.x), `seated: the camera is in the street (x ${(seat.pose.pos.x - SX).toFixed(2)} from the axis)`);
    assert.ok(seat.pose.pos.x - SX > 1.3, `seated: on the bench's side of the car (x ${(seat.pose.pos.x - SX).toFixed(2)})`);
    // standing on the running board: lane K1's shot (behind, raised over the roof and the trees) is unchanged
    const stand = run(false);
    assert.ok(stand.rc.swing > 0.7, `standing: swung round toward behind (${stand.rc.swing.toFixed(2)})`);
    assert.ok(stand.elev > 0.3, `standing: raised over the car (${stand.elev.toFixed(2)})`);
    // an open street: the seated side-on shot stays
    world([]);
    const open = run(true);
    assert.ok(open.rc.swing < 0.05, `seated, open street: side-on (${open.rc.swing.toFixed(2)})`);
  } finally { T.setCityTerrain(null); }
});
