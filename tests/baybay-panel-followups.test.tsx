import { mockBayBayFetch } from './baybay-test-transport';
import test, { afterEach, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import React from 'react';

// WEB-BB-UI-2: the BayBay panel follow-ups of the 10-11 re-audit (G79, G27) and the api #37 contract.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { BayBayRequirements, BayBayAssistantPlanCard } = await import('../src/components/BayBayAssistantPlan');
const { BayBaySources } = await import('../src/components/BayBayDiscoveryResults');
const { BayBayCardRail } = await import('../src/features/baybay/BayBayAnswer');
const { BayBaySaveScope } = await import('../src/features/baybay/BayBaySaveScope');
const { bayBayDayLabel, bayBayDayRangeLabel, bayBayPlaceLabel, bayBayRegionLabel } = await import('../src/features/baybay/requirement-labels');
const { parseBayBayCapabilities, bayBayScheduledPauseBanner } = await import('../src/lib/baybay-answer');
const { parseBayBayAssistantFields } = await import('../src/lib/baybay-assistant');
const { bayBayCardModels } = await import('../src/features/baybay/answer-cards');
const { resetSaveStore, savesKey } = await import('../src/lib/saves');
const { setLocale, translateText } = await import('../src/i18n/locale');
const { guides } = await import('../src/data/guides');
const { setReadingSize, setSimpleDisplay } = await import('../src/lib/reading-preferences');
await (await import('../src/features/baybay/cards-loader')).loadBayBayCards();
afterEach(async () => { cleanup(); localStorage.clear(); resetSaveStore(); await setLocale('zh-Hans', false); });
const noop = () => {};
const props = { variant: 'headless' as const, panelOpen: true, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop };
const site = (path: string) => `https://www.baylink.us${path}`;

/** The capabilities endpoint answers `capabilities`; every other call goes to the conversation handler. */
function mockWithCapabilities(t: TestContext, capabilities: unknown, handler: typeof fetch = async () => Response.json({ ok: true, answer: 'OK' })) {
  mockBayBayFetch(t, handler);
  const realFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', ((input: unknown, init?: RequestInit) => String(input).endsWith('/ai/baybay-capabilities')
    ? Promise.resolve(Response.json(capabilities)) : realFetch(input as RequestInfo, init)) as typeof fetch);
}

