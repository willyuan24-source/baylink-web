import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { GuideChatResponse } from '../src/lib/baybay-conversation';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { BayBayAnswer, BayBayDiscoveryResults, BayBayRetrievalLabel } = await import('../src/components/BayBayDiscoveryResults');
const { GUEST_WEB_CANDIDATES_KEY, loadGuestWebCandidates } = await import('../src/lib/planner-web-search');
const noop = () => {};
const props = { variant: 'headless' as const, panelOpen: true, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop };
const login = (id: string) => localStorage.setItem('currentUser', JSON.stringify({ id, token: `token-${id}` }));
const discovery = (): GuideChatResponse => ({ ok: true, answer: '实际来源介绍 [1]', responseMode: 'web',
  retrieval: { requestedMode: 'smart', scope: 'web', webStatus: 'completed', checkedAt: '2026-10-01T19:00:00.000Z', requestedDate: '2026-10-17' },
  matchNote: '已查询公开网页来源；当日名额与适用条件仍以原文为准。', matchingPosts: [],
  sources: [{ title: 'Official museum', url: 'https://museumca.org/visit/' }],
  webCandidates: [{ id: 'web-museum', name: 'Museum candidate', city: 'Oakland', summary: null, timeSummary: null, priceSummary: null, sourceUrls: ['https://museumca.org/visit/'] }],
});
afterEach(() => { cleanup(); localStorage.clear(); });

test('global BayBay outside the router outlet saves with explicitly supplied account identity', async t => {
  login('member');
  const saved: { authorization: string | null; body: { candidates: unknown[]; revision: number } }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: unknown, options: RequestInit) => {
    if (String(url).endsWith('/ai/guide-chat')) return Response.json(discovery());
    assert.ok(String(url).endsWith('/planner/web-candidates'));
    assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer token-member');
    if (options.method !== 'PUT') return Response.json({ candidates: [], revision: 0 });
    const body = JSON.parse(String(options.body));
    saved.push({ authorization: new Headers(options.headers).get('Authorization'), body });
    return Response.json({ ...body, revision: 1 });
  });
  const view = render(<BayBayAssistantEntry {...props} ownerId="member" sessionKey="member" pendingQuestion="Oakland museum hours" pendingQuestionId={1} />);
  await view.findByText('Museum candidate');
  assert.ok(view.getByText(/保存到你的私人候选清单/));
  assert.equal(view.queryByText(/游客候选/), null);
  assert.equal(view.queryByRole('region', { name: '站内真实帖子' }), null, 'a web-only note must not become a site-post section');
  fireEvent.click(view.getByRole('button', { name: '存入候选' }));
  await view.findByRole('button', { name: '已存入候选' });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].body.candidates.length, 1);
  assert.equal((saved[0].body.candidates[0] as { requestedDate: string }).requestedDate, '2026-10-17');
  assert.equal(saved[0].body.revision, 0);
  assert.equal(localStorage.getItem(GUEST_WEB_CANDIDATES_KEY), null);
});

test('legacy or invalid response dates are not inferred from the answer when saving a candidate', async () => {
  for (const requestedDate of [undefined, '2026-02-30', '2026-10-17T00:00:00Z']) {
    const response = discovery();
    response.answer = 'The answer happens to mention 2026-11-11. [1]';
    if (requestedDate === undefined) delete response.retrieval!.requestedDate;
    else response.retrieval!.requestedDate = requestedDate;
    const view = render(<BayBayDiscoveryResults response={response} />);
    fireEvent.click(view.getByRole('button', { name: '存入候选' }));
    await view.findByRole('button', { name: '已存入候选' });
    assert.equal(loadGuestWebCandidates()[0].requestedDate, null);
    view.unmount(); localStorage.clear();
  }
});

