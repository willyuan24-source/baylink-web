import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { eventOccursOn, addCalendarDays } from '../src/lib/event-calendar';
import { getHomeWeekend } from '../src/lib/home-weekend';

const regions = ['all', 'sf', 'east-bay', 'peninsula', 'south-bay', 'north-bay'];
let occurrences = 0;
for (const region of regions) {
  const card = JSON.parse(await readFile(`public/weekly/${region}.json`, 'utf8'));
  assert.match(card.generatedAt, /^\d{4}-\d{2}-\d{2}$/);
  const catalog = MONTHLY_EVENTS.filter(event => region === 'all' || event.region === region);
  const expected = getHomeWeekend(card.generatedAt, catalog).picks.map(({ event, date }) => ({ id: event.id, date }));
  assert.deepEqual(card.picks.map(({ id, date }: { id: string; date: string }) => ({ id, date })), expected);
  const png = PNG.sync.read(await readFile(`public/weekly/${region}.png`));
  assert.equal(png.width, 1080); assert.equal(png.height, 1440);
  const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: 'dontInvert' });
  assert.equal(qr?.data, `https://www.baylink.us/n/${region}`);
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
console.log(`Verified six 1080×1440 cards, all stable QR links, and ${occurrences} actual calendar occurrences.`);
