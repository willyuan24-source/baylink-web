import { mockBayBayFetch } from './baybay-test-transport';
import test, { afterEach, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { BayBayAnswerBody, BayBayCardRail, BayBayReadAloud } = await import('../src/features/baybay/BayBayAnswer');
const { BayBaySaveScope } = await import('../src/features/baybay/BayBaySaveScope');
const { parseBayBayAnswerFields, parseBayBayCapabilities, bayBayAnswerView, bayBayOrderCards, bayBayReadableText, bayBayResumeStyle, bayBayTextUnits } = await import('../src/lib/baybay-answer');
const { bayBayCardCitations, bayBayCardModels } = await import('../src/features/baybay/answer-cards');
const { bayBayPageRef } = await import('../src/features/baybay/panel-chips');
const { resetSaveStore, savesKey } = await import('../src/lib/saves');
const { setLocale } = await import('../src/i18n/locale');
// The image cards are their own chunk (loaded when the panel opens); load it before rendering restored answers.
await (await import('../src/features/baybay/cards-loader')).loadBayBayCards();
afterEach(async () => { cleanup(); localStorage.clear(); resetSaveStore(); await setLocale('zh-Hans', false); });
const noop = () => {};
const props = { variant: 'headless' as const, panelOpen: true, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop };
const TODAY = '2026-10-09';

/** C01 from the engine eval (eval/engine-1009-r3, v2 code defaults), as the API returns it. */
const site = (path: string) => `https://www.baylink.us${path}`;
const c01 = () => ({
  ok: true, responseMode: 'assistant', engine: 'v2', route: { path: 'fast', reason: 'site_answer' },
  lead: '周六10月10日，Santa Clara 图书馆的免费 Comic Con 最适合5岁孩子。',
  points: [
    { text: 'Santa Clara 图书馆 Comic Con：10月10日（周六）10:00–17:00，免费入场，有手作、角色装扮和动漫放映；官网建议免费 RSVP。[1]', cardIds: ['event:santa-clara-library-comic-con-2026'] },
    { text: 'Mountain View Oktoberfest：10月10日至11日每天11:00–19:00，入场免费，可逛场听音乐；餐饮另购。[2]', cardIds: ['event:mountain-view-oktoberfest-2026'] },
    { text: 'Apple 免费亲子课：iPad 做漫画，需预约，家长须陪同；不是每店每天都有场，要先查附近门店。[3]', cardIds: ['offer:apple-kids-earth-comics', 'not a key'] },
  ],
  answer: '周六10月10日，Santa Clara 图书馆的免费 Comic Con 最适合5岁孩子。\n\n1. Santa Clara 图书馆 Comic Con …[1]\n2. Mountain View Oktoberfest …[2]\n3. Apple 免费亲子课 …[3]',
  sources: [
    { title: 'Santa Clara 图书馆免费 Comic Con', url: site('/events/santa-clara-library-comic-con-2026') },
    { title: 'Mountain View Oktoberfest：免费入场的街区啤酒节', url: site('/events/mountain-view-oktoberfest-2026') },
    { title: '免费亲子课：用 iPad 做地球主题漫画', url: site('/offers/apple-kids-earth-comics') },
  ],
  evidence: [
    { id: 'e1', kind: 'event', title: 'Santa Clara 图书馆免费 Comic Con', url: site('/events/santa-clara-library-comic-con-2026') },
    { id: 'e2', kind: 'event', title: 'Mountain View Oktoberfest', url: site('/events/mountain-view-oktoberfest-2026') },
    { id: 'e3', kind: 'web', title: 'Apple 免费亲子课', url: site('/offers/apple-kids-earth-comics') },
  ],
  localMatches: [
    { kind: 'event', id: 'santa-clara-library-comic-con-2026', title: 'Santa Clara 图书馆免费 Comic Con', url: '/events/santa-clara-library-comic-con-2026', summary: '', date: '2026-10-10', temporalStatus: 'upcoming' },
    { kind: 'event', id: 'mountain-view-oktoberfest-2026', title: 'Mountain View Oktoberfest：免费入场的街区啤酒节', url: '/events/mountain-view-oktoberfest-2026', summary: '', date: '2026-10-10', temporalStatus: 'upcoming' },
    { kind: 'offer', id: 'apple-kids-earth-comics', title: '免费亲子课：用 iPad 做地球主题漫画', url: '/offers/apple-kids-earth-comics', summary: '' },
  ],
  followups: ['周日有什么免费的？', '下雨天南湾室内有什么？'],
  retrieval: { requestedMode: 'site', scope: 'site', webStatus: 'auth_required', webAccess: { authenticated: false, allowed: false, reason: 'auth_required' } },
  pageEntity: null,
});

async function ask(t: TestContext, reply: unknown, extra: Record<string, unknown> = {}) {
  const bodies: Record<string, unknown>[] = [];
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return Response.json(reply); });
  const paths: string[] = [];
  const view = render(<BayBayAssistantEntry {...props} onNavigate={path => paths.push(path)} {...extra} pendingQuestion="这周末想带5岁的孩子在南湾玩" pendingQuestionId={1} />);
  return { view, bodies, paths };
}

