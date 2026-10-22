import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

// UI9-R1-EVENTS-FRAME (round-1 cold review, lanes/UI9-P4/r1/synthesis-r1.json): the events head's facts line is one short
// line (counts · 我们怎么核对 →) with the promise / press count and the 官网核对 dates behind the link as screen-reader text,
// hidden in 简洁显示 (J1 P11, J2 P10, D6 / J2 P11); the calendar map's pins use e1 and the selected pair, and the map sheet
// has no font-size literal (N10, DECISIONS 2 / 13).
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/events' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { EventsView } = await import('../src/components/EventsView');
const { default: CalendarPage } = await import('../src/pages/CalendarPage');
const { setLocale } = await import('../src/i18n/locale');
const model = await import('../src/features/events/events-model');
const { addCalendarDays } = await import('../src/lib/calendar-days');
const { nextOccurrence } = await import('../src/lib/monthly');

afterEach(() => { cleanup(); localStorage.clear(); });

// The generated data's own day (pretest regenerates the home catalog on the run day), so the catalog always has it.
const today = (JSON.parse(readFileSync('src/data/generated/home-catalog.json', 'utf8')) as { generatedAt: string }).generatedAt;

/** What a sighted reader sees on the facts line (the .sr-only text left out), with no-break spaces as spaces. */
function facts(root: ParentNode) {
  const line = root.querySelector('.ev-lede-facts')!;
  const shown = line.cloneNode(true) as Element;
  shown.querySelectorAll('.sr-only').forEach(node => node.remove());
  const plain = (text: string | null | undefined) => (text ?? '').replace(/\u00a0/g, ' ');
  return { line, seen: plain(shown.textContent), behind: plain(line.querySelector('.sr-only')?.textContent), all: plain(line.textContent) };
}
const views = ['/events', '/this-month', '/events?view=perks', '/events?view=openings'];
const page = (location: string) => render(<MemoryRouter initialEntries={[location]}><EventsView today={today} /></MemoryRouter>);
const calendar = (location = '/calendar') => render(<MemoryRouter initialEntries={[location]}><CalendarPage today={today} /></MemoryRouter>);
// The words the line used to print and now keeps behind the link.
const MOVED = /官网核对|官網核對|每条附官方链接|每條附官方連結|媒体报道|媒體報導|多数|多數|最近|最早|official|news report|mostly|latest|earliest/i;

test('the facts line people see is the counts and 我们怎么核对 → only, on the four events views and /calendar', () => {
  const seen: Record<string, string> = {};
  for (const location of views) {
    const view = page(location);
    const { line, seen: text, behind, all } = facts(view.container);
    seen[location] = text;
    assert.doesNotMatch(text, MOVED, `${location}: ${text}`);
    assert.match(text, /^(\d+ 场 · \d+ 场免费|\d+ 条优惠与免费福利|\d+ 家新店与开业消息) · 我们怎么核对$/, location);
    // The summary is still there for screen readers, in reading order: counts · promise or press count · 官网核对 … · the link.
    assert.match(behind, /^(每条附官方链接|\d+ 条来自媒体报道)( · 官网核对 .+)? · $/, `${location}: ${behind}`);
    assert.equal(all, `${text.replace(/我们怎么核对$/, '')}${behind}我们怎么核对`);
    assert.equal(line.querySelector('a')!.getAttribute('href'), '/about#about-method-title');
    assert.equal(line.querySelector('a')!.textContent, '我们怎么核对');
    cleanup();
  }
  // /calendar has no counts in its head: the line people see is the link alone; the day's promise and dates are behind it.
  const view = calendar();
  const { seen: text, behind, all } = facts(view.container);
  assert.equal(text, '我们怎么核对');
  assert.match(behind, /^(每条附官方链接|\d+ 条来自媒体报道) · 官网核对 .+ · $/, behind);
  assert.equal(all, `${behind}我们怎么核对`);
  // A day past the catalog lists nothing, so nothing sits behind the link either.
  cleanup();
  const empty = facts(calendar(`/calendar?date=${addCalendarDays(model.EVENTS_INDEX.edition.throughDate, 400)}`).container);
  assert.deepEqual([empty.seen, empty.behind, empty.all], ['我们怎么核对', '', '我们怎么核对']);
  assert.ok(Object.keys(seen).length === views.length);
});

test('a press-sourced item is counted behind the link, never on the line itself (DECISIONS 17)', () => {
  const view = page('/events?view=openings');
  const { seen, behind } = facts(view.container);
  const reports = model.INDEX_OPENINGS.filter(item => item.press || /媒体|媒體|news|press/i.test(item.sourceLabel ?? '')).length;
  assert.doesNotMatch(seen, /媒体报道/);
  if (reports) assert.match(behind, /^\d+ 条来自媒体报道/);
  else assert.match(behind, /^每条附官方链接/);
});

