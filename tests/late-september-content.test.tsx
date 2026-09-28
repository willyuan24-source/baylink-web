import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { lateSeptemberSfEastEvents, lateSeptemberSfEastOpenings } from '../src/data/late-september-sf-east';
import { lateSeptemberPeninsulaSouthEvents, lateSeptemberPeninsulaSouthOpenings } from '../src/data/late-september-peninsula-south';
import { lateSeptemberNorthEvents, lateSeptemberNorthOpenings, lateSeptemberNorthOffers } from '../src/data/late-september-north';
import { lateSeptemberLocalOffers, regionalBulletins } from '../src/data/late-september-local';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import { loadLocale, translateText } from '../src/i18n/locale';
import { addCalendarDays, eventOccursOn, eventsOnCalendarDay, validCalendarDay } from '../src/lib/event-calendar';
import { buildEventCalendar, filterMonthlyEvents } from '../src/lib/monthly';

const cssHook = registerHooks({ load(url, context, nextLoad) {
  return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context);
} });
const { RegionalBulletins } = await import('../src/components/RegionalBulletins');
cssHook.deregister();

const events = [...lateSeptemberSfEastEvents, ...lateSeptemberPeninsulaSouthEvents, ...lateSeptemberNorthEvents];
const shops = [...lateSeptemberSfEastOpenings, ...lateSeptemberPeninsulaSouthOpenings, ...lateSeptemberNorthOpenings];
const offers = [...lateSeptemberLocalOffers, ...lateSeptemberNorthOffers];
const additions = [...events, ...shops, ...offers, ...regionalBulletins];
const regions = ['east-bay', 'north-bay', 'peninsula', 'sf', 'south-bay'];
const han = /[\u3400-\u9fff]/;

function stringsIn(value: unknown, path = 'content'): { path: string; text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, child]) => stringsIn(child, `${path}.${key}`));
  return [];
}

test('late September publishes all five regions with unique IDs and usable source links', () => {
  for (const [name, added, published, count] of [
    ['events', events, MONTHLY_EVENTS, 11],
    ['shops', shops, currentOpenings, 6],
    ['offers', offers, currentFreebies, 6],
    ['bulletins', regionalBulletins, regionalBulletins, 5],
  ] as const) {
    assert.equal(added.length, count, `${name}: expected batch size`);
    assert.deepEqual([...new Set(added.map(item => item.region))].sort(), regions, `${name}: regional coverage`);
    assert.equal(new Set(published.map(item => item.id)).size, published.length, `${name}: duplicate published ID`);
    for (const item of added) {
      assert.equal(published.filter(candidate => candidate.id === item.id).length, 1, `${name}: ${item.id} must be published once`);
      assert.equal(item.verifiedAt, '2026-09-27', `${item.id}: verification date`);
    }
  }
  assert.equal(new Set(additions.map(item => item.id)).size, additions.length, 'new content IDs must not collide across types');
  for (const item of additions) {
    const links = Object.entries(item).filter(([key]) => ['officialUrl', 'sourceUrl', 'storeUrl'].includes(key));
    assert.ok(links.length > 0, `${item.id}: missing supporting link`);
    for (const [key, value] of links) {
      assert.equal(typeof value, 'string', `${item.id}.${key}`);
      const url = new URL(value as string);
      assert.equal(url.protocol, 'https:', `${item.id}.${key}: secure public source`);
      assert.ok(url.hostname.includes('.') && !url.username && !url.password, `${item.id}.${key}: public hostname`);
      assert.doesNotMatch(value as string, /\s/, `${item.id}.${key}: malformed whitespace`);
    }
  }
});

test('every new Chinese editorial string translates through the loaded English runtime', async () => {
  await loadLocale('en');
  const chinese = additions.flatMap(item => stringsIn(item, item.id)).filter(item => han.test(item.text));
  assert.ok(chinese.length > 100, 'exercise the complete batch, including plans, conditions and source labels');
  for (const { path, text } of chinese) {
    const translated = translateText(text, 'en');
    assert.ok(translated.trim(), `${path}: empty translation`);
    assert.notEqual(translated, text, `${path}: untranslated text`);
    assert.doesNotMatch(translated, han, `${path}: Chinese remains in English output`);
  }
});

test('regional bulletins disappear at their expiry boundary without leaving an empty section', () => {
  const bart = regionalBulletins.find(item => item.id === 'east-bay-yellow-line-sep29');
  assert.ok(bart);
  const initial = renderToStaticMarkup(<RegionalBulletins today="2026-09-27" />);
  assert.equal((initial.match(/<article>/g) || []).length, 5);
  assert.ok(renderToStaticMarkup(<RegionalBulletins today="2026-10-01" />).includes(bart.sourceUrl), 'BART remains on its final listed day');
  const october = renderToStaticMarkup(<RegionalBulletins today="2026-10-02" />);
  assert.equal((october.match(/<article>/g) || []).length, 4);
  assert.ok(!october.includes(bart.sourceUrl), 'BART must not remain after October 1');
  for (const bulletin of regionalBulletins.filter(item => item.id !== bart.id)) {
    assert.ok(october.includes(bulletin.sourceUrl), `${bulletin.id}: still-current bulletin missing`);
  }
  assert.equal(renderToStaticMarkup(<RegionalBulletins today="2026-11-01" />), '');
});

test('published dates drive calendar filtering and export without filling gaps between Napa workshops', () => {
  for (const added of events) {
    const event = MONTHLY_EVENTS.find(item => item.id === added.id);
    assert.ok(event, `${added.id}: missing from calendar catalog`);
    assert.ok(validCalendarDay(event.startDate) && validCalendarDay(event.endDate) && event.startDate <= event.endDate, event.id);
    assert.ok(eventOccursOn(event, event.startDate), `${event.id}: missing first date`);
    assert.ok(eventOccursOn(event, event.endDate), `${event.id}: missing last date`);
    assert.equal(eventOccursOn(event, addCalendarDays(event.startDate, -1)), false, `${event.id}: before start`);
    assert.equal(eventOccursOn(event, addCalendarDays(event.endDate, 1)), false, `${event.id}: after end`);
    for (const day of event.occurrenceDates || []) {
      assert.ok(validCalendarDay(day) && day >= event.startDate && day <= event.endDate, `${event.id}: invalid occurrence ${day}`);
    }
  }
  const napa = MONTHLY_EVENTS.find(item => item.id === 'napa-water-wise-workshops-oct2026');
  assert.ok(napa);
  for (let day = '2026-10-07'; day <= '2026-10-14'; day = addCalendarDays(day, 1)) {
    const expected = day === '2026-10-07' || day === '2026-10-14';
    assert.equal(eventsOnCalendarDay(MONTHLY_EVENTS, day).some(item => item.id === napa.id), expected, `calendar on ${day}`);
    assert.equal(filterMonthlyEvents(MONTHLY_EVENTS, { date: 'today' }, day).some(item => item.id === napa.id), expected, `today filter on ${day}`);
  }
  const calendar = buildEventCalendar(napa);
  assert.deepEqual([...calendar.matchAll(/^DTSTART;VALUE=DATE:(\d{8})/gm)].map(match => match[1]), ['20261007', '20261014']);
  assert.deepEqual([...calendar.matchAll(/^DTEND;VALUE=DATE:(\d{8})/gm)].map(match => match[1]), ['20261008', '20261015']);
  assert.equal((calendar.match(/BEGIN:VEVENT/g) || []).length, 2, 'export two separate one-day reminders');
});
