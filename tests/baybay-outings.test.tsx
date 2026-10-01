import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { BayBayOutingSearch } from '../src/lib/baybay-conversation';
import type { Outing } from '../src/lib/outings';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url:'http://localhost/' });
Object.assign(globalThis, { window:dom.window, document:dom.window.document, localStorage:dom.window.localStorage, HTMLElement:dom.window.HTMLElement, Node:dom.window.Node, IS_REACT_ACT_ENVIRONMENT:true });
Object.defineProperty(globalThis, 'navigator', { configurable:true, value:dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width:1, height:1 }] : []) as unknown as DOMRectList; };
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { BayBayOutingResults } = await import('../src/components/BayBayOutingResults');
const { parseBayBayOutingSearch, isBayBayPlanRequest, isBayBaySocialRequest, fetchBayBayReply } = await import('../src/lib/baybay-conversation');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const noop = () => {};
const now = Date.parse('2026-09-30T18:00:00Z');
const search: BayBayOutingSearch = { source:'site-search',state:'ready',filters:{ sort:'soonest',city:'San Francisco',dateFrom:'2026-10-03',dateTo:'2026-10-04',q:'看展',language:'zh',seats:'open' },missing:[] };
const fixture = (id: string, patch: Partial<Outing> = {}): Outing => ({ id, title:`隔离测试小队 ${id}`,description:'This is fictional test data.',eventId:null,date:'2026-10-03',startTime:'14:00',endTime:'16:00',city:'San Francisco',venue:'A public museum entrance',capacity:4,costNote:'Tickets separate',transport:'transit',language:'any',startAt:Date.parse('2026-10-03T21:00:00Z'),endAt:Date.parse('2026-10-03T23:00:00Z'),timezone:'America/Los_Angeles',status:'open',revision:2,planVersion:1,host:{ id:'host',nickname:'Fixture host',verified:true },confirmedCount:1,me:null,createdAt:now,updatedAt:now,...patch });
const deferred = <T,>() => { let resolve!: (value:T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise,resolve }; };
beforeEach(async t => { localStorage.clear(); await setLocale('zh-Hans'); t.mock.method(Date,'now',() => now); });
afterEach(() => { cleanup(); localStorage.clear(); });

test('outing search decoder accepts exact contract and rejects unsafe or contradictory filters', () => {
  assert.deepEqual(parseBayBayOutingSearch(search),search);
  for (const value of [
    { ...search,source:'model' }, { ...search,missing:['city'] },
    { ...search,filters:{ ...search.filters,cursor:'untrusted' } },
    { ...search,filters:{ ...search.filters,date:'2026-10-03' } },
    { ...search,filters:{ sort:'soonest',date:'2026-02-30' } },
    { ...search,filters:{ ...search.filters,dateFrom:'2026-10-05' } },
    { ...search,filters:{ ...search.filters,q:'a'.repeat(121) } },
    { ...search,filters:{ ...search.filters,city:' ' } },
    { ...search,filters:{ ...search.filters,language:'any' } },
    { ...search,state:'needs_clarification',missing:[] },
  ]) assert.throws(() => parseBayBayOutingSearch(value));
});

test('clear social requests are never intercepted as first-turn personal planning', () => {
  for (const text of ['周六预算50，在SF找搭子一起去看展，帮我安排一天','週六找小隊，預算50，幫我安排一天','周六SF预算50有人一起看展吗','Plan Saturday with a $50 budget and find people to go with','Plan tomorrow, anyone want to join me?']) {
    assert.equal(isBayBaySocialRequest(text),true,text); assert.equal(isBayBayPlanRequest(text),false,text);
  }
  assert.equal(isBayBayPlanRequest('周六带五岁孩子，从 Fremont 出发，预算 $50'),true);
});

test('malformed search response fails instead of silently presenting a successful empty search', async t => {
  t.mock.method(globalThis,'fetch',async () => Response.json({ ok:true,answer:'Search ready',responseMode:'outing-search',outingSearch:{ ...search,filters:{ sort:'soonest',date:'wrong' } } }));
  await assert.rejects(fetchBayBayReply('Find people',{ currentPath:'/' },[],new AbortController().signal),/小队搜索条件/);
});

test('clarification does not fetch outings and tells users they can simply reply', t => {
  let calls = 0; t.mock.method(api,'request',async () => { calls++; return { outings:[],nextCursor:null }; });
  const view = render(<BayBayOutingResults search={{ ...search,state:'needs_clarification',filters:{ sort:'soonest',city:'Fremont' },missing:['date'],question:'想哪一天一起去？' }} onNavigate={noop}/>);
  assert.ok(view.getByText('想哪一天一起去？')); assert.ok(view.getByText('直接在下方回答即可，不必重写原来的问题。')); assert.equal(calls,0);
});

