import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { eventOccursOn, addCalendarDays } from '../src/lib/event-calendar';
import { HOME_GENERATED_AT, HOME_WEEKENDS } from '../src/lib/home-catalog';
import { getWeeklyCardDays } from '../src/lib/home-weekend';
import { getBuildWeekend } from '../src/lib/home-weekend-build';

type CardPick = { id: string; date: string; verifiedAt: string; editorial?: { rank: number; reason: { zh: string; en: string } } };
const snapshots = HOME_WEEKENDS as Record<string, { ids: string[] }>;
const stale = new Set<string>();
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
  assert.ok(picks.every((pick, index) => !pick.editorial || picks.slice(0, index).every(before => before.editorial)), `${name}: editor picks come first`);
  for (const pick of picks) {
    if (pick.editorial) assert.ok(pick.editorial.reason.zh.trim() && pick.editorial.reason.en.trim(), `${name}: ${pick.id} has a reason`);
    // The card prints 核对 dates; content review marks an entry due after 7 days.
    if (region === 'all' && pick.verifiedAt <= addCalendarDays(card.day, -7)) stale.add(`${pick.id} (核对 ${pick.verifiedAt})`);
  }
  const png = PNG.sync.read(await readFile(`public/weekly/${name}.png`));
  assert.equal(png.width, 1080); assert.equal(png.height, 1440);
  const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: 'dontInvert' });
  assert.equal(qr?.data, `https://www.baylink.us/n/${region}`);
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
    assert.ok(block.includes(`DTSTART;VALUE=DATE:${source[2].replaceAll('-', '')}`));
    assert.ok(block.includes(`DTEND;VALUE=DATE:${addCalendarDays(source[2], 1).replaceAll('-', '')}`));
    assert.ok(block.includes('TRIGGER:-P2D'));
    occurrences++;
  }
}
if (stale.size) console.warn(`Weekly cards print 核对 dates older than 7 days: ${[...stale].join(', ')}. Re-verify these events before sharing.`);
console.log(`Verified six 1080×1440 cards and ${days.length} dated Bay Area cards matching the home page, all stable QR links, and ${occurrences} actual calendar occurrences.`);
