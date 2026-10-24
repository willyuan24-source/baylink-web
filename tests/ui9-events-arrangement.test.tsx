import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

// UI9-EVENTS (UI-9 phase 3, events lane): the content arrangement of /events, /this-month and /calendar — the lead that
// never repeats home's, the rails, the 2-line card meta, the list end, the page end and the stylesheet rules.
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/events' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup, fireEvent, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { EventsView } = await import('../src/components/EventsView');
const { default: CalendarPage } = await import('../src/pages/CalendarPage');
const model = await import('../src/features/events/events-model');
const { arrangePicks, homeLeadFor, canLead, CLOSE_UP_FACE_IMAGES, NOT_FOR_LEAD, leadImageKey } = await import('../src/features/events/weekend-lead');
const { RELEASED_CLOSE_UPS } = await import('../src/lib/close-up-faces');
const { dayWhenLine } = await import('../src/features/events/event-lines');
const { ImageCredits } = await import('../src/features/events/ImageCredits');
const { FeedGrid } = await import('../src/components/ui/FeedGrid');
const { DayChips } = await import('../src/components/ui/Segmented');
const { getMonthlyDateRange, nextOccurrence } = await import('../src/lib/monthly');
const { addCalendarDays } = await import('../src/lib/calendar-days');
const { READING_SIZE_KEY, SIMPLE_DISPLAY_KEY } = await import('../src/lib/reading-preferences');
const { TrustLine, EventFeedCard } = await import('../src/features/events/EventCards');
const { isPressSource } = await import('../src/features/events/source-kind');
const { PLANNER_EVENTS } = await import('../src/data/planner-catalog');
const { GUIDE_IMAGES } = await import('../src/data/guide-media');

afterEach(() => { cleanup(); localStorage.clear(); });

// The generated data's own day (`npm test` regenerates the home catalog and the events index on the run day in pretest), so
// the day the test reads is always one the catalog has; the weekend and its labels follow from it.
const homeCatalog = JSON.parse(readFileSync('src/data/generated/home-catalog.json', 'utf8')) as { generatedAt: string; weekends: Record<string, { ids: string[] }> };
const today = homeCatalog.generatedAt;
const weekend = getMonthlyDateRange('weekend', today)!;
const md = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
const weekday = (day: string) => `周${'日一二三四五六'[new Date(`${day}T12:00:00Z`).getUTCDay()]}`;
const page = (location: string) => render(<MemoryRouter initialEntries={[location]}><EventsView today={today} /></MemoryRouter>);
const titles = (root: ParentNode, selector: string) => [...root.querySelectorAll(`${selector} a.ui-card-link`)].map(link => link.getAttribute('href')!.replace(/^\/events\/|\?.*$/g, ''));

test('the index carries home\'s lead per day, and the /events lead and pick rows never repeat it', () => {
  const leads = model.EVENTS_INDEX.homeLeads ?? {};
  for (const [day, id] of Object.entries(leads)) assert.equal(id, homeCatalog.weekends[day]?.ids[0], day);
  const weekendEvents = model.INDEX_EVENTS.filter(event => [weekend.start, weekend.end].some(day => nextOccurrence(event, day) === day));
  const picks = model.weekendPicks(weekendEvents, today, { limit: 5 });
  const home = homeLeadFor(today, picks);
  // As the page: the weekend in its ranking is where the lead comes from when no pick has a lead photo (DECISIONS 26/32).
  const { lead, rows } = arrangePicks(picks, today, home, model.weekendRanked(weekendEvents, today));
  assert.ok(lead, 'a lead');
  assert.notEqual(lead!.event.id, home, 'never home\'s lead');
  assert.ok(!rows.some(item => item.event.id === home), 'home\'s lead is no pick row');
  assert.ok(!NOT_FOR_LEAD.has(lead!.event.imageKey), 'no close-up face or posed group leads');
  assert.equal(canLead(lead!.event, today), true, 'the lead has a ① or ② photograph (DECISIONS 32)');
  // A pick whose photo shows close-up faces never leads, even when it is first: put the lead's own photo on the list, for
  // this check only (the pages read the shared list).
  const face = { ...lead!, event: { ...lead!.event, id: 'x-face' } };
  assert.equal(canLead(face.event, today), true, 'as it ships, the photo leads');
  assert.equal(canLead(face.event, today, new Set([face.event.imageKey!])), false, 'listed, it cannot lead');
  const flagged = NOT_FOR_LEAD as Set<string>;
  flagged.add(face.event.imageKey!);
  try {
    assert.equal(canLead(face.event, today), false);
    assert.notEqual(arrangePicks([face, ...picks], today, 'none', model.weekendRanked(weekendEvents, today)).lead?.event.id, 'x-face', 'the next event that can lead leads');
  } finally { flagged.delete(face.event.imageKey!); }
  assert.equal(arrangePicks([face, ...picks], today, 'none').lead?.event.id, 'x-face', 'off the list, it leads');
  // With no entry for the day, the first weekend pick is home's lead.
  assert.equal(homeLeadFor('2099-01-01', picks, {}), picks[0].event.id);
});

