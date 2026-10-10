import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { EVENT_DATE_OVERRIDES, EVENT_SCHEDULE_NOTES } from '../src/data/event-calendar-dates';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import type { MonthlyEvent } from '../src/data/monthly-types';
import {
  applyEventOverlay, cleanDateLabel, cleanPlan, EVENT_OVERLAY, FILLER_SENTENCES, OFFER_OVERLAY, OPENING_OVERLAY, ownShortTitle, PRE_OVERLAY, venueParts,
} from '../src/data/editorial-overlay/apply';
import { basisFor, fieldHash, lintEditorial, overlayCoverage, readEnglishSources, type LintInput } from '../src/data/editorial-overlay/lint';
import { eventOccursOn } from '../src/lib/event-calendar';
import { displayUnits, eventShortTitle } from '../src/lib/event-facts';

// The lane's scope: every item live on or after 10/16 (owner, 10/09). A fixed day keeps the gate deterministic.
const FROM = '2026-10-16';
const english = readEnglishSources(path => readFileSync(path, 'utf8'));
const overlay = { events: EVENT_OVERLAY, offers: OFFER_OVERLAY, openings: OPENING_OVERLAY };
const input = (extra: Partial<LintInput> = {}): LintInput => ({ events: MONTHLY_EVENTS, offers: currentFreebies, openings: currentOpenings, overlay, english, from: FROM, sources: PRE_OVERLAY, ...extra });

test('the editorial lint has no errors on any item with an overlay entry (content.md §4.4)', () => {
  const errors = lintEditorial(input()).filter(issue => issue.level === 'error');
  assert.deepEqual(errors.map(issue => `${issue.rule} ${issue.kind}:${issue.id} ${issue.detail}`), []);
});

test('every event live from 10/16 has a card-length short title and a dek', () => {
  const live = MONTHLY_EVENTS.filter(event => event.endDate >= FROM && Object.hasOwn(EVENT_OVERLAY, event.id));
  const coverage = overlayCoverage({ events: MONTHLY_EVENTS, overlay, from: FROM });
  assert.ok(coverage.covered >= 260, `covered ${coverage.covered} of ${coverage.live}`);
  for (const event of live) {
    assert.ok(event.shortTitle, event.id);
    assert.ok(displayUnits(event.shortTitle!) <= 16, `${event.id}: ${event.shortTitle}`);
    assert.doesNotMatch(event.shortTitle!, /[：:｜|]/, event.id);
    assert.equal(eventShortTitle(event), event.shortTitle, 'event-facts reads the overlay field');
    assert.ok(event.dek && displayUnits(event.dek) <= 30, `${event.id}: ${event.dek}`);
    assert.ok(english[event.shortTitle!.trim()] || !/[㐀-鿿]/u.test(event.shortTitle!), `${event.id}: English short title`);
  }
});

test('covered events lose the filler line, the date-label repeat and the cost-label copy', () => {
  const live = MONTHLY_EVENTS.filter(event => event.endDate >= FROM && Object.hasOwn(EVENT_OVERLAY, event.id));
  for (const event of live) for (const line of event.plan) {
    assert.ok(!FILLER_SENTENCES.some(filler => line.includes(filler)), `${event.id}: ${line}`);
    assert.ok(!line.startsWith('时间安排：') && !line.startsWith('费用与参加条件：'), `${event.id}: ${line}`);
    if (event.cost === 'free') assert.doesNotMatch(line, /余票/u, `${event.id}: a free event does not mention sold-out tickets`);
  }
});

test('cleanPlan keeps the new information after a repeated cost label and drops pure repeats', () => {
  const plan = [
    '时间安排：18:00–21:00。',
    '费用与参加条件：免费；须提前登记。 2026-10-01 开始预登记；儿童须成人陪同。',
    '费用与参加条件：免费；须提前登记。',
    '10/16 约 18:40 放映。 出发前查看主办方最新公告，按场次确认余票、入场要求及交通安排。',
    '出发前查看主办方最新公告，按场次确认余票、入场要求及交通安排。',
    '带毯子。',
    '带毯子。',
  ];
  assert.deepEqual(cleanPlan(plan, '10/16 · 18:00–21:00', '免费；须提前登记。'), ['2026-10-01 开始预登记；儿童须成人陪同。', '10/16 约 18:40 放映。', '带毯子。']);
  assert.deepEqual(cleanPlan(['时间安排：另有 9:30 场。'], '10/16 · 10:15', '免费'), ['时间安排：另有 9:30 场。'], 'a date line with new facts stays');
});

