import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { EVENT_CONTEXT_PHOTOS } from '../src/data/event-image-usage';
import { GUIDE_TOPICS } from '../src/data/guide-topics';
import { HOME_INTENTS } from '../src/data/home-pathways';
import { guides as COMPLETE_GUIDES } from '../src/data/guides';
import { currentFreebies } from '../src/data/october-offers';
import { coverItemFor, getCover } from '../src/lib/cover';
import { listingImageKeys } from '../src/lib/cover-candidates';
import { isPublicBenefit } from '../src/lib/event-facts';
import { GUIDE_IMAGES, guides, HOME_OFFERS, HOME_SCENE3D, HOME_WEEKENDS, MONTHLY_EVENTS } from '../src/lib/home-catalog';
import { GUIDE_IMAGES as FULL_IMAGES } from '../src/data/guide-media';
import { canLeadOfferRail, offerHasPhoto, offerLeadsRail, offerRailOpensWide, selectHomeOffers } from '../src/lib/home-offers';
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
  // Every cover candidate the catalog writes (imageKeys: ① own, ② venue, ③ category photos, ④ approved AI) counts.
  const accept = (kind: 'event' | 'offer', record: { id: string; imageKey?: string; imageKeys?: readonly string[] }) => {
    for (const key of record.imageKeys ?? (record.imageKey ? [record.imageKey] : [])) if (getCover({ kind, id: record.id, imageKey: key }, { images: GUIDE_IMAGES, today }).tier !== 'type') used.add(key);
  };
  for (const event of MONTHLY_EVENTS) accept('event', event);
  for (const offer of HOME_OFFERS) accept('offer', offer);
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
  // A narrow desktop rail shows three tickets after a wide one: with three deadline offers a later landscape photo does not
  // lead (the third would be hidden), one of the deadline offers does when it has a landscape photo, and with four none does.
  const soon = [offer('a', 'Alpha', '2026-10-12'), offer('b', 'Bravo', '2026-10-13'), offer('c', 'Charlie', '2026-10-13'), offer('wide', 'Wide', '2026-10-20')];
  const all = () => true;
  assert.deepEqual(selectHomeOffers(soon, '2026-10-12', 6, all, item => item.id === 'wide').map(item => item.id), ['a', 'b', 'c', 'wide']);
  assert.deepEqual(selectHomeOffers(soon, '2026-10-12', 6, all, item => item.id === 'b').map(item => item.id), ['b', 'a', 'c', 'wide']);
  const four = [...soon, offer('d', 'Delta', '2026-10-13')];
  assert.deepEqual(selectHomeOffers(four, '2026-10-12', 6, all, item => item.id === 'b').map(item => item.id), ['a', 'b', 'c', 'd', 'wide']);
  const landscape = { tier: 'official' as const, key: 'k', image: { src: '/x.webp', width: 1440, height: 929, alt: '', kind: 'photo' }, label: { zh: '', en: '' }, fit: 'cover' as const, focal: [50, 40] as const };
  assert.equal(offerRailOpensWide(selectHomeOffers(soon, '2026-10-12', 6, all, item => item.id === 'b'), landscape, '2026-10-12'), true);
  assert.equal(offerRailOpensWide(selectHomeOffers(four, '2026-10-12', 6, all, item => ['a', 'b'].includes(item.id)), landscape, '2026-10-12'), false, 'a fourth deadline offer keeps the rail plain');
  // An offer ending today without a photo stays before photos ending tomorrow, and the photo steps never push a deadline
  // offer off the rail: up to four of them are taken first (as before H19), a later landscape photo does not lead past them.
  const rush = [
    offer('today', 'Plain', '2026-10-12'), offer('p1', 'Pic One', '2026-10-13'), offer('p2', 'Pic Two', '2026-10-13'), offer('p3', 'Pic Three', '2026-10-13'),
    offer('q1', 'Later One', '2026-10-20'), offer('q2', 'Later Two', '2026-10-21'), offer('q3', 'Later Three', '2026-10-22'),
    offer('free', 'Asian Art Museum · SF', '2026-10-24', { startDate: '2026-10-24' }),
  ];
  const pictured = (item: { id: string }) => /^[pq]\d$/.test(item.id);
  assert.deepEqual(selectHomeOffers(rush, '2026-10-12', 6, pictured).map(item => item.id), ['today', 'p1', 'p2', 'p3', 'free', 'q1']);
  assert.deepEqual(selectHomeOffers(rush, '2026-10-12', 6, pictured, item => item.id === 'q1').map(item => item.id), ['today', 'p1', 'p2', 'p3', 'free', 'q1']);
  assert.deepEqual(selectHomeOffers([...rush, offer('a13', 'Also Tomorrow', '2026-10-13')], '2026-10-12', 6, pictured).map(item => item.id), ['today', 'p1', 'p2', 'p3', 'free', 'q1'],
    'with a fifth offer ending by tomorrow, the photos ending the same day go first; the one ending today stays');
  // The published rail on every snapshot day: reviewed offers only, the page's selection (shipped images) equals the
  // generator's (the full registry), the offers ending today or tomorrow come first (after the wide ticket) and never sit
  // where a narrow desktop rail cuts off (three tickets after a wide one, four otherwise), and a landscape photo leads
  // unless the deadline offers fill those three.
  // The generator gives each offer its cover candidates (listingImageKeys) before the rail's photo steps; so does this check.
  const reviewed = currentFreebies.filter(item => item.verificationStatus !== 'needs-confirmation').map(item => ({ ...item, ...listingImageKeys('offer', item) }));
  const reviewedIds = new Set(reviewed.map(item => item.id));
  const shipped = new Set(HOME_OFFERS.map(item => item.id));
  let urgentDays = 0, wideDays = 0;
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
    const brand = (item: { brand: string }) => item.brand.split(/\s+[·・|]\s+/u)[0].trim().toLowerCase();
    const urgent = rail.flatMap((item, index) => item.endDate! <= tomorrow && !rail.slice(0, index).some(other => brand(other) === brand(item)) ? [index] : []);
    if (urgent.length) urgentDays++;
    const wide = rail.length > 0 && offerRailOpensWide(rail, getCover(coverItemFor('offer', rail[0]), { images: GUIDE_IMAGES, today: day }), day);
    if (wide) wideDays++;
    urgent.forEach((index, rank) => assert.ok(index <= rank + 1 && index < (wide ? 3 : Math.max(4, urgent.length)), `${day}: ${rail[index].id} ends by tomorrow and is ticket ${index + 1}`));
    // Every brand with a reviewed offer usable this week that ends today or tomorrow is on the rail, inside a narrow
    // desktop rail's window (four tickets, three after a wide one), up to the window: no photo step pushes one out.
    const week = new Date(Date.parse(`${day}T12:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
    const deadlineBrands = new Set(reviewed.filter(item => item.availability === 'dated' && !!item.endDate && item.endDate >= day && item.endDate <= tomorrow
      && (item.startDate ?? day) <= week).map(brand));
    const window = wide ? 3 : 4;
    assert.ok(urgent.filter(index => index < window).length >= Math.min(deadlineBrands.size, window), `${day}: ${deadlineBrands.size} brands end by tomorrow, the rail shows ${urgent.length}`);
    if (rail.some(leads) && !wide) assert.ok(urgent.length >= 3, `${day}: a landscape photo leads`);
  }
  assert.ok(urgentDays > 0, 'some snapshot day has an offer ending by the next day');
  assert.ok(wideDays > 0, 'some snapshot day opens with the wide ticket');
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
