// WEB-FRESH-ADMIN: the editor's material-first source queue and the organiser-image queue, against stubbed admin answers.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { api } from '../src/lib/api';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/me' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, localStorage: dom.window.localStorage });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, act, within } = await import('@testing-library/react');
const { AdminSourceMonitor } = await import('../src/features/source-monitor/AdminSourceMonitor');
const { MediaCandidateQueue } = await import('../src/features/source-monitor/MediaCandidateQueue');
const { triageQueue, readersSeeIt } = await import('../src/features/source-monitor/source-triage-queue');
const { parseMediaCandidates, permissionMailto, rightsRecord } = await import('../src/features/source-monitor/media-request');
const { setLocale } = await import('../src/i18n/locale');
const request = api.request;
afterEach(async () => { cleanup(); api.request = request; window.localStorage.clear(); await setLocale('zh-Hans', false); });

const NOW = Date.now();
const hours = (value: number) => NOW - value * 3_600_000;
const hash = (letter: string) => letter.repeat(64);
const base = { kind: 'event', errorCode: '', lastFetchedAt: hours(1), lastAttemptAt: hours(1), lastReviewedAt: null, reviewNote: '' };
const change = (at: number) => ({ before: 'Saturday 10am', after: 'Saturday 1pm', removed: ['Saturday 10am'], added: ['Saturday 1pm'], summary: '1 removed / 1 added lines', detectedAt: at, firstDetectedAt: at });
const rows = [
  { ...base, id: 'untriaged', title: 'Untriaged market', url: 'https://market.example', status: 'changed', reviewStatus: 'pending', hash: hash('a'), pendingChange: change(hours(90)) },
  { ...base, id: 'material-new', title: 'New material', url: 'https://new.example', status: 'unchanged', reviewStatus: 'pending', hash: hash('b'), pendingChange: change(hours(10)), triage: { hash: hash('b'), material: true, fields: ['time'], summaryZh: '周六开始时间改为下午 1 点' } },
  { ...base, id: 'material-old', title: 'Old material', url: 'https://old.example', status: 'changed', reviewStatus: 'pending', hash: hash('c'), pendingChange: change(hours(60)), triage: { hash: hash('c'), material: true, fields: ['price', 'date'], summaryZh: '门票改为 15 美元' } },
  { ...base, id: 'cancel', title: 'Cancelled parade', url: 'https://parade.example', status: 'changed', reviewStatus: 'pending', hash: hash('d'), pendingChange: change(hours(2)), triage: { hash: hash('d'), material: true, fields: ['cancel'], summaryZh: '页面写明活动取消' } },
  { ...base, id: 'stale-verdict', title: 'Verdict on older text', url: 'https://stale.example', status: 'changed', reviewStatus: 'pending', hash: hash('e'), pendingChange: change(hours(70)), triage: { hash: hash('f'), material: true, fields: ['date'], summaryZh: '旧文本' } },
  { ...base, id: 'blocked', title: 'Blocked page', url: 'https://blocked.example', status: 'manual-required', errorCode: 'http-403', reviewStatus: 'none', hash: '', pendingChange: null },
  { ...base, id: 'auto', title: 'Cosmetic carousel', url: 'https://auto.example', status: 'changed', reviewStatus: 'dismissed', reviewedBy: 'auto-triage', lastReviewedAt: hours(3), hash: hash('g'), pendingChange: null, triage: { hash: hash('g'), material: false, fields: [], summaryZh: '只是轮播图更新' } },
  { ...base, id: 'ended', title: 'Ended fair', url: 'https://ended.example', status: 'expired', reviewStatus: 'pending', hash: hash('h'), pendingChange: change(hours(200)) },
  { ...base, id: 'quiet', title: 'Quiet page', url: 'https://quiet.example', status: 'unchanged', reviewStatus: 'acknowledged', hash: hash('i'), pendingChange: null },
];

test('the queue is material-first: cancellations, then material changes oldest first, then unjudged ones; a verdict on older text does not count', () => {
  const queue = triageQueue(rows, NOW);
  assert.deepEqual(queue.cancel.map(row => row.id), ['cancel']);
  assert.deepEqual(queue.material.map(row => row.id), ['material-old', 'material-new']);
  assert.deepEqual(queue.untriaged.map(row => row.id), ['untriaged', 'stale-verdict'], 'oldest first; the verdict was for another hash');
  assert.deepEqual(queue.unreadable.map(row => row.id), ['blocked']);
  assert.deepEqual(queue.autoDismissed.map(row => row.id), ['auto']);
  assert.deepEqual(rows.filter(row => readersSeeIt(row, NOW)).map(row => row.id), ['material-old', 'cancel'], 'exactly what getReaderFreshness shows readers');
});

