import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 9 · lane R (W9-R3): free days AHEAD (review R§5 #10) — the 7-day 这周免费 (realsf/freeWeek.ts), a place card's
 * free days (the zoo's 7 Oct resident day seen from 1 Oct), the mostly-free places as one 常年免费 line, and 加到日历
 * (realsf/ics.ts: an .ics with a reminder the day before, folded lines, UTC times, escaped text).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.location = { search: '?world=city&save=off', href: 'http://localhost/opus-bay?world=city&save=off', pathname: '/opus-bay', hostname: 'localhost' };
g.window ??= globalThis;

const { sanitizeCatalog } = await import('../src/opus-bay/data/catalog');
const { parseLive } = await import('../src/opus-bay/realsf/live');
const fw = await import('../src/opus-bay/realsf/freeWeek');
const ics = await import('../src/opus-bay/realsf/ics');

const CATALOG = sanitizeCatalog(JSON.parse(fs.readFileSync(path.resolve('public/planner-catalog.json'), 'utf8')));
const OFFERS = parseLive(JSON.parse(fs.readFileSync(path.resolve('public/opus-bay/sf/v1/live.json'), 'utf8')))!;
const offer = (id: string) => { const o = OFFERS.find(x => x.id === id); assert.ok(o, id); return o!; };
/** the zoo card's point (= the offer's row point, data/sf/attractions.ts sf-zoo) */
const ZOO = offer('sf-zoo-resident-free-oct7-2026').place!;

test('W9-R3 freeWeek: from 1 Oct the next 7 days show the dated offers on their days (Asian Art 10/4, the Conservatory 10/6, the zoo 10/7) — before the day, not only on it', () => {
  const week = fw.freeWeek('2026-10-01', 7, OFFERS, null);
  assert.deepEqual(week.map(d => d.day), ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']);
  const ids = (day: string) => week.find(d => d.day === day)!.items.map(i => (i.kind === 'offer' ? i.offer.id : i.event.id));
  assert.ok(ids('2026-10-04').includes('asian-art-free-oct4'));
  assert.ok(ids('2026-10-06').includes('conservatory-free-oct6'));
  assert.ok(ids('2026-10-07').includes('sf-zoo-resident-free-oct7-2026'));
  assert.ok(ids('2026-10-01').includes('sf-moad-free-thursday-oct1-2026'));
  // the dated ones first; mostly-free places (the cable car museum: 6 days a week) are never a day's item
  for (const d of week) {
    assert.ok(!d.items.some(i => i.kind === 'offer' && i.offer.id === 'cable-car-museum-free'), `${d.day}: the cable car museum is 常年免费, not news`);
    const kinds = d.items.map(i => (i.kind === 'offer' ? (i.offer.from ? 0 : 1) : 2));
    assert.deepEqual(kinds, [...kinds].sort(), `${d.day}: dated offers, then weekly, then events`);
  }
  // the tea garden's free hour (Mon / Wed / Fri 9–10) is a day's item on its days
  assert.ok(ids('2026-10-02').includes('japanese-tea-garden-free-hour'), 'Friday');
  assert.ok(!ids('2026-10-03').includes('japanese-tea-garden-free-hour'), 'not Saturday');
});

test('W9-R3 freeWeek: 免费就好 merges the catalog’s free San Francisco events (for everyone) with the offers', () => {
  const week = fw.freeWeek('2026-10-01', 7, OFFERS, CATALOG);
  const sat = week.find(d => d.day === '2026-10-03')!;
  const events = sat.items.filter(i => i.kind === 'event');
  assert.ok(events.length >= 2, `Saturday 3 Oct has free SF events: ${events.length}`);
  for (const d of week) for (const i of d.items) {
    if (i.kind !== 'event') continue;
    assert.equal(i.event.region, 'sf', i.event.id);
    assert.equal(i.event.cost, 'free', i.event.id);
  }
  assert.ok(events.some(i => i.kind === 'event' && i.event.id === 'hardly-strictly-bluegrass-2026'), 'Hardly Strictly Bluegrass (free, Golden Gate Park)');
});

test('W9-R3 a place card’s free days: the zoo on 1 Oct shows 7 Oct 10:00–16:00 for SF residents; nothing after the day; the cable car museum is one 常年免费 line', () => {
  const zoo = fw.freeDaysAt(ZOO, '2026-10-01', 7, OFFERS);
  assert.equal(zoo.length, 1);
  assert.equal(zoo[0].day, '2026-10-07');
  assert.ok(zoo[0].kind === 'offer' && zoo[0].hours && zoo[0].hours[0] === 600 && zoo[0].hours[1] === 960);
  assert.deepEqual(fw.freeDaysAt(ZOO, '2026-09-30', 7, OFFERS).map(i => i.day), [], '7 Oct is 7 days after 30 Sep: outside a 7-day window that starts today');
  assert.deepEqual(fw.freeDaysAt(ZOO, '2026-10-08', 7, OFFERS), [], 'after the day: nothing');
  const ccm = offer('cable-car-museum-free').place!;
  assert.deepEqual(fw.freeDaysAt(ccm, '2026-10-01', 7, OFFERS), []);
  assert.deepEqual(fw.alwaysFreeAt(ccm, OFFERS).map(o => o.id), ['cable-car-museum-free']);
  assert.deepEqual(fw.alwaysFreeAt(ZOO, OFFERS), []);
  assert.deepEqual(fw.freeDaysAt({ x: 99999, z: 99999 }, '2026-10-01', 7, OFFERS), [], 'far from every offer');
  assert.deepEqual(fw.dayLabel('2026-10-07'), { zh: '10/7 周三', en: 'Wed 10/7' });
});

test('W9-R3 加到日历: an event day with its hours in UTC and a reminder the day before; an all-day offer at 09:00 the day before; text escaped, lines folded', () => {
  const lego = CATALOG.events.find(e => e.id === 'sfpl-richmond-lego-oct7-2026')!;
  const text = ics.eventIcs(lego, '2026-10-07', Date.UTC(2026, 9, 1, 12));
  assert.match(text, /^BEGIN:VCALENDAR\r\n/);
  assert.match(text, /\r\nEND:VCALENDAR\r\n$/);
  // 16:00–17:30 PDT = 23:00–00:30 UTC
  assert.match(text, /\r\nDTSTART:20261007T230000Z\r\n/);
  assert.match(text, /\r\nDTEND:20261008T003000Z\r\n/);
  assert.match(text, /\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:[^\r]+\r\nTRIGGER:-P1D\r\nEND:VALARM\r\n/);
  assert.match(text, /UID:sfpl-richmond-lego-oct7-2026-2026-10-07@baylink\.us/);
  assert.match(text, /URL:https:\/\/sfpl\.org\/events\/2026\/10\/07\/activity-lego-free-play/);
  for (const line of text.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, `folded: ${line}`);
  // an offer with hours, and an all-day entry
  const zoo = offer('sf-zoo-resident-free-oct7-2026');
  assert.match(ics.offerIcs(zoo, '2026-10-07', [600, 960]), /DTSTART:20261007T170000Z/);
  const allDay = ics.buildIcs({ uid: 'x', title: 'A, B; C\\D\nE', day: '2026-11-01', alarm: 'tomorrow' }, 0);
  assert.match(allDay, /DTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261102/);
  assert.match(allDay, /TRIGGER:-PT15H/);
  assert.match(allDay, /SUMMARY:A\\, B\\; C\\\\D\\nE/);
  // the DST day: 1 Nov 2026 10:00 PST = 18:00 UTC
  assert.match(ics.buildIcs({ uid: 'y', title: 't', day: '2026-11-01', start: 600, end: 660, alarm: 'a' }, 0), /DTSTART:20261101T180000Z/);
  // hours from the catalog's schedule, else the date label
  assert.deepEqual(ics.eventDayHours(lego, '2026-10-07'), [960, 1050]);
});

test('W9-R3 a card’s offers by its ids first: SFMOMA’s card (12.5 u from MoAD) never shows MoAD’s free days; the Botanical Garden card (its gate offer row 60 u away) does show its own', () => {
  const SFMOMA = { x: 176.6, z: 183 }; // data/sf/attractions.ts sfmoma
  const moma = fw.freeDaysAt(SFMOMA, '2026-10-12', 14, OFFERS, ['sfmoma']);
  const near10 = fw.freeDaysAt(SFMOMA, '2026-10-04', 7, OFFERS, ['sfmoma']);
  assert.ok(fw.freeDaysAt({ x: 164.14, z: 183.56 }, '2026-10-04', 7, OFFERS).some(i => i.kind === 'offer' && i.offer.id === 'sf-moad-thrive-second-saturday-oct2026'), 'MoAD’s own card has its 10/10 day');
  assert.ok(!near10.some(i => i.kind === 'offer' && i.offer.id.startsWith('sf-moad')), near10.map(i => (i.kind === 'offer' ? i.offer.id : '')).join());
  assert.ok(moma.some(i => i.kind === 'offer' && i.offer.id === 'sfmoma-family-oct25'), 'its own 10/25 family day within 14 days of 10/12');
  const BOTANICAL = { x: -223.4, z: 1010.3 };
  assert.deepEqual(fw.freeDaysAt(BOTANICAL, '2026-10-10', 7, OFFERS).map(i => i.day), [], 'by point alone: too far');
  assert.deepEqual(fw.freeDaysAt(BOTANICAL, '2026-10-10', 7, OFFERS, ['sf-botanical-garden', 'osm-w120480164']).map(i => i.day), ['2026-10-13']);
});
