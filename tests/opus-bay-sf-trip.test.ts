import assert from 'node:assert/strict';
import test from 'node:test';
import { RUN_SPEED, WALK_SPEED } from '../src/opus-bay/actors/controller';
import { BIKE_PURSUIT, CAR_PURSUIT } from '../src/opus-bay/actors/vehicles/autopilot';
import { CABLE } from '../src/opus-bay/data/transit';
import { DESCENT_S, PAN_SPEED, PICKUP_S, RISE_S } from '../src/opus-bay/game/fastTravel';
import { RIDEABLE_R as TRAVEL_RIDEABLE_R } from '../src/opus-bay/game/travel';
import {
  ALIGHT_S, FLY_NOTE, FLY_TIMING, GOAL_SLACK, HERE_R, LINE_MODELS, LINE_WALK_MAX, MAX_OPTIONS, MOUNT_S, RIDEABLE_R, RUN_AFTER_S,
  STREET_FACTOR, TRIP_SPEED, type TripDestination, type TripLineInfo, type TripProviders, TripRouteCache, arcSpan,
  arriveYourselfGoalRule, cableCarGoalRule, flySeconds, lineDisplayName, linePathSlice, lineRideGoalRule, modelRideSeconds,
  optionPending, optionSummary, planTrips, stopsBetween, tripRemainingSeconds, tripTimeLabel, tunnelLength,
} from '../src/opus-bay/game/tripPlan';
import { TRIP_MODES, type TripLineLeg, type TripOption } from '../src/opus-bay/game/tripTypes';

/**
 * Lane G (W4-G1): the trip planner (plan §4.2 "Trip planner"; acceptance `sf-trip`): walk = length / 4.2; a line option
 * only when both ends are within 150 u of stops on one line and it includes walk + wait + ride + walk; fly only when
 * discovered; sorted; 推荐 = fastest non-fly or the goal one; bilingual labels. Every constant is pinned against the code
 * that really moves the player.
 */

const straight = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(b.x - a.x, b.z - a.z);
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const one = <T>(list: T[], f: (x: T) => boolean) => { const r = list.filter(f); assert.equal(r.length, 1); return r[0]; };

/** a straight double-ended "N" line along +z from (0, 0) to (0, 2000); underground 0–500 */
const N_LINE: TripLineInfo = {
  id: 'n-judah', kind: 'light-rail', name: { zh: 'N 线', en: 'N Judah' }, short: 'N', length: 2000,
  tunnels: [{ fromAt: 0, toAt: 500 }],
  stops: [0, 250, 500, 700, 900, 1100, 1300, 1500, 1700, 2000].map((at, i) => ({
    id: `n${i}`, at, x: 0, z: at, name: { zh: `N 站${i}`, en: `N stop ${i}` }, major: i % 3 === 0 || i === 9,
  })),
  path: [0, 0, 0, 0, 5, 1000, 0, 10, 2000],
};

/** a one-way loop round a 250 × 250 square (1000 u), stops every 100 u */
const sq = (at: number) => {
  const s = ((at % 1000) + 1000) % 1000;
  if (s <= 250) return { x: s, z: 0 };
  if (s <= 500) return { x: 250, z: s - 250 };
  if (s <= 750) return { x: 750 - s, z: 250 };
  return { x: 0, z: 1000 - s };
};
const LOOP: TripLineInfo = {
  id: 'sf-loop', kind: 'bus', name: { zh: '旧金山观光环线', en: 'SF Sightseeing Loop' }, short: '观光', length: 1000, loop: true,
  stops: Array.from({ length: 10 }, (_, i) => ({ id: `b${i}`, at: i * 100, ...sq(i * 100), name: { zh: `巴士站${i}`, en: `Bus stop ${i}` } })),
  path: [0, 0, 0, 250, 0, 0, 250, 0, 250, 0, 0, 250, 0, 0, 0],
};

const CABLE_LINE: TripLineInfo = {
  id: 'california', kind: 'cable-car', name: { zh: '加州街叮当车', en: 'California St cable car' }, length: 320,
  stops: [0, 80, 160, 240, 320].map((at, i) => ({ id: `c${i}`, at, x: 3000 + at, z: 0, major: i % 2 === 0 })),
};

const dest = (x: number, z: number, placeId = 'palace'): TripDestination => ({ placeId, x, z, name: { zh: '艺术宫', en: 'Palace of Fine Arts' } });

