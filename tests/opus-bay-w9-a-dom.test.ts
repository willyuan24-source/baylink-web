import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { after, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

/**
 * Wave 9 · lane A, in a DOM: the dialogue box's keys (review R§6 界面与交互: "BAYBAY 菜单按 Esc 关不掉，按 Space 会直接选中第
 * 1 项「做个动作」，按 Tab 会落到隐藏的 HUD 按钮上"; verify-tech t07-esc.jpg, t08-space.jpg, t09-tab.jpg), the paged call
 * menu, the focus trap of aria-modal dialogs and the back button (ui/backGuard.ts).
 */

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/opus-bay?save=off', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  KeyboardEvent: dom.window.KeyboardEvent, performance: globalThis.performance, IS_REACT_ACT_ENVIRONMENT: true,
});
// jsdom has no layout: every element counts as shown (the trap and the guard ask checkVisibility)
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
  { label: L('捉迷藏'), action: { type: 'ask', id: 'play-hide-seek' } },
  { label: L('摸摸 BAYBAY'), action: { type: 'ask', id: 'play-pet' } },
  { label: L('那是什么？'), action: { type: 'ask', id: 'play-skyline' } },
  { label: L('附近有什么？'), next: 'flow.nearby' },
  { label: L('带我环游旧金山（约 36 分钟）'), action: { type: 'ask', id: 'x-tour' } },
  { label: L('海边 7 站（湾区第一课）'), action: { type: 'ask', id: 'x-bay101' } },
  { label: L('这周有什么好玩的？'), action: { type: 'ask', id: 'x-week' } },
  { label: L('今天旧金山有什么？'), action: { type: 'ask', id: 'realsf-today' } },
  { label: L('用飞行券飞一次'), action: { type: 'ask', id: 'e-ticket' } },
  { label: L('打开地图'), action: { type: 'open-map' } },
  { label: L('没事，继续逛'), action: { type: 'end' } },
];

let view: ReturnType<typeof render> | null = null;
function open(id: string, choices: Choice[]) {
  act(() => {
    game.set({ ...initialGameState(), phase: 'playing', worldMode: 'city', mode: 'free', settings: { ...initialGameState().settings, reducedMotion: true } });
    flowMod.playDialogue(flowMod.defineNode({ id, speaker: 'baybay', mood: 'happy', text: { zh: '我在！想做点什么？', en: "I'm here! What would you like to do?" }, choices }));
  });
  view ??= render(h('main', { className: 'ob-page' }, h(Dialogue)));
}
const box = () => document.querySelector<HTMLElement>('.ob-dialogue');
const rows = () => [...document.querySelectorAll<HTMLButtonElement>('.ob-dialogue .ob-choice')];
const rowText = () => rows().map(b => b.textContent);
function key(code: string, at: Element | null = document.activeElement, extra: KeyboardEventInit = {}) {
  const k = code === 'Space' ? ' ' : code.startsWith('Digit') ? code.slice(5) : code;
  act(() => { (at ?? document.body).dispatchEvent(new dom.window.KeyboardEvent('keydown', { code, key: k, bubbles: true, cancelable: true, ...extra })); });
}
afterEach(() => { act(() => { flowMod.closeDialogue(); game.set({ panel: { kind: null } }); }); });
// the device detector's poll (ui/hooks.ts) and React's scheduler run on the window's timers: close it so the file exits
after(() => { view?.unmount(); cleanup(); dom.window.close(); });

test('W9-A1: Space on the menu cancels (it never picks row 1 the menu focused for you); Esc cancels (red before: Esc did nothing, Space opened 做个动作)', () => {
  open('flow.call', MENU);
  assert.equal(rows().length, 7, '5 rows + 更多… + 没事，继续逛 (was 12)');
  assert.equal(document.activeElement, rows()[0], 'the first row has the keyboard focus, as before');
  key('Space');
  assert.equal(game.get().dialogue.nodeId, null, 'Space = 没事，继续逛');
  open('flow.call', MENU);
  key('Escape');
  assert.equal(game.get().dialogue.nodeId, null, 'Esc = 没事，继续逛');
});

test('W9-A1: a row you moved to yourself (Tab / arrows) takes Space like any button; arrows move between rows', () => {
  open('flow.call', MENU);
  key('ArrowDown');
  assert.equal(document.activeElement, rows()[1], 'ArrowDown → row 2');
  key('ArrowUp');
  key('ArrowUp');
  assert.equal(document.activeElement, rows().at(-1), 'ArrowUp wraps to the last row');
  key('Space');
  assert.equal(game.get().dialogue.nodeId, 'flow.call', 'Space after the player moved the focus is the button\'s own (not a cancel)');
});

