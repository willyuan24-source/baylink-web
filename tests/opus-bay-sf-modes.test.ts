import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALIGHT_SPEED, BRAKE_DECEL, ENTER_RADIUS, MoveMachine, TIMING, doorSlots, nearestEnterSlot, pickExitSlot, slotClear,
  type DoorSlot, type SlotWorld,
} from '../src/opus-bay/actors/modes';
import { game, initialGameState, syncMovePatch } from '../src/opus-bay/core/store';
import { canStand, heightAt } from '../src/opus-bay/core/terrain';
import { DISTRICT } from '../src/opus-bay/data/district';
import { VEHICLE_SPOTS, bikeSpots } from '../src/opus-bay/data/vehicles';
import { poseCheck, TERRAIN_WORLD } from '../src/opus-bay/actors/vehicles/collide';
import { BIKE_SPEC } from '../src/opus-bay/actors/vehicles/bike';
import { CAR_SPEC } from '../src/opus-bay/actors/vehicles/toyCar';

const DT = 1 / 60;
/** open flat ground with an optional wall at x ≥ wallX */
function flatWorld(wallX = Infinity): SlotWorld {
  return {
    canStand: (x, _z, r) => x + r < wallX,
    heightAt: () => 0,
  };
}
const TERRAIN: SlotWorld = { canStand, heightAt };

function board(m: MoveMachine, kind: 'bike' | 'car') {
  const r = m.enter(kind, { slotDistance: 1, playerSpeed: 0, vehicleSpeed: 0 });
  assert.ok(r.ok, 'boarding starts');
  assert.equal(m.mode, kind, 'mode switches at the start of boarding');
  assert.equal(m.phase, 'boarding');
  let done = false;
  for (let t = 0; t < 1 && !done; t += DT) done = m.tick(DT, { vehicleSpeed: 0, findExitSlot: () => null }).some(o => o.type === 'boarded');
  assert.ok(done, 'boarded');
  assert.equal(m.phase, 'steady');
}

test('door slots: four slots at ±(W/2 + 0.9) to the sides and ±(L/2 + 0.6) fore / aft', () => {
  const slots = doorSlots(10, 20, 0.7, 1.0, 1.8);
  assert.deepEqual(slots.map(s => s.side), ['left', 'right', 'back', 'front']);
  const d = (s: DoorSlot) => Math.hypot(s.x - 10, s.z - 20);
  assert.ok(Math.abs(d(slots[0]) - 1.4) < 1e-9 && Math.abs(d(slots[1]) - 1.4) < 1e-9);
  assert.ok(Math.abs(d(slots[2]) - 1.5) < 1e-9 && Math.abs(d(slots[3]) - 1.5) < 1e-9);
  // front is along the heading (sin h, cos h); left is local +x (cos h, −sin h)
  assert.ok(Math.abs(slots[3].x - (10 + Math.sin(0.7) * 1.5)) < 1e-9 && Math.abs(slots[3].z - (20 + Math.cos(0.7) * 1.5)) < 1e-9);
  assert.ok(Math.abs(slots[0].x - (10 + Math.cos(0.7) * 1.4)) < 1e-9 && Math.abs(slots[0].z - (20 - Math.sin(0.7) * 1.4)) < 1e-9);
});

test('slots: a wall blocks the slot behind it and the straight line through it', () => {
  const w = flatWorld(5);
  assert.ok(slotClear(w, { x: 0, z: 0 }, { x: 2, z: 0 }, 0));
  assert.equal(slotClear(w, { x: 0, z: 0 }, { x: 4.8, z: 0 }, 0), false, 'slot disc overlaps the wall');
  // a car parked with its left side against the wall gets out on the right
  const car = { x: 4.2 - 0.5, z: 0, y: 0, heading: -Math.PI / 2 };
  const slot = pickExitSlot(w, car, 1.0, 1.8);
  assert.ok(slot && slot.x < 5 - 0.45, `exit slot away from the wall: ${JSON.stringify(slot)}`);
  // walled in on every side: no slot
  const boxed: SlotWorld = { canStand: (x, z, r) => Math.hypot(x, z) + r < 0.9, heightAt: () => 0 };
  assert.equal(pickExitSlot(boxed, { x: 0, z: 0, y: 0, heading: 0 }, 1.0, 1.8), null);
  // a slot 1 u higher than the car floor (a ledge) is not usable
  const ledge: SlotWorld = { canStand: () => true, heightAt: x => (x > 1 ? 1 : 0) };
  assert.equal(slotClear(ledge, { x: 0, z: 0 }, { x: 1.4, z: 0 }, 0), false);
});