test('constants: the speeds and timings are the ones that really move the player', () => {
  assert.equal(TRIP_SPEED.walk, WALK_SPEED);
  assert.equal(TRIP_SPEED.run, RUN_SPEED);
  // the autopilot cruises at 7 (bike) / 10 (car) and slows for corners: the average is below the cruise
  assert.ok(TRIP_SPEED.bike < BIKE_PURSUIT.cruise && TRIP_SPEED.bike > BIKE_PURSUIT.cruise * 0.8);
  assert.ok(TRIP_SPEED.car < CAR_PURSUIT.cruise && TRIP_SPEED.car > CAR_PURSUIT.cruise * 0.8);
  assert.equal(RIDEABLE_R, TRAVEL_RIDEABLE_R);
  assert.equal(FLY_TIMING.pickup, PICKUP_S);
  assert.equal(FLY_TIMING.rise, RISE_S);
  assert.equal(FLY_TIMING.descent, DESCENT_S);
  assert.equal(FLY_TIMING.panSpeed, PAN_SPEED);
  assert.equal(LINE_MODELS['cable-car'].speed, CABLE.speed);
  assert.equal(LINE_MODELS['cable-car'].dwell, CABLE.dwell);
  assert.equal(LINE_MODELS['cable-car'].wait, CABLE.dispatchSeconds);
  assert.equal(LINE_MODELS['cable-car'].accel, CABLE.grip);
  // plan §3.2: the loop lap ≈ 11.5 min of driving over 6,522 u, 8 s at every stop, dispatch ≤ 15 s
  assert.ok(Math.abs(6522 / LINE_MODELS.bus.speed / 60 - 11.5) < 0.1);
  assert.equal(LINE_MODELS.bus.dwell, 8);
  assert.ok(LINE_MODELS.bus.wait <= 15 && LINE_MODELS['light-rail'].wait <= 15);
  assert.equal(LINE_MODELS['light-rail'].tunnelSpeed, 25);
  assert.equal(STREET_FACTOR, 1.25);
  assert.equal(RUN_AFTER_S, 90);
  assert.equal(MOUNT_S, 3);
  assert.equal(LINE_WALK_MAX, 150);
  assert.equal(MAX_OPTIONS, 4);
});

test('walk = route length / 4.2; straight × 1.25 (estimate, 计算中…) until the route is known; no route → no walk', () => {
  const from = { x: 0, z: 0 }, to = dest(200, 0);
  const known = planTrips(from, to, { walk: () => ({ length: 260, path: [0, 0, 100, 60, 200, 0] }) });
  const w = one(known, o => o.mode === 'walk');
  assert.equal(w.legs.length, 1);
  assert.equal(w.legs[0].via, 'walk');
  assert.ok(near(w.seconds, 260 / 4.2));
  assert.ok(near(w.legs[0].length, 260));
  assert.deepEqual(w.legs[0].path, [0, 0, 100, 60, 200, 0]);
  assert.equal(w.legs[0].estimate, undefined);
  assert.equal(optionPending(w), false);

  const pending = planTrips(from, to, { walk: () => undefined });
  const e = one(pending, o => o.mode === 'walk');
  assert.ok(near(e.seconds, (200 * 1.25) / 4.2));
  assert.equal(e.legs[0].estimate, true);
  assert.equal(optionPending(e), true);
  // no providers at all: the estimate too
  assert.ok(near(one(planTrips(from, to), o => o.mode === 'walk').seconds, (200 * 1.25) / 4.2));
  // a route can never be shorter than the straight line (a bad answer is clamped)
  assert.ok(near(one(planTrips(from, to, { walk: () => ({ length: 50 }) }), o => o.mode === 'walk').legs[0].length, 200));
  // unreachable on foot: no walking row
  assert.equal(planTrips(from, to, { walk: () => null }).some(o => o.mode === 'walk' || o.mode === 'run'), false);
});

test('run only when the walk takes over 90 s, at 7.5 u/s on the same route', () => {
  const short = planTrips({ x: 0, z: 0 }, dest(300, 0), { walk: () => ({ length: 370 }) }); // 88 s
  assert.equal(short.some(o => o.mode === 'run'), false);
  const long = planTrips({ x: 0, z: 0 }, dest(300, 0), { walk: () => ({ length: 390 }) }); // 92.9 s
  const run = one(long, o => o.mode === 'run');
  assert.equal(run.legs[0].via, 'run');
  assert.ok(near(run.seconds, 390 / 7.5));
});

test('right here (< 4 u): no options', () => {
  assert.deepEqual(planTrips({ x: 0, z: 0 }, dest(HERE_R - 0.5, 0)), []);
});