test('the overlay changes only items it covers, applies last and never touches images or verifiedAt (D12, a4 precedent)', () => {
  const base: MonthlyEvent = {
    id: 'x', title: '长长长长长长长长长长长长长长长长长长：副标题', startDate: '2026-10-17', endDate: '2026-10-17', dateLabel: '10/17 · 10:00–12:00', region: 'sf', city: 'San Francisco',
    venue: 'Baldwin Park · 2790A Parkside Circle, Concord, CA', category: 'family', cost: 'free', costLabel: '免费。', summary: '', audience: [], officialUrl: 'https://example.org', sourceLabel: 'x', verifiedAt: '2026-09-28', imageKey: 'weekend',
    plan: ['时间安排：10:00–12:00。', '费用与参加条件：免费。 带水。', FILLER_SENTENCES[0]],
  };
  const other = { ...base, id: 'y' };
  const [applied, untouched] = applyEventOverlay([base, other], { x: { shortTitle: '短标题', fix: { costLabel: '免费入场。' } } });
  assert.equal(untouched, other, 'an item without an entry is returned as is (RC-29)');
  assert.deepEqual(applied.plan, ['带水。']);
  assert.equal(applied.shortTitle, '短标题');
  assert.equal(applied.costLabel, '免费入场。');
  assert.deepEqual([applied.venueShort, applied.address], ['Baldwin Park', '2790A Parkside Circle, Concord, CA']);
  assert.deepEqual([applied.imageKey, applied.verifiedAt], ['weekend', '2026-09-28']);
  for (const event of MONTHLY_EVENTS) {
    const source = PRE_OVERLAY.get(`event:${event.id}`);
    if (!source) continue;
    assert.equal(event.imageKey, source.imageKey, `${event.id}: images belong to the media overlays`);
    assert.equal(event.verifiedAt, source.verifiedAt, `${event.id}: verifiedAt is human-only`);
  }
  for (const [kind, entries] of [['event', EVENT_OVERLAY], ['offer', OFFER_OVERLAY], ['opening', OPENING_OVERLAY]] as const) for (const [id, entry] of Object.entries(entries)) {
    for (const key of ['id', 'verifiedAt', 'imageKey']) assert.ok(!Object.hasOwn(entry.fix ?? {}, key), `${id}: fix.${key}`);
    const source = PRE_OVERLAY.get(`${kind}:${id}`);
    for (const [key, value] of Object.entries(entry.fix ?? {})) if (source?.[key] !== undefined) {
      assert.equal(Array.isArray(value), Array.isArray(source[key]), `${id}: fix.${key} keeps the field's shape`);
      assert.equal(typeof value, typeof source[key], `${id}: fix.${key} keeps the field's type`);
    }
  }
});

test('a title that already reads as a card title is its own short title; venues split at the street address', () => {
  assert.equal(ownShortTitle('Petaluma 南瓜田与玉米迷宫'), 'Petaluma 南瓜田与玉米迷宫');
  assert.equal(ownShortTitle('Arts Benicia：A Night in Venice 艺术晚宴'), undefined);
  assert.deepEqual(venueParts('Fairfax Library, 2097 Sir Francis Drake Boulevard'), { venueShort: 'Fairfax Library', address: '2097 Sir Francis Drake Boulevard' });
  assert.deepEqual(venueParts('Piedmont Park · Main lawn'), { venueShort: 'Piedmont Park' });
  assert.deepEqual(venueParts('Alameda County Fairgrounds，Gate 8 · 2005 Valley Avenue, Pleasanton, CA 94566'), { venueShort: 'Alameda County Fairgrounds', address: '2005 Valley Avenue, Pleasanton, CA 94566' });
});

test('a one-day date label never repeats its date; ranges and new facts after the date stay', () => {
  assert.equal(cleanDateLabel('10/24 · 10 月 24 日 · 11:00–14:00', '2026-10-24', '2026-10-24'), '10/24 · 11:00–14:00');
  assert.equal(cleanDateLabel('10/17 · 10/17/2026 18:30开始；结束时间未公布。', '2026-10-17', '2026-10-17'), '10/17 · 18:30开始；结束时间未公布。');
  assert.equal(cleanDateLabel('10/16–10/17 · 10/16 09:30–17:00', '2026-10-16', '2026-10-17'), '10/16–10/17 · 10/16 09:30–17:00');
  assert.equal(cleanDateLabel('10/24 · 10 月 25 日改期', '2026-10-24', '2026-10-24'), '10/24 · 10 月 25 日改期');
  assert.equal(cleanDateLabel('10/24 · 10 月 24 日 · ', '2026-10-24', '2026-10-24'), '10/24 · 10 月 24 日 · ');
  const live = MONTHLY_EVENTS.filter(event => event.endDate >= FROM && event.startDate === event.endDate && Object.hasOwn(EVENT_OVERLAY, event.id));
  for (const event of live) {
    const [, month, day] = event.startDate.split('-').map(Number);
    assert.doesNotMatch(event.dateLabel, new RegExp(`^${month}/${day} · (${month} 月 ${day} 日|${month}/${day}/2026) `, 'u'), event.id);
  }
});