test('FSM guards: entering needs a reachable slot within 2.4 u and both stopped', () => {
  const m = new MoveMachine();
  assert.deepEqual(m.enter('car', { slotDistance: null, playerSpeed: 0, vehicleSpeed: 0 }), { ok: false, reason: 'far' });
  assert.deepEqual(m.enter('car', { slotDistance: ENTER_RADIUS + 0.1, playerSpeed: 0, vehicleSpeed: 0 }), { ok: false, reason: 'far' });
  assert.deepEqual(m.enter('car', { slotDistance: 1, playerSpeed: 0, vehicleSpeed: 3 }), { ok: false, reason: 'moving' });
  assert.deepEqual(m.enter('car', { slotDistance: 1, playerSpeed: 2, vehicleSpeed: 0 }), { ok: false, reason: 'moving' });
  assert.equal(m.mode, 'foot');
  board(m, 'car');
  assert.deepEqual(m.enter('bike', { slotDistance: 1, playerSpeed: 0, vehicleSpeed: 0 }), { ok: false, reason: 'busy' }, 'already driving');
});

test('FSM: getting out of a moving vehicle auto-brakes first (24 u/s², ≤ 0.7 s), then alights in 0.4 s', () => {
  const m = new MoveMachine();
  board(m, 'bike');
  let v = 10;
  assert.ok(m.exit().ok);
  assert.equal(m.phase, 'braking');
  assert.ok(m.braking && m.inputLocked);
  const slot: DoorSlot = { x: 1, z: 0, side: 'left' };
  let t = 0, alightAt = -1, outcome = null as null | { type: string };
  for (; t < 2 && m.mode !== 'foot'; t += DT) {
    if (m.braking) v = Math.max(0, v - BRAKE_DECEL * DT);
    const out = m.tick(DT, { vehicleSpeed: v, findExitSlot: () => slot });
    if (m.phase === 'alighting' && alightAt < 0) alightAt = t;
    if (out.length) outcome = out[0];
  }
  assert.ok(alightAt > 0 && alightAt <= TIMING.brakeMax + DT, `alighting starts after the brake: ${alightAt.toFixed(2)} s`);
  assert.ok(v < ALIGHT_SPEED + 0.5, `slow before stepping off (${v.toFixed(2)})`);
  assert.equal(m.mode, 'foot');
  assert.ok(Math.abs(t - alightAt - TIMING.alight) < 0.05, 'alight takes 0.4 s');
  assert.deepEqual(outcome, { type: 'alighted', vehicle: 'bike', slot });
});

test('FSM: no clear slot → "这里下不了车" (blocked), still driving', () => {
  const m = new MoveMachine();
  board(m, 'car');
  m.exit();
  let blocked = false;
  for (let t = 0; t < 1.2; t += DT) {
    const out = m.tick(DT, { vehicleSpeed: 0, findExitSlot: () => null });
    if (out.some(o => o.type === 'blocked' && o.reason === 'no-slot')) blocked = true;
  }
  assert.ok(blocked);
  assert.equal(m.mode, 'car');
  assert.equal(m.phase, 'steady');
  assert.ok(m.exit().ok, 'can try again');
});

test('FSM: no glide before it is unlocked; take-off 1 s, landing needs a spot', () => {
  const m = new MoveMachine();
  assert.deepEqual(m.takeOff({ unlocked: false, grounded: true }), { ok: false, reason: 'locked' });
  assert.deepEqual(m.takeOff({ unlocked: true, grounded: false }), { ok: false, reason: 'airborne' });
  assert.equal(m.mode, 'foot');
  assert.ok(m.takeOff({ unlocked: true, grounded: true }).ok);
  assert.equal(m.mode, 'glide');
  assert.equal(m.phase, 'takeoff');
  let t = 0;
  for (; t < 2 && m.phase !== 'steady'; t += DT) m.tick(DT, { vehicleSpeed: 0, findExitSlot: () => null });
  assert.ok(Math.abs(t - TIMING.takeoff) < 0.05, `take-off lasts 1 s (${t.toFixed(2)})`);
  assert.deepEqual(m.land({ spotFound: false, seconds: 2 }), { ok: false, reason: 'no-landing' });
  assert.equal(m.mode, 'glide');
  assert.ok(m.land({ spotFound: true, seconds: 2.4 }).ok);
  let landed = false;
  for (t = 0; t < 4 && !landed; t += DT) landed = m.tick(DT, { vehicleSpeed: 0, findExitSlot: () => null }).some(o => o.type === 'landed');
  assert.ok(landed && m.mode === 'foot');
  assert.ok(t <= TIMING.landMax + 0.05);
});