test('the requirement card names the region and the day in words, in three languages (BBL-12)', async () => {
  assert.equal(bayBayRegionLabel('east-bay', 'zh-Hans'), '东湾');
  assert.equal(bayBayRegionLabel('east-bay', 'zh-Hant'), '東灣');
  assert.equal(bayBayRegionLabel('south-bay', 'en'), 'South Bay');
  assert.equal(bayBayRegionLabel('mid-ocean', 'en'), null, 'an unknown slug never shows raw');
  // "城市不限": the API clears the city and sends region 'all' — named, not dropped (and never the raw 'all').
  assert.equal(bayBayRegionLabel('all', 'zh-Hans'), '湾区各地');
  assert.equal(bayBayRegionLabel('all', 'zh-Hant'), '灣區各地');
  assert.equal(bayBayRegionLabel('all', 'en'), 'Anywhere in the Bay Area');
  assert.equal(bayBayDayLabel('2026-10-17', 'zh-Hans'), '10/17 周六');
  assert.equal(bayBayDayLabel('2026-10-17', 'zh-Hant'), '10/17 週六');
  assert.equal(bayBayDayLabel('2026-10-17', 'en'), 'Sat 10/17');
  assert.equal(bayBayDayLabel('2026-02-30', 'en'), null);
  assert.equal(bayBayDayRangeLabel({ start: '2026-10-17', end: '2026-10-18' }, 'zh-Hans'), '10/17 周六 – 10/18 周日');
  assert.equal(bayBayDayRangeLabel({ start: '2026-10-18', end: '2026-10-17' }, 'zh-Hans'), null);
  assert.equal(bayBayPlaceLabel({ city: 'San Francisco', region: 'sf' }, 'zh-Hans'), '旧金山');
  assert.equal(bayBayPlaceLabel({ city: 'Fremont', region: 'east-bay' }, 'zh-Hans'), 'Fremont');

  // The state as the API sends it (BB-LIVE W1, 10-11): region slug, ISO day.
  const state = parseBayBayAssistantFields({ taskState: { version: 1, revision: 3, goal: 'day-plan', city: null, region: 'east-bay', date: '2026-10-17', travelMode: 'transit', childAges: [4], freeOnly: true } }).taskState!;
  const view = render(<BayBayRequirements state={state} disabled={false} onAsk={noop} />);
  assert.ok(view.getByRole('button', { name: '目的地 东湾' }));
  assert.ok(view.getByRole('button', { name: '日期 10/17 周六' }));
  assert.doesNotMatch(view.container.textContent || '', /east-bay|2026-10-17/);
  await act(async () => { await setLocale('en', false); });
  assert.ok(view.getByRole('button', { name: 'Destination East Bay' }));
  assert.ok(view.getByRole('button', { name: 'Date Sat 10/17' }));
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.ok(view.getByRole('button', { name: '目的地 東灣' }));
  assert.ok(view.getByRole('button', { name: '日期 10/17 週六' }));
  // "这周末" arrives as a range with no single date (W1 turn 1).
  await act(async () => { await setLocale('zh-Hans', false); });
  const weekend = parseBayBayAssistantFields({ taskState: { version: 1, revision: 1, goal: 'discover', region: 'east-bay', date: null, dateRange: { start: '2026-10-17', end: '2026-10-18' } } }).taskState!;
  view.rerender(<BayBayRequirements state={weekend} disabled={false} onAsk={noop} />);
  assert.ok(view.getByRole('button', { name: '日期 10/17 周六 – 10/18 周日' }));
  const unknown = parseBayBayAssistantFields({ taskState: { version: 1, revision: 1, region: 'mid-ocean', dateRange: { start: '2026-10-17', end: '2026-12-31' } } }).taskState!;
  view.rerender(<BayBayRequirements state={unknown} disabled={false} onAsk={noop} />);
  assert.doesNotMatch(view.container.textContent || '', /mid-ocean|2026-1/, 'an unknown region or a wild range is left out, never shown raw');
  const anywhere = parseBayBayAssistantFields({ taskState: { version: 1, revision: 2, goal: 'discover', city: null, region: 'all', date: '2026-10-17' } }).taskState!;
  view.rerender(<BayBayRequirements state={anywhere} disabled={false} onAsk={noop} />);
  assert.ok(view.getByRole('button', { name: '目的地 湾区各地' }));
  assert.doesNotMatch(view.container.textContent || '', /\ball\b/);
});

test('the plan card dates its plan in words and its notes call numbers with one tap', () => {
  const plan = parseBayBayAssistantFields({ evidence: [], assistantPlan: { id: 'p', title: '周六半天', date: '2026-10-17', status: 'needs_verification', budget: { unknownItems: [] }, checks: [], unknowns: [], stops: [
    { id: 'event:x', kind: 'event', title: '书法课', city: 'San Francisco', date: '2026-10-18', sourceIds: [], notes: ['10/1 起接受电话预约：415-355-2888'] }] } }).assistantPlan!;
  const view = render(<BayBayAssistantPlanCard plan={plan} evidence={[]} disabled={false} onAsk={noop} onNavigate={noop} />);
  assert.match(view.container.querySelector('header small')?.textContent || '', /^10\/17 周六$/);
  assert.match(view.container.textContent || '', /San Francisco · 10\/18 周日/);
  assert.equal(view.getByRole('link', { name: '拨打 415-355-2888' }).getAttribute('href'), 'tel:+14153552888');
});

const answer = (extra: Record<string, unknown> = {}) => ({
  ok: true, responseMode: 'assistant', engine: 'v2',
  lead: '可以先找免费的 HICAP 咨询。',
  points: [{ text: '建议先找免费 HICAP 咨询，电话 1-800-434-0222，核对 Medicare、Medi-Cal 和保费帮助项目。[1]', cardIds: [] }, { text: '申请和最新规则请看 DHCS 官方入口。[2]', cardIds: [] }],
  answer: '可以先找免费的 HICAP 咨询。电话 1-800-434-0222 [1]',
  sources: [{ title: 'Medicare 与 HICAP 指南', url: site('/guides/bay-area-medicare-hicap-medi-cal-guide') }, { title: 'DHCS Medi-Cal', url: 'https://www.dhcs.ca.gov/services/medi-cal' }],
  evidence: [
    { id: 'g', kind: 'guide', title: 'Medicare 与 HICAP 指南', url: site('/guides/bay-area-medicare-hicap-medi-cal-guide'), verification: 'site-record', checkedAt: '2026-09-29' },
    { id: 'd', kind: 'web', title: 'DHCS Medi-Cal', url: 'https://www.dhcs.ca.gov/services/medi-cal', verification: 'site-record', checkedAt: '2026-09-29' },
  ],
  suggestedGuides: [{ title: 'Medicare 与 HICAP 指南', slug: 'bay-area-medicare-hicap-medi-cal-guide', url: '/guides/bay-area-medicare-hicap-medi-cal-guide' }, { title: '长者服务', slug: 'bay-area-chinese-senior-services-referral-guide', url: '/guides/bay-area-chinese-senior-services-referral-guide' }],
  followups: ['HICAP 怎么预约？', '需要带什么材料？'],
  retrieval: { requestedMode: 'site', scope: 'site', webStatus: 'not_requested' },
  ...extra,
});

