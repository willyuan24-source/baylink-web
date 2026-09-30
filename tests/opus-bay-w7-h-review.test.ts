import assert from 'node:assert/strict';
import test from 'node:test';

// W7-H-review (the adversarial review of wave 7 lane H): the Día de los Muertos procession's gathering stands where the
// organisers stage it. SFMTA's notice for the 2025 procession (checked 2026-09-30,
// https://www.sfmta.com/travel-updates/dia-de-los-muertos-procession-sunday-november-2-2025): "The procession will begin
// staging at approximately 6 p.m. on Bryant, between 19th and 22nd streets … will begin at 7 p.m." — north of 22nd St,
// before the route's start (south on Bryant from 22nd). Lane H's walkers stood on the route's first leg, south of 22nd.

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const MS = await import('../src/opus-bay/halloween/muertosSpots');
const MW = await import('../src/opus-bay/halloween/muertosWalkers');
const { GATHER_NEAR } = await import('../src/opus-bay/halloween/muertos');

test('W7-H-review the procession gathers on Bryant NORTH of 22nd (SFMTA: staging on Bryant between 19th and 22nd), then walks south through 22nd & Bryant', () => {
  const C = MS.ROUTE_CORNERS.bryant22;
  // the route's first heading (south on Bryant) at 22nd & Bryant
  const a = MW.routeAt(0), b = MW.routeAt(20);
  const L = Math.hypot(b.x - a.x, b.z - a.z), hx = (b.x - a.x) / L, hz = (b.z - a.z) / L;
  const along = (x: number, z: number) => (x - a.x) * hx + (z - a.z) * hz;
  const across = (x: number, z: number) => Math.abs((x - a.x) * hz - (z - a.z) * hx);
  const w = MW.createWalkers(() => 2.6);
  try {
    w.step('gather', 0, 0);
    const gather: [number, number][] = [];
    w.each((x, z) => gather.push([x, z]));
    assert.equal(gather.length, w.count());
    for (const [x, z] of gather) {
      assert.ok(along(x, z) < -2, `a walker stands ${along(x, z).toFixed(1)} u along the first leg (south of 22nd & Bryant is > 0)`);
      assert.ok(across(x, z) < MW.WALK.spread + 1, `on Bryant's line (${across(x, z).toFixed(2)} u off it)`);
      assert.ok(Math.hypot(x - C.x, z - C.z) < GATHER_NEAR, 'within BAYBAY\'s gathering line');
    }
    // 19:00: they set off from where they stood (no jump), south through the crossing
    w.step('walk', 0, 1);
    let k = 0;
    w.each((x, z) => { const [gx, gz] = gather[k++]; assert.ok(Math.hypot(x - gx, z - gz) < 1, 'no jump at 19:00'); });
    const h = MW.headAt(90, w.count());
    assert.ok(h.s > 0, 'after a minute and a half the head is on the route, south of 22nd');
    // a head behind the start is placed on Bryant north of the crossing, facing south
    const p = MW.placeAt(-10);
    assert.ok(Math.abs(along(p.x, p.z) + 10) < 0.3 && across(p.x, p.z) < 0.3, `${along(p.x, p.z)}, ${across(p.x, p.z)}`);
    assert.ok(p.hx * hx + p.hz * hz > 0.99, 'facing the way they walk');
    assert.ok(Math.abs(p.y - 2.6) < 1e-6 || Math.abs(p.y - MW.routeAt(0).y) < 1e-6);
  } finally {
    w.dispose();
  }
});

test('W7-H-review headAt still pauses 18 s at 24th & Bryant and never goes back, with the lead-in from north of 22nd', () => {
  const n = 40, corners = MW.processionCorners();
  assert.ok(MW.gatherHead() < 0, 'the head waits before the route\'s start');
  const toFirst = (corners[1] - MW.gatherHead()) / MW.WALK.speed;
  assert.equal(MW.headAt(toFirst - 1, n).paused, false, 'no stop at 22nd & Bryant on the way in');
  const p = MW.headAt(toFirst + MW.WALK.pause / 2, n);
  assert.ok(p.paused && Math.abs(p.s - corners[1]) < 1e-3);
  let prev = -Infinity;
  for (let t = 0; t < 7200; t += 3) { const s = MW.headAt(t, n).s; assert.ok(s >= prev - 1e-6, `t ${t}`); prev = s; }
  // the out parameter: a frame reuses one object (no allocation a frame)
  const out = { s: 0, paused: false };
  assert.equal(MW.headAt(100, n, out), out);
});