// UI9-BB (content arrangement 10-19): points now come before the cards, so the first answer screen reads the lead and
// the first points; the cards are the shared FeedCard (3:2, ♡ on the cover, no 加入这天计划: captain decision 16).
test('a v2 answer reads lead, then points with [n], then image cards, then follow-ups — within 250 字', async t => {
  const { view, paths } = await ask(t, c01());
  const lead = await view.findByText(/最适合5岁孩子/);
  const answer = lead.closest('[data-answer-layout="v2"]')!;
  assert.ok(answer, 'the v2 layout renders');
  const cards = answer.querySelector('.bb-cards')!, points = answer.querySelector('.bb-points')!;
  assert.ok(lead.compareDocumentPosition(points) & Node.DOCUMENT_POSITION_FOLLOWING, 'points come after the lead');
  assert.ok(points.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING, 'cards come after the points');
  const items = within(cards as HTMLElement).getAllByRole('listitem');
  assert.equal(items.length, 3);
  for (const item of items) assert.ok(item.querySelector('[data-cover]'), 'every card has a cover (photo or BAYLINK 信息卡)');
  for (const item of items) assert.ok(item.querySelector('[data-provenance]'), 'every cover carries its provenance badge');
  // Card ↔ point mapping: line 1 opens with the citation number of the card's own page on C's number plate, read as
  // "来源 1：" (not a bare [1]).
  assert.equal(items[0].querySelector('.bb-card__n')?.textContent, '1');
  assert.equal(items[2].querySelector('.bb-card__n')?.textContent, '3');
  assert.ok(items[0].querySelector('.bb-card__n.ui-plate'), 'the number plate class (UI9-C)');
  assert.equal(items[0].querySelector('.bb-card__n')?.getAttribute('aria-hidden'), 'true');
  assert.equal(items[0].querySelector('.bb-card__n + .sr-only')?.textContent, '来源 1：');
  assert.ok(within(items[0]).getByRole('link', { name: /^Santa Clara/ }));
  // Every card has the one ♡ (SAVES' useSave) and no 加入这天计划 (captain decision 16: it stays on the detail bar).
  assert.deepEqual(within(items[0]).getAllByRole('button').map(button => button.getAttribute('aria-label')), [`收藏：${(c01().localMatches[0] as { title: string }).title}`]);
  assert.deepEqual(within(items[2]).getAllByRole('button').map(button => button.getAttribute('aria-label')), ['收藏：免费亲子课：用 iPad 做地球主题漫画']);
  fireEvent.click(within(items[0]).getByRole('link', { name: /^Santa Clara/ }));
  assert.equal(paths.at(-1), '/events/santa-clara-library-comic-con-2026');
  // [1] in a point opens the event page inside the app.
  fireEvent.click(within(points as HTMLElement).getAllByRole('link', { name: '[1]' })[0]);
  assert.equal(paths.at(-1), '/events/santa-clara-library-comic-con-2026');
  const readable = [lead.textContent || '', ...within(points as HTMLElement).getAllByRole('listitem').map(item => item.textContent || '')].join('');
  assert.ok(bayBayTextUnits(readable, false) <= 250, `visible answer is ${bayBayTextUnits(readable, false)} 字`);
  // Two user-voice follow-ups; no login pitch in the reply; the guest line shows once.
  assert.equal(view.baseElement.querySelectorAll('.baybay-followups:not([role]) button').length, 2);
  assert.doesNotMatch(answer.textContent || '', /登录|回答时未登录/);
  assert.equal(view.getAllByText(/访客模式/).length, 1);
});

