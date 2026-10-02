import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

/**
 * W6-K2 part a, in a DOM: on a 390 × 844 phone the ARRIVED card (72 px above the phone bar) covered the 更多 menu's
 * upper rows. The menu wins: while a More menu is open the card steps back (class is-waiting, hidden from assistive
 * tech) and its 6 s timer waits; the card comes back with the time it had left when the menu closes.
 */

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/opus-bay?save=off', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  KeyboardEvent: dom.window.KeyboardEvent, performance: globalThis.performance, IS_REACT_ACT_ENVIRONMENT: true,
});
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, cleanup, act } = await import('@testing-library/react');
const { ArrivalCard } = await import('../src/opus-bay/ui/ArrivalCard');
styles.deregister();
const { holdMoreMenu, moreMenuOpen } = await import('../src/opus-bay/ui/moreMenu');
afterEach(() => { cleanup(); });

const h = React.createElement;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const ARRIVAL = { place: 'coit-tower', name: { zh: '科伊特塔', en: 'Coit Tower' }, tier: 1 as const };

test('W6-K2: the More menu store counts open menus (phone bar + desktop 更多); a release is idempotent', () => {
  assert.equal(moreMenuOpen(), false);
  const a = holdMoreMenu(), b = holdMoreMenu();
  assert.equal(moreMenuOpen(), true);
  a(); a();
  assert.equal(moreMenuOpen(), true, 'one menu still open');
  b();
  assert.equal(moreMenuOpen(), false);
});

test('W6-K2: an open More menu wins over the ARRIVED card — it steps back, its timer waits, and it comes back after', async () => {
  let closed = 0;
  // (W9-F2: a first visit's card is sticky by default; the timer case is the non-sticky card)
  const view = render(h(ArrivalCard, { arrival: ARRIVAL, onInfo: () => {}, onPhoto: () => {}, onClose: () => { closed++; }, ms: 400, sticky: false }));
  const card = () => view.container.querySelector('.ob-arrival-card')!;
  assert.ok(!card().classList.contains('is-waiting'), 'shown at first');
  let release = () => {};
  act(() => { release = holdMoreMenu(); });
  assert.ok(card().classList.contains('is-waiting'), 'the menu opened: the card steps back');
  assert.equal(card().getAttribute('aria-hidden'), 'true');
  assert.ok(card().querySelector('.ob-arrival-timer.is-held'), 'its timer bar waits');
  await act(async () => { await sleep(700); });
  assert.equal(closed, 0, 'no time ran out while the menu was open');
  act(() => { release(); });
  assert.ok(!card().classList.contains('is-waiting'), 'the menu closed: the card is back');
  await act(async () => { await sleep(1300); });
  assert.equal(closed, 1, 'then it closes with the time it had left');
});

test('W6-K2: the new-save goals card waits while an egg\'s paper is up or an egg asks for the player (接电话), then shows', async () => {
  const styles2 = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const { GoalsCard } = await import('../src/opus-bay/ui/Moments');
  styles2.deregister();
  const { game } = await import('../src/opus-bay/core/store');
  const { flow } = await import('../src/opus-bay/game/flowStore');
  const { registerOverlay, openOverlay, closeOverlay } = await import('../src/opus-bay/ui/slots');
  const { registerPrefixResolver } = await import('../src/opus-bay/game/interactables');
  const offNote = registerOverlay({ id: 'egg-note', Component: () => null });
  const offRes = registerPrefixResolver('k2egg:', id => ({ id, source: 'find', action: 'info', verb: { zh: '接电话', en: 'Answer the phone' }, name: { zh: '电话', en: 'Phone' }, x: 0, z: 0, radius: 3 }));
  try {
    act(() => { game.set({ phase: 'playing', worldMode: 'city', dialogue: { nodeId: null }, panel: { kind: null }, focus: 'k2egg:phone' }); flow.set({ goalsCard: true, bubble: null }); });
    const view = render(h(GoalsCard));
    assert.equal(view.container.querySelector('.ob-goals-card'), null, 'the phone rings (its prompt is up): the card waits');
    act(() => { game.set({ focus: null }); openOverlay('egg-note'); });
    assert.equal(view.container.querySelector('.ob-goals-card'), null, 'the operator\'s paper is up: the card waits');
    act(() => { closeOverlay('egg-note'); });
    assert.ok(view.container.querySelector('.ob-goals-card'), 'then it shows');
    // the district as before: an overlay does not hold it there
    act(() => { game.set({ worldMode: 'district' }); openOverlay('egg-note'); });
    assert.ok(view.container.querySelector('.ob-goals-card'), 'district unchanged');
    act(() => { closeOverlay('egg-note'); });
  } finally { offNote(); offRes(); act(() => { flow.set({ goalsCard: false }); game.set({ worldMode: 'district', focus: null, phase: 'title' }); }); }
});
