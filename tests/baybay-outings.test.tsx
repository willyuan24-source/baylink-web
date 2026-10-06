import { mockBayBayFetch } from './baybay-test-transport';
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
  mockBayBayFetch(t,async () => Response.json({ ok:true,answer:'Search ready',responseMode:'outing-search',outingSearch:{ ...search,filters:{ sort:'soonest',date:'wrong' } } }));
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
  mockBayBayFetch(t,async (_url:unknown,options:RequestInit) => { messages.push(JSON.parse(String(options.body)).message); return Response.json({ ok:true,answer:'请告诉我想去的城市',responseMode:'outing-search',outingSearch:{ source:'site-search',state:'needs_clarification',filters:{ sort:'soonest' },missing:['city','date'],question:'想在哪个城市一起去？' } }); });
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
  mockBayBayFetch(t,async (_url:unknown,options:RequestInit) => {
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

test('clarification renders an identical question once and preserves additional constraints', async t => {
  const prompt = '想在哪个城市一起去？';
  let answer = prompt;
  mockBayBayFetch(t,async () => Response.json({ ok:true,answer,responseMode:'outing-search',outingSearch:{ ...search,state:'needs_clarification',filters:{ sort:'soonest' },missing:['city'],question:prompt } }));
  const props = { variant:'headless' as const,panelOpen:true,onPanelOpenChange:noop,onNavigate:noop,onCreatePostClick:noop };
  const view = render(<BayBayAssistantEntry {...props}/>);
  const ask = () => { fireEvent.change(view.getByRole('textbox',{ name:'向 BayBay 提问' }),{ target:{ value:'我想找搭子' } }); fireEvent.click(view.getByRole('button',{ name:'问一下' })); };
  ask(); await view.findByText(prompt); assert.equal(view.getAllByText(prompt).length,1);
  fireEvent.click(view.getByRole('button',{ name:'新对话' }));
  answer = `${prompt} 这里只查询站内小队，不包含活动门票。`;
  ask(); await view.findByText(answer);
  assert.equal(document.body.textContent?.split(prompt).length,2,'question occurs once, with the extra explanation intact');
  assert.ok(view.getByText(/不包含活动门票/));
});

test('current clarification quick reply sends only after an explicit click, preserving history and known filters', async t => {
  const pending = deferred<Response>();
  const bodies:{ message:string;history:{ content:string }[] }[] = [];
  mockBayBayFetch(t,async (_url:unknown,options:RequestInit) => {
    bodies.push(JSON.parse(String(options.body)));
    return bodies.length === 1 ? Response.json({ ok:true,answer:'想哪一天一起去？',responseMode:'outing-search',outingSearch:{ ...search,state:'needs_clarification',filters:{ sort:'soonest',city:'Fremont' },missing:['date'],question:'想哪一天一起去？' } }) : pending.promise;
  });
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop}/>);
  fireEvent.change(view.getByRole('textbox',{ name:'向 BayBay 提问' }),{ target:{ value:'我想在Fremont找搭子' } });
  fireEvent.click(view.getByRole('button',{ name:'问一下' }));
  const choice = await view.findByRole('button',{ name:'本周末' });
  assert.equal(bodies.length,1,'displaying choices never submits them');
  assert.equal(view.queryByRole('button',{ name:'全湾区' }),null,'known cities are not replaced by a suggestion');
  const input = view.getByRole('textbox',{ name:'向 BayBay 提问' });
  fireEvent.compositionStart(input); fireEvent.click(choice);
  assert.equal(bodies.length,1,'a suggestion cannot interrupt an unfinished IME composition');
  fireEvent.compositionEnd(input);
  fireEvent.click(choice); assert.equal(bodies.length,2); assert.equal(bodies[1].message,'本周末。');
  assert.equal(bodies[1].history[0].content,'我想在Fremont找搭子');
  assert.equal(view.queryByRole('group',{ name:'快捷回答（点选即发送）' }),null,'old and pending turns cannot submit quick replies');
  await act(async () => pending.resolve(Response.json({ ok:true,answer:'已保留Fremont和本周末。' })));
  assert.equal(view.queryByRole('button',{ name:'本周末' }),null,'an earlier clarification stays read-only after the next reply');
});

test('typing a draft hides quick replies and never overwrites an unfinished answer', async t => {
  let calls = 0;
  mockBayBayFetch(t,async () => { calls++; return Response.json({ ok:true,answer:'想在哪个城市一起去？',responseMode:'outing-search',outingSearch:{ ...search,state:'needs_clarification',filters:{ sort:'soonest' },missing:['city','date'],question:'想在哪个城市一起去？' } }); });
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop}/>);
  const input = view.getByRole('textbox',{ name:'向 BayBay 提问' }) as HTMLInputElement;
  fireEvent.change(input,{ target:{ value:'我想找搭子' } }); fireEvent.click(view.getByRole('button',{ name:'问一下' }));
  await view.findByRole('button',{ name:'全湾区' });
  assert.equal(view.queryByRole('button',{ name:'本周末' }),null,'ask for the missing city first');
  fireEvent.change(input,{ target:{ value:'Fremont，但我还想补充' } });
  assert.equal(view.queryByRole('group',{ name:'快捷回答（点选即发送）' }),null);
  assert.equal(input.value,'Fremont，但我还想补充'); assert.equal(calls,1);
});