test('zh-Hant and English: one short line with the same shape; English keeps a capital and its dates whole behind the link', async () => {
  try {
    await act(async () => { await setLocale('zh-Hant', false); });
    for (const location of views) {
      const { seen } = facts(page(location).container);
      assert.doesNotMatch(seen, MOVED, `${location}: ${seen}`);
      assert.match(seen, /^(\d+ 場 · \d+ 場免費|\d+ 條優惠與免費福利|\d+ 家新店與開業消息) · 我們怎麼核對$/, `${location}: ${seen}`);
      cleanup();
    }
    await act(async () => { await setLocale('en', false); });
    for (const location of views) {
      const { line, seen } = facts(page(location).container);
      assert.doesNotMatch(seen, MOVED, `${location}: ${seen}`);
      assert.match(seen, /^(\d+ events? · \d+ free|\d+ offers and free perks|\d+ new shops and openings) · How we check$/, `${location}: ${seen}`);
      assert.doesNotMatch(line.querySelector('.sr-only')?.textContent ?? '', /\b[A-Z][a-z]{2} \d/, 'a date behind the link keeps its no-break space');
      cleanup();
    }
    const { seen, all } = facts(calendar('/en/calendar').container);
    assert.equal(seen, 'How we check');
    assert.match(all, /^[A-Z0-9]/, all);
  } finally { cleanup(); await act(async () => { await setLocale('zh-Hans', false); }); }
});

test('简洁显示 hides the facts line through the events column\'s own [data-simple=hide] rule (no new CSS)', () => {
  for (const location of views) {
    assert.equal(facts(page(location).container).line.getAttribute('data-simple'), 'hide', location);
    cleanup();
  }
  assert.equal(facts(calendar().container).line.getAttribute('data-simple'), 'hide');
  // The rule lives in events.css (UI9-IMG-A1 owns that file); this lane relies on it, so it is pinned here.
  assert.match(readFileSync('src/features/events/events.css', 'utf8'), /html\[data-simple\] \.ev-page \[data-simple=hide\][^{]*\{ *display: *none/);
  // sr-only is Tailwind's (already in the entry CSS through the home head), so the line adds no stylesheet.
  assert.match(readFileSync('src/features/home/HomeHead.tsx', 'utf8'), /className="sr-only"/);
});

test('the per-card ✓ line stays on every listed card while the head drops its dates (DECISIONS 3 / 17)', () => {
  const view = page('/events');
  const cards = view.container.querySelectorAll('.ui-feed-card');
  assert.ok(cards.length > 0);
  for (const card of cards) assert.ok(card.querySelector('.ui-feed-card__trust'), 'each card keeps its ✓ line');
});

test('the calendar map: pins use e1 and the selected pair, no lime ring, and the sheet has no font-size literal (N10, D2, DECISIONS 13)', () => {
  const css = readFileSync('src/components/calendar-event-map.css', 'utf8');
  const shadows = [...css.matchAll(/box-shadow:([^;}]+)/g)].map(match => match[1].trim());
  assert.ok(shadows.length > 0);
  for (const shadow of shadows) assert.equal(shadow, 'var(--e1)', `box-shadow ${shadow}`);
  assert.doesNotMatch(css, /--color-highlight/, 'lime means 免费 only (D2)');
  const pressed = /\.calendar-event-map-pin\[aria-pressed=true\]\{([^}]*)\}/.exec(css)![1];
  for (const token of ['--selected-line', '--selected-bg', '--selected-fg']) assert.ok(pressed.includes(`var(${token})`), token);
  const sizes = [...css.matchAll(/font-size:([^;}]+)/g)].map(match => match[1].trim());
  assert.ok(sizes.length > 0);
  for (const size of sizes) assert.match(size, /^var\(--(?:text|fs)-[a-z0-9-]+\)$/, `font-size ${size}`);
  // The site's one focus ring (2px brand, 3px gap; tokens.css) reaches the pins and the retry button: no local 3px ring.
  assert.doesNotMatch(css, /:focus-visible/);
  assert.doesNotMatch(css, /outline:3px/);
  // No ungated hover: the pin's resting shadow is already e1.
  assert.doesNotMatch(css, /:hover/);
});

test('the map pin markup still carries the pressed state and the precision words the CSS keys on', () => {
  const source = readFileSync('src/components/CalendarEventMap.tsx', 'utf8');
  assert.match(source, /calendar-event-map-pin\$\{reference \? ' is-reference' : ''\}/);
  assert.match(source, /setAttribute\('aria-pressed'/);
  // The chosen day's events exist in the index, so the calendar renders its list with the map behind 地图.
  const busy = [...new Set(model.INDEX_EVENTS.map(event => nextOccurrence(event, today)).filter((day): day is string => !!day))].sort()[0];
  const view = calendar(`/calendar?date=${busy}`);
  assert.equal(view.container.querySelectorAll('.calendar-event-map-pin').length, 0, 'the map loads only when 地图 is chosen');
});
