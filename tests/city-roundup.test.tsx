import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { CITY_CURRENT_UPDATES, CITY_EXPLORATIONS } from '../src/data/guides-city-exploration';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { getLocalDiscovery } from '../src/data/local-discoveries';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { FreebieBoard } from '../src/components/FreebieBoard';
import { LocalDiscoveryDetail } from '../src/components/LocalDiscoveryDetail';
import { canonicalEventId } from '../src/lib/event-id';
import { filterMonthlyEvents, getMonthlyDateRange, resolveMonthlyDateFilter } from '../src/lib/monthly';
import { eventFor } from '../src/lib/planner';
import { loadLocale, translateEditorial } from '../src/i18n/locale';

test('all 101 cities have one matching dated update or clearly identified official calendar and an attributable picture', async () => {
  assert.equal(CITY_CURRENT_UPDATES.length, 101);
  assert.equal(new Set(CITY_CURRENT_UPDATES.map(row => row.city)).size, 101);
  await loadLocale('en');
  for (const city of CITY_EXPLORATIONS) {
    const update = city.currentUpdate!;
    assert.equal(update.city, city.city);
    assert.equal(update.county, city.county);
    assert.ok(['dated', 'calendar'].includes(update.kind));
    assert.match(update.checkedAt, /^2026-10-(02|05)$/);
    assert.equal(new URL(update.sourceUrl).protocol, 'https:');
    const image = GUIDE_IMAGES[update.imageKey];
    assert.ok(image?.caption && image.credit && image.srcSet, city.city);
    assert.doesNotMatch(JSON.stringify(translateEditorial(update, 'en')), /\p{Script=Han}/u, city.city);
  }
});

test('November previews work through URL parsing and combine date, region and expired-event constraints', () => {
  assert.equal(resolveMonthlyDateFilter('november'), 'november');
  assert.deepEqual(getMonthlyDateRange('november', '2026-10-02'), { start: '2026-11-01', end: '2026-11-30' });
  const events = filterMonthlyEvents(MONTHLY_EVENTS, { date: 'november', region: 'south-bay' }, '2026-10-02');
  assert.ok(events.length >= 5);
  assert.ok(events.every(row => row.region === 'south-bay' && row.startDate <= '2026-11-30' && row.endDate >= '2026-11-01'));
  assert.deepEqual(filterMonthlyEvents(events, { date: 'november' }, '2026-12-01'), []);
});

test('merging Alameda duplicate preserves old detail and saved-plan references while showing only one event', () => {
  const old = 'alameda-point-antiques-october-2026', canonical = 'alameda-point-antiques-oct-2026';
  assert.equal(canonicalEventId(old), canonical);
  assert.equal(canonicalEventId('constructor'), 'constructor');
  assert.equal(eventFor(old)?.id, canonical);
  assert.equal(getLocalDiscovery('event', old)?.kind, 'event');
  assert.equal(MONTHLY_EVENTS.filter(row => /alameda-point-antiques-oct/.test(row.id)).length, 1);
});

test('unconfirmed source pages do not remain current recommendations; old links retain explicit explanations', () => {
  const dinner = MONTHLY_EVENTS.find(row => row.id === 'sf-ai-infra-scale-dinner-2026')!;
  assert.deepEqual(dinner.occurrenceDates, []);
  assert.deepEqual(filterMonthlyEvents([dinner], {}, '2026-10-02'), []);
  const offer = currentFreebies.find(row => row.id === 'history-smc-free-oct2')!;
  assert.equal(offer.verificationStatus, 'needs-confirmation');
  const board = renderToStaticMarkup(<FreebieBoard offers={[offer]} today="2026-10-02" />);
  assert.ok(!board.includes(`href="/offers/${offer.id}"`));
  const detail = renderToStaticMarkup(<MemoryRouter><LocalDiscoveryDetail item={{ kind: 'offer', offer }} today="2026-10-02" /></MemoryRouter>);
  assert.match(detail, /当前优惠待确认/);
  assert.ok(!detail.includes('用这条内容开始'));
});
