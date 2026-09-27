import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { onEvent, type GameEvent } from '../src/opus-bay/core/events';
import { game } from '../src/opus-bay/core/store';
import { PlayerController } from '../src/opus-bay/actors/controller';
import { MoveSystem } from '../src/opus-bay/actors/moveSystem';
import * as moveApi from '../src/opus-bay/actors/moveApi';

// Lane E2, wave 3, part a: the cross-lane hooks other lanes wait for (setGlideUnlocked for G1's save v2, obstacle
// sources in giveWay for F's crowd and traffic), then the transit rider, touch, gamepad and pant work.

const DT = 1 / 60;

function moveEnv(c: PlayerController) {
  return { cameraYaw: Math.PI, frozen: false, playing: true, controller: c, frustum: new THREE.Frustum() };
}

// ---------------------------------------------------------------------------
// setGlideUnlocked (G1's save v2 restore)
// ---------------------------------------------------------------------------

test('moveApi.setGlideUnlocked: applied at the bind when called before it, quiet (no unlock event), and locks again', () => {
  const events: GameEvent[] = [];
  const off = onEvent(e => { if (e.type === 'glide:unlock') events.push(e); });
  moveApi.bindMoveApi(null);
  moveApi.setGlideUnlocked(true);
  assert.equal(moveApi.glideUnlocked(), true, 'before the bind: the pending value answers');
  const ms = new MoveSystem();
  assert.equal(ms.glideUnlocked, false, 'a fresh system starts locked (no viewpoint, no ?debug)');
  moveApi.bindMoveApi(ms);
  try {
    assert.equal(ms.glideUnlocked, true, 'the pending restore is applied at the bind');
    assert.equal(moveApi.glideUnlocked(), true);
    const c = new PlayerController();
    game.set({ phase: 'playing' });
    ms.update(DT, 0, moveEnv(c));
    assert.equal(events.length, 0, 'a restored unlock is quiet');
    moveApi.setGlideUnlocked(false);
    assert.equal(moveApi.glideUnlocked(), false, 'Settings reset locks it again');
    moveApi.setGlideUnlocked('yes' as unknown as boolean);
    assert.equal(moveApi.glideUnlocked(), false, 'junk is ignored');
    moveApi.setGlideUnlocked(true);
    assert.equal(ms.glideUnlocked, true);
  } finally { off(); moveApi.bindMoveApi(null); ms.dispose(); game.set({ phase: 'title' }); }
  moveApi.bindMoveApi(null);
  const ms2 = new MoveSystem();
  moveApi.bindMoveApi(ms2);
  try { assert.equal(ms2.glideUnlocked, false, 'the pending value is used once'); } finally { moveApi.bindMoveApi(null); ms2.dispose(); }
});
