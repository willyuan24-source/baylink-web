import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { api } from '../src/lib/api';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/me' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, act } = await import('@testing-library/react');
const { setLocale } = await import('../src/i18n/locale');
const { ProductMetrics } = await import('../src/features/source-monitor/ProductMetrics');
const request = api.request;
const summary = { days: 30, from: '2026-08-25', through: '2026-09-23', counts: { planner_recommendation: 37, plan_saved: 12, plan_shared: 8, official_source_click: 16, favorite_saved: 4, planner_map_opened: 9, planner_outing_adopted: 7, planner_edit_applied: 3, planner_web_search: 5 } };
afterEach(async () => { cleanup(); api.request = request; await setLocale('zh-Hans', false); });

test('usage metrics render known counts in English and keep newly unavailable metrics unknown', async () => {
  let resolve!: (value: unknown) => void;
  const pending = new Promise(yes => { resolve = yes; });
  api.request = async endpoint => { assert.equal(endpoint, '/admin/product-metrics'); return pending; };
  await setLocale('en', false);
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<ProductMetrics />); });
  assert.match(view.getByRole('status').textContent || '', /Loading/);
  assert.equal(view.container.querySelectorAll('dd').length, 0);
  await act(async () => { resolve(summary); });
  const cells = [...view.container.querySelectorAll('dd')].map(cell => cell.textContent);
  assert.deepEqual(cells.slice(0, 9), ['37', '12', '8', '16', '4', '9', '7', '3', '5']);
  assert.ok(cells.length > 9 && cells.slice(9).every(value => value === '—'));
  assert.match(view.container.textContent || '', /not user counts, conversion rates or return rates/);
  assert.ok(!/[\u3400-\u9fff]/.test(view.container.textContent || ''));
});

test('failed and malformed metric responses remain errors until a successful retry', async () => {
  let calls = 0;
  api.request = async () => {
    calls++;
    if (calls === 1) throw { status: 503 };
    if (calls === 2) return { ...summary, counts: { ...summary.counts, plan_saved: undefined } };
    return summary;
  };
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<ProductMetrics />); });
  assert.match(view.getByRole('alert').textContent || '', /未将缺失数据记为零/);
  assert.equal(view.container.querySelectorAll('dd').length, 0);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '重试统计' })); });
  assert.ok(view.getByRole('alert'));
  assert.equal(view.container.querySelectorAll('dd').length, 0);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '重试统计' })); });
  assert.equal(view.queryByRole('alert') === null, true);
  assert.ok(view.container.querySelectorAll('dd').length > 9);
});

test('the retired client_error counter shows only while the window still holds old counts, labelled as retired', async () => {
  api.request = async () => ({ ...summary, counts: { ...summary.counts, client_error: 6, feedback_sent: 2 } });
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<ProductMetrics />); });
  const retired = [...view.container.querySelectorAll('dt')].find(term => /客户端错误/.test(term.textContent || ''));
  assert.equal(retired?.textContent, '客户端错误（旧计数，已停用；现见下方「前端报错」）');
  assert.equal(retired?.nextElementSibling?.textContent, '6');
  cleanup();
  await setLocale('en', false);
  await act(async () => { view = render(<ProductMetrics />); });
  assert.match(view.container.textContent || '', /Client errors \(old counter, retired; see Browser errors below\)6/);
  cleanup();
  for (const counts of [summary.counts, { ...summary.counts, client_error: 0 }]) {
    api.request = async () => ({ ...summary, counts });
    await act(async () => { view = render(<ProductMetrics />); });
    assert.doesNotMatch(view.container.textContent || '', /Client errors/, 'no tile once the old counts have rolled out');
    cleanup();
  }
  api.request = async () => ({ ...summary, counts: { ...summary.counts, client_error: -1 } });
  await act(async () => { view = render(<ProductMetrics />); });
  assert.ok(view.getByRole('alert'), 'a malformed retired count is still an error');
});
