// CW-02 / EVT11-05: a page prerendered for another Pacific day shows a skeleton over its date blocks until the app renders
// today's result (src/lib/date-guard.ts, public/reading-init.js, source-monitor.css, docs/daily-rebuild.md).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import { MemoryRouter } from 'react-router-dom';
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

test('only the prerendered copy of a date block is covered; the blocks the app renders never are', () => {
  const css = fs.readFileSync('src/features/source-monitor/source-monitor.css', 'utf8');
  const selectors: string[] = [];
  postcss.parse(css).walkRules(rule => { if (rule.selector.includes('data-date-stale')) selectors.push(...rule.selectors); });
  for (const scope of ['weekend', 'day'] as const) {
    for (const wrapper of ['main[data-prerender-path]', '.site-boot-main']) {
      assert.ok(selectors.includes(`html[data-date-stale~="${scope}"] ${wrapper} [data-date-scope="${scope}"]`), `${scope} under ${wrapper}`);
    }
  }
  for (const selector of selectors) assert.match(selector, /main\[data-prerender-path\]|\.site-boot-main/, `${selector} is limited to the prerendered page or its boot snapshot`);
  // Rendered into a real DOM: the guard's selector reaches the prerendered block and not a fresh app block.
  const dom = new JSDOM(`<html data-date-stale="day weekend"><body><div id="root"><main data-prerender-path="/events"><div data-date-scope="weekend">old</div></main></div><main id="app"><div data-date-scope="weekend">new</div></main></body></html>`);
  const covered = (selector: string) => [...dom.window.document.querySelectorAll(selector)].map(node => node.textContent);
  assert.deepEqual(covered('html[data-date-stale~="weekend"] main[data-prerender-path] [data-date-scope="weekend"], html[data-date-stale~="weekend"] .site-boot-main [data-date-scope="weekend"]'), ['old']);
});

test('the events column marks its range line, counts and body: weekend on 本周末, day on every other view', async () => {
  assert.deepEqual(dateScope('weekend'), { 'data-date-scope': 'weekend' });
  const { EventsShell } = await import('../src/features/events/EventsShell');
  const weekend = renderToStaticMarkup(<MemoryRouter initialEntries={['/events']}><EventsShell today="2026-10-12" /></MemoryRouter>);
  assert.equal(weekend.match(/data-date-scope="weekend"/g)?.length, 3, 'range line, counts, body');
  assert.doesNotMatch(weekend, /data-date-scope="day"/);
  const today = renderToStaticMarkup(<MemoryRouter initialEntries={['/events?when=today']}><EventsShell today="2026-10-12" /></MemoryRouter>);
  assert.equal(today.match(/data-date-scope="day"/g)?.length, 3);
  const calendar = renderToStaticMarkup(<MemoryRouter initialEntries={['/calendar']}><EventsShell today="2026-10-12" calendar={day => <p>{day}</p>} /></MemoryRouter>);
  assert.equal(calendar.match(/data-date-scope="day"/g)?.length, 3, 'the calendar is keyed to the day');
  assert.ok(calendar.includes('<div data-date-scope="day"><p>2026-10-12</p></div>'), 'the calendar view sits inside the day block');
});