test('BayBay retrieval dates use Pacific time, preserve date-only values and label invalid values unknown', () => {
  for (const [checkedAt, expected] of [['2026-10-02T02:00:00Z', '2026-10-01（湾区时间）'], ['2026-10-01', '2026-10-01'], ['2026-02-30', '查询日期未知']]) {
    const response = discovery(); response.retrieval!.checkedAt = checkedAt;
    const view = render(<BayBayRetrievalLabel response={response} />);
    assert.ok(view.container.textContent!.includes(expected));
    view.unmount();
  }
});

test('failed location or date verification is explained without technical model details or usable web candidates', () => {
  const response = discovery();
  response.retrieval = { ...response.retrieval!, webStatus: 'verification_failed', model: 'private-model-id', configuredModel: 'configured-model-id' };
  const view = render(<><BayBayRetrievalLabel response={response} /><BayBayDiscoveryResults response={response} /></>);
  assert.match(view.getByRole('status').textContent!, /未通过地点或日期检查/);
  assert.equal(view.queryByRole('button', { name: '存入候选' }), null);
  assert.doesNotMatch(view.container.textContent!, /private-model-id|configured-model-id|站外来源 1 条/);
});

test('catalog answers render safe numbered official citations without web candidates or live lookup labels', () => {
  const response: GuideChatResponse = { ...discovery(), responseMode: 'catalog', answer: '<img src=x onerror=alert(1)> Catalog answer [1] [2] [99]',
    catalogSources: [{ title: 'Unsafe', url: 'javascript:alert(1)' }, { title: 'Official event', url: 'https://www.sfmta.com/calendar' }],
    retrieval: { requestedMode: 'smart', scope: 'site', webStatus: 'not_requested', catalogCheckedAt: '2026-10-04' } };
  const view = render(<><BayBayRetrievalLabel response={response} /><BayBayAnswer response={response} /><BayBayDiscoveryResults response={response} /></>);
  assert.match(view.container.textContent!, /资料核对 2026-10-04/);
  assert.ok(view.getByRole('region', { name: '站内收录官方来源' }));
  assert.equal(view.getByRole('link', { name: '[2]' }).getAttribute('href'), 'https://www.sfmta.com/calendar');
  assert.equal(view.queryByRole('link', { name: '[1]' }), null);
  assert.equal(view.queryByRole('link', { name: '[99]' }), null);
  assert.equal(view.container.querySelector('li')?.value, 2, 'rejecting source 1 must not renumber source 2');
  assert.equal(view.container.querySelector('img'), null, 'answer text remains escaped');
  assert.equal(view.queryByRole('button', { name: '存入候选' }), null);
  assert.doesNotMatch(view.container.textContent!, /本次联网来源|站外来源|Museum candidate/);
  for (const link of view.getAllByRole('link')) assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  view.rerender(<><BayBayRetrievalLabel response={{ ...response, retrieval: { ...response.retrieval!, webStatus: 'verification_failed' } }} /><BayBayDiscoveryResults response={response} /></>);
  assert.match(view.getByRole('status').textContent!, /以下显示站内参考资料/);
  assert.ok(view.getByRole('region', { name: '站内收录官方来源' }), 'failed web verification still shows the catalog fallback');
});

test('empty or unsafe catalog sources leave plain answers and never promote stray web payloads', () => {
  for (const catalogSources of [[], [{ title: 'Private', url: 'http://127.0.0.1/' }], [{ title: 'Credentials', url: 'https://user:password@example.com/' }]]) {
    const response: GuideChatResponse = { ...discovery(), responseMode: 'catalog', catalogSources,
      retrieval: { requestedMode: 'smart', scope: 'site', webStatus: 'not_requested', catalogCheckedAt: '2026-02-30' } };
    const view = render(<><BayBayRetrievalLabel response={response} /><BayBayAnswer response={response} /><BayBayDiscoveryResults response={response} /></>);
    assert.match(view.container.textContent!, /实际来源介绍 \[1\]/);
    assert.doesNotMatch(view.container.textContent!, /2026-02-30|本次联网来源|Museum candidate/);
    assert.equal(view.queryAllByRole('link').length, 0);
    assert.equal(view.queryByRole('region', { name: '站内收录官方来源' }), null);
    view.unmount();
  }
  const response: GuideChatResponse = { ...discovery(), responseMode: 'catalog', catalogSources: discovery().sources };
  const view = render(<><BayBayAnswer response={response} /><BayBayDiscoveryResults response={response} /></>);
  assert.equal(view.queryAllByRole('link').length, 0, 'a contradictory scope must not become a catalog or web citation');
  assert.equal(view.queryByRole('button', { name: '存入候选' }), null);
});

