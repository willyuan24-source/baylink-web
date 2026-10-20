import { mockBayBayFetch } from './baybay-test-transport';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import React from 'react';

// WEB-BB-PLAN: the plan card reads the stop fields api-bb-7 (#56) sends (path, external, openingWindows) and names
// the plan in the reader's language; guide cards take their type from the guide's own category (api-bb-8 handoff).
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, fireEvent, cleanup, act, within, waitFor } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { BayBayAssistantPlanCard } = await import('../src/components/BayBayAssistantPlan');
const { BayBayCardRailView } = await import('../src/features/baybay/BayBayCards');
const { BayBaySaveScope } = await import('../src/features/baybay/BayBaySaveScope');
const { parseBayBayAssistantFields } = await import('../src/lib/baybay-assistant');
const { bayBayClock, bayBayOpeningWindowsLabel, bayBayPlanTitle, spaceMixedScript } = await import('../src/features/baybay/requirement-labels');
const { PLANNER_EVENTS, PLANNER_PLACES } = await import('../src/data/planner-catalog');
const { guides, GUIDE_CATEGORY_TABS } = await import('../src/data/guides');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); localStorage.clear(); await setLocale('zh-Hans', false); });
const noop = () => {};

/** The api's own result for L07 (周六想带爸妈在旧金山玩半天，坐公交，帮我排个行程) from the 10-17 live check: api payload unchanged, _source/question/locale metadata added. */
const live = JSON.parse(readFileSync(new URL('./support/baybay-l07-plan.json', import.meta.url), 'utf8'));
const MARKET = '/events/ferry-plaza-farmers-market-2026-autumn', FERRY = 'https://www.ferrybuildingmarketplace.com/visit/', CHINATOWN = '/guides/sf-chinatown-north-beach-walk-guide';
type Stop = Record<string, unknown>;
const withStop = (patch: Stop) => {
  const payload = structuredClone(live);
  payload.assistantPlan.stops = [{ ...payload.assistantPlan.stops[0], ...patch }];
  return parseBayBayAssistantFields(payload).assistantPlan?.stops[0];
};
const stopItems = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('.baybay-plan-stops > li')];
const timeOf = (item: HTMLElement) => item.querySelector('dd')!.textContent || '';

test('the live L07 stops keep their own page, record hours and suggested stay', () => {
  const plan = parseBayBayAssistantFields(live).assistantPlan!;
  assert.deepEqual(plan.stops.map(stop => stop.link), [{ href: MARKET, external: false, official: false }, { href: FERRY, external: true, official: true }, { href: CHINATOWN, external: false, official: false }]);
  assert.deepEqual(plan.stops.map(stop => stop.openingWindows), [[{ open: '08:00', close: '14:00' }], undefined, undefined]);
  assert.deepEqual(plan.stops.map(stop => stop.suggestedDurationMinutes), [60, 60, 60]);
  // Model and catalog text that the card never shows still does not cross the boundary.
  assert.equal(Object.hasOwn(plan.stops[0], 'sourceUrls'), false);
  assert.equal(Object.hasOwn(plan.stops[0], 'path'), false);
});