test('the /events first screen never holds home\'s lead or all three of home\'s picks; the lead is the page\'s one high-priority image', () => {
  const view = page('/events');
  const home = homeCatalog.weekends[today].ids;
  const picks = view.container.querySelector('.ev-picks')!;
  const shown = [...new Set([...titles(picks, '.ev-lead'), ...titles(picks, '.ev-picks__rows')])];
  assert.ok(!shown.includes(home[0]), `home lead ${home[0]} not in ${shown.join(', ')}`);
  assert.ok(!home.every(id => shown.includes(id)), 'not all three of home\'s picks');
  assert.equal(view.container.querySelectorAll('img[fetchpriority="high"]').length <= 1, true);
  const leadImage = view.container.querySelector('.ev-lead img');
  if (leadImage) assert.equal(leadImage.getAttribute('fetchpriority'), 'high');
  // The picks heading keeps H26's text and id; no carousel and no story circles are left.
  assert.match(view.container.querySelector('#ev-picks-heading')!.textContent!, /^(编辑精选|本周末先看)$/);
  assert.equal(view.container.querySelector('.ui-carousel, .ev-stories, .ev-story'), null);
  // No pick repeats in the feed's first page.
  const feed = titles(view.container, '.ev-feed .ui-feed-card');
  for (const id of shown) assert.ok(!feed.includes(id), `${id} once`);
});

test('rail 1: one radio group of dates (本周末 = the whole weekend, checked on arrival; radios never uncheck), 免费 · 亲子 · 长辈友好 and 筛选 counting only sheet choices', () => {
  const view = page('/events');
  const rail = view.container.querySelector('.ev-rail')!;
  const radios = () => within(within(rail as HTMLElement).getByRole('radiogroup', { name: '选择日期' })).getAllByRole('radio');
  const days = [...(weekend.start >= today ? [weekend.start] : []), weekend.end];
  const dayLabel = (day: string) => day === today ? `今天 · ${weekday(day)} ${md(day)}` : `${weekday(day)} ${md(day)}`;
  const state = () => radios().map(radio => [radio.textContent, radio.getAttribute('aria-checked')]);
  assert.deepEqual(state(), [['本周末', 'true'], ['未来 7 天', 'false'], ['全部日期', 'false'], ...days.map(day => [dayLabel(day), 'false']), ['两天都开放', 'false']]);
  assert.deepEqual(radios().map(radio => radio.getAttribute('tabindex')).filter(index => index === '0').length, 1);
  assert.equal(radios()[0].getAttribute('tabindex'), '0', 'the checked radio takes the tab stop');
  // The weekend's days sit in .ev-days (tests/prod-w3-fixes.test.tsx reads it), inside the same group.
  assert.equal(within(rail.querySelector('.ev-days') as HTMLElement).getAllByRole('radio').length, days.length + 1);
  // A day checks; a second click keeps it checked (a radio, not a toggle); 本周末 is the whole weekend again.
  fireEvent.click(radios()[3]);
  assert.equal(radios()[3].getAttribute('aria-checked'), 'true');
  assert.equal(radios()[0].getAttribute('aria-checked'), 'false');
  fireEvent.click(radios()[3]);
  assert.equal(radios()[3].getAttribute('aria-checked'), 'true', 'a click never unchecks');
  fireEvent.keyDown(radios()[3], { key: 'ArrowLeft' });
  assert.equal(radios()[2].getAttribute('aria-checked'), 'true', 'arrow keys move and select, across the scopes too');
  cleanup();
  const again = page('/events?day=sun');
  const back = within(again.container.querySelector('.ev-rail') as HTMLElement).getByRole('radio', { name: '本周末' });
  fireEvent.click(back);
  assert.equal(back.getAttribute('aria-checked'), 'true');
  assert.equal(again.container.querySelectorAll('.ev-days [aria-checked=true]').length, 0);
  cleanup();
  page('/events');
  const rail1 = document.querySelector('.ev-rail')!;
  for (const label of ['免费', '亲子', '长辈友好']) assert.ok(within(rail1 as HTMLElement).getByRole('button', { name: label }));
  for (const label of ['户外', '演出', '市集', '南瓜季', '下雨也行']) assert.equal(within(rail1 as HTMLElement).queryByRole('button', { name: label }), null, `${label} is in the sheet`);
  // No counts on the need chips (DECISIONS 19); 筛选 has no count when nothing was chosen in the sheet.
  assert.equal(rail1.querySelectorAll('.ui-chip__count').length, 0);
  // The list names the whole weekend: its count matches the facts line's.
  const facts = document.querySelector('.ev-lede-facts')!.textContent!.replace(/\u00a0/g, ' ');
  const status = document.querySelector('.ev-count')!.textContent!;
  assert.equal(/^(\d+) 场/.exec(facts)![1], /找到 (\d+) 场/.exec(status)![1]);
  for (const when of ['next7', 'all']) {
    cleanup();
    const list = page(`/events?when=${when}`);
    assert.equal(list.container.querySelectorAll('.ev-rail .ui-chip__count').length, 0, `${when}: no 筛选 1 when nothing is chosen`);
    assert.equal(within(list.container.querySelector('.ev-rail') as HTMLElement).getByRole('radio', { checked: true }).textContent, when === 'next7' ? '未来 7 天' : '全部日期');
    assert.equal(list.container.querySelector('.ev-days'), null, 'the days are the weekend\'s only');
    assert.equal(model.sheetFilterCount(model.readFilters(new URLSearchParams(`when=${when}`), 'weekend')), 0);
  }
});