test('the desk opens on the queue in that order and confirms or dismisses a change in one click through the existing PATCH', async () => {
  const writes: { endpoint: string; body: Record<string, unknown> }[] = [];
  api.request = async (endpoint: string, options?: RequestInit) => {
    if (options?.method === 'PATCH') { writes.push({ endpoint, body: JSON.parse(options.body as string) }); return { reviewed: true }; }
    if (endpoint === '/admin/source-monitor') return { sources: rows, running: false, intervalHours: 6, batchLimit: 40, triage: { enabled: false, reason: 'flag-off', calls: 0, dailyLimit: 200 } };
    throw new Error(`unexpected ${endpoint}`);
  };
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<AdminSourceMonitor />); });
  await act(async () => {});
  assert.match(view.getByRole('note').textContent || '', /自动分诊未开启（SOURCE_TRIAGE 为 off）/);
  const groups = view.getAllByRole('region').filter(region => region.classList.contains('source-monitor-group'));
  assert.deepEqual(groups.map(group => group.getAttribute('aria-label')), ['可能取消或改期', '重要变化', '未分诊的变化']);
  assert.deepEqual(within(groups[1]).getAllByRole('heading', { level: 3 }).map(heading => heading.textContent), ['Old material', 'New material']);
  assert.match(groups[1].textContent || '', /门票改为 15 美元/);
  assert.match(groups[1].textContent || '', /价格/);
  assert.equal((groups[1].textContent || '').match(/读者已看到提示/g)?.length, 1, 'only the change past 48 hours');
  const summary = Object.fromEntries([...view.container.querySelectorAll('.source-monitor-summary > div')].map(item => [item.querySelector('dt')!.textContent, item.querySelector('dd')!.textContent]));
  assert.deepEqual(summary, { 可能取消或改期: '1', 重要变化: '2', 读者已看到提示: '2', 未分诊: '2', 无法读取: '1' });
  assert.equal(view.queryByText('Ended fair'), null, 'expired sources leave the queue');
  assert.equal(view.queryByText('Blocked page'), null, 'unreadable sources have their own view');
  await act(async () => { fireEvent.click(within(groups[1]).getAllByRole('button', { name: '标记为无关变化' })[1]); });
  assert.deepEqual(writes, [{ endpoint: '/admin/source-monitor/material-new/review', body: { expectedHash: hash('b'), decision: 'dismissed', note: '' } }], 'one click, no note required');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: /无法读取/ })); });
  assert.ok(view.getByText('Blocked page'));
  assert.match(view.container.textContent || '', /此状态不代表活动取消/);
});

const candidates = { candidates: [
  { sourceId: 'source-a', kind: 'event', title: 'Harvest festival', url: 'https://harvest.example/2026', contentIds: ['harvest-2026'], nextDate: null, listings: [{ title: '丰收节', path: '/events/harvest-2026' }], ogImage: 'https://harvest.example/hero.jpg', ogImageWidth: 1200, ogImageHeight: 630, ogImageAlt: 'Families at the pumpkin patch' },
  { sourceId: 'source-b', kind: 'event', title: 'Library storytime', url: 'https://library.example/story', contentIds: ['story'], nextDate: null, listings: [], ogImage: 'https://library.example/logo.png', likelyLogo: true },
  { sourceId: 'source-c', kind: 'event', title: 'Winter lights', url: 'https://lights.example', contentIds: ['lights'], nextDate: '2027-01-15', listings: [], ogImage: 'https://lights.example/a.jpg' },
  { sourceId: 'source-d', kind: 'event', title: 'Bad', url: 'javascript:alert(1)', ogImage: 'https://x.example/a.jpg' },
] };