async function ask(t: TestContext, reply: unknown, status = 200) {
  mockBayBayFetch(t, async () => Response.json(reply, { status }));
  const paths: string[] = [];
  const view = render(<BayBayAssistantEntry {...props} onNavigate={path => paths.push(path)} pendingQuestion="我爸妈 67 岁刚拿绿卡，可以申请 Medi-Cal 吗？" pendingQuestionId={1} />);
  return { view, paths };
}

test('phone numbers in answers are tap-to-call, citations stay links, and one sources block replaces two (G27, BBL-09, BBL-14)', async t => {
  const { view } = await ask(t, answer());
  await view.findByText(/可以先找免费的 HICAP 咨询/);
  const points = view.baseElement.querySelector('.bb-points') as HTMLElement;
  const call = within(points).getByRole('link', { name: '拨打 1-800-434-0222' });
  assert.equal(call.getAttribute('href'), 'tel:+18004340222');
  assert.ok(within(points).getByRole('link', { name: '[1]' }), 'the citation is still a link next to the number');
  const turn = view.baseElement.querySelector('.member-baybay-answer')!;
  // One block: the retrieval line is its summary, the cited sources and the related guides sit inside it.
  assert.equal(turn.querySelectorAll('.bb-sources').length, 1);
  assert.equal(turn.querySelectorAll(':scope > .baybay-references, :scope > .baybay-discovery, :scope > .baybay-retrieval').length, 0);
  const block = within(turn as HTMLElement).getByRole('region', { name: '来源' });
  assert.match(block.querySelector('summary')?.textContent || '', /^来源 · 已检索站内资料 · 站内快照 2 条 · 相关攻略 1 篇$/, 'site-record evidence counts as a site snapshot; the cited guide is not repeated as related');
  assert.equal(block.querySelectorAll('.bb-sources__list > li').length, 2);
  assert.equal(block.querySelector('.baybay-references')?.closest('details'), block.querySelector('details'), 'the related guides are inside the one block');
  assert.doesNotMatch(turn.textContent || '', /未记录/);
});

test('related guides inside the sources block read in the reader’s language, with their own sources (translate="no" block)', async () => {
  const guide = guides.find(item => item.slug === 'bay-area-without-car-guide')!;
  const response = { ok: true, answer: 'x', responseMode: 'assistant', retrieval: { requestedMode: 'site', scope: 'site', webStatus: 'not_requested' },
    suggestedGuides: [{ title: guide.title, slug: guide.slug, url: `/guides/${guide.slug}` }] } as const;
  const rowOf = (view: ReturnType<typeof render>) => view.container.querySelector('.bb-reference button span:not(.bb-reference__mark)')?.textContent;
  const view = render(<BayBaySources response={response} />);
  assert.equal(rowOf(view), guide.title);
  await act(async () => { await setLocale('en', false); });
  assert.equal(rowOf(view), 'Bay Area life without a car: Plan BART, Caltrain, buses, rides, and groceries');
  const sourceNames = [...view.container.querySelectorAll('.bb-reference details a')].map(link => link.textContent);
  assert.ok(sourceNames.length > 0);
  assert.deepEqual(sourceNames, guide.sources.map(source => translateText(source.title, 'en')).slice(0, sourceNames.length), 'the guide’s own source names are translated too');
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.equal(rowOf(view), translateText(guide.title, 'zh-Hant'));
  assert.match(rowOf(view) || '', /^灣區沒有車怎麼生活/);
});

