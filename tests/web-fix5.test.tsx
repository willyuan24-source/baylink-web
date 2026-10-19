import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { after, afterEach } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import type { WeekendPickEntry } from '../src/data/weekend-picks';

// WEB-FIX5 (Batch 5, audit-1013): the 长辈友好 circle and rule (H06), honest check dates (H02), one-tap region (H23), the
// picks label (H26), naming (H27), family links on details (H33), view titles (H35), sold-out and past details (H57, H56),
// cover phone numbers (H21).
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/events', pretendToBeVisual: true });
const globals = {
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  localStorage: dom.window.localStorage, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
};
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup, fireEvent, within } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter, useLocation } = await import('react-router-dom');
const { isSeniorFriendly, startsInDaytime } = await import('../src/lib/senior-friendly');
const { checkLine, checkSummary } = await import('../src/lib/check-dates');
const { getReaderFreshness } = await import('../src/lib/content-review');
const { coverPhoneKeep } = await import('../src/lib/phone-numbers');
const { MoodCircles } = await import('../src/features/home/MoodCircles');
const { EventsView } = await import('../src/components/EventsView');
const model = await import('../src/features/events/events-model');
const { eventsViewMetadata, EVENTS_METADATA } = await import('../src/lib/monthly-metadata');
const { getMonthlyDateRange, nextOccurrence } = await import('../src/lib/monthly');
const { getHomeWeekend } = await import('../src/lib/home-weekend');
const { localDiscoveries, discoveryShare } = await import('../src/data/local-discoveries');
const { LocalDiscoveryDetail } = await import('../src/components/LocalDiscoveryDetail');
const { buildDetailRecord } = await import('../src/features/detail/build-detail');
const { WEEKEND_PICKS } = await import('../src/data/weekend-picks');

