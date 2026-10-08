import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { contentReviewQueue, contentReviewToday, guideContentReviewRecord, parseContentReviewManifest, type ContentReviewRecord } from '../src/lib/content-review';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/me' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, act } = await import('@testing-library/react');
const { EditorialReviewQueue } = await import('../src/features/source-monitor/EditorialReviewQueue');
const { readEditorialReviewManifest, resetSourceFreshnessCache } = await import('../src/features/source-monitor/content-review-runtime');
const { ContentReviewNotice } = await import('../src/features/source-monitor/ContentReviewNotice');
const { api } = await import('../src/lib/api');
const request = api.request;
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); api.request = request; resetSourceFreshnessCache(); await setLocale('zh-Hans', false); });

const record: ContentReviewRecord = { kind: 'offer', id: 'sample', title: 'Original offer', path: '/offers/sample', sourceUrls: ['https://example.com/official'], verifiedAt: '2026-10-01', risk: 'time-sensitive', cadenceDays: 7 };

test('review dates use the current Pacific day and reject missing, future or invalid dates without renewing records', () => {
  assert.equal(contentReviewToday(new Date('2026-10-07T06:59:59Z')), '2026-10-06');
  assert.equal(contentReviewToday(new Date('2026-10-07T07:00:00Z')), '2026-10-07');
  assert.equal(contentReviewQueue([record], '2026-10-07')[0].status, 'scheduled');
  assert.equal(contentReviewQueue([record], '2026-10-08')[0].status, 'due');
  for (const verifiedAt of [undefined, '2026-10-09', '2026-02-30', 'not-a-date']) assert.equal(contentReviewQueue([{ ...record, verifiedAt }], '2026-10-08')[0].status, 'missing-date');
  assert.equal(contentReviewQueue([{ ...record, endDate: '2026-02-30' }], '2026-10-08')[0].status, 'missing-date');
  assert.equal(contentReviewQueue([{ ...record, endDate: '2026-10-07' }], '2026-10-08')[0].status, 'archived');
  assert.equal(record.verifiedAt, '2026-10-01');
  assert.throws(() => contentReviewQueue([record], '2026-02-30'));
});

test('guides carry a meta line instead of a date box and never ask the source monitor', async () => {
  const guide = guideContentReviewRecord({ slug: 'medicare-test', title: 'Medicare preparation', tags: [], sources: [{ title: 'Official', url: 'https://example.com/official', description: '' }, { title: 'Second', url: 'https://example.com/second', description: '' }], updatedAt: '2026-10-05' });
  assert.equal(guide.dateMeaning, 'content-updated'); assert.equal(guide.cadenceDays, 30);
  assert.equal(contentReviewQueue([guide], '2026-11-04')[0].status, 'due', 'the editor cadence is kept');
  const requests: string[] = [];
  api.request = async endpoint => { requests.push(endpoint); return { sources: [] }; };
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<ContentReviewNotice record={guide} today="2026-11-04" sourcesAnchor="#guide-sources" />); });
  assert.equal(view.queryByRole('complementary'), null, 'no banner on a guide, even when its review is due');
  assert.equal(view.getByRole('link', { name: '官方参考资料 2 项 ›' }).getAttribute('href'), '#guide-sources');
  assert.ok(view.getByText('关于日期'));
  assert.match(view.container.textContent || '', /“更新”日期是这篇指南内容的整理日期，不代表每个官方来源都在当天重新核验/);
  assert.deepEqual(requests, []);
  assert.equal(guide.verifiedAt, '2026-10-05');
  view.unmount();
  await setLocale('en', false);
  await act(async () => { view = render(<ContentReviewNotice record={guideContentReviewRecord({ slug: 'one', title: 'One', tags: [], sources: [{ title: 'Official', url: 'https://example.com/official', description: '' }], updatedAt: '2026-10-05' })} today="2026-10-06" sourcesAnchor="#guide-sources" />); });
  assert.ok(view.getByRole('link', { name: '1 official reference ›' }));
  assert.doesNotMatch(view.container.textContent || '', /[㐀-鿿]/u);
});

