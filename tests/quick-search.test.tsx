import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { searchQuickDestinations } = await import('../src/lib/quick-search');
const { QuickExplore } = await import('../src/components/QuickExplore');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

test('quick discovery finds tools, upcoming events and attractions with multilingual queries', async () => {
  assert.equal(searchQuickDestinations('房贷', 'zh-Hans').tools[0].id, 'loan');
  assert.equal(searchQuickDestinations('mortgage', 'zh-Hans').tools[0].id, 'loan');
  assert.equal(searchQuickDestinations('钢琴', 'zh-Hans', '2026-09-09').events[0].id, 'flower-piano-2026');
  assert.equal(searchQuickDestinations('钢琴', 'zh-Hans', '2026-09-21').events.length, 0);
  assert.equal(searchQuickDestinations('净滩', 'zh-Hans', '2026-09-09').events[0].id, 'treasure-island-coastal-cleanup-2026');
  assert.equal(searchQuickDestinations('金门大桥', 'zh-Hans').attractions[0].id, 'golden-gate');
  assert.equal(searchQuickDestinations('no-such-place-123', 'zh-Hans').attractions.length, 0);
  assert.equal(searchQuickDestinations('', 'zh-Hans').tools.length, 0);
  await setLocale('zh-Hant', false);
  assert.equal(searchQuickDestinations('金門大橋', 'zh-Hant').attractions[0].id, 'golden-gate');
  await setLocale('en', false);
  assert.equal(searchQuickDestinations('piano', 'en', '2026-09-09').events[0].id, 'flower-piano-2026');
});

test('keyboard opens the matching tool and IME enter never navigates', () => {
  const opened: string[] = [];
  const view = render(<QuickExplore onClose={() => {}} onSearch={() => {}} onNavigate={path => opened.push(path)} onAsk={() => {}} />);
  const input = view.getByRole('combobox');
  fireEvent.click(view.getByRole('button', { name: '小费', exact: true }));
  assert.equal(document.activeElement, input);
  assert.equal((input as HTMLInputElement).value, '小费');
  fireEvent.change(input, { target: { value: '房贷' } });
  fireEvent.compositionStart(input);
  fireEvent.submit(input.closest('form')!);
  assert.deepEqual(opened, []);
  fireEvent.compositionEnd(input);
  fireEvent.submit(input.closest('form')!);
  assert.deepEqual(opened, ['/tools?tool=loan#tool-workspace']);
  fireEvent.change(input, { target: { value: '金门大桥' } });
  assert.equal(view.getAllByRole('option').filter(option => option.textContent?.startsWith('金门大桥与 Fort Point')).length, 1);
  fireEvent.keyDown(input, { key: 'ArrowUp' });
  assert.equal(input.getAttribute('aria-activedescendant'), `quick-result-${view.getAllByRole('option').length - 1}`);
});
