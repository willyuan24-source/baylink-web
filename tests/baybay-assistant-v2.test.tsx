import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { BayBayAssistantPlanCard, BayBayRequirements } = await import('../src/components/BayBayAssistantPlan');
const { BayBayAnswer, BayBayDiscoveryResults, BayBayRetrievalLabel } = await import('../src/components/BayBayDiscoveryResults');
const { parseBayBayAssistantFields, safeAssistantSessionToken, bayBayAssistantPlanImport } = await import('../src/lib/baybay-assistant');
const { fetchBayBayReply } = await import('../src/lib/baybay-conversation');
const { parseSharedPlan } = await import('../src/lib/planner');
const { PLANNER_PLACES, PLANNER_EVENTS } = await import('../src/data/planner-catalog');
const { guides } = await import('../src/data/guides');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); localStorage.clear(); await setLocale('zh-Hans', false); });
const noop = () => {};
const props = { variant: 'headless' as const, panelOpen: true, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop };
const fixture = () => ({ ok: true, answer: 'A sourced draft.', assistantSessionToken: 'completed.state-1',
  taskState: { version: 1, revision: 1, city: 'San Jose', region: null, date: '2026-10-05', origin: 'Fremont', travelMode: 'transit', partySize: 3, childAges: [6], budget: 50, budgetScope: 'person', freeOnly: false, setting: 'indoor', startTime: '10:00', finishBy: '17:00', excludedCities: ['Oakland'] },
  evidence: [{ id: 'official', title: 'Museum visitor information', url: 'https://www.sanjoseca.gov/parks', kind: 'place', checkedAt: '2026-10-04' }, { id: 'unsafe', title: 'Unsafe source', url: 'javascript:alert(1)', kind: 'web' }],
  assistantPlan: { id: 'draft-1', title: 'A relaxed day', date: '2026-10-05', status: 'needs_verification', summary: 'Verify booking before visiting.',
    stops: [{ id: 'one', kind: 'place', entityId: PLANNER_PLACES[0].id, title: PLANNER_PLACES[0].title, city: PLANNER_PLACES[0].city, date: '2026-10-05', startTime: '10:00', endTime: '11:30', durationMinutes: 90, timeStatus: 'suggested', admissionUsd: null, sourceIds: ['official', 'unsafe'], sourceUrls: ['https://evil.invalid/forged'], notes: ['Check the reservation.'] },
      { id: 'two', kind: 'web', entityId: 'invented-place', title: 'Public web candidate', city: 'San Jose', date: '2026-10-05', timeStatus: 'unknown', sourceIds: ['unsafe'], notes: [] }],
    budget: { knownTotalUsd: 20, unknownItems: ['Transit and food remain unknown.'], limitUsd: 50, scope: 'person' }, checks: [{ code: 'hours', status: 'unknown', message: 'Opening hours need checking.' }], alternatives: [], unknowns: ['Exact journey time is unknown.'] },
});

test('v2 request keeps opaque token out of page context and sanitizes response fields and evidence', async t => {
  let body: Record<string, unknown> = {};
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => { body = JSON.parse(String(init.body)); return Response.json(fixture()); });
  const response = await fetchBayBayReply('Plan my day', { currentPath: '/calendar?private=ignored', assistantSessionToken: 'a'.repeat(9000) }, [], new AbortController().signal);
  assert.equal(body.assistantVersion, 2);
  assert.equal(String(body.assistantSessionToken).length, 9000);
  assert.deepEqual(body.context, { currentPath: '/calendar' });
  assert.deepEqual(response.evidence?.map(item => item.id), ['official']);
  assert.deepEqual(response.assistantPlan?.stops[0].sourceIds, ['official']);
  assert.equal(response.assistantPlan?.stops[0].admissionUsd, undefined);
  assert.equal(Object.hasOwn(response.assistantPlan!.stops[0], 'sourceUrls'), false);
  for (const token of ['', 'with whitespace', 'token\nvalue', 'a'.repeat(16385), {}, null]) assert.equal(safeAssistantSessionToken(token), undefined);
  const malformed = parseBayBayAssistantFields({ ...fixture(), assistantSessionToken: 'unsafe token', taskState: { version: 2, revision: 1 }, assistantPlan: { ...fixture().assistantPlan, stops: [null] } });
  assert.equal(malformed.assistantPlan, undefined); assert.equal(malformed.taskState, undefined); assert.equal(malformed.assistantSessionToken, undefined);
});

