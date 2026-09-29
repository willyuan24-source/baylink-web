import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * W6-K1 (NEXT P0 #2, W5-Z final verify §7.2): the floating stick's base in client coordinates.
 *
 * Before: the base was kept relative to the canvas rect and the reading was `thumb − rect − base`, so a rect that moved
 * mid-touch (a CDP screenshot shifted it for a frame in W5-Z; an iOS toolbar resize could do the same) dragged the base
 * along past the rim and flipped the reading (moveY +1 → −0.99): the player turned back. Now thumb and base are both
 * client coordinates; the rect only places the drawn base, and a (visual) viewport resize repaints it.
 */

type Fn = (e: unknown) => void;
const winListeners = new Map<string, Fn[]>();
const vvListeners = new Map<string, Fn[]>();
const add = (m: Map<string, Fn[]>) => (type: string, fn: Fn) => { m.set(type, [...(m.get(type) ?? []), fn]); };
const remove = (m: Map<string, Fn[]>) => (type: string, fn: Fn) => { m.set(type, (m.get(type) ?? []).filter(f => f !== fn)); };
(globalThis as unknown as { window: unknown }).window = {
  addEventListener: add(winListeners), removeEventListener: remove(winListeners),
  visualViewport: { addEventListener: add(vvListeners), removeEventListener: remove(vvListeners) },
};

const { attachPointer, stickView, stickBase, setStickRenderer } = await import('../src/opus-bay/actors/pointer');
const { input } = await import('../src/opus-bay/core/input');

function fakeCanvas() {
  const listeners = new Map<string, Fn>();
  const box = { left: 0, top: 0, width: 390, height: 844 };
  const el = {
    addEventListener: (type: string, fn: Fn) => { listeners.set(type, fn); },
    removeEventListener: (type: string) => { listeners.delete(type); },
    getBoundingClientRect: () => ({ ...box, right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top }),
    setPointerCapture() { /* noop */ }, releasePointerCapture() { /* noop */ },
  };
  const fire = (type: string, x: number, y: number, id = 1) => listeners.get(type)!({ pointerType: 'touch', pointerId: id, clientX: x, clientY: y, button: 0 });
  return { el: el as unknown as HTMLElement, box, fire };
}

test('W6-K1: a canvas rect that moves mid-touch never flips the stick (base in client coordinates)', () => {
  const { el, box, fire } = fakeCanvas();
  const detach = attachPointer(el);
  try {
    fire('pointerdown', 100, 700);
    fire('pointermove', 100, 690);
    fire('pointermove', 100, 640);   // 60 px up: past the 52 px rim, the base follows the thumb
    assert.equal(input.stick.active, true);
    assert.ok(input.stick.y > 0.99, `pushed up: ${input.stick.y}`);
    // the rect jumps 60 px up for one move (a toolbar resize, a screenshot), the thumb creeps on up by a pixel
    box.top = -60;
    fire('pointermove', 100, 639);
    assert.ok(input.stick.y > 0.99, `still up while the rect is off: ${input.stick.y}`);
    assert.ok(Math.abs(input.stick.x) < 0.01);
    box.top = 0;
    fire('pointermove', 100, 638);
    assert.ok(input.stick.y > 0.99, `still up once the rect is back: ${input.stick.y}`);
    // the base stayed under the thumb's own path (client px), 52 px below it
    assert.equal(Math.round(stickBase.y - 638), 52);
    // reversing is still instant (the floating base is 52 px away)
    fire('pointermove', 100, 760);
    assert.ok(input.stick.y < -0.99, `pulled back: ${input.stick.y}`);
    fire('pointerup', 100, 760);
    assert.equal(input.stick.active, false);
    assert.equal(input.stick.y, 0);
  } finally { detach(); }
});

test('W6-K1: the drawn base follows the canvas rect, and a visual viewport resize repaints it', () => {
  const { el, box, fire } = fakeCanvas();
  let paints = 0;
  setStickRenderer(() => { paints++; });
  const detach = attachPointer(el);
  try {
    fire('pointerdown', 80, 600);
    fire('pointermove', 80, 560);
    assert.equal(stickView.active, true);
    assert.equal(stickView.baseY, 600);
    const before = paints;
    box.top = 30;                                            // the canvas moved down 30 px (an iOS toolbar)
    for (const fn of vvListeners.get('resize') ?? []) fn({});
    assert.ok(paints > before, 'repainted on the viewport resize');
    assert.equal(stickView.baseY, 570, 'drawn where the thumb landed, relative to the moved canvas');
    assert.ok(input.stick.y > 0.7, 'the reading did not change');
    fire('pointerup', 80, 560);
  } finally { detach(); setStickRenderer(null); }
  assert.equal((vvListeners.get('resize') ?? []).length, 0, 'the viewport listeners are removed on detach');
  assert.equal((winListeners.get('resize') ?? []).length, 0);
});
