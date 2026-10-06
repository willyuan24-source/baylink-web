import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { AppContextValue } from '../src/app/context';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/plan' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, act } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { default: PlannerPage } = await import('../src/pages/PlannerPage');
const { BayBayTaskHandoff } = await import('../src/components/BayBayDiscoveryResults');
const { stageBayBayRequirementsDraft, readBayBayRequirementsDraft, stageBayBayPlanDraft, readBayBayPlanDraft } = await import('../src/lib/baybay-plan-handoff');
const { bayBayPlanPath, safeBayBayPath } = await import('../src/lib/baybay-conversation');
const { parseBayBayAssistantFields } = await import('../src/lib/baybay-assistant');
const { api } = await import('../src/lib/api');
const { EMPTY_LIBRARY } = await import('../src/lib/planner');
const { setLocale } = await import('../src/i18n/locale');
const originalRequest = api.request;
const privateMessage = '从 PRIVATE 42 Home Street 出发，带两个孩子，家庭预算 $120，下午需要返家。';
const idFor = (path: string) => new URL(path, 'https://www.baylink.us').searchParams.get('baybayBrief');
const appFor = (owner?: string) => owner ? { user: { id: owner, token: 'test-token' }, showToast: () => {}, setShowLogin: () => {} } as unknown as AppContextValue : undefined;
const questionInput = (view: ReturnType<typeof render>) => view.container.querySelector<HTMLTextAreaElement>('.planner-question textarea')!;
function PlannerView({ path, owner }: { path: string; owner?: string }) {
  return <MemoryRouter initialEntries={[path]}><Routes><Route element={<Outlet context={appFor(owner)} />}><Route path="/plan" element={<PlannerPage />} /></Route></Routes></MemoryRouter>;
}

beforeEach(context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  localStorage.clear();
  api.request = async endpoint => {
    if (endpoint === '/planner/me') return structuredClone(EMPTY_LIBRARY);
    throw new Error(`Unexpected API call: ${endpoint}`);
  };
});
afterEach(async () => { cleanup(); api.request = originalRequest; localStorage.clear(); await setLocale('zh-Hans', false); });

test('BayBay-generated planner links contain only an opaque identifier and never request automatic recommendations', () => {
  const path = bayBayPlanPath(privateMessage, 'owner');
  const url = new URL(path, 'https://www.baylink.us');
  assert.deepEqual([...url.searchParams.keys()], ['baybayBrief']);
  assert.doesNotMatch(decodeURIComponent(path), /PRIVATE|Home|孩子|budget|预算|\$120|owner/u);
  assert.equal(safeBayBayPath(path), true);
  assert.equal(readBayBayRequirementsDraft(idFor(path), 'owner')?.message, privateMessage);
  assert.equal(localStorage.length, 0, 'private requirements never enter browser storage');
  for (const suffix of ['&auto=1', '&q=secret', '&import=event', '&baybayBrief=another']) assert.equal(safeBayBayPath(path + suffix), false);
  assert.equal(safeBayBayPath('/plan?baybayBrief=' + '-'.repeat(36)), false);
  assert.equal(safeBayBayPath('/plan?q=legacy%20request&auto=1'), true, 'existing external q links keep their contract');
  assert.equal(stageBayBayRequirementsDraft('  '), null);
});

test('private requirements are cloned, expire at 30 minutes, and cannot return after another owner reads the link', () => {
  const now = 10_000;
  const path = stageBayBayRequirementsDraft(privateMessage, 'a', now)!;
  const id = idFor(path);
  const draft = readBayBayRequirementsDraft(id, 'a', now)!;
  draft.message = 'mutated';
  assert.equal(readBayBayRequirementsDraft(id, 'a', now)?.message, privateMessage);
  assert.equal(readBayBayRequirementsDraft(id, 'b', now), null);
  assert.equal(readBayBayRequirementsDraft(id, 'a', now), null, 'switching back cannot resurrect a cleared private draft');
  const expiryPath = stageBayBayRequirementsDraft(privateMessage, 'a', now)!;
  assert.ok(readBayBayRequirementsDraft(idFor(expiryPath), 'a', now + 30 * 60 * 1000 - 1));
  assert.equal(readBayBayRequirementsDraft(idFor(expiryPath), 'a', now + 30 * 60 * 1000), null);
  assert.equal(readBayBayRequirementsDraft(idFor(expiryPath), 'a', now), null);
  const futurePath = stageBayBayRequirementsDraft(privateMessage, 'a', now)!;
  assert.equal(readBayBayRequirementsDraft(idFor(futurePath), 'a', now - 1), null);
  const bounded = stageBayBayRequirementsDraft('x'.repeat(900), 'a', now)!;
  assert.equal(readBayBayRequirementsDraft(idFor(bounded), 'a', now)?.message.length, 800);
  assert.equal(stageBayBayRequirementsDraft(privateMessage, 'a', Number.POSITIVE_INFINITY), null);
});