test('a v1 answer keeps the legacy text and still shows its cards after it', async t => {
  const reply = { ...c01(), lead: undefined, points: undefined, engine: undefined, answer: '这周末可以去 Santa Clara 图书馆的 Comic Con。[1]' };
  const { view } = await ask(t, reply);
  const text = await view.findByText(/这周末可以去/);
  assert.equal(view.baseElement.querySelector('[data-answer-layout="v2"]'), null);
  const cards = view.baseElement.querySelector('.bb-cards')!;
  assert.ok(text.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING, 'v1 text first, then the cards');
  assert.equal(cards.querySelectorAll('li').length, 3);
});

test('answer fields are validated: card keys, tel links, notices, page entity and capabilities', () => {
  const fields = parseBayBayAnswerFields({ ...c01(), safety: { kind: 'emergency', title: 'x', actions: [{ id: 'evil', label: 'Call', href: 'javascript:alert(1)' }] },
    notice: { kind: 'ai_spent', text: '$9.80 used' }, pageEntity: { kind: 'event', id: 'x y', title: 'Bad id' } });
  assert.equal(fields.lead, c01().lead);
  assert.deepEqual(fields.points?.[2].cardIds, ['offer:apple-kids-earth-comics'], 'a malformed card key is dropped');
  assert.equal(fields.safety, undefined, 'an emergency card without a tel:911 action is not rendered');
  assert.equal(fields.notice, undefined, 'unknown notice kinds (and any dollar text) never render');
  assert.equal(fields.pageEntity, undefined);
  assert.deepEqual(parseBayBayAnswerFields({ points: [{ text: 'orphan', cardIds: [] }] }), {}, 'points without a lead are not a v2 answer');
  const professional = parseBayBayAnswerFields({ safety: { kind: 'professional', topic: 'medicare', topics: ['medicare'],
    resources: [{ id: 'hicap', title: 'HICAP', url: 'https://aging.ca.gov/hicap', phone: '1-800-434-0222', href: 'tel:+18004340222' }, { id: 'bad', title: 'Bad', url: 'javascript:void 0' }],
    guides: [{ slug: 'bay-area-medicare-hicap-medi-cal-guide', title: 'Medicare', url: '/guides/bay-area-medicare-hicap-medi-cal-guide' }, { slug: 'invented', title: 'Invented', url: '/guides/invented' }] } }).safety;
  assert.equal(professional?.kind, 'professional');
  assert.deepEqual(professional?.kind === 'professional' && professional.resources.map(row => row.id), ['hicap']);
  assert.deepEqual(professional?.kind === 'professional' && professional.guides.map(row => row.slug), ['bay-area-medicare-hicap-medi-cal-guide']);
  const banner = { 'zh-Hans': '今日 AI 名额已满，以下为站内资料；明天会恢复。', 'zh-Hant': '今日 AI 名額已滿，以下為站內資料；明天會恢復。', en: "Today's AI answers are used up." };
  const paused = parseBayBayCapabilities({ engine: 'v2', pause: { reason: 'daily_budget', kind: 'ai_daily_budget', banner, resumesAt: '2026-10-10T07:00:00.000Z', actions: [{ id: 'call-911', label: '911', href: 'tel:911' }, { id: 'call-211', label: '211', href: 'tel:211' }] }, reduced: null });
  assert.equal(paused.pause?.resumesAt, '2026-10-10T07:00:00.000Z');
  assert.deepEqual(paused.pause?.actions.map(action => action.href), ['tel:911', 'tel:211']);
  assert.deepEqual(parseBayBayCapabilities({ pause: { kind: 'ai_paused', banner: { en: 'only one locale' } } }), { pause: null, reduced: null, scheduled: null });
});

test('the visible budget keeps the lead and the first point, and moves the rest behind 更多', () => {
  const long = '这是一条比较长的要点，用来测试回答版式在超过两百五十字时会把剩余要点收起来，而不是全部铺开在手机屏幕上。'.repeat(2);
  const view = bayBayAnswerView({ lead: '结论一句话。', points: [{ text: long, cardIds: [] }, { text: long, cardIds: [] }, { text: long, cardIds: [] }, { text: '短的第四条。', cardIds: [] }], gap: '还需确认营业时间。' }, false)!;
  assert.equal(view.visible.length, 2);
  assert.equal(view.more.length, 2, 'a later short point stays in order behind 更多');
  assert.ok(view.visibleUnits <= 250);
  assert.equal(bayBayTextUnits('Fleet Week 蓝天使[1] 10:00 起', false), 4 + 3, 'citations do not count; a Latin word counts once');
  assert.equal(bayBayTextUnits('Blue Angels fly at 3 pm [2].', true), 6);
});