test('real query displays at most three cards, exact seat state, and retains every filter in detail and full results', async t => {
  const requests: string[] = [];
  t.mock.method(api,'request',async (path:string) => { requests.push(path); return { outings:[fixture('one'),fixture('two',{ confirmedCount:4 }),fixture('three'),fixture('four')],nextCursor:'next-batch' }; });
  const navigated: string[] = [];
  const view = render(<BayBayOutingResults search={search} onNavigate={path => navigated.push(path)}/>);
  await view.findByText('隔离测试小队 one');
  assert.equal(view.queryByText('隔离测试小队 four'),null);
  assert.ok(view.getByText('满员 · 可申请候补'));
  const requested = new URL(requests[0],'https://example.test');
  for (const [key,value] of Object.entries(search.filters)) assert.equal(requested.searchParams.get(key),value);
  fireEvent.click(view.getByRole('link',{ name:/隔离测试小队 one/ }));
  fireEvent.click(view.getByRole('link',{ name:'继续查看全部匹配小队' }));
  for (const path of navigated) { const url = new URL(path,'https://example.test'); assert.equal(url.pathname,'/together'); for (const [key,value] of Object.entries(search.filters)) assert.equal(url.searchParams.get(key),value); }
  assert.equal(new URL(navigated[0],'https://example.test').searchParams.get('outing'),'one');
  assert.equal(new URL(navigated[1],'https://example.test').searchParams.has('outing'),false);
  assert.equal(requests.length,1,'search never requests member discussion or applies to a team');
});

test('an empty bounded batch keeps more-results navigation instead of claiming zero matches', async t => {
  t.mock.method(api,'request',async () => ({ outings:[],nextCursor:'more-private-scan' }));
  const view = render(<BayBayOutingResults search={search} onNavigate={noop}/>);
  await view.findByText('这一批暂未找到可显示的小队；可继续查看下一批，确认是否有匹配结果。');
  assert.ok(view.getByRole('link',{ name:'继续查看全部匹配小队' }));
  assert.equal(view.queryByText(/这次查询没有找到/),null);
});

test('a genuine empty result offers filters and events, while read failure is retryable and never means zero', async t => {
  let calls = 0;
  t.mock.method(api,'request',async () => { if (++calls === 1) throw { status:503 }; return { outings:[],nextCursor:null }; });
  const view = render(<BayBayOutingResults search={search} onNavigate={noop}/>);
  await view.findByRole('alert'); assert.equal(view.queryByText(/这次查询没有找到/),null);
  fireEvent.click(view.getByRole('button',{ name:'重试查询' }));
  await view.findByText(/这次查询没有找到符合条件的小队/);
  assert.ok(view.getByRole('link',{ name:'先看看活动' }));
  assert.ok(view.getByRole('link',{ name:'查看完整搜索与筛选' }));
});

test('StrictMode cancellation does not strand results and blocked hosts never appear', async t => {
  t.mock.method(api,'request',async () => ({ outings:[fixture('blocked',{ host:{ id:'blocked',nickname:'Private',verified:true } }),fixture('visible')],nextCursor:null }));
  const view = render(<React.StrictMode><BayBayOutingResults search={search} blockedUserIds={['blocked']} onNavigate={noop}/></React.StrictMode>);
  await view.findByText('隔离测试小队 visible'); assert.equal(view.queryByText('隔离测试小队 blocked'),null);
});

test('account changes discard late results even when a transport ignores abort', async t => {
  const pending = deferred<unknown>();
  t.mock.method(api,'request',() => pending.promise);
  localStorage.setItem('currentUser',JSON.stringify({ id:'old',token:'old-token' }));
  const view = render(<BayBayOutingResults search={search} onNavigate={noop}/>);
  localStorage.setItem('currentUser',JSON.stringify({ id:'new',token:'new-token' }));
  await act(async () => pending.resolve({ outings:[fixture('old-account')],nextCursor:null }));
  assert.equal(view.queryByText('隔离测试小队 old-account'),null);
  assert.ok(view.getByText('账号已变化。请在新对话中重新查询小队。'));
});

test('unmount aborts the outing read and late success cannot leak into another conversation', async t => {
  const pending = deferred<unknown>(); let signal:AbortSignal | undefined;
  t.mock.method(api,'request',(_path:string,options:RequestInit) => { signal = options.signal as AbortSignal; return pending.promise; });
  const view = render(<BayBayOutingResults search={search} onNavigate={noop}/>); view.unmount();
  assert.equal(signal?.aborted,true);
  await act(async () => pending.resolve({ outings:[fixture('too-late')],nextCursor:null }));
  assert.equal(document.body.textContent?.includes('too-late'),false);
});

