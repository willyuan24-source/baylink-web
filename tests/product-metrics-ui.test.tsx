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
const summary = { days: 30, from: '2026-08-25', through: '2026-09-23', counts: { planner_recommendation: 37, plan_saved: 12, plan_shared: 8, official_source_click: 16, favorite_saved: 4, planner_map_opened: 9 } };
afterEach(async () => { cleanup(); api.request = request; await setLocale('zh-Hans', false); });

test('usage metrics never show invented zeroes while loading, then render six labeled operation counts in English', async () => {
  let resolve!: (value: unknown) => void;
  const pending = new Promise(yes => { resolve = yes; });
  api.request = async endpoint => { assert.equal(endpoint, '/admin/product-metrics'); return pending; };
  await setLocale('en', false);
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<ProductMetrics />); });
  assert.match(view.getByRole('status').textContent || '', /Loading/);
  assert.equal(view.container.querySelectorAll('dd').length, 0);
  await act(async () => { resolve(summary); });
  assert.deepEqual([...view.container.querySelectorAll('dd')].map(cell => cell.textContent), ['37', '12', '8', '16', '4', '9']);
  assert.equal(view.container.querySelectorAll('dt').length, 6);
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
  assert.equal(view.queryByRole('alert'), null);
  assert.equal(view.container.querySelectorAll('dd').length, 6);
});