test('a stopped late response never replaces completed token; errors, new conversation, typed reset and account changes isolate state', async t => {
  const bodies: { message: string; assistantSessionToken?: string; history: unknown[] }[] = [];
  let late: ((response: Response) => void) | undefined;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body)); bodies.push(body);
    if (body.message === 'Cancelled change') return new Promise<Response>(resolve => { late = resolve; });
    if (body.message === 'Fail this request') return Response.json({ ok: false, error: '暂时失败' }, { status: 500 });
    return Response.json({ ok: true, answer: `Reply ${bodies.length}`, assistantSessionToken: `completed.${bodies.length}` });
  });
  const view = render(<BayBayAssistantEntry {...props} ownerId="user-one" sessionKey="one" />);
  const ask = async (message: string) => { fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: message } }); await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); }); };
  await ask('Start a useful plan'); assert.equal(bodies[0].assistantSessionToken, undefined);
  await ask('Cancelled change'); assert.equal(bodies[1].assistantSessionToken, 'completed.1');
  fireEvent.click(view.getByRole('button', { name: '停止' }));
  await act(async () => { late!(Response.json({ ok: true, answer: 'Late abandoned plan', assistantSessionToken: 'late.bad' })); });
  await ask('Fail this request'); assert.equal(bodies[2].assistantSessionToken, 'completed.1');
  await ask('Continue with the plan'); assert.equal(bodies[3].assistantSessionToken, 'completed.1');
  assert.equal(view.queryByText('Late abandoned plan'), null);
  assert.equal(localStorage.length, 0);
  fireEvent.click(view.getByRole('button', { name: '新对话' })); await ask('A different question');
  assert.equal(bodies[4].assistantSessionToken, undefined); assert.deepEqual(bodies[4].history, []);
  await ask('重新开始，明天去 Berkeley'); assert.equal(bodies[5].assistantSessionToken, undefined); assert.deepEqual(bodies[5].history, []);
  view.rerender(<BayBayAssistantEntry {...props} ownerId="user-two" sessionKey="two" />);
  await ask('My own new question'); assert.equal(bodies[6].assistantSessionToken, undefined); assert.deepEqual(bodies[6].history, []);
  view.rerender(<BayBayAssistantEntry {...props} sessionKey="guest" />);
  await ask('Guest question'); assert.equal(bodies[7].assistantSessionToken, undefined);
});

test('plan renders safe evidence, schedule and unknown costs; explicit import only carries supported catalog IDs', async () => {
  const parsed = parseBayBayAssistantFields(fixture()), asks: string[] = [], paths: string[] = [];
  const view = render(<BayBayAssistantPlanCard plan={parsed.assistantPlan!} evidence={parsed.evidence!} disabled={false} onAsk={value => asks.push(value)} onNavigate={value => paths.push(value)} />);
  assert.match(view.container.textContent || '', /10:00–11:30/);
  assert.match(view.container.textContent || '', /费用未知/);
  assert.match(view.container.textContent || '', /Transit and food remain unknown/);
  assert.equal(view.getByRole('link', { name: /Museum visitor information/ }).getAttribute('href'), 'https://www.sanjoseca.gov/parks');
  assert.equal(view.queryByRole('link', { name: /Unsafe/ }), null);
  assert.equal(view.container.querySelector('a[href*="evil"]'), null);
  assert.deepEqual(paths, []);
  fireEvent.click(view.getByRole('button', { name: '换掉第2站' })); assert.deepEqual(asks, ['换掉第2站，保留其他条件。']);
  fireEvent.click(view.getByRole('button', { name: '将 1 个地点带入计划页' }));
  const imported = parseSharedPlan(new URL(paths[0], 'https://www.baylink.us').search);
  assert.equal(imported.date, '2026-10-05'); assert.deepEqual(imported.stops, [{ kind: 'place', id: PLANNER_PLACES[0].id }]);
  assert.equal(paths[0].includes('invented'), false);
  assert.equal(bayBayAssistantPlanImport({ ...parsed.assistantPlan!, date: undefined }), null);
  assert.equal(bayBayAssistantPlanImport({ ...parsed.assistantPlan!, stops: [{ ...parsed.assistantPlan!.stops[0], kind: 'event', entityId: PLANNER_EVENTS[0].id, date: '2030-01-01' }], date: '2030-01-01' }), null);
});

test('a completed legacy reply ends the older assistant token chain rather than reviving a different task', async t => {
  const tokens: unknown[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => { tokens.push(JSON.parse(String(init.body)).assistantSessionToken); return Response.json({ ok: true, answer: `Reply ${tokens.length}`, ...(tokens.length === 1 ? { assistantSessionToken: 'old.plan' } : {}) }); });
  const view = render(<BayBayAssistantEntry {...props} />);
  for (const message of ['先安排周末', '再看看学校入学资料', '这个年级需要什么材料']) {
    fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: message } });
    await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); });
  }
  assert.deepEqual(tokens, [undefined, 'old.plan', undefined]);
});