test('school and service conversations keep ordinary answers without outing quick replies', async t => {
  mockBayBayFetch(t,async () => Response.json({ ok:true,answer:'请说明需要了解的事项。' }));
  for (const message of ['学校入学需要什么材料','在Fremont找水管维修服务']) {
    const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop}/>);
    fireEvent.change(view.getByRole('textbox',{ name:'向 BayBay 提问' }),{ target:{ value:message } }); fireEvent.click(view.getByRole('button',{ name:'问一下' }));
    await view.findByText('请说明需要了解的事项。');
    assert.equal(view.queryByRole('group',{ name:'快捷回答（点选即发送）' }),null); view.unmount();
  }
});

test('English and Traditional Chinese choices are explicit user replies, not translated search facts', async () => {
  for (const item of [{ locale:'en' as const, prompt:'Which day?',label:'Next 7 days',reply:'The next 7 days, including today.' }, { locale:'zh-Hant' as const,prompt:'想哪一天一起去？',label:'未來7天',reply:'未來7天，包含今天。' }]) {
    await setLocale(item.locale);
    const sent:string[] = [];
    const view = render(<BayBayOutingResults search={{ ...search,state:'needs_clarification',filters:{ sort:'soonest',city:'Fremont' },missing:['date'],question:item.prompt }} answer={item.prompt} onNavigate={noop} onAnswer={value => sent.push(value)}/>);
    assert.equal(view.getAllByText(item.prompt).length,1); assert.deepEqual(sent,[]);
    fireEvent.click(view.getByRole('button',{ name:item.label })); assert.deepEqual(sent,[item.reply]); view.unmount();
  }
});

test('search continuation follows only the latest completed outing reply and clears with a new topic or conversation', async t => {
  const token = 'fixture-signed-public-search-token.fixture-signature';
  const bodies:{ message:string;outingSearchToken?:string;context:Record<string,unknown>;history:unknown[] }[] = [];
  mockBayBayFetch(t,async (_url:unknown,options:RequestInit) => {
    const body = JSON.parse(String(options.body)); bodies.push(body);
    const social = body.message === '我想找搭子';
    return Response.json(social ? { ok:true,answer:'想在哪个城市一起去？',responseMode:'outing-search',outingSearch:{ ...search,state:'needs_clarification',filters:{ sort:'soonest' },missing:['city','date'],question:'想在哪个城市一起去？',continuationToken:token } } : { ok:true,answer:`已回答：${body.message}` });
  });
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop}/>);
  const ask = async (message:string) => { fireEvent.change(view.getByRole('textbox',{ name:'向 BayBay 提问' }),{ target:{ value:message } }); fireEvent.click(view.getByRole('button',{ name:'问一下' })); await view.findByText(message === '我想找搭子' ? '想在哪个城市一起去？' : `已回答：${message}`); };
  await ask('我想找搭子'); await ask('关于学校入学'); await ask('继续学校话题');
  assert.equal(bodies[0].outingSearchToken,undefined); assert.equal(bodies[1].outingSearchToken,token); assert.equal(bodies[1].context.outingSearchToken,undefined,'the token must not enter model context');
  assert.equal(bodies[2].outingSearchToken,undefined,'a non-outing completed answer cuts off the older token');
  fireEvent.click(view.getByRole('button',{ name:'新对话' })); await ask('我想找搭子');
  await ask('换个话题，学校入学');
  assert.equal(bodies[4].outingSearchToken,undefined,'an explicit topic reset clears the token before the request');
  assert.deepEqual(bodies[4].history,[],'an explicit reset also clears raw conversation history');
  fireEvent.click(view.getByRole('button',{ name:'新对话' })); await ask('我想找搭子');
  fireEvent.click(view.getByRole('button',{ name:'新对话' })); await ask('一个新的生活问题');
  assert.equal(bodies[6].outingSearchToken,undefined,'new conversations do not reuse the previous search token');
});

test('expired search memory offers a fresh editable search instead of retrying the invalid token', async t => {
  const bodies:{ message:string;history:unknown[];outingSearchToken?:string }[] = [];
  mockBayBayFetch(t,async (_url:unknown,options:RequestInit) => {
    bodies.push(JSON.parse(String(options.body)));
    if (bodies.length === 2) return Response.json({ ok:false,code:'INVALID_OUTING_SEARCH_TOKEN',error:'搜索条件已过期，请开启新对话。' },{ status:400 });
    return Response.json({ ok:true,answer:'想在哪个城市一起去？',responseMode:'outing-search',outingSearch:{ ...search,state:'needs_clarification',filters:{ sort:'soonest' },missing:['city','date'],question:'想在哪个城市一起去？',continuationToken:'fixture.fixture-signature' } });
  });
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop}/>);
  const input = view.getByRole('textbox',{ name:'向 BayBay 提问' }) as HTMLInputElement;
  fireEvent.change(input,{ target:{ value:'我想找搭子' } }); fireEvent.click(view.getByRole('button',{ name:'问一下' }));
  fireEvent.click(await view.findByRole('button',{ name:'全湾区' }));
  const restart = await view.findByRole('button',{ name:'重新开始查找' });
  assert.equal(view.queryByRole('button',{ name:'重试这个问题' }),null);
  fireEvent.click(restart);
  assert.equal(bodies.length,2,'restarting never automatically submits a new request');
  assert.equal(view.queryByText('搜索条件已过期，请开启新对话。'),null);
  assert.equal(input.value,'我想找搭子一起去。'); assert.equal(document.activeElement,input);
  fireEvent.click(view.getByRole('button',{ name:'问一下' })); await view.findByText('想在哪个城市一起去？');
  assert.equal(bodies[2].outingSearchToken,undefined); assert.deepEqual(bodies[2].history,[]);
});
