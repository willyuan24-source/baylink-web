import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getHomeWeekend, getWeeklyCardDays, getWeeklyCardHref, HOME_FEED_SIZE } from '../src/lib/home-weekend';
import { GUIDE_IMAGES, guideCount, HOME_WEEKENDS, MONTHLY_EVENTS } from '../src/lib/home-catalog';
import { WEEKEND_PICKS, type WeekendPickEntry } from '../src/data/weekend-picks';
import { addCalendarDays, eventOccursOn } from '../src/lib/event-calendar';
import { MONTHLY_EVENTS as COMPLETE_EVENTS } from '../src/data/monthly-edition';
import { AI_COVER_APPROVALS, GUIDE_IMAGES as COMPLETE_IMAGES } from '../src/data/guide-media';
import { guides as COMPLETE_GUIDES } from '../src/data/guides';
import { assertPoolSpacing, coversInPageOrder } from './support/cover-spacing';
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

test('the masthead asks the question under the weekend dateline; one identity line; the trust line names how dates are checked (UI9-HOME, G12)', () => {
  const doc = serverHome();
  const weekend = getHomeWeekend(today);
  assert.equal(doc.querySelectorAll('h1').length, 1);
  assert.equal(doc.querySelector('h1')!.textContent, '这个周末，湾区去哪？');
  const range = weekend.start.slice(0, 7) === weekend.end.slice(0, 7) ? `${monthDay(weekend.start)}–${Number(weekend.end.slice(8))}` : `${monthDay(weekend.start)}–${monthDay(weekend.end)}`;
  assert.equal(doc.querySelector('.home-head__dateline')!.textContent, `湾区本周末 · ${range}`);
  assert.equal(doc.querySelector('.home-head__dateline time')!.getAttribute('datetime'), weekend.start);
  assert.equal(doc.querySelector('.home-head__identity')!.textContent, '湾区华人家庭的周末活动与办事指南 · 免费 · 不用登录');
  assert.equal(doc.querySelector('.home-head__lede'), null, 'the dense lede is gone');
  // H02: when this weekend's events were checked, as checks against the official pages. The trust line names one day (UI9-HOME
  // arrangement: "✓ 多数 10/15 官网核对"): the day most were checked, or the day all were; the separator before
  // 我们怎么核对 is glued to the phrase before it (a no-break space), so a wrapped line never starts with "·"; a date never
  // breaks from the word before it.
  assert.ok(weekend.checked, 'the snapshot carries the check dates');
  const { mostly, all } = weekend.checked!;
  const trust = doc.querySelector('.home-picks .home-trust')!;
  assert.equal(trust.textContent, `✓ 每条附官方链接 · ✓ ${all === true ? '' : '多数\u00a0'}${monthDay(mostly)} 官网核对\u00a0· 我们怎么核对 →`);
  assert.doesNotMatch(trust.textContent!, /最近|最早/);
  assert.equal(trust.querySelector('a')!.getAttribute('href'), '/about#about-method-title', 'the only 我们怎么核对 anchor');
  assert.doesNotMatch(doc.body.textContent!, /人工核对|编辑核对/);
  assert.equal(guideCount, COMPLETE_GUIDES.length);
  assert.doesNotMatch(doc.querySelector('.home-head')!.textContent!, /San Francisco Bay Area/, 'no English eyebrow on the Chinese home');
});

