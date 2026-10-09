import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';

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
const { WEEKEND_PICKS } = await import('../src/data/weekend-picks');

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
    assert.equal(page.querySelector('.ev-lede-facts')!.textContent, `${total} 场 · ${free} 场免费 · 逐条附官方来源 · 核对于 10/7`);
    const tabs = [...page.querySelectorAll('nav[aria-label="活动分区"] a')];
    assert.deepEqual(tabs.map(tab => [tab.textContent, tab.getAttribute('href')]), [['本周末', '/events'], ['日历·地图', '/calendar'], ['免费与优惠', '/events?view=perks'], ['新店', '/events?view=openings']]);
    assert.deepEqual(tabs.map(tab => tab.getAttribute('aria-current')), ['page', null, null, null]);
    // The editor's list for 10/10 leads the rail in its order (a3 picks); the rail comes before the feed.
    const picks = [...page.querySelectorAll('.ev-picks .ui-hero-card a.ui-card-link')].map(link => link.getAttribute('href'));
    assert.deepEqual(picks, WEEKEND_PICKS['2026-10-10'].map(pick => `/events/${pick.id}`));
    assert.ok(page.querySelector('.ev-picks')!.compareDocumentPosition(page.querySelector('#monthly-events')!) & 4, 'picks come before the feed');
    // 12 feed cards, none of them a pick, each one link with a cover; never the free-text dateLabel.
    const ids = feedIds(page);
    assert.equal(ids.length, 12);
    assert.equal(ids.some(id => WEEKEND_PICKS['2026-10-10'].some(pick => pick.id === id)), false);
    for (const card of page.querySelectorAll('.ui-feed-card')) {
      assert.ok(card.querySelector('[data-cover="image"], [data-cover="type"]'), 'every card has a cover');
      assert.equal(card.querySelectorAll('a, button').length, 1, 'the whole card is one link with no other control');
    }
  }
});

