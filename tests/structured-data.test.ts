import assert from 'node:assert/strict';
import test from 'node:test';
import '../src/i18n/metadata';
import { setLocale } from '../src/i18n/locale';
import { renderMetadataHtml } from '../src/lib/seo';
import { guides } from '../src/data/guides';
import { getLocalDiscovery, localDiscoveries, discoveryShare } from '../src/data/local-discoveries';
import { getDiscoveryMetadata } from '../src/lib/discovery-metadata';
import { getGuideMetadata } from '../src/lib/guide-metadata';
import { eventsMetadata, upcomingEventList } from '../src/lib/monthly-metadata';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { languagePath, type SiteLanguage } from '../src/lib/language-path';
import { eventOffers, eventOrganizer, eventTimes, pacificDateTime, pacificOffset, venueParts } from '../src/lib/schema-org';
import { checkStructuredData, structuredDataOf } from '../scripts/structured-data-check';
import guidePublished from '../src/data/first-published/guides.json';

// JSON-LD is read as plain data in these assertions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Block = Record<string, any>;
const ldOf = (metadata: Parameters<typeof renderMetadataHtml>[0]) => {
  const { blocks, problems } = structuredDataOf(renderMetadataHtml(metadata));
  assert.deepEqual(problems, []);
  return blocks as Block[];
};

test('I18N-SEO-04/-13: every event, offer, opening and guide passes the schema check in all three languages', async () => {
  const pages = [...localDiscoveries.map(getDiscoveryMetadata), ...guides.map(getGuideMetadata)];
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as SiteLanguage[]) {
    await setLocale(locale, false);
    const problems = pages.flatMap(metadata => checkStructuredData(ldOf({ ...metadata, path: languagePath(metadata.path, locale) }), { english: locale === 'en', where: languagePath(metadata.path, locale) }));
    assert.deepEqual(problems.slice(0, 20), [], `${locale}: ${problems.length} problems`);
  }
  await setLocale('zh-Hans', false);
});

