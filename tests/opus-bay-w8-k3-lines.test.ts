import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { mock } from 'node:test';

/**
 * Wave 8 · lane K · W8-K3 — BAYBAY's templated bubbles in the city become fixed lines lane X can voice (the binder
 * matches exact zh + en text), the name moving to a toast / the waypoint: the skyline quiz's 最近的观景点：<name> (W7-W2
 * review), the free lead's 跟我来！去<name> and 到啦！试试「<verb>」, the welcome back's 上次我们走到<area>了, the trip's and
 * go-to's arrivals, the line boarding, the view-spot sit. District mode keeps its bubbles.
 */

const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : noop), set: () => true });
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };
let clock = 900_000;
mock.method(performance, 'now', () => clock);

const store = await import('../src/opus-bay/core/store');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const flowMod = await import('../src/opus-bay/game/flow');
const inter = await import('../src/opus-bay/game/interactables');
const { W8K_LINES } = await import('../src/opus-bay/game/fixedLines');
const S = await import('../src/opus-bay/play/skyline');
const { SKYLINE_LINES } = await import('../src/opus-bay/play/skylineLines');
const { VIEW_SPOTS } = await import('../src/opus-bay/play/viewSpots');

const src = (p: string) => readFileSync(new URL(`../src/opus-bay/${p}`, import.meta.url), 'utf8');
const toasts = () => store.game.get().toasts.map(t => (typeof t.text === 'string' ? t.text : t.text.zh));

function reset(world: 'city' | 'district' = 'city') {
  store.game.set({ ...store.initialGameState(), phase: 'playing', worldMode: world, mode: 'free' });
  flow.set(initialFlowState());
  clock += 20_000;
}

test('W8-K3 the fixed lines: zh ≤ 45, no numbers, no template, never a place name', () => {
  for (const [k, v] of Object.entries({ ...W8K_LINES, noViewPin: SKYLINE_LINES.noViewPin })) {
    assert.ok(v.zh && v.en, k);
    assert.ok([...v.zh].length <= 45, `${k}: ${v.zh}`);
    assert.ok(!/\d|\$\{/.test(v.zh + v.en), `${k}: fixed`);
  }
  // none of the view spots' names (the template's old content) is in a line
  for (const s of VIEW_SPOTS) for (const v of Object.values(W8K_LINES)) assert.ok(!v.zh.includes(s.name.zh), s.id);
});

test('W8-K3 the skyline quiz with nothing in sight: a fixed follow-up, the lookout on a toast and the waypoint', () => {
  reset();
  const p = { x: 60, z: 200 };
  const near = S.nearestViewSpot(p.x, p.z)!;
  assert.ok(near && near.id, 'the nearest lookout has its id');
  assert.equal(S.pointNearestLookout(p.x, p.z), true);
  assert.deepEqual(flow.get().bubble?.text, SKYLINE_LINES.noViewPin, 'a fixed line');
  assert.equal(flow.get().mapTarget, `view:${near.id}`, 'the waypoint pin on its 坐下看风景 prompt');
  assert.ok(toasts().some(t => t.includes(near.name.zh)), `the name on a toast: ${toasts()}`);
  // no templated bubble left in the quiz
  assert.ok(!/bubble\(\{ zh: `/.test(src('play/skyline.ts')), 'skyline.ts has no templated bubble');
  // a running trip keeps its own target
  reset();
  flow.set({ freeLead: 'x' });
  S.pointNearestLookout(p.x, p.z);
  assert.equal(flow.get().mapTarget, null, 'a lead in progress keeps its target');
});

test('W8-K3 the free lead in the city: 跟我来 and 到啦 are fixed; the district keeps its named bubbles', () => {
  const it = { id: 'w8k-test-place', source: 'place' as const, action: 'info' as const, verb: { zh: '看看', en: 'Look' }, name: { zh: '测试广场', en: 'Test Plaza' }, x: 30, z: 0, radius: 2 };
  for (const world of ['city', 'district'] as const) {
    reset(world);
    inter.setInteractables([it]);
    flowMod.startFreeLead(it.id);
    const go = flow.get().bubble?.text;
    flowMod.freeLeadArrived();
    const here = flow.get().bubble?.text;
    if (world === 'city') {
      assert.deepEqual(go, W8K_LINES.leadGo);
      assert.deepEqual(here, W8K_LINES.leadArrive);
    } else {
      assert.equal(go?.zh, '跟我来！去测试广场', 'the district unchanged');
      assert.equal(here?.zh, '到啦！试试「看看」～', 'the district unchanged');
    }
  }
  flowMod.endTrip();
});

test('W8-K3 the city’s trip / go-to / boarding / sit bubbles are fixed lines (no template left in those modules)', () => {
  for (const f of ['game/tripRun.ts', 'game/goToRun.ts', 'game/lineRides.ts', 'play/sit.ts', 'play/skyline.ts']) {
    const s = src(f);
    const calls = s.match(/bubble\(\{ zh: `[^`]*\$\{/g) ?? [];
    assert.deepEqual(calls, [], `${f}: ${calls.join(' | ')}`);
  }
  assert.match(src('game/tripRun.ts'), /W8K_LINES\.tripHere/);
  assert.match(src('game/tripRun.ts'), /W8K_LINES\.tripToStop/);
  assert.match(src('game/goToRun.ts'), /W8K_LINES\.goToHere/);
  assert.match(src('game/lineRides.ts'), /W8K_LINES\.allAboard/);
  assert.match(src('play/sit.ts'), /W8K_LINES\.sitView/);
});
