import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { englishTimes, ISO_DATE, twentyFourHourTime } from '../src/lib/english-times';
import { englishFormatProblems, englishTitleProblems } from '../scripts/i18n-html-check.mjs';
import { addNeutralEntries } from '../scripts/generate-english-scopes';
import { enableUsEnglishTimes, loadLocale, translateText } from '../src/i18n/locale';

const OPUS_DATE_LINE = '9/29–10/4 · 9/29、10/2 19:30；10/4 14:00；节目页时长约 2 小时 51 分钟';
const has24hOrIso = (text: string) => !!twentyFourHourTime(text.replace(/https?:\/\/\S+/g, '')) || ISO_DATE.test(text.replace(/https?:\/\/\S+/g, ''));

// First, before the switch: the Opus Bay game shares the dictionary and keeps its reviewed formats (its own test pins them)
test('H41: without the site switch, English keeps the dictionary as generated (the Opus Bay game)', async () => {
  await loadLocale('en');
  assert.match(translateText(OPUS_DATE_LINE, 'en'), /^9\/29–10\/4 · 9\/29 and 10\/2 at 19:30; 10\/4 at 14:00\. /);
  assert.equal(translateText('14:00–16:00', 'en'), '14:00–16:00');
  assert.equal(translateText('10/18 · 14:00–16:00', 'en'), '10/18 · 14:00–16:00');
  // the site switches it on (i18n/metadata.ts); a dictionary already loaded converts then
  await enableUsEnglishTimes();
  assert.match(translateText(OPUS_DATE_LINE, 'en'), /^Sep 29–Oct 4 · Sep 29 and Oct 2 at 7:30pm; Oct 4 at 2pm\. /);
  assert.match(translateText('10/18 · 14:00–16:00', 'en'), /^Oct 18 · 2–4\s?p\.?m\.?$/);
});

/** H41 (I13-04): English text uses the 12-hour clock and "Oct 13, 2026" / "Sep 25–Oct 31" dates. */
test('H41: 24-hour times become am/pm, with one am/pm on a range that shares it', () => {
  const cases: [string, string][] = [
    ['Oct 11, 2026 · 13:00–15:00, local store time', 'Oct 11, 2026 · 1–3pm, local store time'],
    ['Schedule: 09:00–15:00.', 'Schedule: 9am–3pm.'],
    ['Two sessions: 11:00–12:00 and 12:00–13:00.', 'Two sessions: 11am–noon and noon–1pm.'],
    ['Oct 6 · 10:00–16:30; last admission at 16:00', 'Oct 6 · 10am–4:30pm; last admission at 4pm'],
    ['Schedule: 19:30; doors open at 18:30.', 'Schedule: 7:30pm; doors open at 6:30pm.'],
    ['from 19:30–21:00: lantern decorating at 19:30', 'from 7:30–9pm: lantern decorating at 7:30pm'],
    ['06:00–07:30: $20; 13:00–15:00: $5', '6–7:30am: $20; 1–3pm: $5'],
    ['Storytime is a fixed 11:00–11:30 session; the room opens at 10:50.', 'Storytime is a fixed 11–11:30am session; the room opens at 10:50am.'],
    ['The book sale runs 10:30–3:00 the same day.', 'The book sale runs 10:30am–3pm the same day.'],
    ['Oct 28 · 4:30–6pm', 'Oct 28 · 4:30–6pm'],
    ['Gather 5:45, parade 6:00, dog contest 6:30 pm', 'Gather 5:45pm, parade 6pm, dog contest 6:30 pm'],
    ['10 a.m.–3:30 p.m., with last admission at 1:30', '10 a.m.–3:30 p.m., with last admission at 1:30pm'],
    ['Visit between 6:30 and 8 pm', 'Visit between 6:30pm and 8 pm'],
  ];
  for (const [input, output] of cases) assert.equal(englishTimes(input), output, input);
});

test('H41: ISO, year-first and M/D dates become "Oct 13, 2026" and "Sep 25–Oct 31"; URLs, ratios and day pairs stay', () => {
  const cases: [string, string][] = [
    ['Checked 2026-10-05: apply online first.', 'Checked Oct 5, 2026: apply online first.'],
    ['Parts of the loop are closed from 2026/9/1–10/30.', 'Parts of the loop are closed from Sep 1–Oct 30, 2026.'],
    ['Purchase window: 9/1–9/30/2026.', 'Purchase window: Sep 1–Sep 30, 2026.'],
    ['9/25–10/31', 'Sep 25–Oct 31'],
    ['10/23–10/25 · Friday and Saturday', 'Oct 23–25 · Friday and Saturday'],
    ['Weekends 10/24–25 and 10/31: check the hours', 'Weekends Oct 24–25 and Oct 31: check the hours'],
    ['Sat 10/3 · Register in advance', 'Sat, Oct 3 · Register in advance'],
    ['See https://example.org/2026-10-05/a?t=10:30 for 2026-10-05', 'See https://example.org/2026-10-05/a?t=10:30 for Oct 5, 2026'],
    ['Wednesdays fall on 6/7, 13/14, 20/21 and 27/28', 'Wednesdays fall on 6/7, 13/14, 20/21 and 27/28'],
    ['Open 24/7; half price (1/2 off)', 'Open 24/7; half price (1/2 off)'],
    ['A 16:9 screen, version 2.10', 'A 16:9 screen, version 2.10'],
  ];
  for (const [input, output] of cases) assert.equal(englishTimes(input), output, input);
  for (const [, output] of cases.slice(0, 8)) assert.equal(has24hOrIso(output), false, output);
});