test('Event JSON-LD: Bay Area times with their offset, status, attendance, organizer, offers and street address only from reviewed fields', async () => {
  await setLocale('zh-Hans', false);
  // PDT / PST: the second Sunday of March and the first Sunday of November, at 02:00 local
  assert.equal(pacificOffset('2026-10-17'), '-07:00');
  assert.equal(pacificOffset('2026-11-01', '01:30'), '-07:00');
  assert.equal(pacificOffset('2026-11-01', '09:00'), '-08:00');
  assert.equal(pacificOffset('2026-03-08', '01:59'), '-08:00');
  assert.equal(pacificOffset('2026-03-08', '10:00'), '-07:00');
  assert.equal(pacificDateTime('2026-12-05', '18:30'), '2026-12-05T18:30:00-08:00');
  assert.equal(pacificDateTime('2026-12-05'), '2026-12-05', 'no time stated → the date alone, never midnight');

  let timed = 0, addressed = 0, offered = 0;
  for (const event of MONTHLY_EVENTS) {
    const [entity] = ldOf(getDiscoveryMetadata(getLocalDiscovery('event', event.id)!));
    const times = eventTimes(event);
    assert.equal(entity.startDate, times.startDate, event.id);
    if (event.sessions?.some(session => session.start) && event.status !== 'postponed' && event.status !== 'cancelled') {
      const first = [...event.sessions].sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''))[0];
      if (first.start) { assert.match(entity.startDate, /T\d{2}:\d{2}:00-0[78]:00$/, event.id); timed++; }
    } else assert.match(entity.startDate, /^\d{4}-\d{2}-\d{2}$/, `${event.id}: no stated time, no invented one`);
    assert.equal(entity.eventAttendanceMode, 'https://schema.org/OfflineEventAttendanceMode');
    assert.equal(entity.eventStatus, event.status === 'cancelled' ? 'https://schema.org/EventCancelled' : event.status === 'postponed' ? 'https://schema.org/EventPostponed' : 'https://schema.org/EventScheduled', event.id);
    const offers = eventOffers(event);
    assert.deepEqual(entity.offers, offers, event.id);
    if (offers) {
      offered++;
      if (offers['@type'] === 'Offer') assert.equal(offers.price, event.price?.min ?? 0, `${event.id}: the stated price or a free listing`);
      assert.ok(event.cost === 'free' || event.price?.free || typeof event.price?.min === 'number', `${event.id}: no price without a stated one`);
    } else assert.equal(Object.hasOwn(entity, 'offers'), false, `${event.id}: unconfirmed ticket prices are not invented`);
    assert.equal(entity.isAccessibleForFree, event.cost === 'free' || event.price?.free ? true : undefined, event.id);
    assert.equal(entity.location.name, event.venue, 'the venue string whole, as the dictionary translates it');
    if (entity.location.address.streetAddress) { addressed++; assert.ok((event.address || event.venue).includes(entity.location.address.streetAddress), event.id); }
    if (entity.organizer) assert.ok(!/(?:^|["/.])luma\.com|eventbrite|媒体报道|visit[a-z]*\.com/.test(JSON.stringify(entity.organizer)), `${event.id}: a platform, a listing or a report is not the organizer`);
  }
  // the overlay's coverage today: most events state a start time, a third an address, ~1 in 6 a price or free entry
  assert.ok(timed >= 150, `${timed} timed`);
  assert.ok(addressed >= 150, `${addressed} street addresses`);
  assert.ok(offered >= 60, `${offered} offers`);
  const soldOut = MONTHLY_EVENTS.find(event => event.status === 'sold_out');
  if (soldOut) assert.equal(eventOffers(soldOut)?.availability, 'https://schema.org/SoldOut');
  assert.deepEqual(venueParts('Vallejo Brewing Company · 430 Virginia Street, Vallejo, CA 94590'), { name: 'Vallejo Brewing Company', streetAddress: '430 Virginia Street', postalCode: '94590' });
  assert.deepEqual(venueParts('Ross Street, Downtown Santa Rosa'), { name: 'Ross Street, Downtown Santa Rosa' });
  assert.equal(eventOrganizer({ sourceLabel: '媒体报道 · thesocomarket.com', officialUrl: 'https://thesocomarket.com/' }), undefined);
  assert.equal(eventOrganizer({ sourceLabel: 'luma.com', officialUrl: 'https://luma.com/abc' }), undefined);
  assert.equal(eventOrganizer({ sourceLabel: 'visitpetaluma.com', officialUrl: 'https://www.visitpetaluma.com/event/x/' }), undefined, 'a visitor bureau lists, it does not organize');
  assert.equal(eventOrganizer({ sourceLabel: 'chasecenter.com', officialUrl: 'https://www.chasecenter.com/events/x' }), undefined, 'a bare commercial domain is not named as the organizer');
  assert.deepEqual(eventOrganizer({ sourceLabel: 'sfpl.org', officialUrl: 'https://sfpl.org/events/x' }), { '@type': 'Organization', name: 'sfpl.org', url: 'https://sfpl.org/' });
  assert.deepEqual(eventOrganizer({ sourceLabel: 'Lambtown Festival 主办方', officialUrl: 'https://www.lambtown.org/schedule' }), { '@type': 'Organization', name: 'Lambtown Festival', url: 'https://www.lambtown.org/' });
});

test('Article JSON-LD: the editorial desk as author, the first-published day, localized page URLs, files keep one address', async () => {
  const guide = guides.find(item => item.slug === 'bay-area-rental-scam-guide')!;
  for (const locale of ['zh-Hans', 'en'] as SiteLanguage[]) {
    await setLocale(locale, false);
    const [article, breadcrumb] = ldOf({ ...getGuideMetadata(guide), path: languagePath(`/guides/${guide.slug}`, locale) });
    const prefix = locale === 'en' ? '/en' : '';
    assert.equal(article.author['@type'], 'Organization', 'the desk, never an invented person');
    assert.equal(article.datePublished, (guidePublished as Record<string, string>)[guide.slug]);
    assert.ok(article.dateModified >= article.datePublished);
    assert.equal(article.mainEntityOfPage, `https://www.baylink.us${prefix}/guides/${guide.slug}`);
    assert.equal(article.publisher.logo.url, 'https://www.baylink.us/brand/baylink-app-icon.png', 'a file is not a language edition');
    assert.deepEqual(breadcrumb.itemListElement.map((item: Block) => item.name).slice(0, 2), locale === 'en' ? ['Home', 'Guides'] : ['首页', '生活指南']);
    assert.ok(breadcrumb.itemListElement.every((item: Block) => item.item.startsWith(`https://www.baylink.us${prefix}/`)));
  }
  await setLocale('en', false);
  const offer = localDiscoveries.find(item => item.kind === 'offer')!;
  const [entity, crumbs] = ldOf({ ...getDiscoveryMetadata(offer), path: languagePath(discoveryShare(offer).path, 'en') });
  assert.equal(entity['@type'], 'Article');
  assert.equal(entity.image[0], `https://www.baylink.us/share-cards/en/offer-${discoveryShare(offer).id}.png`, 'the English share card');
  assert.equal(crumbs.itemListElement[1].name, 'Free & deals');
  await setLocale('zh-Hans', false);
});

test('I18N-SEO-10: the events hub lists what is still on, by its next day, never an ended event first', () => {
  const list = upcomingEventList('2026-10-12');
  const ids = list.map(item => item.url.split('/').pop()!);
  const byId = new Map(MONTHLY_EVENTS.map(event => [event.id, event]));
  assert.ok(ids.length > 50);
  for (const id of ids) { const event = byId.get(id); if (event) assert.ok(event.endDate >= '2026-10-12', `${id} ended ${event.endDate}`); }
  assert.deepEqual(list.map(item => item.position), list.map((_, index) => index + 1));
  const [collection] = eventsMetadata('2026-10-12').structuredData!;
  assert.equal((collection.mainEntity as Block).itemListElement.length, list.length);
});
