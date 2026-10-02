/**
 * W9-C3 · the arrival reveals (review R§5 #15; docs/opus-bay/sf-w9-C.md part b): the photo line clears street trees and
 * roofs (the Painted Ladies' cone tree), an overlook's reveal looks out at its view (Twin Peaks: downtown, not west), Coit
 * Tower gets a reveal of the tower, a pelican landing faces the arrival's heading, and the crowd leaves the lens.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const R = await import('../src/opus-bay/actors/reveal');
const { LANDMARK_ARRIVALS } = await import('../src/opus-bay/data/sf/arrivals');
const { arrivalHeading } = await import('../src/opus-bay/actors/arrivalFace');
const { inLens, LENS_HIDE } = await import('../src/opus-bay/world/sf/crowd');

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

test('W9-C3: clearPhotoPose — a clear line is kept; a line through a tree turns round the target (the least change first); nothing clear: the least blocked', () => {
  const photo = { pos: { x: 0, y: 5, z: 30 }, target: { x: 0, y: 4, z: 0 } };
  assert.deepEqual(R.clearPhotoPose(photo, () => 0), photo);
  // a tree on the straight line (x ≈ 0, z ≈ 15): blocked while the line passes within 1.5 u of it
  const tree = (a: { x: number; z: number }, b: { x: number; z: number }) => {
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((0 - a.x) * dx + (15 - a.z) * dz) / L2));
    return Math.hypot(a.x + dx * t, a.z + dz * t - 15) < 1.5 ? 3 : 0;
  };
  const cleared = R.clearPhotoPose(photo, tree);
  assert.equal(tree(cleared.pos, cleared.target), 0, 'the new line misses the tree');
  assert.deepEqual(cleared.target, photo.target, 'the same subject');
  const turn = Math.abs(wrap(Math.atan2(cleared.pos.x, cleared.pos.z) - 0));
  assert.ok(turn > 0.05 && turn <= 0.29, `turned a little round the target: ${turn.toFixed(2)} rad`);
  assert.ok(Math.abs(Math.hypot(cleared.pos.x, cleared.pos.y - 4, cleared.pos.z) - Math.hypot(30, 1)) < 1e-6, 'at the same distance');
  const stuck = R.clearPhotoPose(photo, () => 2);
  assert.deepEqual(stuck, photo, 'everything blocked alike: the photo pose as it was');
});

test('W9-C3: planReveal clears the photo line when given a sight test, and a vista turns round the player (its pivot)', () => {
  const start = { pos: { x: 0, y: 8, z: -15 }, target: { x: 0, y: 1.6, z: 0 } };
  const player = { x: 0, y: 0, z: 0 };
  const photo = { pos: { x: 0, y: 5, z: 30 }, target: { x: 0, y: 4, z: 0 } };
  const blocked = (a: { x: number }) => (Math.abs(a.x) < 0.5 ? 1 : 0);
  const plan = R.planReveal(start, photo, player, undefined, { sight: blocked });
  assert.ok(Math.abs(plan.photo.pos.x) >= 0.5, 'the plan holds the cleared photo pose');
  const v = R.revealView('twin-peaks', { x: 128.86, y: 46, z: 922.32 })!;
  const vplan = R.planReveal(start, v.photo, player, undefined, { pivot: v.pivot });
  assert.deepEqual(vplan.pivot, v.pivot);
  assert.deepEqual(R.planReveal(start, photo, player).pivot, photo.target, 'no option: the photo target as before');
});

test('W9-C3 (R§5 #15 "飞到双峰默认朝西"): Twin Peaks\' reveal looks out at downtown, behind and over the player; the T2 overlooks and Lands End face their views; Coit Tower has a reveal of the tower', () => {
  const tp = LANDMARK_ARRIVALS['twin-peaks'];
  const player = { x: tp.x, y: 46, z: tp.z };
  const v = R.revealView('twin-peaks', player)!;
  // downtown (Salesforce Tower at the head of Market St, the Bay Bridge beyond) is north of the summit in this world
  const look = Math.atan2(v.photo.target.x - v.photo.pos.x, v.photo.target.z - v.photo.pos.z);
  const downtown = Math.atan2(166 - tp.x, 108 - tp.z);
  assert.ok(Math.abs(wrap(look - downtown)) < 0.02, `the reveal looks toward downtown (${look.toFixed(2)} vs ${downtown.toFixed(2)})`);
  assert.ok(Math.abs(wrap(look - tp.heading)) < 0.2, 'the same way the overlook\'s arrival faces (data/sf/arrivals.ts)');
  assert.ok(Math.abs(wrap(look - (-Math.PI / 2))) > 1.2, 'not west');
  assert.ok(v.photo.pos.y > player.y + 5 && v.photo.target.y < v.photo.pos.y, 'over the player, looking a little down at the city');
  assert.deepEqual(v.pivot, player, 'the swing turns round the player');
  for (const id of ['mount-davidson', 'bernal-heights-park', 'corona-heights-randall-museum', 'lands-end']) assert.ok(R.revealView(id, player), id);
  const coit = R.revealView('coit-tower', player)!;
  assert.ok(coit && !coit.pivot, 'Coit Tower: a subject reveal (round the tower)');
  assert.ok(Math.hypot(coit.photo.pos.x - -50.25, coit.photo.pos.z - 51.1) > 25 && coit.photo.target.y > 20, 'the camera off the tower, looking at the shaft over its 20 u hill');
  assert.equal(R.revealView('alamo-square-painted-ladies', player), null, 'the landmarks keep their own photo poses');
});

test('W9-C3: a pelican landing faces the arrival heading — an overlook\'s view, a landmark\'s arrival heading, else toward the attraction', () => {
  const tp = LANDMARK_ARRIVALS['twin-peaks'];
  const h = arrivalHeading({ id: 'twin-peaks', x: 125.7, z: 937.8, landmarkId: 'twin-peaks' }, tp)!;
  assert.ok(Math.abs(wrap(h - Math.atan2(166 - tp.x, 108 - tp.z))) < 1e-9, 'Twin Peaks: toward downtown');
  const pl = LANDMARK_ARRIVALS['painted-ladies'];
  assert.equal(arrivalHeading({ id: 'alamo-square-painted-ladies', x: -7.5, z: 586.5, landmarkId: 'painted-ladies' }, pl), pl.heading);
  const toward = arrivalHeading({ id: 'pier-39', x: -154.6, z: 26.6 }, { x: -154.6, z: 46.6 })!;
  assert.ok(Math.abs(wrap(toward - Math.PI)) < 1e-9, 'toward the attraction (20 u to the north)');
  assert.equal(arrivalHeading({ id: 'pier-39', x: -154.6, z: 26.6 }, { x: -152, z: 28 }), null, 'standing on it: nothing to turn to');
});

test('W9-C3: the crowd\'s lens rule — a walker close in front of the lens or on the line to the subject hides; by the subject, behind the camera or off to the side stays', () => {
  // the camera looks along +z at a subject 20 u away
  const at = (x: number, z: number, y = 0) => inLens(x, y, z, 0, 0, 1, 20);
  assert.equal(at(0, 3), 0, '3 u in front of the lens, on the axis');
  assert.equal(at(0.5, 12), 0, 'on the view line, short of the subject');
  assert.equal(at(0, 19), 1, 'next to the subject');
  assert.equal(at(0, -3), 1, 'behind the camera');
  assert.equal(at(4, 4), 1, 'off to the side');
  assert.ok(at(LENS_HIDE.cone * 5 + 0.6, 5) >= 0.999 && at(LENS_HIDE.cone * 5 - 0.05, 5) < 0.05, 'the cone\'s edge');
});
