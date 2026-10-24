import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { GUIDE_IMAGES, VENUE_PHOTO_KEYS } from '../src/data/guide-media';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { buildCanLead, getBuildWeekend } from '../src/lib/home-weekend-build';
import { getCover, coverItemFor, type CoverKind } from '../src/lib/cover';
import { leadsWithPicture } from '../src/lib/lead-rule';
import { CLOSE_UP_FACE_IMAGES, NOT_FOR_LEAD, WEAK_LEAD_SCENE_IMAGES } from '../src/lib/close-up-faces';
import { venuesFor, type CandidateRecord } from '../src/lib/cover-candidates';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import type { WeekendPickEntry } from '../src/data/weekend-picks';
import venueFile from '../src/data/venue-photos.json';

/** UI9-IMG-A1a: venue photos approved once per venue, and the lead rule (UI9-IMAGES DECISIONS 22 ②, 26). */
type Venue = { id: string; match: string[]; imageKeys: string[]; approvedAt: string; ownerQuote?: string; approvalRecord?: string; exclude?: string[] };
const venues = (venueFile as { venues: Venue[] }).venues;
const index = JSON.parse(readFileSync('src/data/generated/events-index.json', 'utf8')) as {
  events: { id: string; imageKey?: string; imageKeys?: string[] }[]; offers: { id: string; imageKey?: string; imageKeys?: string[] }[];
  openings: { id: string; imageKey?: string; imageKeys?: string[] }[]; images: Record<string, { subject?: string }>; homeLeads?: Record<string, string>;
};
const home = JSON.parse(readFileSync('src/data/generated/home-catalog.json', 'utf8')) as { weekends: Record<string, { ids: string[] }> };

test('every venue photo traces to its approval and is a photograph the table alone marks as the venue\'s', () => {
  assert.ok(venues.length > 0);
  for (const venue of venues) {
    assert.match(venue.approvedAt, /^\d{4}-\d{2}-\d{2}$/, venue.id);
    assert.ok(venue.ownerQuote || venue.approvalRecord, `${venue.id}: the owner's words or the record of the earlier approval`);
    // An earlier approval names a repo file that records this very key.
    for (const record of venue.approvalRecord ? venue.approvalRecord.split(';').map(part => part.trim().split(' ')[0]) : []) {
      assert.ok(existsSync(record), `${venue.id}: ${record} exists`);
    }
    const records = venue.approvalRecord ? venue.approvalRecord.split(';').map(part => readFileSync(part.trim().split(' ')[0], 'utf8')).join('\n') : '';
    for (const key of venue.imageKeys) {
      assert.equal(GUIDE_IMAGES[key]?.kind, 'photo', `${venue.id}: ${key} is a registered photo`);
      assert.equal(GUIDE_IMAGES[key].subject, 'venue', `${key} is marked as a venue photo`);
      if (venue.approvalRecord) assert.ok(records.includes(key) || records.includes(GUIDE_IMAGES[key].src.split('/').pop()!.replace('.webp', '')), `${venue.id}: ${key} is in its approval record`);
    }
    assert.ok(venue.match.every(word => word.trim().length >= 5), `${venue.id}: match words are specific`);
  }
  for (const [key, image] of Object.entries(GUIDE_IMAGES)) if (image.subject === 'venue') assert.ok(VENUE_PHOTO_KEYS.has(key), `${key}: only venue-photos.json marks venue photos`);
  // The hold list (TASK-CHAIN §3): Thrill-O-Ween stays exactly as it is.
  assert.ok(venues.find(venue => venue.id === 'chase-center')?.exclude?.includes('event:sf-thrive-thrill-o-ween-2026'));
});