test('H41: look-behind written in code skips a time inside a number, a ratio, a price or a path, and finds the next one', () => {
  assert.equal(englishTimes('Bus 112:30 leaves at 14:00'), 'Bus 112:30 leaves at 2pm');
  assert.equal(englishTimes('$12:30 or 14:00'), '$12:30 or 2pm');
  assert.equal(englishTimes('v1.10:00, then 09:00–10:30'), 'v1.10:00, then 9–10:30am');
  assert.equal(twentyFourHourTime('v2.14:30'), undefined);
  assert.equal(twentyFourHourTime('v2.14:30 and 18:30'), '18:30');
  assert.equal(englishTimes('9/1/2026 and 1/9/2026'), 'Sep 1, 2026 and Jan 9, 2026');
});

test('H41: generation adds entries for neutral date lines, never for bare data tokens; the reviewed values stay', () => {
  const dictionary: Record<string, string> = { '营业 10:00–17:00': 'Open 10:00–17:00', '已核对 2026-10-12': 'Checked 2026-10-12' };
  const added = addNeutralEntries(dictionary, [{ dateLabel: '10/18 · 14:00–16:00', startDate: '2026-10-18', sessions: [{ start: '14:00', end: '16:00' }], url: 'https://example.org/2026/10/18' }]);
  assert.equal(added, 1, 'only the date line: an ISO date, a session time and a URL are data');
  assert.equal(dictionary['10/18 · 14:00–16:00'], 'Oct 18 · 2–4pm');
  assert.equal(dictionary['2026-10-18'], undefined);
  assert.equal(dictionary['14:00'], undefined);
  assert.equal(dictionary['营业 10:00–17:00'], 'Open 10:00–17:00', 'the site converts values as they load, not here');
});

test('H41: the /en release check fails on a planted 24-hour time or ISO date, and accepts 12-hour text', () => {
  const page = (body: string) => `<html><head><title>Test | BAYLINK</title></head><body><main>${body}</main></body></html>`;
  assert.deepEqual(englishFormatProblems(page('<p>Doors open at 6:30pm; the show runs 7–9pm.</p><p>Oct 18 · 4:30–6pm</p>')), []);
  assert.match(englishFormatProblems(page('<p>Doors open at 18:30.</p>')).join(' '), /18:30/);
  assert.match(englishFormatProblems(page('<p>Checked 2026-10-12.</p>')).join(' '), /2026-10-12/);
  assert.deepEqual(englishFormatProblems(page('<p translate="no">用户写的 18:30</p>')), [], 'user text marked as such is not ours to change');
  assert.match(englishFormatProblems(page('<img alt="Opens at 09:00">')).join(' '), /09:00/, 'readable attributes count');
});

test('H46: the /en release check fails on a title over 60 characters', () => {
  assert.deepEqual(englishTitleProblems('<html><head><title>Calendar | BAYLINK</title></head><body></body></html>'), []);
  assert.match(englishTitleProblems(`<html><head><title>${'A long title '.repeat(6)}| BAYLINK</title></head><body></body></html>`).join(' '), /characters/);
});

test('H41: the site\'s English dictionary, as loaded, carries no 24-hour time or ISO date (after npm run pretest)', { skip: !existsSync('src/data/generated/english.json') }, async () => {
  const dictionary = JSON.parse(readFileSync('src/data/generated/english.json', 'utf8')) as Record<string, string>;
  await enableUsEnglishTimes();
  await loadLocale('en');
  const left = Object.keys(dictionary).map(key => translateText(key, 'en')).filter(has24hOrIso);
  assert.ok(left.length <= 5, `${left.length} left: ${left.slice(0, 5).join(' | ')}`);
});

test('H41: on /en, date and time tokens a page renders from data read in US style; other text without Chinese stays', async () => {
  await enableUsEnglishTimes();
  await loadLocale('en');
  const cases: [string, string][] = [
    ['2026-10-05', 'Oct 5, 2026'],
    [' 2026-10-05 ', ' Oct 5, 2026 '],
    ['14:00–16:00', '2–4pm'],
    ['10/22–10/25 · 10/22 19:00；10/23 11:00、15:00', 'Oct 22–25 · Oct 22 7pm; Oct 23 11am, 3pm'],
    ['10/18', '10/18'],
    ['24/7', '24/7'],
    ['510-555-1234', '510-555-1234'],
    ['Route 1/2', 'Route 1/2'],
    ['Open 1–3pm', 'Open 1–3pm'],
  ];
  for (const [input, output] of cases) assert.equal(translateText(input, 'en'), output, input);
  // a known label before a full-width colon keeps its value as data, read in US style
  assert.equal(translateText('开业消息核对：2026-10-07', 'en'), 'Opening news checked: Oct 7, 2026');
  // 繁體 and 简体 keep the data as written
  assert.equal(translateText('2026-10-05', 'zh-Hant'), '2026-10-05');
  assert.equal(translateText('14:00–16:00', 'zh-Hans'), '14:00–16:00');
  // a composed line keeps its translated parts and converts its date line ("10/18 · 14:00–16:00 ｜ Atherton ｜ …")
  const composed = translateText('10/18 · 14:00–16:00 ｜ Atherton ｜ 免费', 'en');
  assert.equal(twentyFourHourTime(composed), undefined, composed);
  assert.match(composed, /2–4\s?p\.?m\.? ｜ Atherton ｜ Free/);
});
