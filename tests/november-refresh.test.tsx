import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { CityCurrentCard } from '../src/components/CityCurrentCard';
import { CITY_CURRENT_UPDATES } from '../src/data/guides-city-exploration';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { loadLocale, translateEditorial } from '../src/i18n/locale';
import { guides } from '../src/data/guides';
import { getGuideMedia } from '../src/data/guide-media';
import { filterMonthlyEvents, getEventStatus, isEditionCurrent } from '../src/lib/monthly';

test('dated city notices expire after their last Pacific day while calendars remain ongoing', () => {
  const update = { ...CITY_CURRENT_UPDATES[0], kind: 'dated' as const, expiresAt: '2026-11-03' };
  const render = (today: string, kind: 'dated'|'calendar' = 'dated') => renderToStaticMarkup(<MemoryRouter><CityCurrentCard update={{...update,kind}} today={today}/></MemoryRouter>);
  assert.doesNotMatch(render('2026-11-03'), /已结束 · 历史资讯/);
  assert.match(render('2026-11-04'), /已结束 · 历史资讯/);
  assert.match(render('2026-11-04'), /请查看下方新活动或官方最新安排/);
  assert.doesNotMatch(render('2026-11-04', 'calendar'), /已结束 · 历史资讯/);
  assert.equal(isEditionCurrent('2026-11-15'), true);
  assert.equal(isEditionCurrent('2026-11-16'), true);
  assert.equal(isEditionCurrent('2026-11-30'), true);
  assert.equal(isEditionCurrent('2026-12-01'), false);
});

test('new adult programs, unknown fees and selected event dates retain planning constraints', () => {
  const stars = PLANNER_EVENTS.find(event => /sips/i.test(event.id))!;
  assert.ok(stars);
  assert.equal(stars.planning?.minAge, 21);
  assert.equal(stars.planning?.admissionUsd, null);
  const matilda = PLANNER_EVENTS.find(event => event.id === 'san-jose-matilda-nov2026')!;
  assert.equal(matilda.planning?.programTimeUnconfirmed, true);
  assert.ok(matilda.planning?.schedule?.sessions?.length);
  assert.ok(matilda.planning?.schedule?.sessions?.every(session => !session.end));
  const filoli = MONTHLY_EVENTS.find(event => event.id === 'filoli-holidays-from-nov14-2026')!;
  assert.deepEqual(filoli.occurrenceDates, ['2026-11-14','2026-11-15']);
  assert.equal(getEventStatus(filoli, '2026-11-16'), 'ended');
  assert.deepEqual(filterMonthlyEvents([filoli], {date:'today'}, '2026-12-25'), []);
});

test('November conditional offers retain source-specific exclusions and complete English', async () => {
  await loadLocale('en');
  const muir = currentFreebies.find(offer => offer.id === 'muir-woods-veterans-day-nov11-2026')!;
  assert.match(muir.requirement,/美国公民及居民/);
  assert.match(muir.requirement,/停车.*付费/);
  const chm = currentFreebies.find(offer => offer.id === 'chm-museums-on-us-nov7-8-2026')!;
  assert.match(chm.requirement,/仅限持卡人.*同伴.*不包含/);
  const winchester = currentFreebies.find(offer => offer.id === 'winchester-santa-clara-locals-2026')!;
  assert.equal(winchester.availability, 'check-local');
  assert.equal(winchester.endDate, undefined);
  for (const offer of currentFreebies.filter(offer => offer.id.includes('nov') && offer.verifiedAt === '2026-10-05')) assert.doesNotMatch(JSON.stringify(translateEditorial(offer, 'en')), /\p{Script=Han}/u, offer.id);
  for (const guide of guides.filter(guide => /november|2026-11$/.test(guide.slug))) assert.doesNotMatch(JSON.stringify(translateEditorial({guide,media:getGuideMedia(guide)},'en')), /\p{Script=Han}/u, guide.slug);
});
