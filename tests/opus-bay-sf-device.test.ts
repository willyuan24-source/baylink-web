import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Lane P (wave 4 integration part b, verify-phone B1): the shared device detector in ui/hooks.ts. A tap fires compat
 * mouse events right after its touchend; the old detector took the compat mousedown for a mouse and flipped the HUD to
 * the keyboard layout mid-tap, so the tapped action button unmounted under the finger (和 Ray 聊聊, 坐渡轮 … never
 * worked on touch) and 跳 vanished for ≈ 350 ms after every tap.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const { deviceFromInput, trackDevice, currentDevice, TOUCH_COMPAT_MS } = await import('../src/opus-bay/ui/hooks');

/** An Event carrying the fields the detector reads (Node's Event has no pointerType / detail). */
function ev(type: string, extra: Record<string, unknown> = {}): Event {
  const e = new Event(type);
  for (const [k, v] of Object.entries(extra)) Object.defineProperty(e, k, { value: v });
  return e;
}

test('a tap followed by its compat mousedown keeps the device on touch (B1)', () => {
  const target = new EventTarget();
  let t = 1000;
  const stop = trackDevice(target, true, () => t);
  target.dispatchEvent(ev('touchstart'));
  assert.equal(currentDevice(), 'touch');
  t += 80;
  target.dispatchEvent(ev('pointerdown', { pointerType: 'touch' }));
  target.dispatchEvent(ev('touchend'));
  t += 5;
  // the compat events of the tap: a MouseEvent with detail 1 and no pointerType
  target.dispatchEvent(ev('mousedown', { detail: 1 }));
  assert.equal(currentDevice(), 'touch', 'the compat mousedown must not flip the HUD');
  // a browser without pointer events: the mousedown path, still guarded by the touch clock
  stop();
  const stop2 = trackDevice(target, false, () => t);
  target.dispatchEvent(ev('touchstart'));
  t += 40;
  target.dispatchEvent(ev('touchend'));
  t += 10;
  target.dispatchEvent(ev('mousedown', { detail: 1 }));
  assert.equal(currentDevice(), 'touch');
  // a real mouse long after the last touch still switches
  t += TOUCH_COMPAT_MS + 500;
  target.dispatchEvent(ev('mousedown', { detail: 1 }));
  assert.equal(currentDevice(), 'keyboard');
  stop2();
});

test('a real mouse pointer and a key switch to the keyboard layout; typing in a text field on touch does not', () => {
  const target = new EventTarget();
  let t = 50_000;
  const stop = trackDevice(target, true, () => t);
  target.dispatchEvent(ev('touchstart'));
  assert.equal(currentDevice(), 'touch');
  // the phone keyboard typing into the map search: still touch
  const input = { tagName: 'INPUT' };
  target.dispatchEvent(ev('keydown', { target: input }));
  assert.equal(currentDevice(), 'touch');
  // a key outside a text field (a hardware keyboard on a tablet)
  t += 20;
  target.dispatchEvent(ev('keydown', { target: { tagName: 'DIV' } }));
  assert.equal(currentDevice(), 'keyboard');
  target.dispatchEvent(ev('touchstart'));
  assert.equal(currentDevice(), 'touch');
  // a mouse pointer right after a touch is ignored; later it switches
  t += 100;
  target.dispatchEvent(ev('pointerdown', { pointerType: 'mouse' }));
  assert.equal(currentDevice(), 'touch');
  t += TOUCH_COMPAT_MS + 1;
  target.dispatchEvent(ev('pointerdown', { pointerType: 'mouse' }));
  assert.equal(currentDevice(), 'keyboard');
  // a pen or a finger through pointer events is touch
  target.dispatchEvent(ev('pointerdown', { pointerType: 'pen' }));
  assert.equal(currentDevice(), 'touch');
  stop();
});

test('deviceFromInput: the decision table', () => {
  assert.equal(deviceFromInput({ type: 'touchstart' }, null, Infinity), 'touch');
  assert.equal(deviceFromInput({ type: 'mousedown', detail: 1 }, 'touch', 30), null);
  assert.equal(deviceFromInput({ type: 'mousedown', detail: 1, firesTouch: true }, 'touch', 5000), null);
  assert.equal(deviceFromInput({ type: 'mousedown', detail: 0 }, 'touch', 5000), null, 'a synthetic click (detail 0) says nothing');
  assert.equal(deviceFromInput({ type: 'mousedown', detail: 1 }, 'touch', 5000), 'keyboard');
  assert.equal(deviceFromInput({ type: 'pointerdown', pointerType: 'mouse' }, 'touch', 5000), 'keyboard');
  assert.equal(deviceFromInput({ type: 'pointerdown', pointerType: 'touch' }, 'keyboard', 0), 'touch');
  assert.equal(deviceFromInput({ type: 'keydown', target: { tagName: 'TEXTAREA' } as unknown as EventTarget }, 'touch', 0), null);
  assert.equal(deviceFromInput({ type: 'keydown', target: { tagName: 'INPUT' } as unknown as EventTarget }, 'keyboard', 0), 'keyboard');
  assert.equal(deviceFromInput({ type: 'keydown', target: { tagName: 'DIV', isContentEditable: true } as unknown as EventTarget }, 'touch', 0), null);
  assert.equal(deviceFromInput({ type: 'click' }, 'touch', 0), null);
});