test('stop links: the URL decides in-app or external, and unsafe, unlisted or missing pages are dropped', () => {
  const event = PLANNER_EVENTS[0].id, guide = guides[0].slug, opening = PLANNER_PLACES.find(place => place.path?.startsWith('/openings/'))!.path!;
  assert.deepEqual(withStop({ path: `/events/${event}`, external: true })?.link, { href: `/events/${event}`, external: false, official: false }, 'a forged flag cannot send a site path off-site');
  assert.deepEqual(withStop({ path: `https://www.baylink.us/guides/${guide}/` })?.link, { href: `/guides/${guide}`, external: false, official: false });
  assert.deepEqual(withStop({ path: opening, external: false })?.link, { href: opening, external: false, official: false }, 'an opening the planner catalog lists');
  // Only the api's external:true makes an outside page "official"; otherwise it is a plain external page.
  assert.deepEqual(withStop({ path: 'https://museum.example.org/visit?lang=en', external: false })?.link, { href: 'https://museum.example.org/visit?lang=en', external: true, official: false });
  assert.deepEqual(withStop({ path: 'https://museum.example.org/visit', external: undefined })?.link, { href: 'https://museum.example.org/visit', external: true, official: false });
  assert.deepEqual(withStop({ path: 'https://museum.example.org/visit', external: 'true' })?.link, { href: 'https://museum.example.org/visit', external: true, official: false });
  assert.deepEqual(withStop({ path: 'https://museum.example.org/visit', external: true })?.link, { href: 'https://museum.example.org/visit', external: true, official: true });
  for (const path of ['javascript:alert(1)', '//evil.example/x', '/events/not-a-real-event-2099', '/guides/not-published', '/events/../admin', '/plan?stops=event:x',
    'http://127.0.0.1/', 'https://evil.invalid/x', 'https://www.baylink.us/events/not-a-real-event-2099', 'http://www.baylink.us' + MARKET, 42, null, '',
    // Sections a stop never links to, a stale opening, and locale-prefixed paths (SmartLink adds the reader's locale).
    '/plan', '/api/product-events', '/my-week', '/offers/some-offer', '/openings/not-a-real-opening-2099', `/events/${event}/extra`,
    `/en${MARKET}`, `/zh-Hant${CHINATOWN}`, `https://www.baylink.us/en${MARKET}`]) {
    assert.equal(withStop({ path })?.link, undefined, String(path));
  }
});

test('opening windows must be real clock spans; repeats, bad values and extras are dropped and the rest sorted', () => {
  assert.deepEqual(withStop({ openingWindows: [{ open: '13:00', close: '17:00' }, { open: '08:00', close: '12:00' }, { open: '08:00', close: '12:00' }] })?.openingWindows,
    [{ open: '08:00', close: '12:00' }, { open: '13:00', close: '17:00' }]);
  assert.equal(withStop({ openingWindows: [{ open: '8:00', close: '14:00' }, { open: '14:00', close: '14:00' }, { open: '18:00', close: '09:00' }, { open: '24:00', close: '25:00' }, null, 'x'] })?.openingWindows, undefined);
  assert.equal(withStop({ openingWindows: { open: '08:00', close: '14:00' } })?.openingWindows, undefined);
  assert.equal(withStop({ openingWindows: Array.from({ length: 9 }, (_, hour) => ({ open: `0${hour}:00`, close: `0${hour}:30` })) })?.openingWindows?.length, 6);
  assert.equal(withStop({ suggestedDurationMinutes: 0 })?.suggestedDurationMinutes, undefined);
  assert.equal(withStop({ suggestedDurationMinutes: 45.5 })?.suggestedDurationMinutes, undefined);
});

test('plan titles use the reader language and a space between Latin and Chinese', () => {
  assert.equal(bayBayPlanTitle('San Francisco一日安排', 'zh-Hans'), '旧金山一日安排');
  assert.equal(bayBayPlanTitle('San Francisco一日安排', 'zh-Hant'), '舊金山一日安排');
  assert.equal(bayBayPlanTitle('San Francisco一日安排', 'en'), 'San Francisco day plan');
  assert.equal(bayBayPlanTitle('San Francisco day plan', 'zh-Hans'), '旧金山一日安排');
  assert.equal(bayBayPlanTitle('Fremont一日安排', 'zh-Hans'), 'Fremont 一日安排');
  assert.equal(bayBayPlanTitle('San Jose一日安排', 'zh-Hant'), 'San Jose 一日安排');
  assert.equal(bayBayPlanTitle('湾区一日安排', 'en'), 'Bay Area day plan');
  assert.equal(bayBayPlanTitle('灣區一日安排', 'zh-Hans'), '湾区一日安排');
  assert.equal(bayBayPlanTitle('A relaxed day', 'en'), 'A relaxed day');
  assert.equal(bayBayPlanTitle('去Ferry Building看看', 'zh-Hans'), '去 Ferry Building 看看');
  assert.equal(spaceMixedScript('10月17日 BART站'), '10月17日 BART 站');
});

