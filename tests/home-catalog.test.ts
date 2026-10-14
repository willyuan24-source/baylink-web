import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { EVENT_CONTEXT_PHOTOS } from '../src/data/event-image-usage';
import { GUIDE_TOPICS } from '../src/data/guide-topics';
import { HOME_INTENTS } from '../src/data/home-pathways';
import { guides as COMPLETE_GUIDES } from '../src/data/guides';
import { currentFreebies } from '../src/data/october-offers';
import { getCover } from '../src/lib/cover';
import { isPublicBenefit } from '../src/lib/event-facts';
import { GUIDE_IMAGES, guides, HOME_OFFERS, HOME_SCENE3D, HOME_WEEKENDS, MONTHLY_EVENTS } from '../src/lib/home-catalog';
import { GUIDE_IMAGES as FULL_IMAGES } from '../src/data/guide-media';
import { canLeadOfferRail, offerHasPhoto, offerLeadsRail, selectHomeOffers } from '../src/lib/home-offers';
import { getImageProvenance } from '../src/lib/image-provenance';
import { TOPIC_LABELS } from '../src/features/home/home-model';

const snapshots = HOME_WEEKENDS as Record<string, { ids: string[]; feed: string[]; total: number }>;

test('the cover resolver reads the same venue/theme approvals as event-image-usage (generated, without the media registry)', () => {
  const generated = JSON.parse(readFileSync(new URL('../src/data/generated/event-context-photos.json', import.meta.url), 'utf8'));
  assert.deepEqual(generated, JSON.parse(JSON.stringify(EVENT_CONTEXT_PHOTOS)));
  // A theme photo never becomes an event's cover through the generated data either.
  const [themeKey, theme] = Object.entries(EVENT_CONTEXT_PHOTOS).find(([, use]) => use.purpose === 'theme')!;
  assert.equal(getCover({ kind: 'event', id: theme.eventIds[0], imageKey: themeKey }, { images: () => ({ src: '/x.webp', alt: '', caption: '2024 年', credit: 'CC BY', kind: 'photo', width: 1, height: 1 }), today: '2026-10-12' }).tier, 'type');
});

test('snapshots: picks and feed are distinct weekend events, the feed at most eight, and every id ships', () => {
  const ids = new Set(MONTHLY_EVENTS.map(event => event.id));
  for (const [day, { ids: picks, feed }] of Object.entries(snapshots)) {
    assert.ok(picks.length <= 3 && feed.length <= 8, day);
    assert.equal(new Set([...picks, ...feed]).size, picks.length + feed.length, `${day}: no event twice`);
    for (const id of [...picks, ...feed]) assert.ok(ids.has(id), `${day}: ${id} ships with the catalog`);
  }
});

test('shipped images are covers the ladder accepts for some item; the 3D postcard is labelled 3D 场景插图', () => {
  const today = Object.keys(snapshots).sort()[0];
  const used = new Set<string>();
  for (const event of MONTHLY_EVENTS) if (getCover({ kind: 'event', id: event.id, imageKey: event.imageKey }, { images: GUIDE_IMAGES, today }).tier !== 'type') used.add(event.imageKey);
  for (const offer of HOME_OFFERS) if (getCover({ kind: 'offer', id: offer.id, imageKey: offer.imageKey }, { images: GUIDE_IMAGES, today }).tier !== 'type') used.add(offer.imageKey);
  for (const guide of guides) if (guide.imageKey) used.add(guide.imageKey);
  assert.deepEqual(Object.keys(GUIDE_IMAGES).filter(key => !used.has(key)), [], 'no image the page cannot show');
  assert.equal(getImageProvenance(HOME_SCENE3D, false), '3D 场景插图');
  assert.equal(getImageProvenance(HOME_SCENE3D, true), '3D scene illustration');
});

test('intents: 长辈与家属 second, every guide published, topic names equal to guide-topics', () => {
  assert.deepEqual(HOME_INTENTS.map(intent => intent.id), ['weekend', 'elders', 'newcomer', 'health', 'everyday']);
  const published = new Set(COMPLETE_GUIDES.map(guide => guide.slug));
  for (const intent of HOME_INTENTS) for (const slug of intent.slugs) {
    assert.ok(published.has(slug), `${intent.id}: ${slug}`);
    assert.ok(guides.some(guide => guide.slug === slug), `${slug} ships with the home catalog`);
  }
  for (const topic of GUIDE_TOPICS) assert.deepEqual(TOPIC_LABELS[topic.id], { zh: topic.zh, en: topic.en }, topic.id);
});

