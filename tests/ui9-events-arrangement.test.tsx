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
const { arrangePicks, homeLeadFor, canLead, CLOSE_UP_FACE_IMAGES } = await import('../src/features/events/weekend-lead');
const { dayWhenLine } = await import('../src/features/events/event-lines');
const { ImageCredits } = await import('../src/features/events/ImageCredits');
const { FeedGrid } = await import('../src/components/ui/FeedGrid');
const { DayChips } = await import('../src/components/ui/Segmented');
const { getMonthlyDateRange, nextOccurrence } = await import('../src/lib/monthly');
const { READING_SIZE_KEY, SIMPLE_DISPLAY_KEY } = await import('../src/lib/reading-preferences');

afterEach(() => { cleanup(); localStorage.clear(); });

const today = '2026-10-19'; // Monday: the weekend is 10/24–25
const homeCatalog = JSON.parse(readFileSync('src/data/generated/home-catalog.json', 'utf8')) as { weekends: Record<string, { ids: string[] }> };
const page = (location: string) => render(<MemoryRouter initialEntries={[location]}><EventsView today={today} /></MemoryRouter>);
const titles = (root: ParentNode, selector: string) => [...root.querySelectorAll(`${selector} a.ui-card-link`)].map(link => link.getAttribute('href')!.replace(/^\/events\/|\?.*$/g, ''));

