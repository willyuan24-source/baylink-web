import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { after, afterEach, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import type { MonthlyEvent } from '../src/data/monthly-types';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/events' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// jsdom has no layout: let the Sheet's focus trap see connected controls.
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
// Stylesheets are Vite's job; here they load as empty modules (the prerender does the same).
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup, fireEvent, act, within, waitFor } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter, useLocation } = await import('react-router-dom');
const { EventsView } = await import('../src/components/EventsView');
const { MonthlyEdition } = await import('../src/components/MonthlyEdition');
const { default: CalendarPage } = await import('../src/pages/CalendarPage');
const { ChunkBoundary } = await import('../src/features/events/ChunkBoundary');
const { retryableLazy } = await import('../src/features/events/lazy-view');
const model = await import('../src/features/events/events-model');
const { isFreeToAttend, getMonthlyDateRange, nextOccurrence } = await import('../src/lib/monthly');
const { WEEKEND_FLAGSHIP_IDS, WEEKEND_PICKS } = await import('../src/data/weekend-picks');
const { isAdultOnly, isRealPhotoImage, scoreWeekendEvent } = await import('../src/lib/weekend-ranking');
const { GUIDE_IMAGES } = await import('../src/data/guide-media');
// The shell is rendered on the weekend of 10/10 with this editor list of its own, so these tests do not depend on what
// src/data/weekend-picks.ts holds for a passed weekend (the routine deletes those).
const PICKS_1010 = [
  { id: 'san-francisco-fleet-week-2026', reason: { zh: '蓝天使飞越海湾，岸边免费看', en: 'Blue Angels over the Bay, free from the shore' } },
  { id: 'burlingame-mandarin-storytime-2026', reason: { zh: '普通话+英语讲故事，0–6岁', en: 'Mandarin and English stories for ages 0–6' } },
  { id: 'fremont-ardenwood-harvest-2026', reason: { zh: '收玉米、榨苹果汁，东湾农场一日', en: 'Pick corn and press cider on an East Bay farm' } },
  { id: 'sf-italian-heritage-parade-2026', reason: { zh: '从渔人码头走进 North Beach', en: "From Fisherman's Wharf into North Beach" } },
];
const editorPicks = WEEKEND_PICKS as Record<string, typeof PICKS_1010>;
const publishedPicks = editorPicks['2026-10-10'];
editorPicks['2026-10-10'] = PICKS_1010;
after(() => { if (publishedPicks) editorPicks['2026-10-10'] = publishedPicks; else delete editorPicks['2026-10-10']; });
const { checkLine, checkSummary } = await import('../src/lib/check-dates');

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); localStorage.clear(); globalThis.fetch = originalFetch; });

