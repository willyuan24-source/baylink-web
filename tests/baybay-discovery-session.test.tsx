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
const { BayBayDiscoveryResults, BayBayRetrievalLabel } = await import('../src/components/BayBayDiscoveryResults');
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
