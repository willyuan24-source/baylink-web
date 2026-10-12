import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getHomeWeekend, getWeeklyCardHref, HOME_FEED_SIZE } from '../src/lib/home-weekend';
import { GUIDE_IMAGES, guideCount, HOME_WEEKENDS, MONTHLY_EDITION, MONTHLY_EVENTS } from '../src/lib/home-catalog';
import { WEEKEND_PICKS, type WeekendPickEntry } from '../src/data/weekend-picks';
import { eventOccursOn } from '../src/lib/event-calendar';
import { MONTHLY_EVENTS as COMPLETE_EVENTS } from '../src/data/monthly-edition';
import { GUIDE_IMAGES as COMPLETE_IMAGES } from '../src/data/guide-media';
import { guides as COMPLETE_GUIDES } from '../src/data/guides';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, within, waitFor } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter } = await import('react-router-dom');
const { HomeDiscovery } = await import('../src/components/HomeDiscovery');
afterEach(() => { cleanup(); dom.window.localStorage.clear(); });

/** The first snapshot day that has a full weekend (picks and a feed), so these checks follow the published catalog. */
const days = Object.keys(HOME_WEEKENDS).sort();
const snapshots = HOME_WEEKENDS as Record<string, { ids: string[]; feed: string[]; total: number }>;
const today = days.find(day => snapshots[day].ids.length === 3 && snapshots[day].feed.length >= 4)!;
const serverHome = (day = today) => new JSDOM(renderToStaticMarkup(<StaticRouter location="/"><HomeDiscovery today={day} onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></StaticRouter>)).window.document;
const monthDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

test('the head asks the question and its subtitle states this weekend, the guide library and the check date (D21, HOMEIA-01)', () => {
  const doc = serverHome();
  const weekend = getHomeWeekend(today);
  assert.equal(doc.querySelectorAll('h1').length, 1);
  assert.equal(doc.querySelector('h1')!.textContent, '这个周末，湾区去哪？');
  const lede = doc.querySelector('.home-head__lede')!.textContent!;
  assert.ok(lede.includes(`本周末 ${weekend.total} 场活动`), lede);
  assert.ok(lede.includes(`${COMPLETE_GUIDES.length} 篇办事指南`), 'the whole guide library, not the home selection');
  assert.ok(lede.includes(`${monthDay(MONTHLY_EDITION.checkedAt)} 核对`), lede);
  assert.equal(doc.querySelector('.home-head__dateline time')!.getAttribute('datetime'), today);
  assert.equal(guideCount, COMPLETE_GUIDES.length);
  assert.doesNotMatch(doc.querySelector('.home-head')!.textContent!, /San Francisco Bay Area/, 'no English eyebrow on the Chinese home');
});

test('the picks are the weekly share card\'s three, each a cover with its date, ♡ 收藏 and 加入这天计划 (FC3-01, FC3-02)', () => {
  const doc = serverHome();
  const weekend = getHomeWeekend(today);
  const picks = [...doc.querySelectorAll('.home-picks__list > li')];
  assert.equal(picks.length, 3);
  picks.forEach((card, index) => {
    const { event, date } = weekend.picks[index];
    assert.equal(card.querySelector('h3 a')!.getAttribute('href'), `/events/${event.id}`);
    assert.ok(date >= today && eventOccursOn(event, date));
    assert.ok(card.querySelector('.ui-hero-card__media')!.textContent!.includes(monthDay(date)), `${event.id}: the date on the cover`);
    // One save model: the ♡ is the save control, and 加入这天计划 is the saving control (a button), never a link to /plan.
    assert.equal(card.querySelector('.saves-toggle')!.getAttribute('aria-label'), `收藏：${event.title}`);
    assert.equal(card.querySelector('.saves-add-day')!.getAttribute('aria-label'), `加入这天计划：${event.title}`);
    assert.equal(card.querySelector('a[href^="/plan"]'), null);
  });
  assert.equal(doc.querySelector('.home-picks .home-section-head__more')!.getAttribute('href'), '/events');
  assert.equal(doc.querySelector('.home-share a[download]')!.getAttribute('href'), getWeeklyCardHref(today));
});

