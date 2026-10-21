import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { GUIDE_IMAGES, VENUE_PHOTO_KEYS } from '../src/data/guide-media';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { buildCanLead, getBuildWeekend } from '../src/lib/home-weekend-build';
import { getCover, coverItemFor } from '../src/lib/cover';
import { leadsWithPicture } from '../src/lib/lead-rule';
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
  for (const list of [index.events, index.offers, index.openings]) for (const record of list) {
    for (const key of [record.imageKey, ...record.imageKeys ?? []]) if (key) assert.ok(Object.hasOwn(index.images, key), `${record.id}: ${key} is shipped`);
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

test('the lead rule refuses a close-up face, AI and an information card, and takes a venue photo', () => {
  const context = { images: GUIDE_IMAGES, today: '2026-10-21' };
  assert.equal(leadsWithPicture({ id: 'x', imageKey: 'official-r2-petaluma-lumafest-20261024' }, context), false, 'a close-up face never leads');
  assert.equal(leadsWithPicture({ id: 'x', imageKey: 'weekend' }, context), false, 'an AI illustration never leads');
  assert.equal(leadsWithPicture({ id: 'x' }, context), false, 'an information card never leads');
  assert.equal(leadsWithPicture({ id: 'x', imageKey: 'weekend', imageKeys: ['weekend', 'roundup-chase-center'] }, context), true, 'a venue photo leads');
  assert.equal(leadsWithPicture({ id: 'x', imageKey: 'official-mcm-halloween-spectacular-20261031' }, context), true);
});
