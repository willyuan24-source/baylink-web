// CW-02 / EVT11-05: a page prerendered for another Pacific day shows a skeleton over its date blocks until the app renders
// today's result (src/lib/date-guard.ts, public/reading-init.js, source-monitor.css, docs/daily-rebuild.md).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import { MemoryRouter, StaticRouter } from 'react-router-dom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { dateScope, staleScopes, weekendKey } from '../src/lib/date-guard';

const SRC = fs.readFileSync('public/reading-init.js', 'utf8');

/** Runs reading-init.js in a page built for `builtFor` (or none) with the clock at `now` (UTC ISO). */
function staleAt(now: string, builtFor: string | null, url = 'https://www.baylink.us/events') {
  const dom = new JSDOM(`<!doctype html><html lang="zh-Hans"${builtFor ? ` data-built-for="${builtFor}"` : ''}><head></head><body></body></html>`, { runScripts: 'outside-only', url });
  dom.window.eval(`(function () { var Real = Date, fixed = Real.parse(${JSON.stringify(now)});
    function Fake() { return arguments.length ? new (Function.prototype.bind.apply(Real, [null].concat([].slice.call(arguments))))() : new Real(fixed); }
    Fake.UTC = Real.UTC; Fake.parse = Real.parse; Fake.now = function () { return fixed; }; Fake.prototype = Real.prototype; Date = Fake; })();`);
  dom.window.eval(SRC);
  return dom.window.document.documentElement.getAttribute('data-date-stale');
}

test('the 本周末 key: Monday to Saturday share the coming weekend, Sunday is its own', () => {
  // 2026-10-12 is a Monday.
  for (const day of ['2026-10-12', '2026-10-13', '2026-10-16', '2026-10-17']) assert.equal(weekendKey(day), '2026-10-17', day);
  assert.equal(weekendKey('2026-10-18'), '2026-10-18');
  assert.equal(weekendKey('2026-10-19'), '2026-10-24');
  assert.equal(weekendKey('2026-12-28'), '2027-01-02', 'across the year');
  assert.deepEqual(staleScopes('2026-10-12', '2026-10-12'), []);
  assert.deepEqual(staleScopes('2026-10-12', '2026-10-16'), ['day'], 'Monday’s weekend list is still right on Friday');
  assert.deepEqual(staleScopes('2026-10-16', '2026-10-17'), ['day'], 'Saturday still shows both days');
  assert.deepEqual(staleScopes('2026-10-17', '2026-10-18'), ['day', 'weekend'], 'on Sunday Saturday is gone');
  assert.deepEqual(staleScopes('2026-10-11', '2026-10-12'), ['day', 'weekend'], 'a Sunday build is last weekend on Monday');
  assert.deepEqual(staleScopes(null, '2026-10-12'), []);
  assert.deepEqual(staleScopes('10/12/2026', '2026-10-12'), []);
});

test('reading-init marks the page before the first paint exactly as date-guard states the rule (Pacific days, PDT and PST)', () => {
  const cases: [now: string, builtFor: string | null, today: string][] = [
    ['2026-10-12T06:59:00Z', '2026-10-11', '2026-10-11'], // 23:59 PDT Sunday: still the build day
    ['2026-10-12T07:01:00Z', '2026-10-11', '2026-10-12'], // 00:01 PDT Monday
    ['2026-10-16T20:00:00Z', '2026-10-12', '2026-10-16'],
    ['2026-10-17T20:00:00Z', '2026-10-16', '2026-10-17'],
    ['2026-10-18T20:00:00Z', '2026-10-17', '2026-10-18'],
    ['2026-11-02T07:30:00Z', '2026-11-01', '2026-11-01'], // 23:30 PST Sunday after the switch back
    ['2026-11-02T08:30:00Z', '2026-11-01', '2026-11-02'], // 00:30 PST Monday
    ['2026-10-12T20:00:00Z', null, '2026-10-12'],
    ['2026-10-12T20:00:00Z', 'not-a-date', '2026-10-12'],
  ];
  for (const [now, builtFor, today] of cases) {
    const expected = staleScopes(builtFor, today);
    assert.equal(staleAt(now, builtFor), expected.length ? expected.join(' ') : null, `${now} built ${builtFor}`);
  }
  assert.equal(staleAt('2026-10-18T20:00:00Z', '2026-10-12', 'https://www.baylink.us/opus-bay'), null, 'the 3D world is left alone');
});

/** The guard's rules in source-monitor.css: the selectors that hide a block, draw its skeleton, or drop a nested one. */
function guardRules() {
  const css = fs.readFileSync('src/features/source-monitor/source-monitor.css', 'utf8');
  const cover: string[] = [], skeleton: string[] = [], nested: string[] = [];
  postcss.parse(css).walkRules(rule => {
    if (!rule.selector.includes('data-date-stale')) return;
    const declares = (prop: string, value: string) => rule.nodes.some(node => node.type === 'decl' && node.prop === prop && node.value === value);
    if (declares('visibility', 'hidden')) cover.push(...rule.selectors);
    else if (declares('content', 'none')) nested.push(...rule.selectors);
    else if (declares('visibility', 'visible')) skeleton.push(...rule.selectors);
  });
  return { cover, skeleton, nested, all: [...cover, ...skeleton, ...nested] };
}