test('a sheet choice shows on rail 1 as a removable chip, and 筛选 counts it', () => {
  const view = page('/events?tag=indoor');
  const chip = within(view.container.querySelector('.ev-rail') as HTMLElement).getByRole('button', { name: '清除：下雨也行' });
  assert.equal(chip.getAttribute('aria-pressed'), 'true');
  assert.match(within(view.container.querySelector('.ev-rail') as HTMLElement).getByRole('button', { name: /筛选/ }).textContent!, /1/);
  fireEvent.click(chip);
  assert.equal(within(view.container.querySelector('.ev-rail') as HTMLElement).queryByRole('button', { name: '清除：下雨也行' }), null);
});

test('next7 and 全部日期: no repeated H2 活动, cards under day subheads, line 1 is the time window', () => {
  const view = page('/events?when=next7');
  const visibleH2 = [...view.container.querySelectorAll('h2')].filter(h2 => !h2.classList.contains('ui-visually-hidden')).map(h2 => h2.textContent);
  assert.ok(!visibleH2.includes('活动'), visibleH2.join(' | '));
  const heads = [...view.container.querySelectorAll('.ev-day__head')].map(head => head.textContent!);
  assert.ok(heads.length >= 1);
  assert.match(heads[0], /^(今天 · )?周[一二三四五六日] \d+\/\d+ · \d+ 场$/);
  for (const line of view.container.querySelectorAll('.ev-day .ui-card-when')) assert.doesNotMatch(line.textContent!, /^·/);
  assert.ok(within(view.container.querySelector('.ev-list-end') as HTMLElement).getByRole('link', { name: /日历/ }));
});

test('the two meta lines: line 1 one pattern, line 2 status · place in the one status map, never a leading "·"', () => {
  const view = page('/events');
  const cards = [...view.container.querySelectorAll('.ev-feed .ui-feed-card')];
  assert.ok(cards.length >= 4);
  for (const card of cards) {
    const when = card.querySelector('.ui-card-when')!.textContent!;
    assert.match(when, /^(周[一二三四五六日] \d+\/\d+( · .+)?|\d+\/\d+–\d+ 周.–周.|\d+\/\d+ 起|至 \d+\/\d+)$/, when);
    const meta = card.querySelector('.ui-feed-card__meta')!;
    assert.doesNotMatch(meta.textContent!, /^\s*·/);
    assert.equal(meta.querySelector('strong'), null, 'the free price is a status chip, not <strong>');
    const status = meta.querySelector('.ui-status');
    if (status) assert.ok(['free', 'partial'].includes(status.getAttribute('data-tone')!));
    // The per-card check stays; a press-sourced event says so instead of 官网核对 (DECISIONS 17).
    assert.match(card.querySelector('.ui-feed-card__trust')!.textContent!, /^(官网核对 \d+\/\d+|媒体报道 · \d+\/\d+ 核对)$/);
  }
});

