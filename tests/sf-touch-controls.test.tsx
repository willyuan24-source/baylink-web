import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { GardenInput } from '../src/features/little-bay/ParkGardenScene';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/play' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });

class TestPointerEvent extends dom.window.MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'touch';
  }
}
Object.defineProperty(dom.window, 'PointerEvent', { configurable: true, value: TestPointerEvent });
const { render, cleanup, fireEvent, act } = await import('@testing-library/react');
const { default: SfTouchJoystick } = await import('../src/features/little-bay/SfTouchJoystick');
const { useSfTouchControls } = await import('../src/features/little-bay/useSfTouchControls');

afterEach(() => { cleanup(); document.body.replaceChildren(); });

function joystick(withScene = false) {
  const input: React.MutableRefObject<GardenInput> = { current: { forward: false, backward: false, left: false, right: false, moveX: 0, moveY: 0 } };
  const control = <SfTouchJoystick input={input} disabled={false} label="Move BAYBAY" />;
  const view = render(withScene ? <div className="sf-stage">{control}<canvas tabIndex={0} /></div> : control);
  const button = view.getByRole('button', { name: 'Move BAYBAY' });
  const captured = new Set<number>();
  Object.assign(button, {
    getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, toJSON: () => ({}) }),
    setPointerCapture: (id: number) => captured.add(id),
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => captured.delete(id),
  });
  const press = (x = 50, y = 50, pointerId = 1) => fireEvent.pointerDown(button, { pointerId, pointerType: 'touch', button: 0, clientX: x, clientY: y });
  const drag = (x: number, y: number, pointerId = 1) => fireEvent.pointerMove(button, { pointerId, pointerType: 'touch', clientX: x, clientY: y });
  return { view, input, button, captured, press, drag };
}

function magnitude(input: React.MutableRefObject<GardenInput>) {
  return Math.hypot(input.current.moveX ?? 0, input.current.moveY ?? 0);
}

test('touch joystick has a resting dead zone, analog speed and correct diagonal direction', () => {
  const { input, button, press, drag } = joystick();
  press();
  drag(51, 49);
  assert.equal(magnitude(input), 0, 'small resting thumb motion does not move the character');
  drag(60, 40);
  const gentle = magnitude(input);
  assert.ok(gentle > 0 && gentle < 1, 'partial displacement produces partial movement');
  assert.ok((input.current.moveX ?? 0) > 0, 'rightward drag moves right');
  assert.ok((input.current.moveY ?? 0) > 0, 'upward drag moves forward');
  assert.ok(Math.abs(input.current.moveX! - input.current.moveY!) < 1e-8, 'diagonal directions are balanced');
  drag(70, 30);
  assert.ok(magnitude(input) > gentle, 'moving the thumb farther increases movement speed');
  assert.ok(magnitude(input) < 1);
  assert.ok(button.classList.contains('is-active'));
});

test('captured dragging outside the joystick remains normalized and releasing recenters it', () => {
  const { input, button, captured, press, drag } = joystick();
  press();
  assert.ok(captured.has(1));
  drag(-500, 600);
  assert.ok(Math.abs(magnitude(input) - 1) < 1e-8, 'diagonal maximum speed is not faster than straight movement');
  assert.ok(input.current.moveX! < 0 && input.current.moveY! < 0);
  const thumb = button.querySelector<HTMLElement>('.sf-joystick-thumb')!;
  const offsets = thumb.style.transform.match(/-?[\d.]+/g)!.map(Number);
  assert.ok(Math.hypot(...offsets) < 50, 'thumb artwork stays inside the pad when a captured finger leaves it');
  fireEvent.pointerUp(button, { pointerId: 1 });
  assert.equal(magnitude(input), 0);
  assert.equal(captured.size, 0);
  assert.equal(button.classList.contains('is-active'), false);
  assert.equal(thumb.style.transform, 'translate(0px, 0px)');
});

test('a second finger cannot steer or stop the first finger', () => {
  const { input, button, captured, press, drag } = joystick();
  press(75, 50, 1);
  const first = { x: input.current.moveX, y: input.current.moveY };
  press(20, 20, 2);
  drag(0, 0, 2);
  fireEvent.pointerUp(button, { pointerId: 2 });
  assert.deepEqual({ x: input.current.moveX, y: input.current.moveY }, first);
  assert.deepEqual([...captured], [1]);
  drag(50, 20, 1);
  assert.ok(input.current.moveY! > 0 && Math.abs(input.current.moveX!) < 1e-8);
  fireEvent.pointerUp(button, { pointerId: 1 });
  assert.equal(magnitude(input), 0);
  press(20, 50, 2);
  assert.ok(input.current.moveX! < 0, 'a new finger can take over after the original gesture ends');
});