test('no event, offer or guide on the home shows an AI illustration, and no image appears twice (SV-04, VISUAL-10)', () => {
  const illustrations = new Set(Object.values(COMPLETE_IMAGES).filter(image => image.kind === 'illustration' && !image.scene3d).map(image => image.src));
  for (const day of days) {
    const doc = serverHome(day);
    const sources = [...doc.querySelectorAll('.home-discovery img.ui-cover__img')].map(img => img.getAttribute('src')!);
    assert.equal(new Set(sources).size, sources.length, `${day}: an image appears once`);
    for (const badge of doc.querySelectorAll('.home-picks [data-provenance], .home-feed [data-provenance], .home-offers [data-provenance], .home-guides [data-provenance]')) {
      assert.notEqual(badge.textContent, 'AI 插图', `${day}: ${badge.closest('article')?.querySelector('h3')?.textContent}`);
    }
    for (const src of sources) assert.ok(!illustrations.has(src), `${day}: ${src} is an AI illustration`);
  }
  // The catalog ships no AI illustration; the 3D tile's postcard is labelled 3D 场景插图 and says how big the world is.
  for (const [key, image] of Object.entries(GUIDE_IMAGES)) assert.notEqual(image.kind, 'illustration', key);
  assert.match(serverHome().querySelector('a[href="/opus-bay?from=home"]')!.textContent!, /3D 场景插图.*约 8MB/s);
});

test('the feed holds the rest of the weekend: up to eight covers after the picks, each with place, source check and ♡', () => {
  const doc = serverHome();
  const weekend = getHomeWeekend(today);
  const cards = [...doc.querySelectorAll('.home-feed .ui-feed-card')];
  assert.ok(cards.length >= 4 && cards.length <= HOME_FEED_SIZE, `${cards.length} feed cards`);
  const pickIds = new Set(weekend.picks.map(pick => pick.event.id));
  cards.forEach((card, index) => {
    const { event, date } = weekend.feed[index];
    assert.equal(card.querySelector('h3 a')!.getAttribute('href'), `/events/${event.id}`);
    assert.ok(!pickIds.has(event.id), 'a pick is not repeated in the feed');
    assert.ok(eventOccursOn(event, date) && date >= today);
    assert.equal(card.querySelector('.ui-feed-card__trust')!.textContent, `官网核对 ${monthDay(event.verifiedAt)}`);
    assert.equal(card.querySelector('.saves-toggle')!.getAttribute('aria-label'), `收藏：${event.title}`);
  });
});

test('a compact home pool reports the entire weekend calendar count, including Sunday-only eligibility', () => {
  assert.ok(days.length > 0, 'the compact pool publishes calendar totals');
  assert.ok(days.some(day => new Date(`${day}T12:00:00Z`).getUTCDay() === 0), 'Sunday-only coverage is exercised');
  for (const day of days) {
    const weekend = getHomeWeekend(day);
    const remaining = [weekend.start, weekend.end].filter(item => item >= day);
    const actual = COMPLETE_EVENTS.filter(event => remaining.some(item => eventOccursOn(event, item))).length;
    assert.equal(weekend.total, actual, `${day} counts every eligible event in the published catalog`);
    assert.equal(weekend.picks.length, snapshots[day].ids.length, `${day}: every published pick is in the compact catalog`);
    assert.equal(weekend.feed.length, snapshots[day].feed.length, `${day}: every feed event is in the compact catalog`);
  }
});

test('an editor pick shows its reason under its cover, in Chinese and in English', async () => {
  const saturday = getHomeWeekend(today).start;
  const editorPicks = WEEKEND_PICKS as Record<string, readonly WeekendPickEntry[]>;
  const original = editorPicks[saturday];
  const second = snapshots[today].ids[1];
  editorPicks[saturday] = [{ id: second, reason: { zh: '测试理由', en: 'Test reason' } }];
  const reasonOf = (container: ParentNode, href: string) => [...container.querySelectorAll('.home-picks__list > li')]
    .find(item => item.querySelector(`a[href="${href}"]`))?.querySelector('.ui-hero-card__reason')?.textContent;
  const { setLocale } = await import('../src/i18n/locale');
  try {
    // The published snapshot keeps its ids; the reason is looked up from the editor list when the home renders.
    assert.equal(getHomeWeekend(today, MONTHLY_EVENTS, { picks: editorPicks }).picks[0].event.id, second);
    const view = render(<MemoryRouter><HomeDiscovery today={today} onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></MemoryRouter>);
    assert.equal(reasonOf(view.container, `/events/${second}`), '编辑推荐 测试理由');
    view.unmount();
    await setLocale('en', false);
    const english = render(<MemoryRouter basename="/en" initialEntries={['/en/']}><HomeDiscovery today={today} onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></MemoryRouter>);
    assert.equal(reasonOf(english.container, `/en/events/${second}`), 'Editor’s pick Test reason');
    english.unmount();
  } finally {
    await setLocale('zh-Hans', false);
    if (original) editorPicks[saturday] = original;
    else delete editorPicks[saturday];
  }
});