test('one-day lists print the time window; a long run reads 至 M/D', () => {
  const event = model.INDEX_EVENTS.find(item => item.occurrenceDates === undefined && !item.sessions?.length && item.endDate > '2026-11-30' && item.startDate < today)!;
  assert.ok(event, 'a long-running event');
  assert.match(dayWhenLine(event, today, today).zh, /^至 \d+\/\d+( · .+)?$/);
  const timed = model.INDEX_EVENTS.find(item => item.sessions?.some(session => session.start && session.end && session.date >= today));
  if (timed) {
    const day = timed.sessions!.find(session => session.start && session.end && session.date >= today)!.date;
    assert.doesNotMatch(dayWhenLine(timed, today, day).zh, /周/, 'no date in a one-day list');
  }
});

test('the list end says what is shown and how it is sorted, with one secondary 再看 N 场 and the next day', () => {
  const saturday = weekend.start >= today;
  const view = page(`/events?day=${saturday ? 'sat' : 'sun'}`);
  const end = view.container.querySelector('.ev-list-end')!;
  assert.match(end.querySelector('.ev-list-end__count')!.textContent!, /^已显示 \d+ \/ \d+ 场 · 按推荐排列$/);
  const more = within(end as HTMLElement).queryByRole('button', { name: /^再看 \d+ 场$/ });
  if (more) assert.equal(more.getAttribute('data-variant'), 'secondary');
  assert.ok(within(end as HTMLElement).getByRole('link', { name: saturday ? `${weekday(weekend.end)} ${md(weekend.end)} 的活动` : '下周末' }));
});

test('every event of the weekend list is on the page once — the lead, the picks the layout shows, the feed — and 已显示 counts what is there (standard phone and desktop, 简洁)', () => {
  for (const simple of [false, true]) {
    if (simple) { localStorage.setItem(SIMPLE_DISPLAY_KEY, '1'); document.documentElement.setAttribute('data-simple', ''); }
    try {
      const view = page('/events');
      const total = Number(/找到 (\d+) 场/.exec(view.container.querySelector('.ev-count')!.textContent!)![1]);
      for (let guard = 0; guard < 60 && view.container.querySelector('.ev-list-end__more'); guard++) fireEvent.click(view.container.querySelector('.ev-list-end__more')!);
      const lead = titles(view.container, '.ev-lead');
      const cards = titles(view.container, '.ev-picks__cards');
      const rows = titles(view.container, '.ev-picks__rows');
      const feed = titles(view.container, '.ev-feed');
      // A standard phone shows the 2-up cards and the third pick row (events.css); desktop and 大 / 特大 show the rows.
      const layouts = simple ? { simple: [...lead, ...feed] } : { phone: [...lead, ...cards, ...rows.slice(2), ...feed], desktop: [...lead, ...rows, ...feed] };
      for (const [name, shown] of Object.entries(layouts)) {
        assert.equal(new Set(shown).size, shown.length, `${name}: each event once`);
        assert.equal(shown.length, total, `${name}: ${shown.length} on the page, ${total} found`);
      }
      if (simple) assert.equal(view.container.querySelector('.ev-picks__more'), null, 'no pick rows to hide in 简洁显示');
      assert.match(view.container.querySelector('.ev-list-end__count')!.textContent!, new RegExp(`^已显示 ${total} / ${total} 场`));
    } finally { cleanup(); localStorage.clear(); document.documentElement.removeAttribute('data-simple'); }
  }
  const css = readFileSync('src/features/events/events.css', 'utf8');
  assert.match(css, /html:not\(\[data-reading=large\],\[data-reading=extra-large\],\[data-simple\]\) \.ev-picks__rows>:nth-child\(-n\+2\) \{ display:none; \}/, 'a standard phone hides only the rows the cards repeat');
});

test('a press report never says 官网核对: the index flags it from the source label, its card reads 媒体报道 · M/D 核对, a list head counts it (DECISIONS 17)', () => {
  for (const event of model.EVENTS_INDEX.events) {
    const source = PLANNER_EVENTS.find(item => item.id === event.id)!;
    assert.equal(!!event.press, isPressSource(source.sourceLabel), event.id);
  }
  assert.equal(render(<TrustLine day="2026-09-29" press />).container.textContent, '媒体报道 · 9/29 核对');
  cleanup();
  assert.equal(render(<TrustLine day="2026-09-29" />).container.textContent, '官网核对 9/29');
  cleanup();
  const report = model.INDEX_EVENTS.find(event => event.press);
  if (report) {
    const card = render(<MemoryRouter><EventFeedCard event={report} cover={{ tier: 'type' } as never} today={today} /></MemoryRouter>);
    assert.match(card.container.querySelector('.ui-feed-card__trust')!.textContent!, /^媒体报道 · \d+\/\d+ 核对$/);
    cleanup();
  }
  // 新店: some openings come from press reports — their cards say 媒体报道 · M/D 核对 (above); the head makes no 每条附官方链接
  // promise and no press count, for any reader (UI9-R1 AFTER-A1: no check summary in the head, not even screen-reader text).
  const facts = page('/events?view=openings').container.querySelector('.ev-lede-facts')!;
  assert.equal(facts.textContent!.replace(/\u00a0/g, ' '), `${model.INDEX_OPENINGS.length} 家新店与开业消息 · 我们怎么核对`);
  assert.equal(facts.querySelector('.sr-only'), null);
});