test('offer tickets: usable this week, ending soonest first, one public benefit, one per brand while others remain; a landscape photo leads (H19)', () => {
  const offer = (id: string, brand: string, endDate: string, extra: Record<string, unknown> = {}) => ({ id, brand, title: id, endDate, startDate: '2026-10-01', availability: 'dated' as const, ...extra });
  const pool = [
    offer('ikea-a', 'IKEA · Bay Area', '2026-10-12'), offer('ikea-b', 'IKEA · Emeryville', '2026-10-12'),
    offer('shop-week', 'Michaels', '2026-10-16'), offer('later', 'Target', '2026-10-30'),
    offer('museum', 'Asian Art Museum · SF', '2026-10-24', { startDate: '2026-10-24' }),
    offer('ongoing', 'Sephora', '', { availability: 'ongoing' }), offer('unsure', 'Lowe’s', '2026-10-13', { verificationStatus: 'needs-confirmation' }),
    offer('next-month', 'Lakeshore', '2026-11-30', { startDate: '2026-11-20' }),
  ];
  const chosen = selectHomeOffers(pool, '2026-10-12').map(item => item.id);
  assert.deepEqual(chosen, ['ikea-a', 'museum', 'shop-week', 'later', 'ikea-b']);
  // H19: inside a step the offer with its own image wins (ikea-b over ikea-a) and up to three with images join early; the
  // rail keeps the steps' order, so what ends today stays in front ...
  const photos = new Set(['later', 'ikea-b']);
  assert.deepEqual(selectHomeOffers(pool, '2026-10-12', 6, item => photos.has(item.id)).map(item => item.id), ['ikea-b', 'museum', 'later', 'shop-week', 'ikea-a']);
  // ... and only a photo that can be the wide ticket moves to the front; the offer ending today is second.
  assert.deepEqual(selectHomeOffers(pool, '2026-10-12', 6, item => photos.has(item.id), item => item.id === 'later').map(item => item.id), ['later', 'ikea-b', 'museum', 'shop-week', 'ikea-a']);
  // The published rail on every snapshot day: reviewed offers only, the page's selection (shipped images) equals the
  // generator's (the full registry), the offers ending today or tomorrow come first after the wide ticket (a narrow
  // desktop rail shows three tickets), and the first ticket is the wide one whenever any chosen photo can be.
  const reviewed = currentFreebies.filter(item => item.verificationStatus !== 'needs-confirmation');
  const reviewedIds = new Set(reviewed.map(item => item.id));
  const shipped = new Set(HOME_OFFERS.map(item => item.id));
  let urgentDays = 0;
  for (const day of Object.keys(snapshots)) {
    const leads = offerLeadsRail(GUIDE_IMAGES, day);
    const rail = selectHomeOffers(HOME_OFFERS, day, 6, offerHasPhoto(GUIDE_IMAGES, day), leads);
    assert.deepEqual(rail.map(item => item.id), selectHomeOffers(reviewed, day, 6, offerHasPhoto(FULL_IMAGES, day), offerLeadsRail(FULL_IMAGES, day)).map(item => item.id), `${day}: page and generator agree`);
    assert.ok(rail.length <= 6, day);
    for (const item of rail) {
      assert.ok(shipped.has(item.id) && reviewedIds.has(item.id) && item.availability === 'dated' && item.endDate! >= day, `${day}: ${item.id}`);
      assert.ok(isPublicBenefit(item) || (item.startDate ?? day) <= new Date(Date.parse(`${day}T12:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10), `${day}: ${item.id} is usable this week`);
    }
    const tomorrow = new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const brand = (item: (typeof rail)[number]) => item.brand.split(/\s+[·・|]\s+/u)[0].trim().toLowerCase();
    const urgent = rail.flatMap((item, index) => item.endDate! <= tomorrow && !rail.slice(0, index).some(other => brand(other) === brand(item)) ? [index] : []);
    if (urgent.length) urgentDays++;
    urgent.forEach((index, rank) => assert.ok(index <= rank + 1, `${day}: ${rail[index].id} ends by tomorrow and is ticket ${index + 1}`));
    if (rail.some(leads)) assert.ok(leads(rail[0]), `${day}: a landscape photo leads`);
  }
  assert.ok(urgentDays > 0, 'some snapshot day has an offer ending by the next day');
});

test('the wide offer ticket only takes a landscape image (no square or banner letterboxed on its blur)', () => {
  const photo = (width: number, height: number, fit: 'cover' | 'contain' = 'cover') => ({ tier: 'official' as const, key: 'k', image: { src: '/x.webp', width, height, alt: '', kind: 'photo' }, label: { zh: '', en: '' }, fit, focal: [50, 40] as const });
  assert.equal(canLeadOfferRail(photo(1440, 929)), true);
  assert.equal(canLeadOfferRail(photo(1440, 1440)), false);
  assert.equal(canLeadOfferRail(photo(1440, 286)), false);
  assert.equal(canLeadOfferRail(photo(1000, 750)), true);
  assert.equal(canLeadOfferRail(photo(1440, 929, 'contain')), true);
  assert.equal(canLeadOfferRail(photo(1000, 750, 'contain')), false);
  assert.equal(canLeadOfferRail({ tier: 'type', label: { zh: '', en: '' }, reason: 'no-image' }), false);
  assert.equal(canLeadOfferRail(undefined), false);
});