test('items without an entry are only warned, so new catalog content is never blocked (RC-29)', () => {
  const stranger: MonthlyEvent = { ...MONTHLY_EVENTS[0], id: 'brand-new-2026', title: '免费活动：标题', cost: 'unknown', endDate: '2026-12-01', plan: [FILLER_SENTENCES[0]] };
  const issues = lintEditorial(input({ events: [stranger], offers: [], openings: [], overlay: { events: {}, offers: {}, openings: {} } }));
  assert.ok(issues.length >= 2);
  assert.ok(issues.every(issue => issue.level === 'warn'), JSON.stringify(issues));
});

test('the lint flags overlay errors: long short titles, bad sessions, impossible prices and missing English', () => {
  const event = { ...MONTHLY_EVENTS.find(item => item.id === 'concord-trick-or-treat-trail-2026')! };
  const bad = { ...event, shortTitle: '一二三四五六七八九十一二三四五六七', sessions: [{ date: '2026-12-31', start: '25:00' }], price: { free: true, min: 5 }, dek: '没有英文的一句新简介', dateLabel: '10/18 · 没有英文的时间说明' };
  const issues = lintEditorial(input({ events: [bad], offers: [], openings: [], overlay: { events: { [event.id]: { dek: bad.dek } }, offers: {}, openings: {} } }));
  const rules = new Set(issues.filter(issue => issue.level === 'error').map(issue => issue.rule));
  for (const rule of ['short-title', 'sessions', 'price', 'english']) assert.ok(rules.has(rule), `${rule}: ${[...rules]}`);
  assert.ok(issues.some(issue => issue.rule === 'english' && issue.detail.includes('(没有英文的时间说明)')), 'a date label part without English');
});

test('basis.json notices when a source field changes under an entry', () => {
  const basis = JSON.parse(readFileSync('src/data/editorial-overlay/basis.json', 'utf8'));
  assert.ok(Object.keys(basis).length >= Object.keys(EVENT_OVERLAY).length, 'every covered item has a recorded basis');
  const key = 'event:concord-trick-or-treat-trail-2026';
  const source = PRE_OVERLAY.get(key)!;
  assert.equal(basis[key].title, fieldHash(source.title));
  const edited = new Map(PRE_OVERLAY);
  edited.set(key, { ...source, costLabel: '收费 $5。' });
  const drift = lintEditorial(input({ sources: edited, basis: basisFor(PRE_OVERLAY) })).filter(issue => issue.rule === 'source-changed');
  assert.deepEqual(drift.map(issue => [issue.level, issue.id, issue.detail.split(' ')[0]]), [['warn', 'concord-trick-or-treat-trail-2026', 'costLabel']]);
});

test('the Sonoma movie night no longer advertises 免费 while its cost is unknown (CNT-13)', () => {
  const event = MONTHLY_EVENTS.find(item => item.id === 'sonoma-dia-movie-night-2026')!;
  if (event.cost !== 'free' && event.cost !== 'mixed') assert.doesNotMatch(event.title, /免费/u);
});

test('the calendar follows overlay date corrections: a postponed event has no day and no superseded time note', () => {
  for (const [id, { fix, dateNote }] of Object.entries(EVENT_OVERLAY)) {
    if (fix?.occurrenceDates !== undefined) assert.deepEqual(EVENT_DATE_OVERRIDES[id], fix.occurrenceDates, id);
    if (fix?.dateLabel && Object.hasOwn(EVENT_SCHEDULE_NOTES, id)) {
      const note = EVENT_SCHEDULE_NOTES[id];
      assert.ok(note === dateNote || fix.dateLabel.endsWith(note.replace(/^时间安排：/u, '')), `${id}: ${note}`);
    }
  }
  const postponed = MONTHLY_EVENTS.find(event => event.id === 'south-sf-state-of-city-2026')!;
  assert.equal(eventOccursOn(postponed, '2026-10-27'), false);
});