test('legacy answers, the 911 card text, English answers and safety cards link their numbers too', async t => {
  const { view } = await ask(t, { ok: true, answer: '可以拨打 Santa Clara 县长者热线 408-350-3200，或先打 211。' });
  await view.findByText(/长者热线/);
  const text = view.baseElement.querySelector('.member-baybay-answer-text') as HTMLElement;
  assert.deepEqual(within(text).getAllByRole('link').map(link => link.getAttribute('href')), ['tel:+14083503200', 'tel:211']);
  cleanup();
  await setLocale('en', false);
  const english = await ask(t, answer({ lead: 'Start with free HICAP counseling.', points: [{ text: 'Call HICAP at 1-800-434-0222 to compare plans. [1]', cardIds: [] }], answer: 'Call HICAP at 1-800-434-0222.' }));
  await english.view.findByText(/Start with free HICAP counseling/);
  assert.equal(english.view.getByRole('link', { name: 'Call 1-800-434-0222' }).getAttribute('href'), 'tel:+18004340222');
  assert.match(english.view.baseElement.querySelector('.bb-points')?.textContent || '', /^Call HICAP at/, 'English text is left as written');
  cleanup();
  await setLocale('zh-Hans', false);
  const emergency = await ask(t, { ok: true, responseMode: 'safety', answer: '请立即拨打 911。疑似中毒可联系 Poison Control：1-800-222-1222。',
    safety: { kind: 'emergency', topic: 'stroke', title: '现在就打 911', actions: [{ id: 'call-911', label: '拨打 911', href: 'tel:911', primary: true }], hideFollowups: true, hideFeedback: true } });
  const instructions = await emergency.view.findByText(/疑似中毒/, { selector: '.bb-emergency__text' });
  // Only the number the card has no button for becomes a chip: 911 is the big red button already, so no second 911.
  assert.deepEqual(within(instructions).getAllByRole('link').map(link => link.getAttribute('href')), ['tel:+18002221222']);
  assert.match(instructions.textContent || '', /^请立即拨打 911。疑似中毒/, 'the 911 in the text stays as plain words');
  cleanup();
  // When the card's own buttons already call every number in the instructions, the text stays plain (no second 911).
  const covered = await ask(t, { ok: true, responseMode: 'safety', answer: '请立即拨打 911。疑似中毒可联系 Poison Control：1-800-222-1222。',
    safety: { kind: 'emergency', topic: 'stroke', title: '现在就打 911', actions: [{ id: 'call-911', label: '拨打 911', href: 'tel:911', primary: true }, { id: 'call-poison-control', label: 'Poison Control 1-800-222-1222', href: 'tel:+18002221222' }], hideFollowups: true, hideFeedback: true } });
  const plain = await covered.view.findByText(/疑似中毒/, { selector: '.bb-emergency__text' });
  assert.equal(within(plain).queryAllByRole('link').length, 0);
  cleanup();
  const safetyCard = await ask(t, { ok: true, answer: '请注意安全。', interactiveCards: [{ id: 'c', type: 'safety', title: '求助', subtitle: '24 小时热线 988', items: [{ id: 'i', label: '家暴求助可拨打 1-800-799-7233' }] }] });
  await safetyCard.view.findByText(/家暴求助/);
  assert.ok(safetyCard.view.getByRole('link', { name: '拨打 1-800-799-7233' }));
});

