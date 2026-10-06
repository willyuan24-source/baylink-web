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
const { readEditorialReviewManifest } = await import('../src/features/source-monitor/content-review-runtime');
const { ContentReviewNotice } = await import('../src/features/source-monitor/ContentReviewNotice');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

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

test('guide scheduling uses the content update date without treating it as a source verification', () => {
  const guide = guideContentReviewRecord({ slug: 'medicare-test', title: 'Medicare preparation', tags: [], sources: [{ title: 'Official', url: 'https://example.com/official', description: '' }], updatedAt: '2026-10-05' });
  assert.equal(guide.dateMeaning, 'content-updated'); assert.equal(guide.cadenceDays, 30);
  assert.equal(contentReviewQueue([guide], '2026-11-04')[0].status, 'due');
  const view = render(<ContentReviewNotice record={guide} today="2026-10-06" sourcesAnchor="#guide-sources" />);
  assert.match(view.container.textContent || '', /内容更新，不表示每个官方来源在当天重新核验/);
  assert.equal(view.getByRole('link', { name: '查看官方参考资料' }).getAttribute('href'), '#guide-sources');
  assert.equal(view.getByRole('complementary').style.fontSize, 'var(--text-body, 1rem)');
  assert.equal(guide.verifiedAt, '2026-10-05');
});

test('reader warnings distinguish due, manual, missing and archive records with complete English controls', async () => {
  await setLocale('en', false);
  const cases = [
    { record, today: '2026-10-08', expected: /due for review/ },
    { record: { ...record, manualReviewReason: 'Internal capture detail' }, today: '2026-10-06', expected: /manual confirmation/ },
    { record: { ...record, verifiedAt: '2026-12-01' }, today: '2026-10-06', expected: /in the future/ },
    { record: { ...record, endDate: '2026-10-05' }, today: '2026-10-06', expected: /coverage period has ended/ },
  ];
  for (const value of cases) {
    const view = render(<ContentReviewNotice record={value.record} today={value.today} />);
    assert.match(view.container.textContent || '', value.expected);
    assert.doesNotMatch(view.container.textContent || '', /[\u3400-\u9fff]|Internal capture detail/);
    assert.equal(view.getByRole('link').getAttribute('href'), 'https://example.com/official');
    view.unmount();
  }
  const current = render(<ContentReviewNotice record={record} today="2026-10-06" />);
  assert.equal(current.container.textContent, '', 'current source-dated records do not acquire unnecessary warnings');
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