test('page end: alerts in the shared Disclosure, one quiet list of links, 本页图片来源 with its NAV hook', () => {
  const view = page('/events');
  const end = view.container.querySelector('nav.ev-end')!;
  const links = [...end.querySelectorAll('a.ev-end__item')].map(link => link.textContent);
  assert.deepEqual(links, ['存成一张图：本周末精选', '订阅到手机日历（只含活动日期）', '免费与优惠', '新店', '半日慢游去处', '出门前读一篇指南']);
  const credits = view.container.querySelector('#page-credits')!;
  assert.ok(credits.hasAttribute('data-credits-at-end'));
  assert.equal(Number(credits.getAttribute('data-count')), credits.querySelectorAll('li').length);
  assert.equal(view.container.querySelectorAll('.ui-cover-credit, [data-cover="type"]').length, 0, 'every card is a picture (UI9-IMAGES DECISIONS 21)');
  assert.doesNotMatch(credits.textContent!, /BAYLINK 信息卡/);
  const alerts = view.container.querySelector('.ev-alerts');
  if (alerts) assert.ok(alerts.querySelector('details.ui-disclosure'));
});

test('ImageCredits credits each picture once and says nothing for a frame without one; FeedGrid prints no note', () => {
  const credits = render(<ImageCredits covers={[{ tier: 'type' } as never]} />);
  assert.equal(credits.container.querySelector('#page-credits'), null);
  cleanup();
  assert.equal(render(<FeedGrid label="x"><li>a</li></FeedGrid>).container.querySelector('.ui-cover-credit'), null);
});

test('DayChips: a radio group on the chip look, none checked gives the first the tab stop, arrows select, a click never unchecks; `part` wraps the later radios in the same group', () => {
  const chosen: string[] = [];
  const view = render(<DayChips label="day" value="" items={[{ id: 'sat', label: '周六' }, { id: 'sun', label: '周日' }]} onChange={id => chosen.push(id)} />);
  const radios = view.getAllByRole('radio');
  assert.deepEqual(radios.map(radio => [radio.className, radio.getAttribute('tabindex')]), [['ui-chip', '0'], ['ui-chip', '-1']]);
  fireEvent.keyDown(radios[0], { key: 'ArrowRight' });
  assert.deepEqual(chosen, ['sun']);
  cleanup();
  const parted = render(<DayChips label="d" value="b" items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }]} onChange={id => chosen.push(id)} part={{ from: 1, className: 'later' }} />);
  assert.equal(parted.getAllByRole('radiogroup').length, 1);
  assert.deepEqual([...parted.container.querySelectorAll('.later [role=radio]')].map(radio => radio.textContent), ['B', 'C']);
  fireEvent.click(parted.getByRole('radio', { name: 'B' }));
  assert.deepEqual(chosen, ['sun'], 'clicking the checked radio changes nothing');
});

test('简洁显示 and 家人版 show fewer cards per page (6 and 4) and mark what they hide', () => {
  localStorage.setItem(SIMPLE_DISPLAY_KEY, '1');
  document.documentElement.setAttribute('data-simple', '');
  try {
    const simple = page('/events');
    // rows (a 112px 4:3 thumbnail), no ♡ on them (DECISIONS 16)
    assert.equal(simple.container.querySelectorAll('.ev-feed .ui-row-card').length, 6);
    assert.equal(simple.container.querySelectorAll('.ev-feed .ui-row-card button').length, 0);
    // The date radios keep 本周末 (the whole weekend) and the days; the other scopes stay in the sheet.
    const dates = within(simple.container.querySelector('.ev-rail') as HTMLElement).getAllByRole('radio').map(radio => radio.textContent);
    assert.equal(dates[0], '本周末');
    assert.ok(!dates.includes('未来 7 天') && !dates.includes('全部日期'), dates.join(' | '));
    cleanup();
    // A tag that is on stays on the rail in 简洁显示 (home's 亲子 / 长辈友好 links), so it shows and can be cleared.
    const kids = page('/events?tag=kids');
    const kidsChip = within(kids.container.querySelector('.ev-rail') as HTMLElement).getByRole('button', { name: '亲子' });
    assert.equal(kidsChip.getAttribute('data-simple'), null);
    assert.equal(within(kids.container.querySelector('.ev-rail') as HTMLElement).getByRole('button', { name: '长辈友好' }).getAttribute('data-simple'), 'hide');
    cleanup();
    localStorage.setItem(READING_SIZE_KEY, 'extra-large');
    const family = page('/events');
    assert.equal(family.container.querySelectorAll('.ev-feed .ui-row-card').length, 4);
    assert.match(family.container.querySelector('.ev-list-end__more')!.textContent!, /^再看 4 场$/);
  } finally { document.documentElement.removeAttribute('data-simple'); }
});