test('the AI cutoff is announced calmly in its last 7 days, in three languages, from pauseScheduled or aiUntil (api #37)', async t => {
  const now = Date.parse('2026-10-25T19:00:00Z');
  const at = '2026-10-30T00:00:00.000Z';
  const banner = bayBayScheduledPauseBanner(at);
  assert.equal(banner['zh-Hans'], 'AI 助手预计 10月29日（周四）17:00 起暂停；之后仍可查看站内资料，紧急情况请直接拨打 911。');
  assert.equal(banner['zh-Hant'], 'AI 助手預計 10月29日（週四）17:00 起暫停；之後仍可查看站內資料，緊急情況請直接撥打 911。');
  assert.equal(banner.en, 'The AI assistant is scheduled to pause from Thu, Oct 29, 5:00 PM PT. Site information stays available; in an emergency, call 911.');
  const scheduled = { kind: 'ai_pause_scheduled', at, banner };
  assert.deepEqual(parseBayBayCapabilities({ engine: 'v2', pause: null, reduced: null, aiUntil: at, pauseScheduled: scheduled }, now).scheduled, { at, banner });
  assert.deepEqual(parseBayBayCapabilities({ aiUntil: at }, now).scheduled, { at, banner }, 'aiUntil alone gets the same wording');
  assert.equal(parseBayBayCapabilities({ aiUntil: at }, Date.parse('2026-10-20T00:00:00Z')).scheduled, null, 'more than 7 days ahead: nothing yet');
  assert.equal(parseBayBayCapabilities({ aiUntil: at }, Date.parse('2026-10-30T01:00:00Z')).scheduled, null, 'after the cutoff the pause banner speaks instead');
  assert.equal(parseBayBayCapabilities({ aiUntil: 'tomorrow' }, now).scheduled, null);
  const paused = parseBayBayCapabilities({ pause: { reason: 'provider_unavailable', kind: 'ai_paused', banner: { 'zh-Hans': 'AI 助手暂停，以下为站内资料。', 'zh-Hant': 'AI 助手暫停，以下為站內資料。', en: 'The AI assistant is paused.' } }, aiUntil: at, pauseScheduled: scheduled }, now);
  assert.equal(paused.scheduled, null, 'a pause says everything');

  // In the panel: the server's own banner (here 4 days ahead of the real clock), with 911 tap-to-call and no alarm.
  const soon = new Date(Date.now() + 4 * 86_400_000).toISOString();
  const live = { kind: 'ai_pause_scheduled', at: soon, banner: { 'zh-Hans': `AI 助手预计 ${soon} 起暂停；紧急情况请直接拨打 911。`, 'zh-Hant': `AI 助手預計 ${soon} 起暫停；緊急情況請直接撥打 911。`, en: `The AI assistant is scheduled to pause from ${soon}. In an emergency, call 911.` } };
  mockWithCapabilities(t, { engine: 'v2', pause: null, reduced: null, aiUntil: soon, pauseScheduled: live });
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    await setLocale(locale, false);
    const view = render(<BayBayAssistantEntry {...props} />);
    const note = await view.findByRole('note');
    assert.equal(note.getAttribute('data-notice'), 'ai_pause_scheduled');
    assert.equal(note.textContent, live.banner[locale]);
    assert.equal(within(note).getByRole('link').getAttribute('href'), 'tel:911');
    assert.equal(view.baseElement.querySelector('.bb-notice'), null, 'no pause banner and no 911 · 211 buttons yet');
    cleanup();
  }
});

