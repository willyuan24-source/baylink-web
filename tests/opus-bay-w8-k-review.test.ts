import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { mock } from 'node:test';

/**
 * Wave 8 · lane K · the adversarial review's fixes (W8-K-review, docs/opus-bay/sf-w8-K.md "Review (Ultra)"):
 *   K-RC-1  a walk → ride trip in the city said the voiced 去车站，我们坐车过去！ twice (W8-K10 at the start, W8-K3 again at
 *           the stop, where the player already stands)
 *   K-RP-1/2 on a short or landscape phone a tall play panel left BAYBAY's bubble no free spot: it stayed under the panel
 *           (z 8 under z 43) while its recorded voice played — now it goes to the least-covered spot and is drawn on top
 *   K-RC-2  the egg card (and the egg notes / operator / listening ring) are fixed HUD boxes like the play panels: the
 *           egg's 2nd and 3rd voiced lines no longer hang under an opened card
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
let clock = 200_000;
mock.method(performance, 'now', () => clock);
const tick = (ms: number) => { clock += ms; };

const { game, initialGameState } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const flowMod = await import('../src/opus-bay/game/flow');
const { flow, initialFlowState } = await import('../src/opus-bay/game/flowStore');
const { buildInteractables, setInteractables, registerInteractables } = await import('../src/opus-bay/game/interactables');
const { updateGuide, resetBrain } = await import('../src/opus-bay/game/brain');
const tripRun = await import('../src/opus-bay/game/tripRun');
const { W8K_LINES } = await import('../src/opus-bay/game/fixedLines');
const { setStorageForTests } = await import('../src/opus-bay/data/wishlist');
const { HUD_BOX_SELECTOR, placeBubble } = await import('../src/opus-bay/game/hudLayout');

setStorageForTests(null);
tripRun.initTripRun();

const src = (p: string) => readFileSync(new URL(`../src/opus-bay/${p}`, import.meta.url), 'utf8');

const said: { t: number; zh: string }[] = [];
let lastKey = -1;
flow.subscribe(() => { const b = flow.get().bubble; if (b && b.key !== lastKey) { lastKey = b.key; said.push({ t: clock, zh: b.text.zh }); } });

test('K-RC-1 a walk → ride trip in the city says 去车站，我们坐车过去！ once (at the start), not again at the stop', () => {
  game.set({ ...initialGameState(), phase: 'playing', worldMode: 'city', mode: 'free' });
  flow.set(initialFlowState());
  Object.assign(runtime.player, { x: 0, y: 0, z: 0, heading: 0, moving: false, running: false, locked: false, pendingInteract: null, pathTarget: null });
  Object.assign(runtime.guide, { x: 1, y: 0, z: 0, state: 'follow', target: null, run: false, emote: 'none', arrived: false });
  resetBrain();
  const board = { x: 10, z: 0, station: 'loop-castro', name: { zh: '卡斯特罗', en: 'Castro' } };
  const alight = { x: 200, z: 0, station: 'loop-twin-peaks', name: { zh: '双峰', en: 'Twin Peaks' } };
  registerInteractables('test-loop', () => [{ id: 'transit-loop-castro', source: 'transit', action: 'streetcar', verb: { zh: '上观光巴士', en: 'Board' }, name: board.name, x: 10, z: 0, radius: 4.2 }]);
  setInteractables(buildInteractables());
  tick(5000);
  const option = {
    mode: 'line' as const, seconds: 90,
    legs: [
      { via: 'walk' as const, from: { x: 0, z: 0 }, to: board, seconds: 3, length: 12 },
      { via: 'line' as const, line: 'sf-loop', board: 'loop-castro', alight: 'loop-twin-peaks', wait: 15, stops: 1, from: board, to: alight, seconds: 70, length: 190 },
    ],
  };
  said.length = 0;
  flowMod.startTrip(option, { placeId: 'twin-peaks' }, 'map');
  assert.equal(said[0]?.zh, W8K_LINES.tripToStop.zh, 'the start: the recorded ride line');
  tick(1500);
  runtime.player.x = 10; runtime.guide.x = 11;
  updateGuide(clock); tick(100); updateGuide(clock); updateGuide(clock);
  assert.equal(flow.get().trip?.leg, 1, 'at the stop: the ride leg');
  assert.equal(tripRun.tripStage(), 'board', 'the boarding question speaks at the stop');
  const n = said.filter(b => b.zh === W8K_LINES.tripToStop.zh).length;
  assert.equal(n, 1, `said once per trip: ${JSON.stringify(said)}`);
  flowMod.closeDialogue();
  flowMod.endTrip();
});

// the placement cases the player lens measured (CSS px; bubble 230 × 62)
const W = 230, H = 62;
const coverArea = (x: number, y: number, boxes: readonly { l: number; t: number; r: number; b: number }[]) => {
  const l = x - W / 2, r = x + W / 2, t = y - 10 - H, b = y - 10;
  let a = 0;
  for (const o of boxes) a += Math.max(0, Math.min(r, o.r) - Math.max(l, o.l)) * Math.max(0, Math.min(b, o.b) - Math.max(t, o.t));
  return a;
};
const free = (x: number, y: number, boxes: readonly { l: number; t: number; r: number; b: number }[]) => {
  const l = x - W / 2, r = x + W / 2, t = y - 10 - H, b = y - 10;
  return boxes.every(o => !(l < o.r + 6 && r > o.l - 6 && t < o.b + 6 && b > o.t - 6));
};

test('K-RP-1 / K-RP-2 a play panel that leaves no free row: the bubble goes to the least-covered spot and is drawn over the panel (never voiced under it)', () => {
  const cases = [
    // 390 × 664 (a phone with the browser bars): the claw panel 12–378 × 64–548 (sfgames.css max-height 700 rule), pills, bar
    { name: '390x664', w: 390, h: 664, anchor: [267, 420], boxes: [{ l: 12, t: 12, r: 190, b: 58 }, { l: 200, t: 12, r: 378, b: 58 }, { l: 12, t: 64, r: 378, b: 548 }, { l: 64, t: 606, r: 326, b: 656 }], maxCover: 0.45 },
    // 844 × 340 (rotated): the panel 222–622 × 72–594 (past the bottom), pills, the right button column, Hop
    { name: '844x340', w: 844, h: 340, anchor: [420, 220], boxes: [{ l: 15, t: 12, r: 180, b: 58 }, { l: 505, t: 12, r: 720, b: 58 }, { l: 222, t: 72, r: 622, b: 594 }, { l: 730, t: 20, r: 790, b: 330 }, { l: 660, t: 125, r: 705, b: 175 }], maxCover: 0.45 },
    // 375 × 553: the panel fills the screen between the pills and the bar
    { name: '375x553', w: 375, h: 553, anchor: [190, 300], boxes: [{ l: 12, t: 12, r: 180, b: 58 }, { l: 190, t: 12, r: 363, b: 58 }, { l: 12, t: 64, r: 363, b: 545 }, { l: 60, t: 496, r: 315, b: 545 }], maxCover: 1 },
  ];
  for (const c of cases) {
    const half = W / 2 + 8;
    const p = placeBubble(c.anchor[0], c.anchor[1], W, H, c.boxes, c.h, 58 + 10 + H + 10, c.h - 60, half, c.w - half);
    if (free(p.x, p.y, c.boxes)) { assert.ok(!p.over, `${c.name}: free, not raised`); continue; }
    assert.equal(p.over, true, `${c.name}: no free spot → drawn over the boxes (${JSON.stringify(p)})`);
    const cover = coverArea(p.x, p.y, c.boxes) / (W * H);
    assert.ok(cover <= c.maxCover, `${c.name}: the least-covered spot (${(cover * 100).toFixed(0)} % covered)`);
    assert.ok(p.x - W / 2 >= 0 && p.x + W / 2 <= c.w, `${c.name}: on screen`);
  }
  // a free spot is never raised (the earlier answers keep their shape)
  assert.deepEqual(placeBubble(200, 420, 230, 60, [], 844, 130, 784), { x: 200, y: 420 });
  // the ticker draws a raised bubble above the play panels (z 43) and the egg card (z 13)
  assert.match(src('game/Systems.tsx'), /writeData\(bubbleEl, 'over', placed\.over \? '1' : '0'\)/);
  const css = src('opus-bay.css');
  const m = css.match(/\.ob-bubble-anchor\[data-over='1'\] \{ z-index: (\d+); \}/);
  assert.ok(m && Number(m[1]) > 43, 'the raised bubble is above the play panels');
});

test('K-RC-2 the egg card, the egg notes / operator and the listening ring are fixed HUD boxes: the bubble keeps off an opened egg card', () => {
  const sel = HUD_BOX_SELECTOR.split(', ');
  for (const c of ['.ob-egg-card', '.ob-egg-note', '.ob-egg-operator', '.ob-egg-listen']) assert.ok(sel.includes(c), c);
  // 390 × 844: an opened egg card (.is-open, 58vh tall, 134 px above the bottom: 12–306 × 220–710), the pills, the bar;
  // BAYBAY's head in the middle of the card
  const boxes = [{ l: 12, t: 12, r: 190, b: 58 }, { l: 200, t: 12, r: 378, b: 58 }, { l: 12, t: 220, r: 306, b: 710 }, { l: 64, t: 780, r: 326, b: 836 }];
  const half = W / 2 + 8;
  const p = placeBubble(195, 430, W, H, boxes, 844, 58 + 10 + H + 10, 844 - 60, half, 390 - half);
  assert.ok(free(p.x, p.y, boxes), `clear of the opened card: ${JSON.stringify(p)}`);
  assert.ok(!p.over);
});
