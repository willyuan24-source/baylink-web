import { mockBayBayFetch } from './baybay-test-transport';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { BayBayConversationDraft } from '../src/components/BayBayAssistantEntry';
import type { GuideChatResponse } from '../src/lib/baybay-conversation';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { BayBayRetrievalLabel } = await import('../src/components/BayBayDiscoveryResults');
const { parseBayBayAssistantFields } = await import('../src/lib/baybay-assistant');
const { setLocale } = await import('../src/i18n/locale');
const props = { variant: 'headless' as const, panelOpen: true, onPanelOpenChange: () => {}, onNavigate: () => {}, onCreatePostClick: () => {} };
afterEach(async () => { cleanup(); localStorage.clear(); await setLocale('zh-Hans', false); });

test('guests send only site requests and the signed-in modes send the current bearer token', async t => {
  const calls: { mode: string; auth: string | null }[] = [];
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => {
    calls.push({ mode: JSON.parse(String(init.body)).searchMode, auth: new Headers(init.headers).get('Authorization') });
    return Response.json({ ok: true, answer: `答复 ${calls.length}` });
  });
  const view = render(<BayBayAssistantEntry {...props} onLoginNeeded={() => {}} />);
  assert.ok(view.getByText('访客 · 仅站内'));
  assert.equal(view.queryByRole('button', { name: '联网查', exact: true }), null);
  assert.equal(view.queryByRole('button', { name: '智能检索', exact: true }), null);
  const ask = async () => { fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: '现在有哪些免费活动？' } }); await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); }); };
  await ask();
  assert.deepEqual(calls[0], { mode: 'site', auth: null });
  localStorage.setItem('currentUser', JSON.stringify({ id: 'member', token: 'actual-session-token' }));
  view.rerender(<BayBayAssistantEntry {...props} ownerId="member" sessionKey="member" onLoginNeeded={() => {}} />);
  assert.equal(view.queryByText('答复 1'), null, 'ordinary sign-in does not inherit a different session');
  await ask();
  assert.deepEqual(calls[1], { mode: 'smart', auth: 'Bearer actual-session-token' });
  fireEvent.click(view.getByRole('button', { name: '联网查', exact: true })); await ask();
  assert.deepEqual(calls[2], { mode: 'web', auth: 'Bearer actual-session-token' });
  fireEvent.click(view.getByRole('button', { name: '仅站内', exact: true })); await ask();
  assert.deepEqual(calls[3], { mode: 'site', auth: 'Bearer actual-session-token' });
});

test('a server authentication fallback changes the member UI to site-only without losing the answer', async t => {
  const modes: string[] = [];
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => {
    modes.push(JSON.parse(String(init.body)).searchMode);
    return Response.json({ ok: true, answer: `保留站内答复 ${modes.length}`, retrieval: { requestedMode: 'web', effectiveMode: 'site', scope: 'site', webStatus: 'auth_required', webAccess: { authenticated: false, allowed: false, reason: 'auth_required' } } });
  });
  const view = render(<BayBayAssistantEntry {...props} ownerId="expired-member" onLoginNeeded={() => {}} />);
  fireEvent.click(view.getByRole('button', { name: '联网查', exact: true }));
  const ask = async () => { fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: '核实明天是否营业' } }); await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); }); };
  await ask();
  assert.ok(view.getByText('保留站内答复 1'));
  assert.ok(view.getByText('登录需更新 · 仅站内'));
  assert.equal(view.queryByRole('button', { name: '联网查', exact: true }), null);
  assert.doesNotMatch(view.baseElement.textContent || '', /本次联网未成功/);
  await ask(); assert.deepEqual(modes, ['web', 'site']);
});