test('bike / car only with one parked within 60 u: walk to it + 3 s mount + drive / 6.5 or 8.5; riding skips both', () => {
  const from = { x: 0, z: 0 }, to = dest(800, 0);
  const rideables = () => [
    { id: 'bike-a', kind: 'bike' as const, x: 30, z: 0, name: { zh: '小单车', en: 'Toy bike' } },
    { id: 'bike-far', kind: 'bike' as const, x: 55, z: 0 },
    { id: 'car-far', kind: 'car' as const, x: 90, z: 0 },
  ];
  const p: TripProviders = { rideables, walk: (a, b) => ({ length: straight(a, b) * 1.1 }), drive: (a, b) => ({ length: straight(a, b) * 1.2 }) };
  const list = planTrips(from, to, p);
  const bike = one(list, o => o.mode === 'bike');
  assert.equal(list.some(o => o.mode === 'car'), false, 'the car is 90 u away: not offered');
  assert.deepEqual(bike.legs.map(l => l.via), ['walk', 'bike']);
  const [walk, ride] = bike.legs;
  assert.ok(near(walk.seconds, (30 * 1.1) / 4.2));
  assert.equal(ride.via === 'bike' && ride.vehicle, 'bike-a', 'the nearest bike');
  assert.ok(near(ride.seconds, (770 * 1.2) / 6.5 + 3));
  assert.ok(near(bike.seconds, walk.seconds + ride.seconds));
  // riding the car already: no walk, no mount
  const riding = planTrips(from, to, { ...p, riding: () => 'car' });
  const car = one(riding, o => o.mode === 'car');
  assert.deepEqual(car.legs.map(l => l.via), ['car']);
  assert.ok(near(car.seconds, (800 * 1.2) / 8.5));
  // the drive route ends 20 u short (snapped to the drivable network): a last walking leg
  const snapped = planTrips(from, to, { ...p, riding: () => 'car', drive: (a, b) => ({ length: straight(a, b), end: { x: 780, z: 0 } }) });
  const c2 = one(snapped, o => o.mode === 'car');
  assert.deepEqual(c2.legs.map(l => l.via), ['car', 'walk']);
  assert.ok(near(c2.legs[1].seconds, (20 * 1.1) / 4.2));
  // no drive route: no row
  assert.equal(planTrips(from, to, { ...p, drive: () => null }).some(o => o.mode === 'bike'), false);
});

test('line: offered only when both ends are within 150 u of walking of stops on one line; walk + wait + ride + walk', () => {
  const walk = (a: { x: number; z: number }, b: { x: number; z: number }) => ({ length: straight(a, b) * 1.2 });
  const p: TripProviders = { walk, lines: () => [N_LINE] };
  // from near the stop at 250 (underground) to near the stop at 1500
  const from = { x: 60, z: 260 }, to = dest(-50, 1520);
  const list = planTrips(from, to, p);
  const line = one(list, o => o.mode === 'line');
  assert.deepEqual(line.legs.map(l => l.via), ['walk', 'line', 'walk']);
  const [w1, ride, w2] = line.legs as [TripOption['legs'][number], TripLineLeg, TripOption['legs'][number]];
  assert.equal(ride.line, 'n-judah');
  assert.equal(ride.board, 'n1');
  assert.equal(ride.alight, 'n7');
  assert.equal(ride.dir, 1);
  assert.equal(ride.stops, 6);
  assert.equal(ride.underground, true);
  assert.equal(ride.wait, LINE_MODELS['light-rail'].wait);
  assert.ok(near(ride.length, 1250));
  const board = N_LINE.stops[1], alight = N_LINE.stops[7];
  assert.ok(near(ride.seconds, ride.wait + modelRideSeconds(N_LINE, board, alight, 1) + ALIGHT_S));
  assert.ok(near(w1.seconds, (straight(from, board) * 1.2) / 4.2));
  assert.ok(near(w2.seconds, (straight(alight, to) * 1.2) / 4.2));
  assert.ok(near(line.seconds, w1.seconds + ride.seconds + w2.seconds));
  assert.ok(ride.path && ride.path.length >= 4, 'the ride leg carries the line path for the map');
  assert.ok(ride.label && /N 线/.test(ride.label.zh) && /N line/.test(ride.label.en));
  // the system's own ETA / ride estimate wins over the model
  const sys = one(planTrips(from, to, { ...p, lineWait: () => 7, lineRide: () => 90 }), o => o.mode === 'line');
  const r2 = sys.legs.find((l): l is TripLineLeg => l.via === 'line')!;
  assert.equal(r2.wait, 7);
  assert.ok(near(r2.seconds, 7 + 90 + ALIGHT_S));
  // the destination 200 u off the line: no line row
  assert.equal(planTrips(from, dest(200, 1500), p).some(o => o.mode === 'line'), false);
  // the start 170 u off the line: no line row either
  assert.equal(planTrips({ x: 170, z: 260 }, to, p).some(o => o.mode === 'line'), false);
  // the other way down a double-ended line: dir −1
  const back = one(planTrips({ x: 10, z: 1690 }, dest(0, 900), p), o => o.mode === 'line');
  const rb = back.legs.find((l): l is TripLineLeg => l.via === 'line')!;
  assert.equal(rb.dir, -1);
  assert.equal(rb.board, 'n8');
  assert.equal(rb.alight, 'n4');
  assert.equal(rb.underground, undefined);
  // a second line on the same track and stations (N and M under Market St): one row
  const twin: TripLineInfo = { ...N_LINE, id: 'm-ocean-view', short: 'M' };
  const both = planTrips(from, to, { ...p, lines: () => [N_LINE, twin] });
  assert.equal(both.filter(o => o.mode === 'line').length, 1);
});

