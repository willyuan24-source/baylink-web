import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import postcss, { type AtRule, type Rule } from 'postcss';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { EventFacts, NOTE_CLAMP_UNITS } from '../src/features/detail/FactsGrid';
import { MAX_SESSION_LINES, sessionLines } from '../src/features/detail/session-lines';
import type { MonthlyEvent } from '../src/data/monthly-types';

/**
 * H58 (EVT13-12): the facts card's 何时 cell collapses sessions that share a time into one line, shows at most two lines
 * and then 另有 N 场, so the card ends above the phone's fixed action bar. Every date is a session date and every time
 * the record's own; nothing is invented. UI9-DETAIL: the lines are the note under the key (eventWhenLine), and each time
 * is printed exactly as the key prints that day's time (sessionTime: a window "8:30–12:00", else eventTimeLabel's "10 点起"),
 * so the key and its note never use two styles (N06; the zh "N 点起" itself is C's, a UI9-INT request).
 */
const sessions = (rows: [string, string?, string?][]) => ({ sessions: rows.map(([date, start, end]) => ({ date, ...(start ? { start } : {}), ...(end ? { end } : {}) })) });
const saturdays = ['2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28'];

test('sessions with one time collapse into one line: one weekday, a weekly series, or a run of days', () => {
  assert.deepEqual(sessionLines(sessions(saturdays.slice(0, 3).map(day => [day, '08:30', '12:00'])), '2026-10-13', false),
    { lines: ['周六 10/17、10/24、10/31 · 8:30–12:00'], more: 0 }, 'the brief\'s example');
  assert.deepEqual(sessionLines(sessions(saturdays.map(day => [day, '08:30', '12:00'])), '2026-10-13', false),
    { lines: ['每周六 10/17–11/28 · 8:30–12:00'], more: 0 }, 'strictly weekly: the whole series in one line');
  assert.deepEqual(sessionLines(sessions(saturdays.map(day => [day, '08:30', '12:00'])), '2026-10-13', true),
    { lines: ['Every Sat Oct 17–Nov 28 · 8:30am–12pm'], more: 0 }, 'US English dates on /en (WEB-FIX6)');
  // The Fall Show: three days at one time, the Sunday at another.
  const fall = sessions([['2026-10-15', '10:30', '19:00'], ['2026-10-16', '10:30', '19:00'], ['2026-10-17', '10:30', '19:00'], ['2026-10-18', '11:00', '17:00']]);
  assert.deepEqual(sessionLines(fall, '2026-10-13', false), { lines: ['周四至周六 10/15–17 · 10:30–19:00', '周日 10/18 · 11:00–17:00'], more: 0 });
  assert.deepEqual(sessionLines(fall, '2026-10-13', true).lines, ['Thu–Sat Oct 15–17 · 10:30am–7pm', 'Sun Oct 18 · 11am–5pm']);
  // A run across a month end.
  assert.deepEqual(sessionLines(sessions([['2026-10-30', '18:30', '22:00'], ['2026-10-31', '18:30', '22:00'], ['2026-11-01', '18:30', '22:00']]), '2026-10-13', false).lines, ['周五至周日 10/30–11/1 · 18:30–22:00']);
  // A week or more of days in a row is 每天, never "周四至周六 10/15–24" (which reads as three weekdays). Six days keep the range.
  const run = (count: number) => sessions(Array.from({ length: count }, (_, index) => [`2026-10-${String(15 + index).padStart(2, '0')}`, '10:00', '17:00'] as [string, string, string]));
  assert.deepEqual(sessionLines(run(10), '2026-10-13', false).lines, ['每天 10/15–24 · 10:00–17:00']);
  assert.deepEqual(sessionLines(run(10), '2026-10-13', true).lines, ['Daily Oct 15–24 · 10am–5pm']);
  assert.deepEqual(sessionLines(run(7), '2026-10-13', false).lines, ['每天 10/15–21 · 10:00–17:00']);
  assert.deepEqual(sessionLines(run(6), '2026-10-13', false).lines, ['周四至周二 10/15–20 · 10:00–17:00']);
});

