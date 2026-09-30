import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * W7-K6 · the touch stick when the page goes away or turns (docs/opus-bay/sf-w7-K.md part c): every touch is let go when
 * the page is hidden (visibilitychange → hidden: an app switch, the lock button, a call) or unloaded into the
 * back-forward cache (pagehide) — the thumb's pointerup never comes then, and a stick held at the switch walked the
 * player on after the return; a WIDTH change of the viewport mid-touch (a rotation) releases the stick too, while a
 * height-only change (an iOS toolbar) keeps W6-K1's repaint and the reading. The W6-K1 stick harness, with a document.
 */

type Fn = (e: unknown) => void;
const winListeners = new Map<string, Fn[]>();
const vvListeners = new Map<string, Fn[]>();
const docListeners = new Map<string, Fn[]>();
const add = (m: Map<string, Fn[]>) => (type: string, fn: Fn) => { m.set(type, [...(m.get(type) ?? []), fn]); };
const remove = (m: Map<string, Fn[]>) => (type: string, fn: Fn) => { m.set(type, (m.get(type) ?? []).filter(f => f !== fn)); };
const vv = { width: 390, height: 844, addEventListener: add(vvListeners), removeEventListener: remove(vvListeners) };
const win = { innerWidth: 390, innerHeight: 844, addEventListener: add(winListeners), removeEventListener: remove(winListeners), visualViewport: vv };
const doc = { visibilityState: 'visible', addEventListener: add(docListeners), removeEventListener: remove(docListeners) };
const g = globalThis as unknown as { window: unknown; document: unknown };
g.window = win;
g.document = doc;

const { attachPointer, stickView } = await import('../src/opus-bay/actors/pointer');
const { input } = await import('../src/opus-bay/core/input');

const emit = (m: Map<string, Fn[]>, type: string) => { for (const fn of m.get(type) ?? []) fn({}); };

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
/** a thumb down on the left half and pushed up past the rim: the stick reads forward */
function pushUp(fire: ReturnType<typeof fakeCanvas>['fire']) {
  fire('pointerdown', 100, 700);
  fire('pointermove', 100, 690);
  fire('pointermove', 100, 640);
  assert.equal(input.stick.active, true);
  assert.ok(input.stick.y > 0.99, `pushed up: ${input.stick.y}`);
}

test('W7-K6: the page hidden (visibilitychange) or put away (pagehide) mid-touch lets go of the stick; the touch that never ended is forgotten', () => {
  const { el, fire } = fakeCanvas();
  const detach = attachPointer(el);
  try {
    pushUp(fire);
    doc.visibilityState = 'hidden';
    emit(docListeners, 'visibilitychange');
    assert.equal(input.stick.active, false, 'released when the page is hidden');
    assert.equal(input.stick.y, 0);
    assert.equal(stickView.active, false);
    // back: the old finger's late moves do nothing (its touch is gone); a new thumb works as always
    doc.visibilityState = 'visible';
    emit(docListeners, 'visibilitychange');
    fire('pointermove', 100, 600);
    assert.equal(input.stick.active, false, 'a stale move of the lost touch does not steer');
    fire('pointerdown', 90, 700, 2);
    fire('pointermove', 90, 640, 2);
    assert.ok(input.stick.active && input.stick.y > 0.99, 'a new thumb steers');
    fire('pointerup', 90, 640, 2);
    // pagehide (bfcache, the tab closing on iOS) does the same
    pushUp(fire);
    emit(winListeners, 'pagehide');
    assert.equal(input.stick.active, false, 'released on pagehide');
    // a visible → visible change does nothing
    pushUp(fire);
    emit(docListeners, 'visibilitychange');
    assert.equal(input.stick.active, true, 'still steering while visible');
    fire('pointerup', 100, 640);
  } finally { detach(); }
  assert.equal((docListeners.get('visibilitychange') ?? []).length, 0, 'listener removed on detach');
  assert.equal((winListeners.get('pagehide') ?? []).length, 0);
});

test('W7-K6: a viewport WIDTH change mid-touch (a rotation) releases the stick; a height-only change (a toolbar) keeps it and repaints', () => {
  const { el, box, fire } = fakeCanvas();
  const detach = attachPointer(el);
  try {
    // the toolbar comes in: height only — W6-K1's behaviour, the stick keeps reading forward
    pushUp(fire);
    vv.height = 774; win.innerHeight = 774;
    emit(vvListeners, 'resize');
    fire('pointermove', 100, 639);
    assert.ok(input.stick.active && input.stick.y > 0.99, `height-only: still steering (${input.stick.y})`);
    // the phone turns: 390 × 774 → 844 × 390 with the thumb still down
    vv.width = 844; vv.height = 390; win.innerWidth = 844; win.innerHeight = 390; box.width = 844; box.height = 390;
    emit(winListeners, 'resize');
    assert.equal(input.stick.active, false, 'released on the rotation');
    assert.equal(stickView.active, false);
    fire('pointermove', 300, 200);
    assert.equal(input.stick.active, false, 'the old thumb no longer steers');
    // a fresh touch in the new frame works; a second resize event of the same size changes nothing
    fire('pointerdown', 120, 300, 3);
    fire('pointermove', 120, 250, 3);
    assert.ok(input.stick.active, 'a new thumb steers after the turn');
    emit(vvListeners, 'resize');
    assert.ok(input.stick.active, 'same width again: nothing released');
    fire('pointerup', 120, 250, 3);
    // a width change with no finger down is just a repaint (nothing to release)
    vv.width = 390; win.innerWidth = 390;
    emit(winListeners, 'resize');
    assert.equal(input.stick.active, false);
  } finally { detach(); vv.width = 390; vv.height = 844; win.innerWidth = 390; win.innerHeight = 844; }
});