/** Elements the guard hides on this page, for its current `data-date-stale`. */
const coveredIn = (doc: Document) => new Set(doc.querySelectorAll(guardRules().cover.join(',')));
const insideCovered = (node: Element, covered: Set<Element>) => {
  for (let n: Element | null = node; n; n = n.parentElement) if (covered.has(n)) return true;
  return false;
};

test('only the prerendered copy of a date block is covered; the blocks the app renders never are', () => {
  const { cover, skeleton, nested, all } = guardRules();
  for (const scope of ['weekend', 'day'] as const) {
    for (const wrapper of ['main[data-prerender-path]', '.site-boot-main']) {
      assert.ok(cover.includes(`html[data-date-stale~="${scope}"] ${wrapper} [data-date-scope="${scope}"]`), `${scope} under ${wrapper}`);
      assert.ok(skeleton.includes(`html[data-date-stale~="${scope}"] ${wrapper} [data-date-scope="${scope}"]::before`), `${scope} skeleton under ${wrapper}`);
    }
  }
  assert.equal(skeleton.length, cover.length, 'every covered block draws its skeleton');
  for (const selector of all) assert.match(selector, /main\[data-prerender-path\]|\.site-boot-main/, `${selector} is limited to the prerendered page or its boot snapshot`);
  // Rendered into a real DOM: the guard's selector reaches the prerendered block and not a fresh app block.
  const dom = new JSDOM('<html data-date-stale="day weekend"><body><div id="root"><main data-prerender-path="/events"><div data-date-scope="weekend">old<p data-date-scope="day">alerts</p></div></main></div><main id="app"><div data-date-scope="weekend">new</div></main></body></html>');
  const text = (selectors: string[]) => [...dom.window.document.querySelectorAll(selectors.map(item => item.replace('::before', '')).join(','))].map(node => node.firstChild?.textContent);
  assert.deepEqual(text(cover), ['old', 'alerts']);
  assert.deepEqual(text(nested), ['alerts'], 'a day block inside a covered weekend list draws no second skeleton');
  // Monday to Wednesday only the day is stale: the weekend list stays, the day block inside it gets its own skeleton.
  dom.window.document.documentElement.setAttribute('data-date-stale', 'day');
  assert.deepEqual(text(cover), ['alerts']);
  assert.deepEqual(text(nested), []);
});

test('the events column marks its range line, counts and body: weekend on 本周末, day on every other view', async () => {
  assert.deepEqual(dateScope('weekend'), { 'data-date-scope': 'weekend' });
  const { EventsShell } = await import('../src/features/events/EventsShell');
  const page = (location: string, calendar?: (day: string) => React.ReactNode) =>
    new JSDOM(renderToStaticMarkup(<MemoryRouter initialEntries={[location]}><EventsShell today="2026-10-12" calendar={calendar} /></MemoryRouter>)).window.document;
  const scopes = (doc: Document) => ['.ev-range', '.ev-lede-facts', '.ev-body > div'].map(selector => doc.querySelector(selector)?.getAttribute('data-date-scope'));
  const weekend = page('/events');
  assert.deepEqual(scopes(weekend), ['weekend', 'weekend', 'weekend'], 'range line, counts, body');
  // Inside the 本周末 body, what is keyed to the day: the share-card link (and the travel alerts when there are any).
  const nestedDay = [...weekend.querySelectorAll('.ev-body [data-date-scope="day"]')];
  assert.ok(nestedDay.some(node => node.matches('a.ev-end__item[href^="/weekly/"]')), 'the share-card link is a day block');
  for (const node of nestedDay) assert.ok(node.matches('.ev-alerts, a.ev-end__item'), node.outerHTML.slice(0, 80));
  assert.deepEqual(scopes(page('/events?when=today')), ['day', 'day', 'day']);
  const calendar = page('/calendar', day => <p>{day}</p>);
  assert.deepEqual(scopes(calendar), ['day', 'day', 'day'], 'the calendar is keyed to the day');
  assert.equal(calendar.querySelector('.ev-body > div[data-date-scope="day"] > p')?.textContent, '2026-10-12', 'the calendar view sits inside the day block');
});

/** An event count ("全部 63 场", "本周末 67 场活动", "All 63 events"): the smallest element whose text carries one. */
const EVENT_COUNT = /\d+\s*场|\b\d+ events\b|\bAll \d+\b/u;
const countLines = (root: Element) => [...root.querySelectorAll('*')].filter(node => EVENT_COUNT.test(node.textContent || '') && ![...node.children].some(child => EVENT_COUNT.test(child.textContent || '')));
const describe = (node: Element) => node.outerHTML.replace(/\s+/gu, ' ').slice(0, 120);

