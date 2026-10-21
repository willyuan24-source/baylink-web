import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { CLAUDE_REVIEWED_2026_10_21 } from './support/claude-review-2026-10-21';
import { EDITOR_REVIEW_DATE_2026_10_16, EDITOR_REVIEWED_2026_10_16, EDITOR_REVIEWED_2026_10_16_FOURTH, EDITOR_REVIEWED_2026_10_16_THIRD } from './support/editor-review-2026-10-16';

// verifiedAt 2026-10-16 is a claim that someone read the official page that day. Only two things may make it: the GPT editor's
// third and fourth weekend reviews (their 可核 rows, listed in ./support/editor-review-2026-10-16.ts) or a batch first published that day
// (src/data/*-2026-10-16-events.json, each item read from its official page). A stamp landing on a neighbouring object, or a
// reviewed row keeping its old date, fails here (the batch-pin tests only cover some batches).
const NEW_BATCH_IDS = new Set(
  readdirSync('src/data')
    .filter(name => name.endsWith('-2026-10-16-events.json'))
    .flatMap(name => (JSON.parse(readFileSync(`src/data/${name}`, 'utf8')) as { id: string }[]).map(item => item.id)),
);

test('verifiedAt 2026-10-16 sits exactly on the reviewed rows and the batches first published that day', () => {
  const stamped = MONTHLY_EVENTS.filter(event => event.verifiedAt === EDITOR_REVIEW_DATE_2026_10_16).map(event => event.id);
  const unexplained = stamped.filter(id => !EDITOR_REVIEWED_2026_10_16.has(id) && !NEW_BATCH_IDS.has(id)).sort();
  assert.deepEqual(unexplained, []);
  assert.ok(NEW_BATCH_IDS.has('sanleandro-main-mandarin-storytime-dec5-2026'), 'the Dec–Jan Chinese batch is read');
});

test('every row the editor marked 可核 on 2026-10-16 exists and carries that date (or a later Claude review date)', () => {
  const byId = new Map(MONTHLY_EVENTS.map(event => [event.id, event]));
  // Claude's 10-21 weekly review re-read some of these rows on their official pages; they carry its date instead.
  const wrong = [...EDITOR_REVIEWED_2026_10_16]
    .filter(id => byId.get(id)?.verifiedAt !== (CLAUDE_REVIEWED_2026_10_21.has(id) ? '2026-10-21' : EDITOR_REVIEW_DATE_2026_10_16))
    .map(id => `${id}: ${byId.get(id)?.verifiedAt ?? 'missing'}`)
    .sort();
  assert.deepEqual(wrong, []);
  assert.equal(EDITOR_REVIEWED_2026_10_16_THIRD.size, 84);
  // CNT-WEEKEND-1128: the fourth pass (11/28–12/13) marked 69 rows 可核; 34 of them were already in the third pass's list.
  assert.equal(EDITOR_REVIEWED_2026_10_16_FOURTH.size, 69);
});

test('the review leaves partly read rows and items outside the reviewed weekends on their earlier dates', () => {
  const byId = new Map(MONTHLY_EVENTS.map(event => [event.id, event]));
  // 部分核实 in weekend-review-1107.csv, and neighbours of reviewed rows in the two batches whose objects list verifiedAt before id.
  for (const [id, date] of [
    ['nov2026-ardenwood-chestnut-treats', '2026-10-07'],
    ['nov2026-big-break-accessible-winter-birding', '2026-10-07'],
    ['nov2026-tilden-good-night-farm', '2026-10-07'],
    ['november-north-sips-stars-2026', '2026-10-05'],
    ['november-north-bale-old-mill-days-2026', '2026-10-05'],
  ] as const) assert.equal(byId.get(id)?.verifiedAt, date, id);
});

test('the fourth pass leaves its partly read, corrected and conflicting rows on their earlier dates', () => {
  const byId = new Map(MONTHLY_EVENTS.map(event => [event.id, event]));
  // 部分核实, 需更新 and 官网冲突 in weekend-review-1128.csv: CNT-WEEKEND-1128 corrected some of them from its own reads of 2026-10-17,
  // which never moves verifiedAt (D12).
  for (const [id, date] of [
    ['stanford-smu-football-nov-2026', '2026-10-02'],
    ['fopal-book-sale-dec-2026', '2026-10-13'],
    ['acl-dublin-family-movies-thanksgiving-2026', '2026-10-13'],
    ['octnov-los-altos-lights-parade-2026', '2026-10-07'],
    ['fairyland-fairy-winterland-2026', '2026-10-15'],
    ['grace-cathedral-sing-merry-christmas-2026', '2026-10-15'],
    ['circus-bella-bravura-2026', '2026-10-15'],
    ['sjpl-alviso-stem-sundays-2026', '2026-10-15'],
    ['sjpl-tully-friends-book-sale-dec5-2026', '2026-10-13'],
  ] as const) assert.equal(byId.get(id)?.verifiedAt, date, id);
  for (const id of EDITOR_REVIEWED_2026_10_16_FOURTH) assert.equal(byId.get(id)?.verifiedAt, CLAUDE_REVIEWED_2026_10_21.has(id) ? '2026-10-21' : EDITOR_REVIEW_DATE_2026_10_16, id);
});