test('image candidates: next 21 days only, never displayed; request, record a basis or reject, kept in this browser', async () => {
  const today = '2026-10-12';
  const soon = { ...candidates, candidates: candidates.candidates.map(item => item.sourceId === 'source-a' ? { ...item, nextDate: '2026-10-17' } : item) };
  api.request = async (endpoint: string) => { assert.equal(endpoint, '/admin/source-monitor/media-candidates'); return soon; };
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<MediaCandidateQueue today={today} />); });
  await act(async () => {});
  assert.deepEqual(view.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent), ['丰收节'], 'logos and later dates are filtered out by default');
  assert.equal(view.container.querySelectorAll('img').length, 0, 'no candidate image is loaded or shown');
  const mail = view.getByRole('link', { name: '请求授权' }).getAttribute('href') || '';
  assert.match(mail, /^mailto:\?subject=Photo%20permission%20request%3A%20Harvest%20festival&body=/);
  assert.match(decodeURIComponent(mail), /remove it promptly if you ask/);
  assert.match(decodeURIComponent(mail), /https:\/\/harvest\.example\/hero\.jpg/);
  fireEvent.click(view.getByRole('button', { name: '记录 PD·CC 依据' }));
  fireEvent.change(view.getByLabelText('授权依据'), { target: { value: 'press-kit' } });
  // The browser blocks an empty or malformed URL itself; an http:// one reaches our own check.
  fireEvent.change(view.getByLabelText(/证明网址/), { target: { value: 'http://harvest.example/press' } });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '记录并复制' })); });
  assert.match(view.getByRole('alert').textContent || '', /https 开头的证明网址/);
  fireEvent.change(view.getByLabelText(/证明网址/), { target: { value: 'https://harvest.example/press' } });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '记录并复制' })); });
  const record = JSON.parse(view.container.querySelector('.media-record')!.textContent!);
  assert.deepEqual(record.rights, { basis: 'press-kit', evidenceUrl: 'https://harvest.example/press', scope: '仅用于这场活动在 BAYLINK 的介绍页', promoAllowed: false });
  assert.equal(record.candidate.imageUrl, 'https://harvest.example/hero.jpg');
  assert.equal(record.status, 'awaiting owner download approval');
  assert.equal(JSON.parse(window.localStorage.getItem('baylink.admin.media-decisions.v1')!)['source-a|https://harvest.example/hero.jpg'].decision, 'recorded');
  cleanup();
  await act(async () => { view = render(<MediaCandidateQueue today={today} />); });
  await act(async () => {});
  assert.equal(view.queryAllByRole('heading', { level: 3 }).length, 0, 'handled candidates leave the default view');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '包括已处理的' })); });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '撤销' })); });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '拒绝' })); });
  assert.equal(JSON.parse(window.localStorage.getItem('baylink.admin.media-decisions.v1')!)['source-a|https://harvest.example/hero.jpg'].decision, 'rejected');
});

test('only the documented candidate shape is trusted, and a rights record needs its evidence', () => {
  assert.equal(parseMediaCandidates({ error: 'x' }), null);
  const parsed = parseMediaCandidates(candidates)!;
  assert.deepEqual(parsed.map(item => item.sourceId), ['source-a', 'source-b', 'source-c'], 'a javascript: page URL is dropped');
  const [harvest] = parsed;
  assert.ok(permissionMailto(harvest).length < 2000, 'short enough for every mail app');
  const ok = { basis: 'permission' as const, evidenceUrl: 'https://mail.example/thread', scope: 'Same-event coverage', promoAllowed: false, grantedAt: '2026-10-12' };
  assert.equal(rightsRecord(harvest, { ...ok, grantedAt: undefined }, '2026-10-12'), null, 'written permission needs its date');
  assert.equal(rightsRecord(harvest, { ...ok, evidenceUrl: 'http://insecure.example' }, '2026-10-12'), null);
  assert.equal(rightsRecord(harvest, { ...ok, scope: ' ' }, '2026-10-12'), null);
  assert.deepEqual(rightsRecord(harvest, ok, '2026-10-12')?.rights, { basis: 'permission', evidenceUrl: 'https://mail.example/thread', scope: 'Same-event coverage', promoAllowed: false, grantedAt: '2026-10-12' });
});

test('the desk reads in English without Chinese chrome', async () => {
  await setLocale('en', false);
  api.request = async (endpoint: string) => endpoint === '/admin/source-monitor' ? { sources: rows.filter(row => row.id === 'material-old'), running: false, triage: { enabled: true, reason: 'on', calls: 3, dailyLimit: 200 } } : { candidates: [] };
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<AdminSourceMonitor />); });
  await act(async () => {});
  const desk = view.container.querySelector('.source-monitor')!.cloneNode(true) as HTMLElement;
  // Data stays as written: the triage summary is Chinese by contract (summary_zh), the panels below have their own tests.
  for (const node of desk.querySelectorAll('.source-monitor-triage, .product-metrics, .editorial-review-queue, .feedback-admin')) node.remove();
  assert.doesNotMatch(desk.textContent || '', /[㐀-鿿]/u);
  assert.match(desk.textContent || '', /Triage used 3 of 200 calls today/);
  assert.match(desk.textContent || '', /readers see a prompt/);
});

test('source titles are data: shown in the reader’s script (繁體 for zh-Hant) and kept from page translation', async () => {
  await setLocale('zh-Hant', false);
  const chinese = { ...rows[2], title: '旧金山舰队活动' };
  api.request = async (endpoint: string) => endpoint === '/admin/source-monitor' ? { sources: [chinese], running: false, triage: { enabled: true, reason: 'on', calls: 0, dailyLimit: 200 } } : { candidates: [] };
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<AdminSourceMonitor />); });
  await act(async () => {});
  const heading = view.getByRole('heading', { level: 3, name: '舊金山艦隊活動' });
  assert.equal(heading.getAttribute('translate'), 'no');
});