test('structured plans and unstructured briefs share a four-draft memory bound', () => {
  const paths = Array.from({ length: 4 }, (_, index) => stageBayBayRequirementsDraft('Private requirement ' + index, 'capacity', 20_000 + index)!);
  const fields = parseBayBayAssistantFields({ assistantPlan: { id: 'shared-capacity', title: 'Public starting point', date: '2026-10-10', status: 'needs_verification',
    stops: [{ id: 'golden-gate', kind: 'place', entityId: 'golden-gate', title: 'Golden Gate' }], budget: { unknownItems: [] } } });
  assert.ok(fields.assistantPlan);
  const structuredPath = stageBayBayPlanDraft(fields.assistantPlan!, undefined, 'capacity', 20_004)!;
  assert.equal(readBayBayRequirementsDraft(idFor(paths[0]), 'capacity', 20_005), null);
  for (const path of paths.slice(1)) assert.ok(readBayBayRequirementsDraft(idFor(path), 'capacity', 20_005));
  assert.ok(readBayBayPlanDraft(new URL(structuredPath, 'https://www.baylink.us').searchParams.get('baybayDraft'), 'capacity', 20_005));
});

test('handoff edits and planner edits survive language switches; a private handoff recommends only after an explicit click', async () => {
  const paths: string[] = [];
  const handoff = render(<BayBayTaskHandoff brief={privateMessage} onNavigate={path => paths.push(path)} />);
  const handoffInput = handoff.getByRole('textbox') as HTMLTextAreaElement;
  const edited = privateMessage + ' 已补充无车。';
  fireEvent.change(handoffInput, { target: { value: edited } });
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.equal(handoffInput.value, edited);
  await act(async () => { await setLocale('zh-Hans', false); });
  fireEvent.click(handoff.getByRole('button', { name: '带入计划' }));
  assert.equal(paths.length, 1);
  handoff.unmount();
  const requests: { endpoint: string; message?: string }[] = [];
  api.request = async (endpoint, options) => {
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    requests.push({ endpoint, message: body.message });
    return { ok: true, responseMode: 'rules', filters: {}, suggestions: [], notices: [], checkedAt: '2026-10-06' };
  };
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<PlannerView path={paths[0] + '&auto=1&q=injected'} />); });
  assert.equal(questionInput(view).value, edited);
  assert.equal(requests.length, 0, 'opaque handoffs ignore automatic/injected query controls');
  const plannerEdit = edited + ' 规划页再次修改。';
  fireEvent.change(questionInput(view), { target: { value: plannerEdit } });
  await act(async () => { await setLocale('en', false, '/plan'); });
  assert.equal(questionInput(view).value, plannerEdit);
  assert.equal(requests.length, 0);
  await act(async () => { fireEvent.click(view.container.querySelector<HTMLButtonElement>('.planner-primary')!); });
  assert.deepEqual(requests, [{ endpoint: '/planner/recommend', message: plannerEdit }]);
  assert.doesNotMatch(localStorage.getItem('baylink.planner.guest.v1') || '', /PRIVATE|Home Street/u);
});

test('an account switch and an expired private link never populate another account with old requirements', async () => {
  const path = stageBayBayRequirementsDraft(privateMessage, 'a')!;
  localStorage.setItem('currentUser', JSON.stringify(appFor('a')!.user));
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<PlannerView path={path} owner="a" />); });
  assert.equal(questionInput(view).value, privateMessage);
  localStorage.setItem('currentUser', JSON.stringify(appFor('b')!.user));
  await act(async () => { view.rerender(<PlannerView path={path} owner="b" />); });
  assert.equal(questionInput(view).value, '');
  assert.doesNotMatch(view.container.textContent || '', /PRIVATE|Home Street/u);
  assert.equal(readBayBayRequirementsDraft(idFor(path), 'a'), null);
  view.unmount();
  const expired = stageBayBayRequirementsDraft(privateMessage, 'b', Date.now() - 30 * 60 * 1000 - 1)!;
  await act(async () => { view = render(<PlannerView path={expired} owner="b" />); });
  assert.equal(questionInput(view).value, '');
  assert.match(view.container.textContent || '', /需求草稿暂不可读取/u);
});