test('line: a one-way loop only runs forward and wraps; a ride that saves nothing over walking is not offered', () => {
  const p: TripProviders = { walk: (a, b) => ({ length: straight(a, b) }), lines: () => [LOOP] };
  // from stop b9 (0, 100) to near b1 (100, 0): across the seam, 2 stops forward
  const list = planTrips({ x: 0, z: 100 }, dest(100, 5), p);
  // walking straight there (141 u, 34 s) beats waiting for the bus: no line row
  assert.equal(list.some(o => o.mode === 'line'), false);
  // far round the loop: from b2 (200, 0) to b8 (0, 200): forward 6 stops; walking 283 u → 67 s; the bus: 15 + 600 / 9.45 + …
  const far = planTrips({ x: 200, z: 0 }, dest(0, 200), p);
  assert.equal(far.some(o => o.mode === 'line'), false, 'still slower than walking the diagonal');
  // make walking slow (a canyon in between): the loop wins
  const slowWalk: TripProviders = { ...p, walk: (a, b) => ({ length: straight(a, b) < 20 ? straight(a, b) : straight(a, b) * 6 }) };
  const withBus = planTrips({ x: 200, z: 2 }, dest(0, 198), slowWalk);
  const bus = one(withBus, o => o.mode === 'line');
  const leg = bus.legs.find((l): l is TripLineLeg => l.via === 'line')!;
  assert.equal(leg.dir, 1);
  assert.equal(leg.board, 'b2');
  assert.equal(leg.alight, 'b8');
  assert.equal(leg.stops, 6);
  assert.ok(near(leg.length, 600));
  assert.ok(near(arcSpan(LOOP, 900, 100, 1), 200), 'wraps across the seam');
  assert.ok(near(arcSpan(LOOP, 100, 900, 1), 800));
  assert.equal(optionSummary(bus, new Map([[LOOP.id, LOOP]])).zh.startsWith('观光巴士 6 站 约'), true);
});

test('ride model: surface / tunnel speeds, dwells at halting stops, accel per halt', () => {
  const s = N_LINE.stops;
  // n1 (250, underground) → n4 (900): 250 u under at 25 u/s, 400 u on the surface at 10 u/s; n2 (500, tunnel edge) is
  // underground: 3 s; n3 (700) is major: 4 s and a halt; speed / accel for the start + stop, and once more for n3
  const t = modelRideSeconds(N_LINE, s[1], s[4], 1);
  assert.ok(near(t, 250 / 25 + 400 / 10 + 3 + 4 + (2 * 10) / 2.6, 1e-9));
  // n4 (900) → n6 (1300): n5 (1100) is a minor surface stop: no halt (a request stop)
  assert.ok(near(modelRideSeconds(N_LINE, s[4], s[6], 1), 400 / 10 + 10 / 2.6, 1e-9));
  assert.ok(near(tunnelLength(N_LINE, 250, 900, 1), 250));
  assert.deepEqual(stopsBetween(N_LINE, s[1], s[4], 1).map(x => x.id), ['n2', 'n3']);
  assert.deepEqual(stopsBetween(N_LINE, s[4], s[1], -1).map(x => x.id), ['n3', 'n2']);
  // the bus halts at every stop: b0 → b3 = 300 u, 2 stops between
  const b = LOOP.stops;
  assert.ok(near(modelRideSeconds(LOOP, b[0], b[3], 1), 300 / 9.45 + 2 * 8 + (3 * 9.45) / 2.6, 1e-9), 'start / stop + 2 halts');
  // the loop across the seam: b8 → b1 passes b9 and b0
  assert.deepEqual(stopsBetween(LOOP, b[8], b[1], 1).map(x => x.id), ['b9', 'b0']);
  // the cable car halts only at its dwell stops
  const c = CABLE_LINE.stops;
  assert.ok(near(modelRideSeconds(CABLE_LINE, c[0], c[4], 1), 320 / 9 + 4 + (2 * 9) / 3, 1e-9));
});