test('a venue photo serves the records held there, and the index ships every picture it names, no dead key', () => {
  const chase = index.events.find(event => event.id === 'sf-doja-cat-2026');
  if (chase) assert.ok(chase.imageKeys?.includes('roundup-chase-center'), 'a Chase Center concert gets the Chase Center photo');
  // UI9-IMG-A1b: the boards' offers and new shops ship in events-boards.json with the pictures only they use.
  const boards = JSON.parse(readFileSync('src/data/generated/events-boards.json', 'utf8')) as { offers: typeof index.events; openings: typeof index.events; images: typeof index.images };
  for (const record of index.events) {
    for (const key of [record.imageKey, ...record.imageKeys ?? []]) if (key) assert.ok(Object.hasOwn(index.images, key), `${record.id}: ${key} is shipped`);
  }
  for (const record of [...boards.offers, ...boards.openings]) {
    for (const key of [record.imageKey, ...record.imageKeys ?? []]) if (key) assert.ok(Object.hasOwn(index.images, key) || Object.hasOwn(boards.images, key), `${record.id}: ${key} is shipped`);
  }
  const offer = { id: 'muir-woods-fee-free-oct27', imageKey: 'region-muir-boardwalk' };
  assert.equal(getCover(coverItemFor('offer', offer), { images: GUIDE_IMAGES, today: '2026-10-21' }).tier, 'venue', 'an offer may show its venue\'s photo (②)');
});

test('DECISIONS 26: every day, the home lead = homeLeads[day] = the weekly card\'s first, and it has a ① or ② picture', () => {
  const days = Object.keys(home.weekends).sort();
  assert.ok(days.length >= 7);
  for (const day of days) {
    const weekend = getBuildWeekend(day, MONTHLY_EVENTS);
    const lead = weekend.picks[0]?.event;
    assert.equal(home.weekends[day].ids[0], lead?.id, `${day}: home lead = the build's first pick (the weekly card's first)`);
    if (index.homeLeads?.[day]) assert.equal(index.homeLeads[day], lead?.id, `${day}: homeLeads[day] = the home lead`);
    if (lead && weekend.events.some(entry => buildCanLead(entry.event, day))) assert.ok(buildCanLead(lead, day), `${day}: ${lead.id} leads with a ① or ② picture`);
  }
});

test('the lead rule refuses a close-up face, a poster, AI and an information card, and takes a venue photo', () => {
  const context = { images: GUIDE_IMAGES, today: '2026-10-21' };
  // The owner released the six flagged close-ups on 2026-10-21 (「圖片全部批准」, UI9-IMG-B1b) for cards, rows and detail
  // pages; DECISIONS 32 (round 2) keeps every one of them out of the lead slots, so the list holds the five still on the site
  // (UI9-IMG-B2 replaced LumaFest's posed volunteer photo with the festival's altar photo).
  assert.equal(CLOSE_UP_FACE_IMAGES.size, 5);
  const closeUp = { id: 'x', imageKey: 'official-sausalito-goblin-jamboree-2026' };
  assert.equal(leadsWithPicture(closeUp, context), false, 'a released close-up still never leads');
  assert.equal(leadsWithPicture(closeUp, context, new Set()), true, 'off the list, the photo would lead');
  assert.equal(leadsWithPicture({ id: 'x', imageKey: 'weekend' }, context), false, 'an AI illustration never leads');
  assert.equal(leadsWithPicture({ id: 'x' }, context), false, 'an information card never leads');
  assert.equal(leadsWithPicture({ id: 'x', imageKey: 'weekend', imageKeys: ['weekend', 'venue-sap-center'] }, context), true, 'a venue photo leads');
  // The Chase Center corner photo (half sky) is a weak lead scene (UI9-IMG-B2): fine on a card, never a lead.
  // So are the three "cards and rows only" venue photos of the B2 approval (items 31–33: Brisbane, Atherton, Calabazas).
  assert.deepEqual([...WEAK_LEAD_SCENE_IMAGES].sort(), ['roundup-chase-center', 'venue-sjpl-calabazas-library', 'venue-smcl-atherton-library', 'venue-smcl-brisbane-library']);
  for (const key of WEAK_LEAD_SCENE_IMAGES) {
    assert.equal(GUIDE_IMAGES[key]?.kind, 'photo', `${key}: a registered photo`);
    assert.ok(NOT_FOR_LEAD.has(key), `${key}: on the lead skip list`);
    assert.equal(leadsWithPicture({ id: 'x', imageKey: 'weekend', imageKeys: ['weekend', key] }, context), false, `${key}: a weak venue scene never leads`);
  }
  assert.equal(leadsWithPicture({ id: 'x', imageKey: 'official-mcm-halloween-spectacular-20261031' }, context), false, 'a poster never leads (DECISIONS 32)');
  assert.equal(leadsWithPicture({ id: 'x', imageKey: 'official-oakland-omca-dia-muertos-2026' }, context), true, 'an official photo leads');
});

