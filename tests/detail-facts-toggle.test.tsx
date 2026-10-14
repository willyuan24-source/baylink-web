import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

/**
 * H58: a long cost note clamped to two lines on a phone opens in place. 展开 → the whole note shows (data-open, no clamp in
 * facts-grid.css) and the button says 收起; 收起 closes it again. Nothing is fetched and the page does not move elsewhere.
 */
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/events/x' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, act, fireEvent } = await import('@testing-library/react');
const { EventFacts } = await import('../src/features/detail/FactsGrid');
const { MONTHLY_EVENTS } = await import('../src/data/monthly-edition');
const { setLocale } = await import('../src/i18n/locale');
type MonthlyEvent = (typeof MONTHLY_EVENTS)[number];

afterEach(() => cleanup());
after(() => dom.window.close());

const LONG = '基础入场及停车免费；日间大迷宫6岁以上$9、5岁及以下免费；周五周六夜迷宫$13；其他项目、南瓜和餐饮另付。';
const event = (): MonthlyEvent => {
  const base = MONTHLY_EVENTS[0];
  assert.ok(base, 'the catalog has events');
  return { ...base, planning: undefined, sessions: undefined, cost: 'free', costLabel: LONG } as MonthlyEvent;
};

test('展开 opens a clamped cost note in place and 收起 closes it', async () => {
  await setLocale('zh-Hans', false);
  const view = render(<EventFacts event={event()} today="2026-10-13" />);
  const cell = view.container.querySelector('[data-fact="cost"]')!;
  const toggle = view.getByRole('button', { name: '展开：多少钱' });
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.ok(!cell.hasAttribute('data-open'));
  await act(async () => { fireEvent.click(toggle); });
  assert.ok(cell.hasAttribute('data-open'), 'open: no clamp');
  const close = view.getByRole('button', { name: '收起：多少钱' });
  assert.equal(close.getAttribute('aria-expanded'), 'true');
  assert.equal(document.getElementById(close.getAttribute('aria-controls')!)?.textContent, LONG);
  await act(async () => { fireEvent.click(close); });
  assert.ok(!cell.hasAttribute('data-open'));
  assert.equal(view.getByRole('button', { name: '展开：多少钱' }).getAttribute('aria-expanded'), 'false');
});

test('the toggle reads More / Less in English', async () => {
  await setLocale('en', false);
  try {
    const view = render(<EventFacts event={event()} today="2026-10-13" />);
    const toggle = view.container.querySelector('.detail-fact__toggle')!;
    assert.equal(toggle.textContent, 'More');
    assert.equal(toggle.getAttribute('aria-label'), 'More: Cost');
    await act(async () => { fireEvent.click(toggle); });
    assert.equal(toggle.textContent, 'Less');
  } finally {
    await setLocale('zh-Hans', false);
  }
});