test('one ask box searches keywords and asks full questions; the BayBay card asks with one tap', () => {
  const searched: string[] = [], asked: string[] = [];
  const view = render(<MemoryRouter><HomeDiscovery today={today} onSearch={query => searched.push(query)} onAskBayBay={query => asked.push(query || '')} onBrowseCommunity={() => {}} /></MemoryRouter>);
  const input = view.getByRole('textbox', { name: '搜索活动、指南，或问 BayBay' });
  fireEvent.change(input, { target: { value: '  免费博物馆  ' } });
  assert.ok(within(view.getByRole('search')).getByRole('button', { name: '搜索' }));
  fireEvent.submit(view.getByRole('search'));
  assert.deepEqual(searched, ['免费博物馆']); assert.deepEqual(asked, []);
  fireEvent.change(input, { target: { value: '带爸妈去哪？' } });
  assert.ok(within(view.getByRole('search')).getByRole('button', { name: '问 BayBay' }));
  fireEvent.submit(view.getByRole('search'));
  assert.deepEqual(asked, ['带爸妈去哪？']);
  const card = within(view.getByRole('region', { name: '问 BayBay' }));
  fireEvent.click(card.getByRole('button', { name: /刚搬来湾区/ }));
  assert.equal(asked.at(-1), '刚搬来湾区，第一周先办哪几件事？');
});

test('长辈与家属 is the second intent; the choice is remembered and offers 发给家人（大字版） (HOMEIA-07, HOMEIA-08)', async () => {
  let browsed = 0;
  const view = render(<MemoryRouter><HomeDiscovery today={today} onAskBayBay={() => {}} onBrowseCommunity={() => browsed++} /></MemoryRouter>);
  const intents = within(view.getByRole('group', { name: '你想办什么' })).getAllByRole('button');
  assert.deepEqual(intents.map(button => button.textContent), ['周末出门', '长辈与家属', '新来安顿', '看病与保险', '日常办事']);
  assert.equal(intents[0].getAttribute('aria-pressed'), 'true');
  assert.equal(view.queryByRole('button', { name: '发给家人（大字版）' }), null);
  fireEvent.click(intents[1]);
  assert.equal(intents[1].getAttribute('aria-pressed'), 'true');
  assert.equal(dom.window.localStorage.getItem('baylink.home-intent.v1'), 'elders');
  const rail = view.getByRole('list', { name: '长辈与家属' });
  assert.ok(within(rail).getAllByRole('link').some(link => link.getAttribute('href') === '/guides/bay-area-chinese-senior-services-referral-guide'));
  assert.equal(view.getByRole('link', { name: /看全部「长辈与家属」指南/ }).getAttribute('href'), '/guides?topic=elders');
  // The family link: no share sheet here, so it copies; the link opens at 特大 with 简洁显示.
  let copied = '';
  Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied = text; } } });
  fireEvent.click(view.getByRole('button', { name: '发给家人（大字版）' }));
  await waitFor(() => assert.match(view.container.querySelector('.family-link__status')!.textContent!, /已复制大字版链接/));
  const url = new URL(copied.split('\n').at(-1)!);
  assert.equal(url.origin + url.pathname, 'https://www.baylink.us/guides');
  assert.equal(url.searchParams.get('topic'), 'elders');
  assert.equal(url.searchParams.get('from'), 'family');
  assert.equal(url.searchParams.get('reading'), 'extra-large');
  assert.equal(url.searchParams.get('simple'), '1');
  view.unmount();
  // The next visit opens on the remembered intent (read after the first render, so the prerender and hydration agree).
  const again = render(<MemoryRouter><HomeDiscovery today={today} onAskBayBay={() => {}} onBrowseCommunity={() => browsed++} /></MemoryRouter>);
  await waitFor(() => assert.equal(again.getByRole('button', { name: '长辈与家属' }).getAttribute('aria-pressed'), 'true'));
  fireEvent.click(again.getByRole('button', { name: '邻里信息（测试中）· 去看看' }));
  assert.equal(browsed, 1);
});

