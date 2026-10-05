import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { guides, getGuideBySlug } from '../src/data/guides';
import { october2026NewcomerGuides } from '../src/data/guides-october-2026-newcomer';
import { october2026VisitGuides } from '../src/data/guides-october-2026-visit';
import { october2026NewEvents, october2026EventUpdates } from '../src/data/october-2026-events-refresh';
import { october2026NewOffers, october2026OfferUpdates } from '../src/data/october-2026-verified-offers';
import { october2026Bulletins, getActiveRegionalBulletins } from '../src/data/october-2026-bulletins';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { FIRST_VISIT_PATHS } from '../src/data/first-visit-paths';
import { FirstVisitStart } from '../src/components/FirstVisitStart';
import { getGuideMedia, GUIDE_IMAGES, FIRST_VISIT_GUIDE_MEDIA } from '../src/data/guide-media';
import { searchGuides } from '../src/lib/guide-search';
import { eventOccursOn, validCalendarDay } from '../src/lib/event-calendar';
import { buildEventCalendar } from '../src/lib/monthly';
import { loadLocale, translateText } from '../src/i18n/locale';

const additions = [...october2026NewcomerGuides, ...october2026VisitGuides];
const stringsIn = (value: unknown): string[] => typeof value === 'string' ? [value]
  : value && typeof value === 'object' ? Object.values(value).flatMap(stringsIn) : [];

test('first-visit paths resolve to searchable, illustrated guides with working internal guide links', () => {
  const html = renderToStaticMarkup(<StaticRouter location="/guides"><FirstVisitStart onOpenGuide={() => {}} /></StaticRouter>);
  assert.equal(new Set(guides.map(guide => guide.slug)).size, guides.length);
  for (const path of FIRST_VISIT_PATHS) {
    assert.ok(getGuideBySlug(path.slug), path.slug);
    assert.ok(html.includes(`/guides/${path.slug}`), `reachable path: ${path.slug}`);
  }
  for (const guide of additions) {
    assert.ok(searchGuides(guides, { query: guide.title }).some(result => result.guide.slug === guide.slug));
    assert.equal(guide.updatedAt, '2026-10-02');
    assert.ok(guide.sources.length >= 3, `${guide.slug}: sources for practical decisions`);
    const [coverKey, inlineKey] = FIRST_VISIT_GUIDE_MEDIA[guide.slug];
    assert.deepEqual(getGuideMedia(guide).cover, GUIDE_IMAGES[coverKey], 'reused reference photos retain their caption and attribution');
    assert.deepEqual(getGuideMedia(guide).inline[0].image, GUIDE_IMAGES[inlineKey]);
    for (const image of [getGuideMedia(guide).cover, ...getGuideMedia(guide).inline.map(item => item.image)]) {
      assert.ok(image && existsSync(`public${image.src}`), `${guide.slug}: missing image`);
      assert.ok(image.caption && image.credit, `${guide.slug}: provenance`);
    }
    for (const block of guide.blocks) if (block.type === 'link') {
      const slug = new URL(block.url, 'https://www.baylink.us').pathname.match(/^\/guides\/([^/]+)$/)?.[1];
      if (slug) assert.ok(getGuideBySlug(slug), `${guide.slug}: broken related guide ${slug}`);
    }
  }
});

test('new catalog entries publish once, retain source metadata and apply targeted event corrections', () => {
  for (const [added, catalog] of [[october2026NewEvents, MONTHLY_EVENTS], [october2026NewOffers, currentFreebies]] as const) {
    assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
    for (const item of added) {
      assert.equal(catalog.filter(candidate => candidate.id === item.id).length, 1, item.id);
      assert.equal(item.verifiedAt, '2026-10-02');
      assert.ok(GUIDE_IMAGES[item.imageKey], `${item.id}: image key`);
      const url = 'officialUrl' in item ? item.officialUrl : item.sourceUrl;
      assert.equal(new URL(url).protocol, 'https:');
    }
  }
  for (const update of october2026EventUpdates) {
    const published = MONTHLY_EVENTS.find(event => event.id === update.id);
    assert.ok(published, `correction target exists: ${update.id}`);
    for (const [key, value] of Object.entries(update)) assert.deepEqual(published[key as keyof typeof published], value);
  }
});

test('selected-date events never become daily events, including ticketed museum weekends', () => {
  for (const event of october2026NewEvents) {
    assert.ok(validCalendarDay(event.startDate) && validCalendarDay(event.endDate));
    assert.ok(event.startDate <= event.endDate && event.endDate >= '2026-10-02');
    if (event.occurrenceDates) {
      for (const date of event.occurrenceDates) assert.ok(validCalendarDay(date) && date >= event.startDate && date <= event.endDate);
      const calendar = buildEventCalendar(event);
      assert.equal((calendar.match(/BEGIN:VEVENT/g) || []).length, event.occurrenceDates.length);
    }
  }
  const goblin = MONTHLY_EVENTS.find(event => event.id === 'sausalito-goblin-jamboree-2026')!;
  assert.equal(eventOccursOn(goblin, '2026-10-04'), true);
  assert.equal(eventOccursOn(goblin, '2026-10-05'), false);
  assert.equal(eventOccursOn(goblin, '2026-10-16'), false, 'separately ticketed fundraising evening is not general admission');
  assert.equal(eventOccursOn(goblin, '2026-10-31'), true);
});

test('October advisories are hidden before review and after expiry, without implying service restoration', () => {
  assert.ok(getActiveRegionalBulletins('2026-10-01').every(item => !october2026Bulletins.some(added => added.id === item.id)));
  for (const item of october2026Bulletins) {
    assert.ok(getActiveRegionalBulletins(item.expiresAt).some(candidate => candidate.id === item.id));
    assert.ok(!getActiveRegionalBulletins('2026-11-01').some(candidate => candidate.id === item.id && candidate.verifiedAt === item.verifiedAt), 'the October version expires even when the same source has a newer November advisory');
  }
  assert.ok(!getActiveRegionalBulletins('2026-10-05').some(item => item.id === 'sf-hsb-extra-muni-oct2026'));
  assert.ok(!getActiveRegionalBulletins('2026-10-19').some(item => item.id === 'east-bay-no-green-oct18-2026'));
  assert.ok(getActiveRegionalBulletins('2026-10-22').some(item => item.id === 'east-bay-yellow-digital-oct2026'), 'last scheduled night remains visible after midnight');
  assert.ok(getActiveRegionalBulletins('2026-10-27').some(item => item.id === 'east-bay-yellow-rail-oct2026'), 'rail advisory covers the final overnight period');
  const novemberRail = getActiveRegionalBulletins('2026-11-01').filter(item => item.id === 'east-bay-yellow-rail-oct2026');
  assert.equal(novemberRail.length, 1, 'only the newest notice for the shared source is displayed');
  assert.equal(novemberRail[0].verifiedAt, '2026-10-05');
  assert.equal(novemberRail[0].expiresAt, '2026-11-15');
  assert.ok(!getActiveRegionalBulletins('2026-11-16').some(item => item.id === 'east-bay-yellow-rail-oct2026'));
});

test('all new editorial content and navigation have complete English translations', async () => {
  await loadLocale('en');
  const values = stringsIn([additions, october2026NewEvents, october2026EventUpdates, october2026NewOffers, october2026OfferUpdates, october2026Bulletins, FIRST_VISIT_PATHS]);
  for (const value of values.filter(value => /[\u3400-\u9fff]/.test(value))) {
    assert.doesNotMatch(translateText(value, 'en'), /[\u3400-\u9fff]/, `missing English: ${value}`);
  }
});