test('mixed dates list what fits one phone line and count the rest; times beyond two lines become 另有 N 场', () => {
  // The opera: 19:30 on five days, 14:00 on one. Five full dates do not fit one line, so later October dates drop the month.
  const opera = sessions([['2026-10-15', '19:30'], ['2026-10-18', '14:00'], ['2026-10-21', '19:30'], ['2026-10-24', '19:30'], ['2026-10-27', '19:30'], ['2026-10-30', '19:30']]);
  assert.deepEqual(sessionLines(opera, '2026-10-13', false), { lines: ['10/15、21、24、27、30 · 19:30 起', '周日 10/18 · 14 点起'], more: 0 });
  assert.deepEqual(sessionLines(opera, '2026-10-13', true).lines, ['Oct 15, 21, 24, 27, 30 · From 7:30pm', 'Sun Oct 18 · From 2pm']);
  // More dates than one line holds: what fits, then the line's own count.
  const many = sessions(['2026-10-03', '2026-10-05', '2026-10-09', '2026-10-14', '2026-10-20', '2026-10-26', '2026-11-02', '2026-11-09'].map(day => [day, '10:00']));
  assert.deepEqual(sessionLines(many, '2026-10-01', false).lines, ['10/3、5、9、14、20 等 8 场 · 10 点起']);
  assert.deepEqual(sessionLines(many, '2026-10-01', true).lines, ['Oct 3, 5, 9, 14 + 4 more · From 10am']);
  // Weekend runs at one time: runs keep their own spans, no weekday for a mixed list.
  const goblin = sessions(['2026-10-17', '2026-10-18', '2026-10-24', '2026-10-25', '2026-10-31'].map(day => [day, '09:00']));
  assert.deepEqual(sessionLines(goblin, '2026-10-13', false).lines, ['10/17–18、10/24–25、10/31 · 9 点起']);
  // Three times: two lines, then the third time's days are counted.
  const three = sessions([['2026-10-17', '10:00'], ['2026-10-18', '12:00'], ['2026-10-24', '15:00'], ['2026-10-25', '15:00']]);
  const result = sessionLines(three, '2026-10-13', false);
  assert.equal(result.lines.length, MAX_SESSION_LINES);
  assert.deepEqual(result, { lines: ['周六 10/17 · 10 点起', '周日 10/18 · 12 点起'], more: 2 });
});

test('US English drops a repeated month ("Oct 22–25, 29–31"); Chinese keeps "10/22–25、10/29–31"; a run into the next month keeps both', () => {
  // Pleasanton Pumpkins After Dark from 10/15: the line that wrapped at 简洁显示 (WEB-FIX6 review).
  const pumpkins = sessions([['2026-10-15', '18:45', '22:00'], ['2026-10-16', '18:45', '22:00'], ['2026-10-17', '18:45', '22:00'], ['2026-10-18', '18:45', '22:00'],
    ...['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-29', '2026-10-30', '2026-10-31'].map(day => [day, '18:30', '22:00'] as [string, string, string])]);
  assert.deepEqual(sessionLines(pumpkins, '2026-10-15', true).lines, ['Thu–Sun Oct 15–18 · 6:45pm–10pm', 'Oct 22–25, 29–31 · 6:30pm–10pm']);
  assert.deepEqual(sessionLines(pumpkins, '2026-10-15', false).lines, ['周四至周日 10/15–18 · 18:45–22:00', '10/22–25、10/29–31 · 18:30–22:00']);
  const goblin = sessions(['2026-10-17', '2026-10-18', '2026-10-24', '2026-10-25', '2026-10-31'].map(day => [day, '09:00']));
  assert.deepEqual(sessionLines(goblin, '2026-10-13', true).lines, ['Oct 17–18, 24–25, 31 · From 9am']);
  const across = sessions(['2026-10-24', '2026-10-25', '2026-10-30', '2026-10-31', '2026-11-01'].map(day => [day, '09:00']));
  assert.deepEqual(sessionLines(across, '2026-10-13', true).lines, ['Oct 24–25, Oct 30–Nov 1 · From 9am']);
});

