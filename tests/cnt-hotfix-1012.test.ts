import assert from 'node:assert/strict';
import test from 'node:test';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentOpenings } from '../src/data/local-discoveries';
import { PLANNER_CATALOG } from '../src/data/planner-catalog';
import { guides } from '../src/data/guides';
import { EVENT_DATE_OVERRIDES } from '../src/data/event-calendar-dates';
import { INDEX_EVENTS } from '../src/features/events/events-model';
import { eventOccursOn, eventsOnCalendarDay } from '../src/lib/event-calendar';
import { filterMonthlyEvents, getEventStatus } from '../src/lib/monthly';
import { MONTHLY_METADATA } from '../src/lib/monthly-metadata';
import { loadLocale, translateText } from '../src/i18n/locale';

/** CNT-HOTFIX (2026-10-12 source reads, docs/source-reads-2026-10.md): live facts that would have wasted a trip. */
const event = (id: string) => MONTHLY_EVENTS.find(item => item.id === id)!;
const opening = (id: string) => currentOpenings.find(item => item.id === id)!;

test('an event whose only source no longer lists its day leaves every list, the calendar day and the planner (San Mateo 11/5)', () => {
  const id = 'san-mateo-downtown-market-nov5-2026';
  const market = event(id);
  assert.deepEqual(market.occurrenceDates, []);
  assert.equal(market.status, undefined, 'unconfirmed is not cancelled');
  assert.equal(getEventStatus(market, '2026-10-12'), 'ended');
  for (const date of ['all', 'next7', 'november'] as const) {
    assert.ok(!filterMonthlyEvents(MONTHLY_EVENTS, { date }, '2026-11-01').some(item => item.id === id), date);
  }
  assert.deepEqual(EVENT_DATE_OVERRIDES[id] ?? market.occurrenceDates, []);
  assert.ok(!eventsOnCalendarDay(MONTHLY_EVENTS, '2026-11-05').some(item => item.id === id));
  const indexed = INDEX_EVENTS.find(item => item.id === id);
  assert.ok(!indexed || !eventOccursOn(indexed as never, '2026-11-05'), 'the slim index has no 11/5 day');
  assert.deepEqual(PLANNER_CATALOG.events.find(item => item.id === id)!.occurrenceDates, []);
});

test('the Doja Cat show moved from Mon 10/19 to Sun 10/25 (Chase Center)', () => {
  const show = event('sf-doja-cat-2026');
  assert.equal(show.startDate, '2026-10-25');
  assert.deepEqual(show.occurrenceDates, ['2026-10-25']);
  assert.deepEqual(show.sessions, [{ date: '2026-10-25', start: '19:30' }]);
  assert.ok(eventsOnCalendarDay(MONTHLY_EVENTS, '2026-10-25').some(item => item.id === show.id));
  assert.ok(!eventsOnCalendarDay(MONTHLY_EVENTS, '2026-10-19').some(item => item.id === show.id));
  assert.deepEqual(PLANNER_CATALOG.events.find(item => item.id === show.id)!.occurrenceDates, ['2026-10-25']);
});

test('opening facts follow the official pages: Old Post Office brunch on weekends, Marufuku and O2 Sushi open', () => {
  const postOffice = opening('old-post-office-burlingame');
  // CNT-FRESH-1016 (read 2026-10-16, GPT editor review 2026-10-15): the hours block lists "Brunch: Sat–Sun, 11 a.m.–2 p.m."
  // with no start date any more, so the card gives the regular week (the 10-14 "from 10/18" note had only the old site behind it).
  assert.match(postOffice.dateLabel, /早午餐周六日/u);
  assert.match(postOffice.editorTip, /早午餐周六、周日 11:00–14:00，官网已不再写早午餐从哪天开始/u);
  assert.match(postOffice.editorTip, /650-502-1000/u);
  assert.doesNotMatch(postOffice.editorTip, /还没有早午餐/u, 'no current source says there is no brunch on 10/17');
  assert.doesNotMatch(`${postOffice.dateLabel}${postOffice.editorTip}`, /10\/17 起/u);
  const marufuku = opening('marufuku-burlingame-announced');
  assert.equal(marufuku.status, 'open');
  // WEB-FIX5 (H09, 2026-10-13 read): the 10/11 grand opening lists service hours, so it is the first day of service.
  assert.equal(marufuku.openedOn, '2026-10-11');
  assert.match(marufuku.dateLabel, /周末 11:00–21:00/u);
  assert.equal(opening('albany-o2-sushi-opening-2026').status, 'open');
  assert.equal(opening('los-altos-coffeebar-announced-2026').status, 'announced');
  assert.equal(opening('passdoor-santa-rosa-opening-2026').officialUrl, 'https://www.thepassdoor.net/');
});

test('event facts from the 10/12 reads: sold-out presale, official address, check-in cutoff, no pets', () => {
  const fremont = event('fremont-trick-or-treat-2026');
  assert.match(fremont.costLabel, /已售罄/u);
  assert.equal(fremont.price, undefined, 'nothing is on sale and the page no longer lists a price');
  assert.doesNotMatch(`${fremont.costLabel}${fremont.plan.join('')}${fremont.summary}`, /买前看剩余名额|先买好票|\$15/u);
  // San Mateo's Thursday market: the association's calendar runs only to 7/23, so 11/5 is not a confirmed day (not "cancelled").
  const market = event('san-mateo-downtown-market-nov5-2026');
  assert.deepEqual(market.occurrenceDates, []);
  assert.equal(market.status, undefined);
  assert.equal(market.sessions, undefined);
  assert.ok(!eventsOnCalendarDay(MONTHLY_EVENTS, '2026-11-05').some(item => item.id === market.id));
  assert.doesNotMatch(market.summary, /明确列出/u);
  assert.match(event('cupertino-diwali-festival-2026').venue, /21121 Stevens Creek Blvd/u);
  assert.match(event('daly-city-top-of-the-hill-festival-2026').plan.join(''), /县参事会.*全年龄免费入场/u);
  // Plan lines, which the detail page renders (tips are not shown there yet).
  assert.match(event('concord-trick-or-treat-trail-2026').plan.join(''), /17:30 停止签到/u);
  assert.match(event('half-moon-bay-pumpkin-festival-2026').plan.join(''), /谢绝宠物/u);
  assert.match(event('daly-city-top-of-the-hill-festival-2026').plan.join(''), /免费接驳车.*6600 Mission Street/u);
});

test('the naturalization guide links the current USCIS interview-and-test page; the /this-month title has its separator', async () => {
  await loadLocale('en');
  const guide = guides.find(item => item.slug === 'bay-area-naturalization-official-path-guide')!;
  const urls = JSON.stringify(guide);
  assert.doesNotMatch(urls, /find-study-materials-and-resources\/the-naturalization-interview-and-test/u);
  assert.match(urls, /learn-about-citizenship\/the-naturalization-interview-and-test/u);
  assert.match(MONTHLY_METADATA.title, /2027\/1\/3 · 湾区/u);
  assert.doesNotMatch(translateText(MONTHLY_METADATA.title, 'en'), /[㐀-鿿]/u);
});
