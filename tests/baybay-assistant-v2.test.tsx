import { mockBayBayFetch } from './baybay-test-transport';
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
const { BayBayAnswer, BayBayCoverageSummary, BayBayDiscoveryResults, BayBayRetrievalLabel } = await import('../src/components/BayBayDiscoveryResults');
const { parseBayBayAssistantFields, safeAssistantSessionToken, bayBayAssistantPlanImport } = await import('../src/lib/baybay-assistant');
const { fetchBayBayReply, bayBayFollowups } = await import('../src/lib/baybay-conversation');
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
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => { body = JSON.parse(String(init.body)); return Response.json(fixture()); });
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

test('contextual followups are validated, displayed and submitted with the completed conversation', async t => {
  const bodies: { message: string; assistantSessionToken?: string }[] = [];
  const suggestion = '保持8人同行，帮我整理 Muir Woods 停车预约步骤';
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return Response.json({ ok: true, answer: '八人的费用超过当前预算；停车名额尚未确认。', assistantSessionToken: 'complete.followup',
      followups: [null, suggestion, suggestion, 'x'.repeat(161), 'bad\ncontrol', 42] });
  });
  const view = render(<BayBayAssistantEntry {...props} />);
  fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: 'Muir Woods 年票可以免费停车吗？' } });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); });
  assert.equal(view.getAllByRole('button', { name: suggestion }).length, 1);
  assert.equal(view.queryByRole('button', { name: '哪些不需要消费？哪些需要会员或 App？' }), null);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: suggestion })); });
  assert.equal(bodies[1].message, suggestion); assert.equal(bodies[1].assistantSessionToken, 'complete.followup');
});

test('malformed followup fields cannot escape the response boundary and break fallback prompts', async t => {
  for (const followups of [null, 'invalid suggestion list', { text: 'not an array' }]) {
    mockBayBayFetch(t, async () => Response.json({ ok: true, answer: 'A valid answer.', followups }));
    const response = await fetchBayBayReply('A public question', { currentPath: '/' }, [], new AbortController().signal);
    assert.equal(response.followups, undefined);
  }
});

test('a stopped late response never replaces completed token; errors, new conversation, typed reset and account changes isolate state', async t => {
  const bodies: { message: string; assistantSessionToken?: string; history: unknown[] }[] = [];
  let late: ((response: Response) => void) | undefined;
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => {
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
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => { tokens.push(JSON.parse(String(init.body)).assistantSessionToken); return Response.json({ ok: true, answer: `Reply ${tokens.length}`, ...(tokens.length === 1 ? { assistantSessionToken: 'old.plan' } : {}) }); });
  const view = render(<BayBayAssistantEntry {...props} />);
  for (const message of ['先安排周末', '再看看学校入学资料', '这个年级需要什么材料']) {
    fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: message } });
    await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); });
  }
  assert.deepEqual(tokens, [undefined, 'old.plan', undefined]);
});

test('expired assistant state starts a reviewed draft without changing the task into an outing search', async t => {
  const bodies: { message: string; assistantSessionToken?: string; history: unknown[] }[] = [];
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return Response.json(bodies.length === 2 ? { ok: false, code: 'INVALID_ASSISTANT_SESSION', error: '对话条件已过期' } : fixture(), { status: bodies.length === 2 ? 400 : 200 }); });
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
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return Response.json(bodies.length === 1 ? fixture() : { ok: true, answer: 'Conditions cleared', assistantSessionToken: 'cleared.2', taskState: { version: 1, revision: 2, city: null, region: null, date: null } }); });
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