test('a first point over the budget is cut at its last sentence end that fits, and the rest continues behind 更多', () => {
  const sentence = '这是一句用来测试长要点的句子，大约有三十个字左右的长度。';
  const long = `${sentence.repeat(10)}[1]`;
  const view = bayBayAnswerView({ lead: '结论一句话。', points: [{ text: long, cardIds: ['event:x'] }, { text: '第二条。[2]', cardIds: [] }] }, false)!;
  assert.ok(bayBayTextUnits(long, false) + 5 > 250, 'the point alone breaks the budget');
  assert.ok(view.visibleUnits <= 250, `visible ${view.visibleUnits} 字 stays within 250`);
  assert.equal(view.visible.length, 1);
  assert.ok(view.visible[0].text.endsWith('。[1]'), 'the shown part ends at a sentence end and keeps the point’s citation');
  assert.deepEqual(view.visible[0].cardIds, ['event:x']);
  assert.equal(view.more[0].continued, true);
  assert.equal(bayBayReadableText(view.visible[0].text) + bayBayReadableText(view.more[0].text), bayBayReadableText(long), 'nothing is lost');
  assert.equal(view.more[1].text, '第二条。[2]');
  const en = bayBayAnswerView({ lead: 'Yes.', points: [{ text: `${'This sentence has exactly eight words in it. '.repeat(16).trim()} [3]`, cardIds: [] }] }, true)!;
  assert.ok(en.visibleUnits <= 120 && en.visible[0].text.endsWith('it. [3]') && en.more[0].continued);
  const usa = bayBayAnswerView({ lead: 'Yes.', points: [{ text: `${'This sentence has exactly eight words in it. '.repeat(14)}Then the U.S. Navy Blue Angels fly over the bay. [3]`, cardIds: [] }] }, true)!;
  assert.ok(usa.visible[0].text.endsWith('in it. [3]'), 'never cut after an abbreviation such as U.S.');
  assert.ok(usa.more[0].text.startsWith('Then the U.S. Navy'));
  // A single sentence longer than the budget cannot be cut honestly, so it shows whole.
  const one = bayBayAnswerView({ lead: '结论。', points: [{ text: `${'很长'.repeat(140)}。`, cardIds: [] }] }, false)!;
  assert.equal(one.visible.length, 1);
  assert.equal(one.more.length, 0);
});

test('card covers follow the honesty ladder and each card cites its own page', () => {
  const models = bayBayCardModels(c01().localMatches as never, TODAY);
  assert.deepEqual(models.map(model => model.key), ['event:santa-clara-library-comic-con-2026', 'event:mountain-view-oktoberfest-2026', 'offer:apple-kids-earth-comics']);
  for (const model of models) if (model.cover.tier === 'type') assert.notEqual(model.cover.reason, 'duplicate');
  assert.ok(models.every(model => model.cover.tier !== 'official' || model.cover.label.zh === '官方图'));
  const citations = bayBayCardCitations(models, c01().sources.map((source, index) => ({ ...source, number: index + 1 })));
  assert.deepEqual([...citations.values()], [1, 2, 3]);
  assert.equal(bayBayCardModels([{ kind: 'event', id: 'not-a-real-event', title: 'x', url: '/events/not-a-real-event', summary: '' }], TODAY).length, 0, 'unknown listings are skipped, never invented');
});