test('/calendar: the week range opens the sheet, the day head carries 列表 | 地图, a city rail of the top 4 + 更多城市, rows 12 at a time', async () => {
  const day = addCalendarDays(today, 5);
  const view = render(<MemoryRouter initialEntries={[`/calendar?date=${day}`]}><CalendarPage today={today} /></MemoryRouter>);
  assert.match(view.container.querySelector('.ev-range')!.textContent!, /^按日期看 · 收录至 /);
  const head = view.container.querySelector('.ev-calendar__head')!;
  // The day in the site's one date pattern (N06: 10/27 周二), the count after a no-break "·".
  assert.equal(head.querySelector('h2')!.textContent!.replace(/\u00a0· \d+ 场$/, ''), `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))} ${weekday(day)}`);
  assert.ok(head.querySelector('.ev-calendar__mode'));
  const cities = view.container.querySelector('.ev-cities');
  if (cities) {
    const chips = [...cities.querySelectorAll('button')].map(button => button.textContent);
    assert.equal(chips[0], '全部');
    assert.ok(chips.length <= 6);
    assert.equal(cities.querySelectorAll('.ui-chip__count').length, 0);
  }
  const rows = view.container.querySelectorAll('.ev-calendar__rows .ui-row-card');
  assert.ok(rows.length <= 12);
  for (const row of rows) assert.ok(row.querySelector('.ui-row-card__trust'), 'each row keeps ✓ 官网核对');
  // The head names no check dates: each row prints its own (UI9-R1 AFTER-A1); the facts line is the link alone.
  assert.equal(view.container.querySelector('.ev-lede-facts')!.textContent, '我们怎么核对');
  const end = view.container.querySelector('.ev-calendar__end');
  const next = addCalendarDays(day, 1);
  if (end) {
    assert.match(end.textContent!, /已显示 \d+ \/ \d+ 场/);
    // Another day's next day goes by its date; 明天 is said only from today's list.
    assert.ok(within(end as HTMLElement).getByRole('link', { name: `${md(next)} ${weekday(next)}` }));
    assert.equal(within(end as HTMLElement).queryByRole('link', { name: /明天/ }), null);
    assert.ok(within(end as HTMLElement).getByRole('button', { name: '让 BayBay 帮我安排这一天' }));
  }
  fireEvent.click(view.container.querySelector('.ev-week__range')!);
  assert.ok(await view.findByRole('dialog', {}, { timeout: 5000 }));
  cleanup();
  const todayEnd = render(<MemoryRouter initialEntries={['/calendar']}><CalendarPage today={today} /></MemoryRouter>).container.querySelector('.ev-calendar__end');
  if (todayEnd) assert.ok(within(todayEnd as HTMLElement).getByRole('link', { name: `明天 ${md(addCalendarDays(today, 1))}` }));
});