test('W9-A1: 更多… turns the page; every row of a page has its digit; 返回 comes back; a page-2 row runs its action', () => {
  open('flow.call', MENU);
  const page1 = rowText();
  assert.match(page1[5] ?? '', /6.*更多/, 'row 6 is 更多…');
  assert.match(page1[6] ?? '', /7.*没事，继续逛/, 'row 7 is the cancel row');
  key('Digit6');
  const page2 = rowText();
  assert.ok(page2.length <= 9 && page2.length > 1, `page 2: ${page2.length} rows`);
  page2.forEach((t, i) => assert.ok(t?.startsWith(String(i + 1)), `row ${i + 1} shows its digit: ${t}`));
  assert.match(page2.at(-1) ?? '', /返回/);
  assert.ok(page2.some(t => /打开地图/.test(t ?? '')), 'the map waits on page 2');
  key(`Digit${page2.length}`);
  assert.deepEqual(rowText(), page1, '返回 → page 1');
  key('Digit6');
  const mapRow = rowText().findIndex(t => /打开地图/.test(t ?? ''));
  key(`Digit${mapRow + 1}`);
  assert.equal(game.get().panel.kind, 'map', 'the row\'s action ran');
  assert.equal(game.get().dialogue.nodeId, null);
});

test('W9-A1: a menu without a cancel row (the welcome\'s four ways) ignores Esc and Space — never picks row 1', () => {
  const four: Choice[] = [1, 2, 3, 4].map(i => ({ hotkey: String(i), label: L(`w${i}`), action: { type: 'open-map' } }));
  open('intro.hello.test', four);
  key('Space');
  key('Escape');
  assert.equal(game.get().dialogue.nodeId, 'intro.hello.test');
  assert.equal(game.get().panel.kind, null, 'row 1 was not picked');
  assert.equal(box()?.getAttribute('data-ob-cancel'), '0', 'the back button lets this one be');
  key('Digit2');
  assert.equal(game.get().panel.kind, 'map', 'its own digits still choose');
});

test('W9-A1 / A6: a menu is an aria-modal dialog without aria-live; the whole line is one .ob-sr copy; Tab stays inside (red before: Tab went on to the HUD)', () => {
  open('flow.call', MENU);
  const dlg = box()!;
  assert.equal(dlg.getAttribute('role'), 'dialog');
  assert.equal(dlg.getAttribute('aria-modal'), 'true');
  assert.equal(dlg.getAttribute('aria-live'), null, 'no live region: the typewriter is not re-read');
  assert.equal(dlg.querySelector('.ob-sr')?.textContent, '我在！想做点什么？');
  // a control outside (the HUD) and the trap: Tab from the last row wraps to the first, Shift+Tab from the first to the last
  const outside = document.createElement('button');
  outside.textContent = 'HUD';
  document.querySelector('.ob-page')!.appendChild(outside);
  rows().at(-1)!.focus();
  key('Tab');
  assert.equal(document.activeElement, rows()[0], 'Tab from the last row → the first row');
  key('Tab', document.activeElement, { shiftKey: true });
  assert.equal(document.activeElement, rows().at(-1), 'Shift+Tab from the first row → the last');
  outside.focus();
  key('Tab');
  assert.ok(dlg.contains(document.activeElement), 'a focus outside comes back in');
  outside.remove();
});

test('W9-A2: the back button closes the open menu first (history entry + Escape) and lets the page go when nothing is open', async () => {
  open('flow.call', MENU);
  await act(async () => { await new Promise(r => setTimeout(r, 400)); });
  assert.equal((window.history.state as { obBack?: string } | null)?.obBack, 'w9a', 'an entry sits on top while the menu is open');
  // (outside act: React commits the close as a browser would, before the guard looks again)
  window.history.back();
  await new Promise(r => setTimeout(r, 700));
  assert.equal(game.get().dialogue.nodeId, null, 'back closed the menu (its cancel row)');
  assert.notEqual((window.history.state as { obBack?: string } | null)?.obBack, 'w9a', 'and nothing is left on top: the next back leaves');
  view?.unmount();
  view = null;
  cleanup();
});