test('♡ 收藏 saves an event in the one save model for a guest in this browser; ended events offer reference only', async () => {
  const card = c01().localMatches[0];
  const paths: string[] = [];
  const view = render(<BayBaySaveScope><BayBayCardRail cards={[card as never]} today={TODAY} onNavigate={path => paths.push(path)} /></BayBaySaveScope>);
  const save = await view.findByRole('button', { name: /^收藏：/ });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  // The same ♡ and names as every card on the site (SaveHeart / SaveControl), on the cover; the event page's 我想去 is a
  // different store.
  assert.ok(save.classList.contains('ui-save'), 'F\'s ♡ on the cover');
  assert.equal(save.textContent, '');
  assert.equal(save.getAttribute('aria-pressed'), 'false');
  assert.doesNotMatch(view.baseElement.textContent || '', /想去/);
  fireEvent.click(view.getByRole('button', { name: /^收藏：/ }));
  const saved = await view.findByRole('button', { name: /^已收藏：/ });
  assert.ok(saved.querySelector('svg'), 'the heart, filled by aria-pressed');
  assert.equal(saved.getAttribute('aria-pressed'), 'true');
  // A guest's saves live in the guest list of the one save model (src/lib/saves.ts), which My Week reads.
  assert.match(localStorage.getItem(savesKey()) || '', /santa-clara-library-comic-con-2026/);
  view.rerender(<BayBaySaveScope><BayBayCardRail cards={[{ ...card, date: undefined, temporalStatus: 'past' } as never]} today={TODAY} onNavigate={path => paths.push(path)} /></BayBaySaveScope>);
  assert.ok(view.getByText('已结束 · 仅供参考'));
  assert.equal(view.queryByRole('button', { name: /加入(这天)?计划/ }), null);
  fireEvent.click(view.getByRole('link', { name: /Santa Clara/ }));
  assert.deepEqual(paths, ['/events/santa-clara-library-comic-con-2026']);
});

test('on an event page the capsule names the page, page chips ask about it, and ✕ stops sending the page', async t => {
  const bodies: Record<string, unknown>[] = [];
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return Response.json({ ok: true, answer: bodies.length > 1 ? `第 ${bodies.length} 条回答` : '适合，但人多，建议早到。', followups: ['附近怎么停车？'] }); });
  assert.deepEqual(bayBayPageRef('/en/events/san-francisco-fleet-week-2026?date=2026-10-11'), { kind: 'event', id: 'san-francisco-fleet-week-2026' });
  const view = render(<BayBayAssistantEntry {...props} currentPath="/events/san-francisco-fleet-week-2026" />);
  assert.match(view.baseElement.querySelector('.bb-capsule')?.textContent || '', /正在看：.*Fleet Week/);
  assert.equal(view.queryByText('直接打字，或点一个问题。'), null, 'the capsule and page chips invite the question; the welcome line steps aside');
  const chips = view.getByRole('list', { name: '围绕这一页提问' });
  assert.equal(within(chips).getAllByRole('button').length, 3);
  fireEvent.click(within(chips).getByRole('button', { name: /适合带长辈和孩子/ }));
  await view.findByText('适合，但人多，建议早到。');
  assert.deepEqual(bodies[0].context, { currentPath: '/events/san-francisco-fleet-week-2026' });
  assert.ok(view.getByRole('button', { name: '不再参考这一页' }).classList.contains('ui-close'), 'the capsule ✕ is the shared close (N12)');
  fireEvent.click(view.getByRole('button', { name: '不再参考这一页' }));
  assert.equal(view.baseElement.querySelector('.bb-capsule'), null);
  // A 接着聊 chip under the answer asked on this page no longer carries the page either.
  fireEvent.click(view.getByRole('button', { name: /附近怎么停车/ }));
  await view.findByText('第 2 条回答');
  assert.deepEqual(bodies[1].context, { currentPath: '/' });
  fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: '附近还有什么？' } });
  fireEvent.click(view.getByRole('button', { name: '问一下' }));
  await view.findByText('第 3 条回答');
  assert.deepEqual(bodies[2].context, { currentPath: '/' });
});