test('catalog plus web keeps answer citations bound to catalog sources and web supplements separate and unnumbered', () => {
  const response: GuideChatResponse = { ...discovery(), responseMode: 'catalog', answer: 'Confirmed catalog event [1]. No catalog source [2].',
    catalogSources: [{ title: 'Catalog event', url: 'https://www.sfmta.com/calendar' }],
    webSearchReferences: [{ title: 'Supplemental result', url: 'https://www.sftravel.com/events' }, { title: 'Another result', url: 'https://fleetweeksf.org/' }],
    retrieval: { requestedMode: 'web', scope: 'site+web', webStatus: 'completed', catalogCheckedAt: '2026-10-02', checkedAt: '2026-10-05T02:00:00Z', model: 'private-model' } };
  const view = render(<><BayBayRetrievalLabel response={response} /><BayBayAnswer response={response} /><BayBayDiscoveryResults response={response} /></>);
  assert.match(view.container.textContent!, /站内活动与去处资料 · 资料核对 2026-10-02/);
  assert.equal(view.getByRole('link', { name: '[1]' }).getAttribute('href'), 'https://www.sfmta.com/calendar');
  assert.equal(view.queryByRole('link', { name: '[2]' }), null, 'web source 2 must not bind to catalog citation 2');
  const catalog = view.getByRole('region', { name: '站内收录官方来源' });
  assert.equal(catalog.querySelectorAll('a').length, 1);
  assert.equal(catalog.querySelector('a')?.getAttribute('href'), 'https://www.sfmta.com/calendar');
  const web = view.getByRole('region', { name: '联网补充来源' });
  assert.match(web.textContent!, /日期、场次及票价待核实/);
  assert.match(web.textContent!, /联网查询日期 2026-10-04（湾区时间）/);
  assert.equal(web.querySelectorAll('a').length, 2);
  assert.equal(web.querySelector('ol'), null);
  assert.equal(web.querySelector('li[value]'), null);
  assert.doesNotMatch(web.textContent!, /官方|\[1\]|\[2\]/);
  assert.doesNotMatch(view.container.textContent!, /Museum candidate|private-model|站外来源/);
  assert.equal(view.queryByRole('button', { name: '存入候选' }), null);
});

test('supplementary catalog links reject unsafe URLs and never replace absent catalog citations or failed lookups', () => {
  const response: GuideChatResponse = { ok: true, responseMode: 'catalog', answer: 'Catalog text [1]', catalogSources: [],
    webSearchReferences: [
      { title: 'Script', url: 'javascript:alert(1)' }, { title: 'Local', url: 'http://127.0.0.1/' },
      { title: 'Credentials', url: 'https://user:password@example.com/' }, { title: 'Safe <img src=x>', url: 'https://www.sftravel.com/events' },
    ], retrieval: { requestedMode: 'web', scope: 'site+web', webStatus: 'completed', checkedAt: '2026-02-30' } };
  const view = render(<><BayBayAnswer response={response} /><BayBayDiscoveryResults response={response} /></>);
  assert.equal(view.queryByRole('link', { name: '[1]' }), null);
  assert.equal(view.queryByRole('region', { name: '站内收录官方来源' }), null);
  assert.equal(view.getAllByRole('link').length, 1);
  assert.equal(view.getByRole('link').getAttribute('href'), 'https://www.sftravel.com/events');
  assert.equal(view.getByRole('link').getAttribute('rel'), 'noopener noreferrer');
  assert.equal(view.container.querySelector('img'), null);
  assert.doesNotMatch(view.container.textContent!, /2026-02-30|Script|Credentials|Local/);
  for (const change of [
    { responseMode: 'web' }, { retrieval: { ...response.retrieval!, scope: 'site' as const } },
    { retrieval: { ...response.retrieval!, webStatus: 'verification_failed' as const } },
    { webSearchReferences: [{ title: 'Unsafe only', url: 'http://localhost/' }] },
  ]) {
    view.rerender(<BayBayDiscoveryResults response={{ ...response, ...change }} />);
    assert.equal(view.queryByRole('region', { name: '联网补充来源' }), null);
    assert.equal(view.queryAllByRole('link').length, 0);
  }
});