test('welcome social action keeps the typed question and sends chat without a planner redirect', async t => {
  const messages:string[] = [], paths:string[] = [];
  t.mock.method(globalThis,'fetch',async (_url:unknown,options:RequestInit) => { messages.push(JSON.parse(String(options.body)).message); return Response.json({ ok:true,answer:'请告诉我想去的城市',responseMode:'outing-search',outingSearch:{ source:'site-search',state:'needs_clarification',filters:{ sort:'soonest' },missing:['city','date'],question:'想在哪个城市一起去？' } }); });
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={path => paths.push(path)} onCreatePostClick={noop}/>);
  const original = '周六从 Fremont 出发预算50，想安排一天';
  fireEvent.change(view.getByRole('textbox',{ name:'向 BayBay 提问' }),{ target:{ value:original } });
  fireEvent.click(view.getByRole('button',{ name:/找搭子一起去/ }));
  await view.findByText('想在哪个城市一起去？');
  assert.ok(messages[0].startsWith(original)); assert.match(messages[0],/找搭子/); assert.deepEqual(paths,[]);
  assert.equal(view.queryByRole('button',{ name:/让 BayBay 帮我排一天/ }),null);
});

test('English outing copy stays readable without translating user-generated names', async t => {
  await setLocale('en');
  t.mock.method(api,'request',async () => ({ outings:[fixture('original-name')],nextCursor:null }));
  const view = render(<BayBayOutingResults search={search} onNavigate={noop}/>);
  await view.findByText('隔离测试小队 original-name');
  assert.ok(view.getByText('3 places open')); assert.ok(view.getByRole('link',{ name:'Open search and filters' }));
});

test('sign-out removes already loaded outing results when the shared storage session changes', async t => {
  localStorage.setItem('currentUser',JSON.stringify({ id:'old',token:'old-token' }));
  t.mock.method(api,'request',async () => ({ outings:[fixture('signed-in-result')],nextCursor:null }));
  const view = render(<BayBayOutingResults search={search} onNavigate={noop}/>);
  await view.findByText('隔离测试小队 signed-in-result');
  localStorage.removeItem('currentUser');
  act(() => { window.dispatchEvent(new dom.window.Event('storage')); });
  assert.equal(view.queryByText('隔离测试小队 signed-in-result'),null);
  assert.ok(view.getByText('账号已变化。请在新对话中重新查询小队。'));
});

test('a conversational date reply keeps prior social context and displays actual API results', async t => {
  const bodies:{ message:string; history:{ role:string;content:string }[] }[] = [], paths:string[] = [], reads:string[] = [];
  t.mock.method(globalThis,'fetch',async (_url:unknown,options:RequestInit) => {
    bodies.push(JSON.parse(String(options.body)));
    return Response.json(bodies.length === 1 ? { ok:true,answer:'告诉我具体日期就能查询',responseMode:'outing-search',outingSearch:{ source:'site-search',state:'needs_clarification',filters:{ sort:'soonest',city:'Fremont' },missing:['date'],question:'想哪天一起去？' } } : { ok:true,answer:'我整理好了查询条件，下面查询真实小队。',responseMode:'outing-search',outingSearch:{ ...search,filters:{ sort:'soonest',city:'Fremont',date:'2026-10-03' } } });
  });
  t.mock.method(api,'request',async (path:string) => { reads.push(path); return { outings:[fixture('from-api',{ city:'Fremont' })],nextCursor:null }; });
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={path => paths.push(path)} onCreatePostClick={noop}/>);
  const input = view.getByRole('textbox',{ name:'向 BayBay 提问' });
  fireEvent.change(input,{ target:{ value:'想在Fremont找搭子，预算50，帮我计划一起去' } });
  fireEvent.click(view.getByRole('button',{ name:'问一下' }));
  await view.findByText('想哪天一起去？'); assert.equal(reads.length,0);
  fireEvent.change(input,{ target:{ value:'10月3日' } });
  fireEvent.click(view.getByRole('button',{ name:'问一下' }));
  await view.findByText('隔离测试小队 from-api');
  assert.equal(bodies[1].history[0].content,bodies[0].message);
  assert.equal(new URL(reads[0],'https://example.test').searchParams.get('date'),'2026-10-03');
  assert.deepEqual(paths,[]); assert.equal(view.queryByRole('button',{ name:/让 BayBay 帮我排一天/ }),null);
});