test('FSM: sit settles in 0.35 s; standing up returns to foot', () => {
  const m = new MoveMachine();
  assert.deepEqual(m.sit({ grounded: false }), { ok: false, reason: 'airborne' });
  assert.ok(m.sit({ grounded: true }).ok);
  assert.equal(m.mode, 'sit');
  const outs: string[] = [];
  for (let t = 0; t < 0.5; t += DT) outs.push(...m.tick(DT, { vehicleSpeed: 0, findExitSlot: () => null }).map(o => o.type));
  assert.deepEqual(outs, ['sat']);
  assert.ok(m.stand().ok);
  for (let t = 0; t < 0.5; t += DT) outs.push(...m.tick(DT, { vehicleSpeed: 0, findExitSlot: () => null }).map(o => o.type));
  assert.equal(m.mode, 'foot');
  assert.deepEqual(outs, ['sat', 'stood']);
});

test('FSM: transit spot switching (rail ↔ seat, stick = deck) and ending the ride', () => {
  const m = new MoveMachine();
  m.beginTransit('streetcar');
  assert.equal(m.mode, 'transit');
  assert.equal(m.spot, 'rail');
  assert.equal(m.switchSpot().ok, false, 'not while boarding');
  for (let t = 0; t < 0.6; t += DT) m.tick(DT, { vehicleSpeed: 0, findExitSlot: () => null });
  assert.ok(m.switchSpot().ok);
  assert.equal(m.spot, 'seat');
  m.walkDeck();
  assert.equal(m.spot, 'deck');
  m.switchSpot();
  assert.equal(m.spot, 'rail', 'E from the deck: back to the rail');
  m.endTransit();
  assert.equal(m.mode, 'foot');
  assert.equal(m.spot, null);
});

test('store: move and the legacy riding flag stay consistent whichever one is written', () => {
  const s = initialGameState();
  assert.deepEqual(s.move, { mode: 'foot' });
  const a = syncMovePatch(s, { riding: 'streetcar' });
  assert.deepEqual(a.move, { mode: 'transit', line: 'streetcar', spot: 'rail' });
  const s2 = { ...s, ...a };
  assert.deepEqual(syncMovePatch(s2, { riding: null }).move, { mode: 'foot' });
  assert.equal(syncMovePatch(s, { move: { mode: 'transit', line: 'streetcar', spot: 'seat' } }).riding, 'streetcar');
  assert.equal(syncMovePatch(s2, { move: { mode: 'bike' } }).riding, null);
  assert.deepEqual(syncMovePatch(s, { photoMode: true }).move, { mode: 'photo' });
  const biking = { ...s, move: { mode: 'bike' as const } };
  assert.equal(syncMovePatch(biking, { photoMode: true }).move, undefined, 'photo in a vehicle only freezes');
  // through the real store (flow.ts writes riding)
  const before = game.get();
  try {
    game.set({ riding: 'streetcar' });
    assert.equal(game.get().move.mode, 'transit');
    game.set({ riding: null });
    assert.equal(game.get().move.mode, 'foot');
  } finally { game.set({ riding: before.riding, move: before.move }); }
});

test('vehicle spots: every parked bike / the toy car fits its hull and has a door slot the player can reach', () => {
  const spots = [...bikeSpots(), ...VEHICLE_SPOTS.filter(s => s.kind === 'car')];
  assert.ok(spots.filter(s => s.kind === 'bike').length >= 4, 'bikes at the district racks + extra spots');
  assert.equal(spots.filter(s => s.kind === 'car').length, 1, 'one toy car in the district');
  for (const s of spots) {
    const spec = s.kind === 'car' ? CAR_SPEC : BIKE_SPEC;
    const fit = poseCheck(TERRAIN_WORLD, spec, s.x, s.z, s.heading);
    assert.ok(fit.ok, `${s.id} fits (${fit.reason} at probe ${fit.probe})`);
    const y = heightAt(s.x, s.z);
    const slot = pickExitSlot(TERRAIN, { x: s.x, z: s.z, y, heading: s.heading }, s.kind === 'car' ? 1.0 : 0.5, s.kind === 'car' ? 1.8 : 1.3);
    assert.ok(slot, `${s.id} has an exit slot`);
    assert.ok(nearestEnterSlot(TERRAIN, slot!, { x: s.x, z: s.z, y, heading: s.heading }, s.kind === 'car' ? 1.0 : 0.5, s.kind === 'car' ? 1.8 : 1.3), `${s.id} enterable from its slot`);
  }
  // the car waits at the Ferry Building plaza edge
  const car = spots.find(s => s.kind === 'car')!;
  const ferry = DISTRICT.anchors['ferry-clock'];
  assert.ok(Math.hypot(car.x - ferry.x, car.z - ferry.z) < 40, 'toy car near the Ferry Building');
});