test('/events: a lead from the ranking only when the picks block shows; a narrowed list has no lead', async () => {
  const { arrangePicks } = await import('../src/features/events/weekend-lead');
  const { INDEX_EVENTS } = await import('../src/features/events/events-model');
  assert.deepEqual(arrangePicks([], '2026-10-21', undefined, INDEX_EVENTS), { rows: [] });
});

test('/events arrangePicks (DECISIONS 26): the first pick that can lead; else the ranking\'s first that can, every pick a row', async () => {
  const { arrangePicks, canLead } = await import('../src/features/events/weekend-lead');
  const { INDEX_EVENTS } = await import('../src/features/events/events-model');
  const { nextOccurrence } = await import('../src/lib/monthly');
  const today = '2026-10-21';
  const base = INDEX_EVENTS.find(event => nextOccurrence(event, today))!;
  // Synthetic events on one real date: 'venue-sap-center' is an approved venue photo (②), no key is an information card.
  const leads = (id: string) => ({ ...base, id, imageKey: 'venue-sap-center', imageKeys: undefined });
  const plain = (id: string) => ({ ...base, id, imageKey: undefined, imageKeys: undefined });
  const pick = (event: ReturnType<typeof plain>, reason = true) => ({ event, date: today, ...(reason ? { reason: { zh: '理由', en: 'Reason' } } : {}) });
  assert.equal(canLead(leads('fixture-lead'), today), true);
  assert.equal(canLead(plain('fixture-plain'), today), false);
  const [p1, p2, p3] = [pick(plain('p1')), pick(plain('p2')), pick(leads('p3'))];
  // A later pick that can lead leads; the others stay rows in the editor's order.
  assert.deepEqual(arrangePicks([p1, p2, p3], today, undefined, []), { lead: p3, rows: [p1, p2] });
  // No pick can lead: the ranking's first event that can (never home's lead, never a pick), and every pick stays a row.
  const home = leads('home-lead');
  const ranked = [plain('r1'), home, leads('r2'), leads('r3')];
  const fromRanking = arrangePicks([p1, p2], today, 'home-lead', ranked);
  assert.equal(fromRanking.lead?.event.id, 'r2');
  assert.equal(fromRanking.lead?.reason, undefined, 'a lead from the ranking carries no editor reason');
  assert.equal(fromRanking.lead?.date, nextOccurrence(base, today));
  assert.deepEqual(fromRanking.rows, [p1, p2]);
  // Home's lead among the picks is dropped from the block (it returns to the feed) and never taken from the ranking.
  const homePick = pick(home);
  assert.deepEqual(arrangePicks([homePick, p1, p2], today, 'home-lead', [home, leads('r2')]).lead?.event.id, 'r2');
  assert.deepEqual(arrangePicks([homePick, p1, p2], today, 'home-lead', [home, leads('r2')]).rows, [p1, p2]);
  // Nothing on the weekend can lead: the first pick leads as before (③ pictures join with A1b).
  assert.deepEqual(arrangePicks([p1, p2], today, undefined, [plain('r1')]), { lead: p1, rows: [p2] });
});