test('starter chips ask, prefill or open the right tool, in each language', async t => {
  const bodies: Record<string, unknown>[] = [];
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return Response.json({ ok: true, answer: 'OK' }); });
  for (const [locale, weekend, letter, screenshot, draft] of [['zh-Hans', '本周末去哪', '帮我看懂英文信', '读活动截图', '帮我看看这封英文信说了什么：'], ['en', 'This weekend', 'Explain an English letter', 'Read an event screenshot', 'Help me understand this letter: ']] as const) {
    await setLocale(locale, false);
    const paths: string[] = [];
    const view = render(<BayBayAssistantEntry {...props} onNavigate={path => paths.push(path)} />);
    assert.equal(within(view.getByRole('list', { name: locale === 'en' ? 'Popular questions' : '常用问题' })).getAllByRole('button').length, 2, 'two cards; the other starters are chips under 也可以');
    assert.equal(within(view.getByRole('list', { name: locale === 'en' ? 'You can also' : '也可以' })).getAllByRole('button').length, 8);
    fireEvent.click(view.getByRole('button', { name: new RegExp(`^${letter}`) }));
    assert.equal((view.getByRole('textbox') as HTMLInputElement).value, draft, 'a draft starter waits for the reader');
    fireEvent.click(view.getByRole('button', { name: new RegExp(`^${screenshot}`) }));
    assert.deepEqual(paths, ['/plan?import=event']);
    fireEvent.change(view.getByRole('textbox'), { target: { value: '' } });
    fireEvent.click(view.getByRole('button', { name: new RegExp(`^${weekend}`) }));
    await view.findByText('OK');
    assert.match(String(bodies.at(-1)?.message), locale === 'en' ? /this weekend/ : /这个周末/);
    cleanup();
  }
});

// H37 (BB-1013-07): the daily share used up is a calm line, not an alarm — no red 911 / 211 above it, the site's own
// pages instead. A provider pause (nothing can be asked) still leads with 911 · 211.
test('a used-up daily share shows a calm banner with the site\'s pages; a provider pause leads with 911 and 211; never a dollar amount', async t => {
  const actions = [{ id: 'call-911', label: '911', href: 'tel:911' }, { id: 'call-211', label: '211', href: 'tel:211' }];
  const daily = { 'zh-Hans': '今日 AI 名额已满，以下为站内资料；明天会恢复。', 'zh-Hant': '今日 AI 名額已滿，以下為站內資料；明天會恢復。', en: "Today's AI answers are used up. Here is information from the site; BayBay is back tomorrow." };
  const paused = { 'zh-Hans': 'AI 助手暂停，以下为站内资料。', 'zh-Hant': 'AI 助手暫停，以下為站內資料。', en: 'The AI assistant is paused. Here is information from the site.' };
  let pause: Record<string, unknown> = {};
  mockBayBayFetch(t, async () => Response.json({ ok: true, answer: 'unused' }));
  const realFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', ((input: unknown, init?: RequestInit) => String(input).endsWith('/ai/baybay-capabilities')
    ? Promise.resolve(Response.json({ engine: 'v2', enabled: false, pause, reduced: null }))
    : realFetch(input as RequestInfo, init)) as typeof fetch);
  for (const locale of ['zh-Hans', 'en'] as const) {
    await setLocale(locale, false);
    // The api sends its 911 / 211 actions with every pause; a daily-share pause shows none of them.
    pause = { reason: 'daily_budget', kind: 'ai_daily_budget', banner: daily, resumesAt: '2026-10-10T07:00:00.000Z', actions };
    const paths: string[] = [];
    let view = render(<BayBayAssistantEntry {...props} onNavigate={path => paths.push(path)} />);
    let notice = await view.findByText(new RegExp(locale === 'en' ? "Today's AI answers are used up" : '今日 AI 名额已满'));
    let box = notice.closest('[data-notice]')! as HTMLElement;
    assert.deepEqual(within(box).queryAllByRole('link'), [], 'no call buttons for a used-up daily share');
    // The banner already says it is back tomorrow, so the time follows once, without a second "恢复".
    assert.match(notice.textContent || '', locale === 'en' ? /back tomorrow\. That is Oct 10, 12:00 AM \(Bay Area time\)\.$/ : /明天会恢复。即 10 月 10 日 0:00（湾区时间）$/);
    assert.equal((box.textContent || '').match(/恢复|back/gi)?.length, 1);
    assert.doesNotMatch(box.textContent || '', /\$/);
    within(box).getByRole('button', { name: locale === 'en' ? 'This weekend’s events' : '看本周末活动' }).click();
    within(box).getByRole('button', { name: locale === 'en' ? 'Browse guides' : '查办事指南' }).click();
    assert.deepEqual(paths, ['/events', '/guides']);
    cleanup();
    pause = { reason: 'provider_unavailable', kind: 'ai_paused', banner: paused, actions };
    view = render(<BayBayAssistantEntry {...props} />);
    notice = await view.findByText(new RegExp(locale === 'en' ? 'The AI assistant is paused' : 'AI 助手暂停'));
    box = notice.closest('[data-notice]')! as HTMLElement;
    const calls = within(box).getAllByRole('link');
    assert.deepEqual(calls.map(link => link.getAttribute('href')), ['tel:911', 'tel:211']);
    assert.ok(calls[0].compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING, '911 comes before the text');
    assert.equal(within(box).queryByRole('button'), null, 'a provider pause has no site buttons');
    cleanup();
  }
});