test('party totals and per-person limits have separate labels and critical unknowns are visible before stops', async () => {
  await setLocale('en', false);
  const raw = fixture();
  const parsed = parseBayBayAssistantFields({ ...raw, assistantPlan: { ...raw.assistantPlan, budget: { knownTotalUsd: 60, knownPerPersonUsd: 20, limitUsd: 30, scope: 'person', unknownItems: ['Transit is still unpriced.'] } } });
  const view = render(<BayBayAssistantPlanCard plan={parsed.assistantPlan!} evidence={parsed.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  const budget = view.container.querySelector('.baybay-plan-budget')!;
  const paragraphs = Array.from(budget.querySelectorAll('p')).map(item => item.textContent);
  assert.deepEqual(paragraphs, ['Known costs subtotal for the whole group $60', 'Budget limit $30 · per person']);
  assert.doesNotMatch(paragraphs[0] || '', /per person/);
  assert.match(budget.textContent || '', /unknown costs are not counted as zero/);
  assert.match(budget.textContent || '', /Opening hours need checking/);
  assert.equal(budget.closest('details'), null);
  assert.ok(budget.compareDocumentPosition(view.container.querySelector('.baybay-plan-stops')!) & Node.DOCUMENT_POSITION_FOLLOWING);
});

test('degraded v2 guidance describes collected sources without claiming they are all site-only', async t => {
  mockBayBayFetch(t, async () => Response.json({ ...fixture(), responseMode: 'assistant', degraded: true }));
  const view = render(<BayBayAssistantEntry {...props} pendingQuestion="安排一日行程" />);
  await view.findByText('本次未能形成完整答复，以下保留已取得的资料与待确认项。请核对来源后再行动。');
  assert.doesNotMatch(view.container.textContent || '', /AI 服务暂时不可用/);
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
  assert.match(view.container.textContent || '', /已检索站内与站外/);
  assert.match(view.container.textContent || '', /实际引用：取得方式未记录 2 条/);
  assert.equal(view.queryByRole('button', { name: '存入候选' }), null);
});

test('return and stop-limit chips send explicit changes and clear commands in both languages', async () => {
  for (const locale of ['zh-Hans', 'en'] as const) {
    await setLocale(locale, false);
    const en = locale === 'en', asks: string[] = [];
    const fields = parseBayBayAssistantFields({ taskState: { ...fixture().taskState, returnToOrigin: false, maxStops: 2 } });
    const view = render(<BayBayRequirements state={fields.taskState!} disabled={false} onAsk={message => asks.push(message)} />);
    const openReturn = () => fireEvent.click(view.getByRole('button', { name: en ? 'Return No return' : '返程 不回起点' }));
    openReturn();
    fireEvent.click(view.getByRole('button', { name: en ? 'Return to origin' : '回到起点', exact: true }));
    openReturn();
    fireEvent.click(view.getByRole('button', { name: en ? 'No return' : '不回起点', exact: true }));
    openReturn();
    fireEvent.click(view.getByRole('button', { name: en ? 'Clear this requirement' : '清除此条件' }));
    const openStops = () => fireEvent.click(view.getByRole('button', { name: en ? 'Stop limit 2 stops' : '最多站数 2 站' }));
    openStops();
    const input = view.getByRole('textbox', { name: en ? 'Edit stop limit (1–6)' : '修改最多站数（1–6）' });
    fireEvent.change(input, { target: { value: '7' } });
    assert.equal(view.getByRole('button', { name: en ? 'Apply change' : '应用修改' }).hasAttribute('disabled'), true);
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    openStops();
    fireEvent.click(view.getByRole('button', { name: en ? 'Clear this requirement' : '清除此条件' }));
    assert.deepEqual(asks, en ? ['Return to the origin', 'Do not return to the origin', 'Clear return requirement', 'At most 3 stops', 'Clear stop limit'] : ['返回出发地', '不返回起点', '清除返回要求', '最多 3 站', '清除站数限制']);
    view.rerender(<BayBayRequirements state={{ ...fields.taskState!, returnToOrigin: undefined, maxStops: undefined }} disabled={false} onAsk={message => asks.push(message)} />);
    assert.equal(view.queryByRole('button', { name: /^(?:Return |返程 |Stop limit |最多站数 )/ }), null);
    view.unmount();
  }
});

const priceFacts = () => ({ status: 'partial', basis: 'catalog-snapshot', knownTotalUsd: 109.85,
  breakdown: [{ category: 'adult', quantity: 2, unitUsd: 39.95, subtotalUsd: 79.90 }, { category: 'child', quantity: 1, age: 5, unitUsd: 29.95, subtotalUsd: 29.95 }],
  sourceIds: ['official'], checkedAt: '2026-10-05T03:00:00Z', applicability: { date: '2026-10-05', dateStatus: 'regular-unconfirmed', feesIncluded: null }, unknowns: ['Date-specific admission and fees remain unconfirmed.'] });

test('coverage and monetary facts reject fabricated references and arithmetic; diagnosis is bounded and private fields are stripped', () => {
  const raw = fixture();
  const parsed = parseBayBayAssistantFields({ ...raw, answerCoverage: { status: 'complete', items: [{ id: 'printing', label: 'Printing', status: 'answered', summary: '10-page allowance', sourceIds: ['official', 'unsafe'] }, { id: 'eligible', label: 'Eligibility', status: 'unknown', sourceIds: ['forged'] }] }, research: { timings: { totalMs: 12000, stateMs: 9, modelMs: -1, readMs: 0.5, secret: 'ignored', routeMs: 600001 } }, assistantPlan: { ...raw.assistantPlan, stops: [{ ...raw.assistantPlan.stops[0], admissionFacts: priceFacts() }] } });
  assert.equal(parsed.answerCoverage?.status, 'partial'); assert.deepEqual(parsed.answerCoverage?.items.map(item => item.sourceIds), [['official'], []]);
  assert.deepEqual(parsed.research?.timings, { stateMs: 9, totalMs: 12000 });
  assert.equal(parsed.assistantPlan?.stops[0].admissionFacts?.knownTotalUsd, 109.85);
  for (const facts of [{ ...priceFacts(), sourceIds: ['forged'] }, { ...priceFacts(), knownTotalUsd: 1 }, { ...priceFacts(), breakdown: [{ category: 'adult', quantity: 2, unitUsd: 39.95, subtotalUsd: 39.95 }] }]) {
    assert.equal(parseBayBayAssistantFields({ ...raw, assistantPlan: { ...raw.assistantPlan, stops: [{ ...raw.assistantPlan.stops[0], admissionFacts: facts }] } }).assistantPlan?.stops[0].admissionFacts, undefined);
  }
  assert.equal(parseBayBayAssistantFields({ answerCoverage: { status: 'complete', items: [] } }).answerCoverage?.status, 'unassessed');
});

test('coverage is a response checklist, never an official verification claim, and missing coverage stays unobtrusive', async () => {
  await setLocale('en', false);
  const fields = parseBayBayAssistantFields({ ...fixture(), answerCoverage: { status: 'partial', items: [{ id: 'one', label: 'Printing', status: 'answered', sourceIds: ['official'] }, { id: 'two', label: 'Eligibility', status: 'unknown', summary: 'Confirm the library card.', sourceIds: [] }, { id: 'three', label: 'Pages', status: 'needs_user_input', sourceIds: [] }] } });
  const view = render(<BayBayCoverageSummary response={{ ok: true, ...fields }} />);
  assert.match(view.container.textContent || '', /Response overview · 3 topics · 1 unconfirmed · 1 need your input/);
  assert.match(view.container.textContent || '', /not verification of every fact/);
  assert.equal(view.getAllByRole('link', { hidden: true }).length, 1);
  view.rerender(<BayBayCoverageSummary response={{ ok: true }} />); assert.equal(view.container.textContent, '');
});

test('a substantive four-topic reply with uncertainties is summarized as an overview, not zero answered topics', async () => {
  const fields = parseBayBayAssistantFields({ answerCoverage: { status: 'partial', items: ['hours', 'admission', 'budget', 'travel'].map(id => ({ id, label: id, status: 'unknown', summary: 'The current source explains the rule; date-specific conditions remain unconfirmed.', sourceIds: [] })) } });
  for (const locale of ['zh-Hans', 'en', 'zh-Hant'] as const) {
    await setLocale(locale, false);
    const view = render(<BayBayCoverageSummary response={{ ok: true, ...fields }} />);
    const summary = view.container.querySelector('summary')!.textContent || '';
    if (locale === 'en') assert.equal(summary, 'Response overview · 4 topics · 4 unconfirmed');
    else assert.match(summary, /答[复復覆]概[览覽] · 4 [项項] · 4 [项項]待[确確][认認]/);
    assert.doesNotMatch(summary, /已回应 0|0 addressed/);
    assert.equal(view.container.querySelectorAll('li[data-status="unknown"]').length, 4);
    view.unmount();
  }
});

test('only a matching admission source uses the newer price-fact date and basis, without updating other venue evidence', async () => {
  await setLocale('en', false);
  const raw = fixture();
  const fields = parseBayBayAssistantFields({ ...raw, evidence: [
    { id: 'pier', title: 'PIER FAQ', kind: 'place', url: 'https://www.pier39.com/frequently-asked-questions', checkedAt: '2026-10-02', verification: 'catalog' },
    { id: 'hours', title: 'Other venue hours', kind: 'web', url: 'https://www.pier39.com/hours/', checkedAt: '2026-10-02', verification: 'page-read' },
    { id: 'same-page', title: 'Other facts on the same page', kind: 'web', url: 'https://www.pier39.com/frequently-asked-questions/', checkedAt: '2026-10-02', verification: 'catalog' },
  ], assistantPlan: { ...raw.assistantPlan, stops: [{ ...raw.assistantPlan.stops[0], title: 'PIER 39 public area', sourceIds: ['pier', 'hours', 'same-page'], admissionFacts: {
    status: 'complete', basis: 'catalog-snapshot', knownTotalUsd: 0, sourceUrl: 'https://www.pier39.com/frequently-asked-questions/', checkedAt: '2026-10-04', sourceIds: ['pier', 'hours'],
    breakdown: [{ category: 'group', quantity: 1, unitUsd: 0, subtotalUsd: 0 }], applicability: { date: '2026-10-10', dateStatus: 'regular-unconfirmed', feesIncluded: true }, unknowns: [],
  } }] } });
  const view = render(<BayBayAssistantPlanCard plan={fields.assistantPlan!} evidence={fields.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  assert.match(view.getByRole('link', { name: /^PIER FAQ/ }).textContent || '', /Admission evidence: Catalog snapshot · 2026-10-04/);
  assert.match(view.getByRole('link', { name: /^Other venue hours/ }).textContent || '', /Page read · 2026-10-02/);
  assert.match(view.getByRole('link', { name: /^Other facts on the same page/ }).textContent || '', /Catalog snapshot · 2026-10-02/);
  assert.ok(fields.evidence!.every(source => source.checkedAt === '2026-10-02'));
  const plan = fields.assistantPlan!;
  view.rerender(<BayBayAssistantPlanCard plan={{ ...plan, stops: [{ ...plan.stops[0], admissionFacts: { ...plan.stops[0].admissionFacts!, basis: 'page-read', checkedAt: '2026-10-05T03:00:00Z' } }] }} evidence={fields.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  assert.match(view.getByRole('link', { name: /^PIER FAQ/ }).textContent || '', /Admission evidence: Page read · 2026-10-04 \(Bay Area date\)/);
  assert.match(view.getByRole('link', { name: /^Other venue hours/ }).textContent || '', /Page read · 2026-10-02/);
});

test('coverage keeps trailing eligibility conditions beyond 600 characters and truncates only complete sentences within 1600', () => {
  const summary = '本段说明各机构的资源，请分别核对适用条件。'.repeat(30) + '只有年满15岁、持正式实体卡且住在服务区者才能预约；eCard不适用，办到图书证不等于具备馆票资格。';
  assert.ok(summary.length > 600 && summary.length < 1600);
  const decode = (value: string) => parseBayBayAssistantFields({ ...fixture(), answerCoverage: { status: 'partial', items: Array.from({ length: 9 }, (_, i) => ({ id: `topic-${i}`, label: 'Eligibility', status: 'unknown', summary: value, sourceIds: ['official', 'official', 'official', 'official', 'official'] })) } }).answerCoverage!;
  const parsed = decode(summary);
  assert.equal(parsed.items[0].summary, summary);
  assert.match(parsed.items[0].summary!, /eCard不适用，办到图书证不等于具备馆票资格。$/);
  assert.equal(parsed.items.length, 8); assert.equal(parsed.items[0].sourceIds.length, 4);
  const fullSentence = 'Eligible cardholders must also meet the separate residency requirement.';
  const overlong = `${fullSentence} ${'x'.repeat(1700)}`;
  assert.equal(decode(overlong).items[0].summary, `${fullSentence}…`);
  assert.equal(decode('若申请人'.repeat(600)).items[0].summary, undefined);
  assert.ok((decode(`${'This is a complete sentence. '.repeat(80)}`).items[0].summary?.length || 0) <= 1600);
  const decimalAtLimit = `${'x'.repeat(1596)}39.95 USD ${'x'.repeat(100)}`;
  assert.equal(decode(decimalAtLimit).items[0].summary, undefined);
});

test('source-backed family subtotal and budget shortage lead the card; repeated unknowns appear only once', async () => {
  await setLocale('en', false);
  const raw = fixture(), unknown = priceFacts().unknowns[0];
  const parsed = parseBayBayAssistantFields({ ...raw, assistantPlan: { ...raw.assistantPlan, budget: { knownTotalUsd: 109.85, limitUsd: 100, scope: 'total', unknownItems: [unknown] }, checks: [{ code: 'cost', status: 'unknown', message: unknown }], unknowns: [unknown], stops: [{ ...raw.assistantPlan.stops[0], admissionFacts: priceFacts(), notes: [unknown] }] } });
  const view = render(<BayBayAssistantPlanCard plan={parsed.assistantPlan!} taskState={parsed.taskState} evidence={parsed.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  assert.match(view.getByRole('status').textContent || '', /exceed the group budget by \$9.85/);
  assert.equal(view.getAllByText(unknown).length, 1);
  assert.match(view.container.textContent || '', /Adult 2 × \$39.95 = \$79.90/);
  assert.match(view.container.textContent || '', /Child age 5 1 × \$29.95 = \$29.95/);
  assert.match(view.container.textContent || '', /Catalog snapshot price · 2026-10-04/);
  assert.match(view.container.textContent || '', /Eligibility on your chosen date is unconfirmed/);
  const budget = view.container.querySelector('.baybay-plan-budget')!;
  assert.ok(budget.compareDocumentPosition(view.container.querySelector('.baybay-plan-stops')!) & Node.DOCUMENT_POSITION_FOLLOWING);
  view.rerender(<BayBayAssistantPlanCard plan={{ ...parsed.assistantPlan!, budget: { ...parsed.assistantPlan!.budget, knownTotalUsd: 0 } }} evidence={parsed.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  assert.match(view.container.textContent || '', /Cost not yet calculated/);
});

test('printing and service followups stay relevant in English and Traditional Chinese while useful server suggestions survive', async () => {
  await setLocale('en', false);
  assert.match(bayBayFollowups('12 pages of printing, and photocopies?', false, false, ['Which offers need a membership App?'])[0], /printing costs/);
  assert.doesNotMatch(bayBayFollowups('Find a plumber to repair a leak', false, false, ['Plan an outing'])[0], /outing|itinerary/i);
  await setLocale('zh-Hant', false);
  assert.match(bayBayFollowups('免費列印和復印', false, false, ['哪些需要會員 App？']).join(' '), /打印|列印/);
  assert.doesNotMatch(bayBayFollowups('黑白打印', false, false, ['哪些需要会员 App？']).join(' '), /App/);
  assert.deepEqual(bayBayFollowups('printing charges?', false, false, ['Confirm the daily printing allowance']), ['Confirm the daily printing allowance']);
});

test('stream results pass the same response boundary and errors, and progress does not invent a reply', async t => {
  const updates: unknown[] = [];
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => {
    assert.equal(JSON.parse(String(init.body)).stream, true);
    return new Response(`event: progress\ndata: {"phase":"sources","status":"completed"}\n\nevent: result\ndata: ${JSON.stringify({ ...fixture(), answerCoverage: 'unsafe' })}\n\n`, { headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
  });
  const reply = await fetchBayBayReply('Read the sources', { currentPath: '/' }, [], new AbortController().signal, 1000, item => updates.push(item));
  assert.deepEqual(updates, [{ phase: 'sources', status: 'completed' }]); assert.equal(reply.answerCoverage, undefined); assert.equal(reply.evidence?.length, 1);
  mockBayBayFetch(t, async () => new Response('event: error\ndata: {"ok":false,"code":"INVALID_ASSISTANT_SESSION","error":"Start again"}\n\n', { headers: { 'content-type': 'text/event-stream' } }));
  await assert.rejects(fetchBayBayReply('Read sources', { currentPath: '/' }, [], new AbortController().signal), { name: 'Error', message: 'Start again' });
});

test('pending UI uses actual progress events without implying web access or a successful completed check', async t => {
  let channel!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  mockBayBayFetch(t, async () => new Response(new ReadableStream({ start(controller) { channel = controller; } }), { headers: { 'content-type': 'text/event-stream' } }));
  const view = render(<BayBayAssistantEntry {...props} pendingQuestion="只用站内资料核对打印额度" />);
  await act(async () => {});
  const progressStatus = (message: RegExp) => {
    const statuses = view.getAllByRole('status').filter(status => message.test(status.textContent || ''));
    assert.equal(statuses.length, 1, 'the actual request progress must have one status announcement');
    return statuses[0].textContent || '';
  };
  assert.match(progressStatus(/正在等待答复/), /正在等待答复/);
  await act(async () => { channel.enqueue(encoder.encode('event: progress\ndata: {"phase":"research","status":"running"}\n\n')); });
  assert.match(progressStatus(/问题分析与检索处理中/), /问题分析与检索处理中/);
  assert.doesNotMatch(progressStatus(/问题分析与检索处理中/), /联网|已核实/);
  await act(async () => { channel.enqueue(encoder.encode('event: progress\ndata: {"phase":"research","status":"completed"}\n\n')); });
  assert.match(progressStatus(/阶段结束，正在等待结果/), /阶段结束，正在等待结果/);
  await act(async () => { channel.enqueue(encoder.encode('event: result\ndata: {"ok":true,"answer":"完整打印答复"}\n\n')); });
  assert.ok(view.getByText('完整打印答复')); assert.equal(view.queryByText(/阶段结束，正在等待结果/), null);
});

test('evidence retains valid timestamp offsets and rejects impossible dates, clocks and unknown verification claims', () => {
  const valid = ['2026-10-04', '2026-10-05T03:00:00Z', '2026-10-05T12:00:00+09:00', '2026-01-05T07:30:00.123Z', '2024-02-29T23:59:59-08:00'];
  const invalid: unknown[] = ['2026-02-29', '2026-02-30T03:00:00Z', '2026-13-01T00:00:00Z', '2026-10-05T24:00:00Z', '2026-10-05T03:60:00Z', '2026-10-05T03:00:60Z', '2026-10-05T03:00:00+24:00', '2026-10-05T03:00:00', '2026-10-05T03Z', 'yesterday', 1, {}, null];
  for (const checkedAt of [...valid, ...invalid]) {
    const parsed = parseBayBayAssistantFields({ evidence: [{ ...fixture().evidence[0], checkedAt, verification: 'page-read' }] });
    assert.equal(parsed.evidence?.[0].checkedAt, valid.includes(checkedAt as string) ? checkedAt : undefined, String(checkedAt));
    assert.equal(parsed.evidence?.[0].verification, 'page-read');
  }
  const forged = parseBayBayAssistantFields({ evidence: [{ ...fixture().evidence[0], verification: 'guaranteed-live' }] });
  assert.equal(forged.evidence?.[0].verification, undefined);
});

test('source methods remain distinct and ISO dates display in Bay Area time across midnight and daylight saving seasons', async () => {
  const rows = [
    { id: 'read', title: 'Read page', url: 'https://www.example.org/page', kind: 'web', verification: 'page-read', checkedAt: '2026-10-05T03:00:00Z' },
    { id: 'api', title: 'API data', url: 'https://www.example.org/api', kind: 'web', verification: 'api', checkedAt: '2026-10-05T12:00:00+09:00' },
    { id: 'snapshot', title: 'Snapshot', url: `/guides/${guides[0].slug}`, kind: 'guide', verification: 'catalog', checkedAt: '2026-10-05' },
    { id: 'lead', title: 'Search lead', url: 'https://www.example.org/lead', kind: 'web', verification: 'search-result', checkedAt: '2026-01-05T07:30:00Z' },
  ];
  const parsed = parseBayBayAssistantFields({ evidence: rows });
  const response = { ok: true, responseMode: 'assistant', answer: 'Sources [1] [2] [3] [4].', sources: rows.map(({ title, url }) => ({ title, url })), ...parsed };
  const view = render(<BayBayDiscoveryResults response={response} />);
  assert.match(view.container.textContent || '', /网页读取 · 2026-10-04（湾区日期）/);
  assert.match(view.container.textContent || '', /接口获取 · 2026-10-04（湾区日期）/);
  assert.match(view.container.textContent || '', /资料快照 · 2026-10-05/);
  assert.match(view.container.textContent || '', /搜索线索（未读正文） · 2026-01-04（湾区日期）/);
  assert.doesNotMatch(view.container.textContent || '', /核对|实时|2026-10-05T/);
  await act(async () => { await setLocale('en', false); });
  for (const text of ['Page read · 2026-10-04 (Bay Area date)', 'API retrieved · 2026-10-04 (Bay Area date)', 'Catalog snapshot · 2026-10-05', 'Search lead (page not read) · 2026-01-04 (Bay Area date)']) assert.ok(view.container.textContent?.includes(text));
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.match(view.container.textContent || '', /網頁讀取 · 2026-10-04（灣區日期）/);
  const plan = parseBayBayAssistantFields(fixture()).assistantPlan!;
  view.rerender(<BayBayAssistantPlanCard plan={{ ...plan, stops: [{ ...plan.stops[0], sourceIds: ['read'] }] }} evidence={parsed.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  assert.match(view.container.textContent || '', /網頁讀取 · 2026-10-04（灣區日期）/);
});

test('free admission does not invent a zero whole-trip budget and child ages retain their units', async () => {
  const state = { version: 1 as const, revision: 1, childAges: [5], freeOnly: true, budget: 0, budgetScope: null };
  const view = render(<BayBayRequirements state={state} disabled={false} onAsk={noop} />);
  assert.ok(view.getByRole('button', { name: '孩子年龄 5 岁' }));
  assert.ok(view.getByRole('button', { name: '门票 只看免费' }));
  assert.equal(view.queryByRole('button', { name: /预算/ }), null);
  await act(async () => { await setLocale('en', false); });
  assert.ok(view.getByRole('button', { name: 'Child ages 5 years' }));
  assert.ok(view.getByRole('button', { name: 'Admission Free only' }));
  assert.equal(view.queryByRole('button', { name: /Budget/ }), null);
  view.rerender(<BayBayRequirements state={{ ...state, budgetScope: 'total' }} disabled={false} onAsk={noop} />);
  assert.ok(view.getByRole('button', { name: 'Budget $0 total' }), 'An explicit zero-dollar total is still a real user constraint');
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.ok(view.getByRole('button', { name: '孩子年齡 5 歲' }));
});

test('a completed web search with only site citations does not claim the answer cites web sources', async () => {
  const guidePath = `/guides/${guides[0].slug}`;
  const response = { ok: true, responseMode: 'assistant', answer: 'According to the guide [1].',
    sources: [{ title: 'Published guide', url: guidePath }],
    evidence: [{ id: 'guide', kind: 'guide' as const, title: 'Published guide', url: guidePath, verification: 'catalog' as const }],
    retrieval: { requestedMode: 'smart' as const, scope: 'site+web' as const, webStatus: 'completed' as const },
  };
  const view = render(<BayBayRetrievalLabel response={response} />);
  assert.match(view.container.textContent || '', /已检索站内与站外 · 实际引用：站内快照 1 条/);
  assert.doesNotMatch(view.container.textContent || '', /包含联网公开资料/);
  await act(async () => { await setLocale('en', false); });
  assert.match(view.container.textContent || '', /Searched site and web · Cited evidence: Site snapshots: 1/);
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.match(view.container.textContent || '', /實際引用：站內快照 1 條/);
});


test('official URLs in site snapshots are not presented as new web reads, including failed web fallbacks', async () => {
  const rows = [
    { id: 'catalog', title: 'Official district entry', url: 'https://www.fremont.k12.ca.us/enrollment', kind: 'web', verification: 'catalog' },
    { id: 'read', title: 'Read page', url: 'https://www.example.org/current', kind: 'web', verification: 'page-read' },
    { id: 'lead', title: 'Unread result', url: 'https://www.example.org/search-lead', kind: 'web', verification: 'search-result' },
    { id: 'api', title: 'API reference', url: 'https://www.example.org/api', kind: 'web', verification: 'api' },
    { id: 'unknown', title: 'Legacy source', url: 'https://www.example.org/legacy', kind: 'web' },
  ];
  const snapshot = { ok: true, responseMode: 'assistant', answer: 'Refer to this stored official entry [1].', sources: rows.slice(0, 1),
    ...parseBayBayAssistantFields({ evidence: rows.slice(0, 1) }), retrieval: { requestedMode: 'site' as const, scope: 'site' as const, webStatus: 'not_requested' as const } };
  const view = render(<BayBayRetrievalLabel response={snapshot} />);
  assert.match(view.container.textContent || '', /已检索站内资料 · 实际引用：站内快照 1 条/);
  assert.doesNotMatch(view.container.textContent || '', /本次网页读取|站外来源|已核验/);
  view.rerender(<BayBayRetrievalLabel response={{ ...snapshot, retrieval: { requestedMode: 'web', scope: 'site', webStatus: 'unavailable' } }} />);
  assert.match(view.container.textContent || '', /站内快照 1 条.*本次联网未成功/);
  assert.doesNotMatch(view.container.textContent || '', /本次网页读取/);
  const mixed = { ...snapshot, sources: rows, ...parseBayBayAssistantFields({ evidence: rows }), retrieval: { requestedMode: 'smart' as const, scope: 'site+web' as const, webStatus: 'completed' as const } };
  view.rerender(<BayBayRetrievalLabel response={mixed} />);
  for (const text of ['站内快照 1 条', '本次网页读取 1 条', '接口获取 1 条', '搜索线索（未读正文） 1 条', '取得方式未记录 1 条']) assert.ok(view.container.textContent?.includes(text));
  await act(async () => { await setLocale('en', false); });
  for (const text of ['Site snapshots: 1', 'Pages read this turn: 1', 'API retrievals: 1', 'Search leads (page not read): 1', 'Retrieval method not recorded: 1']) assert.ok(view.container.textContent?.includes(text));
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.match(view.container.textContent || '', /站內快照 1 條.*本次網頁讀取 1 條/);
});

test('answer links work without citations while unsafe markup stays inert and citation ordinals stay evidence-bound', () => {
  const url = 'https://www.example.org/enrollment?year=2026&grade=3';
  const raw = { ok: true, responseMode: 'assistant',
    answer: `Open ${url}。Then [district portal](https://www.example.org/entry_(school)) and https://www.example.org/faq[2].\n` +
      'Known [2], missing [9]. [run](javascript:alert(1)) [data](data:text/html,bad) [private](http://127.0.0.1/admin) ' +
      '[credentials](https://name:secret@example.org/) ![image](https://www.example.org/pixel.png) ' +
      '<img src=x onerror=alert(1)> `https://www.example.org/code`',
    sources: [{ title: 'Blocked ordinal', url: 'javascript:alert(1)' }, { title: 'Official source', url: 'https://www.example.org/source' }],
    ...parseBayBayAssistantFields({ evidence: [{ id: 'source', title: 'Official source', kind: 'web', url: 'https://www.example.org/source', verification: 'page-read' }] }),
  };
  const view = render(<BayBayAnswer response={raw} />);
  assert.equal(view.getByRole('link', { name: url }).getAttribute('href'), url);
  assert.equal(view.getByRole('link', { name: 'district portal' }).getAttribute('href'), 'https://www.example.org/entry_(school)');
  assert.equal(view.getByRole('link', { name: 'https://www.example.org/faq' }).getAttribute('href'), 'https://www.example.org/faq');
  assert.equal(view.getAllByRole('link', { name: '[2]' }).length, 2);
  assert.equal(view.queryByRole('link', { name: '[9]' }), null);
  for (const link of view.getAllByRole('link')) { assert.equal(link.getAttribute('target'), '_blank'); assert.equal(link.getAttribute('rel'), 'noopener noreferrer'); }
  for (const name of ['run', 'data', 'private', 'credentials', 'image', 'https://www.example.org/code']) assert.equal(view.queryByRole('link', { name }), null);
  assert.equal(view.container.querySelector('img,script,iframe'), null);
  assert.ok(view.container.textContent?.includes('<img src=x onerror=alert(1)>'));
  view.rerender(<BayBayAnswer response={{ ok: true, answer: '咨询入口：[学校官网](https://www.example.org/enroll)。\nEnglish: Please see https://www.example.org/contact.' }} />);
  assert.equal(view.getByRole('link', { name: '学校官网' }).getAttribute('href'), 'https://www.example.org/enroll');
  assert.equal(view.getByRole('link', { name: 'https://www.example.org/contact' }).getAttribute('href'), 'https://www.example.org/contact');
  assert.ok(view.container.textContent?.endsWith('.'));
});

test('school message followups preserve relevant server edits and submit them in the same conversation', async t => {
  const bodies: { message: string; assistantSessionToken?: string }[] = [];
  const question = '帮我写给学校的入学咨询模板', suggestion = '把这封邮件改成简短的中英双语消息';
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return Response.json({ ok: true, answer: '您好，请问三年级入学需要哪些材料？', assistantSessionToken: 'school.complete', followups: [suggestion, suggestion, question, '帮我安排周末出游行程'] });
  });
  const view = render(<BayBayAssistantEntry {...props} pendingQuestion={question} />);
  await act(async () => {});
  assert.equal(view.getAllByRole('button', { name: suggestion }).length, 1);
  assert.equal(view.queryByRole('button', { name: '帮我写一段不含孩子个人资料的入学咨询模板' }), null);
  assert.equal(view.queryByRole('button', { name: '帮我安排周末出游行程' }), null);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: suggestion })); });
  assert.equal(bodies[1].message, suggestion); assert.equal(bodies[1].assistantSessionToken, 'school.complete');
  await act(async () => { await setLocale('en', false); });
  assert.deepEqual(bayBayFollowups('Draft a school inquiry', false, false, ['Make the email shorter and bilingual', 'Plan an outing']), ['Make the email shorter and bilingual']);
  assert.match(bayBayFollowups('School enrollment for grade 3', false, false, ['Plan an outing'])[0], /verify with the district/);
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.deepEqual(bayBayFollowups('入學咨詢模板', false, false, ['縮短這封郵件，保留年級占位符']), ['縮短這封郵件，保留年級占位符']);
});
