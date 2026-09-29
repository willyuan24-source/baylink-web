import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { after, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

/**
 * W6-K1 · lane K1's DOM checks: the E prompt re-reads its interactable when the source renames it in place (lane R's
 * review: at Marina Green the prompt still read 看看飞行表演 after the jets were up).
 */

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/opus-bay?save=off', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  KeyboardEvent: dom.window.KeyboardEvent, performance: globalThis.performance, IS_REACT_ACT_ENVIRONMENT: true,
});
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, cleanup, act } = await import('@testing-library/react');
const { Hud } = await import('../src/opus-bay/ui/Hud');
const { MoveChip } = await import('../src/opus-bay/ui/MoveChip');
styles.deregister();
const { game } = await import('../src/opus-bay/core/store');
const I = await import('../src/opus-bay/game/interactables');
const { flow } = await import('../src/opus-bay/game/flowStore');
afterEach(() => { cleanup(); });
// the window's timers (the HUD's lazy parts) would keep the file alive: close it (as tests/opus-bay-w5-lang-review.test.ts)
after(() => { dom.window.close(); setTimeout(() => process.exit(0), 200).unref(); });

const h = React.createElement;

test('W6-K1: the E prompt follows a label its source renames in place (the jets: 看看飞行表演 → 拍飞机编队)', () => {
  let up = false;
  const off = I.registerInteractables('k1-test-jets', () => [{
    id: 'k1-jets', source: 'event', action: 'photo', name: { zh: '飞机编队', en: 'The jets' },
    verb: up ? { zh: '拍飞机编队', en: 'Photograph the jets' } : { zh: '看看飞行表演', en: 'See the air show' },
    x: 0, z: 0, radius: 5,
  } as ReturnType<typeof I.interactables>[number]]);
  try {
    act(() => {
      I.setInteractables(I.buildInteractables());
      game.set({ phase: 'playing', worldMode: 'city', focus: 'k1-jets', dialogue: { nodeId: null }, panel: { kind: null } } as never);
    });
    const view = render(h(Hud));
    const text = () => view.container.querySelector('.ob-context, .ob-touch-action')?.textContent ?? '';
    assert.match(text(), /See the air show|看看飞行表演/);
    // the show starts: the source renames the item and bumps the epoch; the list is swapped in after (Systems' layout effect)
    act(() => {
      up = true;
      I.invalidateInteractables();
      I.setInteractables(I.buildInteractables());
    });
    assert.match(text(), /Photograph the jets|拍飞机编队/, `the prompt re-read its label (${text()})`);
    view.unmount();
  } finally {
    off();
    act(() => { game.set({ focus: null } as never); I.setInteractables(I.buildInteractables()); });
  }
});

test('W6-K1 (lane T\'s review): aboard the ferry the move chip says 船上 / On deck and 下船, a train still 车厢里 / 下车', () => {
  act(() => { game.set({ phase: 'playing', worldMode: 'city', move: { mode: 'transit', spot: 'seat' }, dialogue: { nodeId: null }, focus: null } as never); });
  try {
    act(() => { flow.set({ ride: { stage: 'riding', from: 'a', to: 'b', kind: 'ferry' } }); });
    const view = render(h(MoveChip));
    const text = () => view.container.textContent ?? '';
    assert.match(text(), /On deck|船上/);
    assert.doesNotMatch(text(), /On board|车厢里/);
    act(() => { flow.set({ ride: { stage: 'riding', from: 'a', to: 'b', kind: 'cable-car' } }); });
    assert.match(text(), /On board|车厢里/);
    view.unmount();
  } finally {
    act(() => { flow.set({ ride: null }); game.set({ move: { mode: 'foot' } } as never); });
  }
});