test('expired assistant state starts a reviewed draft without changing the task into an outing search', async t => {
  const bodies: { message: string; assistantSessionToken?: string; history: unknown[] }[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return Response.json(bodies.length === 2 ? { ok: false, code: 'INVALID_ASSISTANT_SESSION', error: '对话条件已过期' } : fixture(), { status: bodies.length === 2 ? 400 : 200 }); });
  const view = render(<BayBayAssistantEntry {...props} />);
  const ask = async (message: string) => { fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: message } }); await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); }); };
  await ask('帮我安排 San Jose 的亲子行程'); await ask('换掉第二站');
  fireEvent.click(view.getByRole('button', { name: '重新开始对话' }));
  assert.equal(bodies.length, 2); assert.equal(view.queryByText('对话条件已过期'), null);
  assert.match((view.getByRole('textbox', { name: '向 BayBay 提问' }) as HTMLInputElement).value, /San Jose/);
  assert.doesNotMatch((view.getByRole('textbox', { name: '向 BayBay 提问' }) as HTMLInputElement).value, /找搭子/);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); });
  assert.equal(bodies[2].assistantSessionToken, undefined); assert.deepEqual(bodies[2].history, []);
});

test('requirements apply natural corrections, and server-cleared city/date do not return through page filters', async t => {
  const bodies: { message: string; searchContext?: unknown; assistantSessionToken?: string }[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return Response.json(bodies.length === 1 ? fixture() : { ok: true, answer: 'Conditions cleared', assistantSessionToken: 'cleared.2', taskState: { version: 1, revision: 2, city: null, region: null, date: null } }); });
  const view = render(<BayBayAssistantEntry {...props} currentPath="/calendar?city=Oakland&date=2026-10-05" pendingQuestion="帮我安排一天" />);
  await view.findByRole('region', { name: '当前安排条件' });
  assert.equal(view.queryByRole('textbox', { name: /安排条件与最新补充/ }), null);
  assert.equal(view.baseElement.querySelector('.baybay-task-handoff'), null);
  fireEvent.click(view.getByRole('button', { name: /目的地 San Jose/ }));
  assert.equal((view.getByRole('textbox', { name: '修改目的地' }) as HTMLInputElement).value, '城市改为 ');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '清除此条件' })); });
  assert.equal(bodies[1].message, '城市不限'); assert.equal(bodies[1].assistantSessionToken, 'completed.state-1');
  fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: '再帮我看看' } });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); });
  assert.equal(bodies[2].searchContext, undefined);
});

test('English and Traditional Chinese requirements and plan controls remain usable', async () => {
  const parsed = parseBayBayAssistantFields(fixture()), asks: string[] = [];
  await setLocale('en', false);
  const view = render(<><BayBayRequirements state={parsed.taskState!} disabled={false} onAsk={value => asks.push(value)} /><BayBayAssistantPlanCard plan={parsed.assistantPlan!} evidence={parsed.evidence!} disabled={false} onAsk={value => asks.push(value)} onNavigate={noop} /></>);
  for (const [label, prefix] of [['People', 'Party size set to '], ['Child ages', 'Child ages set to '], ['Travel', 'Travel mode set to '], ['From', 'From '], ['Finish by', 'Finish by set to '], ['Excluded cities', 'Not in ']]) {
    fireEvent.click(view.getByRole('button', { name: new RegExp(`^${label} `) }));
    assert.equal((view.getByRole('textbox', { name: `Edit ${label.toLowerCase()}` }) as HTMLInputElement).value, prefix);
    fireEvent.click(view.getByRole('button', { name: 'Cancel edit' }));
  }
  fireEvent.click(view.getByRole('button', { name: /Budget/ }));
  assert.equal((view.getByRole('textbox', { name: 'Edit budget' }) as HTMLInputElement).value, 'Per person budget set to $');
  fireEvent.change(view.getByRole('textbox', { name: 'Edit budget' }), { target: { value: 'Per person budget set to $30' } });
  fireEvent.click(view.getByRole('button', { name: 'Apply change' })); assert.equal(asks[0], 'Per person budget set to $30');
  assert.ok(view.getByRole('button', { name: 'Replace stop 2' }));
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.ok(view.getByRole('button', { name: '換掉第2站' }));
  assert.ok(view.getByRole('region', { name: '當前安排條件' }));
});