test('/calendar: a close-up face photo or a poster never leads a day (DECISIONS 15/32: the Ferry Plaza vendor led 10/20, 10/22, 10/27, 10/29)', () => {
  // The owner released the Ferry Plaza photo with the other five flagged close-ups in chat on 2026-10-21 (「圖片全部批准」);
  // DECISIONS 32 (round 2) keeps it, released, out of the lead slots.
  assert.ok(RELEASED_CLOSE_UPS.has('official-ferry-plaza-farmers-market-2026-autumn'));
  assert.equal(NOT_FOR_LEAD.has('official-ferry-plaza-farmers-market-2026-autumn'), true);
  assert.equal(CLOSE_UP_FACE_IMAGES.has('official-ferry-plaza-farmers-market-2026-autumn'), true);
  const byId = new Map(model.INDEX_EVENTS.map(event => [event.id, event]));
  const stemOf = (key: string | undefined) => (key && GUIDE_IMAGES[key]?.src || '').replace(/\.webp$/, '');
  for (let offset = 0; offset < 7; offset++) {
    const day = addCalendarDays(today, offset);
    const view = render(<MemoryRouter initialEntries={[`/calendar?date=${day}`]}><CalendarPage today={today} /></MemoryRouter>);
    const card = view.container.querySelector('.ev-calendar__cards li:first-child');
    const href = card?.querySelector('a.ui-card-link')?.getAttribute('href');
    const lead = href && byId.get(href.replace(/^\/events\/|\?.*$/g, ''));
    // The day's lead is an event whose picture can lead (a ① or ② photograph: Ferry Plaza never, on 10/20 or after), or,
    // when the day has none, the first one with its next candidate: never a face photo or a poster.
    const canLeadThatDay = model.INDEX_EVENTS.some(event => nextOccurrence(event, day) === day && canLead(event, today));
    if (lead && canLeadThatDay) assert.ok(canLead(lead, today), `${day}: ${lead.id} leads without a lead photo`);
    const own = lead ? GUIDE_IMAGES[lead.imageKey] : undefined;
    if (lead && own && (NOT_FOR_LEAD.has(lead.imageKey) || own.kind !== 'photo' || own.fullFrame)) {
      assert.equal(card!.innerHTML.includes(stemOf(lead.imageKey)), false, `${day}: ${lead.id} leads with its ${own.kind} ${lead.imageKey}`);
    }
    cleanup();
  }
  // The rule binds every picture on the list: put the first day's lead photo on it, for this check only (the page reads the
  // shared list), and that photo leaves the day's lead.
  const leadOf = (day: string) => {
    const view = render(<MemoryRouter initialEntries={[`/calendar?date=${day}`]}><CalendarPage today={today} /></MemoryRouter>);
    const card = view.container.querySelector('.ev-calendar__cards li:first-child');
    const href = card?.querySelector('a.ui-card-link')?.getAttribute('href');
    const result = { event: href ? byId.get(href.replace(/^\/events\/|\?.*$/g, '')) : undefined, html: card?.innerHTML ?? '' };
    cleanup();
    return result;
  };
  // A day whose lead shows its own registered picture: a lead whose imageKey is a shared key (e.g. 'weekend') shows its venue
  // photo instead, and one that leads with its ② venue photo (its own being a ④ AI picture) is no help either, so flagging
  // its key would test nothing (10-23: the Warriors game led with the Chase Center venue photo).
  const ownPicture = (day: string) => {
    const { event, html } = leadOf(day);
    const stem = stemOf(event?.imageKey);
    return !!event && !!stem && canLead(event, today) && html.includes(stem);
  };
  const flagDay = [0, 1, 2, 3, 4, 5, 6].map(offset => addCalendarDays(today, offset)).find(ownPicture);
  assert.ok(flagDay, 'a day in the week leads with a photo');
  const before = leadOf(flagDay);
  const key = before.event!.imageKey!;
  // The photo's file stem: the lead's <img> is one of its sized files.
  const stem = (GUIDE_IMAGES[key]?.src ?? '').replace(/\.webp$/, '');
  assert.ok(stem && before.html.includes(stem), `${flagDay}: ${before.event!.id} leads with ${key}`);
  const flagged = NOT_FOR_LEAD as Set<string>;
  flagged.add(key);
  try {
    assert.equal(leadOf(flagDay).html.includes(stem), false, `${flagDay}: listed, ${key} never leads the day`);
  } finally { flagged.delete(key); }
  assert.equal(leadImageKey('official-ferry-plaza-farmers-market-2026-autumn'), undefined, 'a released close-up never leads');
  // The Halloween Spectacular poster is not on the list: cover.ts keeps it off a lead by its kind (DECISIONS 32).
  assert.equal(leadImageKey('official-mcm-halloween-spectacular-20261031'), 'official-mcm-halloween-spectacular-20261031');
  assert.equal(canLead({ id: 'x-poster', imageKey: 'official-mcm-halloween-spectacular-20261031' }, today), false, 'a poster never leads');
});

