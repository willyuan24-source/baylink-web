import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

// UI9-R1-AFTER-A1-EVENTS-CAL (round-1 cold review, lanes/UI9-P4/r1/synthesis-r1.json): the calendar's one 加入这天计划
// control is the compact calendar+ icon (J1 P8 / J3 P07 / D7), its day head prints the site's date pattern (N06) with
// 列表 | 地图 on its row (J2 P7), two whole cards fit a standard phone's first screen and one at 大 / 特大 / 简洁 (N18), the
// week strip ends a section gap above the day head (N15); the events column's facts line reserves no second line, its end
// links are 44 px targets (N25), and an empty result is not followed by 出行提醒 (J3 P27); 简洁 filters stay on two rows (D6).
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/calendar' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup, waitFor, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { EventsView } = await import('../src/components/EventsView');
const { default: CalendarPage } = await import('../src/pages/CalendarPage');
const { AddToDayPlan } = await import('../src/components/AddToDayPlan');
const { setLocale } = await import('../src/i18n/locale');
const model = await import('../src/features/events/events-model');
const { nextOccurrence } = await import('../src/lib/monthly');
const { addCalendarDays } = await import('../src/lib/calendar-days');
const { READING_SIZE_KEY, SIMPLE_DISPLAY_KEY } = await import('../src/lib/reading-preferences');

afterEach(() => { cleanup(); localStorage.clear(); document.documentElement.removeAttribute('data-simple'); document.documentElement.removeAttribute('data-reading'); });

// The generated data's own day (pretest regenerates the home catalog on the run day), so the catalog always has it.
const today = (JSON.parse(readFileSync('src/data/generated/home-catalog.json', 'utf8')) as { generatedAt: string }).generatedAt;
const css = readFileSync('src/features/events/events.css', 'utf8');
const rule = (selector: string) => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `events.css has ${selector}`);
  return css.slice(at, css.indexOf('}', at) + 1);
};
const onDay = (day: string) => model.INDEX_EVENTS.filter(event => nextOccurrence(event, day) === day);
// The busiest day of the next week, so the day has a lead, a pair and rows.
const busyDay = [0, 1, 2, 3, 4, 5, 6].map(offset => addCalendarDays(today, offset)).sort((a, b) => onDay(b).length - onDay(a).length)[0];
const calendar = (date = busyDay) => render(<MemoryRouter initialEntries={[`/calendar?date=${date}`]}><CalendarPage today={today} /></MemoryRouter>);
const weekday = (day: string) => model.WEEKDAYS[model.weekdayIndex(day)].short.zh;