test('the index carries home\'s lead per day, and the /events lead and pick rows never repeat it', () => {
  const leads = model.EVENTS_INDEX.homeLeads ?? {};
  for (const [day, id] of Object.entries(leads)) assert.equal(id, homeCatalog.weekends[day]?.ids[0], day);
  const range = getMonthlyDateRange('weekend', today)!;
  const weekend = model.INDEX_EVENTS.filter(event => [range.start, range.end].some(day => nextOccurrence(event, day) === day));
  const picks = model.weekendPicks(weekend, today, { limit: 5 });
  const home = homeLeadFor(today, picks);
  const { lead, rows } = arrangePicks(picks, today, home);
  assert.ok(lead, 'a lead');
  assert.notEqual(lead!.event.id, home, 'never home\'s lead');
  assert.ok(!rows.some(item => item.event.id === home), 'home\'s lead is no pick row');
  assert.ok(!CLOSE_UP_FACE_IMAGES.has(lead!.event.imageKey), 'no close-up face leads');
  // A pick whose photo shows close-up faces never leads, even when it is first.
  const face = { ...picks[0], event: { ...picks[0].event, id: 'x-face', imageKey: [...CLOSE_UP_FACE_IMAGES][0] } };
  assert.equal(canLead(face.event, today), false);
  assert.notEqual(arrangePicks([face, ...picks.slice(1)], today, 'none').lead?.event.id, 'x-face');
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

test('rail 1: the date scopes, the day chips (none checked = the whole weekend), 免费 · 亲子 · 长辈友好 and 筛选 counting only sheet choices', () => {
  const view = page('/events');
  const rail = view.container.querySelector('.ev-rail')!;
  const pressed = [...rail.querySelectorAll('button[aria-pressed]')].map(button => [button.textContent, button.getAttribute('aria-pressed')]);
  assert.deepEqual(pressed.slice(0, 3), [['本周末', 'true'], ['未来 7 天', 'false'], ['全部日期', 'false']]);
  const days = within(rail.querySelector('.ev-days') as HTMLElement).getAllByRole('radio');
  assert.deepEqual(days.map(day => day.getAttribute('aria-checked')), ['false', 'false', 'false'], 'the whole weekend on arrival');
  assert.equal(days[0].getAttribute('tabindex'), '0');
  assert.deepEqual(days.map(day => day.textContent), ['周六 10/24', '周日 10/25', '两天都开放']);
  for (const label of ['免费', '亲子', '长辈友好']) assert.ok(within(rail as HTMLElement).getByRole('button', { name: label }));
  for (const label of ['户外', '演出', '市集', '南瓜季', '下雨也行']) assert.equal(within(rail as HTMLElement).queryByRole('button', { name: label }), null, `${label} is in the sheet`);
  // No counts on the need chips (DECISIONS 19); 筛选 has no count when nothing was chosen in the sheet.
  assert.equal(rail.querySelectorAll('.ui-chip__count').length, 0);
  // The list names the whole weekend: its count matches the facts line's.
  const facts = view.container.querySelector('.ev-lede-facts')!.textContent!.replace(/\u00a0/g, ' ');
  const status = view.container.querySelector('.ev-count')!.textContent!;
  assert.equal(/^(\d+) 场/.exec(facts)![1], /找到 (\d+) 场/.exec(status)![1]);
  for (const when of ['next7', 'all']) {
    cleanup();
    const list = page(`/events?when=${when}`);
    assert.equal(list.container.querySelectorAll('.ev-rail .ui-chip__count').length, 0, `${when}: no 筛选 1 when nothing is chosen`);
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
    assert.ok(card.querySelector('.ui-feed-card__trust')!.textContent!.startsWith('官网核对'), 'the per-card check stays');
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
  const view = page('/events?day=sat');
  const end = view.container.querySelector('.ev-list-end')!;
  assert.match(end.querySelector('.ev-list-end__count')!.textContent!, /^已显示 \d+ \/ \d+ 场 · 按推荐排列$/);
  const more = within(end as HTMLElement).queryByRole('button', { name: /^再看 \d+ 场$/ });
  if (more) assert.equal(more.getAttribute('data-variant'), 'secondary');
  assert.ok(within(end as HTMLElement).getByRole('link', { name: /周日 10\/25 的活动/ }));
});

test('page end: alerts in the shared Disclosure, one quiet list of links, 本页图片来源 with its NAV hook and the coded-cover note', () => {
  const view = page('/events');
  const end = view.container.querySelector('nav.ev-end')!;
  const links = [...end.querySelectorAll('a.ev-end__item')].map(link => link.textContent);
  assert.deepEqual(links, ['存成一张图：本周末精选', '订阅到手机日历（只含活动日期）', '免费与优惠', '新店', '半日慢游去处', '出门前读一篇指南']);
  const credits = view.container.querySelector('#page-credits')!;
  assert.ok(credits.hasAttribute('data-credits-at-end'));
  assert.equal(Number(credits.getAttribute('data-count')), credits.querySelectorAll('li').length);
  assert.equal(view.container.querySelectorAll('.ui-cover-credit').length, 0, 'the feed does not repeat the note');
  if (view.container.querySelector('.ev-feed [data-cover="type"]')) assert.match(credits.textContent!, /没有照片的条目用 BAYLINK 信息卡/);
  const alerts = view.container.querySelector('.ev-alerts');
  if (alerts) assert.ok(alerts.querySelector('details.ui-disclosure'));
});

test('ImageCredits and FeedGrid: the note is said once, and FeedGrid can leave its own line out', () => {
  const credits = render(<ImageCredits covers={[{ tier: 'type' } as never]} />);
  assert.equal(credits.container.querySelector('#page-credits')!.getAttribute('data-count'), '0');
  assert.match(credits.container.textContent!, /没有照片的条目用 BAYLINK 信息卡/);
  cleanup();
  const grid = render(<FeedGrid label="x" coverCredit={false}><li>a</li></FeedGrid>);
  assert.equal(grid.container.querySelector('.ui-cover-credit'), null);
  cleanup();
  assert.ok(render(<FeedGrid label="x"><li>a</li></FeedGrid>).container.querySelector('.ui-cover-credit'), 'the default stays');
});

test('DayChips: a radio group on the chip look, none checked gives the first the tab stop, arrows select', () => {
  const chosen: string[] = [];
  const view = render(<DayChips label="day" value="" items={[{ id: 'sat', label: '周六' }, { id: 'sun', label: '周日' }]} onChange={id => chosen.push(id)} />);
  const radios = view.getAllByRole('radio');
  assert.deepEqual(radios.map(radio => [radio.className, radio.getAttribute('tabindex')]), [['ui-chip', '0'], ['ui-chip', '-1']]);
  fireEvent.keyDown(radios[0], { key: 'ArrowRight' });
  assert.deepEqual(chosen, ['sun']);
});

test('简洁显示 and 家人版 show fewer cards per page (6 and 4) and mark what they hide', () => {
  localStorage.setItem(SIMPLE_DISPLAY_KEY, '1');
  document.documentElement.setAttribute('data-simple', '');
  try {
    const simple = page('/events');
    // rows (a 112px 4:3 thumbnail), no ♡ on them (DECISIONS 16)
    assert.equal(simple.container.querySelectorAll('.ev-feed .ui-row-card').length, 6);
    assert.equal(simple.container.querySelectorAll('.ev-feed .ui-row-card button').length, 0);
    assert.ok(simple.container.querySelector('.ev-picks__more[data-simple=hide]'));
    cleanup();
    localStorage.setItem(READING_SIZE_KEY, 'extra-large');
    const family = page('/events');
    assert.equal(family.container.querySelectorAll('.ev-feed .ui-row-card').length, 4);
    assert.match(family.container.querySelector('.ev-list-end__more')!.textContent!, /^再看 4 场$/);
  } finally { document.documentElement.removeAttribute('data-simple'); }
});

test('/calendar: the week range opens the sheet, the day head carries 列表 | 地图, a city rail of the top 4 + 更多城市, rows 12 at a time', () => {
  const view = render(<MemoryRouter initialEntries={['/calendar?date=2026-10-24']}><CalendarPage today={today} /></MemoryRouter>);
  assert.match(view.container.querySelector('.ev-range')!.textContent!, /^按日期看 · 收录至 /);
  const head = view.container.querySelector('.ev-calendar__head')!;
  assert.match(head.querySelector('h2')!.textContent!, /^10月24日 周六 · \d+ 场$/);
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
  const end = view.container.querySelector('.ev-calendar__end')!;
  assert.match(end.textContent!, /已显示 \d+ \/ \d+ 场/);
  assert.ok(within(end as HTMLElement).getByRole('link', { name: /明天 10\/25/ }));
  assert.ok(within(end as HTMLElement).getByRole('button', { name: '让 BayBay 帮我安排这一天' }));
  fireEvent.click(view.container.querySelector('.ev-week__range')!);
  assert.ok(view.getByRole('dialog'));
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
  assert.doesNotMatch(cards.match(/\.ui-feed-card__title \{[^}]*\}/)![0], /line-clamp/);
  assert.doesNotMatch(cards.match(/\.ui-row-card__title \{[^}]*\}/)![0], /line-clamp/);
  const events = readFileSync('src/features/events/events.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const spacing = [...events.matchAll(/(?:^|[;{\s])(?:margin|padding|gap|row-gap|column-gap)(?:-[a-z-]+)?:([^;}]+)/g)].flatMap(match => match[1].trim().split(/\s+(?![^(]*\))/));
  const onSteps = spacing.filter(value => /^(0|auto|var\(--(sp-\d|section-gap|stack-head|grid-gutter|page-gutter)\)|calc\(-1 \* var\(--(page-gutter|sp-\d)\)\))$/.test(value)).length;
  assert.ok(onSteps / spacing.length >= .9, `${onSteps}/${spacing.length} spacing values on steps`);
});
