import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

/**
 * Wave 5 · the adversarial review of lane E, in a DOM: one sheet at a time. On a phone the pill opened the Journal
 * UNDER the 小铺's bottom sheet (two stacked sheets, the Journal's tabs covered, the feet still held by the shop); a
 * panel or photo mode now closes the shop and the 飞行券 picker, and the shop's hold on the feet goes with it.
 */

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/opus-bay?save=off', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  KeyboardEvent: dom.window.KeyboardEvent, performance: globalThis.performance, IS_REACT_ACT_ENVIRONMENT: true,
});
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, cleanup, act } = await import('@testing-library/react');
const { ShopSheet, TicketPicker } = await import('../src/opus-bay/economy/Shop');
styles.deregister();
const { game } = await import('../src/opus-bay/core/store');
const { lockReport } = await import('../src/opus-bay/game/playerLock');
const save = await import('../src/opus-bay/data/save');
const L = await import('../src/opus-bay/economy/ledger');
afterEach(() => { cleanup(); act(() => { game.set({ panel: { kind: null }, photoMode: false }); }); });

const h = React.createElement;

test('W5-E-review 7: a panel opened over the 小铺 (the pill → the Journal) closes it and lets the feet go', () => {
  save.resetSaveCache();
  L.__resetLedgerForTests();
  act(() => { game.set({ phase: 'playing', worldMode: 'city', panel: { kind: null }, photoMode: false }); });
  let closed = 0;
  const view = render(h(ShopSheet, { props: { from: 'more' }, close: () => { closed++; } }));
  assert.ok(view.container.querySelector('.ob-shop'), 'the sheet is up');
  assert.equal(closed, 0, 'opening it closes nothing');
  assert.ok(lockReport().some(l => l.source === 'shop'), 'the feet are held while it is up');
  act(() => { game.set({ panel: { kind: 'journal' } }); });
  assert.equal(closed, 1, 'the Journal takes over: the shop closes');
  view.unmount();
  assert.ok(!lockReport().some(l => l.source === 'shop'), 'and the hold goes with it');
});

test('W5-E-review 7b: photo mode closes the shop; a panel closes the 飞行券 picker', () => {
  act(() => { game.set({ phase: 'playing', worldMode: 'city', panel: { kind: null }, photoMode: false }); });
  let shop = 0, picker = 0;
  render(h(ShopSheet, { props: {}, close: () => { shop++; } }));
  render(h(TicketPicker, { close: () => { picker++; } }));
  act(() => { game.set({ photoMode: true }); });
  assert.equal(shop, 1);
  act(() => { game.set({ photoMode: false, panel: { kind: 'map' } }); });
  assert.ok(picker >= 1, 'the map takes over from the picker');
});
