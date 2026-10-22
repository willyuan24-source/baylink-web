import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { eventOccursOn, addCalendarDays } from '../src/lib/event-calendar';
import { HOME_GENERATED_AT, HOME_WEEKENDS } from '../src/lib/home-catalog';
import { getWeeklyCardDays } from '../src/lib/home-weekend';
import { buildCanLead, getBuildWeekend } from '../src/lib/home-weekend-build';

type CardPick = { id: string; date: string; verifiedAt: string; editorial?: { rank: number; reason: { zh: string; en: string } }; photo?: string };
const snapshots = HOME_WEEKENDS as Record<string, { ids: string[] }>;
const stale = new Map<string, string[]>();
const checkCard = async (name: string, region: string, catalog: typeof MONTHLY_EVENTS, day?: string) => {
  const card = JSON.parse(await readFile(`public/weekly/${name}.json`, 'utf8'));
  assert.match(card.generatedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(card.day, day ?? card.generatedAt, `${name}: card day`);
  const picks: CardPick[] = card.picks;
  const expected = getBuildWeekend(card.day, catalog).picks.map(({ event, date, editorial }) => ({ id: event.id, date, editorial }));
  assert.deepEqual(picks.map(({ id, date, editorial }) => ({ id, date, editorial })), expected, `${name}: same selection as the build`);
  // The share card matches the home page on its day. Snapshots end at the
  // edition's throughDate; after that there is nothing to compare against.
  if (region === 'all' && snapshots[card.day]) assert.deepEqual(picks.map(pick => pick.id), snapshots[card.day].ids, `${name}: same picks as the home page on ${card.day}`);
  // Editor picks come first, except a lead from the ranking (UI9-IMAGES DECISIONS 26): when no editor pick has a ① or ②
  // picture, the weekend's first that has one leads (home-weekend-build.ts), and then it must have one and they must not.
  const ledByRanking = !!picks[0] && !picks[0].editorial && picks.some(pick => pick.editorial);
  if (ledByRanking) {
    const byId = new Map(catalog.map(event => [event.id, event]));
    assert.ok(buildCanLead(byId.get(picks[0].id)!, card.day), `${name}: ${picks[0].id} leads with a ① or ② picture`);
    assert.ok(picks.filter(pick => pick.editorial).every(pick => !buildCanLead(byId.get(pick.id)!, card.day)), `${name}: no editor pick could lead`);
  }
  // UI9-IMG-A1b (DECISIONS 21): 0 information-card tiles — every tile is a photo, each file once on the card.
  assert.deepEqual(picks.filter(pick => !pick.photo).map(pick => pick.id), [], `${name}: every tile is a photo`);
  assert.equal(new Set(picks.map(pick => pick.photo)).size, picks.length, `${name}: no photo twice`);
  const rest = ledByRanking ? picks.slice(1) : picks;
  assert.ok(rest.every((pick, index) => !pick.editorial || rest.slice(0, index).every(before => before.editorial)), `${name}: editor picks come first`);
  for (const pick of picks) {
    if (pick.editorial) assert.ok(pick.editorial.reason.zh.trim() && pick.editorial.reason.en.trim(), `${name}: ${pick.id} has a reason`);
    // The card prints 核对 dates; content review marks an entry due after 7 days.
    if (region === 'all' && pick.verifiedAt <= addCalendarDays(card.day, -7)) stale.set(name, [...stale.get(name) || [], `${pick.id} (核对 ${pick.verifiedAt})`]);
  }
  // card v2: one image per language, each QR (≥300 px) opening the region's list in that language
  for (const prefix of ['', 'zh-Hant/', 'en/']) {
    // The Bay Area cards' preview for the home's 发到家庭群 panel (UI9-IMG-A1b): a WebP of at most 30 KB.
    if (region === 'all') {
      const thumb = await readFile(`public/weekly/${prefix}${name}-thumb.webp`);
      assert.ok(thumb.length <= 30 * 1024, `${prefix}${name}-thumb.webp: ${thumb.length} B > 30 KB`);
    }
    const png = PNG.sync.read(await readFile(`public/weekly/${prefix}${name}.png`));
    assert.equal(png.width, 1080); assert.equal(png.height, 1440);
    const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: 'dontInvert' });
    assert.equal(qr?.data, `https://www.baylink.us${prefix ? `/${prefix.slice(0, -1)}` : ''}/n/${region}`, `${prefix}${name}.png`);
  }
  return card;
};

const regions = ['all', 'sf', 'east-bay', 'peninsula', 'south-bay', 'north-bay'];
let occurrences = 0;
// The home page links /weekly/all-<today>.png on these days, so each card must exist.
const days = getWeeklyCardDays(HOME_GENERATED_AT);
for (const day of days) await checkCard(`all-${day}`, 'all', MONTHLY_EVENTS, day);
for (const region of regions) {
  const catalog = MONTHLY_EVENTS.filter(event => region === 'all' || event.region === region);
  const card = await checkCard(region, region, catalog);
  const raw = await readFile(`public/calendars/${region}.ics`, 'utf8');
  assert.ok(raw.endsWith('END:VCALENDAR\r\n'));
  for (const line of raw.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, `${region}: RFC line length`);
  const calendar = raw.replace(/\r\n[ \t]/g, '');
  const ids = new Set<string>();
  for (const block of calendar.split('BEGIN:VEVENT\r\n').slice(1)) {
    const uid = block.match(/^UID:(.+)$/m)![1].trim();
    assert.ok(!ids.has(uid)); ids.add(uid);
    const source = block.match(/^URL:https:\/\/www\.baylink\.us\/events\/([^?\r\n]+)\?date=(\d{4}-\d{2}-\d{2})/m)!;
    const event = catalog.find(item => item.id === source[1]);
    assert.ok(event, `${region}: known public event`);
    assert.ok(eventOccursOn(event, source[2]), `${event.id}: actual occurrence`);
    assert.ok(source[2] >= card.generatedAt && source[2] <= addCalendarDays(card.generatedAt, 45));
    // a stated session time makes a timed Bay Area event (TZID + VTIMEZONE); otherwise an all-day date
    const day = source[2].replaceAll('-', '');
    const timed = block.includes(`DTSTART;TZID=America/Los_Angeles:${day}T`);
    if (timed) assert.ok(calendar.includes('BEGIN:VTIMEZONE\r\nTZID:America/Los_Angeles'), `${region}: VTIMEZONE for TZID`);
    else {
      assert.ok(block.includes(`DTSTART;VALUE=DATE:${day}`));
      assert.ok(block.includes(`DTEND;VALUE=DATE:${addCalendarDays(source[2], 1).replaceAll('-', '')}`));
    }
    assert.ok(block.includes('TRIGGER:-P2D'));
    occurrences++;
  }
}
// A warning, not a failure: re-verifying an event is content work, not a build fault.
if (stale.size) console.warn(`Weekly cards print 核对 dates older than 7 days. Re-verify these events before sharing:\n${[...stale].map(([name, picks]) => `  ${name}.png: ${picks.join(', ')}`).join('\n')}`);
console.log(`Verified six 1080×1440 cards and ${days.length} dated Bay Area cards in three languages matching the home page, all stable QR links, and ${occurrences} actual calendar occurrences.`);
