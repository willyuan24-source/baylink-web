import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { api } from '../src/lib/api';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, act } = await import('@testing-library/react');
const { AdminSourceMonitor } = await import('../src/features/source-monitor/AdminSourceMonitor');
const { SourceFreshness } = await import('../src/features/source-monitor/SourceFreshness');
const request = api.request;
afterEach(() => { cleanup(); api.request = request; });

const row = { id: 'source-test', title: 'Museum offer', url: 'https://museum.example/visit', kind: 'offer', status: 'changed', errorCode: '', lastFetchedAt: 1790190000000, lastAttemptAt: 1790190000000, lastReviewedAt: null, reviewStatus: 'pending', reviewNote: '', hash: 'a'.repeat(64), pendingChange: { before: 'Entry $5', after: 'Entry $10', removed: ['Entry $5'], added: ['Entry $10'], summary: '1 removed / 1 added lines', detectedAt: 1790190000000 } };

test('source reviews show evidence and submit the reviewed version only after an explicit editor action', async () => {
  const writes: { endpoint: string; body: Record<string, unknown> }[] = [];
  api.request = async (endpoint, options) => {
    if (options?.method === 'PATCH') { writes.push({ endpoint, body: JSON.parse(options.body as string) }); return { reviewed: true }; }
    return { sources: [row], running: false, intervalHours: 6 };
  };
  let view: ReturnType<typeof render>;
  await act(async () => { view = render(<AdminSourceMonitor />); });
  assert.match(view!.container.textContent || '', /Entry \$5/); assert.match(view!.container.textContent || '', /Entry \$10/);
  assert.equal(writes.length, 0);
  fireEvent.change(view!.getByLabelText('复核备注'), { target: { value: '官网确认票价已变更，准备修订优惠卡。' } });
  await act(async () => { fireEvent.click(view!.getByRole('button', { name: '已查看并确认' })); });
  assert.deepEqual(writes, [{ endpoint: '/admin/source-monitor/source-test/review', body: { expectedHash: row.hash, decision: 'acknowledged', note: '官网确认票价已变更，准备修订优惠卡。' } }]);
});

test('freshness warns about pending changes without claiming a new editorial verification', async () => {
  api.request = async () => ({ sources: [{ sourceId: row.id, lastFetchedAt: row.lastFetchedAt, needsReview: true, status: 'changed' }] });
  let view: ReturnType<typeof render>;
  await act(async () => { view = render(<SourceFreshness contentId="museum-offer" />); });
  assert.match(view!.container.textContent || '', /官方页面有变化/);
  assert.ok(!(view!.container.textContent || '').includes('已核实'));
});