test('account changes abort an old shortlist save and cannot mark another account saved', async t => {
  login('a');
  let oldResolve!: (response: Response) => void;
  let oldSignal!: AbortSignal;
  const writes: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    const authorization = new Headers(options.headers).get('Authorization')!;
    if (authorization === 'Bearer token-a') {
      oldSignal = options.signal as AbortSignal;
      return new Promise<Response>(resolve => { oldResolve = resolve; });
    }
    if (options.method !== 'PUT') return Response.json({ candidates: [], revision: 0 });
    writes.push(authorization);
    return Response.json({ ...JSON.parse(String(options.body)), revision: 1 });
  });
  const response = discovery();
  const view = render(<BayBayDiscoveryResults response={response} ownerId="a" sessionKey="a" />);
  fireEvent.click(view.getByRole('button', { name: '存入候选' }));
  login('b');
  view.rerender(<BayBayDiscoveryResults response={response} ownerId="b" sessionKey="b" />);
  assert.equal(oldSignal.aborted, true);
  await act(async () => oldResolve(Response.json({ candidates: [], revision: 0 })));
  assert.deepEqual(writes, []);
  assert.equal(view.queryByRole('button', { name: '已存入候选' }), null);
  fireEvent.click(view.getByRole('button', { name: '存入候选' }));
  await view.findByRole('button', { name: '已存入候选' });
  assert.deepEqual(writes, ['Bearer token-b']);
  view.rerender(<BayBayDiscoveryResults response={response} ownerId="b" sessionKey="b-new-session" />);
  assert.equal(view.queryByRole('button', { name: '已存入候选' }), null, 'a replacement session clears local saved state too');
});

test('account switch clears old conversation and a late reply cannot enter the new session', async t => {
  const pending: { resolve: (response: Response) => void; signal: AbortSignal; history: unknown[] }[] = [];
  t.mock.method(globalThis, 'fetch', (_url: unknown, options: RequestInit) => new Promise<Response>(resolve => {
    pending.push({ resolve, signal: options.signal as AbortSignal, history: JSON.parse(String(options.body)).history });
  }));
  login('a');
  const view = render(<BayBayAssistantEntry {...props} ownerId="a" sessionKey="a" pendingQuestion="前一个账号的问题" pendingQuestionId={1} />);
  login('b');
  view.rerender(<BayBayAssistantEntry {...props} ownerId="b" sessionKey="b" pendingQuestion="新账号的问题" pendingQuestionId={2} />);
  assert.equal(pending[0].signal.aborted, true);
  assert.deepEqual(pending[1].history, []);
  assert.equal(view.queryByText('前一个账号的问题'), null);
  await act(async () => pending[1].resolve(Response.json({ ok: true, answer: '新账号的答案' })));
  await act(async () => pending[0].resolve(Response.json({ ok: true, answer: '旧账号的秘密答案' })));
  assert.ok(view.getByText('新账号的答案'));
  assert.equal(view.queryByText('旧账号的秘密答案'), null);
});