test('line path slices follow the line (reversed for dir −1, wrapped for loops)', () => {
  const up = linePathSlice(N_LINE, 250, 1500, 1)!;
  assert.ok(near(up[0], 0) && near(up[1], 250, 1e-3));
  assert.ok(near(up[up.length - 1], 1500, 1e-3));
  const down = linePathSlice(N_LINE, 1500, 250, -1)!;
  assert.ok(near(down[1], 1500, 1e-3) && near(down[down.length - 1], 250, 1e-3));
  const wrap = linePathSlice(LOOP, 900, 100, 1)!;
  // starts at b9 (0, 100), passes the corner (0, 0), ends at b1 (100, 0)
  assert.deepEqual(wrap.map(v => Math.round(v)), [0, 100, 0, 0, 100, 0]);
  assert.equal(linePathSlice({ ...LOOP, path: undefined }, 0, 100, 1), undefined);
});

test('fly only for discovered places: 0.8 + 1.0 + clamp(d / 400, 0.6, 3.5) + 2 + 1.2 s, with its caveat', () => {
  const to = dest(1200, 0);
  assert.equal(planTrips({ x: 0, z: 0 }, to, { discovered: () => false }).some(o => o.mode === 'fly'), false);
  const fly = one(planTrips({ x: 0, z: 0 }, to, { discovered: id => id === 'palace' }), o => o.mode === 'fly');
  assert.ok(near(fly.seconds, 0.8 + 1.0 + 3 + 2 + 1.2));
  assert.ok(near(flySeconds(100), 0.8 + 1 + 0.6 + 2 + 1.2));
  assert.ok(near(flySeconds(5000), 0.8 + 1 + 3.5 + 2 + 1.2));
  assert.equal(fly.legs[0].via === 'fly' && fly.legs[0].place, 'palace');
  assert.deepEqual(fly.note, FLY_NOTE);
  assert.equal(fly.recommended, undefined, 'never 推荐 while any other way exists');
});

test('sorted by seconds (ties in TRIP_MODES order), at most 4 rows, exactly one 推荐 = the fastest non-fly', () => {
  const from = { x: 0, z: 0 }, to = dest(0, 1500);
  const p: TripProviders = {
    walk: (a, b) => ({ length: straight(a, b) * 1.2 }),
    drive: (a, b) => ({ length: straight(a, b) * 1.3 }),
    rideables: () => [{ id: 'bike-1', kind: 'bike', x: 5, z: 0 }, { id: 'car-1', kind: 'car', x: 0, z: 8 }],
    lines: () => [N_LINE],
    discovered: () => true,
  };
  const list = planTrips(from, to, p);
  assert.ok(list.length <= MAX_OPTIONS);
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].seconds <= list[i].seconds);
  const rec = one(list, o => !!o.recommended);
  const fastestNonFly = list.filter(o => o.mode !== 'fly').sort((a, b) => a.seconds - b.seconds)[0];
  assert.equal(rec, fastestNonFly);
  assert.ok(list.some(o => o.mode === 'fly'), 'the fly row stays (fastest)');
  // walk (the slowest) is the row dropped, the on-foot choice stays as run
  assert.equal(list.some(o => o.mode === 'walk'), false);
  // ties keep the TRIP_MODES order
  const tie = planTrips({ x: 0, z: 0 }, dest(10, 0), { walk: () => ({ length: 10 }), riding: () => 'bike', drive: () => ({ length: 10 * 6.5 / 4.2 }) });
  assert.deepEqual(tie.map(o => o.mode), ['walk', 'bike']);
  assert.equal(tie[0].recommended, true);
  assert.ok(TRIP_MODES.indexOf('walk') < TRIP_MODES.indexOf('bike'));
  // only a fly row (nothing else reaches it): it is the 推荐
  const only = planTrips({ x: 0, z: 0 }, dest(900, 0), { walk: () => null, discovered: () => true });
  assert.deepEqual(only.map(o => [o.mode, o.recommended]), [['fly', true]]);
});