test('the picks are the weekly share card’s three in order, each a cover, the time window, status · place, ✓ and ♡, never 加入这天计划 (FC3-02, decision 16)', () => {
  const doc = serverHome();
  const weekend = getHomeWeekend(today);
  const picks = [...doc.querySelectorAll('.home-picks__list > li')];
  assert.equal(picks.length, 3);
  picks.forEach((card, index) => {
    const { event, date } = weekend.picks[index];
    assert.equal(card.querySelector('h3 a')!.getAttribute('href'), `/events/${event.id}?date=${date}`, 'the detail opens on the occurrence the card shows');
    assert.ok(date >= today && eventOccursOn(event, date));
    assert.ok(card.querySelector('.ui-card-when')!.textContent!.includes(monthDay(date)), `${event.id}: line 1 is the date and time`);
    assert.equal(card.querySelector('.ui-feed-card__trust')!.textContent, `官网核对 ${monthDay(event.verifiedAt)}`);
    assert.equal(card.querySelector('.ui-hero-card'), null, 'one card anatomy: the caption under the cover, no text on the photo');
    assert.equal(card.querySelector('.saves-toggle')!.getAttribute('aria-label'), `收藏：${event.title}`);
    assert.equal(card.querySelector('.saves-add-day'), null, 'home picks drop 加入这天计划 (decision 16)');
    assert.equal(card.querySelector('a[href^="/plan"]'), null);
  });
  const all = doc.querySelector('.home-picks .home-picks__all')!;
  assert.equal(all.getAttribute('href'), '/events');
  assert.equal(all.textContent, `看本周末全部 ${weekend.total} 场`);
  // The date kicker sits inside the heading; a hidden separator keeps the heading's name from running together.
  const range = weekend.start.slice(0, 7) === weekend.end.slice(0, 7) ? `${monthDay(weekend.start)}–${Number(weekend.end.slice(8))}` : `${monthDay(weekend.start)}–${monthDay(weekend.end)}`;
  assert.equal(doc.querySelector('#home-picks-title')!.textContent, `本周末先看这几件，${range}`);
  assert.equal(doc.querySelector('.home-share a[download]')!.getAttribute('href'), getWeeklyCardHref(today));
});

test('the home shows no unapproved AI illustration, never leads with one, and shows no image twice (SV-04, VISUAL-10, UI9-IMAGES 22/24)', () => {
  // Since 2026-10-21 the owner-approved AI illustrations (src/data/ai-cover-approvals.json, ④) may cover a card, badged
  // AI 示意图; any other AI illustration stays out, and none takes the lead (DECISIONS 24).
  const approved = new Set(AI_COVER_APPROVALS.map(approval => approval.key));
  const approvedSrcs = new Set([...approved].map(key => COMPLETE_IMAGES[key].src));
  const illustrations = new Set(Object.entries(COMPLETE_IMAGES).filter(([key, image]) => image.kind === 'illustration' && !image.scene3d && !approved.has(key)).map(([, image]) => image.src));
  for (const day of days) {
    const doc = serverHome(day);
    const sources = [...doc.querySelectorAll('.home-discovery img.ui-cover__img')].map(img => img.getAttribute('src')!);
    // ①② images once per page; an approved AI picture is a ④ pool picture, which may come back only ADJACENT_CARDS or more
    // cards apart (cover.ts).
    const once = sources.filter(src => !approvedSrcs.has(src));
    assert.equal(new Set(once).size, once.length, `${day}: an image appears once`);
    assertPoolSpacing(coversInPageOrder(doc.querySelector('.home-discovery')!), approvedSrcs, day);
    const lead = doc.querySelector('.home-picks__list>li:first-child');
    assert.notEqual(lead?.querySelector('[data-provenance]')?.textContent, 'AI 示意图', `${day}: an AI illustration leads`);
    for (const img of lead?.querySelectorAll('img') ?? []) assert.ok(!approvedSrcs.has(img.getAttribute('src')!), `${day}: an AI illustration leads`);
    for (const src of sources) assert.ok(!illustrations.has(src), `${day}: ${src} is an unapproved AI illustration`);
  }
  // The catalog ships no unapproved AI illustration; the 3D tile's postcard is labelled 3D 场景插图 and says how big the world is.
  for (const [key, image] of Object.entries(GUIDE_IMAGES)) if (image.kind === 'illustration') assert.ok(approved.has(key), key);
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
    assert.equal(card.querySelector('h3 a')!.getAttribute('href'), `/events/${event.id}?date=${date}`);
    assert.ok(!pickIds.has(event.id), 'a pick is not repeated in the feed');
    assert.ok(eventOccursOn(event, date) && date >= today);
    assert.equal(card.querySelector('.ui-feed-card__trust')!.textContent, `官网核对 ${monthDay(event.verifiedAt)}`);
    assert.equal(card.querySelector('.saves-toggle')!.getAttribute('aria-label'), `收藏：${event.title}`);
  });
});

