import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

/**
 * Wave 9 · lane A, the adversarial review's fixes (docs/opus-bay/sf-w9-A.md "Review (Ultra)"):
 *   A-RV-1  the back button while a BAYBAY line is still typing closes it (it only finished the text, used up the guard's
 *           entry, and the next back left the game with the line on screen);
 *   A-RV-2  an arrow / Tab pressed while the menu line types (or a held arrow's repeats) is not "the player moved the
 *           focus": Space still cancels instead of pressing the row 1 the menu focused for you;
 *   A-RV-3  the 115 / 130 % dialogue box keeps its height cap (the zoom multiplied it: 382 px on a 340 px landscape phone).
 */

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/opus-bay?save=off', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  KeyboardEvent: dom.window.KeyboardEvent, performance: globalThis.performance, IS_REACT_ACT_ENVIRONMENT: true,
});
(dom.window.HTMLElement.prototype as unknown as { checkVisibility: () => boolean }).checkVisibility = function (this: HTMLElement) { return !this.closest('[hidden]'); };
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, cleanup, act } = await import('@testing-library/react');
const { Dialogue } = await import('../src/opus-bay/ui/Dialogue');
styles.deregister();
const { game, initialGameState } = await import('../src/opus-bay/core/store');
const flowMod = await import('../src/opus-bay/game/flow');
const { setStorageForTests } = await import('../src/opus-bay/data/wishlist');
setStorageForTests(null);

const h = React.createElement;
type Choice = import('../src/opus-bay/core/types').DialogueChoice;
const L = (zh: string): Choice['label'] => ({ zh, en: zh });
const MENU: Choice[] = [
  { label: L('做个动作'), action: { type: 'ask', id: 'play-emotes' } },
  { label: L('附近有什么？'), next: 'flow.nearby' },
  { label: L('打开地图'), action: { type: 'open-map' } },
  { label: L('没事，继续逛'), action: { type: 'end' } },
];
const ASK = '我在！想做点什么？';
const LONG = '我们沿着海边一路走过去，先看看渡轮大楼的钟楼，再去三十九号码头看海狮晒太阳，最后在日落之前爬上科伊特塔看整个湾区的灯一盏一盏亮起来。';

let view: ReturnType<typeof render> | null = null;
/** a line that types (reduced motion off), as in the city */
function open(id: string, text: string, choices?: Choice[]) {
  act(() => {
    game.set({ ...initialGameState(), phase: 'playing', worldMode: 'city', mode: 'free', settings: { ...initialGameState().settings, reducedMotion: false } });
    flowMod.playDialogue(flowMod.defineNode({ id, speaker: 'baybay', mood: 'happy', text: { zh: text, en: text }, choices }));
  });
  view ??= render(h('main', { className: 'ob-page' }, h(Dialogue)));
}
const rows = () => [...document.querySelectorAll<HTMLButtonElement>('.ob-dialogue .ob-choice')];
const shownText = () => document.querySelector('.ob-dialogue-text > span[aria-hidden]:not(.ob-dialogue-ghost)')?.textContent ?? '';
function key(code: string, extra: KeyboardEventInit = {}, at: Element | null = document.activeElement) {
  const k = code === 'Space' ? ' ' : code;
  act(() => { (at ?? document.body).dispatchEvent(new dom.window.KeyboardEvent('keydown', { code, key: k, bubbles: true, cancelable: true, ...extra })); });
}
const wait = (ms: number) => act(async () => { await new Promise(r => setTimeout(r, ms)); });
afterEach(() => { act(() => { flowMod.closeDialogue(); game.set({ panel: { kind: null } }); }); });
after(() => { view?.unmount(); cleanup(); dom.window.close(); });

test('A-RV-2: an arrow pressed while the menu line types, then Space on the row the menu focused = cancel (red before: Space pressed row 1)', async () => {
  open('flow.call', ASK, MENU);
  assert.ok(shownText().length < ASK.length, 'the line is still typing');
  key('ArrowUp');
  await wait(700);
  assert.equal(document.activeElement, rows()[0], 'the menu focused row 1 for you (the arrow moved nothing while it typed)');
  key('Space');
  assert.equal(game.get().dialogue.nodeId, null, 'Space = 没事，继续逛');
  assert.equal(game.get().panel.kind, null, 'no row ran');
});

test('A-RV-2: a held arrow\'s repeats (and a Tab while typing) do not count as moving the focus; a fresh arrow after the line does', async () => {
  open('flow.call', ASK, MENU);
  key('Tab');
  await wait(700);
  key('ArrowDown', { repeat: true });
  assert.equal(document.activeElement, rows()[0], 'a repeat keydown moves nothing');
  key('Space');
  assert.equal(game.get().dialogue.nodeId, null, 'Space still cancels');
  open('flow.call', ASK, MENU);
  await wait(700);
  key('ArrowDown');
  key('ArrowUp');
  assert.equal(document.activeElement, rows()[0], 'down then up: back on row 1, moved there by the player');
  key('Space');
  assert.equal(game.get().dialogue.nodeId, 'flow.call', 'Space is the row\'s own (a browser clicks it), not a cancel');
});

test('A-RV-1: the back button while a line is still typing closes it at once (red before: it only finished the text and the next back left the game)', async () => {
  open('qa.long', LONG);
  await wait(400);
  assert.equal((window.history.state as { obBack?: string } | null)?.obBack, 'w9a', 'the guard\'s entry is on top');
  assert.ok(shownText().length < LONG.length, 'still typing');
  window.history.back();
  await new Promise(r => setTimeout(r, 700));
  assert.equal(game.get().dialogue.nodeId, null, 'back closed the line');
  assert.notEqual((window.history.state as { obBack?: string } | null)?.obBack, 'w9a', 'nothing left on top: the next back leaves');
  // Esc from the keyboard still only finishes a typing line first (the player may want to read it)
  open('qa.long', LONG);
  key('Escape');
  assert.equal(game.get().dialogue.nodeId, 'qa.long');
  assert.equal(shownText(), LONG, 'Esc shows the whole line');
});

test('A-RV-3: the zoomed dialogue box divides its height cap by the zoom (red before: 1.3 × (340 − 46) = 382 px on a 844×340 phone)', () => {
  const css = readFileSync(new URL('../src/opus-bay/opus-bay.css', import.meta.url), 'utf8');
  // the cap divided by the zoom (lane Q's W9-Q-review Q-RV-3 landed the same fix first; the rebase kept theirs)
  for (const z of ['115', '130']) {
    const caps = [...css.matchAll(new RegExp(`\\.ob-page\\[data-ob-text='${z}'\\] \\.ob-dialogue-box \\{ max-height: ([^;]+);`, 'g'))].map(m => m[1]);
    assert.equal(caps.length, 2, `${z} %: the desktop and phone caps`);
    for (const cap of caps) assert.ok(cap.endsWith(`/ ${Number(z) / 100})`), `${z} %: ${cap} is divided by the zoom`);
  }
  // inside the cap the question keeps its lines and the cards their height; the choices scroll (844×340 at 130 %: rows 71 px
  // around 121 px labels, the question's 2nd line under row 1 before)
  assert.ok(/\.ob-page\[data-ob-text\] \.ob-dialogue-box > \.ob-dialogue-text \{ flex-shrink: 0; \}/.test(css), 'the question does not shrink');
  assert.ok(/\.ob-page\[data-ob-text\] \.ob-dialogue-box > \.ob-choices \{ grid-auto-rows: max-content; \}/.test(css), 'the cards keep their height');
});
