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
const { setLocale } = await import('../src/i18n/locale');
const request = api.request;
afterEach(async () => { cleanup(); api.request = request; await setLocale('zh-Hans', false); });

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

test('freshness aggregates every active source and never hides a later pending or unread source', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-06T12:00:00Z') });
  await setLocale('en', false);
  const good = { sourceId: 'first', lastFetchedAt: Date.parse('2026-10-05T12:00:00Z'), needsReview: false, status: 'unchanged' };
  const cases = [
    { second: { ...good, sourceId: 'second', needsReview: true, status: 'changed' }, expected: /changed and need editorial review/ },
    { second: { ...good, sourceId: 'second', lastFetchedAt: null, status: 'error' }, expected: /not been read successfully/ },
    { second: { ...good, sourceId: 'second', status: 'manual-required' }, expected: /not been read successfully/ },
    { second: { ...good, sourceId: 'second', lastFetchedAt: null, status: 'not-checked' }, expected: /not been read successfully/ },
    { second: { ...good, sourceId: 'second', lastFetchedAt: -1 }, expected: /not been read successfully/ },
    { second: { ...good, sourceId: 'second', lastFetchedAt: Date.parse('2026-12-01T12:00:00Z') }, expected: /not been read successfully/ },
  ];
  for (const value of cases) {
    api.request = async () => ({ sources: [good, value.second] });
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<SourceFreshness contentId="multiple-sources" />); });
    assert.match(view.container.textContent || '', value.expected);
    assert.doesNotMatch(view.container.textContent || '', /[\u3400-\u9fff]/u);
    assert.equal(view.container.querySelector('time'), null);
    view.unmount();
  }
});

test('successful source dates use the oldest active fetch and explicitly remain separate from factual verification', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-06T12:00:00Z') });
  await setLocale('en', false);
  const older = Date.parse('2026-10-03T12:00:00Z');
  api.request = async () => ({ sources: [
    { sourceId: 'newer', status: 'unchanged', needsReview: false, lastFetchedAt: Date.parse('2026-10-05T12:00:00Z') },
    { sourceId: 'older', status: 'baseline', needsReview: false, lastFetchedAt: older },
    { sourceId: 'archived', status: 'expired', needsReview: true, lastFetchedAt: Date.parse('2026-09-01T12:00:00Z') },
  ] });
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<SourceFreshness contentId="successful-sources" />); });
  assert.match(view.container.textContent || '', /oldest across sources; not factual verification/);
  assert.equal(view.container.querySelector('time')?.getAttribute('datetime'), new Date(older).toISOString());
  assert.equal(view.container.querySelector('p')?.style.fontSize, 'var(--text-body, 1rem)');
  view.unmount();
  api.request = async () => ({ sources: [{ sourceId: 'archived', status: 'expired', needsReview: true, lastFetchedAt: older }] });
  await act(async () => { view = render(<SourceFreshness contentId="all-archived" />); });
  assert.equal(view.container.textContent, '');
});
