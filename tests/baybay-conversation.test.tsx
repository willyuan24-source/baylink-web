import { mockBayBayFetch } from './baybay-test-transport';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { QuickExplore } = await import('../src/components/QuickExplore');
const { fetchBayBayReply, conversationHistory, safeBayBayPath, bayBayErrorMessage, isBayBayPlanRequest, bayBayPlanPath, parseBayBayOutingSearch, isBayBaySearchContextExpired, bayBayTaskBrief, bayBayWebResult } = await import('../src/lib/baybay-conversation');
const { guides } = await import('../src/data/guides');
const { readBayBayRequirementsDraft } = await import('../src/lib/baybay-plan-handoff');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
const noop = () => {};
const answer = (text: string) => Response.json({ ok: true, answer: text });

test('completion announces each turn once without streaming text, submitting a draft or moving focus', async t => {
  const streams: ReadableStreamDefaultController<Uint8Array>[] = [];
  const encoder = new TextEncoder();
  const requests = mockBayBayFetch(t, async () => new Response(new ReadableStream<Uint8Array>({
    start(controller) { streams.push(controller); },
  }), { headers: { 'Content-Type': 'text/event-stream' } }));
  const props = { variant: 'headless' as const, panelOpen: true, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop };
  const view = render(<BayBayAssistantEntry {...props} />);
  const notice = view.baseElement.querySelector('[data-baybay-completion]') as HTMLElement;
  assert.equal(notice.getAttribute('role'), 'status');
  assert.equal(notice.getAttribute('aria-live'), 'polite');
  assert.equal(notice.getAttribute('aria-atomic'), 'true');
  assert.equal(notice.textContent, '');
  assert.equal(notice.closest('[role="dialog"]') !== null, true, 'the live region belongs to the accessible modal, outside the inert page');
  assert.equal(notice.closest('.baybay-thread') === null, true);
  const announcements: string[] = [];
  const observer = new dom.window.MutationObserver(() => { if (notice.textContent) announcements.push(notice.textContent); });
  observer.observe(notice, { subtree: true, childList: true, characterData: true });
  t.after(() => observer.disconnect());
  const input = view.getByRole('textbox', { name: '向 BayBay 提问' }) as HTMLInputElement;
  input.focus();
  fireEvent.change(input, { target: { value: '请查官方图书馆资格' } });
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' }); });
  fireEvent.change(input, { target: { value: '下一条还没准备好发送的问题' } });
  for (const text of ['先查资格。', '再核实费用。']) {
    await act(async () => { streams[0].enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ validated: true, text })}\n\n`)); });
    assert.equal(notice.textContent, '');
    assert.equal(view.baseElement.querySelector('[data-baybay-completion]') === notice, true, 'the empty live region persists across stream updates');
  }
  const partial = view.getByText('先查资格。再核实费用。');
  assert.equal(partial.closest('[aria-live]') === null, true, 'answer deltas never enter a live region');
  await act(async () => { streams[0].enqueue(encoder.encode('event: result\ndata: {"ok":true,"answer":"完整回答一。"}\n\n')); });
  assert.deepEqual(announcements, ['BayBay 的第 1 条回答已完成。可以阅读回答，或继续在输入框提问。']);
  assert.equal(input.value, '下一条还没准备好发送的问题');
  assert.equal(document.activeElement === input, true);
  assert.equal(requests.mock.callCount(), 1, 'completion must not submit the typed follow-up');
  view.rerender(<BayBayAssistantEntry {...props} currentPath="/guides" />);
  await act(async () => {});
  assert.equal(announcements.length, 1, 'a completed render never announces the same turn again');
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' }); });
  assert.equal(notice.textContent, '');
  await act(async () => { streams[1].enqueue(encoder.encode('event: result\ndata: {"ok":true,"answer":"完整回答二。"}\n\n')); });
  assert.deepEqual(announcements, [
    'BayBay 的第 1 条回答已完成。可以阅读回答，或继续在输入框提问。',
    'BayBay 的第 2 条回答已完成。可以阅读回答，或继续在输入框提问。',
  ]);
  view.rerender(<BayBayAssistantEntry {...props} panelOpen={false} />);
  view.rerender(<BayBayAssistantEntry {...props} />);
  assert.equal(view.baseElement.querySelector('[data-baybay-completion]')?.textContent, '');
  assert.ok(view.getByText('完整回答一。'));
  assert.ok(view.getByText('完整回答二。'));
  assert.equal(requests.mock.callCount(), 2, 'reopening retains history without another request or announcement');
});

test('restored completed history stays silent until a new request finishes', async t => {
  let finish!: () => void;
  mockBayBayFetch(t, () => new Promise<Response>(resolve => { finish = () => resolve(answer('新回答。')); }));
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop}
    initialConversation={{ question: '保留的草稿', turns: [{ id: 7, question: '之前的问题', state: 'complete', response: { ok: true, answer: '之前的回答。' } }] }} />);
  const notice = view.baseElement.querySelector('[data-baybay-completion]') as HTMLElement;
  assert.equal(notice.textContent, '');
  assert.ok(view.getByText('之前的回答。'));
  await act(async () => { fireEvent.keyDown(view.getByRole('textbox', { name: '向 BayBay 提问' }), { key: 'Enter' }); });
  assert.equal(notice.textContent, '');
  await act(async () => { finish(); });
  assert.match(notice.textContent || '', /第 8 条回答已完成/);
});

test('completion uses the current English or Traditional locale without retranslating a completed announcement', async t => {
  const finishes: (() => void)[] = [];
  mockBayBayFetch(t, () => new Promise<Response>(resolve => { finishes.push(() => resolve(answer('官方资料回答。'))); }));
  for (const locale of ['en', 'zh-Hant'] as const) {
    await act(async () => { await setLocale('en', false); });
    const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} />);
    const input = view.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '请查官方信息' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    fireEvent.change(input, { target: { value: 'Keep my unfinished draft' } });
    await act(async () => { await setLocale(locale, false); });
    await act(async () => { finishes.at(-1)!(); });
    const notice = view.baseElement.querySelector('[data-baybay-completion]') as HTMLElement;
    const expected = locale === 'en'
      ? 'BayBay reply 1 is ready. Read the answer or continue in the question field.'
      : 'BayBay 的第 1 條回答已完成。可以閱讀回答，或繼續在輸入框提問。';
    assert.equal(notice.textContent, expected);
    assert.equal(input.value, 'Keep my unfinished draft');
    assert.equal(notice.getAttribute('translate'), 'no');
    await act(async () => { await setLocale('zh-Hans', false); });
    assert.equal(notice.textContent, expected, 'changing language after completion must not replay the old turn');
    view.unmount();
  }
});

test('failed and stopped requests never announce a completed answer', async t => {
  const finish: ((response: Response) => void)[] = [];
  mockBayBayFetch(t, () => new Promise<Response>(resolve => finish.push(resolve)));
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} />);
  const input = view.getByRole('textbox', { name: '向 BayBay 提问' });
  fireEvent.change(input, { target: { value: '测试失败的问题' } });
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
  await act(async () => { finish[0](Response.json({ ok: false, error: '答复服务暂不可用' }, { status: 502 })); });
  assert.equal(view.baseElement.querySelector('[data-baybay-completion]')?.textContent, '');
  assert.ok(view.getByRole('alert'));
  fireEvent.change(input, { target: { value: '测试停止的问题' } });
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
  fireEvent.click(view.getByRole('button', { name: '停止' }));
  await act(async () => { finish[1](answer('停止后到达的回答不应提示完成。')); });
  assert.equal(view.baseElement.querySelector('[data-baybay-completion]')?.textContent, '');
});

test('new replies scroll to their heading instead of skipping long answers to the footer', async t => {
  const proto = dom.window.HTMLElement.prototype;
  const original = Object.getOwnPropertyDescriptor(proto, 'scrollIntoView');
  const scrolled: string[] = [];
  Object.defineProperty(proto, 'scrollIntoView', { configurable: true, value: function (this: HTMLElement, options: ScrollIntoViewOptions) {
    assert.equal(options.block, 'start'); scrolled.push(this.className);
  } });
  t.after(() => { if (original) Object.defineProperty(proto, 'scrollIntoView', original); else Reflect.deleteProperty(proto, 'scrollIntoView'); });
  let finish!: () => void;
  mockBayBayFetch(t, () => new Promise<Response>(resolve => { finish = () => resolve(answer('第一步先看资格。\n'.repeat(80))); }));
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} />);
  fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: '详细说明图书馆资格' } });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); });
  assert.deepEqual(scrolled, ['baybay-user-question']);
  await act(async () => { finish(); });
  assert.deepEqual(scrolled, ['baybay-user-question', 'member-baybay-answer-label']);
});

test('scrolling upward while waiting preserves reading position until the next explicit question', async t => {
  const proto = dom.window.HTMLElement.prototype;
  const original = Object.getOwnPropertyDescriptor(proto, 'scrollIntoView');
  const scrolled: string[] = [];
  Object.defineProperty(proto, 'scrollIntoView', { configurable: true, value: function (this: HTMLElement) { scrolled.push(this.className); } });
  t.after(() => { if (original) Object.defineProperty(proto, 'scrollIntoView', original); else Reflect.deleteProperty(proto, 'scrollIntoView'); });
  let finish!: () => void;
  mockBayBayFetch(t, () => new Promise<Response>(resolve => { finish = () => resolve(answer('这是回答。')); }));
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} />);
  const ask = async (message: string) => {
    fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: message } });
    await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); });
  };
  await ask('先看看官方资格');
  const body = view.baseElement.querySelector('.baybay-scroll') as HTMLElement;
  body.scrollTop = 180; fireEvent.scroll(body);
  body.scrollTop = 20; fireEvent.scroll(body);
  await act(async () => { finish(); });
  assert.equal(body.scrollTop, 20);
  assert.deepEqual(scrolled, ['baybay-user-question'], 'A completed answer must not take over manual reading');
  await ask('再查打印页数');
  await act(async () => { finish(); });
  assert.deepEqual(scrolled, ['baybay-user-question', 'baybay-user-question', 'member-baybay-answer-label']);
});

test('search continuation remains opaque and separate from model context and short history', async t => {
  const token = 'public-conditions.signature', history = [{ role:'user' as const,content:'只看有空位' },{ role:'assistant' as const,content:'已保留条件' }];
  let sent: Record<string, unknown> | undefined;
  t.mock.method(globalThis,'fetch',async (_url:unknown,options:RequestInit) => { sent = JSON.parse(String(options.body)); return answer('好的'); });
  await fetchBayBayReply('改用英文',{ currentPath:'/together',outingSearchToken:token },history,new AbortController().signal);
  assert.equal(sent?.outingSearchToken,token);
  assert.deepEqual(sent?.context,{ currentPath:'/together' });
  assert.deepEqual(sent?.history,history);
  await fetchBayBayReply('新问题',{ currentPath:'/' },[],new AbortController().signal);
  assert.equal(Object.hasOwn(sent!,'outingSearchToken'),false);
});

test('search response accepts bounded continuation tokens while preserving compatibility with older replies', () => {
  const search = { source:'site-search',state:'ready',filters:{sort:'soonest'},missing:[] };
  assert.deepEqual(parseBayBayOutingSearch(search),search);
  assert.equal(parseBayBayOutingSearch({...search,continuationToken:'eyJ2IjoxfQ.signature'}).continuationToken,'eyJ2IjoxfQ.signature');
  for (const token of ['', {}, 'raw text', 'a.b.c', 'a.'.padEnd(4097,'b')]) {
    assert.throws(()=>parseBayBayOutingSearch({...search,continuationToken:token}));
  }
});

test('expired search context is a recoverable new-search error, not an ordinary retry', async t => {
  t.mock.method(globalThis,'fetch',async () => Response.json({ok:false,code:'INVALID_OUTING_SEARCH_TOKEN',error:'搜索条件已失效，请开启新对话。'},{status:400}));
  await assert.rejects(fetchBayBayReply('改用英文',{currentPath:'/',outingSearchToken:'old.token'},[],new AbortController().signal), error => {
    assert.equal(isBayBaySearchContextExpired(error),true);
    assert.equal(bayBayErrorMessage(error),'搜索条件已失效，请开启新对话。');
    return true;
  });
  assert.equal(isBayBaySearchContextExpired(new Error('Network error')),false);
});

test('completed conversations send bounded history and retain earlier answers', async t => {
  const bodies: { message: string; history: unknown[] }[] = [];
  mockBayBayFetch(t, async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(String(options.body)); bodies.push(body);
    return answer(`这是第 ${bodies.length} 条根据上下文整理的回答。`);
  });
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} />);
  const input = view.getByRole('textbox', { name: '向 BayBay 提问' });
  for (const message of ['带六岁孩子，周末去哪里', '如果不开车呢']) {
    fireEvent.change(input, { target: { value: message } });
    await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); });
    await view.findByText(`这是第 ${bodies.length} 条根据上下文整理的回答。`);
  }
  assert.deepEqual(bodies[0].history, []);
  assert.deepEqual(bodies[1].history, [{ role: 'user', content: '带六岁孩子，周末去哪里' }, { role: 'assistant', content: '这是第 1 条根据上下文整理的回答。' }]);
  assert.ok(view.getByText('这是第 1 条根据上下文整理的回答。'));
  assert.ok(view.getByText('这是第 2 条根据上下文整理的回答。'));
  fireEvent.click(view.getByRole('button', { name: '新对话' }));
  assert.equal(view.queryByText('这是第 1 条根据上下文整理的回答。'), null);
});

test('city and date survive beyond four turns while a typed restart clears history, retained conditions and outing tokens', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-04T19:00:00Z') });
  const bodies: { message: string; history: { content: string }[]; searchContext?: { city?: string; date?: string }; outingSearchToken?: string }[] = [];
  mockBayBayFetch(t, async (_url: unknown, options: RequestInit) => {
    bodies.push(JSON.parse(String(options.body)));
    return Response.json({ ok: true, answer: `Reply ${bodies.length}: invented Shanghai`, ...(bodies.length === 6 ? { outingSearch: {
      source: 'site-search', state: 'needs_clarification', filters: { sort: 'soonest' }, missing: ['date'], question: '请再确认日期', continuationToken: 'previous.signature',
    } } : {}) });
  });
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} />);
  const ask = async (message: string) => {
    fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: message } });
    await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); });
  };
  for (const message of ['今天在 San Mateo 有哪些活动？', '想轻松一点', '最好室内', '坐公共交通', '再推荐两个', '有哪些免费项目']) await ask(message);
  assert.equal(bodies[5].history.length, 8);
  assert.ok(bodies[5].history.every(row => !row.content.includes('San Mateo')));
  assert.deepEqual(bodies[5].searchContext, { city: 'San Mateo', date: '2026-10-04' });
  await ask('重新開始，明天去 Berkeley');
  assert.deepEqual(bodies[6].history, []);
  assert.equal(bodies[6].outingSearchToken, undefined);
  assert.deepEqual(bodies[6].searchContext, { city: 'Berkeley', date: '2026-10-05' });
  assert.equal(view.queryByText('今天在 San Mateo 有哪些活动？'), null);
});

test('recognized page filters enter search context but raw URL text is not sent and explicit user conditions win', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-04T19:00:00Z') });
  const bodies: { context: { currentPath: string }; searchContext?: { city?: string; date?: string }; message: string }[] = [];
  mockBayBayFetch(t, async (_url: unknown, options: RequestInit) => { bodies.push(JSON.parse(String(options.body))); return answer('已接收'); });
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop}
    currentPath="/calendar?city=Oakland&date=2026-10-05&q=private@example.com" />);
  for (const message of ['这一天有什么活动？', '今天改去 Berkeley']) {
    fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: message } });
    await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); });
  }
  assert.deepEqual(bodies[0].context, { currentPath: '/calendar' });
  assert.deepEqual(bodies[0].searchContext, { city: 'Oakland', date: '2026-10-05' });
  assert.deepEqual(bodies[1].searchContext, { city: 'Berkeley', date: '2026-10-04' });
  assert.ok(!JSON.stringify(bodies).includes('private@example.com'));
});

test('cleared city and date constraints stay cleared on follow-ups instead of being restored from page filters', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-04T19:00:00Z') });
  const bodies: { searchContext?: { city?: string; region?: string; date?: string }; message: string }[] = [];
  mockBayBayFetch(t, async (_url: unknown, options: RequestInit) => { bodies.push(JSON.parse(String(options.body))); return answer(`Reply ${bodies.length}`); });
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} currentPath="/calendar?city=San%20Francisco&date=2026-10-04" />);
  const ask = async (message: string) => {
    fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: message } });
    await act(async () => fireEvent.click(view.getByRole('button', { name: '问一下' })));
  };
  await ask('今天在 San Jose 有哪些活动');
  await ask('整个湾区都可以');
  await ask('再推荐两条');
  assert.deepEqual(bodies[2].searchContext, { date: '2026-10-04' });
  await ask('改成10月10日到10月11日');
  await ask('按这个范围推荐');
  assert.equal(bodies[4].searchContext, undefined);
  await ask('日期不限');
  for (const message of ['安静一点', '人少一点', '还有哪些', '再推荐两条']) await ask(message);
  assert.equal(bodies.at(-1)!.searchContext, undefined);
  assert.ok(bodies.every(body => Object.keys(body.searchContext || {}).every(key => ['city', 'region', 'date'].includes(key))), 'internal clear-state metadata never enters API filters');
  await ask('重新开始');
  assert.deepEqual(bodies.at(-1)!.searchContext, { city: 'San Francisco', date: '2026-10-04' }, 'a deliberate new conversation may use the current page again');
});

test('mode switching and cancellation keep the selected request scope and ignore cancelled geographic corrections', async t => {
  const pending: { body: { searchMode: string; searchContext?: { city?: string; date?: string }; history: unknown[] }; signal: AbortSignal; resolve: (response: Response) => void }[] = [];
  mockBayBayFetch(t, (_url: unknown, options: RequestInit) => new Promise<Response>(resolve => pending.push({ body: JSON.parse(String(options.body)), signal: options.signal as AbortSignal, resolve })));
  const view = render(<BayBayAssistantEntry ownerId="member" variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} />);
  const ask = (message: string) => { fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: message } }); fireEvent.click(view.getByRole('button', { name: '问一下' })); };
  ask('San Jose 10/05/2027 有什么活动');
  assert.equal(pending[0].body.searchMode, 'smart');
  for (const name of ['智能检索', '联网查', '仅站内']) assert.equal((view.getByRole('button', { name, exact: true }) as HTMLButtonElement).disabled, true);
  fireEvent.click(view.getByRole('button', { name: '停止', exact: true }));
  assert.equal(pending[0].signal.aborted, true);
  fireEvent.click(view.getByRole('button', { name: '仅站内', exact: true }));
  ask('Berkeley 2027/10/06 有什么活动');
  assert.equal(pending[1].body.searchMode, 'site');
  assert.deepEqual(pending[1].body.searchContext, { city: 'Berkeley', date: '2027-10-06' });
  assert.deepEqual(pending[1].body.history, []);
  await act(async () => pending[0].resolve(answer('Cancelled San Jose answer')));
  assert.equal(view.queryByText('Cancelled San Jose answer'), null);
  assert.ok(view.getByRole('button', { name: '停止', exact: true }), 'a late cancelled answer must not finish the newer request');
  await act(async () => pending[1].resolve(answer('Berkeley site answer')));
  fireEvent.click(view.getByRole('button', { name: '联网查', exact: true }));
  ask('请核实这一天的安排');
  assert.equal(pending[2].body.searchMode, 'web');
  assert.deepEqual(pending[2].body.searchContext, { city: 'Berkeley', date: '2027-10-06' });
  assert.equal(pending[2].body.history.length, 2);
  await act(async () => pending[2].resolve(answer('Checked Berkeley answer')));
  fireEvent.click(view.getByRole('button', { name: '智能检索', exact: true }));
  ask('还有其他选择吗');
  assert.equal(pending[3].body.searchMode, 'smart');
  assert.deepEqual(pending[3].body.searchContext, { city: 'Berkeley', date: '2027-10-06' });
  await act(async () => pending[3].resolve(answer('Other Berkeley choices')));
  assert.equal(view.queryByText('Cancelled San Jose answer'), null);
});

test('follow-up chips preserve supplied travel facts instead of inventing age, origin, or transport', async t => {
  const bodies: { message: string; history: { role: string; content: string }[] }[] = [];
  mockBayBayFetch(t, async (_url: unknown, options: RequestInit) => {
    bodies.push(JSON.parse(String(options.body)));
    return answer(`这是第 ${bodies.length} 条保留原有条件的回答。`);
  });
  const cases = [
    { question: '孩子 2 岁，从南湾自驾，预算 80 美元，周末去哪里？', followup: '帮我按已经提供的条件，列出需要提前预约的项目' },
    { question: '周末独自从旧金山自驾，想玩一整天，预算 150 美元。', followup: '帮我按已经提供的条件，把推荐整理成出游安排' },
    { question: '周末独自从旧金山自驾，想玩一整天，预算 150 美元。', followup: '帮我按已经提供的条件，比较这些去处的取舍' },
  ];
  for (const { question, followup } of cases) {
    const offset = bodies.length;
    const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} />);
    fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: question } });
    fireEvent.click(view.getByRole('button', { name: '问一下' }));
    await view.findByText(`这是第 ${offset + 1} 条保留原有条件的回答。`);
    fireEvent.click(view.getByRole('button', { name: followup }));
    await view.findByText(`这是第 ${offset + 2} 条保留原有条件的回答。`);
    assert.deepEqual(bodies[offset + 1].history[0], { role: 'user', content: question });
    assert.equal(bodies[offset + 1].message, followup);
    assert.doesNotMatch(bodies[offset + 1].message, /6 岁|东湾|不开车|半天|不花钱|带孩子同行/);
    view.unmount();
  }
});

test('a draft preset focuses editable input and sends only the user-edited text after explicit submit', async t => {
  const bodies: { message: string; context: { currentPath: string }; searchContext?: { date?: string } }[] = [];
  const requests = mockBayBayFetch(t, async (_url: unknown, options: RequestInit) => {
    bodies.push(JSON.parse(String(options.body)));
    return answer('已收到你确认的日历条件。');
  });
  const consumed: (number | undefined)[] = [];
  const props = { variant: 'headless' as const, panelOpen: true, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop,
    currentPath: '/calendar?date=2026-10-31&region=east-bay', pendingQuestion: '请帮我安排 2026-10-31 在东湾 · Livermore 的出游。', pendingQuestionId: 1,
    pendingQuestionMode: 'draft' as const, onPendingQuestionConsumed: (id?: number) => consumed.push(id) };
  const view = render(<BayBayAssistantEntry {...props} />, { wrapper: React.StrictMode });
  await act(async () => {});
  const input = view.getByRole('textbox', { name: '向 BayBay 提问' }) as HTMLInputElement;
  assert.equal(input.value, props.pendingQuestion);
  assert.equal(document.activeElement, input);
  assert.deepEqual(consumed, [1]);
  assert.equal(requests.mock.callCount(), 0, 'opening the calendar draft cannot start an AI request');
  const edited = `${props.pendingQuestion} 两位成人，坐公交。`;
  fireEvent.change(input, { target: { value: edited } });
  view.rerender(<BayBayAssistantEntry {...props} pendingQuestion={null} />);
  assert.equal(input.value, edited, 'consuming the preset must not erase edits');
  view.rerender(<BayBayAssistantEntry {...props} pendingQuestion={null} panelOpen={false} />);
  view.rerender(<BayBayAssistantEntry {...props} pendingQuestion={null} />);
  assert.equal(input.value, edited);
  assert.equal(requests.mock.callCount(), 0, 'reopening a saved in-memory draft cannot auto-submit it');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); });
  assert.equal(requests.mock.callCount(), 1);
  assert.equal(bodies[0].message, edited);
  assert.equal(bodies[0].context.currentPath, '/calendar', 'raw URL parameters stay private');
  assert.equal(bodies[0].searchContext?.date, '2026-10-31');
  assert.ok(view.getByText('已收到你确认的日历条件。'));
});

test('a preset arriving while busy waits, is consumed once when started, and can repeat under a new ID', async t => {
  const resolvers: ((response: Response) => void)[] = [];
  const bodies: { message: string }[] = [];
  const consumed: (number | undefined)[] = [];
  mockBayBayFetch(t, (_url: unknown, options: RequestInit) => {
    bodies.push(JSON.parse(String(options.body)));
    return new Promise<Response>(resolve => resolvers.push(resolve));
  });
  const props = { variant: 'headless' as const, panelOpen: true, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop, onPendingQuestionConsumed: (id?: number) => consumed.push(id) };
  const view = render(<BayBayAssistantEntry {...props} pendingQuestion="第一个预置问题" pendingQuestionId={1} />);
  assert.deepEqual(consumed, [1]);
  view.rerender(<BayBayAssistantEntry {...props} pendingQuestion="新的预置问题" pendingQuestionId={2} />);
  assert.deepEqual(consumed, [1]);
  assert.equal(bodies.length, 1);
  await act(async () => resolvers[0](answer('第一个预置问题的完整答案。')));
  assert.equal(bodies.length, 2);
  assert.deepEqual(consumed, [1, 2]);
  await act(async () => resolvers[1](answer('新的预置问题的完整答案。')));
  assert.equal(bodies.length, 2, 'an unchanged preset must not send again on a completed render');
  view.rerender(<BayBayAssistantEntry {...props} pendingQuestion="新的预置问题" pendingQuestionId={3} />);
  assert.equal(bodies.length, 3);
  assert.deepEqual(consumed, [1, 2, 3]);
  await act(async () => resolvers[2](answer('再次提问的完整答案。')));
});

test('closing aborts, and late cancelled responses cannot overwrite a reopened conversation', async t => {
  const requests: { signal: AbortSignal; resolve: (response: Response) => void; body: { history: unknown[] } }[] = [];
  mockBayBayFetch(t, (_url: unknown, options: RequestInit) => new Promise<Response>(resolve => requests.push({ signal: options.signal as AbortSignal, resolve, body: JSON.parse(String(options.body)) })));
  const props = { variant: 'headless' as const, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop };
  const view = render(<BayBayAssistantEntry {...props} panelOpen pendingQuestion="一个很慢的问题" pendingQuestionId={1} />);
  view.rerender(<BayBayAssistantEntry {...props} panelOpen={false} />);
  assert.equal(requests[0].signal.aborted, true);
  view.rerender(<BayBayAssistantEntry {...props} panelOpen pendingQuestion="重新打开的新问题" pendingQuestionId={2} />);
  assert.deepEqual(requests[1].body.history, [], 'cancelled messages never enter model history');
  await act(async () => requests[1].resolve(answer('这是重新打开后的新答案。')));
  await act(async () => requests[0].resolve(answer('这个旧答案不应出现。')));
  assert.ok(view.getByText('这是重新打开后的新答案。'));
  assert.equal(view.queryByText('这个旧答案不应出现。'), null);
});

test('stalled fetch and stalled response bodies have a bounded timeout', async t => {
  let signal: AbortSignal | undefined;
  mockBayBayFetch(t, async (_url: unknown, options: RequestInit) => {
    signal = options.signal as AbortSignal;
    return { ok: true, json: () => new Promise(() => {}) } as Response;
  });
  await assert.rejects(fetchBayBayReply('超时测试问题', { currentPath: '/' }, [], new AbortController().signal, 15), /等待时间较长/);
  assert.equal(signal?.aborted, true);
});

test('history only includes four complete pairs; AI navigation is restricted to published internal guides', () => {
  const turns = Array.from({ length: 7 }, (_, id) => ({ id, question: `问题 ${id}`, state: 'complete' as const, response: { ok: true, answer: `答案 ${id}` } }));
  const history = conversationHistory([...turns, { id: 8, question: '未完成', state: 'pending' }]);
  assert.equal(history.length, 8);
  assert.equal(history[0].content, '问题 3');
  assert.equal(safeBayBayPath(`/guides/${guides[0].slug}`), true);
  for (const path of ['https://evil.test', '//evil.test', '/guides/made-up-article', '/category/rent\\evil']) assert.equal(safeBayBayPath(path), false);
});

test('AI action links only allow known planner queries and published tools', () => {
  for (const path of ['/plan', '/plan?import=event', bayBayPlanPath('周六从 Fremont 出发，门票预算 $50'), '/tools?tool=communication', '/tools?tool=split', '/category/repair']) assert.equal(safeBayBayPath(path), true, path);
  for (const path of ['/plan?redirect=https://evil.test', '/plan?auto=1', '/plan?q=hello&auto=2', '/plan?q=hello&q=other', '/plan?import=other', '/plan?import=event&q=hello', '/plan#https://evil.test', '/plan/../tools', '/tools?tool=unknown', '/tools?tool=communication&next=evil', '/tools?tool=split&tool=budget', '/category/made-up', '//evil.test/plan', '/plan?q=' + 'a'.repeat(801)]) assert.equal(safeBayBayPath(path), false, path);
});

test('planning questions stay conversational until the user explicitly carries their requirements to the planner', async t => {
  const requests: unknown[] = [];
  mockBayBayFetch(t, async (...args: unknown[]) => { requests.push(args); return answer('普通问答'); });
  for (const question of ['周六带五岁孩子，从 Fremont 出发，预算 $50', '週六帶五歲孩子，從 Fremont 出發，預算 $50', 'Plan Saturday with my 5-year-old, starting from Fremont, with a $50 admission budget per person.']) {
    const paths: string[] = [];
    const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={path => paths.push(path)} onCreatePostClick={noop} />);
    fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: question } });
    fireEvent.click(view.getByRole('button', { name: '问一下' }));
    await view.findByText('普通问答');
    assert.equal(paths.length, 0);
    fireEvent.click(view.getByText('带着这些需求，继续做计划'));
    const handoff = view.getByText('带着这些需求，继续做计划').closest('details') as HTMLDetailsElement;
    handoff.open = true;
    fireEvent.click(view.getByRole('button', { name: '带入计划' }));
    assert.equal(paths.length, 1);
    const url = new URL(paths[0], 'https://www.baylink.us');
    assert.equal(url.pathname, '/plan');
    assert.equal(url.searchParams.has('q'), false);
    assert.equal(url.searchParams.has('auto'), false);
    assert.equal(readBayBayRequirementsDraft(url.searchParams.get('baybayBrief'))?.message, question);
    assert.ok(requests.length > 0);
    view.unmount();
  }
  for (const question of ['想了解图书馆如何预约', '周六预算 $50 找家庭清洁', 'Help me plan a job interview tomorrow', 'Plan weekend rental viewings', '房东约我周六谈租房预算']) assert.equal(isBayBayPlanRequest(question), false, question);
});

test('task handoff contains user facts only and preserves the latest correction within its size bound', () => {
  const brief = bayBayTaskBrief([{ id: 1, question: 'Fremont，周六开车，预算80', state: 'complete', response: { ok: true, answer: 'Invented hotel booking confirmed' } },
    { id: 2, question: '改成公共交通，预算40', state: 'complete', response: { ok: true, answer: 'Okay' } },
    { id: 3, question: '不要发送的失败输入', state: 'error' }]);
  assert.match(brief, /Fremont/); assert.match(brief, /最新补充：改成公共交通，预算40/); assert.ok(!brief.includes('Invented')); assert.ok(!brief.includes('失败'));
  const long = bayBayTaskBrief(Array.from({ length: 4 }, (_, id) => ({ id, question: String(id).repeat(500), state: 'complete' as const })));
  assert.ok(long.length <= 800); assert.ok(long.endsWith('3'.repeat(500)));
});

test('service search and posting flows keep their actions without sending repair needs to the outing planner', async t => {
  let payload: Record<string, unknown> = {};
  mockBayBayFetch(t, async () => Response.json({ ok: true, answer: '请确认具体维修需求。', ...payload }));
  for (const response of [
    { responseMode: 'search', matchingPosts: [], taskState: { version: 1, revision: 1, goal: 'discover' } },
    { suggestedActions: [{ label: '发布维修需求', type: 'postAssist', postType: 'client', category: 'repair' }] },
    { interactiveCards: [{ id: 'repair', type: 'checklist', title: '维修需求', items: [], actions: [{ label: '发布维修需求', type: 'postAssist', postType: 'client', category: 'repair' }] }] },
  ]) {
    payload = response;
    const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} pendingQuestion="周六预算 $150，帮我安排找水管师傅" />);
    await view.findByText('请确认具体维修需求。');
    assert.equal(view.baseElement.querySelector('.baybay-task-handoff'), null);
    if ('suggestedActions' in response || 'interactiveCards' in response) assert.ok(view.getByRole('button', { name: '发布维修需求' }));
    view.unmount();
  }
  payload = { responseMode: 'assistant', taskState: { version: 1, revision: 1, goal: 'transit' } };
  const transit = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} pendingQuestion="从 Fremont 坐公交去博物馆怎么换乘" />);
  await transit.findByText('请确认具体维修需求。');
  assert.ok(transit.baseElement.querySelector('.baybay-task-handoff'), 'Transit planning still offers an explicit planner handoff');
});

test('search mode stays top-level and only citation-backed web cards are actionable', async t => {
  let sent: Record<string, unknown> = {};
  mockBayBayFetch(t, async (_url: unknown, options: RequestInit) => { sent = JSON.parse(String(options.body)); return answer('站内答复'); });
  await fetchBayBayReply('周末去哪', { currentPath: '/', searchMode: 'site' }, [], new AbortController().signal);
  assert.equal(sent.searchMode, 'site'); assert.deepEqual(sent.context, { currentPath: '/' });
  assert.equal(bayBayWebResult({ ok: true, answer: 'fake', sources: [{ title: 'x', url: 'https://example.com' }] }), null);
  assert.equal(bayBayWebResult({ ok: true, answer: 'fake', retrieval: { requestedMode: 'web', scope: 'web', webStatus: 'completed' }, sources: [{ title: 'x', url: 'javascript:alert(1)' }] }), null);
  const result = bayBayWebResult({ ok: true, answer: 'source [1]', retrieval: { requestedMode: 'smart', scope: 'site+web', webStatus: 'completed' }, sources: [{ title: 'Official', url: 'https://example.com/visit' }],
    webCandidates: [{ id: 'x', name: 'Unsupported', city: null, summary: null, timeSummary: null, priceSummary: null, sourceUrls: ['https://different.example.com'] }] });
  assert.equal(result?.sources.length, 1); assert.equal(result?.candidates.length, 0);
});

test('four BayBay actions use focused destinations and service requests remain editable', () => {
  const paths: string[] = [];
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={path => paths.push(path)} onCreatePostClick={noop} />);
  fireEvent.click(view.getByRole('button', { name: /读活动截图/ }));
  fireEvent.click(view.getByRole('button', { name: /沟通帮手/ }));
  fireEvent.click(view.getByRole('button', { name: /找本地服务/ }));
  const input = view.getByRole('textbox', { name: '向 BayBay 提问' }) as HTMLInputElement;
  assert.equal(input.value, '我想找本地服务：');
  assert.equal(document.activeElement, input);
  assert.deepEqual(paths, ['/plan?import=event', '/tools?tool=communication']);
});

test('network and parsing errors show usable Chinese messages while explicit service guidance is preserved', () => {
  for (const error of [new TypeError('Failed to fetch'), new SyntaxError('Unexpected token < in JSON'), null]) {
    assert.equal(bayBayErrorMessage(error), '暂时连接不上 BayBay，请检查网络后重试。问题已保留。');
  }
  assert.equal(bayBayErrorMessage(new Error('提问过于频繁，请 60 秒后再试')), '提问过于频繁，请 60 秒后再试');
});

test('quick search finds exact guide titles and keyboard Enter opens the published route, preserving IME', () => {
  const opened: string[] = [];
  const searches: string[] = [];
  const view = render(<QuickExplore onClose={noop} onNavigate={path => opened.push(path)} onSearch={query => searches.push(query)} onAsk={noop} />);
  const input = view.getByRole('combobox', { name: '快速搜索' });
  const guide = guides.find(item => item.title.includes('免费')) || guides[0];
  fireEvent.change(input, { target: { value: guide.title } });
  assert.ok(view.getByRole('option', { selected: true }).textContent?.startsWith(guide.title));
  assert.equal(fireEvent.keyDown(input, { key: 'Enter', isComposing: true }), false);
  assert.equal(fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 }), false);
  assert.deepEqual(opened, []);
  fireEvent.submit(input.closest('form')!);
  assert.deepEqual(opened, [`/guides/${guide.slug}`]);
  assert.deepEqual(searches, []);
});

test('quick search searches summary text, supports arrows, and passes a query to BayBay', () => {
  const asked: (string | undefined)[] = [];
  const view = render(<QuickExplore onClose={noop} onNavigate={noop} onSearch={noop} onAsk={query => asked.push(query)} />);
  const input = view.getByRole('combobox', { name: '快速搜索' });
  fireEvent.change(input, { target: { value: guides[0].summary.slice(0, 12) } });
  assert.ok(view.getByRole('option', { selected: true }).textContent?.startsWith(guides[0].title));
  fireEvent.change(input, { target: { value: '不存在的问句xyz' } });
  assert.equal(view.getAllByRole('option').length, 2);
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  assert.equal(input.getAttribute('aria-activedescendant'), 'quick-result-1');
  fireEvent.submit(input.closest('form')!);
  assert.deepEqual(asked, ['不存在的问句xyz']);
});

test('the reader\'s own question stays exactly as typed in the Traditional edition (BBLIVE-14: no 台→臺 or 来→來 rewrite)', async t => {
  await setLocale('zh-Hant', false);
  mockBayBayFetch(t, async () => answer('好的。'));
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} />);
  const question = '台北来的朋友这个周末想去哪';
  fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提問' }), { target: { value: question } });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '問一下' })); });
  const bubble = view.baseElement.querySelector('.baybay-user-question p')!;
  assert.equal(bubble.getAttribute('translate'), 'no');
  assert.equal(bubble.textContent, question);
  assert.equal(view.baseElement.querySelector('.baybay-user-question span')!.textContent, '你', 'the speaker label still follows the edition');
});
