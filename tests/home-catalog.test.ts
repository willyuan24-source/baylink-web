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
import { selectHomeOffers } from '../src/lib/home-offers';
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

test('offer tickets: usable this week, ending soonest first, one public benefit, one per brand while others remain; photos first (H19)', () => {
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
  // H19: inside a step the offer with its own image wins (ikea-b over ikea-a), up to three with images join early, and the
  // rail lists the chosen ones with images first.
  const photos = new Set(['later', 'ikea-b']);
  assert.deepEqual(selectHomeOffers(pool, '2026-10-12', 6, item => photos.has(item.id)).map(item => item.id), ['ikea-b', 'later', 'museum', 'shop-week', 'ikea-a']);
  // The published rail on every snapshot day follows the same rule and only shows reviewed offers.
  const reviewed = new Set(currentFreebies.filter(item => item.verificationStatus !== 'needs-confirmation').map(item => item.id));
  for (const day of Object.keys(snapshots)) {
    const rail = selectHomeOffers(HOME_OFFERS, day);
    assert.ok(rail.length <= 6, day);
    for (const item of rail) {
      assert.ok(reviewed.has(item.id) && item.availability === 'dated' && item.endDate! >= day, `${day}: ${item.id}`);
      assert.ok(isPublicBenefit(item) || (item.startDate ?? day) <= new Date(Date.parse(`${day}T12:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10), `${day}: ${item.id} is usable this week`);
    }
  }
});
