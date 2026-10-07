import assert from 'node:assert/strict';
import test from 'node:test';
import sfEast from '../src/data/octnov-2026-sf-east-events.json';
import regional from '../src/data/octnov-2026-regional-events.json';
import newOffers from '../src/data/octnov-2026-offers.json';
import newOpenings from '../src/data/octnov-2026-openings.json';
import { MONTHLY_EVENTS, MONTHLY_EDITION } from '../src/data/monthly-edition';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import { getActiveRegionalBulletins } from '../src/data/october-2026-bulletins';
import { octnov2026Guides } from '../src/data/octnov-2026-refresh';
import { GUIDE_IMAGES, getGuideMedia } from '../src/data/guide-media';
import { buildEventCalendar, filterMonthlyEvents } from '../src/lib/monthly';
import { loadLocale, translateEditorial } from '../src/i18n/locale';

const reviewedEvents = [...sfEast, ...regional];

test('new programs enter the public calendar and planner with only explicitly reviewed days', () => {
  assert.equal(MONTHLY_EDITION.throughDate, '2026-11-30');
  for (const reviewed of reviewedEvents) {
    const published = MONTHLY_EVENTS.filter(event => event.id === reviewed.id);
    assert.equal(published.length, 1, reviewed.id);
    assert.deepEqual(published[0].occurrenceDates, reviewed.occurrenceDates);
    assert.equal(PLANNER_EVENTS.filter(event => event.id === reviewed.id).length, 1);
    const calendar = buildEventCalendar(published[0]).replace(/\r\n /g, '');
    assert.equal(calendar.match(/BEGIN:VEVENT/g)?.length, new Set(reviewed.occurrenceDates).size);
    for (const date of reviewed.occurrenceDates) assert.match(calendar, new RegExp(`DTSTART;VALUE=DATE:${date.replaceAll('-', '')}`));
  }
  const yoga = MONTHLY_EVENTS.find(event => event.id === 'nov2026-presidio-free-yoga')!;
  assert.deepEqual(filterMonthlyEvents([yoga], { date: 'today' }, '2026-11-29'), []);
  const market = MONTHLY_EVENTS.find(event => event.id === 'november-north-healdsburg-market-2026')!;
  assert.ok(filterMonthlyEvents([market], { date: 'today' }, '2026-11-28').length);
});

test('date windows preserve admission, child-age and booking distinctions', () => {
  const birding = PLANNER_EVENTS.find(event => event.id === 'nov2026-crab-cove-bay-bird-morning')!;
  assert.equal(birding.planning?.minAge, 6);
  assert.equal(birding.planning?.reservation, 'required');
  assert.equal(birding.planning?.admissionUsd, 0);
  for (const source of reviewedEvents.filter(event => event.cost === 'unknown')) {
    const event = PLANNER_EVENTS.find(item => item.id === source.id)!;
    assert.equal(event.planning?.admissionUsd, null);
    assert.deepEqual(filterMonthlyEvents([event], { cost: 'free' }, '2026-10-07'), []);
  }
  const green = currentFreebies.find(offer => offer.id === 'east-bay-green-friday-nov27-2026')!;
  assert.equal(green.startDate, green.endDate);
  assert.match(green.requirement, /州钓鱼证.*船只检查.*不包含/);
  assert.match(green.description, /旋转木马.*小火车仍收费/);
  assert.equal(currentFreebies.find(offer => offer.id === 'yogurtland-anniversary-nov20-2026')?.kind, 'purchase');
});

test('opening announcements do not gain fabricated first-service dates', () => {
  for (const source of newOpenings) {
    const published = currentOpenings.find(shop => shop.id === source.id)!;
    assert.equal(published.status, source.status);
    if (published.status === 'announced') assert.equal(published.openedOn, undefined);
  }
  const postOffice = currentOpenings.find(shop => shop.id === 'old-post-office-burlingame')!;
  assert.equal(postOffice.address, '222 Park Road, Burlingame, CA 94010');
  assert.equal(postOffice.openedOn, '2026-10-01');
});

test('November service notices retain Veterans Day and expire after their actual notice window', () => {
  const caltrain = getActiveRegionalBulletins('2026-11-10').filter(item => item.sourceUrl === 'https://www.caltrain.com/schedules/holiday-service-schedules');
  assert.equal(caltrain.length, 1);
  assert.match(caltrain[0].summary, /11\/11.*工作日.*11\/26.*周末.*11\/27.*调整/);
  assert.ok(getActiveRegionalBulletins('2026-11-27').some(item => item.id === caltrain[0].id));
  assert.ok(!getActiveRegionalBulletins('2026-11-28').some(item => item.id === caltrain[0].id));
});

test('new articles, listings and their actual image captions have complete English', async () => {
  await loadLocale('en');
  const eventIds = new Set(reviewedEvents.map(item => item.id));
  const offerIds = new Set(newOffers.map(item => item.id));
  const openingIds = new Set(newOpenings.map(item => item.id));
  const entities = [
    ...PLANNER_EVENTS.filter(item => eventIds.has(item.id)),
    ...currentFreebies.filter(item => offerIds.has(item.id)),
    ...currentOpenings.filter(item => openingIds.has(item.id)),
  ];
  for (const item of entities) assert.doesNotMatch(JSON.stringify(translateEditorial({ item, image: GUIDE_IMAGES[item.imageKey] }, 'en')), /\p{Script=Han}/u, item.id);
  for (const guide of octnov2026Guides) {
    assert.equal(getGuideMedia(guide).cover.kind, 'photo', guide.slug);
    assert.doesNotMatch(JSON.stringify(translateEditorial({ guide, media: getGuideMedia(guide) }, 'en')), /\p{Script=Han}/u, guide.slug);
    for (const block of guide.blocks) if (block.type === 'link') assert.ok(!block.url.includes('month=2026-11'));
  }
});