test('a Sunday never recommends yesterday and an empty future weekend offers an honest next step', () => {
  const sunday = days.find(day => new Date(`${day}T12:00:00Z`).getUTCDay() === 0)!;
  const weekend = getHomeWeekend(sunday);
  assert.ok([...weekend.picks, ...weekend.feed].every(entry => entry.date === sunday));
  const view = render(<MemoryRouter><HomeDiscovery today="2099-01-05" onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></MemoryRouter>);
  assert.equal(view.container.querySelectorAll('.home-picks__list').length, 0);
  assert.ok(view.getByText('这个周末暂没有已确认的活动，先看常设去处或换个日期。'));
  assert.equal(view.getByRole('link', { name: '按地区找景点' }).getAttribute('href'), '/explore');
  assert.equal(view.container.querySelector('.home-feed'), null);
  assert.equal(view.container.querySelector('.home-offers'), null, 'expired offers never look current');
});

test('the first cover is fetched first; English has the question H1 and English section names', async () => {
  const doc = serverHome();
  const first = doc.querySelector('.home-picks__list img.ui-cover__img');
  if (first) {
    assert.equal(first.getAttribute('fetchpriority'), 'high', 'the prerendered LCP image carries the hint for the preload scanner');
    assert.equal(first.getAttribute('loading'), 'eager');
  }
  assert.equal(doc.querySelectorAll('img[fetchpriority=high]').length, first ? 1 : 0);
  const { setLocale } = await import('../src/i18n/locale');
  try {
    await setLocale('en', false);
    const view = render(<MemoryRouter basename="/en" initialEntries={['/en/']}><HomeDiscovery today={today} onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></MemoryRouter>);
    assert.equal(view.getByRole('heading', { level: 1 }).textContent, 'Where to go in the Bay this weekend?');
    for (const heading of view.getAllByRole('heading', { level: 2 })) assert.doesNotMatch(heading.textContent!, /[㐀-鿿]/, heading.textContent!);
    assert.match(view.container.querySelector('.home-head__lede')!.textContent!, /events this weekend · \d+ how-to guides · every item with its official source, checked \d+\/\d+/);
    view.unmount();
  } finally {
    await setLocale('zh-Hans', false);
  }
});

test('home sends the weekend to /events and keeps an eager, client-side 按日历看 link (WEB-ROUTES, OPUS contract)', () => {
  const doc = serverHome();
  const moods = [...doc.querySelectorAll('.home-moods a')].map(link => [link.textContent, link.getAttribute('href')]);
  assert.deepEqual(moods.find(([label]) => label === '今天去哪'), ['今天去哪', '/events?when=today']);
  assert.deepEqual(moods.find(([label]) => label === '免费'), ['免费', '/events?cost=free']);
  assert.deepEqual(moods.find(([label]) => label === '按日历看'), ['按日历看', '/calendar']);
  assert.ok(![...doc.querySelectorAll('a')].some(link => /^\/this-week|^\/recommend|^\/play\b/.test(link.getAttribute('href')!)), 'no link into a redirect');
  for (const link of doc.querySelectorAll('a')) {
    if (link.querySelector('.lucide-arrow-up-right') || link.textContent!.includes('↗')) assert.equal(link.getAttribute('target'), '_blank', `internal link shows ↗: ${link.getAttribute('href')}`);
  }
  const view = render(<MemoryRouter initialEntries={['/']}><HomeDiscovery today={today} onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></MemoryRouter>);
  assert.equal(fireEvent.click(view.getByRole('link', { name: '按日历看' })), false, 'the router handles it (default prevented), no full page load');
});