test('the range line follows `when` and only the weekend list marks the 本周末 view current', () => {
  const line = (location: string) => ssr(location, <EventsView today={today} />).querySelector('.ev-range')?.textContent;
  assert.equal(line('/events?when=today'), '今天 · 10/9 周五');
  assert.equal(line('/events?when=next7'), '未来 7 天 · 10/9–15');
  assert.equal(line('/events?when=october'), '十月');
  assert.equal(line('/events?when=all&region=sf'), '全部日期 · 收录至 11/30 · 旧金山');
  assert.equal(line('/events?when=september'), '全部日期 · 收录至 11/30', 'the retired 九月回顾 reads as all dates');
  const current = (location: string) => ssr(location, <EventsView today={today} />).querySelector('nav[aria-label="活动分区"] a[href="/events"]')?.getAttribute('aria-current');
  for (const location of ['/events', '/events?region=sf&from=card-sf', '/events?cost=free']) assert.equal(current(location), 'page', location);
  for (const location of ['/events?when=today', '/events?when=all', '/events?when=unknown-value']) assert.equal(current(location), null, location);
  // /this-month is the same column on 全部日期: no picks or day tabs, every event in next-day order.
  const monthly = ssr('/this-month', <MonthlyEdition today={today} defaultDateFilter="all" />);
  assert.equal(monthly.querySelector('.ev-range')?.textContent, '全部日期 · 收录至 11/30');
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

test('the 免费 chip, a story chip and the filter Sheet narrow the feed, keep other parameters and announce the count', async () => {
  const view = routed('/events?tracking=kept', <EventsView today={today} />);
  fireEvent.click(within(view.container.querySelector('.ev-filter-row')!).getByRole('button', { name: '免费', exact: true }));
  assert.equal(query(view).get('cost'), 'free');
  assert.equal(query(view).get('tracking'), 'kept');
  for (const id of feedIds(view.container)) assert.ok(isFreeToAttend(model.INDEX_EVENTS.find(event => event.id === id)!), id);
  assert.equal(view.container.querySelector('.ev-picks'), null, 'a narrowed list shows no picks rail');
  // Story chips are toggles over facts the record states.
  fireEvent.click(within(view.container.querySelector('.ev-stories')!).getByRole('button', { name: '带娃' }));
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
  assert.equal(within(strip).getByRole('heading', { level: 2 }).textContent, '分享卡上的 旧金山周末 · 10/10–10/11');
  for (const id of card) assert.equal(feedIds(view.container).includes(id), false, id);
  assert.equal(view.container.querySelector('.ev-picks'), null, 'the strip replaces the picks rail');
  cleanup();
  globalThis.fetch = (async () => new Response('', { status: 404 })) as typeof fetch;
  const failed = routed('/events?from=card-all', <EventsView today={today} />);
  await waitFor(() => assert.match(failed.getByTestId('share-landing-strip').textContent!, /分享卡的清单暂时没能载入/));
  assert.equal(failed.getByTestId('share-landing-strip').getAttribute('data-card-ids'), null);
});

test('免费与优惠 and 新店 load as their own boards: a skeleton, 1:1 offer covers ending soonest first, opening counts that add up', async () => {
  const perks = routed('/events?view=perks', <EventsView today={today} />);
  assert.ok(perks.container.querySelector('[aria-busy="true"]'), 'skeleton first');
  await waitFor(() => assert.ok(perks.container.querySelector('.ui-feed[data-ratio="1:1"] .ui-feed-card')));
  assert.equal(perks.container.querySelector('nav[aria-label="活动分区"] a[aria-current="page"]')?.textContent, '免费与优惠');
  const offers = model.liveOffers(model.INDEX_OFFERS, today);
  assert.deepEqual(feedIds(perks.container), offers.slice(0, 12).map(offer => offer.id));
  fireEvent.click(perks.getByRole('button', { name: '无需购物', exact: true }));
  for (const id of feedIds(perks.container)) assert.equal(model.INDEX_OFFERS.find(offer => offer.id === id)?.kind, 'no-purchase', id);
  cleanup();
  const openings = routed('/events?view=openings', <EventsView today={today} />);
  await waitFor(() => assert.ok(openings.container.querySelector('.ui-feed-card')));
  const counts = within(openings.container.querySelector('.ev-perks-kinds')!).getAllByRole('button').map(chip => Number(chip.querySelector('.ui-chip__count')!.textContent));
  assert.equal(counts[0], counts.slice(1).reduce((sum, count) => sum + count, 0), '已开业 + 试营业 + 预告 = 全部');
  cleanup();
  // The old anchors land on the boards.
  const anchor = render(<MemoryRouter initialEntries={['/this-month#monthly-perks']}><MonthlyEdition today={today} /></MemoryRouter>);
  await waitFor(() => assert.equal(anchor.container.querySelector('nav[aria-label="活动分区"] a[aria-current="page"]')?.textContent, '免费与优惠'));
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
  assert.equal(view.container.querySelectorAll('.ui-row-card').length, onDay.length);
  assert.match(view.container.querySelector('#ev-calendar-day')!.textContent!, new RegExp(`10月10日 周六${onDay.length} 场`));
  // Cities in one row, the Chinese name first ("圣何塞 San Jose").
  const cityChip = within(view.container.querySelector('.ev-cities')!).getAllByRole('button')[1];
  assert.match(cityChip.textContent!, /^\p{Script=Han}+ [A-Z]/u);
  fireEvent.click(view.getByRole('button', { name: /选日期/ }));
  const sheet = await view.findByRole('dialog');
  fireEvent.click(within(sheet).getByRole('button', { name: /10月17日 周六/ }));
  assert.equal(new URL(view.getByTestId('route').textContent!, 'https://www.baylink.us').searchParams.get('date'), '2026-10-17');
  // Rows carry the day, so the detail page opens on it.
  const links = [...view.container.querySelectorAll('.ui-row-card a.ui-card-link')];
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