test('quota refusals read in the reader’s language; a daily limit offers the site instead of a retry (api #37)', async t => {
  for (const locale of ['en', 'zh-Hant', 'zh-Hans'] as const) {
    await setLocale(locale, false);
    // An older server (or a request without locale) answers in Chinese; the code decides the wording.
    const { view, paths } = await ask(t, { ok: false, code: 'AI_DAILY_LIMIT', error: '今日 AI 额度已用完，请明天再试；仍可浏览站内资料。' }, 429);
    const alert = await view.findByRole('alert');
    assert.match(alert.textContent || '', { en: /^You have used today's AI answers\. Please try again tomorrow; site information is still available\.$/, 'zh-Hant': /^今日 AI 額度已用完，請明天再試/, 'zh-Hans': /^今日 AI 额度已用完，请明天再试；仍可浏览站内资料。$/ }[locale]);
    const box = alert.closest('.baybay-request-error') as HTMLElement;
    assert.equal(box.getAttribute('data-error-code'), 'AI_DAILY_LIMIT');
    assert.equal(within(box).queryByRole('button', { name: /重试|重試|Retry/ }), null, 'no retry that cannot work until tomorrow');
    fireEvent.click(within(box).getByRole('button', { name: locale === 'en' ? 'This weekend’s events' : /^看本[周週]末活[动動]$/ }));
    fireEvent.click(within(box).getByRole('button', { name: locale === 'en' ? 'Browse guides' : /^查[办辦]事指南$/ }));
    assert.deepEqual(paths, ['/events', '/guides']);
    cleanup();
  }
  await setLocale('en', false);
  const busy = await ask(t, { ok: false, code: 'AI_CONCURRENCY_LIMIT', error: 'BayBay 正忙，请稍后再试。' }, 429);
  assert.equal((await busy.view.findByRole('alert')).textContent, 'BayBay is busy. Please try again shortly.');
  assert.ok(busy.view.getByRole('button', { name: /Retry/ }), 'a busy BayBay can be asked again');
});

test('web lookups paused for the day: the question is asked again site only, and the box stays on 仅站内 (AI_WEB_BUDGET)', async t => {
  const modes: string[] = [];
  mockBayBayFetch(t, async (_url: unknown, init?: RequestInit) => {
    modes.push(JSON.parse(String(init?.body)).searchMode);
    return modes.length === 1 ? Response.json({ ok: false, code: 'AI_WEB_BUDGET', error: '今天 AI 用量较高，暂停联网查询；站内资料仍可使用。' }, { status: 429 })
      : Response.json({ ok: true, answer: '站内答复' });
  });
  localStorage.setItem('currentUser', JSON.stringify({ id: 'member', token: 'session-token' }));
  const view = render(<BayBayAssistantEntry {...props} ownerId="member" sessionKey="member" pendingQuestion="这周末有什么免费活动？" pendingQuestionId={2} />);
  const alert = await view.findByRole('alert');
  assert.match(alert.textContent || '', /^今天 AI 用量较高，暂停联网查询/);
  const box = alert.closest('.baybay-request-error') as HTMLElement;
  assert.ok(!within(box).queryByRole('button', { name: '重试这个问题' }), 'no retry that would hit the same pause');
  await act(async () => { fireEvent.click(within(box).getByRole('button', { name: '仅站内重试' })); });
  await view.findByText('站内答复');
  assert.deepEqual(modes, ['smart', 'site']);
  assert.equal(view.getByRole('button', { name: '仅站内', exact: true }).getAttribute('aria-pressed'), 'true', 'the next question stays site only');
  cleanup();
  await setLocale('en', false);
  modes.length = 0;
  const english = render(<BayBayAssistantEntry {...props} ownerId="member" sessionKey="member" pendingQuestion="Free events this weekend?" pendingQuestionId={3} />);
  assert.equal((await english.findByRole('alert')).textContent, 'Web lookups are paused for today because AI use is high. Site information is still available.');
  assert.ok(english.getByRole('button', { name: 'Retry with site only' }));
});

test('offer, opening and guide cards save with the same ♡ as event cards, through the one save model', async () => {
  const cards = [
    { kind: 'offer' as const, id: 'sfmoma-family-oct25', title: 'SFMOMA 家庭日', url: '/offers/sfmoma-family-oct25', summary: '' },
    { kind: 'opening' as const, id: 'yutori-palo-alto-restaurant', title: 'Yutori Palo Alto', url: '/openings/yutori-palo-alto-restaurant', summary: '' },
    { kind: 'guide' as const, id: 'bay-area-medicare-hicap-medi-cal-guide', title: 'Medicare 与 HICAP 指南', url: '/guides/bay-area-medicare-hicap-medi-cal-guide', summary: '' },
  ];
  assert.deepEqual(bayBayCardModels(cards, '2026-10-12').map(model => model.kind), ['offer', 'opening', 'guide'], 'the listings exist');
  const view = render(<BayBaySaveScope><BayBayCardRail cards={cards} today="2026-10-12" onNavigate={noop} /></BayBaySaveScope>);
  const rail = await view.findByRole('list', { name: '相关活动与去处' });
  for (const card of cards) {
    const item = rail.querySelector(`[data-card-key="${card.kind}:${card.id}"]`) as HTMLElement;
    assert.ok(item.querySelector('[data-cover]'), 'the card has its cover from getCover');
    const heart = within(item).getByRole('button', { name: `收藏：${card.title}` });
    assert.equal(heart.getAttribute('aria-pressed'), 'false');
    assert.equal(within(item).queryByRole('button', { name: /加入行程/ }), null, 'only events go into a day plan');
    fireEvent.click(heart);
    assert.equal((await within(item).findByRole('button', { name: `已收藏：${card.title}` })).getAttribute('aria-pressed'), 'true');
  }
  const stored = localStorage.getItem(savesKey()) || '';
  for (const key of ['offer', 'opening', 'guide']) assert.match(stored, new RegExp(`"kind":"${key}"`), `${key} saved in the guest list My Week reads`);
});

test('the question box is a textarea that grows and keeps its whole example; Enter asks, Shift+Enter starts a line', async t => {
  const requests: string[] = [];
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => { requests.push(JSON.parse(String(init.body)).message); return Response.json({ ok: true, answer: 'OK' }); });
  const view = render(<BayBayAssistantEntry {...props} />);
  const field = view.getByRole('textbox', { name: '向 BayBay 提问' }) as HTMLTextAreaElement;
  assert.equal(field.tagName, 'TEXTAREA');
  assert.equal(field.getAttribute('rows'), '1');
  assert.equal(field.placeholder, '例如：周末带 6 岁孩子，东湾有什么免费去处？', 'the whole example, never shortened');
  fireEvent.change(field, { target: { value: '第一行' } });
  fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
  assert.equal(requests.length, 0, 'Shift+Enter is a new line');
  fireEvent.keyDown(field, { key: 'Enter' });
  await view.findByText('OK');
  assert.deepEqual(requests, ['第一行']);
  const css = readFileSync('src/features/baybay-conversation.css', 'utf8');
  assert.match(css, /textarea\.member-baybay-question-input \{[^}]*resize:none/);
  assert.doesNotMatch(css, /\.baybay-composer-footer input::placeholder/, 'the 12px placeholder rule of the old input is gone');
});

test('the empty question box fits its example again when Aa or 简洁显示 changes the text size with the panel open', async t => {
  mockBayBayFetch(t, async () => Response.json({ ok: true, answer: 'OK' }));
  t.after(() => { setReadingSize('standard'); setSimpleDisplay(false); });
  const view = render(<BayBayAssistantEntry {...props} />);
  const field = view.getByRole('textbox', { name: '向 BayBay 提问' }) as HTMLTextAreaElement;
  // jsdom has no layout: the example's height follows the text size the way a browser's would.
  const root = document.documentElement, style = window.getComputedStyle(field);
  const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth), px = (content: number) => `${content + border}px`;
  Object.defineProperty(field, 'scrollHeight', { configurable: true, get: () => (root.dataset.reading === 'extra-large' ? 96 : 48) + (root.hasAttribute('data-simple') ? 24 : 0) });
  await act(async () => { setReadingSize('extra-large'); });
  assert.equal(field.value, '', 'the box is still empty');
  assert.equal(field.style.height, px(96), '特大: as tall as its whole example, with no keystroke');
  await act(async () => { setSimpleDisplay(true); });
  assert.equal(field.style.height, px(120), '简洁显示 too');
  await act(async () => { setReadingSize('standard'); setSimpleDisplay(false); });
  assert.equal(field.style.height, px(48));
});