test('opening windows read 08:00–14:00 in Chinese and 8am–2pm in English', () => {
  assert.equal(bayBayOpeningWindowsLabel([{ open: '08:00', close: '14:00' }], false), '08:00–14:00');
  assert.equal(bayBayOpeningWindowsLabel([{ open: '08:00', close: '14:00' }], true), '8am–2pm');
  assert.equal(bayBayOpeningWindowsLabel([{ open: '10:30', close: '12:00' }, { open: '13:00', close: '23:45' }], true), '10:30am–12pm, 1pm–11:45pm');
  assert.equal(bayBayOpeningWindowsLabel([{ open: '00:15', close: '11:00' }, { open: '13:00', close: '17:00' }], false), '00:15–11:00、13:00–17:00');
  assert.equal(bayBayClock('00:15', true), '12:15am');
  assert.equal(bayBayClock('12:00', true), '12pm');
});

test('the L07 card shows the market hours, keeps 待安排 only where no window exists, and links each stop', async () => {
  const parsed = parseBayBayAssistantFields(live), paths: string[] = [];
  const view = render(<BayBayAssistantPlanCard plan={parsed.assistantPlan!} taskState={parsed.taskState} evidence={parsed.evidence!} disabled={false} onAsk={noop} onNavigate={path => paths.push(path)} />);
  assert.equal(view.getByRole('heading', { level: 3 }).textContent, '旧金山一日安排');
  const [market, ferry, chinatown] = stopItems(view.container);
  assert.match(timeOf(market), /^开放 08:00–14:00 · 建议停留约 60 分钟/);
  // Line 2 is the time status · the city (UI9-BB, content arrangement 10-19).
  assert.match(timeOf(market), /资料所列开放时段，到达时间待安排 · San Francisco$/);
  assert.doesNotMatch(timeOf(market), /^待安排 ·|时段待核实/);
  for (const item of [ferry, chinatown]) assert.match(timeOf(item), /^待安排 · 建议停留约 60 分钟时段待核实 · San Francisco$/);
  assert.equal(view.getAllByText((_, node) => node?.tagName === 'DD' && /^待安排/.test(node.textContent || '')).length, 2);

  const marketLink = within(market).getByRole('link', { name: 'Ferry Plaza 农夫市集：海边逛一圈' });
  assert.equal(marketLink.getAttribute('href'), MARKET);
  assert.equal(marketLink.hasAttribute('target'), false);
  fireEvent.click(marketLink);
  assert.deepEqual(paths, [MARKET], 'an in-app link navigates inside the app');
  const official = within(ferry).getByRole('link', { name: /^Ferry Building · 公共大厅与外部会合点\s*官方网站（在新标签页打开）$/ });
  assert.equal(official.getAttribute('href'), FERRY);
  assert.equal(official.getAttribute('target'), '_blank');
  assert.equal(official.getAttribute('rel'), 'noopener noreferrer');
  assert.ok(official.querySelector('svg[aria-hidden="true"]'), 'the external icon');
  fireEvent.click(official);
  assert.deepEqual(paths, [MARKET], 'the official site is not opened as an app route');
  assert.equal(within(chinatown).getByRole('link', { name: '唐人街与 North Beach' }).getAttribute('href'), CHINATOWN);
});