test('推荐 = the goal option when it costs at most fastest × 1.5 + 60 s ("顺便完成叮当车目标"); tagged either way', () => {
  const lines = () => [CABLE_LINE];
  const p: TripProviders = { walk: (a, b) => ({ length: straight(a, b) * 1.25 }), lines, goals: [cableCarGoalRule()] };
  // along the cable line: walking 320 u × 1.25 = 95 s; the cable car: 5 + 320 / 9 + … ≈ 51 s — both tagged / recommended
  const list = planTrips({ x: 3000, z: 5 }, dest(3320, 5), p);
  const cable = one(list, o => o.mode === 'line');
  assert.equal(cable.goal, 'cable-car');
  assert.equal(cable.note?.zh, '顺便完成叮当车目标');
  assert.equal(cable.recommended, true);
  // a faster bike exists: the cable car still wins while within the slack
  const withBike = planTrips({ x: 3000, z: 5 }, dest(3320, 5), { ...p, riding: () => 'bike', drive: (a, b) => ({ length: straight(a, b) }) });
  const bike = one(withBike, o => o.mode === 'bike');
  const c2 = one(withBike, o => o.mode === 'line');
  assert.ok(bike.seconds < c2.seconds);
  assert.ok(c2.seconds <= bike.seconds * GOAL_SLACK.k + GOAL_SLACK.s);
  assert.equal(c2.recommended, true);
  assert.equal(bike.recommended, undefined);
  // too short a ride (< 150 u) completes nothing
  const shortRide = planTrips({ x: 3000, z: 5 }, dest(3080, 5), { ...p, walk: (a, b) => ({ length: straight(a, b) * 5 }) });
  assert.equal(shortRide.some(o => o.goal), false);
  // the on-foot rule (twin-peaks: walk / run / bike / car, never fly or a line)
  const tp = arriveYourselfGoalRule('twin-peaks', ['twin-peaks'], { zh: '顺便完成登顶目标', en: 'Also completes the Twin Peaks goal' });
  const up = planTrips({ x: 0, z: 0 }, dest(400, 0, 'twin-peaks'), { walk: () => ({ length: 500 }), discovered: () => true, goals: [tp] });
  assert.equal(one(up, o => o.mode === 'walk').goal, 'twin-peaks');
  assert.equal(one(up, o => o.mode === 'fly').goal, undefined);
  // the metro rule: an N ride of ≥ 150 u that gets off at the terminus
  const metro = lineRideGoalRule('metro', ['n-judah', 'm-ocean-view'], { zh: '顺便完成地铁目标', en: 'Also completes the metro goal' }, { alightAt: ['n9'] });
  const toBeach = planTrips({ x: 0, z: 1300 }, dest(0, 1990), { walk: (a, b) => ({ length: straight(a, b) * 1.2 }), lines: () => [N_LINE], goals: [metro] });
  const m = one(toBeach, o => o.mode === 'line');
  assert.equal(m.goal, 'metro');
  assert.equal(m.recommended, true);
});

test('bilingual words: leg labels, row summaries, time labels, line names', () => {
  const list = planTrips({ x: 60, z: 260 }, dest(-50, 1520), { walk: (a, b) => ({ length: straight(a, b) }), lines: () => [N_LINE], discovered: () => true });
  const lines = new Map([[N_LINE.id, N_LINE]]);
  for (const o of list) {
    const s = optionSummary(o, lines);
    assert.ok(s.zh && s.en && /约/.test(s.zh) && /~/.test(s.en), JSON.stringify(s));
    for (const l of o.legs) assert.ok(l.label && l.label.zh && l.label.en, `label on ${l.via}`);
  }
  assert.deepEqual(tripTimeLabel(8), { zh: '约 8 秒', en: '~8s' });
  assert.deepEqual(tripTimeLabel(47), { zh: '约 45 秒', en: '~45s' });
  assert.deepEqual(tripTimeLabel(58), { zh: '约 1 分钟', en: '~1 min' });
  assert.deepEqual(tripTimeLabel(245), { zh: '约 4 分钟', en: '~4 min' });
  assert.deepEqual(tripTimeLabel(0.2), { zh: '约 1 秒', en: '~1s' });
  assert.deepEqual(lineDisplayName(LOOP), { zh: '观光巴士', en: 'Sightseeing bus' });
  assert.deepEqual(lineDisplayName(N_LINE), { zh: 'N 线', en: 'N line' });
  assert.deepEqual(lineDisplayName(CABLE_LINE), { zh: '叮当车', en: 'Cable car' });
});