test('counts are days: a line whose days have several times each says 等 N 天, and so does 另有 N 天', () => {
  // The Fort Point talks: six days, three talks a day. "等 6 场" would undercount 18 talks.
  const talks = sessions(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-27', '2026-11-28', '2026-11-29'].flatMap(day => [[day, '11:30'], [day, '13:30'], [day, '14:30']] as [string, string][]));
  const result = sessionLines(talks, '2026-11-01', false);
  assert.equal(result.lines.length, 1);
  assert.match(result.lines[0], /^11\/20–22.* 等 6 天 · 11:30、13:30、14:30$/);
  assert.doesNotMatch(result.lines[0], /场/);
  // Three days of two shows, one more time beyond the two lines: 另有 N 天.
  const shows = sessions([['2026-10-17', '11:00'], ['2026-10-17', '15:00'], ['2026-10-18', '12:00'], ['2026-10-24', '10:00'], ['2026-10-24', '14:00']]);
  assert.deepEqual(sessionLines(shows, '2026-10-13', false), { lines: ['周六 10/17 · 11:00、15:00', '周日 10/18 · 12 点起'], more: 1, moreDays: true });
  // One session a day keeps 场 and has no moreDays.
  assert.equal(sessionLines(sessions([['2026-10-17', '10:00'], ['2026-10-18', '12:00'], ['2026-10-24', '15:00']]), '2026-10-13', false).moreDays, undefined);
});

test('past days drop out (all of them stay when none is left); a day without a time is a date alone', () => {
  const past = sessions([['2026-10-03', '09:00'], ['2026-10-10', '09:00'], ['2026-10-17', '09:00']]);
  assert.deepEqual(sessionLines(past, '2026-10-13', false).lines, ['周六 10/17 · 9 点起']);
  assert.deepEqual(sessionLines(past, '2026-11-01', false).lines, ['周六 10/3、10/10、10/17 · 9 点起'], 'an ended event keeps its dates');
  assert.deepEqual(sessionLines(sessions([['2026-10-17'], ['2026-10-18']]), '2026-10-13', false).lines, ['周六至周日 10/17–18']);
  assert.deepEqual(sessionLines({}, '2026-10-13', false), { lines: [], more: 0 });
});

// Any catalog event serves as the base: the test sets the fields it reads (sessions, cost) itself.
const baseEvent = (): MonthlyEvent => {
  const base = MONTHLY_EVENTS[0];
  assert.ok(base, 'the catalog has events');
  return { ...base, planning: undefined, sessions: undefined, dateNote: undefined };
};
const facts = (event: MonthlyEvent) => new JSDOM(renderToStaticMarkup(<EventFacts event={event} today="2026-10-13" />)).window.document;

test('the facts card renders the merged lines and 另有 N 场 for an event with sessions', () => {
  const doc = facts({ ...baseEvent(), ...sessions([['2026-10-17', '10:00'], ['2026-10-18', '12:00'], ['2026-10-24', '15:00'], ['2026-10-25', '15:00']]) } as MonthlyEvent);
  const lines = [...doc.querySelectorAll('[data-fact="when"] dd small > .detail-fact__line')].map(line => line.textContent);
  assert.deepEqual(lines, ['周六 10/17 · 10 点起', '周日 10/18 · 12 点起', '另有 2 场']);
  const days = facts({ ...baseEvent(), ...sessions([['2026-10-17', '11:00'], ['2026-10-17', '15:00'], ['2026-10-18', '12:00'], ['2026-10-24', '10:00'], ['2026-10-24', '14:00']]) } as MonthlyEvent);
  assert.equal([...days.querySelectorAll('[data-fact="when"] dd small > .detail-fact__line')].at(-1)?.textContent, '另有 1 天');
});

test('a 何时 line wraps only between its pieces: dates, and the time after " · " (never inside "6:30pm–10pm")', () => {
  const pumpkins = sessions([['2026-10-22', '18:30', '22:00'], ['2026-10-23', '18:30', '22:00'], ['2026-10-24', '18:30', '22:00'], ['2026-10-25', '18:30', '22:00'], ['2026-10-29', '18:30', '22:00'], ['2026-10-30', '18:30', '22:00'], ['2026-10-31', '18:30', '22:00']]);
  const doc = facts({ ...baseEvent(), ...pumpkins } as MonthlyEvent);
  const line = doc.querySelector('[data-fact="when"] dd small > .detail-fact__line')!;
  assert.equal(line.textContent, '10/22–25、10/29–31 · 18:30–22:00', 'the text is unchanged');
  assert.deepEqual([...line.querySelectorAll('.detail-fact__keep')].map(piece => piece.textContent), ['10/22–25', '10/29–31 ·', '18:30–22:00']);
  const css = readFileSync('src/features/detail/facts-grid.css', 'utf8');
  assert.match(css.split('@media')[0], /\.detail-fact__keep \{ display:inline-block; max-width:100%; \}/, 'each piece moves to the next line whole, at every reading size');
  const plain = facts({ ...baseEvent(), ...sessions([['2026-10-17'], ['2026-10-18']]) } as MonthlyEvent);
  assert.deepEqual([...plain.querySelectorAll('[data-fact="when"] small .detail-fact__keep')].map(piece => piece.textContent), ['周六至周日 10/17–18'], 'a line without a time is one piece');
});

// H58 rest (Pleasanton, Disney On Ice, Petaluma, Sausalito): a long cost note made the card run under the phone's action bar.
// UI9-R1-DETAIL (J1 P14): a cost fact on the card's whole row (适合 too long to share it: for-wide) clamps only a note
// longer than two lines of it (Petaluma, Dickens), with 展开 on a line of its own; a two-line note (Pleasanton) shows whole.
// Beside a short 适合 (for, paired on a phone, H58 review) the half card clamps from two of its own lines, the pre-R1
// threshold. The sentence stays whole
// in the markup either way.
const wide = { audience: ['现场演出爱好者', '朋友结伴', '本地居民'], ageChip: undefined };
test('a long cost note is marked for the two-line clamp with a 展开 toggle; a short one is not', () => {
  const long = '基础入场及停车免费；日间大迷宫6岁以上$9、5岁及以下免费；周五周六夜迷宫$13；其他项目、南瓜和餐饮另付。';
  const doc = facts({ ...baseEvent(), ...wide, cost: 'paid', price: { min: 9, max: 13 }, costLabel: long } as MonthlyEvent);
  assert.ok(doc.querySelector('[data-fact="for-wide"]') && !doc.querySelector('[data-fact="for"]'), 'a long 适合 takes its own row');
  const cell = doc.querySelector('[data-fact="cost"]')!;
  assert.ok(cell.hasAttribute('data-clamp'), 'long note: clamped on a phone');
  const note = cell.querySelector('dd > small')!;
  assert.equal(note.textContent, long, 'the whole sentence is in the page');
  const toggle = cell.querySelector('dd > button.detail-fact__toggle')!;
  assert.equal(toggle.textContent, '展开');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.getAttribute('aria-controls'), note.id);
  assert.equal(toggle.getAttribute('aria-label'), '展开：多少钱');
  const twoLines = '18 岁以上 $28.80、4–17 岁 $22.80，3 岁及以下免费；停车 $15（只收刷卡和手机支付）。';
  const whole = facts({ ...baseEvent(), ...wide, cost: 'paid', price: { min: 22.8, max: 28.8 }, costLabel: twoLines } as MonthlyEvent);
  assert.ok(!whole.querySelector('[data-fact="cost"]')!.hasAttribute('data-clamp'), 'two lines of the card: shown whole, no 展开');
  const short = facts({ ...baseEvent(), ...wide, cost: 'paid', price: { min: 20 }, costLabel: '普通 $20；会员 $15。' } as MonthlyEvent);
  assert.ok(!short.querySelector('[data-fact="cost"]')!.hasAttribute('data-clamp'));
  assert.equal(short.querySelectorAll('.detail-fact__toggle').length, 0);
  const narrow = { audience: ['全家'], ageChip: undefined };
  const half = facts({ ...baseEvent(), ...narrow, cost: 'paid', price: { min: 22.8, max: 28.8 }, costLabel: twoLines } as MonthlyEvent);
  assert.ok(half.querySelector('[data-fact="for"]'), '多少钱 | 适合 share the row');
  assert.ok(half.querySelector('[data-fact="cost"]')!.hasAttribute('data-clamp'), 'over two lines of the half card: clamped');
  const halfShort = facts({ ...baseEvent(), ...narrow, cost: 'paid', price: { min: 20 }, costLabel: '普通 $20；会员 $15。' } as MonthlyEvent);
  assert.ok(halfShort.querySelector('[data-fact="for"]'));
  assert.ok(!halfShort.querySelector('[data-fact="cost"]')!.hasAttribute('data-clamp'));
  assert.ok(NOTE_CLAMP_UNITS >= 44 && NOTE_CLAMP_UNITS <= 48, 'about two lines of the 324px card at 14px');
});