test('an unknown budget scope is never displayed as a per-person allowance', async () => {
  await setLocale('en', false);
  const parsed = parseBayBayAssistantFields(fixture());
  const view = render(<BayBayRequirements state={{ ...parsed.taskState!, budgetScope: null }} disabled={false} onAsk={noop} />);
  assert.ok(view.getByRole('button', { name: 'Budget $50 scope unconfirmed' }));
  fireEvent.click(view.getByRole('button', { name: 'Budget $50 scope unconfirmed' }));
  assert.equal((view.getByRole('textbox', { name: 'Edit budget' }) as HTMLInputElement).value, 'Budget set to $');
});

test('party totals and per-person limits have separate labels and plan checks start collapsed', async () => {
  await setLocale('en', false);
  const raw = fixture();
  const parsed = parseBayBayAssistantFields({ ...raw, assistantPlan: { ...raw.assistantPlan, budget: { knownTotalUsd: 60, knownPerPersonUsd: 20, limitUsd: 30, scope: 'person', unknownItems: ['Transit is still unpriced.'] } } });
  const view = render(<BayBayAssistantPlanCard plan={parsed.assistantPlan!} evidence={parsed.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  const budget = view.container.querySelector('.baybay-plan-budget')!;
  const paragraphs = Array.from(budget.querySelectorAll('p')).map(item => item.textContent);
  assert.deepEqual(paragraphs, ['Known costs subtotal for the whole group $60', 'Budget limit $30 · per person']);
  assert.doesNotMatch(paragraphs[0] || '', /per person/);
  assert.match(budget.textContent || '', /unknown costs are not counted as zero/);
  const checks = view.container.querySelector('details.baybay-plan-checks') as HTMLDetailsElement;
  assert.equal(checks.open, false); assert.equal(checks.hasAttribute('open'), false);
  assert.match(checks.textContent || '', /Opening hours need checking/);
});

test('degraded v2 guidance describes collected sources without claiming they are all site-only', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...fixture(), responseMode: 'assistant', degraded: true }));
  const view = render(<BayBayAssistantEntry {...props} pendingQuestion="安排一日行程" />);
  await view.findByText('AI 服务暂时不可用，以下是已取得的来源资料与参考安排。请核对各项来源和未确认事项。');
  assert.equal(view.queryByText('AI 服务暂时不可用，以下是站内资料与预设参考指引。站内帖子以实际查询结果为准。'), null);
});