test('an outside page the api did not mark as official reads 外部网页, never 官方网站', async () => {
  const payload = structuredClone(live);
  payload.assistantPlan.stops[1].external = false;
  const parsed = parseBayBayAssistantFields(payload);
  const view = render(<BayBayAssistantPlanCard plan={parsed.assistantPlan!} taskState={parsed.taskState} evidence={parsed.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  const ferry = stopItems(view.container)[1];
  const link = within(ferry).getByRole('link', { name: /^Ferry Building · 公共大厅与外部会合点\s*外部网页（在新标签页打开）$/ });
  assert.equal(link.getAttribute('target'), '_blank');
  assert.doesNotMatch(ferry.textContent || '', /官方网站/);
  await act(async () => { await setLocale('en', false); });
  assert.ok(within(stopItems(view.container)[1]).getByRole('link', { name: /External page\s*\(opens in a new tab\)$/ }));
});

test('English and Traditional Chinese plan cards localize the title, hours and official link', async () => {
  const parsed = parseBayBayAssistantFields(live);
  await setLocale('en', false);
  const view = render(<BayBayAssistantPlanCard plan={parsed.assistantPlan!} taskState={parsed.taskState} evidence={parsed.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  assert.equal(view.getByRole('heading', { level: 3 }).textContent, 'San Francisco day plan');
  const [market, ferry] = stopItems(view.container);
  assert.match(timeOf(market), /^Open 8am–2pm · Suggested stay about 60 min/);
  assert.match(timeOf(ferry), /^Unscheduled/);
  const stopLink = (item: HTMLElement) => item.querySelector('h4 a')!;
  assert.equal(stopLink(market).getAttribute('href'), `/en${MARKET}`);
  assert.ok(within(ferry).getByRole('link', { name: /Official site\s*\(opens in a new tab\)$/ }));
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.equal(view.getByRole('heading', { level: 3 }).textContent, '舊金山一日安排');
  assert.match(timeOf(stopItems(view.container)[0]), /^開放 08:00–14:00/);
  assert.equal(stopLink(stopItems(view.container)[0]).getAttribute('href'), `/zh-Hant${MARKET}`);
  assert.ok(within(stopItems(view.container)[1]).getByRole('link', { name: /官方網站（.+）$/ }));
});

test('a scheduled stop keeps its time and adds the record hours; English times are 12-hour', async () => {
  const payload = structuredClone(live);
  Object.assign(payload.assistantPlan.stops[0], { startTime: '09:30', endTime: '10:30', timeStatus: 'suggested' });
  const plan = parseBayBayAssistantFields(payload).assistantPlan!;
  const view = render(<BayBayAssistantPlanCard plan={plan} evidence={parseBayBayAssistantFields(payload).evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
  assert.match(timeOf(stopItems(view.container)[0]), /^09:30–10:30 · 建议停留约 60 分钟建议时段，开放与预约待核实 · San Francisco开放时段 08:00–14:00$/);
  await act(async () => { await setLocale('en', false); });
  assert.match(timeOf(stopItems(view.container)[0]), /^9:30am–10:30am · Suggested stay about 60 min.*Open 8am–2pm$/);
});

test('the importer carries the localized title into the planner draft', async () => {
  const parsed = parseBayBayAssistantFields(live), paths: string[] = [];
  const view = render(<BayBayAssistantPlanCard plan={parsed.assistantPlan!} taskState={parsed.taskState} evidence={parsed.evidence!} disabled={false} onAsk={noop} onNavigate={path => paths.push(path)} />);
  fireEvent.click(view.getByRole('button', { name: /个地点带入计划页$/ }));
  const { readBayBayPlanDraft } = await import('../src/lib/baybay-plan-handoff');
  const id = new URL(paths[0], 'https://www.baylink.us').searchParams.get('baybayDraft');
  assert.equal(readBayBayPlanDraft(id)?.title, '旧金山一日安排');
});

/** The site's English dictionary (every generated scope), to check card labels against what /guides shows. */
const englishDictionary = (() => {
  const dir = new URL('../src/data/generated/english-scopes/', import.meta.url), merged: Record<string, string> = {};
  for (const file of readdirSync(dir)) if (file.endsWith('.json')) Object.assign(merged, JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
  return merged;
})();

test('guide cards name their own category the way the /guides tabs do; practical guides stay 办事指南', async () => {
  const city = guides.find(guide => guide.slug === 'sf-chinatown-north-beach-walk-guide')!;
  const [howTo, events, commute, education, safety] = (['newcomer', 'events', 'commute', 'education', 'safety'] as const).map(category => guides.find(guide => guide.category === category)!);
  const picked = [city, howTo, events, commute, education, safety];
  assert.ok(picked.every(Boolean), 'one guide in each category');
  // An answer shows at most five cards, so the six guides go into two rails.
  const rails = [picked.slice(0, 3), picked.slice(3)].map(list => render(<BayBaySaveScope><BayBayCardRailView today="2026-10-17" onNavigate={noop}
    cards={list.map(guide => ({ kind: 'guide' as const, id: guide.slug, title: guide.title, url: `/guides/${guide.slug}`, summary: '' }))} /></BayBaySaveScope>));
  const meta = () => rails.flatMap(view => [...view.container.querySelectorAll('.bb-card__meta')].map(node => node.textContent));
  assert.deepEqual(meta(), ['城市指南', '办事指南', '生活活动', '通勤', '学校与学区', '安全与防骗']);
  const tab = (id: string) => GUIDE_CATEGORY_TABS.find(item => item.id === id)!.label;
  const leisure = ['city', 'events', 'commute', 'education', 'safety'];
  assert.deepEqual(meta().filter(label => label !== '办事指南'), leisure.map(tab), 'the same words as the /guides tabs');
  await act(async () => { await setLocale('en', false); });
  assert.deepEqual(meta(), ['City guides', 'How-to guide', 'Local activities', 'Commuting', 'Schools & districts', 'Safety and scam prevention']);
  assert.deepEqual(meta().filter(label => label !== 'How-to guide'), leisure.map(id => englishDictionary[tab(id)]), 'the dictionary English that /guides shows');
});

// UI9-BB: with a plan, the answer shows only the cards that are not already a stop (content arrangement 10-19); both L07
// cards are stops 1 and 3, so the rail is gone and the stops' own links carry those pages.
test('end to end: the live L07 reply renders the plan card with hours, links and title, and no card repeats a stop', async t => {
  const paths: string[] = [];
  mockBayBayFetch(t, async () => Response.json(live));
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={path => paths.push(path)} onCreatePostClick={noop} />);
  fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: live.question } });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); });
  const card = await waitFor(() => view.getByRole('region', { name: 'BayBay 安排草案' }));
  assert.equal(within(card).getByRole('heading', { level: 3 }).textContent, '旧金山一日安排');
  assert.doesNotMatch(card.textContent || '', /San Francisco一日安排/);
  const [market, ferry, chinatown] = stopItems(card);
  assert.match(timeOf(market), /^开放 08:00–14:00/);
  assert.match(timeOf(ferry), /^待安排/);
  assert.match(timeOf(chinatown), /^待安排/);
  assert.equal(within(ferry).getByRole('link', { name: /官方网站（在新标签页打开）$/ }).getAttribute('href'), FERRY);
  fireEvent.click(within(chinatown).getAllByRole('link', { name: '唐人街与 North Beach' })[0]);
  assert.deepEqual(paths, [CHINATOWN]);
  // The plan follows the lead; the points fold into 更多说明 after it; no card repeats a stop.
  const answer = view.baseElement.querySelector('[data-answer-layout="v2"]')!;
  assert.ok(answer.querySelector('.bb-lead')!.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING, 'the plan comes right after the lead');
  assert.equal(view.baseElement.querySelector('[data-card-key="guide:sf-chinatown-north-beach-walk-guide"]'), null);
  assert.equal(view.baseElement.querySelector('.bb-cards'), null);
  const citations = [...chinatown.querySelectorAll('.baybay-plan-citations a')].map(link => link.getAttribute('href'));
  assert.equal(new Set(citations).size, citations.length, 'one citation per source page');
});