test('while paused, 911 · 211 show once: at the top until an answer carries the notice, then on the newest answer only', async t => {
  const banner = { 'zh-Hans': 'AI 助手暂停，以下为站内资料。', 'zh-Hant': 'AI 助手暫停，以下為站內資料。', en: 'The AI assistant is paused. Here is information from the site.' };
  const actions = [{ id: 'call-911', label: '911', href: 'tel:911' }, { id: 'call-211', label: '211', href: 'tel:211' }];
  let count = 0;
  mockBayBayFetch(t, async () => Response.json({ ok: true, degraded: true, answer: `站内资料第 ${++count} 条`, notice: { kind: 'ai_paused', text: banner['zh-Hans'] } }));
  const realFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', ((input: unknown, init?: RequestInit) => String(input).endsWith('/ai/baybay-capabilities')
    ? Promise.resolve(Response.json({ engine: 'v2', enabled: false, pause: { reason: 'provider_unavailable', kind: 'ai_paused', banner, actions }, reduced: null }))
    : realFetch(input as RequestInfo, init)) as typeof fetch);
  const view = render(<BayBayAssistantEntry {...props} />);
  await view.findByText(/AI 助手暂停/);
  const calls = () => view.baseElement.querySelectorAll('a[href="tel:911"]');
  assert.equal(calls().length, 1, 'the top banner before any answer');
  for (const question of ['周末去哪', '下雨天去哪']) {
    fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: question } });
    fireEvent.click(view.getByRole('button', { name: '问一下' }));
    await view.findByText(`站内资料第 ${count} 条`);
    assert.equal(calls().length, 1, `one 911 button with ${count} answer(s)`);
  }
  const [first, second] = view.baseElement.querySelectorAll('.baybay-turn');
  assert.ok(second.querySelector('.bb-notice a[href="tel:911"]'), 'the newest answer carries the full banner');
  assert.equal(first.querySelector('.bb-notice-label')?.textContent, banner['zh-Hans'], 'an earlier answer keeps its line only');
  assert.equal(first.querySelector('a[href^="tel:"]'), null);
});

test('the answer stylesheet uses tokens and rem only, and every control is at least 44px', () => {
  const css = readFileSync('src/features/baybay/baybay-answer.css', 'utf8');
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, 'no hex colours outside tokens.css');
  assert.doesNotMatch(css, /font-size:\s*\d+px/, 'no px text sizes');
  assert.match(css, /\.bb-emergency__call \{[^}]*min-height:3\.5rem/, 'the 911 button is 56px');
  assert.match(css, /html\[data-simple\] \.baybay-conversation :is\(\.bb-points>li,\.bb-gap\) \{ font-size:var\(--text-reading\)/, '简洁显示 sets points to the 20px reading size');
  // Answers read at 17px (20 in 简洁显示), never smaller than the legacy answer text — and the 911 instructions likewise.
  assert.match(css, /\.bb-points>li \{[^}]*font-size:var\(--text-reading\)/, 'points use the 17px reading size');
  assert.match(css, /\.bb-emergency__text \{[^}]*font-size:var\(--text-reading\)/, 'the 911 instructions use the reading size');
  assert.match(css, /\.bb-reference li>a \{[^}]*min-height:var\(--control-height\)/, 'source links are full-size targets (44px, 48 in 简洁显示)');
  assert.match(css, /:is\(\.bb-call__number,\.bb-phone-number\) \{ white-space:nowrap; \}/, 'a phone number stays on one line, in a call button or in the text of the 911 card');
});

test('the resume time is said once: none when the banner has a time, "即 …" after its own 恢复, else a sentence', () => {
  assert.equal(bayBayResumeStyle('今日 AI 名额已满，以下为站内资料；明天会恢复。'), 'time');
  assert.equal(bayBayResumeStyle('今日 AI 名額已滿，以下為站內資料；明天會恢復。'), 'time');
  assert.equal(bayBayResumeStyle("Today's AI answers are used up. BayBay is back tomorrow."), 'time');
  assert.equal(bayBayResumeStyle('BayBay 暂停服务，10 月 10 日 0:00 恢复。'), 'none');
  assert.equal(bayBayResumeStyle('BayBay is paused until Oct 10, 9 am.'), 'none');
  assert.equal(bayBayResumeStyle('BayBay 暂时只用站内资料回答。'), 'sentence');
});

