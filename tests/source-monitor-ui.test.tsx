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
const { resetSourceFreshnessCache } = await import('../src/features/source-monitor/content-review-runtime');
const { TrustRow } = await import('../src/features/source-monitor/TrustRow');
const { setLocale } = await import('../src/i18n/locale');
const request = api.request;
afterEach(async () => { cleanup(); api.request = request; resetSourceFreshnessCache(); await setLocale('zh-Hans', false); });

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

const JARGON = /抓取|多来源|取最早|待编辑复核|人工确认|基线|自动检查|fetch|oldest across|editorial review/iu;
const official = 'https://organizer.example/event';
const today = '2026-10-08';
const item = { kind: 'event' as const, verifiedAt: '2026-09-29', endDate: '2026-10-31', nextDate: '2026-10-24' };
const unchanged = { sourceId: 'first', status: 'unchanged', needsReview: false, lastFetchedAt: Date.parse('2026-10-07T18:00:00Z'), lastReviewedAt: null };
const mount = async (element: React.ReactElement) => { let view!: ReturnType<typeof render>; await act(async () => { view = render(element); }); await act(async () => {}); return view; };
const reader = (contentId = 'sample-event') => <>
  <SourceFreshness contentId={contentId} item={item} officialUrl={official} include={['soft']} today={today} />
  <TrustRow contentId={contentId} item={item} sourceUrl={official} sourceLabel="organizer.example" today={today} />
</>;

test('a pending source change becomes one plain line under the facts, without pipeline wording', async () => {
  api.request = async () => ({ sources: [{ ...unchanged, status: 'changed', needsReview: true }] });
  const view = await mount(reader());
  const line = view.getByRole('note', { name: '官方页面提示' });
  assert.equal(line.textContent, '主办方页面有更新，出发前看一眼官方 ›', 'an undated change does not claim it was recent');
  assert.equal(view.getByRole('link', { name: '出发前看一眼官方 ›' }).getAttribute('href'), official);
  const trust = view.getByRole('note', { name: '来源与核对' });
  assert.equal(trust.textContent, '官方来源 organizer.example\u00a0· 编辑核对 9/29', 'no "no change" claim while a change is pending');
  assert.doesNotMatch(view.container.textContent || '', JARGON);
  assert.doesNotMatch(view.container.textContent || '', /已核实/);
});

test('an unchanged source shows the trust row only, with separate editor and automatic dates', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T19:00:00Z') });
  api.request = async () => ({ sources: [unchanged, { ...unchanged, sourceId: 'gone', status: 'expired', needsReview: true }] });
  let view = await mount(reader());
  assert.equal(view.queryByRole('note', { name: '官方页面提示' }), null);
  const trust = view.getByRole('note', { name: '来源与核对' });
  assert.equal(trust.textContent, '官方来源 organizer.example\u00a0· 编辑核对 9/29\u00a0· 自动比对 10/7 无变化');
  assert.deepEqual([...trust.querySelectorAll('time')].map(time => time.getAttribute('datetime')), ['2026-09-29', '2026-10-07T18:00:00.000Z']);
  // The row wraps as text: the check mark shares an unbreakable item with its label, each
  // "label date" pair is one item, and every separator ends a line rather than starting one.
  const items = [...trust.querySelectorAll('.trust-row-item')];
  assert.deepEqual(items.map(node => node.textContent), ['官方来源', '编辑核对 9/29', '自动比对 10/7 无变化']);
  assert.ok(items[0].querySelector('svg'), 'the check mark is never alone on a line');
  for (const node of items.slice(1)) assert.match(node.previousSibling?.textContent || '', /\u00a0· $/);
  view.unmount(); resetSourceFreshnessCache();
  await setLocale('en', false);
  view = await mount(reader('english-event'));
  assert.equal(view.getByRole('note', { name: 'Source and checks' }).textContent, 'Official source organizer.example\u00a0· Editor checked Sep 29\u00a0· Auto-compared Oct 7, no change');
  assert.doesNotMatch(view.container.textContent || '', /[㐀-鿿]/u);
});

test('manual-required, error and unreachable sources stay off the reader page', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T19:00:00Z') });
  const answers: (() => Promise<unknown>)[] = [
    async () => ({ sources: [{ ...unchanged, status: 'manual-required', lastFetchedAt: null }] }),
    async () => ({ sources: [{ ...unchanged, status: 'error' }, unchanged] }),
    async () => { throw { error: '网络连接异常，请稍后再试。' }; },
    async () => ({ error: 'unexpected' }),
  ];
  for (const [index, answer] of answers.entries()) {
    api.request = answer;
    const view = await mount(reader(`quiet-${index}`));
    assert.equal(view.queryByRole('note', { name: '官方页面提示' }), null, String(index));
    assert.equal(view.getByRole('note', { name: '来源与核对' }).textContent, '官方来源 organizer.example\u00a0· 编辑核对 9/29', String(index));
    view.unmount();
  }
});