test('getBuildWeekend (DECISIONS 26): a later pick, then the next editor pick, then the ranking leads; the last pick returns to the feed', () => {
  // The first weekend from 10/31 whose feed holds three events that cannot lead (the owner's 10-21 close-up release moved the
  // Goblin Jamboree and Ferry Plaza photos into the 10/31 feed as leaders). The catalog is fixed data, so the day is too.
  const fixture = (candidate: string) => {
    const weekend = getBuildWeekend(candidate, MONTHLY_EVENTS, {});
    return weekend.events.some(entry => buildCanLead(entry.event, candidate)) && weekend.feed.filter(entry => !buildCanLead(entry.event, candidate)).length >= 3;
  };
  const day = Array.from({ length: 9 }, (_, week) => new Date(Date.parse('2026-10-28T12:00:00Z') + week * 7 * 86_400_000).toISOString().slice(0, 10)).find(fixture) ?? '2026-10-28';
  const plainWeekend = getBuildWeekend(day, MONTHLY_EVENTS, {});
  const start = plainWeekend.start;
  const events = plainWeekend.events.map(entry => entry.event);
  const leaders = events.filter(event => buildCanLead(event, day));
  // The non-leading events in the ranked feed's order, so the one dropped from the picks ranks high enough to be in the feed.
  const plain = plainWeekend.feed.map(entry => entry.event).filter(event => !buildCanLead(event, day));
  assert.ok(leaders.length >= 1 && plain.length >= 3, `${start}: fixtures`);
  const [n1, n2, n3] = plain;
  const [c1] = leaders;
  const list = (...ids: string[]) => ({ [start]: ids.map(id => ({ id, reason: { zh: `理由 ${id}`, en: `Reason ${id}` } })) as WeekendPickEntry[] });
  const shape = (weekend: ReturnType<typeof getBuildWeekend>) => weekend.picks.map(pick => [pick.event.id, pick.editorial?.rank]);
  const feedIds = (weekend: ReturnType<typeof getBuildWeekend>) => weekend.feed.map(entry => entry.event.id);

  // A later pick that can lead moves first; the editor's ranks travel with the picks.
  const later = getBuildWeekend(day, MONTHLY_EVENTS, list(n3.id, c1.id, n2.id));
  assert.deepEqual(shape(later), [[c1.id, 2], [n3.id, 1], [n2.id, 3]]);
  for (const pick of later.picks) assert.ok(!feedIds(later).includes(pick.event.id), `${pick.event.id}: a pick is not in the feed`);

  // None of the three can lead: the next editor pick that can (rank 4) leads and the third pick returns to the feed.
  const next = getBuildWeekend(day, MONTHLY_EVENTS, list(n2.id, n3.id, n1.id, c1.id));
  assert.deepEqual(shape(next), [[c1.id, 4], [n2.id, 1], [n3.id, 2]]);
  assert.ok(feedIds(next).includes(n1.id), 'the dropped pick is back in the feed');
  assert.ok(!feedIds(next).includes(c1.id), 'the lead is not in the feed');

  // No editor pick can lead: the weekend's first in the ranking that can leads (no editorial), the last pick drops to the feed.
  const ranking = getBuildWeekend(day, MONTHLY_EVENTS, list(n2.id, n3.id, n1.id));
  const [lead, ...rest] = ranking.picks;
  assert.equal(lead.editorial, undefined, 'a lead from the ranking is not an editor pick');
  assert.ok(buildCanLead(lead.event, day), `${lead.event.id} can lead`);
  assert.deepEqual(rest.map(pick => [pick.event.id, pick.editorial?.rank]), [[n2.id, 1], [n3.id, 2]]);
  assert.ok(feedIds(ranking).includes(n1.id), 'the dropped pick is back in the feed');
  assert.ok(!feedIds(ranking).includes(lead.event.id), 'the lead is not in the feed');
});

test('a record whose own picture is a venue photo is held at that venue (venue-photos.json match or records, not excluded)', () => {
  const catalogs: [CoverKind, readonly (CandidateRecord & { imageKeys?: readonly string[] })[]][] = [
    ['event', MONTHLY_EVENTS], ['offer', currentFreebies], ['opening', currentOpenings],
  ];
  let checked = 0;
  for (const [kind, records] of catalogs) for (const record of records) {
    for (const key of [record.imageKey, ...record.imageKeys ?? []]) {
      if (!key || !VENUE_PHOTO_KEYS.has(key)) continue;
      checked++;
      assert.ok(venuesFor(kind, record).some(venue => venue.imageKeys.includes(key)), `${kind}:${record.id} shows ${key}, so it must be held at that venue`);
    }
  }
  assert.ok(checked > 0);
});

test('a venue photo on a guide or place stays an ordinary photo: it does not age out there (only events, offers, openings date it)', () => {
  const later = { images: GUIDE_IMAGES, today: '2027-01-02' };
  for (const key of ['region-muir-boardwalk', 'octnov-big-break-context']) {
    assert.equal(GUIDE_IMAGES[key].subject, 'venue', key);
    for (const kind of ['guide', 'place'] as const) assert.equal(getCover({ kind, id: `fixture-${kind}`, imageKey: key }, later).tier, 'photo', `${kind}: ${key}`);
    const event = getCover({ kind: 'event', id: 'fixture-event', imageKey: key }, later);
    assert.equal(event.tier === 'type' && event.reason, 'too-old', `${key}: an event dates its venue photo`);
  }
});