test('desktop opens a 440px drawer on the right with the page in view and no scrim (FC3-08)', () => {
  const css = readFileSync('src/features/baybay-conversation.css', 'utf8');
  const desktop = /@media\(min-width:1024px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] || '';
  assert.match(desktop, /\.member-baybay-overlay \{[^}]*justify-content:flex-end[^}]*background:transparent; backdrop-filter:none;/);
  assert.match(desktop, /\.member-baybay-dialog\.baybay-conversation \{[^}]*width:440px[^}]*height:100%[^}]*border-radius:0/);
  const answerCss = readFileSync('src/features/baybay/baybay-answer.css', 'utf8');
  assert.match(answerCss, /\.baybay-conversation \.phone-chip \{ min-width:0; min-height:0; font-size:inherit; \}/, 'chips sit in the text at its size');
  assert.doesNotMatch(answerCss, /#[0-9a-f]{3,8}\b/i);
  // The requirement chips and their editor are §3.0 rule-5 tap targets: 44px, 48px in 简洁显示 (the token's own values).
  assert.match(css, /\.baybay-requirement-chips button \{[^}]*min-height:var\(--control-height\)/);
  assert.match(css, /\.baybay-requirement-editor button,\.baybay-plan-followups button \{[^}]*min-height:var\(--control-height\)/);
  assert.match(css, /\.baybay-requirement-editor input \{[^}]*min-height:var\(--control-height\)/);
});

test('a sources block with nothing to fold shows its line only, and visible notices stay outside the fold', () => {
  const view = render(<BayBaySources response={{ ok: true, answer: 'x', responseMode: 'assistant', retrieval: { requestedMode: 'web', scope: 'site', webStatus: 'unavailable' } }} />);
  assert.equal(view.container.querySelector('details'), null);
  assert.match(view.container.querySelector('.bb-sources__note')?.textContent || '', /本次联网未成功/);
  assert.match(view.container.querySelector('.bb-sources__line')?.textContent || '', /已检索站内资料/);
});