test('explicit guest sign-in carries the draft and plan, cancels pending work and discards late replies', async t => {
  const calls: { body: { message: string; assistantSessionToken?: string; history: unknown[] }; signal: AbortSignal; resolve: (r: Response) => void }[] = [];
  mockBayBayFetch(t, (_url: unknown, init: RequestInit) => new Promise<Response>(resolve => calls.push({ body: JSON.parse(String(init.body)), signal: init.signal as AbortSignal, resolve })));
  let handoff: BayBayConversationDraft | undefined;
  const onLoginNeeded = (draft: BayBayConversationDraft) => { handoff = draft; };
  const view = render(<BayBayAssistantEntry {...props} onLoginNeeded={onLoginNeeded} />);
  const input = () => view.getByRole('textbox', { name: '向 BayBay 提问' }) as HTMLInputElement;
  const ask = (value: string) => { fireEvent.change(input(), { target: { value } }); fireEvent.click(view.getByRole('button', { name: '问一下' })); };
  ask('安排11月7日两大一小去PIER39');
  await act(async () => calls[0].resolve(Response.json({ ok: true, answer: '已保留站内安排', assistantSessionToken: 'guest.context', taskState: { version: 1, revision: 1, date: '2026-11-07', partySize: 3, childAges: [5] }, assistantPlan: { id: 'guest-plan', title: 'PIER39 半日安排', date: '2026-11-07', status: 'needs_verification', stops: [], budget: { unknownItems: ['交通费待核实'] }, checks: [], unknowns: [] } })));
  ask('还在等待的补充问题');
  fireEvent.change(input(), { target: { value: '登录后想补充的草稿' } });
  fireEvent.click(view.getByRole('button', { name: '登录 / 注册，开启联网' }));
  assert.equal(calls[1].signal.aborted, true);
  assert.equal(handoff?.question, '登录后想补充的草稿');
  assert.equal(handoff?.turns[1].state, 'cancelled');
  view.rerender(<BayBayAssistantEntry {...props} ownerId="new-member" sessionKey="new-session" initialConversation={handoff} onLoginNeeded={onLoginNeeded} />);
  assert.equal(input().value, '登录后想补充的草稿');
  assert.ok(view.getByText('已保留站内安排'));
  assert.ok(view.getByText('PIER39 半日安排'));
  await act(async () => calls[1].resolve(Response.json({ ok: true, answer: '迟到旧答复', assistantSessionToken: 'wrong.context' })));
  assert.equal(view.queryByText('迟到旧答复'), null);
  ask('接着核实门票');
  assert.equal(calls[2].body.assistantSessionToken, 'guest.context');
  assert.equal(calls[2].body.history.length, 2);
  await act(async () => calls[2].resolve(Response.json({ ok: true, answer: '会员的继续答复' })));
  view.rerender(<BayBayAssistantEntry {...props} ownerId="different-member" sessionKey="different-session" onLoginNeeded={onLoginNeeded} />);
  assert.equal(view.queryByText('已保留站内安排'), null);
  assert.equal(input().value, '');
});

test('authentication, daily quota, temporary rate limits and unavailable provider have distinct source labels in each language', async () => {
  const cases = [
    { status: 'auth_required', code: undefined, zh: /回答时未登录或登录已失效/, en: /for this reply \(not signed in or sign-in had expired\)/ },
    { status: 'unavailable', code: 'web_daily_limit', zh: /今日联网额度已用完/, en: /Today’s web lookup limit/ },
    { status: 'unavailable', code: 'web_rate_limit', zh: /联网查询暂时过于频繁/, en: /temporarily rate-limited/ },
    { status: 'unavailable', code: 'web_provider_unavailable', zh: /本次联网未成功/, en: /Web lookup unavailable/ },
  ] as const;
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    await setLocale(locale, false);
    for (const item of cases) {
      const raw = { research: { steps: [{ tool: 'search_web', status: 'unavailable', label: 'search_web', code: item.code }], warnings: [] } };
      const response: GuideChatResponse = { ok: true, answer: 'Site information', responseMode: 'assistant', ...parseBayBayAssistantFields(raw), retrieval: { requestedMode: 'web', scope: 'site', webStatus: item.status } };
      const view = render(<BayBayRetrievalLabel response={response} />);
      if (locale !== 'zh-Hant') assert.match(view.baseElement.textContent || '', locale === 'en' ? item.en : item.zh);
      else assert.match(view.baseElement.textContent || '', /站內|聯網/);
      view.unmount();
    }
  }
});