test('the calendar\'s 加入这天计划 is the compact icon on every listed event: no outline button wall (D7)', async () => {
  assert.ok(onDay(busyDay).length > 2, busyDay);
  const view = calendar();
  await waitFor(() => assert.ok(view.getAllByRole('button', { name: /^加入这天计划：/ }).every(button => !button.hasAttribute('disabled'))));
  const adds = view.getAllByRole('button', { name: /^加入这天计划：/ });
  // One per card and row (the phone pair's second card repeats the next event's row; CSS shows one of the two).
  const shown = view.container.querySelectorAll('.ev-calendar__rows .ui-feed-card, .ev-calendar__rows .ui-row-card').length;
  assert.equal(adds.length, shown);
  for (const button of adds) {
    assert.equal(button.getAttribute('data-variant'), 'icon');
    // The short word starts the name (WCAG 2.5.3); events.css hides it on phones, where the icon stands alone.
    assert.equal(button.querySelector('.saves-add-day__word')!.textContent, '加入');
    assert.ok(button.querySelector('svg'), 'the calendar+ icon');
  }
  // events.css: a soft pill without an outline (the wall was 11 outline buttons), a 44 px circle on a card's picture and a
  // 36 px circle with a 44 px hit area on a row's thumbnail on phones, the word from 768 px.
  const pill = rule('.ev-calendar .ev-add-day .saves-add-day[data-variant=icon]');
  assert.match(pill, /border-color:transparent/);
  assert.match(pill, /min-width:var\(--control-height\); min-height:var\(--control-height\)/);
  assert.match(css, /\.ev-calendar \.ev-add-day \.saves-add-day__word \{ display:none; \}/);
  assert.match(css, /\.ev-calendar__rows \.ui-row-card\.ev-card--action \.saves-add-day\[data-variant=icon\]::after \{ content:""; position:absolute; inset:-4px; \}/);
  assert.doesNotMatch(css, /\.ev-calendar \.ev-add-day \.saves-add-day \{/, 'the old outline-pill override is gone');
});

test('the icon variant in English: the word Add starts its name "Add to this day’s plan: …"', async () => {
  try {
    await act(async () => { await setLocale('en', false); });
    const view = render(<MemoryRouter><AddToDayPlan stop={{ kind: 'event', id: 'x' }} date={today} title="Test" variant="icon" /></MemoryRouter>);
    await waitFor(() => assert.ok(!view.getByRole('button', { name: 'Add to this day’s plan: Test' }).hasAttribute('disabled')));
    const button = view.getByRole('button', { name: 'Add to this day’s plan: Test' });
    assert.equal(button.getAttribute('data-variant'), 'icon');
    assert.equal(button.querySelector('.saves-add-day__word')!.textContent, 'Add');
  } finally { cleanup(); await act(async () => { await setLocale('zh-Hans', false); }); }
});

test('the default 加入这天计划 (detail bar, My Week) is unchanged: full words, no variant', () => {
  const view = render(<MemoryRouter><AddToDayPlan stop={{ kind: 'event', id: 'x' }} date={today} title="Test" compact /></MemoryRouter>);
  const button = view.getByRole('button', { name: /^加入这天计划：Test$/ });
  assert.equal(button.getAttribute('data-variant'), null);
  assert.equal(button.textContent, '加入这天计划');
  assert.equal(button.querySelector('.saves-add-day__word'), null);
});

test('the day head: 10/22 周四 · n 场 in the site\'s date pattern (N06), with 列表 | 地图 on its row (J2 P7)', async () => {
  const view = calendar();
  const head = view.container.querySelector('.ev-calendar__head')!;
  const h2 = head.querySelector('h2')!;
  assert.equal(h2.querySelector('.ev-calendar__date')!.textContent, `${Number(busyDay.slice(5, 7))}/${Number(busyDay.slice(8, 10))} ${weekday(busyDay)}`);
  assert.equal(h2.textContent!.replace(/\u00a0/g, ' '), `${Number(busyDay.slice(5, 7))}/${Number(busyDay.slice(8, 10))} ${weekday(busyDay)} · ${onDay(busyDay).length} 场`);
  assert.doesNotMatch(h2.textContent!, /月|日 /);
  assert.ok(head.querySelector('.ev-calendar__mode'), 'the toggle is in the day head');
  // A grid row: the H2 wraps beside the toggle, which never drops to a row of its own.
  assert.match(rule('.ev-calendar__head'), /display:grid; grid-template-columns:minmax\(0, 1fr\) auto;/);
  cleanup();
  try {
    await act(async () => { await setLocale('en', false); });
    const en = render(<MemoryRouter initialEntries={[`/en/calendar?date=${busyDay}`]}><CalendarPage today={today} /></MemoryRouter>);
    assert.match(en.container.querySelector('.ev-calendar__date')!.textContent!, /^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/);
  } finally { cleanup(); await act(async () => { await setLocale('zh-Hans', false); }); }
});

test('first screen (N18): a standard phone pairs the lead with the next event; 大 / 特大 / 简洁 list every event as a row', () => {
  const events = onDay(busyDay);
  const view = calendar();
  const lead = view.container.querySelector('.ev-calendar__lead')!;
  const cards = [...lead.querySelectorAll('.ui-feed-grid > li .ui-feed-card a.ui-card-link')].map(link => link.getAttribute('href')!.split('?')[0]);
  assert.equal(cards.length, 2);
  const pairRow = view.container.querySelector('.ev-calendar__pair-row a.ui-card-link')!.getAttribute('href')!.split('?')[0];
  assert.equal(pairRow, cards[1], 'the second card repeats the next event, whose row follows (CSS shows one of the two)');
  // CalendarView marks the pair, so a browser without :has() still shows each event once (review round 2).
  assert.ok(lead.classList.contains('ev-calendar__lead--pair'));
  // events.css: the 2-up row on phones (4:3, as the /events picks), the pair's row hidden there; the second card hidden from 768.
  assert.match(css, /\.ev-calendar__lead--pair \.ui-feed-grid\[data-single\] \{ --ui-feed-cols:2; --ui-feed-ratio:4 \/ 3;/);
  assert.match(css, /@media \(max-width:767px\) \{[^@]*\n {2}\.ev-calendar__pair-row \{ display:none; \}/);
  assert.match(css, /\.ev-calendar__lead \.ui-feed-grid>li\+li \{ display:none; \}/);
  assert.doesNotMatch(css, /ev-calendar__lead[^{]*:has\(/, 'no pair rule depends on :has()');
  // The 2-up title sets its size only: whether it wraps or clamps is cards.css's (D1).
  assert.doesNotMatch(rule('.ev-calendar__lead--pair .ui-feed-grid[data-single] .ui-feed-card__title'), /display|overflow/);
  cleanup();
  for (const [key, value, attr] of [[READING_SIZE_KEY, 'extra-large', 'data-reading'], [SIMPLE_DISPLAY_KEY, '1', 'data-simple']] as const) {
    localStorage.setItem(key, value);
    document.documentElement.setAttribute(attr, attr === 'data-simple' ? '' : value);
    const roomy = calendar();
    assert.equal(roomy.container.querySelector('.ev-calendar__lead'), null, `${attr}: no lead card`);
    const rows = [...roomy.container.querySelectorAll('.ev-calendar__rows .ui-row-card a.ui-card-link')].map(link => link.getAttribute('href')!.split('?')[0]);
    assert.equal(rows[0], cards[0], `${attr}: the lead is the first row`);
    assert.equal(new Set(rows).size, rows.length, `${attr}: each event once`);
    assert.ok(rows.length <= Math.min(events.length, attr === 'data-simple' ? 7 : 13));
    cleanup(); localStorage.clear(); document.documentElement.removeAttribute(attr);
  }
  // At 大 / 特大 on a phone the city rail (全部 · 更多城市 there) shows only while a city is chosen.
  assert.match(css, /html:is\(\[data-reading=large\],\[data-reading=extra-large\]\) \.ev-cities:not\(:has\(\.ev-cities__top\[aria-pressed=true\]\)\) \{ display:none; \}/);
});

test('the week range names the cities it holds; its second line says so at 大 / 特大 on a phone, where the rail steps aside', () => {
  const view = calendar();
  const range = view.container.querySelector('.ev-week__range')!;
  assert.match(range.getAttribute('aria-label')!, /，选日期、地区和城市：整个湾区$/);
  // The visible hint is the sheet's title, inside the name (WCAG 2.5.3); events.css shows it only at 大 / 特大 on a phone.
  assert.equal(range.querySelector('.ev-week__hint')!.textContent, '选日期、地区和城市');
  assert.match(css, /\.ev-week__hint \{ display:none; \}/);
  assert.match(css, /html:is\(\[data-reading=large\],\[data-reading=extra-large\]\) \.ev-week__hint \{ display:block;/);
});

test('the day head on narrow phones: the count takes its own line below 390 px (English) and 360 px, never under the toggle', () => {
  assert.match(css, /@media \(max-width:389px\) \{\n {2}\.ev-calendar__count:lang\(en\) \{ display:block; \}\n {2}\.ev-calendar__sep:lang\(en\) \{ display:none; \}/);
  assert.match(css, /@media \(max-width:359px\) \{\n {2}\.ev-calendar__count \{ display:block; \}\n {2}\.ev-calendar__sep \{ display:none; \}/);
});

test('English at 大 / 特大 / 简洁: the date scopes read Weekend · Next 7 · All, so they keep one row (N18)', async () => {
  try {
    await act(async () => { await setLocale('en', false); });
    const standard = render(<MemoryRouter initialEntries={['/en/events?when=next7']}><EventsView today={today} /></MemoryRouter>);
    assert.deepEqual([...standard.container.querySelectorAll('.ev-rail__dates [role=radio]')].map(item => item.textContent), ['This weekend', 'Next 7 days', 'All dates']);
    cleanup();
    localStorage.setItem(READING_SIZE_KEY, 'extra-large');
    document.documentElement.setAttribute('data-reading', 'extra-large');
    const xl = render(<MemoryRouter initialEntries={['/en/events?when=next7']}><EventsView today={today} /></MemoryRouter>);
    assert.deepEqual([...xl.container.querySelectorAll('.ev-rail__dates [role=radio]')].map(item => item.textContent), ['Weekend', 'Next 7', 'All']);
    assert.equal(xl.getByRole('radio', { name: 'Next 7' }).getAttribute('aria-checked'), 'true');
  } finally { cleanup(); await act(async () => { await setLocale('zh-Hans', false); }); }
});

test('rhythm (N15): the week strip ends a section gap above the day head; no two-line facts reserve; end links 44 px wide (N25)', () => {
  // The dots' 4 px cell padding plus the margin make the section gap (40 phone / 64 desktop).
  assert.match(rule('.ev-week'), /margin:0 0 calc\(var\(--section-gap\) - var\(--sp-1\)\);/);
  assert.match(rule('.ev-week__day'), /padding:var\(--sp-1\) 0;/);
  // The facts line is one line: no min-height reserve on any view (the 26–35 px band above the view row).
  assert.doesNotMatch(css, /\.ev-lede-facts \{[^}]*min-height/);
  assert.doesNotMatch(css, /calc\(2em \* 1\.6\)/);
  assert.match(rule('.ev-end__item'), /min-width:var\(--control-height\); min-height:var\(--control-height\)/);
  // The 36 px circles on a row's thumbnail (♡, 加入) have no border: their ::after ring (inset -4px) is cut from the padding
  // box, so 36 + 2 × 4 = 44 px only without one (a 1 px border made it 42 at 特大).
  assert.match(rule('.ev-page .ui-row-card__trailing .saves-control .saves-toggle'), /width:36px; height:36px; min-height:36px; padding:0; border:0;/);
  assert.match(rule('.ev-calendar__rows .ui-row-card.ev-card--action .saves-add-day[data-variant=icon]'), /width:36px; height:36px; min-width:36px; min-height:36px; border:0;/);
});

test('an empty result is not followed by 出行提醒 (J3 P27); 简洁显示 leaves 出行提醒 and 整个湾区 ▾ out (D6)', () => {
  const alertsToday = model.activeBulletins(today, 'all');
  const empty = render(<MemoryRouter initialEntries={['/events?when=all&q=zqxjvw']}><EventsView today={today} /></MemoryRouter>);
  assert.ok(empty.getByRole('heading', { name: /没有找到「zqxjvw」/ }));
  assert.equal(empty.container.querySelector('.ev-alerts'), null);
  // From 768 px the empty list keeps 60vh, so the footer stays below the fold as the result arrives (desktop CLS 0.2 → 0).
  assert.equal(empty.container.querySelector('.ev-list')!.getAttribute('data-empty'), '');
  assert.match(css, /@media \(min-width:768px\) \{ \.ev-list\[data-empty\] \{ min-height:60vh; \} \}/);
  cleanup();
  const full = render(<MemoryRouter initialEntries={['/events']}><EventsView today={today} /></MemoryRouter>);
  const alerts = full.container.querySelector('.ev-alerts');
  if (alertsToday.length) assert.equal(alerts?.getAttribute('data-simple'), 'hide');
  assert.equal(full.container.querySelector('.ev-region-chip')!.getAttribute('data-simple'), 'hide');
  cleanup();
  // A chosen region stays on the rail in 简洁显示, so it shows and can be cleared.
  const sf = render(<MemoryRouter initialEntries={['/events?region=sf']}><EventsView today={today} /></MemoryRouter>);
  assert.equal(sf.container.querySelector('.ev-region-chip')!.getAttribute('data-simple'), null);
});
