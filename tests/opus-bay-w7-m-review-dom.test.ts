import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

/**
 * Wave 7 · the adversarial review of lane M, in a DOM: the fortune teller's card under React StrictMode (the dev build:
 * a new component is mounted, unmounted and mounted again at once). The panel's unmount ended the fortune's activity,
 * so in the dev game 算一卦 showed nothing whenever its chunk was already fetched (the zones prefetch it at the door):
 * the start and the end 28 ms apart, no card. A remount now keeps the card; a real unmount still ends the activity.
 */

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/opus-bay?save=off', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  KeyboardEvent: dom.window.KeyboardEvent, performance: globalThis.performance, IS_REACT_ACT_ENVIRONMENT: true,
});
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, cleanup, act } = await import('@testing-library/react');
const { default: FortunePanel } = await import('../src/opus-bay/play/FortunePanel');
styles.deregister();
const fortune = await import('../src/opus-bay/play/fortune');
const kit = await import('../src/opus-bay/play/kit');
const { game } = await import('../src/opus-bay/core/store');
afterEach(() => { cleanup(); kit.__resetKit(); });

const h = React.createElement;
const tick = () => new Promise(r => setTimeout(r, 5));

test('W7-M-review fortune: under StrictMode the card stays up with its activity; closing it ends the activity', async () => {
  kit.__setBestWriter(null);
  kit.__resetKit();
  const prev = game.get();
  act(() => { game.set({ phase: 'playing', mode: 'free', riding: null, photoMode: false }); });
  try {
    const f = fortune.tellFortune();
    assert.ok(f, 'a card');
    assert.equal(kit.currentActivity()?.spec.id, fortune.FORTUNE_ID);
    let closed = 0;
    const view = render(h(React.StrictMode, null, h(FortunePanel, { props: { fortune: f, n: 1 }, close: () => { closed++; } })));
    await act(async () => { await tick(); });
    assert.equal(kit.currentActivity()?.spec.id, fortune.FORTUNE_ID, 'the fortune still runs after the StrictMode remount');
    assert.ok(view.container.querySelector('.ob-sfg-panel.is-fortune'), 'the booth is up');
    assert.equal(closed, 0);
    // the card goes (好的 / ✕ / Esc close the overlay): the activity ends with it
    view.unmount();
    await tick();
    assert.equal(kit.currentActivity(), null, 'ended with the card');
  } finally { act(() => { game.set({ phase: prev.phase, mode: prev.mode }); }); }
});