test('the card rail follows the points that name each card (card for point 1 first), then the server order', () => {
  const card = (kind: string, id: string) => ({ kind, id });
  // D-HANT-FREE-KIDS from the engine eval: the server listed an ongoing offer first, while point 1 cites a storytime.
  const server = [card('offer', 'presidio-field-station-free'), card('event', 'stanford-art-for-all-oct-2026'), card('event', 'burlingame-mandarin-storytime-2026'), card('event', 'napa-musictime-halloween-2026'), card('offer', 'randall-museum-free'), card('guide', 'unnamed')];
  const points = [{ cardIds: ['event:burlingame-mandarin-storytime-2026'] }, { cardIds: ['event:napa-musictime-halloween-2026'] }, { cardIds: ['event:stanford-art-for-all-oct-2026', 'event:burlingame-mandarin-storytime-2026'] }, { cardIds: ['offer:presidio-field-station-free'] }, { cardIds: [] }];
  assert.deepEqual(bayBayOrderCards(server, points).map(item => item.id), ['burlingame-mandarin-storytime-2026', 'napa-musictime-halloween-2026', 'stanford-art-for-all-oct-2026', 'presidio-field-station-free', 'randall-museum-free', 'unnamed']);
  assert.deepEqual(bayBayOrderCards(server, [{ cardIds: [] }]), server, 'no cardIds keeps the server order');
});

test('a v2 answer renders its cards in point order', () => {
  const reply = c01();
  const fields = parseBayBayAnswerFields({ ...reply, points: [reply.points[1], reply.points[0], reply.points[2]] });
  const sources = reply.sources.map((source, index) => ({ ...source, number: index + 1 }));
  const view = render(<BayBayAnswerBody fields={fields} cards={reply.localMatches as never} sources={sources as never} today={TODAY} onNavigate={noop} />);
  const keys = [...view.baseElement.querySelectorAll('.bb-cards [data-card-key]')].map(item => item.getAttribute('data-card-key'));
  assert.deepEqual(keys, ['event:mountain-view-oktoberfest-2026', 'event:santa-clara-library-comic-con-2026', 'offer:apple-kids-earth-comics']);
});

test('朗读 on a second answer is not cancelled by the first one being interrupted, and unmounting stops only its own voice', async () => {
  class FakeUtterance { lang = ''; onend: (() => void) | null = null; onerror: (() => void) | null = null; text: string; constructor(text: string) { this.text = text; } }
  const synth = { current: null as FakeUtterance | null, cancelled: [] as string[],
    speak(utterance: FakeUtterance) { this.current = utterance; },
    // Like Chrome: cancelling reports an error on the interrupted utterance a moment later.
    cancel() { const interrupted = this.current; this.current = null; if (interrupted) { this.cancelled.push(interrupted.text); setTimeout(() => interrupted.onerror?.(), 0); } } };
  const win = window as unknown as Record<string, unknown>;
  Object.assign(win, { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance });
  try {
    const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    const both = (showA: boolean) => <>{showA && <BayBayReadAloud key="a" text="A" />}<BayBayReadAloud key="b" text="B" /></>;
    const view = render(both(true));
    const [a, b] = view.getAllByRole('button', { name: '朗读回答' });
    fireEvent.click(a);
    await flush();
    assert.equal(synth.current?.text, 'A');
    fireEvent.click(b);
    await flush();
    assert.equal(synth.current?.text, 'B', 'B keeps speaking after A reports its interruption');
    assert.deepEqual(synth.cancelled, ['A']);
    assert.equal(a.getAttribute('aria-pressed'), 'false');
    assert.equal(b.getAttribute('aria-pressed'), 'true');
    view.rerender(both(false));
    await flush();
    assert.equal(synth.current?.text, 'B', 'unmounting A does not stop B');
    view.unmount();
    assert.deepEqual(synth.cancelled, ['A', 'B'], 'unmounting B stops its own voice');
  } finally {
    delete win.speechSynthesis; delete win.SpeechSynthesisUtterance;
  }
});