test('the 3D strip sits after the fourth feed card; it and the ⑨ tile both say 3D 旧金山 and 独立 3D 体验 (H36, OPUS contract)', async () => {
  const doc = serverHome();
  const items = [...doc.querySelector('.home-feed .ui-feed-card')!.closest('li')!.parentElement!.children];
  const strip = items.findIndex(item => item.querySelector('.home-3d-strip'));
  assert.equal(strip, 4, 'four cards, then the strip');
  assert.equal(items.slice(0, 4).every(item => item.querySelector('.ui-feed-card')), true);
  const links = [...doc.querySelectorAll('a[href="/opus-bay?from=home"]')];
  assert.equal(links[0].classList.contains('home-3d-strip'), true, 'the first from=home link is now the feed strip');
  const tile = doc.querySelector('.home-3d')!;
  assert.ok(tile, 'the ⑨ tile is still rendered eagerly');
  for (const text of [links[0].textContent!, tile.textContent!]) {
    assert.match(text, /3D 旧金山/);
    assert.match(text, /独立 3D 体验/);
  }
  const { WeekendFeed } = await import('../src/features/home/WeekendFeed');
  assert.equal(renderToStaticMarkup(<StaticRouter location="/"><WeekendFeed feed={[]} covers={[]} tones={[]} today={today} total={0} /></StaticRouter>), '', 'no feed, no strip');
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
    .find(item => item.querySelector(`a[href^="${href}?date="]`))?.querySelector('.home-pick__reason')?.textContent;
  const { setLocale } = await import('../src/i18n/locale');
  try {
    // The published snapshot keeps its ids; the reason is looked up from the editor list when the home renders.
    assert.equal(getHomeWeekend(today, MONTHLY_EVENTS, { picks: editorPicks }).picks[0].event.id, second);
    const view = render(<MemoryRouter><HomeDiscovery today={today} onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></MemoryRouter>);
    assert.equal(reasonOf(view.container, `/events/${second}`), '编辑推荐：测试理由');
    view.unmount();
    await setLocale('en', false);
    const english = render(<MemoryRouter basename="/en" initialEntries={['/en/']}><HomeDiscovery today={today} onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></MemoryRouter>);
    assert.equal(reasonOf(english.container, `/en/events/${second}`), 'Editor’s pick: Test reason');
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
  // 日常办事 spans several topics, so its way on is the whole library, not one topic's list.
  fireEvent.click(again.getByRole('button', { name: '日常办事' }));
  assert.equal(again.getByRole('link', { name: /看全部办事指南/ }).getAttribute('href'), '/guides');
  assert.equal(again.queryByRole('link', { name: /看全部「住房」指南/ }), null);
});

test('a Sunday never recommends yesterday and a published weekend without events offers an honest next step', () => {
  const sunday = days.find(day => new Date(`${day}T12:00:00Z`).getUTCDay() === 0)!;
  const weekend = getHomeWeekend(sunday);
  assert.ok([...weekend.picks, ...weekend.feed].every(entry => entry.date === sunday));
  // A snapshot day whose weekend really has nothing: the build counted the whole catalog, so the sentence is true.
  snapshots['2099-01-05'] = { ids: [], feed: [], total: 0 };
  try {
    const view = render(<MemoryRouter><HomeDiscovery today="2099-01-05" onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></MemoryRouter>);
    assert.equal(view.container.querySelectorAll('.home-picks__list').length, 0);
    assert.ok(view.getByText('这个周末暂没有已确认的活动，先看常设去处或换个日期。'));
    assert.equal(view.getByRole('link', { name: '按地区找景点' }).getAttribute('href'), '/explore');
    assert.equal(view.container.querySelector('.home-picks__all')!.textContent, '看本周末全部活动', 'never "全部 0 场"');
    assert.equal(view.getByRole('link', { name: '看日历' }).getAttribute('href'), '/calendar');
    assert.equal(view.container.querySelector('.home-feed'), null);
    assert.equal(view.container.querySelector('.home-offers'), null, 'expired offers never look current');
  } finally {
    delete snapshots['2099-01-05'];
  }
});

test('past the published snapshots the home claims no count and no empty weekend: it points to /events', () => {
  // The compact pool only holds the events some snapshot day shows; a day after the last one (no deploy for weeks) must
  // not print a short count or say the weekend is empty while /events lists events.
  const after = addCalendarDays(days.at(-1)!, 1);
  assert.equal(getHomeWeekend(after).total, null);
  const doc = serverHome(after);
  assert.doesNotMatch(doc.querySelector('.home-head')!.textContent!, /场/);
  assert.equal(doc.querySelector('.home-head__dateline time')!.getAttribute('datetime'), after, 'an unknown weekend: today’s date');
  assert.equal(doc.querySelector('.home-picks__all')!.textContent, '看本周末全部活动');
  const all = doc.querySelector('.home-feed__all');
  if (all) assert.equal(all.textContent, '看本周末全部活动');
  assert.doesNotMatch(doc.body.textContent!, /暂没有已确认的活动|全部 \d+ 场|看本周末全部 \d+ 场/);
  // Far past the edition: nothing in the pool, and still no claim, only the way to the whole catalog.
  const later = serverHome('2099-01-05');
  assert.equal(later.querySelector('.home-picks__list'), null);
  assert.equal(later.querySelector('.home-picks__all')!.getAttribute('href'), '/events');
  assert.equal(later.querySelector('.home-picks__all')!.textContent, '看本周末全部活动');
  assert.doesNotMatch(later.body.textContent!, /暂没有已确认的活动/);
  // The lead's slot is a text panel then (no blank columns beside the masthead on a desktop), with 看日历 and 按地区找景点.
  assert.deepEqual([...later.querySelectorAll('.home-empty a')].map(link => link.getAttribute('href')), ['/calendar', '/explore']);
  assert.equal(later.querySelector('.home-empty')!.getAttribute('data-date-scope'), 'weekend');
  // A snapshot day keeps its count.
  assert.equal(getHomeWeekend(today).total, snapshots[today].total);
});

test('the family-chat card is offered only on days the build wrote it for, never an earlier weekend’s card', () => {
  const cardDays = getWeeklyCardDays();
  assert.ok(cardDays.includes(today), 'the first snapshot day has its dated card');
  assert.equal(serverHome().querySelector('.home-share a[download]')!.getAttribute('href'), `/weekly/all-${today}.png`);
  // A snapshot day after the card week (no deploy since): the undated /weekly/all.png shows the build weekend's three.
  const late = days.find(day => !cardDays.includes(day) && snapshots[day].ids.length > 0);
  if (late) {
    const doc = serverHome(late);
    assert.ok(doc.querySelector('.home-picks__list'), `${late}: the picks still show`);
    assert.equal(doc.querySelector('.home-share a[download]'), null, `${late}: no card for another weekend`);
    // UI9-HOME: the card's place holds 看本周末全部 and 订阅日历 instead, so the desktop row beside picks 2–3 is never blank.
    const fallback = doc.querySelector('.home-share')!;
    assert.equal(fallback.getAttribute('data-simple'), 'hide');
    assert.equal(fallback.getAttribute('data-date-scope'), 'weekend');
    assert.deepEqual([...fallback.querySelectorAll('a')].map(link => link.getAttribute('href')), ['/events', 'webcal://www.baylink.us/calendars/all.ics']);
    assert.match(fallback.querySelector('a[href="/events"]')!.textContent!, /^看本周末全部(?: \d+ 场|活动)$/);
  }
  assert.equal(serverHome(addCalendarDays(days.at(-1)!, 1)).querySelector('.home-share a[download]'), null);
});

test('every offer ticket names its brand and kind, its source check and a ♡ that saves it (FC3-03)', () => {
  const doc = serverHome();
  const tickets = [...doc.querySelectorAll('.home-offers__rail > li')];
  assert.ok(tickets.length > 0, 'the snapshot day has tickets');
  for (const ticket of tickets) {
    assert.match(ticket.querySelector('.ui-feed-card__trust')!.textContent!, /^官网核对 \d+\/\d+$/);
    assert.match(ticket.querySelector('.saves-toggle')!.getAttribute('aria-label')!, /^收藏：/);
  }
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
    assert.equal(view.container.querySelector('.home-head__identity')!.textContent, 'Weekend outings and how-to guides for Chinese families in the Bay Area · Free · no sign-in');
    assert.match(view.container.querySelector('.home-trust')!.textContent!, /^✓ An official link on every item · ✓ Source checked(?::)? (?:mostly )?[A-Z][a-z]{2}\u00a0\d+\u00a0· How we check →$/);
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
