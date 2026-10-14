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
import { eventOffers, eventOrganizer, eventTimes, labelTimes, ORGANIZER_BY_HOST, pacificDateTime, pacificOffset, venueParts } from '../src/lib/schema-org';
import { checkStructuredData, structuredDataOf } from '../scripts/structured-data-check';
import guidePublished from '../src/data/first-published/guides.json';
import listingPublished from '../src/data/first-published/listings.json';

// JSON-LD is read as plain data in these assertions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Block = Record<string, any>;
const ldOf = (metadata: Parameters<typeof renderMetadataHtml>[0]) => {
  const { blocks, problems } = structuredDataOf(renderMetadataHtml(metadata));
  assert.deepEqual(problems, []);
  return blocks as Block[];
};

test('I18N-SEO-04/-13: every event, offer, opening and guide passes the schema check in all three languages', async () => {
  const pages = [...localDiscoveries.map(item => getDiscoveryMetadata(item, item.kind === 'event' ? undefined : (listingPublished as Record<string, string>)[`${item.kind}:${discoveryShare(item).id}`])),
    ...guides.map(guide => getGuideMetadata(guide, (guidePublished as Record<string, string>)[guide.slug]))];
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
    } else if (labelTimes(event)) {
      // H47: a one-day listing without sessions states its time in its date line, which the page shows
      assert.equal(entity.startDate, pacificDateTime(event.startDate, labelTimes(event)!.start), event.id);
      assert.ok(event.dateLabel.includes(`:${labelTimes(event)!.start.slice(3)}`), `${event.id}: the time is in the date line`);
      timed++;
    } else assert.match(entity.startDate, /^\d{4}-\d{2}-\d{2}$/, `${event.id}: no stated time, no invented one`);
    assert.equal(entity.eventAttendanceMode, 'https://schema.org/OfflineEventAttendanceMode');
    assert.equal(entity.eventStatus, event.status === 'cancelled' ? 'https://schema.org/EventCancelled' : event.status === 'postponed' ? 'https://schema.org/EventPostponed' : 'https://schema.org/EventScheduled', event.id);
    const offers = eventOffers(event);
    assert.deepEqual(entity.offers, offers, event.id);
    if (offers) {
      offered++;
      if (offers['@type'] === 'Offer') assert.equal(offers.price, event.price?.min ?? 0, `${event.id}: the stated price or a free listing`);
      assert.ok(event.cost === 'free' || event.price?.free || typeof event.price?.min === 'number', `${event.id}: no price without a stated one`);
      // availability only as the source states it: sold out, or nothing (never an invented InStock)
      assert.equal(offers.availability, event.status === 'sold_out' ? 'https://schema.org/SoldOut' : undefined, `${event.id}: availability`);
      assert.notEqual(event.status, 'cancelled', `${event.id}: a cancelled event offers no tickets`);
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
  const priced = { cost: 'paid', price: { min: 12 }, officialUrl: 'https://example.org/e' } as const;
  assert.deepEqual(eventOffers(priced), { '@type': 'Offer', url: 'https://example.org/e', priceCurrency: 'USD', price: 12 }, 'no availability nobody stated');
  assert.equal(eventOffers({ ...priced, status: 'cancelled' }), undefined, 'a cancelled event offers no tickets');
  assert.equal(eventOffers({ ...priced, status: 'sold_out' })?.availability, 'https://schema.org/SoldOut');
  // the schema check holds the same rules for every built page
  const offerEvent = (offers: Record<string, unknown>, eventStatus = 'https://schema.org/EventScheduled') => [{ '@context': 'https://schema.org', '@type': 'Event', name: 'X', startDate: '2026-10-17', eventStatus, eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', url: 'https://www.baylink.us/events/x', image: ['https://www.baylink.us/x.png'], location: { '@type': 'Place', name: 'X', address: { '@type': 'PostalAddress', addressLocality: 'Oakland' } }, offers }];
  assert.match(checkStructuredData(offerEvent({ ...eventOffers(priced), availability: 'https://schema.org/InStock' })).join(' '), /availability is stated only when the source says sold out/);
  assert.match(checkStructuredData(offerEvent(eventOffers(priced)!, 'https://schema.org/EventCancelled')).join(' '), /a cancelled event offers no tickets/);
  assert.deepEqual(checkStructuredData(offerEvent(eventOffers({ ...priced, status: 'sold_out' })!)), []);
  assert.deepEqual(venueParts('Vallejo Brewing Company · 430 Virginia Street, Vallejo, CA 94590'), { name: 'Vallejo Brewing Company', streetAddress: '430 Virginia Street', postalCode: '94590' });
  assert.deepEqual(venueParts('Ross Street, Downtown Santa Rosa'), { name: 'Ross Street, Downtown Santa Rosa' });
  assert.equal(eventOrganizer({ sourceLabel: '媒体报道 · thesocomarket.com', officialUrl: 'https://thesocomarket.com/' }), undefined);
  assert.equal(eventOrganizer({ sourceLabel: 'luma.com', officialUrl: 'https://luma.com/abc' }), undefined);
  assert.equal(eventOrganizer({ sourceLabel: 'visitpetaluma.com', officialUrl: 'https://www.visitpetaluma.com/event/x/' }), undefined, 'a visitor bureau lists, it does not organize');
  assert.equal(eventOrganizer({ sourceLabel: 'chasecenter.com', officialUrl: 'https://www.chasecenter.com/events/x' }), undefined, 'a bare commercial domain is not named as the organizer');
  assert.deepEqual(eventOrganizer({ sourceLabel: 'sfpl.org', officialUrl: 'https://sfpl.org/events/x' }), { '@type': 'Organization', name: 'San Francisco Public Library', url: 'https://sfpl.org/' }, 'H47: the name other listings of the site record');
  assert.deepEqual(eventOrganizer({ sourceLabel: 'napalibrary.gov', officialUrl: 'https://napalibrary.gov/x' }), { '@type': 'Organization', name: 'napalibrary.gov', url: 'https://napalibrary.gov/' }, 'an organisation site nobody names keeps its domain');
  assert.deepEqual(eventOrganizer({ sourceLabel: 'Lambtown Festival 主办方', officialUrl: 'https://www.lambtown.org/schedule' }), { '@type': 'Organization', name: 'Lambtown Festival', url: 'https://www.lambtown.org/' });
  // a bureau's listing names the organizer after the slash, and its host is never the organizer's url
  assert.deepEqual(eventOrganizer({ sourceLabel: 'Marin Convention & Visitors Bureau / Point Reyes Open Studios', officialUrl: 'https://www.visitmarin.org/event-calendar/x/' }), { '@type': 'Organization', name: 'Point Reyes Open Studios' });
  assert.deepEqual(eventOrganizer({ sourceLabel: 'Point Reyes Open Studios', officialUrl: 'https://www.visitmarin.org/event-calendar/x/' }), { '@type': 'Organization', name: 'Point Reyes Open Studios' });
  // a section host (calendar., events.) names its organisation's site
  assert.deepEqual(eventOrganizer({ sourceLabel: 'calendar.santaclaraca.gov', officialUrl: 'https://calendar.santaclaraca.gov/santaclaraca/1' }), { '@type': 'Organization', name: 'santaclaraca.gov', url: 'https://calendar.santaclaraca.gov/' });
  assert.equal(eventOrganizer({ sourceLabel: 'events.napalibrary.gov', officialUrl: 'https://events.napalibrary.gov/event/1' })?.name, 'napalibrary.gov');
  // listing rules match whole hosts: Bark in the Park San Jose, Symphony San José and Stanford Athletics run their own sites
  assert.equal(eventOrganizer({ sourceLabel: 'Bark in the Park San Jose 官方', officialUrl: 'https://www.barksanjose.org/' })?.url, 'https://www.barksanjose.org/');
  assert.equal(eventOrganizer({ sourceLabel: 'symphonysanjose.org', officialUrl: 'https://symphonysanjose.org/x' })?.name, 'symphonysanjose.org');
  assert.equal(eventOrganizer({ sourceLabel: 'Stanford Athletics', officialUrl: 'https://gostanford.com/calendar' })?.url, 'https://gostanford.com/');
  assert.equal(eventOrganizer({ sourceLabel: 'sanjose.org', officialUrl: 'https://www.sanjose.org/events/x' }), undefined, 'the city’s visitor site lists');
  for (const event of MONTHLY_EVENTS) {
    const organizer = eventOrganizer(event) as { name: string; url?: string } | undefined;
    if (!organizer) continue;
    assert.ok(!/visitors?\s+bureau|^(?:calendar|events?)\./i.test(organizer.name), `${event.id}: ${organizer.name}`);
    if (organizer.url) assert.ok(!/visit[a-z-]*\.(?:com|org)|luma\.com|eventbrite/.test(organizer.url), `${event.id}: ${organizer.url} is a listing`);
  }
});

test('H47: one-day listings state the time their date line gives; streets after a comma; organizers by their site; inLanguage per edition', async () => {
  const day = { startDate: '2026-10-18', endDate: '2026-10-18' } as const;
  assert.deepEqual(labelTimes({ ...day, dateLabel: '10/18 · 14:00–16:00' }), { start: '14:00', end: '16:00' });
  assert.deepEqual(labelTimes({ ...day, dateLabel: '10 月 18 日 · 10:30 开始' }), { start: '10:30' });
  assert.deepEqual(labelTimes({ ...day, dateLabel: '10/18 · 官方总时段 07:00–14:00；称重预计约 07:00–11:00' }), { start: '07:00', end: '14:00' });
  assert.deepEqual(labelTimes({ ...day, dateLabel: 'Oct 18 · 4:30–6pm' }), { start: '16:30', end: '18:00' }, 'the end’s pm reads the start');
  assert.deepEqual(labelTimes({ ...day, dateLabel: '10/18 · 19:00 开门；20:00 开演' }), { start: '20:00' }, 'doors are not the start');
  assert.equal(labelTimes({ ...day, dateLabel: '10/18 · 全天' }), undefined, 'no time stated, none invented');
  assert.equal(labelTimes({ startDate: '2026-10-17', endDate: '2026-10-18', dateLabel: '10/17–10/18 · 10:00–17:00' }), undefined, 'a multi-day line may give one day’s hours');
  assert.equal(labelTimes({ ...day, dateLabel: '10/18 · 14:00–16:00', sessions: [{ date: '2026-10-18', start: '13:00' }] }), undefined, 'sessions win');
  assert.equal(labelTimes({ ...day, dateLabel: '10/18 · 14:00–16:00', status: 'postponed' }), undefined);
  assert.equal(eventTimes({ ...day, dateLabel: '10/18 · 14:00–16:00' }).startDate, '2026-10-18T14:00:00-07:00');
  assert.equal(eventTimes({ ...day, dateLabel: '10/18 · 14:00–16:00' }).endDate, '2026-10-18T16:00:00-07:00');
  assert.deepEqual(venueParts('Healdsburg Regional Library 主阅览室，139 Piper Street'), { name: 'Healdsburg Regional Library 主阅览室，139 Piper Street', streetAddress: '139 Piper Street' });
  assert.deepEqual(venueParts('Oakland Arena, 7000 Coliseum Way'), { name: 'Oakland Arena, 7000 Coliseum Way', streetAddress: '7000 Coliseum Way' });
  assert.deepEqual(venueParts('Ross Street, Downtown Santa Rosa'), { name: 'Ross Street, Downtown Santa Rosa' }, 'no house number, no street');
  // every name in the host table is how the event data already names that site's organisation (no new facts)
  const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');
  for (const [host, name] of Object.entries(ORGANIZER_BY_HOST)) {
    const labels = MONTHLY_EVENTS.filter(event => hostOf(event.officialUrl) === host).map(event => event.sourceLabel);
    if (labels.length) assert.ok(labels.some(label => label.includes(name)), `${host}: ${name} is not a label of its listings`);
  }
  assert.equal(eventOrganizer({ sourceLabel: '旧金山公共图书馆活动页（列治文分馆）', officialUrl: 'https://sfpl.org/events/2026/11/14/film' })?.name, 'San Francisco Public Library');
  assert.equal(eventOrganizer({ sourceLabel: 'chasecenter.com', officialUrl: 'https://www.chasecenter.com/events/x' }), undefined, 'a venue’s site still names no organizer');
  // inLanguage: each language edition says its own language, on events and on offer/opening articles
  const event = localDiscoveries.find(item => item.kind === 'event')!;
  const offer = localDiscoveries.find(item => item.kind === 'offer')!;
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as SiteLanguage[]) {
    await setLocale(locale, false);
    for (const item of [event, offer]) {
      const [entity] = ldOf({ ...getDiscoveryMetadata(item), path: languagePath(discoveryShare(item).path, locale) });
      assert.equal(entity.inLanguage, locale, `${item.kind} ${locale}`);
    }
  }
  await setLocale('zh-Hans', false);
});

test('Article JSON-LD: the editorial desk as author, the first-published day, localized page URLs, files keep one address', async () => {
  const guide = guides.find(item => item.slug === 'bay-area-rental-scam-guide')!;
  for (const locale of ['zh-Hans', 'en'] as SiteLanguage[]) {
    await setLocale(locale, false);
    const [article, breadcrumb] = ldOf({ ...getGuideMetadata(guide, (guidePublished as Record<string, string>)[guide.slug]), path: languagePath(`/guides/${guide.slug}`, locale) });
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

test('the app keeps the prerendered JSON-LD of the page it hydrates (it carries the first-published day), and replaces it elsewhere', async () => {
  const { JSDOM } = await import('jsdom');
  const { setPageMetadata } = await import('../src/lib/seo');
  await setLocale('zh-Hans', false);
  const guide = guides[0];
  const server = renderMetadataHtml(getGuideMetadata(guide, '2026-05-22'));
  const dom = new JSDOM(`<!doctype html><html><head>${server}</head><body></body></html>`);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
  try {
    setPageMetadata(getGuideMetadata(guide));
    const kept = JSON.parse(dom.window.document.querySelector('script[data-baylink-structured-data]')!.textContent!);
    assert.equal(kept[0].datePublished, '2026-05-22', 'the hydrated page keeps the server JSON-LD');
    setPageMetadata(getGuideMetadata(guides[1]));
    const scripts = dom.window.document.querySelectorAll('script[data-baylink-structured-data]');
    assert.equal(scripts.length, 1);
    assert.equal(JSON.parse(scripts[0].textContent!)[0].headline, guides[1].title, 'another page replaces it');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document');
  }
});