test('every event, offer, <time> and event count on the prerendered home sits in a block the guard covers (WEB-HOME: dateScope() or a covered class)', async () => {
  // The home prerender (scripts/prerender.tsx) renders HomeDiscovery. A dated item outside every covered block would show
  // last weekend's (or yesterday's) pick, count or dateline on a later day: this test turns red when a home redesign drops
  // the marks. WEB-HOME's head carries the build day (<time> in .home-head__dateline) and the weekend count
  // (.home-head__lede); checked against its tree (see PR.md): red without those two fallbacks, green with them.
  const today = '2026-10-12';
  const { HomeDiscovery } = await import('../src/components/HomeDiscovery');
  const markup = renderToStaticMarkup(<StaticRouter location="/"><HomeDiscovery today={today} onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></StaticRouter>);
  const doc = new JSDOM(`<!doctype html><html data-date-stale="day weekend"><body><main data-prerender-path="/">${markup}</main></body></html>`).window.document;
  const main = doc.querySelector('main')!;
  const dated = [...main.querySelectorAll('a[href]')].filter(link => /^\/(?:events|offers|openings)\/[^/?#]+/.test(link.getAttribute('href') || ''));
  const events = dated.filter(link => link.getAttribute('href')!.startsWith('/events/'));
  const offers = dated.filter(link => link.getAttribute('href')!.startsWith('/offers/'));
  const times = [...main.querySelectorAll('time')];
  const counts = countLines(main);
  assert.ok(events.length >= 3, 'home lists this weekend’s events');
  assert.ok(times.length >= 1 && counts.length >= 1, 'home shows dates and an event count');
  // A Sunday or a later week: everything dated is stale.
  const covered = coveredIn(doc);
  assert.deepEqual(dated.filter(link => !insideCovered(link, covered)).map(link => link.getAttribute('href')), []);
  assert.deepEqual(times.filter(node => !insideCovered(node, covered)).map(describe), [], 'every <time> on home is covered');
  assert.deepEqual(counts.filter(node => !insideCovered(node, covered)).map(describe), [], 'every event count is covered');
  // Monday to Saturday of the build's week ("day" only): the 本周末 picks keep; dated offers and the build day are covered.
  doc.documentElement.setAttribute('data-date-stale', 'day');
  const dayCovered = coveredIn(doc);
  assert.deepEqual(events.filter(link => insideCovered(link, dayCovered)).map(link => link.getAttribute('href')), [], 'the 本周末 picks keep all week');
  assert.deepEqual(offers.filter(link => !insideCovered(link, dayCovered)).map(link => link.getAttribute('href')), [], 'dated offers are keyed to the day');
  assert.deepEqual(times.filter(node => node.getAttribute('datetime') === today && !insideCovered(node, dayCovered)).map(describe), [], 'a <time> showing the build day is keyed to the day');
});

test('the home fallbacks reach WEB-HOME’s head: the dateline is a day block, the weekend count a weekend block', () => {
  // The shape of WEB-HOME's HomeHead (src/features/home/HomeHead.tsx there) as prerendered.
  const doc = new JSDOM(`<!doctype html><html data-date-stale="day"><body><main data-prerender-path="/"><header class="home-head">
    <p class="home-head__dateline"><span>湾区</span> · <time datetime="2026-10-12">10 月 12 日 周一</time></p><h1 class="home-head__title">这个周末，湾区去哪？</h1>
    <p class="home-head__lede">本周末 67 场活动 · 141 篇办事指南 · 每条附官方来源，10/12 核对</p></header></main>
    <div class="site-boot-main"><p class="home-head__dateline"><time datetime="2026-10-12">10 月 12 日 周一</time></p><p class="home-head__lede">本周末 67 场活动</p></div>
    <main id="app"><p class="home-head__dateline"><time datetime="2026-10-19">10 月 19 日 周一</time></p></main></body></html>`).window.document;
  const covered = (stale: string) => { doc.documentElement.setAttribute('data-date-stale', stale); return [...coveredIn(doc)].map(node => `${node.closest('.site-boot-main') ? 'boot' : 'prerender'} ${node.className}`); };
  assert.deepEqual(covered('day'), ['prerender home-head__dateline', 'boot home-head__dateline'], 'Monday to Saturday: only the dateline; the app’s own head never');
  assert.deepEqual(covered('day weekend'), ['prerender home-head__dateline', 'prerender home-head__lede', 'boot home-head__dateline', 'boot home-head__lede']);
  const { skeleton } = guardRules();
  for (const block of ['home-head__dateline', 'home-head__lede']) assert.equal(skeleton.filter(selector => selector.endsWith(`.${block}::before`)).length, 2, `${block} draws its skeleton in both wrappers`);
  // Every skeleton stops shimmering under reduced motion (the reduced-motion rule names each block without its scope).
  const reduced: string[] = [];
  postcss.parse(fs.readFileSync('src/features/source-monitor/source-monitor.css', 'utf8')).walkAtRules('media', media => {
    if (media.params.includes('prefers-reduced-motion')) media.walkRules(rule => { reduced.push(...rule.selectors); });
  });
  for (const selector of skeleton) {
    const unscoped = selector.replace(/^html\[data-date-stale~="\w+"\]/u, 'html[data-date-stale]').replace(/\[data-date-scope="\w+"\]/u, '[data-date-scope]');
    assert.ok(reduced.includes(unscoped), `reduced motion: ${unscoped}`);
  }
});
