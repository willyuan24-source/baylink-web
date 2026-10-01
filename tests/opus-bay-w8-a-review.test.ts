import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 8 · the lane-A review (Ultra): the fixes the two review lenses found, red then green.
 * - A-RC-1 / A-RP-1: boarding the RETURN boat at the island, BAYBAY does not say the outbound line ("Off to Alcatraz!").
 * - A-RC-2: the island's arrival (the cellhouse front) fires up on the plateau / the top of the stair, not on the dock
 *   road under Building 64 (the 12 u floor of game/arrival radiusOf reached down to the dock).
 * - A-RP-2: tap / click to walk from the island's quay to the cellhouse front (the path follower phones use) gets there.
 */

// --- headless canvas stub (world modules create label atlases at import time) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const D = await import('../src/opus-bay/data/ferry');
const A = await import('../src/opus-bay/world/sf/alcatrazFerrySystem');
const W = await import('../src/opus-bay/world/sf/alcatrazWalk');
const { ALCA_LINES } = await import('../src/opus-bay/world/sf/alcatrazLines');
const { ATTRACTIONS } = await import('../src/opus-bay/data/sf/attractions');
const { ArrivalWatcher, arrivalAnchors } = await import('../src/opus-bay/game/arrival');

const P33 = D.ALCA_TERMINALS.pier33.id, ISL = D.ALCA_TERMINALS.island.id;
const clock = () => ({ year: 2026, month: 10, day: 2, hour: 11, minute: 0, weekday: 5 });

test('W8-A review A-RC-1: the boarding line knows the direction — the outbound line only on the way to the island', () => {
  const sys = new A.AlcaFerrySystem({ clock, brake: () => false });
  // a rider at Pier 33 for the island
  sys.request({ station: P33, to: ISL });
  sys.board();
  assert.deepEqual(sys.boardLine(), ALCA_LINES.board, 'out: "Off to Alcatraz!"');
  sys.cancel();
  // a rider at the island for Pier 33: never "Off to Alcatraz!" (the ride card reads "to Pier 33")
  sys.request({ station: ISL, to: P33 });
  sys.board();
  const back = sys.boardLine();
  assert.notDeepEqual(back, ALCA_LINES.board, 'back: not the outbound line');
  assert.ok(back === null || !/Alcatraz!|开往恶魔岛/.test(back.en + back.zh), 'back: no "off to Alcatraz"');
});

test('W8-A review A-RC-2: walking up from the quay, the island arrival fires at the top of the stair or on the plateau, never on the dock road', () => {
  const anchors = arrivalAnchors(ATTRACTIONS);
  const w = new ArrivalWatcher(anchors);
  const N = W.ALCA_WALK_GRAPH.nodes;
  const top = N[5], foot = N[4];
  let now = 0, hitAt: { x: number; z: number; leg: number } | null = null;
  for (let k = 0; k < W.ALCA_WALK_GRAPH.arrival && !hitAt; k++) {
    const a = N[k], b = N[k + 1], L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 0.25));
    for (let i = 0; i <= n && !hitAt; i++) {
      const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
      now += 250;
      const hit = w.step({ x, z, now, onFoot: true, busy: false, travelling: false });
      if (hit?.anchor.attraction === 'alcatraz') hitAt = { x, z, leg: k };
    }
  }
  assert.ok(hitAt, 'the arrival fires on the way to the cellhouse front');
  // on the stair (leg 4 → 5) past its middle, or on the plateau (leg 5 → 6)
  const mid = { x: (foot.x + top.x) / 2, z: (foot.z + top.z) / 2 };
  assert.ok(hitAt.leg >= 4, `not on the dock road (fired on leg ${hitAt.leg} at ${hitAt.x.toFixed(2)}, ${hitAt.z.toFixed(2)})`);
  assert.ok(hitAt.leg > 4 || Math.hypot(hitAt.x - top.x, hitAt.z - top.z) <= Math.hypot(mid.x - top.x, mid.z - top.z), `the upper half of the stair at least (${hitAt.x.toFixed(2)}, ${hitAt.z.toFixed(2)})`);
});

test('W8-A review A-RP-2: click / tap to walk — the path follower takes the player from the quay up the stair to the cellhouse front and on to the terrace (published city)', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { heightAt, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const { PlayerController } = await import('../src/opus-bay/actors/controller');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  const N = W.ALCA_WALK_GRAPH.nodes;
  await sf.attachAround(city, N[0].x, N[0].z, 70, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  const c = new PlayerController(), p = runtime.player, DT = 1 / 30;
  const walkTo = (goal: { x: number; z: number }, secs: number) => {
    p.pathTarget = { x: goal.x, z: goal.z };
    let t = 0;
    runtime.input.moveX = 0; runtime.input.moveY = 0; runtime.input.run = false; runtime.input.jump = false;
    while (p.pathTarget && t < secs) { c.step({ dt: DT, now: t * 1000, cameraYaw: 0, frozen: false, riding: false }); t += DT; }
    return { t, d: Math.hypot(goal.x - p.x, goal.z - p.z) };
  };
  try {
    p.x = N[0].x; p.z = N[0].z; p.y = heightAt(p.x, p.z); p.pathTarget = null; p.locked = false; c.sync();
    const front = walkTo(W.ALCA_ARRIVAL, 30);
    assert.ok(front.d <= 1, `reached the cellhouse front by tap (stopped ${front.d.toFixed(2)} u short at ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)} after ${front.t.toFixed(1)} s)`);
    assert.ok(p.y > 8, `up on the plateau (y ${p.y.toFixed(2)})`);
    const terrace = walkTo(N[7], 20);
    assert.ok(terrace.d <= 1, `reached the terrace (stopped ${terrace.d.toFixed(2)} u short at ${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
    // and back down to the quay by tap
    const quay = walkTo(N[0], 40);
    assert.ok(quay.d <= 1, `back down at the quay (stopped ${quay.d.toFixed(2)} u short at ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`);
  } finally {
    p.pathTarget = null;
    setCityTerrain(null);
  }
});

test('W8-A review A-RC-4: the crossing gives way to a ferry stopped on it (its rider\'s Settings brake: strength 0 in the wake list), not only to moving boats', async () => {
  const { AlcaFerryLayer } = await import('../src/opus-bay/world/sf/alcatrazFerry');
  const [a, b] = D.ALCA_CROSSING;
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  let list: { x: number; y: number; z: number; w: number }[] = [];
  const layer = new AlcaFerryLayer({ wakes: () => list });
  try {
    // the wake list's unused slots are all zeros: nothing in the way
    list = [{ x: 0, y: 0, z: 0, w: 0 }, { x: 0, y: 0, z: 0, w: 0 }];
    assert.equal(layer.sys.crossingClear(), true, 'empty slots are no boats');
    // the Ferry Building boat braked to a stop on the crossing (heading west, strength 0)
    list = [{ x: mid.x, y: mid.z, z: -Math.PI / 2, w: 0 }, { x: 0, y: 0, z: 0, w: 0 }];
    assert.equal(layer.sys.crossingClear(), false, 'a stopped ferry on the crossing holds the Alcatraz boat');
    // it moves on (strength 1) and away: clear again once it is well past
    list = [{ x: mid.x - 60, y: mid.z, z: -Math.PI / 2, w: 1 }];
    assert.equal(layer.sys.crossingClear(), true, 'gone west: clear');
  } finally {
    layer.dispose();
  }
});