test('discovery notices follow source state: the calendar alone never raises a box', async () => {
  api.request = async () => ({ sources: [{ sourceId: 's', status: 'unchanged', needsReview: false, lastFetchedAt: Date.parse('2026-10-07T12:00:00Z'), lastReviewedAt: null }] });
  const quiet = [
    { record, today: '2026-10-20' },
    { record: { ...record, manualReviewReason: 'Internal capture detail' }, today: '2026-10-06' },
    { record: { ...record, verifiedAt: '2026-12-01' }, today: '2026-10-06' },
    { record: { ...record, verifiedAt: undefined }, today: '2026-10-06' },
  ];
  for (const value of quiet) {
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<ContentReviewNotice record={value.record} today={value.today} />); });
    assert.equal(view.container.textContent, '', JSON.stringify(value.record));
    view.unmount();
  }
  await setLocale('en', false);
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<ContentReviewNotice record={{ ...record, endDate: '2026-10-05' }} today="2026-10-06" />); });
  assert.match(view.getByRole('complementary').textContent || '', /coverage period has ended/);
  assert.equal(view.getByRole('link').getAttribute('href'), 'https://example.com/official');
  assert.doesNotMatch(view.container.textContent || '', /[㐀-鿿]|Internal capture detail/u);
  view.unmount();
  api.request = async () => ({ sources: [{ sourceId: 's', status: 'changed', needsReview: true, changeFields: ['cancel'], lastFetchedAt: 1, lastReviewedAt: null }] });
  await act(async () => { view = render(<ContentReviewNotice record={{ ...record, kind: 'event', id: 'cancelled' }} today="2026-10-06" />); });
  await act(async () => {});
  const box = view.getByRole('complementary', { name: 'Official page change' });
  assert.equal(box.querySelector('h2')?.textContent, 'The organizer’s page suggests a date change or cancellation');
  assert.equal(view.getByRole('link', { name: 'Open the official page ›' }).getAttribute('href'), 'https://example.com/official');
  assert.doesNotMatch(view.container.textContent || '', /[㐀-鿿]/u);
});

test('admin queue recomputes dates, paginates and remains read only instead of trusting generated statuses', async context => {
  const items = Array.from({ length: 30 }, (_, index) => ({ ...record, id: `record-${index}`, path: `/offers/record-${index}`, title: `Original offer ${index}`, status: 'scheduled', nextReviewAt: '2099-12-31' }));
  const requests: { url: string; options?: RequestInit }[] = [];
  context.mock.method(globalThis, 'fetch', async (url: unknown, options?: RequestInit) => { requests.push({ url: String(url), options }); return Response.json({ version: 1, items }); });
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<EditorialReviewQueue today="2026-10-07" />); });
  assert.match(view.container.textContent || '', /30 记录 · 0 需要复核/);
  await act(async () => { view.rerender(<EditorialReviewQueue today="2026-10-08" />); });
  assert.match(view.container.textContent || '', /30 记录 · 30 需要复核/);
  assert.equal(view.getAllByRole('link', { name: /Original offer/ }).length, 24);
  fireEvent.click(view.getByRole('button', { name: '显示更多复核记录' }));
  assert.equal(view.getAllByRole('link', { name: /Original offer/ }).length, 30);
  assert.equal(requests.length, 1); assert.equal(requests[0].url, '/content-review-manifest.json');
  assert.equal(requests[0].options?.method, undefined); assert.equal(requests[0].options?.body, undefined);
  assert.equal(requests[0].options?.credentials, 'omit');
  assert.ok(items.every(item => item.verifiedAt === '2026-10-01' && item.status === 'scheduled'));
});

test('invalid or failed review inventory never presents a false all-reviewed result', async context => {
  assert.throws(() => parseContentReviewManifest({ version: 1, items: [{ ...record, path: '/api/delete-account' }] }, '2026-10-08'));
  assert.throws(() => parseContentReviewManifest({ version: 1, items: [record, record] }, '2026-10-08'));
  context.mock.method(globalThis, 'fetch', async () => Response.json({ version: 1, items: [{ ...record, cadenceDays: 0 }] }));
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<EditorialReviewQueue today="2026-10-08" />); });
  assert.match(view.getByRole('alert').textContent || '', /不能据此认定内容都已复核/);
  assert.doesNotMatch(view.container.textContent || '', /0 需要复核/);
  view.unmount();
  context.mock.method(globalThis, 'fetch', async () => new Response('x'.repeat(2 * 1024 * 1024 + 1)));
  await assert.rejects(readEditorialReviewManifest(new AbortController().signal), /too large/);
});