test('tripRemainingSeconds: the current leg (or what is left of it) + every later leg', () => {
  const legs = [{ seconds: 30 }, { seconds: 60 }, { seconds: 20 }] as TripOption['legs'];
  assert.equal(tripRemainingSeconds({ legs, leg: 0 }), 110);
  assert.equal(tripRemainingSeconds({ legs, leg: 1 }, 12), 32);
  assert.equal(tripRemainingSeconds({ legs, leg: 3 }), 0);
});

test('TripRouteCache: estimates first, the real routes after the async search; queued; failures keep the estimate', async () => {
  let calls = 0, running = 0, maxRunning = 0;
  const cache = new TripRouteCache({
    concurrency: 2,
    walk: async (a, b) => {
      calls++; running++; maxRunning = Math.max(maxRunning, running);
      await new Promise(r => setTimeout(r, 5));
      running--;
      if (b.x === 999) throw new Error('boom');
      return { length: straight(a, b) * 1.1, path: [a.x, a.z, b.x, b.z] };
    },
  });
  let heard = 0;
  const off = cache.subscribe(() => { heard++; });
  const p: TripProviders = { walk: cache.walk, lines: () => [N_LINE] };
  const from = { x: 60, z: 260 }, to = dest(-50, 1520);
  const first = planTrips(from, to, p);
  assert.ok(first.every(o => o.legs.some(l => l.estimate) || o.legs.every(l => l.length < 2)));
  // the planner requested only the legs it keeps (walk, the two line walks), not every candidate stop
  const requested = cache.pending();
  assert.ok(requested >= 1 && requested <= 3, `requested ${requested}`);
  await cache.idle();
  assert.ok(maxRunning <= 2);
  assert.ok(heard >= 1);
  const second = planTrips(from, to, p);
  assert.ok(second.every(o => !optionPending(o)), 'every leg now has its route');
  const w = one(second, o => o.mode === 'walk');
  assert.ok(near(w.legs[0].length, straight(from, to) * 1.1, 1e-6));
  // cached: no new searches
  const before = calls;
  planTrips(from, to, p);
  assert.equal(calls, before);
  // a failed search: the estimate stays, no retry loop
  assert.equal(cache.walk({ x: 0, z: 0 }, { x: 999, z: 0 }), undefined);
  await cache.idle();
  const n = calls;
  assert.equal(cache.walk({ x: 0, z: 0 }, { x: 999, z: 0 }), undefined);
  await cache.idle();
  assert.equal(calls, n);
  // no router: undefined, nothing scheduled
  const empty = new TripRouteCache({});
  assert.equal(empty.walk({ x: 0, z: 0 }, { x: 5, z: 5 }), undefined);
  assert.equal(empty.pending(), 0);
  // a peek (request false) never starts a search
  const peek = new TripRouteCache({ walk: async () => ({ length: 1 }) });
  assert.equal(peek.walk({ x: 0, z: 0 }, { x: 50, z: 0 }, false), undefined);
  assert.equal(peek.pending(), 0);
  off();
});

test('(review) TripRouteCache: LRU capacity (a hit refreshes), a nonsense answer is "no route", keys on the quantum grid', async () => {
  let calls = 0;
  const cache = new TripRouteCache({
    capacity: 2, quantum: 4,
    walk: async (_a, b) => { calls++; return b.x === 66 ? { length: Number.NaN } : b.x === 77 ? { length: -5 } : { length: b.x }; },
  });
  const o = { x: 0, z: 0 };
  const A = { x: 10, z: 0 }, B = { x: 20, z: 0 }, C = { x: 30, z: 0 };
  cache.walk(o, A); cache.walk(o, B);
  await cache.idle();
  assert.equal(cache.walk(o, A)?.length, 10, 'a hit: A is now the newest');
  cache.walk(o, C);
  await cache.idle();
  // capacity 2: B (the least recently used) went, A and C stay
  assert.equal(cache.walk(o, A, false)?.length, 10);
  assert.equal(cache.walk(o, C, false)?.length, 30);
  assert.equal(cache.walk(o, B, false), undefined, 'evicted: unknown again (a peek does not search)');
  assert.equal(calls, 3);
  // positions on the same 4 u cell share the answer (a player shuffling 1 u does not start a new search)
  const before = calls;
  assert.equal(cache.walk({ x: 1, z: -1 }, { x: 31, z: 1 }, false)?.length, 30);
  assert.equal(calls, before);
  // NaN / negative lengths are "no route" (null), not a 0-second walk
  cache.walk(o, { x: 66, z: 0 }); cache.walk(o, { x: 77, z: 0 });
  await cache.idle();
  assert.equal(cache.walk(o, { x: 66, z: 0 }, false), null);
  assert.equal(cache.walk(o, { x: 77, z: 0 }, false), null);
});

