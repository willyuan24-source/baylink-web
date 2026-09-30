import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 7 · lane S review (W7-S-review): two defects found in play.
 *
 *   - the DST line ("今天凌晨两点，钟拨回了一小时…", past tense) was on offer from 00:00 on 1 Nov — a player still up after
 *     Halloween night heard it at 00:30, before the clocks went back; now it is offered from 02:00 on the Bay clock
 *     (02:00 PST, an hour after the change; the repeated 01:00–01:59 hour reads 1:xx both times, so never before it)
 *   - the Chase Center Muni line's link ("BAYLINK 优惠详情" + its external-link icon): the icon (a block svg under the site's
 *     base styles) dropped onto its own line under the words on the phone and the desktop card; the link now keeps its
 *     icon inline (like the card's source links) and has a 44 px tall hit area on a coarse pointer
 */

const g = globalThis as unknown as Record<string, unknown>;
g.location = { search: '?world=city&save=off', href: 'http://localhost/opus-bay?world=city&save=off', pathname: '/opus-bay', hostname: 'localhost' };
g.window ??= globalThis;

const { parseBayDate } = await import('../src/opus-bay/game/bayNow');
const cal = await import('../src/opus-bay/realsf/calendar');

const FAR = { x: 5000, z: 5000 };
const ids = (spec: string) => { const d = parseBayDate(spec); assert.ok(d, spec); return cal.calendarLines(d!, FAR).map(l => l.key); };

test('W7-S-review the DST line is not said before the clocks go back (1 Nov 00:00–01:59: none; from 02:00: the line)', () => {
  assert.deepEqual(ids('2026-11-01T00:05'), [], 'just after midnight: the clocks have not gone back yet');
  assert.deepEqual(ids('2026-11-01T00:30'), [], '00:30');
  assert.deepEqual(ids('2026-11-01T01:30'), [], '01:30 (either copy of the repeated hour)');
  assert.deepEqual(ids('2026-11-01T02:00'), ['calendar-dst-end-2026']);
  assert.deepEqual(ids('2026-11-01T09:00'), ['calendar-dst-end-2026']);
  assert.deepEqual(ids('2026-11-01T23:30'), ['calendar-dst-end-2026']);
  assert.deepEqual(ids('2026-11-02T00:30'), [], 'not the day after');
  const row = cal.CALENDAR.find(r => r.id === 'dst-end-2026')!;
  assert.match(row.line!.zh, /钟拨回了/, 'the fixed text lane X voices is unchanged');
});

test('W7-S-review the Chase Center Muni link keeps its icon on its line and has a 44 px hit area on touch', () => {
  const css = fs.readFileSync(path.resolve('src/opus-bay/realsf/realsf.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // the rules of a style sheet (a media block's inner rules included): selector list → body
  const rules = (src: string) => [...src.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].split(',').map(s => s.trim()), body: m[2] }));
  const rule = (sel: string, src = css) => rules(src).filter(r => r.sel.includes(sel)).map(r => r.body).join(';');
  const top = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  assert.match(rule('.ob-howto-offer a', top), /display:\s*inline-flex/, 'the link is one inline box: text + icon together');
  assert.match(rule('.ob-howto-offer a svg', top), /display:\s*inline-block|display:\s*inline\b/, 'the icon is not a block');
  const coarse = [...css.matchAll(/@media\s*\(pointer:\s*coarse\)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)].map(m => m[1]).join('\n');
  const touch = rule('.ob-howto-offer a', coarse);
  assert.match(touch, /min-height:\s*44px/, 'a 44 px tall hit area on touch');
});