test('events.css and cards.css: hover gated, no font-size literals, spacing on the --sp-* steps, no clamped card title', () => {
  for (const file of ['src/features/events/events.css', 'src/components/ui/cards.css']) {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    // every :hover rule sits in @media (hover:hover) and (pointer:fine)
    const blocks = css.split('@media');
    const ungated = blocks.flatMap((block, index) => index > 0 && /^\s*\(hover:hover\)/.test(block) ? [] : (index === 0 ? block : block.slice(block.indexOf('{') + 1)).match(/[^{}]*:hover[^{}]*\{/g) ?? []);
    if (file.endsWith('events.css')) assert.deepEqual(ungated, [], `${file}: ${ungated.join(' ')}`);
    if (file.endsWith('events.css')) assert.deepEqual(css.match(/font-size:\s*[\d.]+(rem|px|em)/g) ?? [], [], `${file}: font-size literals`);
  }
  const cards = readFileSync('src/components/ui/cards.css', 'utf8');
  // D1 (owner queue #17, UI9-R1-AFTER-A1-CARD-SYSTEM; was DECISIONS 20's 2-line clamp): no card title is cut with "…".
  assert.doesNotMatch(cards.match(/\.ui-feed-card__title \{[^}]*\}/)![0], /line-clamp/);
  assert.doesNotMatch(cards.match(/\.ui-row-card__title \{[^}]*\}/)![0], /line-clamp/);
  // 列表 | 地图: each item as wide as its label, so the English "Map" is never cut to "M…" beside "List".
  assert.match(readFileSync('src/features/events/events.css', 'utf8'), /\.ev-calendar__mode \.ui-segmented__item \{ flex:1 0 auto;/);
  const events = readFileSync('src/features/events/events.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const spacing = [...events.matchAll(/(?:^|[;{\s])(?:margin|padding|gap|row-gap|column-gap)(?:-[a-z-]+)?:([^;}]+)/g)].flatMap(match => match[1].trim().split(/\s+(?![^(]*\))/));
  const onSteps = spacing.filter(value => /^(0|auto|var\(--(sp-\d|section-gap|stack-head|grid-gutter|page-gutter)\)|calc\(-1 \* var\(--(page-gutter|sp-\d)\)\))$/.test(value)).length;
  assert.ok(onSteps / spacing.length >= .9, `${onSteps}/${spacing.length} spacing values on steps`);
});

test('English /calendar: the facts line opens with a capital (the How we check link alone) and splits no date', async () => {
  const { act } = await import('@testing-library/react');
  const { setLocale } = await import('../src/i18n/locale');
  try {
    await act(async () => { await setLocale('en', false); });
    const view = render(<MemoryRouter initialEntries={['/en/calendar']}><CalendarPage today={today} /></MemoryRouter>);
    const facts = view.container.querySelector('.ev-lede-facts')!.textContent!;
    assert.match(facts, /^[A-Z0-9]/, facts);
    assert.doesNotMatch(facts, /\b[A-Z][a-z]{2} \d/, 'a date never splits across lines');
  } finally { cleanup(); await setLocale('zh-Hans', false); }
});

test('/calendar facts line: the how-we-check link alone, on a busy day and on a day with nothing listed', () => {
  const facts = (date: string) => {
    const view = render(<MemoryRouter initialEntries={[`/calendar?date=${date}`]}><CalendarPage today={today} /></MemoryRouter>);
    const text = view.container.querySelector('.ev-lede-facts')!.textContent!;
    cleanup();
    return text;
  };
  const busy = [...new Set(model.INDEX_EVENTS.map(event => nextOccurrence(event, today)).filter((day): day is string => !!day))].sort()[0];
  // The day's rows print their own ✓ lines; the head neither promises nor dates anything (UI9-R1 AFTER-A1).
  assert.equal(facts(busy), '我们怎么核对');
  assert.equal(facts(addCalendarDays(model.EVENTS_INDEX.edition.throughDate, 400)), '我们怎么核对');
});

test('the sheets and the share-card strip are their own chunk, so /events and /calendar load them only when used', () => {
  const ui = /import \{[^}]*\bSheet\b[^}]*\} from '\.\.\/\.\.\/components\/ui'/;
  assert.ok(readFileSync('src/features/events/lazy-view.ts', 'utf8').includes("import('./on-demand-parts')"), 'one dynamic import');
  const onDemandParts = readFileSync('src/features/events/on-demand-parts.ts', 'utf8');
  for (const [file, part] of [['WeekendView', 'FilterSheet'], ['WeekendView', 'ShareLandingStrip'], ['CalendarView', 'CalendarSheet']]) {
    const source = readFileSync(`src/features/events/${file}.tsx`, 'utf8');
    assert.ok(onDemandParts.includes(` from './${part}';`), `${part} is one of the on-demand parts`);
    // a type-only import is erased; any other static import would put the part back into the route's first load
    const statics = source.split('\n').filter(line => line.startsWith('import ') && !line.startsWith('import type ') && line.endsWith(` from './${part}';`));
    assert.deepEqual(statics, [], `${file} does not import ${part} statically`);
    assert.doesNotMatch(source, ui, `${file} leaves the Sheet primitive to ${part}`);
  }
});