test('live providers: cable-car and transit.json lines convert for the planner; rideables within 60 u', async () => {
  const { cableTripLine, rideablesFrom, transitTripLine } = await import('../src/opus-bay/game/tripProviders');
  const cable = cableTripLine({
    id: 'powell-hyde', kind: 'cable-car', name: { zh: '鲍威尔-海德缆车', en: 'Powell–Hyde' }, color: '#c33', sourceUrl: '', doubleEnded: false,
    xyz: new Float32Array([0, 0, 0, 0, 0, 100]), cum: new Float32Array([0, 100]), length: 100, osmLength: 100, s0: 0,
    stops: [{ station: 'a', at: 0, dwell: true, terminus: true, near: 0 }, { station: 'b', at: 50, dwell: false, terminus: false, near: 0 }, { station: 'c', at: 100, dwell: false, terminus: true, near: 0 }],
    turntableStart: null, turntableEnd: null, heroSpans: [], crossings: [], shared: [],
  }, { stations: [{ id: 'a', name: { zh: '缆车 A', en: 'A' }, x: 0, z: 0, lines: [] }, { id: 'b', name: { zh: 'B', en: 'B' }, x: 0, z: 50, lines: [] }, { id: 'c', name: { zh: 'C', en: 'C' }, x: 0, z: 100, lines: [] }] });
  assert.equal(cable.kind, 'cable-car');
  assert.equal(cable.name.zh, '鲍威尔-海德叮当车', 'the city glossary: 叮当车');
  assert.deepEqual(cable.stops.map(s => [s.id, s.major, s.z]), [['a', true, 0], ['b', false, 50], ['c', true, 100]]);
  assert.equal(cable.stops[0].name?.zh, '叮当车 A');
  const n = transitTripLine({
    id: 'n-judah', kind: 'light-rail', name: { zh: 'N 线', en: 'N Judah' }, short: 'N', osmRelation: 3435877, sourceUrl: 'https://www.openstreetmap.org/relation/3435877',
    color: '#2f6fb0', path: [0, 0, 0, 0, 0, 1580], length: 1580, doubleEnded: true, turntables: [], heroSpans: [],
    tunnels: [{ fromAt: 0, toAt: 516, portalA: null, portalB: { x: 0, y: 0, z: 516 }, stations: ['embarcadero'] }],
    stops: [{ id: 'embarcadero', name: { zh: '内河码头站', en: 'Embarcadero' }, at: 0, x: 0, z: 0, osmId: null, major: true }, { id: 'la-playa', name: { zh: '海洋海滩', en: 'Judah & La Playa' }, at: 1580, x: 0, z: 1580, osmId: null, major: true }],
  });
  assert.equal(n.short, 'N');
  assert.deepEqual(n.tunnels, [{ fromAt: 0, toAt: 516 }]);
  assert.equal(n.loop, undefined);
  assert.equal(n.stops.length, 2);
  const list = [
    { id: 'ride:bike-ferry-gate', source: 'vehicle', x: 10, z: 0 },
    { id: 'ride:car-ferry-plaza', source: 'vehicle', x: 0, z: 59 },
    { id: 'ride:bike-far', source: 'vehicle', x: 70, z: 0 },
    { id: 'poi-x', source: 'poi', x: 1, z: 1 },
  ];
  assert.deepEqual(rideablesFrom(list, { x: 0, z: 0 }).map(r => [r.id, r.kind]), [['ride:bike-ferry-gate', 'bike'], ['ride:car-ferry-plaza', 'car']]);
  // (review) only a `car-…` id is the car: a bike parked at Carl & Cole or in Oscar Alley stays a bike
  const { rideableKind } = await import('../src/opus-bay/game/tripProviders');
  assert.deepEqual(['ride:car-ferry-plaza', 'car-x', 'ride:bike-carl-cole', 'ride:bike-oscar-alley', 'ride:bike-rack-3'].map(rideableKind), ['car', 'car', 'bike', 'bike', 'bike']);
  assert.deepEqual(rideablesFrom([{ id: 'ride:bike-carl-cole', source: 'vehicle', x: 5, z: 0 }], { x: 0, z: 0 }).map(r => r.kind), ['bike']);
});

test('(review) the fly caveat speaks of goals (目标) and riding (坐车), as the rest of the game does', () => {
  assert.deepEqual(FLY_NOTE, { zh: '不算登顶和坐车目标', en: "Doesn't count for the climbing or riding goals" });
  assert.ok(!/骑行|成就/.test(FLY_NOTE.zh));
});