test('dated, near-date and hard prompts read naturally in every language', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T19:00:00Z') });
  const changedAt = Date.parse('2026-10-06T17:00:00Z');
  api.request = async () => ({ sources: [{ ...unchanged, status: 'changed', needsReview: true, material: true, changedAt }] });
  let view = await mount(<SourceFreshness contentId="dated" item={{ kind: 'offer', verifiedAt: '2026-10-04' }} officialUrl={official} today={today} />);
  assert.equal(view.getByRole('note').textContent, '官方页面 10/6 有更新，领取前看一眼官方 ›');
  view.unmount();
  api.request = async () => ({ sources: [{ ...unchanged, status: 'manual-required' }] });
  view = await mount(<SourceFreshness contentId="near" item={{ ...item, nextDate: '2026-10-10', verifiedAt: '2026-09-20' }} officialUrl={official} today={today} />);
  assert.equal(view.getByRole('note').textContent, '日期就在这几天，出发前看一眼官方 ›');
  assert.doesNotMatch(view.container.textContent || '', JARGON);
  view.unmount();
  await setLocale('zh-Hant', false);
  api.request = async () => ({ sources: [{ ...unchanged, status: 'changed', needsReview: true, changeFields: ['cancel'] }] });
  view = await mount(<SourceFreshness contentId="hard" item={item} today={today} />);
  assert.equal(view.getByRole('note').textContent, '主辦方頁面顯示可能改期或取消，出發前務必確認。');
  view.unmount();
  await setLocale('en', false);
  api.request = async () => ({ sources: [{ ...unchanged, status: 'changed', needsReview: true, changedAt }] });
  view = await mount(<SourceFreshness contentId="english" item={item} officialUrl={official} today={today} />);
  assert.equal(view.getByRole('note').textContent, 'The organizer’s page was updated on Oct 6. Take a quick look before you go ›');
});

test('readers on one page share a single bounded request and each reads only its own sources', async () => {
  const requests: string[] = [];
  api.request = async endpoint => { requests.push(endpoint); return { sources: [
    { ...unchanged, sourceId: 'shared', contentIds: ['first-event', 'second-event'] },
    { ...unchanged, sourceId: 'own', contentIds: ['second-event'], status: 'changed', needsReview: true },
  ] }; };
  const view = await mount(<>
    {reader('first-event')}
    <SourceFreshness contentId="second-event" item={item} today={today} />
    <SourceFreshness contentId="third-event" item={item} today={today} />
  </>);
  assert.deepEqual(requests, ['/sources/freshness?ids=first-event,second-event,third-event']);
  assert.equal(view.getAllByRole('note', { name: '官方页面提示' }).length, 1, 'only the event whose own source changed shows a prompt');
  await mount(reader('first-event'));
  assert.equal(requests.length, 1, 'a recent answer is reused');
});

test('AI event cards pass their dates, so an ended card never asks the reader to check before going', async () => {
  const { MemoryRouter } = await import('react-router');
  const { default: AiLocalPage } = await import('../src/pages/AiLocalPage');
  api.request = async endpoint => {
    const ids = new URL(endpoint, 'https://x.example').searchParams.get('ids')?.split(',') ?? [];
    return { sources: ids.map(id => ({ ...unchanged, sourceId: `source-${id}`, contentIds: [id], status: 'changed', needsReview: true })) };
  };
  const view = await mount(<MemoryRouter><AiLocalPage today="2026-10-05" /></MemoryRouter>);
  await act(async () => { fireEvent.click(view.getByRole('checkbox', { name: '显示已结束场次' })); });
  await act(async () => {});
  const cards = [...view.container.querySelectorAll('article.bl-ai-event')];
  const ended = cards.filter(card => card.classList.contains('bl-ai-event--ended'));
  assert.ok(ended.length > 0 && ended.length < cards.length, 'the page mixes ended and upcoming cards');
  for (const card of ended) assert.equal(card.querySelector('.reader-freshness-line'), null, card.querySelector('h3')?.textContent ?? '');
  for (const card of cards.filter(card => !ended.includes(card))) assert.ok(card.querySelector('.reader-freshness-line'), card.querySelector('h3')?.textContent ?? '');
});