afterEach(() => { cleanup(); localStorage.clear(); });
after(() => {
  dom.window.close();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function LocationProbe() { const location = useLocation(); return <output data-testid="route">{location.pathname}{location.search}</output>; }
const routed = (location: string, node: React.ReactNode) => render(<MemoryRouter initialEntries={[location]}>{node}<LocationProbe /></MemoryRouter>);
const query = (view: ReturnType<typeof render>) => new URL(view.getByTestId('route').textContent!, 'https://www.baylink.us').searchParams;
const event = (overrides: Partial<Parameters<typeof isSeniorFriendly>[0]>) => ({ title: '活动', audience: [], cost: 'unknown' as const, ...overrides });

test('H06: 长辈友好 is seniors named, or accessible, Chinese-language, library or free all-ages daytime — never 21+, kids-only or evening', () => {
  assert.equal(isSeniorFriendly(event({ title: '长者健康讲座' })), true);
  assert.equal(isSeniorFriendly(event({ title: 'BORP 无障碍体育体验日', audience: ['无障碍运动'], sessions: [{ date: '2026-10-17', start: '10:00' }] })), true);
  assert.equal(isSeniorFriendly(event({ title: 'Marina 分馆大雁功：普通话和英语讲解的户外晨练', audience: ['成人'], venue: 'Marina 分馆后院', sessions: [{ date: '2026-10-17', start: '08:30' }] })), true);
  assert.equal(isSeniorFriendly(event({ title: 'OMI History Day', audience: ['社区历史'], venue: 'Ingleside Library', sessions: [{ date: '2026-10-17', start: '15:00' }] })), true);
  assert.equal(isSeniorFriendly(event({ title: '街区音乐节', audience: ['社区居民', '全年龄'], cost: 'free', sessions: [{ date: '2026-10-17', start: '12:00' }] })), true);
  // Not: a paid all-ages event, a free one with no time, children's programs at a library, 21+, evening-only.
  assert.equal(isSeniorFriendly(event({ title: '街区节', audience: ['全年龄'], cost: 'paid', sessions: [{ date: '2026-10-17', start: '12:00' }] })), false);
  assert.equal(isSeniorFriendly(event({ title: '街区节', audience: ['全年龄'], cost: 'free' })), false);
  assert.equal(isSeniorFriendly(event({ title: 'Millbrae 图书馆国语、粤语故事会', audience: ['0–5 岁儿童与家长'], venue: 'Millbrae 图书馆' })), false);
  assert.equal(isSeniorFriendly(event({ title: 'Fairfax 儿童万圣节服装交换', audience: ['亲子家庭'], venue: 'Fairfax Library' })), false);
  assert.equal(isSeniorFriendly(event({ title: 'Point Reyes 免费万圣节服装交换：成人、儿童与宠物', audience: ['亲子家庭'], venue: 'Point Reyes Library' })), true);
  assert.equal(isSeniorFriendly(event({ title: 'Benicia Witching Wine Walk', audience: ['21岁以上品酒者'], venue: 'First Street' })), false);
  assert.equal(isSeniorFriendly(event({ title: '图书馆夜场放映', venue: 'Main Library', sessions: [{ date: '2026-10-17', start: '19:00' }] })), false);
  // Access is a fact about the event, not an audience interest (review nit: NUMU's "关注无障碍创作的人"), and a paid event.
  assert.equal(isSeniorFriendly(event({ title: 'NUMU Community Ignition', audience: ['艺术与社区文化爱好者', '关注无障碍创作的人'], cost: 'paid', sessions: [{ date: '2026-10-17', start: '14:00' }] })), false);
  assert.equal(isSeniorFriendly(event({ title: '社区艺术开放日', audience: ['轮椅使用者与家人'], cost: 'paid', sessions: [{ date: '2026-10-17', start: '11:00' }] })), true);
  assert.equal(startsInDaytime(event({ planning: { schedule: { weekly: { 6: [{ open: '10:00', close: '14:00' }] } } } })), true);
  assert.equal(startsInDaytime(event({})), undefined);
});

test('H06: this weekend (10/17–18, read on Tue 10/13) has 长辈友好 events, and /events shows the chip for them', () => {
  const today = '2026-10-13';
  const range = getMonthlyDateRange('weekend', today)!;
  const weekend = model.INDEX_EVENTS.filter(item => [range.start, range.end].some(day => nextOccurrence(item, day) === day));
  const seniors = weekend.filter(isSeniorFriendly);
  assert.ok(seniors.length >= 5, `${seniors.length} 长辈友好 events`);
  for (const id of ['berkeley-borp-adaptive-sports-expo-oct17-2026', 'sfpl-marina-wild-goose-qigong-oct-2026', 'sfpl-chinatown-creative-saturdays-fall-2026']) {
    assert.ok(seniors.some(item => item.id === id), id);
  }
  assert.ok(!seniors.some(item => item.id === 'smcl-millbrae-chinese-storytime-oct-2026'), 'a 0–5 storytime is not for seniors');
  const view = routed('/events', <EventsView today={today} />);
  // UI9-EVENTS: 长辈友好 and 亲子 sit on rail 1 beside 免费 (the story circles are gone).
  const stories = within(view.container.querySelector('.ev-rail')!);
  assert.ok(stories.getByRole('button', { name: '长辈友好' }));
  assert.ok(stories.getByRole('button', { name: '亲子' }));
  assert.equal(stories.queryByRole('button', { name: /长者友好|带娃/ }), null, 'one label per story (H27)');
  fireEvent.click(stories.getByRole('button', { name: '长辈友好' }));
  assert.equal(query(view).get('tag'), 'seniors');
  assert.match(view.container.querySelector('.ev-count')!.textContent!, new RegExp(`^找到 \\d+ 场活动$`));
});

test('H06: the home circle opens /events?tag=seniors only when the weekend has some; otherwise the 长辈与家属 guides', () => {
  const href = (seniors: number | null | undefined) => {
    const view = render(<MemoryRouter><MoodCircles seniors={seniors} /></MemoryRouter>);
    const link = view.getByRole('link', { name: '长辈友好' }).getAttribute('href');
    cleanup();
    return link;
  };
  assert.equal(href(12), '/events?tag=seniors');
  assert.equal(href(0), '/guides?topic=elders');
  assert.equal(href(null), '/guides?topic=elders');
  // The published snapshot carries the count; a custom catalog counts with the same rule.
  const weekend = getHomeWeekend('2026-10-13');
  assert.ok(weekend.seniors === null || weekend.seniors > 0, `snapshot count ${weekend.seniors}`);
});

test('H06: an empty 长辈友好 list offers the 长辈与家属 guides and BayBay, not only 清除筛选', () => {
  const today = '2026-10-13';
  const range = getMonthlyDateRange('weekend', today)!;
  const region = model.REGIONS.map(item => item.id).find(id => !model.INDEX_EVENTS.some(item => item.region === id && isSeniorFriendly(item)
    && [range.start, range.end].some(day => nextOccurrence(item, day) === day)));
  const view = routed(`/events?tag=seniors&q=zz-no-such-${region ?? 'event'}`, <EventsView today={today} />);
  // A keyword keeps the keyword's own empty state (问 BayBay with the words).
  assert.ok(view.getByRole('link', { name: '问 BayBay' }));
  cleanup();
  if (!region) return;
  const empty = routed(`/events?tag=seniors&region=${region}`, <EventsView today={today} />);
  assert.ok(empty.getByRole('heading', { name: '这组条件下暂时没有活动' }));
  assert.equal(empty.getByRole('link', { name: '看长辈与家属指南' }).getAttribute('href'), '/guides?topic=elders');
  assert.match(empty.getByRole('link', { name: /^问 BayBay：这周末带爸妈去哪$/ }).getAttribute('href')!, /^\/plan\?q=/);
  assert.ok(empty.getByRole('button', { name: '清除筛选' }));
});

test('H02: list headers state when their items were checked — most of them, and the latest — never the edition date', () => {
  assert.deepEqual(checkSummary(['2026-09-29', '2026-09-29', '2026-10-12', '2026-09-28', undefined, 'x', '2026-10-20'], '2026-10-13'), { mostly: '2026-09-29', latest: '2026-10-12', earliest: '2026-09-28', all: false });
  assert.equal(checkSummary([], '2026-10-13'), null);
  const zh = (text: string) => text;
  assert.equal(checkLine({ mostly: '2026-09-29', latest: '2026-10-12' }, zh), '多数核对于 9/29 · 最近 10/12');
  assert.equal(checkLine({ mostly: '2026-10-12', latest: '2026-10-12' }, zh), '核对于 10/12');
  assert.equal(checkLine({ mostly: '2026-09-29', latest: '2026-10-12' }, (_, en) => en), 'mostly checked Sep 29 · latest Oct 12');
  const page = JSDOM.fragment(renderToStaticMarkup(<StaticRouter location="/events"><EventsView today="2026-10-13" /></StaticRouter>));
  const facts = page.querySelector('.ev-lede-facts')!.textContent!.replace(/\u00a0/g, ' ');
  // UI9-EVENTS (G12): said as checks against the official pages, then the quiet 我们怎么核对 link; press reports (DECISIONS 17)
  // are counted, not promised an official source.
  assert.match(facts, /(?:逐条附官方来源|\d+ 条来自媒体报道) · 官网核对 (?:多数 \d+\/\d+(?: · (?:最近|最早) \d+\/\d+)?|\d+\/\d+) · 我们怎么核对$/);
  const weekend = getHomeWeekend('2026-10-13');
  if (weekend.checked) assert.ok(weekend.checked.mostly <= weekend.checked.latest);
  // One date only when every listed item carries it; most on the latest day with a few older ones is still 多数 (§3.9).
  const mostlyLatest = checkSummary([...Array(71).fill('2026-10-15'), ...Array(5).fill('2026-09-29')], '2026-10-16')!;
  // W6B-INT: with CNT-SUPPLY-3's earliest day the line also names it (多数核对于 10/15 · 最早 9/29).
  assert.deepEqual(mostlyLatest, { mostly: '2026-10-15', latest: '2026-10-15', earliest: '2026-09-29', all: false });
  assert.equal(checkLine(mostlyLatest, zh), '多数核对于 10/15 · 最早 9/29');
  const en = (_: string, english: string) => english;
  assert.equal(checkLine(mostlyLatest, en), 'mostly checked Oct 15 · earliest Sep 29');
  assert.equal(checkLine(checkSummary(['2026-10-15', undefined], '2026-10-16')!, en), 'mostly checked Oct 15', 'English: every dated item on one day, one undated');
  assert.equal(checkLine(checkSummary(['2026-10-15', '2026-10-15'], '2026-10-16')!, zh), '核对于 10/15');
  assert.equal(checkLine(checkSummary(['2026-10-15', undefined], '2026-10-16')!, zh), '多数核对于 10/15', 'an item without a check date');
  assert.equal(checkLine(checkSummary(['2026-10-15', '2026-10-20'], '2026-10-16')!, zh), '多数核对于 10/15', 'a date after today');
});

test('H02: an event within a week whose sources the monitor cannot read says 未能自动核对 in its trust row', () => {
  const now = Date.parse('2026-10-13T19:00:00Z');
  const rows = [{ sourceId: 's', status: 'manual-required', needsReview: false, lastFetchedAt: null, lastReviewedAt: null }];
  const item = { kind: 'event' as const, verifiedAt: '2026-09-29', nextDate: '2026-10-18' };
  assert.equal(getReaderFreshness(item, rows, { today: '2026-10-13', now }).unread, true);
  assert.equal(getReaderFreshness({ ...item, nextDate: '2026-10-30' }, rows, { today: '2026-10-13', now }).unread, undefined, 'outside the week');
  assert.equal(getReaderFreshness(item, [{ ...rows[0], status: 'unchanged' }], { today: '2026-10-13', now }).unread, undefined, 'a readable source');
  assert.equal(getReaderFreshness(item, null, { today: '2026-10-13', now }).unread, undefined, 'no API answer');
});

test('H23: the region is one tap on 本周末 — a chip row under the day tabs, no Sheet', () => {
  const view = routed('/events?cost=free&tag=kids', <EventsView today="2026-10-13" />);
  const regions = within(view.getByRole('group', { name: '地区' }));
  assert.deepEqual(regions.getAllByRole('button').map(button => button.textContent), ['整个湾区', '旧金山', '东湾', '南湾', '半岛', '北湾']);
  fireEvent.click(regions.getByRole('button', { name: '旧金山' }));
  assert.equal(query(view).get('region'), 'sf');
  assert.equal(query(view).get('cost'), 'free');
  assert.equal(query(view).get('tag'), 'kids');
  assert.equal(view.queryByRole('dialog'), null, 'no Sheet opened');
  assert.equal(regions.getByRole('button', { name: '旧金山' }).getAttribute('aria-pressed'), 'true');
  for (const link of view.container.querySelectorAll('.ui-feed-card a.ui-card-link')) {
    const id = link.getAttribute('href')!.replace('/events/', '');
    assert.equal(model.INDEX_EVENTS.find(item => item.id === id)!.region, 'sf', id);
  }
});

test('H26: 编辑精选 only for an editor list; the automatic ranking is 本周末先看', () => {
  const ssr = (today: string) => JSDOM.fragment(renderToStaticMarkup(<StaticRouter location="/events"><EventsView today={today} /></StaticRouter>));
  const heading = (today: string) => ssr(today).querySelector('#ev-picks-heading')?.textContent;
  const addDays = (day: string, amount: number) => new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86_400_000).toISOString().slice(0, 10);
  // A weekend no editor has picked yet, seen from its Tuesday: the first Saturday from 10/24 without a list (the weekly
  // picks never need this test changed).
  const editorPicks = WEEKEND_PICKS as Record<string, readonly WeekendPickEntry[]>;
  const ranked = (saturday: string) => model.weekendPicks(model.INDEX_EVENTS, addDays(saturday, -4), { picks: {} });
  let saturday = '2026-10-24';
  while (editorPicks[saturday] || !ranked(saturday).length) { saturday = addDays(saturday, 7); assert.ok(saturday <= '2026-12-26', 'a weekend without a list'); }
  const tuesday = addDays(saturday, -4);
  assert.equal(heading(tuesday), '本周末先看', `${saturday} has no editor list`);
  // The same weekend with an editor list (two of the ranking's own events) is 编辑精选.
  editorPicks[saturday] = ranked(saturday).slice(0, 2).map(pick => ({ id: pick.event.id, reason: { zh: '测试理由', en: 'Test reason' } }));
  try {
    assert.equal(heading(tuesday), '编辑精选', `${saturday} with an editor list`);
  } finally {
    delete editorPicks[saturday];
  }
});

test('H35: each /events view has its own title; 本周末 keeps the page title', () => {
  assert.equal(eventsViewMetadata('weekend').title, EVENTS_METADATA.title);
  assert.equal(eventsViewMetadata('today').title, '今天湾区活动与官方来源｜BAYLINK');
  assert.equal(eventsViewMetadata('perks').title, '湾区免费与优惠｜BAYLINK');
  assert.equal(eventsViewMetadata('openings').title, '湾区新店与开业消息｜BAYLINK');
  assert.match(eventsViewMetadata('all').title, /^湾区全部活动（收录至 \d+\/\d+）｜BAYLINK$/);
  for (const view of ['today', 'perks', 'openings', 'all', 'next7'] as const) {
    const metadata = eventsViewMetadata(view);
    assert.doesNotMatch(metadata.english!.title!, /[㐀-鿿]/, view);
    assert.equal(metadata.path, '/events', `${view}: one canonical page`);
  }
});

test('H21: a cover phone number stays whole, and its cover sets it a step smaller', () => {
  const nb = String.fromCharCode(0x2011);
  assert.deepEqual(coverPhoneKeep('免费 1-800-434-0222'), { text: `免费 1${nb}800${nb}434${nb}0222`, phone: true });
  assert.deepEqual(coverPhoneKeep('先打 800-510-2020'), { text: `先打 800${nb}510${nb}2020`, phone: true });
  assert.deepEqual(coverPhoneKeep('首次驾照申请费 $46'), { text: '首次驾照申请费 $46', phone: false });
  assert.deepEqual(coverPhoneKeep('1-2-3 2026-10-13'), { text: '1-2-3 2026-10-13', phone: false });
});

const find = (kind: string, id: string) => {
  const item = localDiscoveries.find(row => row.kind === kind && discoveryShare(row).id === id);
  assert.ok(item, `${kind}:${id}`);
  return item;
};
const detail = (kind: string, id: string, today: string) => {
  const item = find(kind, id);
  return render(<MemoryRouter initialEntries={[discoveryShare(item).path]}><LocalDiscoveryDetail record={buildDetailRecord(item)} today={today} /></MemoryRouter>);
};

test('H57: a sold-out event leads with its official page, not 加入这天计划, and its H1 does not repeat 21+', () => {
  const view = detail('event', 'napa-harvest-after-dark-2026', '2026-10-13');
  assert.equal(view.getByRole('heading', { level: 1 }).textContent, 'Napa Harvest After Dark 面具晚宴');
  assert.ok(within(view.container.querySelector('.detail-chips') as HTMLElement).getByText('21+'));
  assert.ok(within(view.container.querySelector('.detail-chips') as HTMLElement).getByText('已售罄'));
  const bar = within(view.getByRole('group', { name: '这一页的操作' }));
  assert.equal(bar.queryByRole('button', { name: /加入这天计划/ }), null);
  assert.match(bar.getByRole('link', { name: /官方页/ }).className, /detail-action--primary/);
});

test('H56: a past event with no confirmed day reads 已结束, not 日期待定, and sends no family link', () => {
  const view = detail('event', 'sf-ai-infra-scale-dinner-2026', '2026-10-13');
  const chips = view.container.querySelector('.detail-chips')!.textContent!;
  assert.match(chips, /已结束 · 10\/7/);
  assert.doesNotMatch(chips, /日期待定/);
  assert.equal(view.queryByText('暂无已确认场次，请查看主办方最新安排。'), null);
  // An event that is over sends no large-text family link (review nit): a parent would open something already past.
  assert.equal(view.queryByRole('button', { name: '发给家人（大字版）' }), null);
});

test('H33 + H27: event, offer and opening pages send a large-text family link; an opening adds 加入计划', () => {
  for (const [kind, id] of [['event', 'sf-sunday-streets-excelsior-oct18-2026'], ['offer', 'sfmta-free-muni-seniors'], ['opening', 'marufuku-burlingame-announced']] as const) {
    const view = detail(kind, id, '2026-10-13');
    assert.ok(within(view.container.querySelector('.detail-share') as HTMLElement).getByRole('button', { name: '发给家人（大字版）' }), id);
    if (kind === 'opening') {
      const bar = within(view.getByRole('group', { name: '这一页的操作' }));
      assert.equal(bar.queryByText('加入行程'), null);
    }
    cleanup();
  }
});

test('H57: on /en the age prefix comes off the translated title, so the H1 has no Chinese', async () => {
  const { setLocale } = await import('../src/i18n/locale');
  const { act } = await import('@testing-library/react');
  await act(async () => { await setLocale('en', false); });
  try {
    const view = detail('event', 'napa-harvest-after-dark-2026', '2026-10-13');
    const h1 = view.getByRole('heading', { level: 1 }).textContent!;
    assert.doesNotMatch(h1, /[\u3400-\u9fff]/, h1);
    assert.match(h1, /Napa Harvest After Dark/);
  } finally {
    await act(async () => { await setLocale('zh-Hans', false); });
  }
});