test('a second finger focusing the scene can adjust the camera while the joystick stays held', () => {
  const { input, button, view, press, drag } = joystick(true);
  press(80, 50);
  const speed = magnitude(input);
  const canvas = view.container.querySelector('canvas')!;
  fireEvent.blur(button, { relatedTarget: canvas });
  assert.equal(magnitude(input), speed, 'focus inside the same game does not interrupt the other finger');
  drag(50, 20);
  assert.ok(input.current.moveY! > 0, 'the held pointer can continue steering');
  const outside = document.createElement('button');
  document.body.append(outside);
  fireEvent.blur(button, { relatedTarget: outside });
  assert.equal(magnitude(input), 0, 'moving focus outside the scene stops movement');
});

for (const reason of ['pointercancel', 'lostpointercapture', 'blur', 'window blur', 'disabled', 'unmount'] as const) {
  test(`touch joystick clears movement on ${reason}`, () => {
    const { input, button, view, press, drag } = joystick();
    press(80, 50);
    assert.ok(magnitude(input) > 0);
    if (reason === 'disabled') view.rerender(<SfTouchJoystick input={input} disabled label="Move BAYBAY" />);
    else if (reason === 'unmount') view.unmount();
    else if (reason === 'window blur') fireEvent(window, new dom.window.Event('blur'));
    else if (reason === 'blur') fireEvent.blur(button);
    else fireEvent(button, new TestPointerEvent(reason, { pointerId: 1, bubbles: true }));
    assert.equal(magnitude(input), 0, 'leaving the control cannot leave the character running');
    if (reason !== 'unmount') {
      drag(80, 50);
      assert.equal(magnitude(input), 0, 'stale movement events cannot restart a stopped gesture');
    }
  });
}

function mediaCapabilities(coarse: boolean, fine: boolean) {
  let isCoarse = coarse;
  let isFine = fine;
  const listeners = new Set<() => void>();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: (query: string) => ({
    media: query,
    get matches() { return query === '(pointer: coarse)' ? isCoarse : isFine; },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  }) });
  return {
    change(nextCoarse: boolean, nextFine: boolean) {
      act(() => { isCoarse = nextCoarse; isFine = nextFine; for (const listener of listeners) listener(); });
    },
    listeners,
  };
}

function CapabilityProbe() {
  const touch = useSfTouchControls();
  return <output>{touch ? 'touch joystick' : 'desktop controls'}</output>;
}

test('automatic control choice follows pointer capabilities, not window width', () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
  const media = mediaCapabilities(false, true);
  const view = render(<CapabilityProbe />);
  assert.equal(view.getByRole('status').textContent, 'desktop controls', 'a narrow desktop window keeps keyboard controls');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
  media.change(true, false);
  assert.equal(view.getByRole('status').textContent, 'touch joystick', 'a large touch screen still gets the joystick');
  media.change(false, true);
  assert.equal(view.getByRole('status').textContent, 'desktop controls');
  view.unmount();
  assert.equal(media.listeners.size, 0, 'capability observers are removed on unmount');
});

test('hybrid computers switch controls with real touch, mouse and movement keys', () => {
  mediaCapabilities(false, true);
  const view = render(<CapabilityProbe />);
  const output = view.getByRole('status');
  fireEvent.pointerDown(window, { pointerType: 'touch' });
  assert.equal(output.textContent, 'touch joystick');
  fireEvent.keyDown(window, { key: 'Tab' });
  assert.equal(output.textContent, 'touch joystick', 'unrelated keyboard navigation does not hide a touch control');
  fireEvent.keyDown(window, { key: 'ArrowUp' });
  assert.equal(output.textContent, 'desktop controls');
  fireEvent.pointerDown(window, { pointerType: 'pen' });
  assert.equal(output.textContent, 'touch joystick');
  fireEvent.pointerDown(window, { pointerType: 'mouse' });
  assert.equal(output.textContent, 'desktop controls');
});

test('coarse touch devices ignore synthetic mouse input when there is no fine hovering pointer', () => {
  mediaCapabilities(true, false);
  const view = render(<CapabilityProbe />);
  assert.equal(view.getByRole('status').textContent, 'touch joystick');
  fireEvent.pointerDown(window, { pointerType: 'mouse' });
  fireEvent.keyDown(window, { key: 'w' });
  assert.equal(view.getByRole('status').textContent, 'touch joystick');
});