const today = '2026-10-09'; // Friday: the weekend is 10/10–11
const ssr = (location: string, node: React.ReactNode) => JSDOM.fragment(renderToStaticMarkup(<StaticRouter location={location}>{node}</StaticRouter>));
function LocationProbe() { const location = useLocation(); return <output data-testid="route">{location.pathname}{location.search}</output>; }
const routed = (location: string, node: React.ReactNode) => render(<MemoryRouter initialEntries={[location]}>{node}<LocationProbe /></MemoryRouter>);
const query = (view: ReturnType<typeof render>) => new URL(view.getByTestId('route').textContent!, 'https://www.baylink.us').searchParams;
const feedIds = (root: ParentNode) => [...root.querySelectorAll('.ui-feed-card a.ui-card-link')].map(link => link.getAttribute('href')!.replace(/^\/(?:events|offers|openings)\//, ''));
const weekendEvents = () => {
  const range = getMonthlyDateRange('weekend', today)!;
  return model.INDEX_EVENTS.filter(event => [range.start, range.end].some(day => nextOccurrence(event, day) === day));
};

test('/events opens on 本周末: H1 活动, a range line from `when`, counts, four views and the editor’s picks before the feed', () => {
  for (const path of ['/events', '/events/', '/en/events', '/zh-Hant/events/']) {
    const page = ssr(path, <EventsView today={today} />);
    assert.equal(page.querySelector('h1')?.textContent, '活动', path);
    assert.equal(page.querySelector('.ev-range')?.textContent, '本周末 · 10/10–11');
    const total = weekendEvents().length;
    const free = weekendEvents().filter(event => isFreeToAttend(event)).length;
    // H02: the check dates of the listed events (most of them, and the latest), not the edition's 10/7.
    const checked = checkLine(checkSummary(weekendEvents().map(event => event.verifiedAt), today)!, zh => zh);
    assert.equal(page.querySelector('.ev-lede-facts')!.textContent, `${total} 场 · ${free} 场免费 · 逐条附官方来源 · ${checked}`);
    const tabs = [...page.querySelectorAll('nav[aria-label="活动分区"] a')];
    assert.deepEqual(tabs.map(tab => [tab.textContent, tab.getAttribute('href')]), [['本周末', '/events'], ['日历·地图', '/calendar'], ['免费与优惠', '/events?view=perks'], ['新店', '/events?view=openings']]);
    assert.deepEqual(tabs.map(tab => tab.getAttribute('aria-current')), ['page', null, null, null]);
    // The editor's list for 10/10 leads the rail in its order (a3 picks); the rail comes before the feed.
    const picks = [...page.querySelectorAll('.ev-picks .ui-hero-card a.ui-card-link')].map(link => link.getAttribute('href'));
    assert.deepEqual(picks, PICKS_1010.map(pick => `/events/${pick.id}`));
    assert.ok(page.querySelector('.ev-picks')!.compareDocumentPosition(page.querySelector('#monthly-events')!) & 4, 'picks come before the feed');
    // 12 feed cards, none of them a pick, each one link with a cover; never the free-text dateLabel.
    const ids = feedIds(page);
    assert.equal(ids.length, 12);
    assert.equal(ids.some(id => PICKS_1010.some(pick => pick.id === id)), false);
    for (const card of page.querySelectorAll('.ui-feed-card')) {
      assert.ok(card.querySelector('[data-cover="image"], [data-cover="type"]'), 'every card has a cover');
      // The whole card is one link; its only other control is the ♡ in the cover's save slot (H31).
      assert.equal(card.querySelectorAll('a').length, 1, 'the whole card is one link');
      assert.deepEqual([...card.querySelectorAll('button')].map(button => !!button.closest('.ui-feed-card__save') && /^收藏：/.test(button.getAttribute('aria-label') || '')), [true], 'and one ♡ on the cover');
    }
  }
});

test('十二月 is a date choice now that the edition runs to 12/31, and it lists only events with a December day', () => {
  assert.deepEqual(model.WHEN_OPTIONS.map(option => option.id), ['today', 'weekend', 'next7', 'october', 'november', 'december', 'all']);
  assert.deepEqual(model.WHEN_OPTIONS.find(option => option.id === 'december')!.label, { zh: '十二月', en: 'December' });
  assert.equal(model.resolveWhen('december', 'weekend'), 'december');
  assert.deepEqual(getMonthlyDateRange('december', today), { start: '2026-12-01', end: '2026-12-31' });
  const december = model.listEvents(model.INDEX_EVENTS, 'december', today);
  assert.ok(december.length >= 20, `${december.length} events with a December day`);
  for (const event of december) { const next = nextOccurrence(event, '2026-12-01'); assert.ok(next && next <= '2026-12-31', event.id); }
  assert.ok(december.some(event => event.id === 'dickens-christmas-fair-2026'));
  assert.ok(!december.some(event => event.endDate < '2026-12-01'), 'nothing that ends in November');
});

test('the range line follows `when` and only the weekend list marks the 本周末 view current', () => {
  const line = (location: string) => ssr(location, <EventsView today={today} />).querySelector('.ev-range')?.textContent;
  assert.equal(line('/events?when=today'), '今天 · 10/9 周五');
  assert.equal(line('/events?when=next7'), '未来 7 天 · 10/9–15');
  assert.equal(line('/events?when=october'), '十月');
  assert.equal(line('/events?when=december'), '十二月');
  assert.equal(line('/events?when=all&region=sf'), '全部日期 · 收录至 2/28 · 旧金山');
  assert.equal(line('/events?when=september'), '全部日期 · 收录至 2/28', 'the retired 九月回顾 reads as all dates');
  const current = (location: string) => ssr(location, <EventsView today={today} />).querySelector('nav[aria-label="活动分区"] a[href="/events"]')?.getAttribute('aria-current');
  for (const location of ['/events', '/events?region=sf&from=card-sf', '/events?cost=free']) assert.equal(current(location), 'page', location);
  for (const location of ['/events?when=today', '/events?when=all', '/events?when=unknown-value']) assert.equal(current(location), null, location);
  // /this-month is the same column on 全部日期: no picks or day tabs, every event in next-day order.
  const monthly = ssr('/this-month', <MonthlyEdition today={today} defaultDateFilter="all" />);
  assert.equal(monthly.querySelector('.ev-range')?.textContent, '全部日期 · 收录至 2/28');
  assert.equal(monthly.querySelector('.ev-picks'), null);
  assert.equal(monthly.querySelector('.ev-days'), null);
  assert.deepEqual(feedIds(monthly), model.listEvents(model.INDEX_EVENTS, 'all', today).map(event => event.id).slice(0, 12));
});

test('本周末 splits into 周六 / 周日 / 两天都开放; long runs open both days leave the day tabs, past days drop out', () => {
  const { days, tabs } = model.weekendTabs(model.INDEX_EVENTS, today);
  assert.deepEqual(days, ['2026-10-10', '2026-10-11']);
  for (const event of tabs.open) assert.ok(!tabs.sat.includes(event) && !tabs.sun.includes(event), event.id);
  const fleetWeek = model.INDEX_EVENTS.find(event => event.id === 'san-francisco-fleet-week-2026')!;
  assert.ok(tabs.open.includes(fleetWeek), 'a week-long run on both days is 两天都开放');
  const page = render(<MemoryRouter initialEntries={['/events']}><EventsView today={today} /></MemoryRouter>);
  const radios = within(page.container.querySelector('.ev-days')!).getAllByRole('radio');
  assert.deepEqual(radios.map(radio => [radio.textContent, radio.getAttribute('aria-checked')]), [['周六 10/10', 'true'], ['周日 10/11', 'false'], ['两天都开放', 'false']]);
  cleanup();
  // On Sunday, Saturday is over: its tab is gone and Sunday is chosen.
  const sunday = render(<MemoryRouter initialEntries={['/events']}><EventsView today="2026-10-11" /></MemoryRouter>);
  const sundayRadios = within(sunday.container.querySelector('.ev-days')!).getAllByRole('radio');
  assert.deepEqual(sundayRadios.map(radio => [radio.textContent, radio.getAttribute('aria-checked')]), [['周日 10/11', 'true'], ['两天都开放', 'false']]);
});

// W6-INT tie-break, client side: /events ranks with the slim index records (EVENTS_INDEX.images), so within a score a
// photo that fills its card must still go ahead of a poster or a letterboxed banner exactly as the full registry says.
test('within a score, the weekend tabs put a photo that fills its card ahead of a poster or banner, read from the slim index', () => {
  const hasPhoto = (key: string) => Object.hasOwn(model.EVENTS_INDEX.images, key);
  // kind / fullFrame from the full registry, not from the index copy
  const photoRank = (key: string) => !hasPhoto(key) ? 0 : isRealPhotoImage(GUIDE_IMAGES[key]) ? 2 : 1;
  const score = (event: MonthlyEvent) => scoreWeekendEvent(event, { hasPhoto, flagships: WEEKEND_FLAGSHIP_IDS });
  let photoFirst = 0;
  for (const day of ['2026-10-15', '2026-10-22', '2026-10-29']) {
    const { tabs } = model.weekendTabs(model.INDEX_EVENTS, day);
    for (const [tab, list] of Object.entries(tabs)) for (let index = 1; index < list.length; index++) {
      const [a, b] = [list[index - 1], list[index]] as unknown as [MonthlyEvent, MonthlyEvent];
      if (isAdultOnly(a) !== isAdultOnly(b) || score(a) !== score(b)) continue;
      assert.ok(photoRank(a.imageKey) >= photoRank(b.imageKey), `${day} ${tab}: ${a.id} (${photoRank(a.imageKey)}) before ${b.id} (${photoRank(b.imageKey)})`);
      if (photoRank(a.imageKey) === 2 && photoRank(b.imageKey) === 1) photoFirst++;
    }
  }
  assert.ok(photoFirst > 0, 'the three weekends have a photo and a poster or banner on the same score');
});

test('the 免费 chip, a story chip and the filter Sheet narrow the feed, keep other parameters and announce the count', async () => {
  const view = routed('/events?tracking=kept', <EventsView today={today} />);
  fireEvent.click(within(view.container.querySelector('.ev-filter-row')!).getByRole('button', { name: '免费', exact: true }));
  assert.equal(query(view).get('cost'), 'free');
  assert.equal(query(view).get('tracking'), 'kept');
  for (const id of feedIds(view.container)) assert.ok(isFreeToAttend(model.INDEX_EVENTS.find(event => event.id === id)!), id);
  assert.equal(view.container.querySelector('.ev-picks'), null, 'a narrowed list shows no picks rail');
  // Story chips are toggles over facts the record states.
  fireEvent.click(within(view.container.querySelector('.ev-stories')!).getByRole('button', { name: '亲子' }));
  assert.equal(query(view).get('tag'), 'kids');
  const kids = model.TAGS.find(tag => tag.id === 'kids')!;
  for (const id of feedIds(view.container)) assert.ok(kids.test(model.INDEX_EVENTS.find(event => event.id === id)!), id);
  // The Sheet announces how many it will show; the region is remembered for the next visit.
  fireEvent.click(view.getByRole('button', { name: /筛选/ }));
  const sheet = await view.findByRole('dialog');
  assert.match(within(sheet).getByRole('status').textContent!, /^显示 \d+ 场$/);
  fireEvent.click(within(sheet).getByRole('button', { name: '旧金山', exact: true }));
  assert.equal(query(view).get('region'), 'sf');
  assert.equal(localStorage.getItem(model.REGION_KEY), 'sf');
  for (const id of feedIds(view.container)) assert.equal(model.INDEX_EVENTS.find(event => event.id === id)!.region, 'sf');
  fireEvent.click(within(sheet).getByRole('button', { name: '清除', exact: true }));
  assert.equal(query(view).get('cost'), null);
  assert.equal(query(view).get('tag'), null);
  assert.equal(query(view).get('tracking'), 'kept');
  cleanup();
  // A saved region applies on the next visit (after mount, so the prerendered page stays 整个湾区).
  const next = routed('/events', <EventsView today={today} />);
  await waitFor(() => assert.equal(next.container.querySelector('.ev-range')?.textContent, '本周末 · 10/10–11 · 旧金山'));
});

test('the filter Sheet announces the number the page shows once it closes: the chosen day, not the weekend total', async () => {
  const announced = (dialog: HTMLElement) => Number(within(dialog).getByRole('status').textContent!.match(/^显示 (\d+) 场$/)![1]);
  const view = routed('/events', <EventsView today={today} />);
  const close = async (dialog: HTMLElement, count: number) => {
    fireEvent.click(within(dialog).getByRole('button', { name: `显示 ${count} 场`, exact: true }));
    await waitFor(() => assert.equal(view.queryByRole('dialog'), null));
  };
  fireEvent.click(view.getByRole('button', { name: /筛选/ }));
  const sheet = await view.findByRole('dialog');
  const all = announced(sheet);
  // 10/9 is a Friday: closing shows the 周六 tab, which is not the union of the three day tabs.
  const union = weekendEvents().length;
  assert.ok(all < union, `the Sheet says ${all}, not the weekend's ${union}`);
  await close(sheet, all);
  assert.equal(within(view.container.querySelector('.ev-days')!).getByRole('radio', { checked: true }).textContent, '周六 10/10');
  assert.equal(view.container.querySelector('.ev-count')!.textContent, `找到 ${all} 场活动`);
  assert.equal(view.container.querySelector('.ev-more__note')!.textContent, `已显示 12 / ${all} 场`);
  // A filter chosen inside the Sheet updates the number to the narrowed list, and the page then shows that many.
  fireEvent.click(view.getByRole('button', { name: /筛选/ }));
  const again = await view.findByRole('dialog');
  fireEvent.click(within(again).getByRole('button', { name: '旧金山', exact: true }));
  const sf = announced(again);
  assert.ok(sf > 0 && sf < all, `${sf} of ${all}`);
  await close(again, sf);
  assert.equal(view.container.querySelector('.ev-count')!.textContent, `找到 ${sf} 场活动`);
  assert.equal(feedIds(view.container).length, Math.min(12, sf));
});

test('what left the listing stays on the detail page: 公开想去, 一起去 and 存入日历 on a live weekend event', async () => {
  const { getLocalDiscovery } = await import('../src/data/local-discoveries');
  const { LocalDiscoveryDetail } = await import('../src/components/LocalDiscoveryDetail');
  const { buildDetailRecord } = await import('../src/features/detail/build-detail');
  globalThis.fetch = (async () => { throw new Error('offline in tests'); }) as typeof fetch;
  const event = weekendEvents()[0];
  const item = getLocalDiscovery('event', event.id);
  assert.ok(item?.kind === 'event', event.id);
  const view = render(<MemoryRouter><LocalDiscoveryDetail record={buildDetailRecord(item)} today={today} /></MemoryRouter>);
  const interest = view.getByRole('button', { name: `公开想去：${item.event.title}`, exact: true }) as HTMLButtonElement;
  assert.equal(interest.disabled, false);
  assert.ok(view.getByRole('button', { name: /^一起去/ }));
  assert.ok(view.getByRole('button', { name: '存入日历', exact: true }));
  // The counts, the 一起去 sheet and private interest: tests/event-participation.test.tsx; the participation anchor and
  // the ended state: tests/local-discovery.test.tsx.
});

test('再看 12 场 reveals the next cards; an empty search offers a reset and BayBay', () => {
  const view = routed('/events?when=all', <EventsView today={today} />);
  assert.equal(feedIds(view.container).length, 12);
  fireEvent.click(view.getByRole('button', { name: '再看 12 场' }));
  assert.equal(feedIds(view.container).length, 24);
  assert.match(view.container.querySelector('.ev-more__note')!.textContent!, /^已显示 24 \/ \d+ 场$/);
  cleanup();
  const empty = routed('/events?q=zzzz-no-such-event', <EventsView today={today} />);
  assert.ok(empty.getByRole('heading', { name: '这组条件下暂时没有活动' }));
  assert.equal(empty.getByRole('link', { name: '问 BayBay' }).getAttribute('href'), '/plan?q=zzzz-no-such-event');
  fireEvent.click(empty.getByRole('button', { name: '清除筛选' }));
  assert.equal(query(empty).get('q'), null);
  assert.ok(feedIds(empty.container).length > 0);
});

test('keyword search reads titles and aliases, and folds Traditional queries', () => {
  const view = routed('/events?when=all&q=蓝天使', <EventsView today={today} />);
  assert.ok(feedIds(view.container).includes('san-francisco-fleet-week-2026'), 'an alias finds Fleet Week');
  cleanup();
  const traditional = routed('/events?when=all&q=藍天使', <EventsView today={today} />);
  assert.ok(feedIds(traditional.container).includes('san-francisco-fleet-week-2026'), 'a Traditional query folds to Simplified');
});

test('a share-card landing lists exactly the card’s ids first and leaves them out of the feed', async () => {
  const card = ['fremont-ardenwood-harvest-2026', 'san-francisco-fleet-week-2026'];
  const requests: string[] = [];
  globalThis.fetch = (async (url: string) => {
    requests.push(String(url));
    return new Response(JSON.stringify({ day: today, range: { start: '2026-10-10', end: '2026-10-11' }, picks: card.map(id => ({ id })) }), { status: 200 });
  }) as typeof fetch;
  const view = routed('/events?region=sf&from=card-sf', <EventsView today={today} />);
  const strip = view.getByTestId('share-landing-strip');
  assert.ok(strip.querySelector('[aria-busy="true"]'), 'a fixed-height skeleton while the card loads');
  await waitFor(() => assert.equal(strip.getAttribute('data-card-ids'), card.join(' ')));
  assert.deepEqual(requests, ['/weekly/sf.json']);
  assert.deepEqual([...strip.querySelectorAll('.ui-row-card a.ui-card-link')].map(link => link.getAttribute('href')!.split('?')[0]), card.map(id => `/events/${id}`));
  assert.equal(within(strip).getByRole('heading', { level: 2 }).textContent, '分享卡上的旧金山周末 · 10/10–10/11');
  // Rows open on the card's weekend: Fleet Week (on since 10/4) reads 周六 10/10, not today's Friday.
  assert.match(strip.querySelector('a[href^="/events/san-francisco-fleet-week-2026"]')!.getAttribute('href')!, /date=2026-10-10$/);
  for (const id of card) assert.equal(feedIds(view.container).includes(id), false, id);
  assert.equal(view.container.querySelector('.ev-picks'), null, 'the strip replaces the picks rail');
  cleanup();
  // A manifest that fails to load (offline, 404) hides nothing: the page is the plain 本周末, picks rail and full feed,
  // so the note's "every event this weekend is below" is true (RC-25).
  const page = (root: ParentNode) => ({
    picks: [...root.querySelectorAll('.ev-picks .ui-hero-card a.ui-card-link')].map(link => link.getAttribute('href')),
    feed: feedIds(root), count: root.querySelector('.ev-count')!.textContent,
  });
  const plain = routed('/events?day=open', <EventsView today={today} />);
  const expected = page(plain.container);
  cleanup();
  globalThis.fetch = (async () => new Response('', { status: 404 })) as typeof fetch;
  const failed = routed('/events?from=card-all&day=open', <EventsView today={today} />);
  await waitFor(() => assert.match(failed.getByTestId('share-landing-strip').textContent!, /分享卡的清单暂时没能载入/));
  assert.equal(failed.getByTestId('share-landing-strip').getAttribute('data-card-ids'), null);
  assert.equal(failed.getByTestId('share-landing-strip').querySelectorAll('.ui-row-card').length, 0);
  assert.ok(expected.picks.length > 0 && expected.feed.length > 0);
  assert.deepEqual(page(failed.container), expected, 'the same picks, feed and count as /events');
  const shown = [...expected.picks.map(href => href!.replace('/events/', '')), ...expected.feed];
  assert.ok(shown.includes('san-francisco-fleet-week-2026'), 'Fleet Week is on the page');
});

test('the page-end image link opens the card dated today when the build wrote one (as the home page does)', () => {
  const days = ['2026-10-11', '2026-10-12'];
  assert.equal(model.weeklyCardHref('all', '2026-10-12', days), '/weekly/all-2026-10-12.png');
  assert.equal(model.weeklyCardHref('all', '2026-10-20', days), '/weekly/all.png', 'outside the build week: the build-day card');
  assert.equal(model.weeklyCardHref('sf', '2026-10-12', days), '/weekly/sf.png', 'regions have no dated cards');
  assert.deepEqual(model.EVENTS_INDEX.weeklyCardDays, [...model.EVENTS_INDEX.weeklyCardDays].sort());
  const day = model.EVENTS_INDEX.weeklyCardDays[0];
  if (day) {
    const view = routed('/events', <EventsView today={day} />);
    assert.equal(view.getByRole('link', { name: '存成一张图：本周末精选' }).getAttribute('href'), `/weekly/all-${day}.png`);
  }
});

test('a board that fails to load shows the error state, and 重试 loads it again', async () => {
  let attempts = 0;
  const view = retryableLazy(async () => { attempts++; if (attempts === 1) throw new Error('chunk'); return { default: () => <p>loaded board</p> }; });
  const errors = console.error; console.error = () => {};
  try {
    const page = render(<MemoryRouter><ChunkBoundary>{attempt => { const View = view(attempt); return <React.Suspense fallback={<p>loading</p>}><View /></React.Suspense>; }}</ChunkBoundary></MemoryRouter>);
    await page.findByRole('alert');
    assert.ok(page.getByRole('heading', { name: '这一栏暂时没能加载' }));
    await act(async () => { fireEvent.click(page.getByRole('button', { name: '重试' })); });
    await page.findByText('loaded board');
    assert.equal(attempts, 2);
  } finally { console.error = errors; }
});

test('日历·地图: a week strip, the month in a Sheet, bilingual city chips and image rows that carry the day', async () => {
  const view = render(<MemoryRouter initialEntries={['/calendar?date=2026-10-10']}><CalendarPage today={today} /><LocationProbe /></MemoryRouter>);
  const days = [...view.container.querySelectorAll<HTMLElement>('.ev-week__day')];
  assert.equal(days.length, 7);
  assert.equal(days.find(day => day.getAttribute('aria-current') === 'date')?.querySelector('.ev-week__date')?.textContent, '9');
  assert.equal(days.find(day => day.getAttribute('aria-pressed') === 'true')?.querySelector('.ev-week__date')?.textContent, '10');
  const onDay = model.INDEX_EVENTS.filter(event => nextOccurrence(event, '2026-10-10') === '2026-10-10');
  // One wide lead cover (one-offs first, a real photo first), then a row for every other event of the day.
  assert.equal(view.container.querySelectorAll('.ev-calendar__lead .ui-feed-card').length, 1);
  assert.equal(view.container.querySelectorAll('.ui-row-card').length, onDay.length - 1);
  const leadHref = view.container.querySelector('.ev-calendar__lead a.ui-card-link')!.getAttribute('href')!;
  const lead = model.INDEX_EVENTS.find(event => leadHref.startsWith(`/events/${event.id}?`))!;
  assert.ok(model.hasRealCover('event', lead, today) || !onDay.some(event => model.hasRealCover('event', event, today)), 'a real photo leads the day when one exists');
  assert.match(view.container.querySelector('#ev-calendar-day')!.textContent!, new RegExp(`10月10日 周六${onDay.length} 场`));
  // Cities in one row, the Chinese name first ("圣何塞 San Jose").
  const cityChip = within(view.container.querySelector('.ev-cities')!).getAllByRole('button')[1];
  assert.match(cityChip.textContent!, /^\p{Script=Han}+ [A-Z]/u);
  fireEvent.click(view.getByRole('button', { name: /选日期/ }));
  const sheet = await view.findByRole('dialog');
  fireEvent.click(within(sheet).getByRole('button', { name: /10月17日 周六/ }));
  assert.equal(new URL(view.getByTestId('route').textContent!, 'https://www.baylink.us').searchParams.get('date'), '2026-10-17');
  // Rows carry the day, so the detail page opens on it.
  const links = [...view.container.querySelectorAll('.ev-calendar__rows a.ui-card-link')];
  assert.ok(links.length > 0);
  for (const link of links) assert.match(link.getAttribute('href')!, /\?date=2026-10-17$/);
});

test('RC-33: the events pages never statically load the guides, the full discovery catalog or the image registry', () => {
  const root = new URL('../', import.meta.url);
  const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
  const exists = (path: string) => { try { readFileSync(new URL(path, root)); return true; } catch { return false; } };
  const resolveImport = (from: string, specifier: string): string | null => {
    if (!specifier.startsWith('.')) return null;
    const base = new URL(specifier, new URL(from, root)).href.slice(root.href.length);
    return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(suffix => base + suffix).find(path => /\.(tsx?|json)$/.test(path) && exists(path)) ?? null;
  };
  const graph = (entry: string) => {
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      if (file.endsWith('.json')) return;
      // Static value imports only: `import type` is erased, dynamic import() chunks load on demand, and a re-export
      // (`export { … } from`) the page never uses is dropped by the bundler (verify-release measures the bundle itself).
      for (const match of read(file).matchAll(/^\s*(import)\s+(?!type\s)[^'"]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm)) {
        const target = resolveImport(file, match[2] ?? match[3]);
        if (target) visit(target);
      }
    };
    visit(entry);
    return seen;
  };
  for (const page of ['src/pages/EventsPage.tsx', 'src/pages/MonthlyPage.tsx', 'src/pages/CalendarPage.tsx']) {
    const files = graph(page);
    assert.ok(files.has('src/data/generated/events-index.json'), `${page} reads the slim index`);
    // WEB-PERF-2: the events past the route's own days load on demand (features/events/events-later.ts)
    assert.equal(files.has('src/data/generated/events-later.json'), false, `${page} statically imports the later events`);
    for (const heavy of ['src/data/guides.ts', 'src/data/local-discoveries.ts', 'src/data/monthly-edition.ts', 'src/data/guide-media.ts', 'src/data/planner-catalog.ts', 'src/data/event-calendar-dates.ts']) {
      assert.equal(files.has(heavy), false, `${page} statically imports ${heavy}`);
    }
  }
});

test('covers come from the ladder: no image twice on a page, information cards are marked, no AI art on a listing', () => {
  for (const location of ['/events', '/events?when=all', '/events?day=sun']) {
    const page = ssr(location, <EventsView today={today} />);
    const sources = [...page.querySelectorAll('.ui-cover__img')].map(img => img.getAttribute('src'));
    assert.equal(new Set(sources).size, sources.length, `${location}: an image appears once`);
    assert.ok(page.querySelectorAll('[data-cover="type"]').length > 0);
    for (const cover of page.querySelectorAll('[data-cover="type"]')) assert.match(cover.textContent!, /BAYLINK 信息卡/);
    for (const badge of page.querySelectorAll('[data-cover="image"] .ui-provenance')) assert.doesNotMatch(badge.textContent!, /AI/);
  }
});

test('RC-33: a phone-wide cover (the picks, the calendar lead) asks for the 800w rung at most, so the LCP image is not starved', () => {
  const cap = /^\(max-width: 767px\) 266px, /;
  const events = ssr('/events', <EventsView today={today} />);
  const picks = [...events.querySelectorAll('.ev-picks img.ui-cover__img')];
  assert.ok(picks.length > 0);
  for (const img of picks) assert.match(img.getAttribute('sizes')!, cap);
  assert.equal(picks[0].getAttribute('fetchpriority'), 'high', 'the first pick is the eager LCP image');
  const calendar = ssr('/calendar?date=2026-10-10', <CalendarPage today={today} />);
  const lead = calendar.querySelector('.ev-calendar__lead img.ui-cover__img')!;
  assert.match(lead.getAttribute('sizes')!, cap);
  assert.equal(lead.getAttribute('fetchpriority'), 'high');
  // Feed cards keep the shared feed sizes (173px slots already pick 800w at DPR 3).
  assert.doesNotMatch(events.querySelector('.ev-feed img.ui-cover__img')!.getAttribute('sizes')!, cap);
});