test('matching Google route legs display approximate inbound travel and the actual estimated return time', async () => {
  const raw = fixture(), firstId = raw.assistantPlan.stops[0].entityId;
  const parsed = parseBayBayAssistantFields({ ...raw, assistantPlan: { ...raw.assistantPlan,
    stops: raw.assistantPlan.stops.map((stop, index) => ({ ...stop, travelMinutes: index ? 12 : 5 })), returnTime: '12:35',
    travelLegs: [
      { from: 'origin', to: firstId, durationMinutes: 5, provider: 'google-maps', status: 'estimate' },
      { from: firstId, to: 'invented-place', durationMinutes: 12, provider: 'google-maps', status: 'estimate' },
      { from: 'invented-place', to: 'origin', durationMinutes: 8, provider: 'google-maps', status: 'estimate' },
    ],
  } });
  assert.deepEqual(parsed.assistantPlan!.stops.map(stop => stop.travelMinutes), [5, 12]);
  assert.equal(parsed.assistantPlan!.travelLegs?.length, 3);
  const view = render(<BayBayAssistantPlanCard plan={parsed.assistantPlan!} evidence={parsed.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  assert.ok(view.getByText('前往本站约 5 分钟 · Google Maps 估算'));
  assert.ok(view.getByText('前往本站约 12 分钟 · Google Maps 估算'));
  assert.ok(view.getByText('预计 12:35 返回出发地 · Google Maps 估算，实际路况可能变化。'));
  await act(async () => { await setLocale('en', false); });
  assert.ok(view.getByText('About 5 min to this stop · Google Maps estimate'));
  assert.ok(view.getByText('Estimated return to your starting point at 12:35 · Google Maps estimate; actual travel conditions may change.'));
});

test('unknown, mismatched or malformed travel data never becomes a Google estimate or a confirmed return', () => {
  const raw = fixture(), firstId = raw.assistantPlan.stops[0].entityId;
  const cases = [
    { stops: raw.assistantPlan.stops, returnTime: '12:35', travelLegs: [] },
    { stops: raw.assistantPlan.stops.map(stop => ({ ...stop, travelMinutes: 5 })), returnTime: '12:35', travelLegs: [{ from: 'other-place', to: firstId, durationMinutes: 5, provider: 'google-maps', status: 'estimate' }] },
    { stops: raw.assistantPlan.stops.map(stop => ({ ...stop, travelMinutes: 5 })), returnTime: '12:35', travelLegs: [{ from: 'origin', to: firstId, durationMinutes: 9, provider: 'google-maps', status: 'estimate' }, { from: firstId, to: 'origin', durationMinutes: 5, provider: 'google-maps', status: 'estimate' }] },
    { stops: raw.assistantPlan.stops.map(stop => ({ ...stop, travelMinutes: 900 })), returnTime: '25:01', travelLegs: [{ from: 'origin', to: firstId, durationMinutes: 900, provider: 'google-maps', status: 'estimate' }, { from: 'invented-place', to: 'origin', durationMinutes: -1, provider: 'google-maps', status: 'estimate' }] },
    { stops: raw.assistantPlan.stops.map(stop => ({ ...stop, travelMinutes: 5 })), returnTime: '12:35', travelLegs: [{ from: 'origin', to: firstId, durationMinutes: 5, provider: 'model-guess', status: 'estimate' }, { from: 'invented-place', to: 'origin', durationMinutes: 5, provider: 'google-maps', status: 'unverified' }] },
  ];
  const view = render(<></>);
  for (const routeData of cases) {
    const parsed = parseBayBayAssistantFields({ ...raw, assistantPlan: { ...raw.assistantPlan, ...routeData } });
    view.rerender(<BayBayAssistantPlanCard plan={parsed.assistantPlan!} evidence={parsed.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
    assert.equal(view.getAllByText('前往本站交通时间待核实').length, 2);
    assert.doesNotMatch(view.container.textContent || '', /Google Maps 估算|预计 12:35 返回|25:01/);
  }
  assert.equal(parseBayBayAssistantFields({ ...raw, assistantPlan: { ...raw.assistantPlan, ...cases[3] } }).assistantPlan?.stops[0].travelMinutes, undefined);
});

test('assistant answer ordinals bind only to evidence-backed sources and known local guides, preserving browser modified clicks', () => {
  const guidePath = `/guides/${guides[0].slug}`, paths: string[] = [];
  const raw = { ...fixture(), responseMode: 'assistant', answer: 'Read [1], [2], [3], [4] and [5].',
    sources: [{ title: 'Published guide', url: guidePath }, { title: 'Forged external citation', url: 'https://www.example.org/not-in-evidence' }, { title: 'Official reference', url: 'https://www.sanjoseca.gov/parks' }, { title: 'Private URL', url: 'http://127.0.0.1/' }, { title: 'Invented guide', url: '/guides/not-published' }],
    evidence: [...fixture().evidence, { id: 'guide', kind: 'guide', title: 'Published guide', url: guidePath }, { id: 'private', kind: 'web', title: 'Private URL', url: 'http://127.0.0.1/' }, { id: 'invented', kind: 'guide', title: 'Invented guide', url: '/guides/not-published' }],
  };
  const response = { ...raw, ...parseBayBayAssistantFields(raw), retrieval: { requestedMode: 'smart' as const, scope: 'site+web' as const, webStatus: 'completed' as const } };
  const view = render(<><BayBayRetrievalLabel response={response} /><BayBayAnswer response={response} onNavigate={path => paths.push(path)} /><BayBayDiscoveryResults response={response} onNavigate={path => paths.push(path)} /></>);
  assert.ok(view.getByRole('link', { name: '[1]' })); assert.ok(view.getByRole('link', { name: '[3]' }));
  assert.equal(view.queryByRole('link', { name: '[2]' }), null); assert.equal(view.queryByRole('link', { name: '[4]' }), null); assert.equal(view.queryByRole('link', { name: '[5]' }), null);
  let modifiedWasPrevented = true;
  // JSDOM has no navigation implementation: observe browser ownership, then suppress only its navigation stub.
  document.addEventListener('click', event => { modifiedWasPrevented = event.defaultPrevented; event.preventDefault(); }, { once: true });
  fireEvent.click(view.getByRole('link', { name: '[1]' }), { ctrlKey: true }); assert.deepEqual(paths, []); assert.equal(modifiedWasPrevented, false);
  fireEvent.click(view.getByRole('link', { name: '[1]' })); assert.deepEqual(paths, [guidePath]);
  assert.equal(view.getByRole('link', { name: '[3]' }).getAttribute('target'), '_blank');
  const region = view.getByRole('region', { name: '本次回答来源' });
  assert.deepEqual(Array.from(region.querySelectorAll('li')).map(item => item.getAttribute('value')), ['1', '3']);
  assert.match(view.container.textContent || '', /包含联网公开资料/);
  assert.equal(view.queryByRole('button', { name: '存入候选' }), null);
});