test('the clamp applies only to a phone in 标准; 大 / 特大 / 简洁显示 and the desktop list show the note whole', () => {
  const css = postcss.parse(readFileSync('src/features/detail/facts-grid.css', 'utf8'));
  const outside: string[] = [];
  const phone: Rule[] = [];
  css.walkRules(rule => {
    if (!/detail-fact__toggle|data-clamp/.test(rule.selector)) return;
    const media = rule.parent?.type === 'atrule' ? (rule.parent as AtRule).params : undefined;
    if (media === '(max-width:767px)') phone.push(rule); else outside.push(rule.toString());
  });
  assert.deepEqual(outside, ['.local-discovery-detail .detail-fact__toggle { display:none; }'], 'no toggle by default');
  assert.ok(phone.length, 'the clamp is inside the phone media query');
  for (const rule of phone) assert.match(rule.selector, /^html:not\(\[data-reading=large\],\[data-reading=extra-large\],\[data-simple\]\) /, `standard reading size only: ${rule.selector.slice(0, 60)}`);
  const text = phone.map(rule => rule.toString()).join('\n');
  assert.match(text, /\[data-clamp\]:not\(\[data-open\]\) dd>small \{ max-height:calc\(2em \* var\(--lh-ui\)\); overflow:hidden;/, 'two lines of the note');
  assert.match(text, /mask:/, 'the second line fades out at its end');
  assert.doesNotMatch(text, /position:absolute; right:0; bottom:0/, 'the toggle no longer sits over the text');
  assert.match(text, /__toggle::before \{[^}]*height:var\(--control-height\)/, 'a 44px target');
});
